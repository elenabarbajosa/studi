import "server-only";

import { createGeminiClient, getGeminiModel } from "@/lib/ai/client";
import { AiFeatureError, mapGeminiError } from "@/lib/ai/errors";
import {
  extractionToReviewDraft,
  parseSyllabusExtraction,
  resetLocalIdCounter,
  safeParseSyllabusExtraction,
} from "@/lib/ai/import-plan";
import { buildSyllabusUserPrompt, SYLLABUS_SYSTEM_INSTRUCTION } from "@/lib/ai/prompt";
import { geminiSyllabusJsonSchema, type SyllabusReviewDraft } from "@/lib/ai/schemas";
import type { ValidatedPdf } from "@/lib/ai/pdf";

export type ExtractSyllabusInput =
  | {
      kind: "text";
      text: string;
      subjectName: string;
      existingTopicTitles: string[];
    }
  | {
      kind: "pdf";
      pdf: ValidatedPdf;
      subjectName: string;
      existingTopicTitles: string[];
    };

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export async function extractSyllabusDraft(
  input: ExtractSyllabusInput,
): Promise<{ draft: SyllabusReviewDraft; model: string; rawText: string }> {
  const model = getGeminiModel();
  const ai = createGeminiClient();

  const prompt = buildSyllabusUserPrompt({
    subjectName: input.subjectName,
    existingTopicTitles: input.existingTopicTitles,
    sourceKind: input.kind,
  });

  const contents =
    input.kind === "text"
      ? [
          { text: prompt },
          { text: `\n\n--- Syllabus text ---\n${input.text}` },
        ]
      : [
          { text: prompt },
          {
            inlineData: {
              mimeType: "application/pdf",
              data: bytesToBase64(input.pdf.bytes),
            },
          },
        ];

  let responseText: string;
  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: SYLLABUS_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseJsonSchema: geminiSyllabusJsonSchema,
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
      "Gemini returned invalid JSON. Try a shorter syllabus or paste the text instead.",
    );
  }

  const parsed = safeParseSyllabusExtraction(json);
  if (!parsed.success) {
    throw new AiFeatureError(
      "parse_error",
      "Gemini returned data that did not match the expected syllabus shape.",
    );
  }

  resetLocalIdCounter();
  const extraction = parseSyllabusExtraction(parsed.data);
  const draft = extractionToReviewDraft(extraction, input.existingTopicTitles);

  return { draft, model, rawText: responseText };
}
