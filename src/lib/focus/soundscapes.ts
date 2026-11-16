import type { SoundscapeId } from "@/lib/calendar";
import {
  SOUNDSCAPE_ASSETS,
  clamp01,
  resolveSecondarySoundscape,
} from "@/lib/focus/soundscape-assets";

export { SOUNDSCAPE_ASSETS } from "@/lib/focus/soundscape-assets";

/** Back-compat meta shape used by Focus UI. */
export const SOUNDSCAPE_META: Record<
  SoundscapeId,
  { label: string; description: string; procedural: boolean }
> = {
  silence: {
    label: SOUNDSCAPE_ASSETS.silence.label,
    description: SOUNDSCAPE_ASSETS.silence.description,
    procedural: true,
  },
  white_noise: {
    label: SOUNDSCAPE_ASSETS.white_noise.label,
    description: SOUNDSCAPE_ASSETS.white_noise.description,
    procedural: true,
  },
  rain: {
    label: SOUNDSCAPE_ASSETS.rain.label,
    description: SOUNDSCAPE_ASSETS.rain.description,
    procedural: false,
  },
  cafe: {
    label: SOUNDSCAPE_ASSETS.cafe.label,
    description: SOUNDSCAPE_ASSETS.cafe.description,
    procedural: false,
  },
  forest: {
    label: SOUNDSCAPE_ASSETS.forest.label,
    description: SOUNDSCAPE_ASSETS.forest.description,
    procedural: false,
  },
};

const FADE_SEC = 0.45;
const WHITE_NOISE_SECONDS = 4;
/** Peak amplitude for procedural white noise — soft enough for long study. */
const WHITE_NOISE_PEAK = 0.12;

type LayerSlot = "primary" | "secondary";

type StreamingLoop = {
  kind: "sample";
  id: SoundscapeId;
  elA: HTMLAudioElement;
  elB: HTMLAudioElement;
  srcA: MediaElementAudioSourceNode;
  srcB: MediaElementAudioSourceNode;
  mixA: GainNode;
  mixB: GainNode;
  layerGain: GainNode;
  using: "A" | "B";
  timer: number | null;
  crossfadeMs: number;
  ready: Promise<void>;
};

type ProceduralLoop = {
  kind: "procedural";
  id: SoundscapeId;
  source: AudioBufferSourceNode;
  nodes: AudioNode[];
  layerGain: GainNode;
};

type Layer = StreamingLoop | ProceduralLoop;

/**
 * Dual-bus ambient engine for Focus / Study Together.
 * Sample soundscapes stream via MediaElement sources with dual-element
 * crossfade looping (avoids decoding multi-minute files into RAM).
 * White noise stays procedural and continuous.
 */
