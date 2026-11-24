from fastapi import Header, HTTPException
from app.utils import config


def require_token(x_ai_token: str | None = Header(default=None)):
    """Internal endpoints are private: require the shared service token when configured."""
    if config.AI_TOKEN and x_ai_token != config.AI_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid AI service token")
