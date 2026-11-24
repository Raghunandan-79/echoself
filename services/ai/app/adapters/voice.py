"""Voice synthesis adapter.

Backends tried in order:
  1. Coqui XTTS-v2 (requires Python <3.12; license: Coqui Public Model License)
  2. Chatterbox TTS (Resemble AI, MIT license) — voice cloning via audio prompt
  3. Labelled synthetic tone (ENABLE_MOCK=true) — NOT a voice clone
"""
import io
import os
import threading
import subprocess
import tempfile
import wave

import numpy as np

from app.utils import config

_model = None
_backend = None
_load_lock = threading.Lock()
_state = {"loaded": False, "attempted": False, "error": None}


def _to_wav_22050(audio_bytes: bytes) -> str:
    """Convert any input audio to a temp 24kHz mono WAV path (Chatterbox native rate)."""
    fd, path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", "pipe:0", "-ar", "24000", "-ac", "1", path],
            input=audio_bytes, capture_output=True, check=True, timeout=120,
        )
    except Exception:
        # fallback: assume already wav
        with open(path, "wb") as f:
            f.write(audio_bytes)
    return path


def _load():
    global _model, _backend
    if _state["attempted"] and _model is not None:
        return _model
    with _load_lock:
        if _state["attempted"] and _model is not None:
            return _model
        _state["attempted"] = True
        # 0) IndexTTS2 (bilibili, voice cloning + emotion control)
        try:
            from indextts.infer_v2 import IndexTTS2
            cfg = os.environ.get("INDEXTTS_CFG", "checkpoints/config.yaml")
            model_dir = os.environ.get("INDEXTTS_MODEL_DIR", "checkpoints")
            _model = IndexTTS2(cfg_path=cfg, model_dir=model_dir, use_fp16=False, use_cuda_kernel=False)
            _backend = "indextts2"
            _state["loaded"] = True
            return _model
        except Exception as e:  # noqa: BLE001
            _state["error"] = f"indextts: {e}"
        # 1) Coqui XTTS (py<3.12 only)
        try:
            import TTS  # noqa: F401
            from TTS.api import TTS as CoquiTTS
            _model = CoquiTTS(config.VOICE_MODEL)
            _backend = "xtts-v2"
            _state["loaded"] = True
            return _model
        except Exception as e:  # noqa: BLE001
            _state["error"] = f"{_state['error']}; xtts: {e}"
        # 2) Chatterbox
        try:
            import torch
            torch.set_num_threads(int(os.environ.get("TORCH_THREADS", "4")))
            from chatterbox.tts import ChatterboxTTS
            _model = ChatterboxTTS.from_pretrained(device="cpu")
            _backend = "chatterbox"
            _state["loaded"] = True
            return _model
        except Exception as e:  # noqa: BLE001
            _state["error"] = f"{_state['error']}; chatterbox: {e}"
    return _model


def is_available() -> tuple[bool, str | None]:
    if _load() is not None:
        return True, _backend
    if config.ENABLE_MOCK:
        return True, "mock-tone"
    return False, _state["error"] or "No voice model installed"


def _wav_bytes(samples: np.ndarray, sr: int = 22050) -> bytes:
    pcm = (np.clip(samples, -1, 1) * 32767).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())
    return buf.getvalue()


def synthesize(text: str, language: str, reference_audio: bytes, reference_mime: str = "audio/wav") -> tuple[bytes, str, bool]:
    """Returns (wav_bytes, model_name, is_mock)."""
    model = _load()
    if model is None and _state.get("error"):
        try:
            with open(os.path.join(os.path.dirname(__file__), "..", "..", "voice_errors.log"), "a") as lf:
                lf.write(f"[voice] model load failed: {_state['error']}\n---\n")
        except OSError:
            pass
    if model is not None:
        try:
            if _backend == "xtts-v2":
                import TTS  # noqa: F401
                kwargs = {"language": language} if language else {}
                wav = model.tts(text=text, speaker_wav=io.BytesIO(reference_audio), **kwargs)
                audio = _wav_bytes(np.asarray(wav, dtype=np.float32))
                return audio, "xtts-v2", False
            if _backend == "indextts2":
                # IndexTTS2.infer writes wav to output_path
                ref_path = _to_wav_22050(reference_audio)
                out_path = os.path.join(tempfile.gettempdir(), f"idxtts_{os.getpid()}.wav")
                try:
                    _model.infer(
                        spk_audio_prompt=ref_path,
                        text=text,
                        output_path=out_path,
                        verbose=False,
                    )
                    with open(out_path, "rb") as f:
                        return f.read(), "indextts2", False
                finally:
                    for p in (ref_path, out_path):
                        try:
                            os.unlink(p)
                        except OSError:
                            pass
            if _backend == "chatterbox":
                ref_path = _to_wav_22050(reference_audio)
                try:
                    wav = model.generate(
                        text,
                        audio_prompt_path=ref_path,
                        exaggeration=float(os.environ.get("CHATTERBOX_EXAGGERATION", "0.3")),
                        cfg_weight=float(os.environ.get("CHATTERBOX_CFG_WEIGHT", "0.5")),
                    )
                    arr = wav.squeeze().cpu().numpy() if hasattr(wav, "cpu") else np.asarray(wav)
                    # chatterbox outputs 24kHz tensor in [-1,1]
                    sr = 24000
                    pcm = (np.clip(arr, -1, 1) * 32767).astype(np.int16)
                    buf = io.BytesIO()
                    with wave.open(buf, "wb") as w:
                        w.setnchannels(1)
                        w.setsampwidth(2)
                        w.setframerate(sr)
                        w.writeframes(pcm.tobytes())
                    return buf.getvalue(), "chatterbox", False
                finally:
                    try:
                        os.unlink(ref_path)
                    except OSError:
                        pass
        except Exception as e:  # noqa: BLE001
            import traceback
            msg = f"[voice] real synthesis failed, falling back to mock: {e}\n{traceback.format_exc()}"
            print(msg, flush=True)
            try:
                with open(os.path.join(os.path.dirname(__file__), "..", "..", "voice_errors.log"), "a") as lf:
                    lf.write(msg + "\n---\n")
            except OSError:
                pass
            if not config.ENABLE_MOCK:
                raise
    return _mock_speech(text), "mock-tone", True


def _mock_speech(text: str, sr: int = 22050) -> bytes:
    seconds = min(max(len(text) / 15.0, 1.0), config.MAX_AUDIO_SECONDS)
    n = int(sr * seconds)
    t = np.linspace(0, seconds, n, endpoint=False)
    env = 0.5 + 0.5 * np.sin(2 * np.pi * 4.0 * t)
    tone = 0.25 * np.sin(2 * np.pi * 180 * t) + 0.12 * np.sin(2 * np.pi * 360 * t)
    return _wav_bytes((tone * env * 0.6).astype(np.float32), sr)
