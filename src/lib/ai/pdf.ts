import { PDFDocument } from "pdf-lib";

import { AI_LIMITS } from "@/lib/ai/limits";
import { AiFeatureError } from "@/lib/ai/errors";

const PDF_MAGIC = Buffer.from("%PDF-");

export type ValidatedPdf = {
  bytes: Uint8Array;
  pageCount: number;
  byteLength: number;
  fileName: string;
};

export function assertPdfMagic(bytes: Uint8Array) {
  if (bytes.byteLength < 5) {
    throw new AiFeatureError("invalid_input", "That file does not look like a PDF.");
  }
  for (let i = 0; i < PDF_MAGIC.length; i += 1) {
    if (bytes[i] !== PDF_MAGIC[i]) {
      throw new AiFeatureError("invalid_input", "Only PDF files are supported for syllabus import.");
    }
  }
}

export async function validatePdfUpload(input: {
  bytes: Uint8Array;
  fileName?: string | null;
  mimeType?: string | null;
}): Promise<ValidatedPdf> {
  const fileName = (input.fileName?.trim() || "syllabus.pdf").slice(0, 200);
  const mime = input.mimeType?.toLowerCase() ?? "";

  if (mime && mime !== "application/pdf" && mime !== "application/x-pdf") {
    throw new AiFeatureError("invalid_input", "Only PDF files are supported for syllabus import.");
  }

  if (input.bytes.byteLength === 0) {
    throw new AiFeatureError("invalid_input", "The PDF file is empty.");
  }

  if (input.bytes.byteLength > AI_LIMITS.maxPdfBytes) {
    throw new AiFeatureError(
      "invalid_input",
      `PDF must be ${Math.floor(AI_LIMITS.maxPdfBytes / (1024 * 1024))} MB or smaller.`,
    );
  }

  assertPdfMagic(input.bytes);

  let pageCount: number;
  try {
    const doc = await PDFDocument.load(input.bytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    pageCount = doc.getPageCount();
  } catch {
    throw new AiFeatureError("invalid_input", "Could not read that PDF. Try another file or paste the text.");
  }

  if (pageCount < 1) {
    throw new AiFeatureError("invalid_input", "The PDF has no pages.");
  }

  if (pageCount > AI_LIMITS.maxPdfPages) {
    throw new AiFeatureError(
      "invalid_input",
      `PDF must be ${AI_LIMITS.maxPdfPages} pages or fewer (this file has ${pageCount}).`,
    );
  }

  return {
    bytes: input.bytes,
    pageCount,
    byteLength: input.bytes.byteLength,
    fileName,
  };
}

export function validatePastedText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new AiFeatureError("invalid_input", "Paste syllabus text or upload a PDF.");
  }
  if (trimmed.length > AI_LIMITS.maxTextChars) {
    throw new AiFeatureError(
      "invalid_input",
      `Pasted text must be ${AI_LIMITS.maxTextChars.toLocaleString()} characters or fewer.`,
    );
  }
  return trimmed;
}