export class SoundscapeEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private primaryBus: GainNode | null = null;
  private secondaryBus: GainNode | null = null;
  private primaryLayer: Layer | null = null;
  private secondaryLayer: Layer | null = null;
  private primaryId: SoundscapeId = "silence";
  private secondaryId: SoundscapeId = "silence";
  private playing = false;
  private masterVolume = 0.45;
  private primaryVolume = 1;
  private secondaryVolume = 0;
  private loadError: string | null = null;
  private onError: ((message: string) => void) | null = null;
  private visibilityBound = false;

  setOnError(handler: ((message: string) => void) | null) {
    this.onError = handler;
  }

  getLoadError() {
    return this.loadError;
  }

  private ensure() {
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.masterVolume;
      this.master.connect(this.ctx.destination);
      this.primaryBus = this.ctx.createGain();
      this.secondaryBus = this.ctx.createGain();
      this.primaryBus.gain.value = this.primaryVolume;
      this.secondaryBus.gain.value = this.secondaryVolume;
      this.primaryBus.connect(this.master);
      this.secondaryBus.connect(this.master);
      this.bindVisibility();
    }
    return this.ctx;
  }

  private bindVisibility() {
    if (this.visibilityBound || typeof document === "undefined") return;
    this.visibilityBound = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      if (!this.playing || !this.ctx) return;
      void this.resume();
      this.reassertMediaPlayback();
    });
  }

  private reassertMediaPlayback() {
    for (const layer of [this.primaryLayer, this.secondaryLayer]) {
      if (!layer || layer.kind !== "sample") continue;
      const active = layer.using === "A" ? layer.elA : layer.elB;
      if (active.paused) {
        void active.play().catch(() => {
          /* autoplay / gesture required */
        });
      }
      // Background timer throttling can miss loop boundaries — reschedule.
      this.scheduleCrossfade(layer);
    }
  }

  async resume() {
    const ctx = this.ensure();
    if (ctx.state === "suspended") await ctx.resume();
  }

  setVolumes(primary: number, secondary: number) {
    this.primaryVolume = clamp01(primary);
    this.secondaryVolume = clamp01(secondary);
    this.ensure();
    this.ramp(this.primaryBus, this.primaryVolume);
    this.ramp(this.secondaryBus, this.secondaryVolume);
  }

  setMasterVolume(v: number) {
    this.masterVolume = clamp01(v);
    this.ensure();
    this.ramp(this.master, this.masterVolume);
  }

  private ramp(node: GainNode | null, value: number) {
    if (!node || !this.ctx) return;
    const now = this.ctx.currentTime;
    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(node.gain.value, now);
    node.gain.linearRampToValueAtTime(value, now + 0.08);
  }

  async play(primary: SoundscapeId, secondary: SoundscapeId = "silence") {
    await this.resume();
    const resolvedSecondary = resolveSecondarySoundscape(primary, secondary);
    this.loadError = null;

    // Same selection already running — keep nodes, just ensure volumes.
    if (
      this.playing &&
      this.primaryId === primary &&
      this.secondaryId === resolvedSecondary
    ) {
      this.reassertMediaPlayback();
      return;
    }

    await this.fadeOutAndStop();

    this.primaryId = primary;
    this.secondaryId = resolvedSecondary;

    if (primary === "silence" && resolvedSecondary === "silence") {
      this.playing = false;
      return;
    }

    try {
      this.primaryLayer = await this.buildLayer(primary, "primary");
      this.secondaryLayer = await this.buildLayer(
        resolvedSecondary,
        "secondary",
      );
      await this.fadeInLayers();
      this.playing = true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not load ambient audio.";
      this.loadError = message;
      this.onError?.(message);
      this.stopLayersImmediate();
      this.playing = false;
    }
  }

  pause() {
    void this.fadeOutAndStop().then(() => {
      this.playing = false;
    });
  }

  /** Immediate stop used by dispose / account switch. */
  stopImmediate() {
    this.stopLayersImmediate();
    this.playing = false;
  }

  isPlaying() {
    return this.playing;
  }

  dispose() {
    this.stopImmediate();
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.primaryBus = null;
    this.secondaryBus = null;
  }

  private async fadeOutAndStop() {
    if (!this.ctx || (!this.primaryLayer && !this.secondaryLayer)) {
      this.stopLayersImmediate();
      return;
    }
    const now = this.ctx.currentTime;
    for (const layer of [this.primaryLayer, this.secondaryLayer]) {
      if (!layer) continue;
      layer.layerGain.gain.cancelScheduledValues(now);
      layer.layerGain.gain.setValueAtTime(layer.layerGain.gain.value, now);
      layer.layerGain.gain.linearRampToValueAtTime(0, now + FADE_SEC);
    }
    await wait(FADE_SEC * 1000 + 30);
    this.stopLayersImmediate();
  }

  private async fadeInLayers() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const layer of [this.primaryLayer, this.secondaryLayer]) {
      if (!layer) continue;
      layer.layerGain.gain.cancelScheduledValues(now);
      layer.layerGain.gain.setValueAtTime(0, now);
      layer.layerGain.gain.linearRampToValueAtTime(1, now + FADE_SEC);
    }
  }

  private stopLayersImmediate() {
    this.teardownLayer(this.primaryLayer);
    this.teardownLayer(this.secondaryLayer);
    this.primaryLayer = null;
    this.secondaryLayer = null;
  }

  private teardownLayer(layer: Layer | null) {
    if (!layer) return;
    if (layer.kind === "sample") {
      if (layer.timer != null) window.clearTimeout(layer.timer);
      try {
        layer.elA.pause();
        layer.elB.pause();
        layer.elA.removeAttribute("src");
        layer.elB.removeAttribute("src");
        layer.elA.load();
        layer.elB.load();
      } catch {
        /* ignore */
      }
      try {
        layer.srcA.disconnect();
        layer.srcB.disconnect();
        layer.mixA.disconnect();
        layer.mixB.disconnect();
        layer.layerGain.disconnect();
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      layer.source.stop();
    } catch {
      /* already stopped */
    }
    for (const node of [...layer.nodes, layer.layerGain]) {
      try {
        node.disconnect();
      } catch {
        /* ignore */
      }
    }
  }

  private async buildLayer(
    id: SoundscapeId,
    slot: LayerSlot,
  ): Promise<Layer | null> {
    if (id === "silence") return null;
    const bus = slot === "primary" ? this.primaryBus! : this.secondaryBus!;
    const asset = SOUNDSCAPE_ASSETS[id];

    if (asset.kind === "procedural") {
      return this.buildWhiteNoise(bus, id);
    }

    if (asset.kind === "sample" && asset.url) {
      return this.buildStreamingLoop(id, asset.url, asset.crossfadeMs ?? 2500, bus);
    }

    return null;
  }

  private buildWhiteNoise(dest: GainNode, id: SoundscapeId): ProceduralLoop {
    const ctx = this.ctx!;
    const frames = Math.floor(WHITE_NOISE_SECONDS * ctx.sampleRate);
    const buffer = ctx.createBuffer(2, frames, ctx.sampleRate);
    const fade = Math.min(512, Math.floor(frames / 32));

    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < frames; i++) {
        let sample = (Math.random() * 2 - 1) * WHITE_NOISE_PEAK;
        if (i < fade) sample *= i / fade;
        if (i >= frames - fade) sample *= (frames - 1 - i) / fade;
        data[i] = sample;
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    // Tiny overlap avoid: loopStart/loopEnd use full buffer with faded edges.
    source.loopStart = 0;
    source.loopEnd = WHITE_NOISE_SECONDS;

    // Soften extremes so default white noise isn't piercing on laptop speakers.
    const lowShelf = ctx.createBiquadFilter();
    lowShelf.type = "lowshelf";
    lowShelf.frequency.value = 200;
    lowShelf.gain.value = 1.5;
    const highShelf = ctx.createBiquadFilter();
    highShelf.type = "highshelf";
    highShelf.frequency.value = 8000;
    highShelf.gain.value = -3;

    const layerGain = ctx.createGain();
    layerGain.gain.value = 0;

    source.connect(lowShelf);
    lowShelf.connect(highShelf);
    highShelf.connect(layerGain);
    layerGain.connect(dest);
    source.start();

    return {
      kind: "procedural",
      id,
      source,
      nodes: [source, lowShelf, highShelf],
      layerGain,
    };
  }

  private async buildStreamingLoop(
    id: SoundscapeId,
    url: string,
    crossfadeMs: number,
    dest: GainNode,
  ): Promise<StreamingLoop> {
    const ctx = this.ctx!;
    const elA = createAmbientElement(url);
    const elB = createAmbientElement(url);
    const srcA = ctx.createMediaElementSource(elA);
    const srcB = ctx.createMediaElementSource(elB);
    const mixA = ctx.createGain();
    const mixB = ctx.createGain();
    const layerGain = ctx.createGain();
    layerGain.gain.value = 0;
    mixA.gain.value = 1;
    mixB.gain.value = 0;

    srcA.connect(mixA);
    srcB.connect(mixB);
    mixA.connect(layerGain);
    mixB.connect(layerGain);
    layerGain.connect(dest);

    const ready = Promise.all([
      waitForCanPlay(elA),
      waitForCanPlay(elB),
    ]).then(() => undefined);

    const layer: StreamingLoop = {
      kind: "sample",
      id,
      elA,
      elB,
      srcA,
      srcB,
      mixA,
      mixB,
      layerGain,
      using: "A",
      timer: null,
      crossfadeMs,
      ready,
    };

    await ready;
    elA.currentTime = 0;
    await elA.play();
    this.scheduleCrossfade(layer);
    return layer;
  }

  private scheduleCrossfade(layer: StreamingLoop) {
    if (layer.timer != null) window.clearTimeout(layer.timer);

    const active = layer.using === "A" ? layer.elA : layer.elB;
    const duration = active.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      // Retry once metadata arrives.
      layer.timer = window.setTimeout(() => this.scheduleCrossfade(layer), 500);
      return;
    }

    const crossSec = Math.min(
      layer.crossfadeMs / 1000,
      Math.max(0.4, duration / 4),
    );
    const remaining = Math.max(0, duration - active.currentTime - crossSec);

    layer.timer = window.setTimeout(() => {
      void this.runCrossfade(layer, crossSec);
    }, remaining * 1000);
  }

  private async runCrossfade(layer: StreamingLoop, crossSec: number) {
    if (!this.ctx || !this.playing) return;
    if (
      this.primaryLayer !== layer &&
      this.secondaryLayer !== layer
    ) {
      return;
    }

    const nextIsA = layer.using === "B";
    const fadingOut = layer.using === "A" ? layer.elA : layer.elB;
    const fadingIn = nextIsA ? layer.elA : layer.elB;
    const outGain = layer.using === "A" ? layer.mixA : layer.mixB;
    const inGain = nextIsA ? layer.mixA : layer.mixB;

    try {
      fadingIn.currentTime = 0;
      await fadingIn.play();
    } catch {
      // If play fails, fall back to restarting the active element.
      try {
        fadingOut.currentTime = 0;
        await fadingOut.play();
        this.scheduleCrossfade(layer);
      } catch {
        /* give up until next user gesture */
      }
      return;
    }

    const now = this.ctx.currentTime;
    outGain.gain.cancelScheduledValues(now);
    inGain.gain.cancelScheduledValues(now);
    outGain.gain.setValueAtTime(outGain.gain.value, now);
    inGain.gain.setValueAtTime(0, now);
    outGain.gain.linearRampToValueAtTime(0, now + crossSec);
    inGain.gain.linearRampToValueAtTime(1, now + crossSec);

    layer.using = nextIsA ? "A" : "B";

    window.setTimeout(() => {
      try {
        fadingOut.pause();
      } catch {
        /* ignore */
      }
      this.scheduleCrossfade(layer);
    }, crossSec * 1000 + 40);
  }
}

function createAmbientElement(url: string) {
  const el = new Audio();
  el.preload = "auto";
  el.crossOrigin = "anonymous";
  el.loop = false;
  el.src = url;
  return el;
}

function waitForCanPlay(el: HTMLAudioElement) {
  if (el.readyState >= 3) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Ambient audio failed to load. Check your connection."));
    };
    const cleanup = () => {
      el.removeEventListener("canplaythrough", onReady);
      el.removeEventListener("loadeddata", onReady);
      el.removeEventListener("error", onError);
    };
    el.addEventListener("canplaythrough", onReady, { once: true });
    el.addEventListener("loadeddata", onReady, { once: true });
    el.addEventListener("error", onError, { once: true });
    // Kick network fetch.
    el.load();
  });
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
