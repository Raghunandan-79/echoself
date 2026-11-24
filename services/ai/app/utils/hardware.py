"""Hardware detection and model-fit checks."""
import os
import shutil
import subprocess

# Bundled static ffmpeg/ffprobe (services/ai/bin) take precedence fallback
_LOCAL_BIN = os.path.join(os.path.dirname(__file__), "..", "..", "bin")
if os.path.isdir(_LOCAL_BIN) and _LOCAL_BIN not in os.environ.get("PATH", ""):
    os.environ["PATH"] = f"{os.path.abspath(_LOCAL_BIN)}:{os.environ.get('PATH', '')}"


def detect_device() -> str:
    if os.environ.get("AI_DEVICE"):
        return os.environ["AI_DEVICE"]
    try:
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"
    except Exception:
        return "cpu"


def cuda_info() -> dict | None:
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total,memory.free", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=10,
        )
        if out.returncode == 0 and out.stdout.strip():
            parts = [p.strip() for p in out.stdout.strip().splitlines()[0].split(",")]
            return {"name": parts[0], "vramTotalMB": int(parts[1]), "vramFreeMB": int(parts[2])}
    except Exception:
        pass
    return None


def ram_info() -> dict | None:
    try:
        with open("/proc/meminfo") as f:
            vals = {}
            for line in f:
                if ":" in line:
                    k, v = line.split(":", 1)
                    vals[k.strip()] = int(v.strip().split()[0]) // 1024  # MB
        return {"totalMB": vals.get("MemTotal"), "availableMB": vals.get("MemAvailable")}
    except Exception:
        return None


def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None
