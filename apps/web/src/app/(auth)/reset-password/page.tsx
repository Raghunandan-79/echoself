"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthLayout } from "@/components/auth-card";
import { Button, Input, Label, FieldError, Alert } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

const schema = z.object({
  password: z.string().min(10, "At least 10 characters").regex(/[0-9]/, "Must contain a number").regex(/[a-zA-Z]/, "Must contain a letter"),
});

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ password: string }>({ resolver: zodResolver(schema) });

  async function onSubmit(data: { password: string }) {
    setError(null);
    try {
      await api("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password: data.password }), auth: false });
      setDone(true);
      setTimeout(() => router.replace("/login"), 2000);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Reset failed");
    }
  }

  if (!token) return <Alert>This reset link is missing its token.</Alert>;
  if (done) return <Alert tone="accent">Password updated. Redirecting to log in…</Alert>;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <div>
        <Label htmlFor="password">New password</Label>
        <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
        <FieldError>{errors.password?.message}</FieldError>
      </div>
      <Button type="submit" loading={isSubmitting} className="w-full">Update password</Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout title="Choose a new password" subtitle="Must be at least 10 characters">
      <Suspense fallback={null}>
        <ResetForm />
      </Suspense>
      <p className="mt-4 text-center text-sm text-text-muted">
        <Link href="/login" className="text-accent-soft hover:underline">Back to log in</Link>
      </p>
    </AuthLayout>
  );
}
