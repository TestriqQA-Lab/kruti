"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Global navigation progress indicator.
 *
 * Shows a brand-colored top bar (plus a small spinner) the instant a user
 * starts navigating to another route, and completes it when the new route
 * renders. This gives immediate feedback so users don't think their click
 * "did nothing" and click repeatedly.
 *
 * Covers: <Link> / <a> clicks, programmatic router.push/replace (via the
 * History API), and browser back/forward (popstate). Same-page anchors,
 * external links, new-tab / modifier clicks and downloads are ignored.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";

  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(false);

  const stopTimers = useCallback(() => {
    if (trickle.current) {
      clearInterval(trickle.current);
      trickle.current = null;
    }
    if (safety.current) {
      clearTimeout(safety.current);
      safety.current = null;
    }
  }, []);

  const done = useCallback(() => {
    if (!active.current) return;
    active.current = false;
    stopTimers();
    setProgress(100);
    hideTimer.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 350);
  }, [stopTimers]);

  const start = useCallback(() => {
    if (active.current) return;
    active.current = true;
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    setVisible(true);
    setProgress(10);
    // Trickle towards 90% so the bar always feels alive while we wait.
    trickle.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p;
        const step = p < 40 ? 9 : p < 70 ? 4 : 1.5;
        return Math.min(90, p + Math.random() * step);
      });
    }, 240);
    // Safety net: never let the bar get stuck if a navigation is aborted.
    safety.current = setTimeout(() => done(), 12000);
  }, [done]);

  // Complete the bar whenever the route (path or query string) actually changes.
  useEffect(() => {
    done();
    // We intentionally react only to route changes here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  // Detect the start of a navigation.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as Element | null)?.closest?.("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      const target = anchor.getAttribute("target");
      if (!href) return;
      if (target && target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      if (/^(mailto:|tel:|sms:|blob:|javascript:)/i.test(href)) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Same page (e.g. hash-only link) is not a navigation.
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      start();
    };

    const onPopState = () => start();

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);

    // Patch the History API so router.push()/replace() also trigger the bar.
    const originalPush = window.history.pushState;
    window.history.pushState = function (
      this: History,
      ...args: Parameters<History["pushState"]>
    ) {
      const nextUrl = args[2];
      if (nextUrl != null) {
        try {
          const u = new URL(String(nextUrl), window.location.href);
          if (
            u.pathname !== window.location.pathname ||
            u.search !== window.location.search
          ) {
            start();
          }
        } catch {
          /* ignore malformed URLs */
        }
      }
      return originalPush.apply(this, args);
    };

    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      window.history.pushState = originalPush;
    };
  }, [start]);

  // Clean up any pending timers on unmount.
  useEffect(() => {
    return () => {
      stopTimers();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [stopTimers]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999]"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div
        className="h-[3px] bg-gradient-to-r from-[#004182] via-[#0A66C2] to-[#4da3ff] transition-[width] duration-200 ease-out"
        style={{
          width: `${progress}%`,
          boxShadow:
            "0 0 12px rgba(10,102,194,0.7), 0 0 6px rgba(10,102,194,0.55)",
        }}
      />
      <div className="fixed right-4 top-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#0A66C2]/25 border-t-[#0A66C2]" />
      </div>
    </div>
  );
}
