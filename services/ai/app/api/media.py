"""Media processing endpoint — ffmpeg-backed utilities."""
import json
import subprocess
import tempfile
import os

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from app.api.auth import require_token
from app.utils.hardware import ffmpeg_available

router = APIRouter(prefix="/media", dependencies=[Depends(require_token)])


@router.post("/process")
async def process(
    operation: str = Form(...),
    input: UploadFile = File(...),
    options: str = Form(default="{}"),
):
    if not ffmpeg_available():
        raise HTTPException(503, "ffmpeg not installed")
    data = await input.read()
    if len(data) > 500 * 1024 * 1024:
        raise HTTPException(413, "Input too large")
    opts = json.loads(options or "{}")
    suffix = os.path.splitext(input.filename or "in.bin")[1] or ".bin"
    with tempfile.TemporaryDirectory() as td:
        src = os.path.join(td, f"in{suffix}")
        out = os.path.join(td, f"out{opts.get('outExt', '.mp4')}")
        with open(src, "wb") as f:
            f.write(data)

        if operation == "transcode":
            cmd = ["ffmpeg", "-y", "-i", src, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", out]
        elif operation == "extract-audio":
            cmd = ["ffmpeg", "-y", "-i", src, "-vn", "-c:a", "libmp3lame", out]
        elif operation == "probe":
            cmd = ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", src]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            return {"probe": json.loads(res.stdout or "{}")}
        elif operation == "thumbnail":
            cmd = ["ffmpeg", "-y", "-i", src, "-vf", "thumbnail", "-frames:v", "1", out]
        else:
            raise HTTPException(400, f"Unknown operation: {operation}")

        res = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
        if res.returncode != 0:
            raise HTTPException(500, f"ffmpeg failed: {res.stderr[-400:]}")
        if operation == "probe":
            return {"probe": {}}
        with open(out, "rb") as f:
            body = f.read()
        mime = "audio/mpeg" if out.endswith(".mp3") else "video/mp4" if out.endswith(".mp4") else "image/jpeg"
        return Response(content=body, media_type=mime)
