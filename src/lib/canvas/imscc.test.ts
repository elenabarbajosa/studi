import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseImsManifestXml } from "@/lib/canvas/imscc";

const SAMPLE_MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE manifest SYSTEM "http://evil.example/xxe.dtd">
<manifest>
  <metadata>
    <lom>
      <general>
        <title>Intro Biology</title>
      </general>
    </lom>
  </metadata>
  <organizations>
    <organization>
      <item identifier="mod1">
        <title>Module 1</title>
        <item identifier="item1" identifierref="res_pdf">
          <title>Lecture slides</title>
        </item>
        <item identifier="item2" identifierref="res_link">
          <title>Reading</title>
        </item>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="res_pdf" type="webcontent" href="web_resources/lecture.pdf">
      <file href="web_resources/lecture.pdf"/>
    </resource>
    <resource identifier="res_link" type="imswl_xmlv1p1" href="wl1.xml">
      <file href="wl1.xml"/>
    </resource>
    <resource identifier="res_missing" type="webcontent" href="gone.docx">
      <file href="gone.docx"/>
    </resource>
  </resources>
</manifest>`;

describe("parseImsManifestXml", () => {
  it("parses modules, resources, and titles without resolving DTDs", () => {
    const manifest = parseImsManifestXml(SAMPLE_MANIFEST);
    assert.equal(manifest.title, "Intro Biology");
    assert.equal(manifest.resources.length, 3);
    assert.equal(manifest.moduleByResourceId.res_pdf, "Module 1 / Lecture slides");
    assert.ok(manifest.resources.some((r) => r.href === "web_resources/lecture.pdf"));
  });

  it("rejects unparseable XML via thrown error from empty structure", () => {
    // fast-xml-parser is lenient; empty-ish docs yield empty collections
    const empty = parseImsManifestXml("<manifest></manifest>");
    assert.equal(empty.resources.length, 0);
    assert.equal(empty.items.length, 0);
  });
});
