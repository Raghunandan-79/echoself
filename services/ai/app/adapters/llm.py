"""LLM adapter — Ollama local inference. Provider-independent interface."""
import os
import httpx

from app.utils import config


def is_available() -> tuple[bool, str | None]:
    try:
        r = httpx.get(f"{config.OLLAMA_URL}/api/tags", timeout=4)
        if r.status_code != 200:
            return False, f"Ollama returned {r.status_code}"
        models = [m.get("name", "") for m in r.json().get("models", [])]
        base = config.OLLAMA_MODEL.split(":")[0]
        if not any(m == config.OLLAMA_MODEL or m.startswith(base) for m in models):
            return False, f"Model '{config.OLLAMA_MODEL}' not pulled (ollama pull {config.OLLAMA_MODEL})"
        return True, config.OLLAMA_MODEL
    except Exception as e:  # noqa: BLE001
        return False, str(e)


def chat(messages: list[dict], stream: bool = False):
    ok, reason = is_available()
    if not ok:
        raise RuntimeError(reason or "LLM unavailable")
    return httpx.post(
        f"{config.OLLAMA_URL}/api/chat",
        json={"model": config.OLLAMA_MODEL, "messages": messages, "stream": stream},
        timeout=None if stream else 120,
    )
