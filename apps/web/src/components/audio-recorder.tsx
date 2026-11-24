"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, Pause, Play, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioRecorder({ onRecorded }: { onRecorded: (blob: Blob, url: string) => void }) {
  const [state, setState] = useState<"idle" | "recording" | "paused">("idle");
  const [seconds, setSeconds] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    stream?.getTracks().forEach((t) => t.stop());
  }, [stream]);

  async function start() {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      setStream(s);
      const rec = new MediaRecorder(s);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        onRecorded(blob, URL.createObjectURL(blob));
        s.getTracks().forEach((t) => t.stop());
        setStream(null);
      };
      recorderRef.current = rec;
      rec.start(250);
      setState("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((v) => v + 1), 1000);
    } catch {
      setError("Microphone access denied. Allow microphone permission or upload an audio file instead.");
    }
  }

  function pause() {
    recorderRef.current?.pause();
    if (timerRef.current) clearInterval(timerRef.current);
    setState("paused");
  }
  function resume() {
    recorderRef.current?.resume();
    timerRef.current = setInterval(() => setSeconds((v) => v + 1), 1000);
    setState("recording");
  }
  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
    setState("idle");
    setSeconds(0);
  }

  const quality = seconds >= 15 ? "Good length" : seconds >= 5 ? "A bit short — aim for 15+ seconds" : "Keep recording — minimum ~5 seconds recommended";

  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-full", state === "recording" ? "bg-red-500/15 text-red-400" : "bg-card text-text-muted")}>
            <Mic className="h-5 w-5" />
          </div>
          <div>
            <div className="font-mono text-lg tabular-nums">{fmtTime(seconds)}</div>
            <div className="text-xs text-text-muted">{state === "idle" ? "Ready to record" : state === "paused" ? "Paused" : "Recording…"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {state === "idle" && <Button onClick={start}><Mic className="h-4 w-4" /> Record</Button>}
          {state === "recording" && (
            <>
              <Button variant="secondary" onClick={pause}><Pause className="h-4 w-4" /> Pause</Button>
              <Button variant="danger" onClick={stop}><Square className="h-4 w-4" /> Stop</Button>
            </>
          )}
          {state === "paused" && (
            <>
              <Button variant="secondary" onClick={resume}><Play className="h-4 w-4" /> Resume</Button>
              <Button variant="danger" onClick={stop}><Square className="h-4 w-4" /> Stop</Button>
            </>
          )}
        </div>
      </div>
      {state !== "idle" && (
        <div className="mt-3">
          <div className="flex h-8 items-end gap-0.5">
            {Array.from({ length: 48 }).map((_, i) => (
              <div key={i} className={cn("w-1 flex-1 rounded-sm bg-accent/60 transition-all", state === "paused" && "bg-text-muted/40")} style={{ height: `${20 + Math.abs(Math.sin(i * 0.7 + seconds)) * 80}%` }} />
            ))}
          </div>
          <p className="mt-2 text-xs text-text-muted">{quality}</p>
        </div>
      )}
      {state === "idle" && seconds === 0 && <p className="mt-3 text-xs text-text-muted">Tip: record 15–60 seconds of clean speech in a quiet room for best cloning quality.</p>}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}

export function AudioPreview({ src, onClear }: { src: string; onClear?: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-bg-secondary p-4">
      <audio src={src} controls className="h-9 flex-1" />
      {onClear && <Button variant="ghost" onClick={onClear}><RotateCcw className="h-4 w-4" /> Clear</Button>}
    </div>
  );
}

export function UploadProgress({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-bg-secondary p-4">
      <Loader2 className="h-4 w-4 animate-spin text-accent" />
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-card">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs tabular-nums text-text-muted">{value}%</span>
    </div>
  );
}
