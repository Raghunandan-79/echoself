from fastapi import APIRouter, Depends

from app.adapters import voice as voice_adapter
from app.adapters import talking_face as face_adapter
from app.adapters import llm as llm_adapter
from app.api.auth import require_token
from app.utils.hardware import cuda_info, ram_info, detect_device, ffmpeg_available
from app.utils import config

router = APIRouter(dependencies=[Depends(require_token)])


@router.get("/capabilities")
def capabilities():
    v_ok, v_model = voice_adapter.is_available()
    f_ok, f_model = face_adapter.is_available()
    l_ok, l_model = llm_adapter.is_available()
    return {
        "service": "echoself-ai",
        "device": detect_device(),
        "gpu": cuda_info(),
        "ram": ram_info(),
        "ffmpeg": ffmpeg_available(),
        "mockEnabled": config.ENABLE_MOCK,
        "voice": {
            "available": v_ok,
            "model": v_model,
            "mock": v_model in ("mock-tone", "mock"),
        },
        "talkingFace": {
            "available": f_ok,
            "model": f_model,
            "mock": f_model == "mock-video",
        },
        "llm": {"available": l_ok, "model": l_model},
        "limits": {"maxAudioSeconds": config.MAX_AUDIO_SECONDS, "maxVideoSeconds": config.MAX_VIDEO_SECONDS},
    }
