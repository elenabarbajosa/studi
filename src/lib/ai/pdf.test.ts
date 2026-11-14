import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PDFDocument } from "pdf-lib";

import { AiFeatureError } from "@/lib/ai/errors";
import { validatePdfUpload, validatePastedText } from "@/lib/ai/pdf";

describe("validatePastedText", () => {
  it("rejects empty text", () => {
    assert.throws(() => validatePastedText("   "), (e: unknown) => e instanceof AiFeatureError);
  });

  it("accepts short syllabus text", () => {
    assert.equal(validatePastedText(" Week 1: Limits "), "Week 1: Limits");
  });
});

describe("validatePdfUpload", () => {
  it("accepts a tiny valid PDF under page/size limits", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const bytes = await doc.save();
    const result = await validatePdfUpload({
      bytes,
      fileName: "sample.pdf",
      mimeType: "application/pdf",
    });
    assert.equal(result.pageCount, 1);
    assert.equal(result.fileName, "sample.pdf");
  });

  it("rejects non-PDF bytes", async () => {
    await assert.rejects(
      () =>
        validatePdfUpload({
          bytes: new TextEncoder().encode("hello"),
          fileName: "notes.txt",
          mimeType: "text/plain",
        }),
      (e: unknown) => e instanceof AiFeatureError && e.code === "invalid_input",
    );
  });
});
