from fastapi import APIRouter

from app.utils.hardware import cuda_info, ffmpeg_available, ram_info, detect_device
from app.utils import config

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok", "device": detect_device(), "ffmpeg": ffmpeg_available()}
