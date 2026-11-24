"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ContactRound, AudioLines, ScanFace, ArrowRight } from "lucide-react";
import Link from "next/link";
import { PageHeader, Card, CardHeader, Badge, Skeleton, EmptyState, Button } from "@/components/ui";
import { listVoices, listFaces } from "@/services/api";

export default function IdentitiesPage() {
  const qc = useQueryClient();
  const voices = useQuery({ queryKey: ["voices"], queryFn: listVoices });
  const faces = useQuery({ queryKey: ["faces"], queryFn: listFaces });

  return (
    <div>
      <PageHeader title="Identities" description="Your reusable voice and face profiles — the building blocks of your digital twin." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AudioLines className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold">Voice profiles</h2>
            </div>
            <Link href="/voice-studio"><Button variant="ghost"><ArrowRight className="h-4 w-4" /></Button></Link>
          </CardHeader>
          <div className="divide-y divide-border">
            {voices.isLoading && <div className="p-5"><Skeleton className="h-12" /></div>}
            {(voices.data ?? []).map((v) => (
              <div key={v.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm font-medium">{v.name}</div>
                  <div className="text-xs text-text-muted">{v.language ?? "auto"} · created {new Date(v.createdAt).toLocaleDateString()}</div>
                </div>
                <Badge tone={v.status === "ACTIVE" ? "green" : "neutral"}>{v.status.toLowerCase()}</Badge>
              </div>
            ))}
            {!voices.isLoading && (voices.data ?? []).length === 0 && (
              <div className="p-5"><EmptyState title="No voices" description="Create one in Voice Studio." /></div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScanFace className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-semibold">Face profiles</h2>
            </div>
            <Link href="/face-studio"><Button variant="ghost"><ArrowRight className="h-4 w-4" /></Button></Link>
          </CardHeader>
          <div className="divide-y divide-border">
            {faces.isLoading && <div className="p-5"><Skeleton className="h-12" /></div>}
            {(faces.data ?? []).map((f) => (
              <div key={f.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm font-medium">{f.name}</div>
                  <div className="text-xs text-text-muted">created {new Date(f.createdAt).toLocaleDateString()}</div>
                </div>
                <Badge tone={f.status === "ACTIVE" ? "green" : "neutral"}>{f.status.toLowerCase()}</Badge>
              </div>
            ))}
            {!faces.isLoading && (faces.data ?? []).length === 0 && (
              <div className="p-5"><EmptyState title="No faces" description="Create one in Face Studio." /></div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
