import Link from "next/link";
import { ShieldCheck, Lock, Server, Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui";

export const metadata = { title: "Privacy & security" };

const SECTIONS = [
  { icon: Lock, title: "Private object storage", body: "All media is stored in a private Cloudflare R2 bucket (echoself-private). Nothing is publicly addressable; downloads use short-lived presigned URLs minted only after ownership checks." },
  { icon: ShieldCheck, title: "Consent model", body: "Four scopes — voice_cloning, face_animation, biometric_storage, external_processing — each versioned, timestamped and individually revocable. Generation endpoints verify active consent server-side before any job is created." },
  { icon: Server, title: "Local inference", body: "Voice synthesis, talking-face generation, media processing and the EchoBot LLM run on infrastructure you control. Biometric references are sent only to your private AI service — never to third-party APIs." },
  { icon: Trash2, title: "Deletion", body: "Deleting an asset removes the stored object and marks derived records. Account deletion removes every owned object, revokes sessions, and anonymizes the user record. Database rows store metadata and object keys only — never media blobs." },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="text-sm font-semibold">EchoSelf</Link>
          <Link href="/register"><Button>Get started</Button></Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="text-4xl font-semibold tracking-tight">Privacy & security</h1>
        <p className="mt-3 text-text-muted">
          EchoSelf is designed so that your biometric data is never the product. This page describes the controls that enforce that.
        </p>
        <div className="mt-12 space-y-8">
          {SECTIONS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
                <Icon className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="font-semibold">{title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-14 rounded-xl border border-border bg-card p-6 text-sm text-text-muted">
          <p className="font-medium text-text">Honest disclosures</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Face detection in the browser is a quality check only — it is not identity verification.</li>
            <li>Generated videos are synthetic media and are labeled as such in the UI.</li>
            <li>Free-tier services (Neon, Upstash, R2) have usage limits documented in our cost analysis.</li>
            <li>If the local AI service runs in mock mode, outputs are clearly marked and are not real model inference.</li>
          </ul>
        </div>
        <div className="mt-10">
          <Link href="/register"><Button className="px-6">Get started <ArrowRight className="h-4 w-4" /></Button></Link>
        </div>
      </main>
    </div>
  );
}
