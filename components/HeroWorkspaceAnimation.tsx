"use client";

import { Check, Linkedin, Sparkles } from "lucide-react";

/**
 * Hero illustration for Kruti.io — a self-contained, dependency-light animated
 * "content workspace" that loops through the product story in ~12s:
 *   A. Connect & analyse your LinkedIn voice  (scan sweep + voice bars)
 *   B. Strategy + generate 30 posts           (pillars fan in, rows type in)
 *   C. Schedule & auto-publish                (calendar dots, "Published ✓")
 *
 * Pure SVG/DOM + CSS keyframes — transform/opacity only (GPU-accelerated).
 * No canvas, no JS animation library, no raster assets. ~0 KB extra payload.
 * Fixed aspect ratio (no CLS) and a prefers-reduced-motion static fallback.
 */
export default function HeroWorkspaceAnimation() {
  return (
    <div
      role="img"
      aria-label="Animated illustration: Kruti.io analyses your LinkedIn voice, builds a content strategy, generates 30 posts, schedules them on a calendar, and auto-publishes to LinkedIn."
      className="kw relative mx-auto w-full max-w-md"
    >
      {/* Fixed aspect ratio container prevents layout shift (CLS) */}
      <div className="kw-card relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_-28px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/[0.04]">
        {/* ── Header (persistent) ─────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-white/10">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <span className="kw-node relative inline-flex h-5 w-5 items-center justify-center rounded-md bg-blue-600 text-[9px] font-bold text-white">
              AI
            </span>
            Content workspace
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
            <Sparkles className="h-3 w-3" /> 5 posts ready
          </span>
        </div>

        {/* ── Body: stacked scenes ─────────────────────────────── */}
        <div className="kw-body relative">
          {/* Scan line accent (Scene A) */}
          <span aria-hidden className="kw-scan pointer-events-none absolute inset-x-0 top-0 z-30 h-10" />

          {/* Scene A — Connect & analyse voice */}
          <div className="kw-sceneA absolute inset-0 flex flex-col items-center justify-center gap-4 px-7">
            <div className="flex w-full max-w-[230px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                <Linkedin className="h-4 w-4" />
              </span>
              <div className="flex-1 space-y-1.5">
                <span className="block h-2 w-3/4 rounded-full bg-slate-200 dark:bg-white/15" />
                <span className="block h-2 w-1/2 rounded-full bg-slate-100 dark:bg-white/10" />
              </div>
            </div>
            <div className="flex items-end gap-1" aria-hidden>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <span
                  key={i}
                  className="kw-voice w-1 rounded-full bg-blue-500/70"
                  style={{ height: "18px", animationDelay: `${i * 90}ms` }}
                />
              ))}
            </div>
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Learning your voice…</span>
          </div>

          {/* Scene B — Strategy + generate 30 posts */}
          <div className="kw-sceneB absolute inset-0 flex flex-col justify-center gap-3 px-6">
            <div className="flex flex-wrap gap-2" aria-hidden>
              {["Thought leadership", "Industry tips", "Founder stories"].map((p, i) => (
                <span
                  key={p}
                  className="kw-chip rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
                  style={{ animationDelay: `${4.3 + i * 0.18}s` }}
                >
                  {p}
                </span>
              ))}
            </div>
            <div className="space-y-2.5" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                  <span
                    className="kw-type block h-2.5 rounded-full bg-slate-200 dark:bg-white/15"
                    style={{ animationDelay: `${5 + i * 0.35}s` }}
                  />
                  <span className="h-5 w-7 flex-shrink-0 rounded-md bg-slate-100 dark:bg-white/10" />
                </div>
              ))}
            </div>
            <div className="kw-count mt-1 inline-flex w-fit items-center gap-1.5 self-center rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
              <Sparkles className="h-3 w-3" /> 30 posts generated
            </div>
          </div>

          {/* Scene C — Schedule & auto-publish */}
          <div className="kw-sceneC absolute inset-0 flex flex-col justify-center gap-4 px-6">
            <div className="grid grid-cols-5 gap-1.5" aria-hidden>
              {[
                { d: "M", c: "bg-orange-400" },
                { d: "T", c: "bg-violet-500" },
                { d: "W", c: "bg-blue-500" },
                { d: "T", c: "bg-violet-500" },
                { d: "F", c: "bg-emerald-500" },
              ].map((cell, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-slate-100 py-2 dark:border-white/10"
                >
                  <span className="text-[10px] font-medium text-slate-400">{cell.d}</span>
                  <span className={`kw-dot h-2 w-2 rounded-full ${cell.c}`} style={{ animationDelay: `${8.2 + i * 0.16}s` }} />
                </div>
              ))}
            </div>
            <div className="kw-publish flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white">
                <Linkedin className="h-4 w-4" />
              </span>
              <div className="flex-1 space-y-1.5">
                <span className="block h-2 w-4/5 rounded-full bg-emerald-200/80 dark:bg-emerald-400/30" />
                <span className="block h-2 w-1/2 rounded-full bg-emerald-200/60 dark:bg-emerald-400/20" />
              </div>
              <span className="kw-check inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                <Check className="h-3 w-3" /> Published
              </span>
            </div>
          </div>
        </div>

        {/* ── Footer (persistent) ─────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-2.5 text-xs text-slate-400 dark:border-white/10">
          <span>Mon-Fri · 9:00 AM</span>
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <Check className="h-3.5 w-3.5" /> Auto-publishing on
          </span>
        </div>
      </div>

      {/* Self-contained, GPU-accelerated keyframes (transform/opacity only). */}
      <style dangerouslySetInnerHTML={{ __html: KW_STYLES }} />
    </div>
  );
}

