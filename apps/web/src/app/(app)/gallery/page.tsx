"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Images, Play, Download, Trash2, AudioLines, Clapperboard, Loader2 } from "lucide-react";
import { PageHeader, Card, Badge, Skeleton, EmptyState, Button, Alert } from "@/components/ui";
import { listAssets, deleteAsset, getAssetAccessUrl, listJobs } from "@/services/api";
import type { AssetDTO } from "@echoself/shared/types";

function AssetCard({ asset, onDelete }: { asset: AssetDTO; onDelete: (id: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isVideo = asset.kind === "generated_video";
  const isAudio = asset.kind === "generated_audio";

  async function open() {
    setLoading(true);
    try {
      const { url } = await getAssetAccessUrl(asset.id);
      const full = url.startsWith("http") ? url : `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}${url}`;
      setUrl(full);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex h-40 items-center justify-center bg-bg-secondary">
        {isVideo && url ? (
          <video src={url} controls className="h-full w-full object-contain" />
        ) : isAudio && url ? (
          <audio src={url} controls className="w-4/5" />
        ) : (
          <button onClick={open} className="flex flex-col items-center gap-2 text-text-muted hover:text-text" disabled={loading}>
            {loading ? <Loader2 className="h-8 w-8 animate-spin" /> : isVideo ? <Clapperboard className="h-10 w-10" /> : <AudioLines className="h-10 w-10" />}
            <span className="text-xs">{loading ? "Loading…" : "Click to preview"}</span>
          </button>
        )}
      </div>
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <div className="text-sm font-medium capitalize">{asset.kind.replace(/_/g, " ")}</div>
          <div className="text-xs text-text-muted">
            {asset.sizeBytes ? `${(Number(asset.sizeBytes) / 1024 / 1024).toFixed(1)} MB` : "—"} · {new Date(asset.createdAt).toLocaleDateString()}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {url && (
            <a href={url} download>
              <Button variant="ghost"><Download className="h-4 w-4" /></Button>
            </a>
          )}
          <Button variant="ghost" onClick={() => onDelete(asset.id)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
        </div>
      </div>
    </Card>
  );
}

export default function GalleryPage() {
  const qc = useQueryClient();
  const assets = useQuery({ queryKey: ["assets"], queryFn: () => listAssets(1, 60), refetchInterval: 10000 });
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: () => listJobs(1), refetchInterval: 5000 });

  const delMutation = useMutation({
    mutationFn: deleteAsset,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assets"] }),
  });

  const activeJobs = (jobs.data ?? []).filter((j) => ["PENDING", "QUEUED", "PROCESSING"].includes(j.state));
  const media = (assets.data ?? []).filter((a) => a.kind.startsWith("generated"));

  return (
    <div>
      <PageHeader title="Gallery" description="All generated media and background jobs." />

      {activeJobs.length > 0 && (
        <Card className="mb-6">
          <div className="border-b border-border px-5 py-3 text-sm font-semibold">Active jobs</div>
          <div className="divide-y divide-border">
            {activeJobs.map((j) => (
              <div key={j.id} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm capitalize">{j.type.toLowerCase()} · {j.state.toLowerCase()}</span>
                <Badge tone="accent">{j.progress}%</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {assets.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      ) : media.length === 0 ? (
        <EmptyState
          icon={<Images className="h-10 w-10" />}
          title="No generated media yet"
          description="Generate speech in Voice Studio or videos in Video Studio — results will appear here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {media.map((a) => <AssetCard key={a.id} asset={a} onDelete={(id) => delMutation.mutate(id)} />)}
        </div>
      )}

      {delMutation.isError && <div className="mt-4"><Alert>Failed to delete asset.</Alert></div>}
      <div className="mt-2 flex items-center gap-1 text-xs text-text-muted">
        <Play className="h-3 w-3" /> Deleting an asset removes the stored object permanently.
      </div>
    </div>
  );
}
