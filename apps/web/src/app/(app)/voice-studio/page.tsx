"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Play, AudioLines } from "lucide-react";
import { PageHeader, Card, CardBody, CardHeader, Button, Input, Label, Select, Badge, Skeleton, EmptyState, Alert, Progress } from "@/components/ui";
import { AudioRecorder, AudioPreview, UploadProgress } from "@/components/audio-recorder";
import { listVoices, createVoice, deleteVoice, uploadAsset, listConsents, grantConsent, createSpeechJob, getJob, getAssetAccessUrl } from "@/services/api";
import { SUPPORTED_LANGUAGES, SPEECH_LIMITS } from "@echoself/shared/constants";
import { cn } from "@/lib/utils";

export default function VoiceStudioPage() {
  const qc = useQueryClient();
  const voices = useQuery({ queryKey: ["voices"], queryFn: listVoices });
  const consents = useQuery({ queryKey: ["consents"], queryFn: listConsents });

  const voiceConsent = consents.data?.find((c) => c.scope === "voice_cloning");
  const hasConsent = !!voiceConsent?.granted && !voiceConsent.revokedAt;

  // --- reference capture state ---
  const [recBlob, setRecBlob] = useState<Blob | null>(null);
  const [recUrl, setRecUrl] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [uploadedAssetId, setUploadedAssetId] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // --- profile form ---
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("en");

  // --- speech gen ---
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [text, setText] = useState("");
  const [genLang, setGenLang] = useState("en");
  const [jobId, setJobId] = useState<string | null>(null);
  const [audioOut, setAudioOut] = useState<string | null>(null);

  const job = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => getJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (q) => {
      const s = q.state.data?.state;
      return s && ["PENDING", "QUEUED", "PROCESSING"].includes(s) ? 1500 : false;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      let assetId = uploadedAssetId;
      if (!assetId && recBlob) {
        const file = new File([recBlob], "voice-reference.webm", { type: (recBlob.type || "audio/webm").split(";")[0] });
        const asset = await uploadAsset("voice_reference", file, setUploadPct);
        assetId = asset.id;
        setUploadedAssetId(assetId);
      }
      return createVoice({ name, language, referenceAssetId: assetId ?? undefined, consentConfirmed: true });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["voices"] });
      setName(""); setRecBlob(null); setRecUrl(null); setUploadedAssetId(null); setUploadPct(null);
    },
  });

  const grantMutation = useMutation({
    mutationFn: () => grantConsent("voice_cloning", true),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consents"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteVoice,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["voices"] }),
  });

  const genMutation = useMutation({
    mutationFn: () => createSpeechJob(selectedVoice, text, genLang),
    onSuccess: (d) => setJobId(d.id),
  });

  async function playReference(assetId: string | null | undefined) {
    if (!assetId) return;
    const { url } = await getAssetAccessUrl(assetId);
    const full = url.startsWith("http") ? url : `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}${url}`;
    setPreviewing(full);
  }

  // when job completes, fetch output asset access URL
  const jobState = job.data?.state;
  const outputAssetId = job.data?.outputAssetId;
  useEffect(() => {
    if (jobState === "COMPLETED" && outputAssetId && !audioOut) {
      void getAssetAccessUrl(outputAssetId).then(({ url }) => {
        setAudioOut(url.startsWith("http") ? url : `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}${url}`);
      });
    }
  }, [jobState, outputAssetId, audioOut]);

  return (
    <div>
      <PageHeader title="Voice Studio" description="Create voice identities and generate personalized speech." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: create profile */}
        <div className="space-y-6">
          <Card>
            <CardHeader><h2 className="text-sm font-semibold">Voice consent</h2></CardHeader>
            <CardBody>
              {hasConsent ? (
                <Alert tone="accent">Voice cloning consent is active (v{voiceConsent?.version}). You can revoke it in Settings.</Alert>
              ) : (
                <div className="space-y-3">
                  <Alert tone="amber">
                    Creating a voice profile requires explicit consent to clone your voice. This consent is versioned, timestamped and revocable.
                  </Alert>
                  <Button onClick={() => grantMutation.mutate()} loading={grantMutation.isPending}>Grant voice cloning consent</Button>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="text-sm font-semibold">Reference audio</h2></CardHeader>
            <CardBody className="space-y-4">
              <AudioRecorder onRecorded={(blob, url) => { setRecBlob(blob); setRecUrl(url); }} />
              {recUrl && <AudioPreview src={recUrl} onClear={() => { setRecBlob(null); setRecUrl(null); URL.revokeObjectURL(recUrl); }} />}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-text-muted">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setUploadPct(0);
                    try {
                      const asset = await uploadAsset("voice_reference", f, setUploadPct);
                      setUploadedAssetId(asset.id);
                      setRecBlob(null); setRecUrl(null);
                    } finally {
                      setUploadPct(null);
                      e.target.value = "";
                    }
                  }}
                />
                <Button variant="secondary" onClick={() => fileRef.current?.click()}>Upload audio file</Button>
                <p className="mt-1 text-xs text-text-muted">WAV, MP3, M4A, OGG, FLAC or WebM · max 50 MB</p>
              </div>
              {uploadPct !== null && <UploadProgress value={uploadPct} />}
              {uploadedAssetId && <Badge tone="green">Reference uploaded</Badge>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="text-sm font-semibold">Create voice profile</h2></CardHeader>
            <CardBody className="space-y-4">
              <div>
                <Label htmlFor="vname">Profile name</Label>
                <Input id="vname" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My voice" />
              </div>
              <div>
                <Label htmlFor="vlang">Language</Label>
                <Select id="vlang" value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {SUPPORTED_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                </Select>
              </div>
              <Button
                onClick={() => createMutation.mutate()}
                loading={createMutation.isPending}
                disabled={!name.trim() || (!uploadedAssetId && !recBlob) || !hasConsent}
              >
                <Plus className="h-4 w-4" /> Create profile
              </Button>
              {!hasConsent && <p className="text-xs text-text-muted">Grant voice cloning consent above first.</p>}
              {createMutation.isError && <Alert>{(createMutation.error as Error).message}</Alert>}
            </CardBody>
          </Card>
        </div>

        {/* Right: profiles + generate */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Your voice profiles</h2>
              <Badge tone="neutral">{voices.data?.length ?? 0}</Badge>
            </CardHeader>
            <div className="divide-y divide-border">
              {voices.isLoading && <div className="p-5"><Skeleton className="h-14" /></div>}
              {(voices.data ?? []).map((v) => (
                <div key={v.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <AudioLines className="h-4 w-4 text-accent" />
                    <div>
                      <div className="text-sm font-medium">{v.name}</div>
                      <div className="text-xs text-text-muted">{v.language ?? "auto"} · {v.status.toLowerCase()}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {v.referenceAssetId && (
                      <Button variant="ghost" onClick={() => void playReference(v.referenceAssetId)} title="Preview reference">
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" onClick={() => deleteMutation.mutate(v.id)} title="Delete">
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              ))}
              {!voices.isLoading && (voices.data ?? []).length === 0 && (
                <div className="p-5"><EmptyState title="No voice profiles" description="Record or upload a reference, then create your first voice profile." /></div>
              )}
            </div>
          </Card>

          {previewing && <AudioPreview src={previewing} onClear={() => setPreviewing(null)} />}

          <Card>
            <CardHeader><h2 className="text-sm font-semibold">Generate speech</h2></CardHeader>
            <CardBody className="space-y-4">
              <div>
                <Label htmlFor="gvoice">Voice profile</Label>
                <Select id="gvoice" value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)}>
                  <option value="">Select a voice…</option>
                  {(voices.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </Select>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="gtext">Script</Label>
                  <span className={cn("text-xs tabular-nums", text.length > SPEECH_LIMITS.maxChars ? "text-red-400" : "text-text-muted")}>
                    {text.length}/{SPEECH_LIMITS.maxChars}
                  </span>
                </div>
                <textarea
                  id="gtext"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={SPEECH_LIMITS.maxChars + 100}
                  placeholder="Type the text you want spoken in your voice…"
                  className="min-h-[140px] w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <Label htmlFor="glang">Language</Label>
                <Select id="glang" value={genLang} onChange={(e) => setGenLang(e.target.value)}>
                  {SUPPORTED_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                </Select>
              </div>
              <Button
                onClick={() => genMutation.mutate()}
                loading={genMutation.isPending}
                disabled={!selectedVoice || !text.trim() || text.length > SPEECH_LIMITS.maxChars}
              >
                Generate speech
              </Button>
              {genMutation.isError && <Alert>{(genMutation.error as Error).message}</Alert>}

              {jobId && (
                <div className="space-y-2 rounded-lg border border-border bg-bg-secondary p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">Job {jobId.slice(0, 8)}…</span>
                    <Badge tone={jobState === "COMPLETED" ? "green" : jobState === "FAILED" ? "red" : "accent"}>{jobState?.toLowerCase()}</Badge>
                  </div>
                  <Progress value={job.data?.progress ?? 0} />
                  {job.data?.error && <Alert>{job.data.error}</Alert>}
                  {job.data?.input && typeof job.data.input === "object" && "mock" in (job.data.input as object) && (job.data.input as { mock?: boolean }).mock && (
                    <p className="text-xs text-amber-400">Output was produced by the development mock — not real voice cloning.</p>
                  )}
                  {audioOut && <audio src={audioOut} controls className="mt-2 h-9 w-full" />}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
