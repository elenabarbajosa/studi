import type { SoundscapeId } from "@/lib/calendar";

export const SOUNDSCAPE_META: Record<
  SoundscapeId,
  { label: string; description: string; procedural: boolean }
> = {
  silence: {
    label: "Silence",
    description: "No ambient audio",
    procedural: true,
  },
  white_noise: {
    label: "White noise",
    description: "In-browser generated noise",
    procedural: true,
  },
  rain: {
    label: "Rain",
    description: "Filtered noise (procedural)",
    procedural: true,
  },
  cafe: {
    label: "Café",
    description: "Soft brown-noise ambience (procedural)",
    procedural: true,
  },
  forest: {
    label: "Forest",
    description: "Gentle nature-like texture (procedural)",
    procedural: true,
  },
};

/**
 * All soundscapes are synthesized with the Web Audio API in the browser.
 * No third-party audio files are bundled. These are original procedural
 * textures, not recordings — suitable as placeholders until licensed
 * sample packs are added under public/sounds/.
 *
 * Licensing: original code-generated audio; no external copyright claims.
 * If replacing with samples, document source + license in README.
 */
export class SoundscapeEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private primaryGain: GainNode | null = null;
  private secondaryGain: GainNode | null = null;
  private primaryNodes: AudioNode[] = [];
  private secondaryNodes: AudioNode[] = [];
  private primaryId: SoundscapeId = "silence";
  private secondaryId: SoundscapeId = "silence";
  private playing = false;

  private ensure() {
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.45;
      this.master.connect(this.ctx.destination);
      this.primaryGain = this.ctx.createGain();
      this.secondaryGain = this.ctx.createGain();
      this.primaryGain.connect(this.master);
      this.secondaryGain.connect(this.master);
    }
    return this.ctx;
  }

  async resume() {
    const ctx = this.ensure();
    if (ctx.state === "suspended") await ctx.resume();
  }

  setVolumes(primary: number, secondary: number) {
    this.ensure();
    if (this.primaryGain) this.primaryGain.gain.value = Math.min(1, Math.max(0, primary));
    if (this.secondaryGain)
      this.secondaryGain.gain.value = Math.min(1, Math.max(0, secondary));
  }

  setMasterVolume(v: number) {
    this.ensure();
    if (this.master) this.master.gain.value = Math.min(1, Math.max(0, v));
  }

  async play(primary: SoundscapeId, secondary: SoundscapeId = "silence") {
    await this.resume();
    this.stopNodes();
    this.primaryId = primary;
    this.secondaryId = secondary;
    this.primaryNodes = this.build(primary, this.primaryGain!);
    this.secondaryNodes = this.build(secondary, this.secondaryGain!);
    this.playing = true;
  }

  pause() {
    this.stopNodes();
    this.playing = false;
  }

  isPlaying() {
    return this.playing;
  }

  dispose() {
    this.pause();
    void this.ctx?.close();
    this.ctx = null;
  }

  private stopNodes() {
    for (const n of [...this.primaryNodes, ...this.secondaryNodes]) {
      try {
        if ("stop" in n && typeof (n as OscillatorNode).stop === "function") {
          (n as OscillatorNode).stop();
        }
        n.disconnect();
      } catch {
        /* already stopped */
      }
    }
    this.primaryNodes = [];
    this.secondaryNodes = [];
  }

  private build(id: SoundscapeId, dest: GainNode): AudioNode[] {
    if (!this.ctx || id === "silence") return [];
    const ctx = this.ctx;
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    if (id === "white_noise") {
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    } else if (id === "rain") {
      let last = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // light pink-ish + sparse droplets
        last = (last + 0.02 * white) / 1.02;
        const drop = Math.random() > 0.997 ? (Math.random() * 2 - 1) * 0.6 : 0;
        data[i] = last * 2.5 + drop;
      }
    } else if (id === "cafe") {
      let brown = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        brown = (brown + 0.02 * white) / 1.02;
        data[i] = brown * 3.5;
      }
    } else if (id === "forest") {
      let last = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.05 * white) / 1.05;
        const chirp =
          Math.random() > 0.9992
            ? Math.sin(i / 40) * 0.15 * Math.random()
            : 0;
        data[i] = last * 2.2 + chirp;
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    if (id === "rain") {
      filter.type = "lowpass";
      filter.frequency.value = 1800;
    } else if (id === "cafe") {
      filter.type = "lowpass";
      filter.frequency.value = 900;
    } else if (id === "forest") {
      filter.type = "bandpass";
      filter.frequency.value = 1200;
      filter.Q.value = 0.7;
    } else {
      filter.type = "allpass";
    }

    source.connect(filter);
    filter.connect(dest);
    source.start();
    return [source, filter];
  }
}
