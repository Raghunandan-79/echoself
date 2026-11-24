import io
import wave

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from app.adapters import voice as voice_adapter
from app.api.auth import require_token
from app.utils import config

router = APIRouter(prefix="/voice", dependencies=[Depends(require_token)])


@router.post("/generate")
async def generate(
    text: str = Form(...),
    language: str = Form(default="en"),
    reference_audio: UploadFile = File(...),
):
    if not text or len(text) > 5000:
        raise HTTPException(400, "Text must be 1-5000 characters")
    ref = await reference_audio.read()
    if len(ref) > 50 * 1024 * 1024:
        raise HTTPException(413, "Reference audio too large")
    ok, reason = voice_adapter.is_available()
    if not ok:
        raise HTTPException(503, reason or "Voice model unavailable")
    try:
        audio, model, is_mock = voice_adapter.synthesize(
            text, language, ref, reference_audio.content_type or "audio/wav"
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"Voice synthesis failed: {e}") from e

    # duration
    try:
        with wave.open(io.BytesIO(audio)) as w:
            dur = w.getnframes() / w.getframerate()
    except Exception:
        dur = 0
    return Response(
        content=audio,
        media_type="audio/wav",
        headers={
            "X-Model": model,
            "X-Mock": "true" if is_mock else "false",
            "X-Duration": str(round(dur, 2)),
        },
    )
