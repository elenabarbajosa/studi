#!/usr/bin/env bash
# Build seamless-loop MP3 ambient assets for Studi Focus.
# Reads originals from audio-source/ambient/originals/
# Writes optimized playback files to public/audio/ambient/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/audio-source/ambient/originals"
OUT="$ROOT/public/audio/ambient"
TMP="$OUT/tmp"
FFMPEG="${FFMPEG:-/opt/homebrew/bin/ffmpeg}"
FFPROBE="${FFPROBE:-/opt/homebrew/bin/ffprobe}"

mkdir -p "$TMP" "$OUT"

duration_of() {
  "$FFPROBE" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$1"
}

# Build a seamless loop: body (from CROSS..DUR) + acrossfade(end, start).
# When BufferSource.loop reconnects end→start, the splice is already blended.
make_seamless_mp3() {
  local input="$1"
  local name="$2"
  local cross="$3"
  local gain_db="$4"
  local bitrate="$5"

  local dur
  dur="$(duration_of "$input")"
  local body_end
  body_end="$(python3 - <<PY
d=float("$dur"); c=float("$cross");
print(max(0.0, d - c))
PY
)"

  echo "→ $name  duration=${dur}s  crossfade=${cross}s  gain=${gain_db}dB"

  # Intermediate WAV for filter graph precision, then encode MP3.
  local wav="$TMP/${name}-seamless.wav"
  "$FFMPEG" -y -hide_banner -loglevel error -i "$input" -filter_complex "\
[0:a]asplit=3[orig][orig2][orig3];\
[orig]atrim=start=${cross}:end=${dur},asetpts=PTS-STARTPTS[main];\
[orig2]atrim=start=${body_end}:end=${dur},asetpts=PTS-STARTPTS[end];\
[orig3]atrim=start=0:end=${cross},asetpts=PTS-STARTPTS[start];\
[end][start]acrossfade=d=${cross}:c1=tri:c2=tri[xf];\
[main][xf]concat=n=2:v=0:a=1[joined];\
[joined]volume=${gain_db}dB,alimiter=limit=0.95:attack=5:release=50[out]\
" -map "[out]" -ar 44100 -ac 2 "$wav"

  "$FFMPEG" -y -hide_banner -loglevel error -i "$wav" \
    -codec:a libmp3lame -b:a "$bitrate" -ar 44100 -ac 2 \
    -write_xing 1 "$OUT/${name}.mp3"

  rm -f "$wav"
  ls -lah "$OUT/${name}.mp3"
  "$FFPROBE" -v error -show_entries format=duration,size,bit_rate -of default=noprint_wrappers=1 "$OUT/${name}.mp3"
}

# Gentle relative gains so perceived loudness is closer across environments.
# Tuned conservatively — prefer quieter over clipping.
make_seamless_mp3 "$SRC/rain.wav"   "rain"   4.0 "-1.5" "128k"
make_seamless_mp3 "$SRC/cafe.mp3"   "cafe"   2.5 "-2.0" "128k"
make_seamless_mp3 "$SRC/forest.flac" "forest" 3.0 "-1.0" "128k"

rm -rf "$TMP"
echo "Done. Optimized assets in $OUT"
ls -lah "$OUT"