const KW_STYLES = `
.kw-card { will-change: transform; }
.kw-body { height: 232px; }
@media (min-width: 640px) { .kw-body { height: 268px; } }

/* Scene crossfades on one shared 12s master clock (seamless loop) */
.kw-sceneA { animation: kw-sceneA 12s ease-in-out infinite; }
.kw-sceneB { animation: kw-sceneB 12s ease-in-out infinite; }
.kw-sceneC { animation: kw-sceneC 12s ease-in-out infinite; }
@keyframes kw-sceneA { 0%{opacity:1;transform:translateY(0)} 28%{opacity:1;transform:translateY(0)} 33%{opacity:0;transform:translateY(-8px)} 95%{opacity:0;transform:translateY(8px)} 100%{opacity:1;transform:translateY(0)} }
@keyframes kw-sceneB { 0%,30%{opacity:0;transform:translateY(8px)} 35%{opacity:1;transform:translateY(0)} 62%{opacity:1;transform:translateY(0)} 67%{opacity:0;transform:translateY(-8px)} 100%{opacity:0} }
@keyframes kw-sceneC { 0%,63%{opacity:0;transform:translateY(8px)} 68%{opacity:1;transform:translateY(0)} 94%{opacity:1;transform:translateY(0)} 99%{opacity:0;transform:translateY(-8px)} 100%{opacity:0} }

/* Header AI node — gentle continuous pulse */
.kw-node::after { content:""; position:absolute; inset:0; border-radius:6px; box-shadow:0 0 0 0 rgba(37,99,235,.5); animation: kw-pulse 2.4s ease-out infinite; }
@keyframes kw-pulse { 0%{box-shadow:0 0 0 0 rgba(37,99,235,.45)} 70%,100%{box-shadow:0 0 0 7px rgba(37,99,235,0)} }

/* Scan line sweep (Scene A window) */
.kw-scan { background: linear-gradient(180deg, transparent, rgba(37,99,235,.18), transparent); animation: kw-scan 12s ease-in-out infinite; }
@keyframes kw-scan { 0%{opacity:0;transform:translateY(-40px)} 4%{opacity:1} 24%{opacity:1;transform:translateY(220px)} 30%,100%{opacity:0;transform:translateY(220px)} }

/* Voice bars (Scene A) */
.kw-voice { transform-origin:bottom; animation: kw-voice 1s ease-in-out infinite; }
@keyframes kw-voice { 0%,100%{transform:scaleY(.4)} 50%{transform:scaleY(1)} }

/* Pillar chips fan-in (Scene B) */
.kw-chip { opacity:0; animation: kw-chip 12s ease-out infinite; }
@keyframes kw-chip { 0%,34%{opacity:0;transform:translateY(6px) scale(.92)} 40%,60%{opacity:1;transform:translateY(0) scale(1)} 67%,100%{opacity:0} }

/* Text rows "type in" (Scene B) */
.kw-type { width:0; animation: kw-type 12s ease-out infinite; }
@keyframes kw-type { 0%,40%{width:0} 52%{width:70%} 60%{width:65%} 67%,100%{width:0} }

/* "30 posts" badge pop (Scene B) */
.kw-count { opacity:0; animation: kw-count 12s ease-out infinite; }
@keyframes kw-count { 0%,56%{opacity:0;transform:scale(.8)} 60%{opacity:1;transform:scale(1.06)} 63%{transform:scale(1)} 66%{opacity:1} 67%,100%{opacity:0} }

/* Calendar status dots pop (Scene C) */
.kw-dot { transform:scale(0); animation: kw-dot 12s ease-out infinite; }
@keyframes kw-dot { 0%,68%{transform:scale(0)} 74%{transform:scale(1.25)} 78%,96%{transform:scale(1)} 100%{transform:scale(1)} }

/* Publish card lift + check (Scene C) */
.kw-publish { animation: kw-publish 12s ease-out infinite; }
@keyframes kw-publish { 0%,80%{transform:translateY(6px);opacity:.55} 86%{transform:translateY(0);opacity:1} 96%{opacity:1} 100%{opacity:1} }
.kw-check { transform:scale(0); animation: kw-check 12s ease-out infinite; }
@keyframes kw-check { 0%,86%{transform:scale(0)} 91%{transform:scale(1.18)} 95%,100%{transform:scale(1)} }

/* Reduced-motion: freeze on the populated workspace, no motion */
@media (prefers-reduced-motion: reduce) {
  .kw-sceneA, .kw-scan, .kw-voice { opacity: 0 !important; animation: none !important; }
  .kw-sceneC { opacity: 0 !important; animation: none !important; }
  .kw-sceneB { opacity: 1 !important; animation: none !important; transform: none !important; }
  .kw-chip, .kw-count { opacity: 1 !important; animation: none !important; transform: none !important; }
  .kw-type { width: 68% !important; animation: none !important; }
  .kw-node::after { animation: none !important; }
}
`;
