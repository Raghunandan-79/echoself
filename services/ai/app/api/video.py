from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from app.adapters import talking_face as face_adapter
from app.api.auth import require_token
from app.utils import config

router = APIRouter(prefix="/video", dependencies=[Depends(require_token)])


@router.post("/generate")
async def generate(
    audio: UploadFile = File(...),
    face_image: UploadFile = File(...),
    script: str = Form(default=""),
    aspect_ratio: str = Form(default="16:9"),
    resolution: str = Form(default="720p"),
    subtitles: bool = Form(default=False),
):
    audio_bytes = await audio.read()
    face_bytes = await face_image.read()
    if len(audio_bytes) > 100 * 1024 * 1024 or len(face_bytes) > 20 * 1024 * 1024:
        raise HTTPException(413, "Input too large")
    if aspect_ratio not in ("16:9", "9:16", "1:1"):
        raise HTTPException(400, "Invalid aspect ratio")
    if resolution not in ("480p", "720p"):
        raise HTTPException(400, "Invalid resolution")
    ok, reason = face_adapter.is_available()
    if not ok:
        raise HTTPException(503, reason or "Talking-face model unavailable")
    try:
        mp4, model, is_mock = face_adapter.generate(
            audio_bytes, face_bytes, aspect_ratio, resolution, script or None, subtitles
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"Video generation failed: {e}") from e
    return Response(
        content=mp4,
        media_type="video/mp4",
        headers={
            "X-Model": model,
            "X-Mock": "true" if is_mock else "false",
        },
    )
