# AI Models

Hardware detected on dev machine: RTX 3050 Laptop (4 GB VRAM), ~7.5 GB RAM, 12 CPU. Models must fit CPU fallback; GPU optional.

## Voice synthesis — candidate: Coqui XTTS-v2
- License: Coqui Public Model License (non-commercial-ish; **verify before commercial use**).
- ~1.8 GB model; CPU inference slow (~real-time factor >1 on weak CPUs); RAM ~4 GB — tight on this machine but feasible with page-offloading.
- Adapter: `services/ai/app/adapters/voice.py` — loads via `TTS.api.TTS`, falls back to labelled `mock-tone` output.
- Smalls alternatives if XTTS too heavy: Piper TTS (very light, no cloning), Coqui XTTS-v1.

## Talking face — candidates
- **SadTalker**: research license; ~needs 8+ GB RAM realistically; stills→video.
- **Wav2Lip**: non-commercial/research license; GAN lip-sync on face video; needs a face *video*, heavier pipeline.
- Adapter detects installs (`~/SadTalker`, `~/Wav2Lip`, importable modules); otherwise labelled `mock-video` (ffmpeg color/gradient + real audio).
- Honest note: on 4 GB VRAM / 7.5 GB RAM, real-time talking-face quality is unlikely; plan for offline/batch generation.

## LLM — Ollama + Qwen2.5:7b (default)
- Free, local. `ollama pull qwen2.5:7b` (~4.7 GB). Llama 3.2 3B is a lighter alternative.
- Used by EchoBot via `/api/chat` (streaming supported).

## Media — FFmpeg/FFprobe
- Required for mock video rendering and `/internal/media/process`. Install: `apt install ffmpeg` or Dockerfile.

## Capability endpoint
`GET /internal/capabilities` reports per-adapter: installed, loaded, model, device (cpu/cuda), VRAM/RAM, mock status, limitations. Frontend surfaces this via `/api/v1/health/capabilities`.
