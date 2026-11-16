import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SOUNDSCAPE_IDS } from "@/lib/calendar";
import {
  SOUNDSCAPE_ASSETS,
  clamp01,
  isProceduralSoundscape,
  isSampleSoundscape,
  resolveSecondarySoundscape,
} from "@/lib/focus/soundscape-assets";

describe("soundscape assets registry", () => {
  it("keeps every SoundscapeId registered without schema breaks", () => {
    for (const id of SOUNDSCAPE_IDS) {
      assert.ok(SOUNDSCAPE_ASSETS[id], `missing asset for ${id}`);
      assert.ok(SOUNDSCAPE_ASSETS[id].label);
    }
  });

  it("marks rain/cafe/forest as sample URLs and white noise as procedural", () => {
    assert.equal(isSampleSoundscape("rain"), true);
    assert.equal(isSampleSoundscape("cafe"), true);
    assert.equal(isSampleSoundscape("forest"), true);
    assert.equal(SOUNDSCAPE_ASSETS.rain.url, "/audio/ambient/rain.mp3");
    assert.equal(SOUNDSCAPE_ASSETS.cafe.url, "/audio/ambient/cafe.mp3");
    assert.equal(SOUNDSCAPE_ASSETS.forest.url, "/audio/ambient/forest.mp3");
    assert.equal(isProceduralSoundscape("white_noise"), true);
    assert.equal(isSampleSoundscape("white_noise"), false);
    assert.equal(isSampleSoundscape("silence"), false);
  });

  it("collapses duplicate primary/secondary to silence on secondary", () => {
    assert.equal(resolveSecondarySoundscape("rain", "rain"), "silence");
    assert.equal(resolveSecondarySoundscape("rain", "cafe"), "cafe");
    assert.equal(resolveSecondarySoundscape("forest", "white_noise"), "white_noise");
    assert.equal(resolveSecondarySoundscape("cafe", "silence"), "silence");
  });

  it("clamps volumes into 0..1", () => {
    assert.equal(clamp01(-1), 0);
    assert.equal(clamp01(0.5), 0.5);
    assert.equal(clamp01(2), 1);
    assert.equal(clamp01(Number.NaN), 0);
  });
});
