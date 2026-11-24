"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AudioLines, ScanFace, Clapperboard, Bot, ArrowRight, HardDrive, Activity } from "lucide-react";
import { PageHeader, Card, CardBody, Skeleton, Badge, Button, EmptyState } from "@/components/ui";
import { getMe, listJobs, listVoices, listFaces, listAssets } from "@/services/api";
import { useAuth } from "@/stores/auth";

function StatCard({ icon: Icon, label, value, href }: { icon: typeof AudioLines; label: string; value: string | number; href?: string }) {
  const inner = (
    <Card className="transition-colors hover:border-accent/40">
      <CardBody className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15">
          <Icon className="h-5 w-5 text-accent" />
        </div>
        <div>
          <div className="text-2xl font-semibold tabular-nums">{value}</div>
          <div className="text-xs text-text-muted">{label}</div>
        </div>
      </CardBody>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const me = useQuery({ queryKey: ["me"], queryFn: getMe, refetchInterval: 10000 });
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => listJobs(1), refetchInterval: 5000 });
  const voices = useQuery({ queryKey: ["voices"], queryFn: listVoices, refetchInterval: 10000 });
  const faces = useQuery({ queryKey: ["faces"], queryFn: listFaces, refetchInterval: 10000 });
  const assets = useQuery({ queryKey: ["assets"], queryFn: () => listAssets(1, 6), refetchInterval: 10000 });

  const stats = me.data?.stats;
  const activeJobs = (jobs.data ?? []).filter((j) => ["PENDING", "QUEUED", "PROCESSING"].includes(j.state));
  const recentAssets = assets.data ?? [];
  const storageGB = stats ? (stats.storageBytes / 1024 ** 3).toFixed(2) : "0";

  return (
    <div>
      <PageHeader
        title={`Welcome back${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        description="Your digital twin studio at a glance."
        actions={<Link href="/video-studio"><Button>Create video <ArrowRight className="h-4 w-4" /></Button></Link>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {me.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <StatCard icon={AudioLines} label="Voice profiles" value={stats?.voiceProfiles ?? 0} href="/voice-studio" />
            <StatCard icon={ScanFace} label="Face profiles" value={stats?.faceProfiles ?? 0} href="/face-studio" />
            <StatCard icon={Clapperboard} label="Videos generated" value={stats?.generatedVideos ?? 0} href="/gallery" />
            <StatCard icon={Activity} label="Active jobs" value={activeJobs.length} href="/gallery" />
          </>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold">Recent jobs</h2>
            <Link href="/gallery" className="text-xs text-accent-soft hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-border">
            {jobs.isLoading && <div className="p-5"><Skeleton className="h-10" /></div>}
            {(jobs.data ?? []).slice(0, 5).map((j) => (
              <div key={j.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  {j.type === "VIDEO" ? <Clapperboard className="h-4 w-4 text-text-muted" /> : <AudioLines className="h-4 w-4 text-text-muted" />}
                  <div>
                    <div className="text-sm font-medium capitalize">{j.type.toLowerCase()} generation</div>
                    <div className="text-xs text-text-muted">{new Date(j.createdAt).toLocaleString()}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-muted">{j.progress}%</span>
                  <Badge tone={j.state === "COMPLETED" ? "green" : j.state === "FAILED" ? "red" : ["PENDING", "QUEUED", "PROCESSING"].includes(j.state) ? "accent" : "neutral"}>
                    {j.state.toLowerCase()}
                  </Badge>
                </div>
              </div>
            ))}
            {!jobs.isLoading && (jobs.data ?? []).length === 0 && (
              <div className="p-5"><EmptyState title="No jobs yet" description="Generate your first speech or video to see it here." /></div>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <HardDrive className="h-4 w-4 text-text-muted" />
              <h2 className="text-sm font-semibold">Storage</h2>
            </div>
            <CardBody>
              <div className="text-2xl font-semibold tabular-nums">{storageGB} GB</div>
              <p className="mt-1 text-xs text-text-muted">used of your configured quota</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-bg-secondary">
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (Number(stats?.storageBytes ?? 0) / 5 / 1024 ** 3) * 100)}%` }} />
              </div>
            </CardBody>
          </Card>
          <Card>
            <div className="border-b border-border px-5 py-4"><h2 className="text-sm font-semibold">Quick actions</h2></div>
            <CardBody className="grid grid-cols-2 gap-2">
              <Link href="/voice-studio" className="rounded-lg border border-border px-3 py-2.5 text-center text-xs font-medium text-text-muted hover:border-accent/40 hover:text-text">Voice Studio</Link>
              <Link href="/face-studio" className="rounded-lg border border-border px-3 py-2.5 text-center text-xs font-medium text-text-muted hover:border-accent/40 hover:text-text">Face Studio</Link>
              <Link href="/video-studio" className="rounded-lg border border-border px-3 py-2.5 text-center text-xs font-medium text-text-muted hover:border-accent/40 hover:text-text">Video Studio</Link>
              <Link href="/echobot" className="rounded-lg border border-border px-3 py-2.5 text-center text-xs font-medium text-text-muted hover:border-accent/40 hover:text-text">EchoBot</Link>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Recent media</h2>
          <Link href="/gallery" className="text-xs text-accent-soft hover:underline">Open gallery</Link>
        </div>
        {assets.isLoading ? (
          <div className="grid grid-cols-2 gap-3 p-5 md:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        ) : recentAssets.length === 0 ? (
          <div className="p-5"><EmptyState icon={<Bot className="h-8 w-8" />} title="No media yet" description="Generated audio and videos will appear here." /></div>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-5 md:grid-cols-3">
            {recentAssets.map((a) => (
              <Link key={a.id} href="/gallery" className="group overflow-hidden rounded-lg border border-border bg-bg-secondary">
                <div className="flex h-28 items-center justify-center">
                  {a.kind.includes("video") ? <Clapperboard className="h-8 w-8 text-text-muted" /> : <AudioLines className="h-8 w-8 text-text-muted" />}
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs capitalize text-text-muted">{a.kind.replace(/_/g, " ")}</span>
                  <Badge tone={a.status === "READY" ? "green" : "neutral"}>{a.status.toLowerCase()}</Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
