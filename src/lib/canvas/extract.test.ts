import assert from "node:assert/strict";
import { describe, it } from "node:test";
import JSZip from "jszip";

import { scanCanvasArchiveBytes } from "@/lib/canvas/extract";

async function makeZip(files: Record<string, string | Uint8Array>) {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  return zip.generateAsync({ type: "uint8array" });
}

describe("scanCanvasArchiveBytes", () => {
  it("scans a flat ZIP of nested study files", async () => {
    const data = await makeZip({
      "Week 1/notes.pdf": "%PDF-1.4 fake",
      "Week 1/slides.pptx": "PK fake pptx",
      "Week 1/readme.txt": "hello class",
      "Week 1/secret.exe": "MZ",
      "__MACOSX/._notes.pdf": "junk",
    });
    const result = await scanCanvasArchiveBytes(data);
    assert.equal(result.format, "zip");
    const files = result.items.filter((i) => i.kind === "file");
    assert.ok(files.some((f) => f.archivePath === "Week 1/notes.pdf"));
    assert.ok(files.some((f) => f.archivePath === "Week 1/slides.pptx"));
    assert.ok(!files.some((f) => f.archivePath?.endsWith(".exe")));
    assert.ok(!files.some((f) => f.archivePath?.includes("__MACOSX")));
  });

  it("parses an IMSCC-style archive with manifest + missing refs", async () => {
    const manifest = `<?xml version="1.0"?>
<manifest>
  <metadata><lom><general><title>Chem 101</title></general></lom></metadata>
  <organizations>
    <organization>
      <item identifier="m1">
        <title>Atoms</title>
        <item identifier="i1" identifierref="r1"><title>PDF</title></item>
        <item identifier="i2" identifierref="r2"><title>Missing</title></item>
        <item identifier="i3" identifierref="r3"><title>Link</title></item>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="r1" type="webcontent" href="files/atoms.pdf">
      <file href="files/atoms.pdf"/>
    </resource>
    <resource identifier="r2" type="webcontent" href="files/missing.docx">
      <file href="files/missing.docx"/>
    </resource>
    <resource identifier="r3" type="imswl_xmlv1p1" href="wl.xml">
      <file href="wl.xml"/>
    </resource>
  </resources>
</manifest>`;
    const data = await makeZip({
      "imsmanifest.xml": manifest,
      "files/atoms.pdf": "%PDF-1.4 atoms",
      "wl.xml": `<?xml version="1.0"?><webLink><url>https://example.com/reading</url></webLink>`,
      "files/page.html": `<html><body><a href="https://example.org/extra">x</a><a href="https://school.instructure.com/courses/1">canvas</a></body></html>`,
    });

    const result = await scanCanvasArchiveBytes(data);
    assert.equal(result.format, "imscc");
    assert.equal(result.courseTitle, "Chem 101");
    assert.ok(result.items.some((i) => i.kind === "file" && i.archivePath === "files/atoms.pdf"));
    assert.ok(result.items.some((i) => i.kind === "missing"));
    assert.ok(
      result.items.some(
        (i) => i.kind === "external_link" && i.externalUrl === "https://example.com/reading",
      ),
    );
    assert.ok(result.items.some((i) => i.kind === "canvas_internal"));
    assert.ok(
      result.items.some(
        (i) => i.kind === "external_link" && i.externalUrl === "https://example.org/extra",
      ),
    );
  });

  it("handles malformed / missing manifest as flat ZIP fallback", async () => {
    const data = await makeZip({
      "broken/imsmanifest.xml": "<not-closed",
      "docs/handout.pdf": "%PDF-1.4",
    });
    // imsmanifest present but parse may throw — extract catches via parseImsManifestXml
    // Our extract builds from imscc when manifest path exists; parse throws on bad XML?
    // fast-xml-parser is lenient; ensure we still get the pdf somehow via orphan catch or flat.
    const result = await scanCanvasArchiveBytes(data);
    assert.ok(result.items.some((i) => i.archivePath === "docs/handout.pdf"));
  });
});
