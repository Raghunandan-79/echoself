"use client";
import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthLayout } from "@/components/auth-card";
import { Button, Input, Label, FieldError, Alert } from "@/components/ui";
import { api } from "@/lib/api";

const schema = z.object({ email: z.email("Enter a valid email") });

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<{ email: string }>({ resolver: zodResolver(schema) });

  async function onSubmit(data: { email: string }) {
    setError(null);
    try {
      await api("/auth/forgot-password", { method: "POST", body: JSON.stringify(data), auth: false });
      setSent(true);
    } catch {
      setError("Something went wrong. Try again.");
    }
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a reset link">
      {sent ? (
        <Alert tone="accent">If an account exists for that email, a reset link is on its way. Check your inbox (and spam folder).</Alert>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && <Alert>{error}</Alert>}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} />
          </div>
          <Button type="submit" loading={isSubmitting} className="w-full">Send reset link</Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm text-text-muted">
        <Link href="/login" className="text-accent-soft hover:underline">Back to log in</Link>
      </p>
    </AuthLayout>
  );
}
