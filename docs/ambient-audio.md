# Studi ambient audio

Production Focus / Study Together soundscapes. Sample IDs (`rain`, `cafe`, `forest`, `white_noise`, `silence`) are unchanged so saved user preferences keep working.

## Optimized playback assets

| Soundscape | Public file | Format | Notes |
|---|---|---|---|
| Rain | `public/audio/ambient/rain.mp3` | MP3 128 kbps stereo 44.1 kHz | Seamless loop (4.0 s end→start crossfade), −1.5 dB |
| Café | `public/audio/ambient/cafe.mp3` | MP3 128 kbps stereo 44.1 kHz | Seamless loop (2.5 s crossfade), −2.0 dB |
| Forest | `public/audio/ambient/forest.mp3` | MP3 128 kbps stereo 44.1 kHz | Seamless loop (3.0 s crossfade), −1.0 dB |
| White noise | _(procedural)_ | Web Audio buffer | Continuous broadband noise, soft peak, faded loop edges |

Rebuild optimized files from archived originals:

```bash
./scripts/process-ambient-audio.sh
```

Original lossless / high-bitrate downloads live in `audio-source/ambient/originals/` (gitignored — not deployed).

## Recording licenses (verified 2026-11-16)

### Rain — Gentle Rain Mix (2018)

| Field | Value |
|---|---|
| Creator | esh9419 |
| Source | https://freesound.org/people/esh9419/sounds/417616/ |
| Original format | WAV 48 kHz 16-bit stereo, ~12:00, ~132 MB |
| Verified license | **CC0 1.0 (public domain dedication)** |
| Commercial use | Permitted |
| Attribution required | No (legally). Description notes included components are also CC0. |
| Evidence | Freesound page + author notes; mirrored CC0 listings on third-party indexes. Freesound UI CC0 badge was not machine-readable via static fetch — treat as **verified via page content / mirrors**, re-confirm on Freesound before a paid launch if needed. |

### Café — Cafe ambient sound.mp3

| Field | Value |
|---|---|
| Creator | evsecrets |
| Source | https://freesound.org/people/evsecrets/sounds/332271/ |
| Original format | MP3 320 kbps stereo 44.1 kHz, ~2:30, ~5.7 MB |
| Verified license | **Public domain** (author statement on the Freesound page) |
| Commercial use | Permitted (“any purpose without my permission and without attribution”) |
| Attribution required | No |

### Forest — Forest ambient with a birdsong

| Field | Value |
|---|---|
| Creator | unfa |
| Source | https://freesound.org/people/unfa/sounds/160280/ |
| Original format | FLAC 48 kHz 16-bit stereo, ~4:31, ~30 MB |
| Verified license | **CC0** (Freesound license blurb: copy/modify/distribute/perform commercially without permission) |
| Commercial use | Permitted |
| Attribution required | No (legally). Optional courtesy credit welcome. |
| Extra note | Author disallows use for generative ML training / voice cloning. Studi playback use is ordinary media playback, not ML training. |

### White noise

Original procedural audio generated in-browser by Studi. No third-party recording.

## Processing performed

1. Archived originals under `audio-source/ambient/originals/`.
2. Built seamless loops with ffmpeg `acrossfade` (end of file crossfaded into start; leading crossfade region removed from the body so `loop` splices cleanly).
3. Gentle gain + limiter (no aggressive loudness war).
4. Encoded MP3 128 kbps stereo 44.1 kHz for broad browser support and smaller deploy size (~17.4 MB total).

## Runtime architecture

- Sample layers stream via `HTMLAudioElement` + `MediaElementAudioSourceNode` (avoids decoding multi-minute files into large AudioBuffers).
- Dual-element crossfade near each loop boundary for gapless playback across browsers.
- White noise uses a soft, edge-faded looping AudioBuffer.
- One `SoundscapeEngine` per Focus / Study Together session provider — survives App Router navigation with the floating mini-player.
- Identical primary+secondary selection collapses secondary to silence (no doubled loudness).

## Manual listening checklist

Automated tests cannot prove subjective quality. Before release, listen for:

- [ ] Rain / Café / Forest loop boundaries (no click, gap, or double-loud overlap)
- [ ] White noise comfort and absence of crackle
- [ ] Mixes: Rain+Café, Rain+Forest, Rain+White noise, Café+Forest, Café+White noise, Forest+White noise
- [ ] Volume sliders; silence; start/stop fades
- [ ] Persist across navigation with Focus mini-player
- [ ] Safari iOS + Chrome desktop autoplay after a gesture
