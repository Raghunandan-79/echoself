from fastapi import APIRouter

from app.api import health, internal, voice, video, media

router = APIRouter()
router.include_router(health.router, tags=["health"])
router.include_router(internal.router, prefix="/internal", tags=["internal"])
router.include_router(voice.router, prefix="/internal", tags=["voice"])
router.include_router(video.router, prefix="/internal", tags=["video"])
router.include_router(media.router, prefix="/internal", tags=["media"])
