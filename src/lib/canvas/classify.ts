import "server-only";

import { createGeminiClient, getGeminiModel } from "@/lib/ai/client";
import { AiFeatureError, mapGeminiError } from "@/lib/ai/errors";
import { CANVAS_LIMITS } from "@/lib/canvas/limits";
import { validateClassifications } from "@/lib/canvas/classify-validate";
import { geminiCanvasClassifyJsonSchema } from "@/lib/canvas/schemas";
import type {
  CanvasClassification,
  CanvasInventoryItem,
  TopicNodeForAi,
} from "@/lib/canvas/types";

export { validateClassifications } from "@/lib/canvas/classify-validate";
export type { TopicNodeForAi } from "@/lib/canvas/types";

export const CANVAS_CLASSIFY_SYSTEM = `You are Studi's Canvas material organizer.
Match each course material to the best EXISTING topic or subtopic for a subject.
Rules:
- Only use topic IDs from the provided list. Never invent IDs or new topics.
- Prefer the closest existing topic; use topicId null with confidence "none" when unsure.
- confidence: high (clear match), medium (plausible), low (weak), none (unassigned).
- Keep explanations short (≤120 chars). Preserve the material's language/terminology.
- Do not claim Canvas-internal or missing items are downloadable files.`;

export type ClassifyCanvasInput = {
  subjectName: string;
  topics: TopicNodeForAi[];
  items: CanvasInventoryItem[];
  /** Optional short text snippets keyed by localId (only with user consent). */
  contentSnippets?: Record<string, string>;
};

function buildUserPrompt(input: ClassifyCanvasInput): string {
  const topicLines = input.topics.length
    ? input.topics
        .map((t) =>
          t.parentTitle
            ? `- ${t.id} | ${t.parentTitle} › ${t.title}`
            : `- ${t.id} | ${t.title}`,
        )
        .join("\n")
    : "(no topics yet — leave all topicId null)";

  const materialLines = input.items
    .slice(0, CANVAS_LIMITS.maxClassifyBatch)
    .map((item) => {
      const snippet = input.contentSnippets?.[item.localId];
      const parts = [
        `localId=${item.localId}`,
        `kind=${item.kind}`,
        `title=${item.title}`,
        item.modulePath ? `module=${item.modulePath}` : null,
        item.archivePath ? `path=${item.archivePath}` : null,
        item.externalUrl ? `url=${item.externalUrl}` : null,
        item.note ? `note=${item.note}` : null,
        snippet ? `snippet=${snippet.slice(0, 400)}` : null,
      ].filter(Boolean);
      return parts.join(" | ");
    })
    .join("\n");

  let body = `Subject: ${input.subjectName}

Existing topics (id | path):
${topicLines}

Materials to classify:
${materialLines}

Return JSON with a classifications array covering every localId.`;

  if (body.length > CANVAS_LIMITS.maxAiContextChars) {
    body = body.slice(0, CANVAS_LIMITS.maxAiContextChars);
  }
  return body;
}

export async function classifyCanvasMaterials(
  input: ClassifyCanvasInput,
): Promise<{ classifications: CanvasClassification[]; model: string }> {
  const model = getGeminiModel();
  const ai = createGeminiClient();
  const prompt = buildUserPrompt(input);

  let responseText: string;
  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ text: prompt }],
      config: {
        systemInstruction: CANVAS_CLASSIFY_SYSTEM,
        responseMimeType: "application/json",
        responseJsonSchema: geminiCanvasClassifyJsonSchema,
        automaticContinuation: false,
        temperature: 0.2,
      },
    });
    responseText = response.text?.trim() ?? "";
  } catch (error) {
    throw mapGeminiError(error);
  }

  if (!responseText) {
    throw new AiFeatureError("parse_error", "Gemini returned an empty response.");
  }

  let json: unknown;
  try {
    json = JSON.parse(responseText);
  } catch {
    throw new AiFeatureError(
      "parse_error",
      "Gemini returned invalid JSON for Canvas classification.",
    );
  }

  const allowed = new Set(input.topics.map((t) => t.id));
  const localIds = input.items
    .slice(0, CANVAS_LIMITS.maxClassifyBatch)
    .map((i) => i.localId);
  try {
    const classifications = validateClassifications(json, allowed, localIds);
    return { classifications, model };
  } catch (error) {
    throw new AiFeatureError(
      "parse_error",
      error instanceof Error ? error.message : "Invalid classification response.",
    );
  }
}
