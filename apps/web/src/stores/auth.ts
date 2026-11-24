"use client";
import { create } from "zustand";
import { api, setAccessToken } from "@/lib/api";
import type { AuthUser } from "@echoself/shared/types";

interface AuthState {
  user: AuthUser | null;
  hydrated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
  setUser: (u: AuthUser | null) => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  hydrated: false,
  async login(email, password) {
    const data = await api<{ accessToken: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      auth: false,
    });
    setAccessToken(data.accessToken);
    set({ user: data.user, hydrated: true });
  },
  async register(email, password, name) {
    const data = await api<{ accessToken: string; user: AuthUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
      auth: false,
    });
    setAccessToken(data.accessToken);
    set({ user: data.user, hydrated: true });
  },
  async logout() {
    try {
      await api("/auth/logout", { method: "POST", auth: false });
    } finally {
      setAccessToken(null);
      set({ user: null });
    }
  },
  async refresh() {
    try {
      const data = await api<{ accessToken: string; user: AuthUser }>("/auth/refresh", { method: "POST", auth: false });
      setAccessToken(data.accessToken);
      set({ user: data.user, hydrated: true });
      return true;
    } catch {
      setAccessToken(null);
      set({ user: null, hydrated: true });
      return false;
    }
  },
  setUser(u) {
    set({ user: u, hydrated: true });
  },
}));
