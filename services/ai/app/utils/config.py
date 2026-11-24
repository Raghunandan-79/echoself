import os

AI_TOKEN = os.environ.get("AI_SERVICE_TOKEN", "")
DEVICE = os.environ.get("AI_DEVICE", "auto")  # auto | cpu | cuda
VOICE_MODEL = os.environ.get("VOICE_MODEL", "xtts-v2")
FACE_MODEL = os.environ.get("FACE_MODEL", "auto")
ENABLE_MOCK = os.environ.get("ENABLE_MOCK", "true").lower() == "true"
MAX_AUDIO_SECONDS = float(os.environ.get("MAX_AUDIO_SECONDS", "300"))
MAX_VIDEO_SECONDS = float(os.environ.get("MAX_VIDEO_SECONDS", "120"))

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:7b")
