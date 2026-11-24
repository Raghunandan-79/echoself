"use client";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { Plus, Trash2, ImagePlus, ScanFace, AlertTriangle, CheckCircle2 } from "lucide-react";
import { PageHeader, Card, CardHeader, CardBody, Button, Input, Label, Badge, Skeleton, EmptyState, Alert } from "@/components/ui";
import { UploadProgress } from "@/components/audio-recorder";
import { listFaces, createFace, deleteFace, uploadAsset, listConsents, grantConsent, getAssetAccessUrl, updateFace } from "@/services/api";

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

interface QualityCheck { label: string; ok: boolean; detail: string }

async function checkImage(file: File): Promise<{ url: string; checks: QualityCheck[] }> {
  const checks: QualityCheck[] = [];
  checks.push({ label: "File type", ok: ALLOWED.includes(file.type), detail: file.type || "unknown" });
  checks.push({ label: "File size", ok: file.size <= MAX_BYTES, detail: `${(file.size / 1024 / 1024).toFixed(2)} MB (max 20 MB)` });
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (bitmap) {
    checks.push({ label: "Decodable image", ok: true, detail: `${bitmap.width}×${bitmap.height}` });
    checks.push({ label: "Minimum resolution", ok: bitmap.width >= 256 && bitmap.height >= 256, detail: "≥256×256 recommended for face animation" });
    checks.push({ label: "Landscape bias", ok: bitmap.width >= bitmap.height * 0.6, detail: "Front-facing portraits work best" });
    bitmap.close();
  } else {
    checks.push({ label: "Decodable image", ok: false, detail: "Could not decode image" });
  }
  return { url: URL.createObjectURL(file), checks };
}

export default function FaceStudioPage() {
  const qc = useQueryClient();
  const faces = useQuery({ queryKey: ["faces"], queryFn: listFaces });
  const consents = useQuery({ queryKey: ["consents"], queryFn: listConsents });
  const faceConsent = consents.data?.find((c) => c.scope === "face_animation");
  const hasConsent = !!faceConsent?.granted && !faceConsent.revokedAt;

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [checks, setChecks] = useState<QualityCheck[]>([]);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const grantMutation = useMutation({
    mutationFn: () => grantConsent("face_animation", true),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consents"] }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      let id = assetId;
      if (!id && file) {
        const asset = await uploadAsset("face_reference", file, setUploadPct);
        id = asset.id;
        setAssetId(id);
      }
      if (!id) throw new Error("Upload a reference image first");
      return createFace({ name, referenceAssetId: id, consentConfirmed: true });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["faces"] });
      setFile(null); setPreviewUrl(null); setChecks([]); setAssetId(null); setName("");
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Failed"),
  });

  const deleteMutation = useMutation({ mutationFn: deleteFace, onSuccess: () => qc.invalidateQueries({ queryKey: ["faces"] }) });

  async function onPick(f: File) {
    setError(null);
    setFile(f);
    setAssetId(null);
    const { url, checks } = await checkImage(f);
    setPreviewUrl(url);
    setChecks(checks);
  }

  async function previewFace(assetId: string | null | undefined) {
    if (!assetId) return;
    const { url } = await getAssetAccessUrl(assetId);
    window.open(url.startsWith("http") ? url : `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}${url}`, "_blank");
  }

  const allChecksPass = checks.length > 0 && checks.every((c) => c.ok);

  return (
    <div>
      <PageHeader title="Face Studio" description="Create face profiles for talking-head video generation." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader><h2 className="text-sm font-semibold">Face animation consent</h2></CardHeader>
            <CardBody>
              {hasConsent ? (
                <Alert tone="accent">Face animation consent is active (v{faceConsent?.version}). Revocable in Settings.</Alert>
              ) : (
                <div className="space-y-3">
                  <Alert tone="amber">Creating a face profile requires explicit consent to animate your face in generated videos.</Alert>
                  <Button onClick={() => grantMutation.mutate()} loading={grantMutation.isPending}>Grant face animation consent</Button>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="text-sm font-semibold">Reference image</h2></CardHeader>
            <CardBody className="space-y-4">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPick(f); e.target.value = ""; }}
              />
              {previewUrl ? (
                <div className="space-y-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Face reference preview" className="max-h-72 w-full rounded-lg border border-border object-contain" />
                  <div className="space-y-1.5">
                    {checks.map((c) => (
                      <div key={c.label} className="flex items-center gap-2 text-xs">
                        {c.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
                        <span className="text-text-muted">{c.label}:</span>
                        <span>{c.detail}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-text-muted">
                    These are client-side quality checks only. Face detection is not identity verification.
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-bg-secondary px-6 py-10 text-sm text-text-muted transition-colors hover:border-accent/50 hover:text-text"
                >
                  <ImagePlus className="h-8 w-8" />
                  Click to upload a face photo (JPEG, PNG or WebP, max 20 MB)
                </button>
              )}
              {uploadPct !== null && <UploadProgress value={uploadPct} />}
              {assetId && <Badge tone="green">Image uploaded</Badge>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="text-sm font-semibold">Create face profile</h2></CardHeader>
            <CardBody className="space-y-4">
              <div>
                <Label htmlFor="fname">Profile name</Label>
                <Input id="fname" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My avatar" />
              </div>
              <Button
                onClick={() => { setError(null); createMutation.mutate(); }}
                loading={createMutation.isPending}
                disabled={!name.trim() || !file || !hasConsent}
              >
                <Plus className="h-4 w-4" /> Create profile
              </Button>
              {!hasConsent && <p className="text-xs text-text-muted">Grant face animation consent above first.</p>}
              {error && <Alert>{error}</Alert>}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Your face profiles</h2>
            <Badge tone="neutral">{faces.data?.length ?? 0}</Badge>
          </CardHeader>
          <div className="divide-y divide-border">
            {faces.isLoading && <div className="p-5"><Skeleton className="h-16" /></div>}
            {(faces.data ?? []).map((f) => (
              <div key={f.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <ScanFace className="h-4 w-4 text-accent" />
                  <div>
                    <div className="text-sm font-medium">{f.name}</div>
                    <div className="text-xs text-text-muted">{f.status.toLowerCase()}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" onClick={() => void previewFace(f.referenceAssetId)} title="View reference"><ImagePlus className="h-4 w-4" /></Button>
                  <Button variant="ghost" onClick={() => deleteMutation.mutate(f.id)} title="Delete"><Trash2 className="h-4 w-4 text-red-400" /></Button>
                </div>
              </div>
            ))}
            {!faces.isLoading && (faces.data ?? []).length === 0 && (
              <div className="p-5"><EmptyState title="No face profiles" description="Upload a reference photo and create your first face profile." /></div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
