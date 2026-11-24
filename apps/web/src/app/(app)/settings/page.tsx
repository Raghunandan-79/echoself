"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ShieldCheck, Trash2, UserCog, KeyRound } from "lucide-react";
import { PageHeader, Card, CardHeader, CardBody, Button, Input, Label, Badge, Alert } from "@/components/ui";
import { listConsents, grantConsent, revokeConsent, updateMe, deleteMe, getMe } from "@/services/api";
import { CONSENT_SCOPES, type ConsentScope } from "@echoself/shared/constants";
import { useAuth } from "@/stores/auth";
import { api } from "@/lib/api";

const SCOPE_LABELS: Record<ConsentScope, { title: string; desc: string }> = {
  voice_cloning: { title: "Voice cloning", desc: "Create a synthetic voice from your reference audio." },
  face_animation: { title: "Face animation", desc: "Animate your face reference in generated videos." },
  biometric_storage: { title: "Biometric storage", desc: "Store voice/face references in private object storage." },
  external_processing: { title: "External processing", desc: "Allow references to be processed by configured AI services." },
};

export default function SettingsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { user, logout } = useAuth();
  const me = useQuery({ queryKey: ["me"], queryFn: getMe });
  const consents = useQuery({ queryKey: ["consents"], queryFn: listConsents });

  const [name, setName] = useState("");
  const [nameMsg, setNameMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  const latestByScope = new Map<string, NonNullable<typeof consents.data>[number]>();
  for (const c of consents.data ?? []) if (!latestByScope.has(c.scope)) latestByScope.set(c.scope, c);

  const consentMutation = useMutation({
    mutationFn: ({ scope, granted }: { scope: ConsentScope; granted: boolean }) => grantConsent(scope, granted),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consents"] }),
  });
  const revokeMutation = useMutation({
    mutationFn: revokeConsent,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consents"] }),
  });
  const nameMutation = useMutation({
    mutationFn: () => updateMe(name || null),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["me"] }); setNameMsg("Saved."); },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteMe,
    onSuccess: async () => { await logout(); router.replace("/"); },
  });
  const resetMutation = useMutation({
    mutationFn: async () => {
      await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: user?.email }), auth: false });
    },
    onSuccess: () => setResetMsg("If the account exists, a reset link was sent. Check server logs in development."),
  });

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="Profile, privacy consents and account controls." />

      <div className="space-y-6">
        <Card>
          <CardHeader><h2 className="flex items-center gap-2 text-sm font-semibold"><UserCog className="h-4 w-4" /> Profile</h2></CardHeader>
          <CardBody className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email ?? ""} disabled />
            </div>
            <div>
              <Label htmlFor="name">Display name</Label>
              <div className="flex gap-2">
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={user?.name ?? "Your name"} />
                <Button variant="secondary" onClick={() => nameMutation.mutate()} loading={nameMutation.isPending}>Save</Button>
              </div>
              {nameMsg && <p className="mt-1 text-xs text-emerald-400">{nameMsg}</p>}
            </div>
            <div>
              <Label>Password</Label>
              <Button variant="secondary" onClick={() => resetMutation.mutate()} loading={resetMutation.isPending}>
                <KeyRound className="h-4 w-4" /> Send password reset email
              </Button>
              {resetMsg && <p className="mt-1 text-xs text-text-muted">{resetMsg}</p>}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4" /> Privacy & consent</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-text-muted">
              Biometric generation is blocked server-side unless the relevant consent is active. Revoking consent prevents new jobs; deleting data removes stored objects.
            </p>
            {CONSENT_SCOPES.map((scope) => {
              const c = latestByScope.get(scope);
              const active = !!c?.granted && !c.revokedAt;
              return (
                <div key={scope} className="flex items-center justify-between rounded-lg border border-border bg-bg-secondary px-4 py-3">
                  <div>
                    <div className="text-sm font-medium">{SCOPE_LABELS[scope].title}</div>
                    <div className="text-xs text-text-muted">{SCOPE_LABELS[scope].desc}</div>
                    {c && <div className="mt-0.5 text-[11px] text-text-muted">v{c.version} · {new Date(c.createdAt).toLocaleDateString()}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={active ? "green" : "neutral"}>{active ? "active" : "inactive"}</Badge>
                    {active ? (
                      <Button variant="danger" onClick={() => c && revokeMutation.mutate(c.id)}>Revoke</Button>
                    ) : (
                      <Button variant="secondary" onClick={() => consentMutation.mutate({ scope, granted: true })}>Grant</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>

        <Card className="border-red-500/30">
          <CardHeader><h2 className="flex items-center gap-2 text-sm font-semibold text-red-400"><Trash2 className="h-4 w-4" /> Danger zone</h2></CardHeader>
          <CardBody className="space-y-4">
            <p className="text-sm text-text-muted">
              Account deletion permanently removes your profile, all voice/face profiles, every stored media object, conversations and sessions.
            </p>
            {!confirmDelete ? (
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete account…</Button>
            ) : (
              <div className="space-y-3 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
                <Alert tone="red">This cannot be undone. Type <strong>DELETE</strong> to confirm.</Alert>
                <Input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} placeholder="DELETE" />
                <div className="flex gap-2">
                  <Button variant="danger" disabled={deleteText !== "DELETE"} loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
                    Permanently delete
                  </Button>
                  <Button variant="ghost" onClick={() => { setConfirmDelete(false); setDeleteText(""); }}>Cancel</Button>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
