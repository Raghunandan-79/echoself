"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthLayout } from "@/components/auth-card";
import { Button, Input, Label, FieldError, Alert } from "@/components/ui";
import { useAuth } from "@/stores/auth";
import { ApiError } from "@/lib/api";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.email("Enter a valid email"),
  password: z.string().min(10, "At least 10 characters").regex(/[0-9]/, "Must contain a number").regex(/[a-zA-Z]/, "Must contain a letter"),
});
type Form = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuth((s) => s.register);
  const [error, setError] = useState<string | null>(null);
  const { register: reg, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) });

  async function onSubmit(data: Form) {
    setError(null);
    try {
      await register(data.email, data.password, data.name);
      router.replace("/dashboard");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Registration failed");
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="Your digital twin starts here">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" autoComplete="name" {...reg("name")} />
          <FieldError>{errors.name?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...reg("email")} />
          <FieldError>{errors.email?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" {...reg("password")} />
          <FieldError>{errors.password?.message}</FieldError>
          <p className="mt-1 text-xs text-text-muted">Min 10 characters with a letter and a number.</p>
        </div>
        <Button type="submit" loading={isSubmitting} className="w-full">Create account</Button>
      </form>
      <p className="mt-4 text-center text-sm text-text-muted">
        Already have an account? <Link href="/login" className="text-accent-soft hover:underline">Log in</Link>
      </p>
    </AuthLayout>
  );
}
