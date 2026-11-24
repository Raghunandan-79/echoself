import Link from "next/link";
import { AudioLines, ScanFace, Clapperboard, Bot, ShieldCheck, Server, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui";

export const metadata = { title: "Features" };

const ITEMS = [
  { icon: AudioLines, title: "Voice Studio", body: "Record or upload reference audio, create named voice profiles, and generate speech from any script. Character counters, language selection, progress tracking and direct download." },
  { icon: ScanFace, title: "Face Studio", body: "Upload a face reference image, preview it, and manage face profiles. Consent is explicit and revocable; detection is a quality signal, not identity verification." },
  { icon: Clapperboard, title: "Video Studio", body: "Pick a voice profile and a face profile, write a script, choose aspect ratio and resolution, and generate a talking-head MP4 with progress tracking and synthetic-media labeling." },
  { icon: Bot, title: "EchoBot", body: "Chat with a local LLM (Ollama) for script writing, rewriting, translation, summarization, topic and title ideas — with persistent conversation history." },
  { icon: Server, title: "Local AI pipeline", body: "Voice synthesis (XTTS-v2 candidate), talking-face generation (SadTalker/Wav2Lip adapters) and media processing (FFmpeg) all run on your own hardware via a private FastAPI service." },
  { icon: Lock, title: "Private media", body: "Cloudflare R2 private bucket, presigned uploads and downloads, per-user quotas, orphan cleanup and full deletion of source and derived media." },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="text-sm font-semibold">EchoSelf</Link>
          <Link href="/register"><Button>Get started</Button></Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-20">
        <h1 className="text-4xl font-semibold tracking-tight">Features</h1>
        <p className="mt-3 max-w-2xl text-text-muted">
          Everything needed to create, manage and distribute your authorized digital twin — with zero paid API dependencies.
        </p>
        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15">
                <Icon className="h-5 w-5 text-accent" />
              </div>
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{body}</p>
            </div>
          ))}
        </div>
        <div className="mt-16 flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          <p className="text-sm text-text-muted">
            EchoSelf only permits biometric generation using your own data or data you are authorized to use.
            Every profile requires documented, revocable consent.
          </p>
        </div>
        <div className="mt-10">
          <Link href="/register"><Button className="px-6">Start building <ArrowRight className="h-4 w-4" /></Button></Link>
        </div>
      </main>
    </div>
  );
}
