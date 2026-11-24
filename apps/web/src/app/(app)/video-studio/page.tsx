"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clapperboard, Download, Play, AlertTriangle } from "lucide-react";
import { PageHeader, Card, CardHeader, CardBody, Button, Label, Select, Textarea, Badge, Skeleton, EmptyState, Alert, Progress } from "@/components/ui";
import { listVoices, listFaces, createVideoJob, getJob, getAssetAccessUrl, cancelJob } from "@/services/api";
import { SUPPORTED_LANGUAGES, ASPECT_RATIOS, VIDEO_RESOLUTIONS, VIDEO_LIMITS } from "@echoself/shared/constants";
import { cn } from "@/lib/utils";

export default function VideoStudioPage() {
  const qc = useQueryClient();
  const voices = useQuery({ queryKey: ["voices"], queryFn: listVoices });
  const faces = useQuery({ queryKey: ["faces"], queryFn: listFaces });

  const [voiceId, setVoiceId] = useState("");
  const [faceId, setFaceId] = useState("");
  const [script, setScript] = useState("");
  const [language, setLanguage] = useState("en");
  const [aspect, setAspect] = useState("16:9");
  const [resolution, setResolution] = useState("720p");
  const [subtitles, setSubtitles] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [disclosure, setDisclosure] = useState(false);

  const job = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => getJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (q) => {
      const s = q.state.data?.state;
      return s && ["PENDING", "QUEUED", "PROCESSING"].includes(s) ? 2000 : false;
    },
  });
  const outputAssetId = job.data?.outputAssetId;
  const jobState = job.data?.state;

  useEffect(() => {
    if (jobState === "COMPLETED" && outputAssetId && !videoUrl) {
      void getAssetAccessUrl(outputAssetId).then(({ url }) => {
        setVideoUrl(url.startsWith("http") ? url : `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}${url}`);
      });
    }
  }, [jobState, outputAssetId, videoUrl]);

  const genMutation = useMutation({
    mutationFn: () =>
      createVideoJob({
        voiceProfileId: voiceId, faceProfileId: faceId, script, language,
        aspectRatio: aspect, resolution, subtitles,
      }),
    onSuccess: (d) => { setJobId(d.id); setVideoUrl(null); },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelJob(jobId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job", jobId] }),
  });

  const canGenerate = !!voiceId && !!faceId && script.trim().length > 0 && script.length <= VIDEO_LIMITS.maxChars && disclosure;
  const jobActive = jobState && ["PENDING", "QUEUED", "PROCESSING"].includes(jobState);
  const mockOutput = job.data?.input && typeof job.data.input === "object" && (job.data.input as { faceMock?: boolean }).faceMock;

  return (
    <div>
      <PageHeader
        title="Video Studio"
        description="Generate a personalized talking-head video from your voice and face profiles."
        actions={<Badge tone="yellow">Talking-face model: coming soon</Badge>}
      />
      <Alert tone="amber" >
        Real <strong>lip-synced</strong> talking-head generation is <strong>coming soon</strong> — the studio is disabled until a verified
        lip-sync model (SadTalker/Wav2Lip-class) is configured. Speech generation in Voice Studio is fully functional.
      </Alert>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Form */}
        <Card className="lg:col-span-3 opacity-70">
          <CardHeader><h2 className="text-sm font-semibold">New video <Badge tone="yellow" className="ml-2">Coming soon</Badge></h2></CardHeader>
          <CardBody className="space-y-5">
          <fieldset disabled className="contents">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="vv">Voice profile</Label>
                <Select id="vv" value={voiceId} onChange={(e) => setVoiceId(e.target.value)}>
                  <option value="">Select voice…</option>
                  {(voices.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="vf">Face profile</Label>
                <Select id="vf" value={faceId} onChange={(e) => setFaceId(e.target.value)}>
                  <option value="">Select face…</option>
                  {(faces.data ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </Select>
              </div>
            </div>
            {(voices.data ?? []).length === 0 && <Alert tone="amber">Create a voice profile in <a href="/voice-studio" className="underline">Voice Studio</a> first.</Alert>}
            {(faces.data ?? []).length === 0 && <Alert tone="amber">Create a face profile in <a href="/face-studio" className="underline">Face Studio</a> first.</Alert>}

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="script">Script</Label>
                <span className={cn("text-xs tabular-nums", script.length > VIDEO_LIMITS.maxChars ? "text-red-400" : "text-text-muted")}>
                  {script.length}/{VIDEO_LIMITS.maxChars}
                </span>
              </div>
              <Textarea id="script" value={script} onChange={(e) => setScript(e.target.value)} placeholder="Write the script your twin will say…" />
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <Label>Language</Label>
                <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {SUPPORTED_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                </Select>
              </div>
              <div>
                <Label>Aspect</Label>
                <Select value={aspect} onChange={(e) => setAspect(e.target.value)}>
                  {ASPECT_RATIOS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </Select>
              </div>
              <div>
                <Label>Resolution</Label>
                <Select value={resolution} onChange={(e) => setResolution(e.target.value)}>
                  {VIDEO_RESOLUTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </Select>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm text-text-muted">
                  <input type="checkbox" checked={subtitles} onChange={(e) => setSubtitles(e.target.checked)} className="accent-accent" />
                  Subtitles
                </label>
              </div>
            </div>

            <label className="flex items-start gap-2.5 rounded-lg border border-border bg-bg-secondary p-3 text-sm">
              <input type="checkbox" checked={disclosure} onChange={(e) => setDisclosure(e.target.checked)} className="mt-0.5 accent-accent" />
              <span className="text-text-muted">
                I confirm I have the right to use this voice and face, and I understand the output is <strong className="text-text">synthetic media</strong> of my digital twin.
              </span>
            </label>

            <div className="flex items-center gap-3">
              <Button onClick={() => genMutation.mutate()} loading={genMutation.isPending} disabled={!canGenerate || !!jobActive} title="Talking-face model coming soon">
                <Clapperboard className="h-4 w-4" /> Generate video <Badge tone="yellow" className="ml-1">soon</Badge>
              </Button>
              {jobActive && jobId && (
                <Button variant="secondary" onClick={() => cancelMutation.mutate()}>Cancel job</Button>
              )}
            </div>
            {genMutation.isError && <Alert>{(genMutation.error as Error).message}</Alert>}
          </fieldset>
          </CardBody>
        </Card>

        {/* Preview / progress */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><h2 className="text-sm font-semibold">Generation</h2></CardHeader>
            <CardBody>
              {!jobId ? (
                <EmptyState icon={<Clapperboard className="h-8 w-8" />} title="No job yet" description="Configure your video and press Generate." />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs text-text-muted">{jobId.slice(0, 8)}…</span>
                    <Badge tone={jobState === "COMPLETED" ? "green" : jobState === "FAILED" ? "red" : jobState === "CANCELLED" ? "neutral" : "accent"}>
                      {jobState?.toLowerCase()}
                    </Badge>
                  </div>
                  <Progress value={job.data?.progress ?? 0} />
                  <p className="text-xs text-text-muted">{jobState === "PROCESSING" ? "Running local inference — this can take several minutes on CPU." : jobState === "QUEUED" ? "Waiting for a worker…" : ""}</p>
                  {job.data?.error && <Alert>{job.data.error}</Alert>}
                  {mockOutput && <p className="flex items-center gap-1.5 text-xs text-amber-400"><AlertTriangle className="h-3.5 w-3.5" /> Mock renderer output — not real talking-face inference.</p>}
                  {videoUrl && (
                    <div className="space-y-2">
                      <video src={videoUrl} controls className="w-full rounded-lg border border-border bg-black" />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-amber-400">Synthetic media — generated digital twin</span>
                        <a href={videoUrl} download="echoself-video.mp4">
                          <Button variant="secondary"><Download className="h-4 w-4" /> Download MP4</Button>
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="text-sm font-semibold">Pipeline</h2></CardHeader>
            <CardBody className="space-y-2 text-sm text-text-muted">
              {["Verify voice & face ownership", "Check consents", "Queue job (BullMQ)", "Synthesize speech (local TTS)", "Generate talking-face frames", "Render MP4 (FFmpeg)", "Store in private R2"].map((s, i) => (
                <div key={s} className="flex items-center gap-3">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-card text-[10px] text-text-muted">{i + 1}</span>
                  {s}
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
