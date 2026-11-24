"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/stores/auth";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15_000 } } }));
  const refresh = useAuth((s) => s.refresh);
  const hydrated = useAuth((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) void refresh();
  }, [hydrated, refresh]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
