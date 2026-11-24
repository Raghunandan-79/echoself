import Link from "next/link";
import {
  AudioLines, ScanFace, Clapperboard, Bot, ShieldCheck, Lock,
  Server, ArrowRight, Mic, Video, MessageSquareText, Database,
} from "lucide-react";
import { Button } from "@/components/ui";

const FEATURES = [
  { icon: AudioLines, title: "Voice identity", desc: "Create a reusable voice profile from your own recordings. Consent-gated, stored privately." },
  { icon: ScanFace, title: "Face profile", desc: "Register a face reference for talking-head generation. Face detection is a quality check, never identity verification." },
  { icon: Clapperboard, title: "Talking-head video", desc: "Script → speech → synchronized avatar video, rendered locally with FFmpeg." },
  { icon: Bot, title: "EchoBot", desc: "A local LLM assistant for scripts, titles, translations and app guidance — via Ollama." },
];

const STEPS = [
  { n: "01", title: "Create your identities", desc: "Record or upload voice and face references. Every biometric profile requires explicit, versioned consent." },
  { n: "02", title: "Write your script", desc: "Enter any script in the Video Studio. EchoBot can help draft, rewrite and translate it." },
  { n: "03", title: "Generate & preview", desc: "Local models synthesize speech and animate your avatar. Preview, then download your MP4." },
];

const PRIVACY = [
  { icon: Lock, title: "Private by default", desc: "Media lives in a private Cloudflare R2 bucket. Access is via short-lived presigned URLs only." },
  { icon: ShieldCheck, title: "Consent & revocation", desc: "Separate consents for voice cloning, face animation, biometric storage and external processing — all revocable." },
  { icon: Server, title: "Local inference", desc: "Voice, face and chat models run on your own hardware. No biometric data leaves your machine for inference." },
  { icon: Database, title: "Metadata only in Postgres", desc: "PostgreSQL stores metadata and object keys — never audio, video or image blobs." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
              <AudioLines className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold tracking-tight">EchoSelf</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-text-muted md:flex">
            <Link href="/features" className="hover:text-text">Features</Link>
            <Link href="/how-it-works" className="hover:text-text">How it works</Link>
            <Link href="/privacy" className="hover:text-text">Privacy</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login"><Button variant="ghost">Log in</Button></Link>
            <Link href="/register"><Button>Get started</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-24 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent-soft">
          <Mic className="h-3.5 w-3.5" /> Local-first AI · zero paid APIs
        </div>
        <h1 className="mx-auto max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
          Your identity. Your voice. Your <span className="text-accent">digital twin</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-text-muted">
          EchoSelf turns your own voice and face into a reusable digital identity —
          generate personalized speech and talking-head videos entirely on open-source, local models.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Link href="/register"><Button className="px-6 py-3 text-base">Create your twin <ArrowRight className="h-4 w-4" /></Button></Link>
          <Link href="/how-it-works"><Button variant="secondary" className="px-6 py-3 text-base">See how it works</Button></Link>
        </div>
        <div className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { icon: AudioLines, label: "Voice cloning" },
            { icon: ScanFace, label: "Face animation" },
            { icon: Video, label: "MP4 talking-head" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-text-muted">
              <Icon className="h-4 w-4 text-accent" /> {label}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-bg-secondary/50">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <h2 className="text-center text-3xl font-semibold tracking-tight">One studio for your digital twin</h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-text-muted">
            From raw recordings to a finished talking-head video — every step is consent-gated and runs on open-source models.
          </p>
          <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl border border-border bg-card p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="text-center text-3xl font-semibold tracking-tight">How EchoSelf works</h2>
        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
          {STEPS.map(({ n, title, desc }) => (
            <div key={n} className="relative">
              <div className="text-4xl font-bold text-accent/30">{n}</div>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Privacy */}
      <section className="border-t border-border bg-bg-secondary/50">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-semibold tracking-tight">Privacy architecture</h2>
            <p className="mx-auto mt-3 max-w-xl text-text-muted">
              Biometric data is treated as the most sensitive asset in the system — consented, encrypted in transit, and deletable end-to-end.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {PRIVACY.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-4 rounded-xl border border-border bg-card p-5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Icon className="h-4.5 w-4.5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-text-muted">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h2 className="text-3xl font-semibold tracking-tight">Build your digital twin today</h2>
        <p className="mx-auto mt-3 max-w-md text-text-muted">
          Free to run locally. No paid APIs. Your data, your consent, your hardware.
        </p>
        <Link href="/register" className="mt-8 inline-block">
          <Button className="px-8 py-3 text-base">Get started free <ArrowRight className="h-4 w-4" /></Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-text-muted md:flex-row">
          <div className="flex items-center gap-2">
            <AudioLines className="h-4 w-4 text-accent" />
            <span>EchoSelf — privacy-first digital twin platform</span>
          </div>
          <div className="flex gap-6">
            <Link href="/features" className="hover:text-text">Features</Link>
            <Link href="/how-it-works" className="hover:text-text">How it works</Link>
            <Link href="/privacy" className="hover:text-text">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
