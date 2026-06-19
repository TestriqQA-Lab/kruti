"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  BarChart3,
  Users,
  CreditCard,
  FileText,
  Server,
  LineChart,
  LogOut,
  ArrowLeft,
  Shield,
  Eye,
  EyeOff,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

const adminNavItems = [
  { href: "/admin", label: "Overview", icon: BarChart3, exact: true },
  { href: "/admin/users", label: "Users", icon: Users, exact: false },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard, exact: false },
  { href: "/admin/content", label: "Content Stats", icon: FileText, exact: false },
  { href: "/admin/analytics", label: "Usage & Cost", icon: LineChart, exact: false },
  { href: "/admin/system", label: "System", icon: Server, exact: false },
];

interface AdminSidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  imagePromptsRevealUntil?: string | null;
}

export default function AdminSidebar({ user, imagePromptsRevealUntil = null }: AdminSidebarProps) {
  const pathname = usePathname();

  // Privacy toggle: reveal user image thumbnails + prompts in analytics for a window.
  const [revealUntil] = useState<string | null>(imagePromptsRevealUntil);
  const [now, setNow] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Tick for the countdown + auto-expiry. Client-only init avoids hydration mismatch.
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const revealMs = revealUntil ? Date.parse(revealUntil) : NaN;
  const active = !Number.isNaN(revealMs) && (now === null || revealMs > now);

  function remainingLabel(): string {
    if (now === null || Number.isNaN(revealMs)) return "Visible";
    const ms = revealMs - now;
    if (ms <= 0) return "Expiring…";
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
  }

  async function setReveal(action: "enable" | "disable", hours?: 24 | 48) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/settings/image-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "enable" ? { action, hours } : { action }),
      });
      if (!res.ok) {
        setBusy(false);
        return;
      }
      setModalOpen(false);
      // Reload so analytics reflects the new privacy state immediately (server-gated).
      window.location.reload();
    } catch {
      setBusy(false);
    }
  }

  function onToggle() {
    if (busy) return;
    if (active) setReveal("disable");
    else setModalOpen(true);
  }

  return (
    <>
      <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
          <div className="flex flex-col gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Kruti.io" className="h-10 w-auto" />
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Admin Panel
              </span>
            </div>
          </div>
        </div>

        {/* User */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            {user.image ? (
              <Image src={user.image} alt={user.name ?? "Admin"} width={36} height={36} className="rounded-full" />
            ) : (
              <div className="w-9 h-9 bg-red-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                {user.name?.[0] ?? "A"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user.name}</p>
              <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">
                Admin
              </span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {adminNavItems.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200"
                )}
              >
                <item.icon className={cn("w-4 h-4", active ? "text-red-700 dark:text-red-400" : "")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Privacy: reveal user image thumbnails + prompts in analytics */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {active ? (
                <Eye className="w-4 h-4 text-amber-500 flex-shrink-0" />
              ) : (
                <EyeOff className="w-4 h-4 text-gray-400 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">User media</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                  {active ? remainingLabel() : "Hidden in analytics"}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={active}
              aria-label="Show user images and prompts in analytics"
              disabled={busy}
              onClick={onToggle}
              className={cn(
                "relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
                active ? "bg-amber-500" : "bg-gray-300 dark:bg-gray-700"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                  active ? "translate-x-4" : "translate-x-0.5"
                )}
              />
            </button>
          </div>
        </div>

        {/* Bottom */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-800 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 transition-colors w-full"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Reveal-window modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => !busy && setModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-500" /> Show user media
              </h3>
              <button
                onClick={() => !busy && setModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              For how long should user image thumbnails &amp; prompts be visible in analytics? They hide again
              automatically when the window ends.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[24, 48].map((h) => (
                <button
                  key={h}
                  type="button"
                  disabled={busy}
                  onClick={() => setReveal("enable", h as 24 | 48)}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl border border-gray-200 dark:border-gray-700 py-4 hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-60 transition-colors"
                >
                  <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{h}h</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{h === 24 ? "1 day" : "2 days"}</span>
                </button>
              ))}
            </div>
            {busy && (
              <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Applying…
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
