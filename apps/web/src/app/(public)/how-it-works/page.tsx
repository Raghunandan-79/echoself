import Link from "next/link";
import { Mic, ScanFace, PenLine, Clapperboard, Download, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui";

export const metadata = { title: "How it works" };

const STEPS = [
  { icon: Mic, title: "1. Voice profile", body: "In Voice Studio, record or upload a clean voice sample (WAV/MP3/M4A/OGG/FLAC/WebM). Grant voice-cloning consent. The audio uploads directly to private storage." },
  { icon: ScanFace, title: "2. Face profile", body: "In Face Studio, upload a clear front-facing image (JPEG/PNG/WebP). Grant face-animation consent. Client-side checks warn about poor references." },
  { icon: PenLine, title: "3. Write a script", body: "Use the script editor in Video Studio — or ask EchoBot to draft, rewrite, translate or summarize it for you." },
  { icon: Clapperboard, title: "4. Generate", body: "Pick voice + face profiles, aspect ratio, resolution and subtitles. The job runs in a background queue through your local AI service." },
  { icon: Download, title: "5. Preview & download", body: "Track progress live, preview the finished MP4 with its audio, and download it — or manage everything later in the Gallery." },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="text-sm font-semibold">EchoSelf</Link>
          <Link href="/register"><Button>Get started</Button></Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-4xl font-semibold tracking-tight">How it works</h1>
        <p className="mt-3 text-text-muted">
          From signup to your first talking-head video in five steps. Everything runs through real backend jobs and local models.
        </p>
        <div className="mt-12 space-y-8">
          {STEPS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/15">
                <Icon className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h2 className="font-semibold">{title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-14 rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <div className="text-sm text-text-muted">
              <p className="font-medium text-text">Consent is enforced, not cosmetic.</p>
              <p className="mt-1">
                Voice profiles cannot be created without active <code>voice_cloning</code> consent;
                face profiles and video jobs require <code>face_animation</code> consent.
                Revoking consent in Settings blocks new generation.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-10">
          <Link href="/register"><Button className="px-6">Get started <ArrowRight className="h-4 w-4" /></Button></Link>
        </div>
      </main>
    </div>
  );
}
