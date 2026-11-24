"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, AudioLines, ScanFace, Clapperboard, Bot,
  Images, ContactRound, Settings, LogOut, AudioWaveform,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/voice-studio", label: "Voice Studio", icon: AudioLines },
  { href: "/face-studio", label: "Face Studio", icon: ScanFace },
  { href: "/video-studio", label: "Video Studio", icon: Clapperboard },
  { href: "/echobot", label: "EchoBot", icon: Bot },
  { href: "/gallery", label: "Gallery", icon: Images },
  { href: "/identities", label: "Identities", icon: ContactRound },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-border bg-bg-secondary">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
          <AudioWaveform className="h-4.5 w-4.5 text-white" />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight">EchoSelf</div>
          <div className="text-[11px] text-text-muted">digital twin studio</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active ? "bg-accent/15 text-accent-soft font-medium" : "text-text-muted hover:bg-card hover:text-text",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3">
        <div className="mb-2 truncate px-2 text-xs text-text-muted">{user?.email}</div>
        <button
          onClick={() => void logout().then(() => (window.location.href = "/"))}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-muted transition-colors hover:bg-card hover:text-text"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
