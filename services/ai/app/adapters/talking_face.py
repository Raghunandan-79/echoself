"""Talking-face video adapter.

Real backends (evaluate before enabling):
  - SadTalker  (research license — verify terms)
  - Wav2Lip    (research/non-commercial — verify terms)
Neither is installed by default on this repo's hardware profile.
Falls back to a clearly-labelled synthetic video (color bars +
pulsing border, audio muxed) when ENABLE_MOCK=true.
"""
import io
import os
import subprocess
import tempfile

import numpy as np

from app.utils import config
from app.utils.hardware import ffmpeg_available

_state = {"loaded": False, "attempted": False, "model": config.FACE_MODEL, "error": None}


def _detect_model() -> str | None:
    """Return an installed talking-face backend name, or None."""
    candidates = ["sad_talker", "wav2lip"]
    for c in candidates:
        try:
            __import__(c)
            return c
        except Exception:
            continue
    # heuristic: check common install dirs
    for path in [os.path.expanduser("~/SadTalker"), os.path.expanduser("~/Wav2Lip")]:
        if os.path.isdir(path):
            return os.path.basename(path).lower()
    return None


def is_available() -> tuple[bool, str | None]:
    if not ffmpeg_available():
        return False, "ffmpeg/ffprobe not installed"
    model = _detect_model()
    if model:
        return True, model
    if config.ENABLE_MOCK:
        return True, "mock-video"
    return False, "No talking-face model installed (see docs/ai-models.md)"


def generate(audio_wav: bytes, face_image: bytes, aspect_ratio: str = "16:9",
             resolution: str = "720p", script: str | None = None,
             subtitles: bool = False) -> tuple[bytes, str, bool]:
    """Returns (mp4_bytes, model_name, is_mock)."""
    model = _detect_model()
    if model:
        # Real inference path is wired through pipelines/talking_face.py when a
        # backend is installed; until then we do not pretend.
        raise RuntimeError(f"Talking-face backend '{model}' detected but inference pipeline not configured")
    if not config.ENABLE_MOCK:
        raise RuntimeError(_state["error"] or "No talking-face model available")
    return _mock_video(audio_wav, face_image, aspect_ratio, resolution, script, subtitles), "mock-video", True


def _mock_video(audio_wav: bytes, face_image: bytes, aspect_ratio: str,
                resolution: str, script: str | None, subtitles: bool) -> bytes:
    """Labelled synthetic output: animated color/gradient placeholder with the
    real audio track muxed in via ffmpeg. NOT a lip-synced avatar."""
    if not ffmpeg_available():
        raise RuntimeError("ffmpeg required for mock video rendering")
    w, h = (1280, 720) if resolution == "720p" else (854, 480)
    if aspect_ratio == "9:16":
        w, h = h, w
    elif aspect_ratio == "1:1":
        w = h = 720 if resolution == "720p" else 480

    with tempfile.TemporaryDirectory() as td:
        audio_path = os.path.join(td, "in.wav")
        face_path = os.path.join(td, "face.png")
        out_path = os.path.join(td, "out.mp4")
        with open(audio_path, "wb") as f:
            f.write(audio_wav)
        # decode any input image to png via ffmpeg
        with open(os.path.join(td, "face_in"), "wb") as f:
            f.write(face_image)
        subprocess.run(
            ["ffmpeg", "-y", "-i", os.path.join(td, "face_in"), face_path],
            capture_output=True, check=False,
        )
        has_face = os.path.exists(face_path) and os.path.getsize(face_path) > 0

        # probe audio duration
        probe = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", audio_path],
            capture_output=True, text=True,
        )
        try:
            dur = float(probe.stdout.strip())
        except ValueError:
            dur = 10.0
        dur = min(max(dur, 2.0), config.MAX_VIDEO_SECONDS)

        fc = (
            f"color=c=0x121921:s={w}x{h}:d={dur},"
            f"drawbox=x='mod(t*80\\,w)':y='mod(t*40\\,h)':w=120:h=120:color=0x7c6cf0@0.35:t=fill"
        )
        if has_face:
            fc = (
                f"[0:v]scale={w}:{h}:force_original_aspect_ratio=decrease,"
                f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=0x0B0F14[bg];"
                f"color=c=0x121921:s={w}x{h}:d={dur}[c];"
                f"[c][bg]overlay=0:0:shortest=1,"
                f"drawbox=x='mod(t*80\\,w)':y='mod(t*40\\,h)':w=120:h=120:color=0x7c6cf0@0.3:t=fill[v]"
            )
            cmd = [
                "ffmpeg", "-y", "-loop", "1", "-i", face_path,
                "-f", "lavfi", "-i", f"color=c=0x121921:s={w}x{h}:d={dur}",
                "-i", audio_path,
                "-filter_complex", fc,
                "-map", "[v]", "-map", "2:a",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest",
                out_path,
            ]
        else:
            cmd = [
                "ffmpeg", "-y", "-f", "lavfi", "-i", fc,
                "-i", audio_path,
                "-map", "0:v", "-map", "1:a",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest",
                out_path,
            ]
        if subtitles and script:
            # burn a simple text subtitle
            pass  # kept minimal; subtitles flag accepted for forward-compat
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if res.returncode != 0 or not os.path.exists(out_path):
            raise RuntimeError(f"ffmpeg mock render failed: {res.stderr[-500:]}")
        with open(out_path, "rb") as f:
            return f.read()
