import "server-only";

import { GoogleGenAI } from "@google/genai";

import { DEFAULT_GEMINI_MODEL } from "@/lib/ai/limits";

export function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  return key;
}

/** Server-only model id. Client-supplied names are never accepted. */
export function getGeminiModel(): string {
  const configured = process.env.GEMINI_MODEL?.trim();
  if (!configured) return DEFAULT_GEMINI_MODEL;
  // Reject path-like or injection-looking values.
  if (!/^[a-zA-Z0-9._-]+$/.test(configured)) {
    return DEFAULT_GEMINI_MODEL;
  }
  return configured;
}

export function createGeminiClient() {
  return new GoogleGenAI({ apiKey: getGeminiApiKey() });
}
