"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Image as ImageIcon,
  FileText,
  IndianRupee,
  TrendingUp,
  Calculator,
  Lightbulb,
  Search,
  Download,
  Copy,
  Check,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UsageReport, DailyRecord } from "@/lib/usage-analytics";

/** Local INR formatter (kept client-side so no server-only module is bundled). */
function formatInr(amount: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits,
  }).format(Number.isFinite(amount) ? amount : 0);
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const dayKey = (ms: number) => new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
const DAY = 24 * 60 * 60 * 1000;

type Metric = "images" | "content" | "cost";

const METRIC_META: Record<Metric, { label: string; bar: string }> = {
  images: { label: "Images", bar: "bg-indigo-500" },
  content: { label: "Content", bar: "bg-emerald-500" },
  cost: { label: "Cost ₹", bar: "bg-amber-500" },
};

export default function AdminAnalyticsClient({
  initialReport,
  initialStart,
  initialEnd,
}: {
  initialReport: UsageReport;
  initialStart: string;
  initialEnd: string;
}) {
  const [report, setReport] = useState<UsageReport>(initialReport);
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [appliedRange, setAppliedRange] = useState({ start: initialStart, end: initialEnd });
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("images");
  const [promptSearch, setPromptSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<"today" | "7d" | "30d" | "month" | null>("30d");
  const [promptLimit, setPromptLimit] = useState(24);

  const applyRange = useCallback(
    async (from: string, to: string) => {
      setLoading(true);
      setErrMsg(null);
      try {
        const res = await fetch(`/api/admin/analytics?from=${from}&to=${to}`);
        const data = await res.json();
        if (!res.ok) {
          setErrMsg(data?.error || "Failed to load analytics");
          // Keep the controls consistent with the data still on screen.
          setStart(appliedRange.start);
          setEnd(appliedRange.end);
          return;
        }
        setReport(data as UsageReport);
        setStart(data.start);
        setEnd(data.end);
        setAppliedRange({ start: data.start, end: data.end });
        setPromptLimit(24);
      } catch {
        setErrMsg("Failed to load analytics. Please try again.");
        setStart(appliedRange.start);
        setEnd(appliedRange.end);
      } finally {
        setLoading(false);
      }
    },
    [appliedRange]
  );

  const applyPreset = useCallback(
    (preset: "today" | "7d" | "30d" | "month") => {
      const now = Date.now();
      const today = dayKey(now);
      let from = today;
      if (preset === "7d") from = dayKey(now - 6 * DAY);
      else if (preset === "30d") from = dayKey(now - 29 * DAY);
      else if (preset === "month") from = `${today.slice(0, 7)}-01`;
      setActivePreset(preset);
      setStart(from);
      setEnd(today);
      applyRange(from, today);
    },
    [applyRange]
  );

  const t = report.totals;
  const avgCostPerPost = t.content > 0 ? t.totalCostInr / t.content : null;
  // Extrapolate from days that actually had spend, not calendar days (a single busy
  // day or a range padded with empty days would otherwise distort the projection).
  const activeDays = report.daily.filter((d) => d.totalCostInr > 0).length;
  const projectedMonthly = activeDays > 0 ? (t.totalCostInr / activeDays) * 30 : 0;
  const totalPostsCohort = t.draft + t.ready + t.published;

  const kpis = [
    { label: "Images Generated", value: String(t.images), icon: ImageIcon, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-900/30" },
    { label: "Content Generated", value: String(t.content), icon: FileText, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/30", sub: `${t.strategies} strategies` },
    { label: "Total Cost", value: formatInr(t.totalCostInr), icon: IndianRupee, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/30" },
    { label: "Image Cost", value: formatInr(t.imageCostInr), icon: ImageIcon, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-900/30" },
    { label: "Content Cost", value: formatInr(t.contentCostInr), icon: FileText, color: "text-cyan-600", bg: "bg-cyan-50 dark:bg-cyan-900/30" },
    { label: "Avg Cost / Post", value: avgCostPerPost === null ? "—" : formatInr(avgCostPerPost), icon: Calculator, color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-900/30" },
    { label: "Projected / Month", value: activeDays > 0 ? formatInr(projectedMonthly) : "—", icon: TrendingUp, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/30", sub: activeDays > 0 ? `from ${activeDays} active day${activeDays === 1 ? "" : "s"}` : "no activity" },
    { label: "Strategies", value: String(t.strategies), icon: Lightbulb, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/30" },
  ];

  const maxMetric = useMemo(() => {
    const vals = report.daily.map((d) => metricValue(d, metric));
    return Math.max(1, ...vals);
  }, [report.daily, metric]);

  const labelStep = Math.max(1, Math.ceil(report.daily.length / 12));

  const filteredPrompts = useMemo(() => {
    const q = promptSearch.trim().toLowerCase();
    if (!q) return report.prompts;
    return report.prompts.filter((p) => p.prompt.toLowerCase().includes(q));
  }, [report.prompts, promptSearch]);

  function metricValue(d: DailyRecord, m: Metric): number {
    return m === "images" ? d.images : m === "content" ? d.content : d.totalCostInr;
  }

  function copyPrompt(id: string, text: string) {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
  }

  function downloadCsv() {
    const header = ["Date", "Images", "Content", "Draft", "Ready", "Published", "Strategies", "Image Cost INR", "Content Cost INR", "Total Cost INR"];
    const rows = report.daily.map((d) => [
      d.date, d.images, d.content, d.draft, d.ready, d.published, d.strategies,
      d.imageCostInr.toFixed(2), d.contentCostInr.toFixed(2), d.totalCostInr.toFixed(2),
    ]);
    rows.push([
      "TOTAL", t.images, t.content, t.draft, t.ready, t.published, t.strategies,
      t.imageCostInr.toFixed(2), t.contentCostInr.toFixed(2), t.totalCostInr.toFixed(2),
    ]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kruti-usage_${appliedRange.start}_to_${appliedRange.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const card = "bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Usage &amp; Cost Analytics</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Daily image &amp; content generation and estimated cost (INR) &middot; platform-wide
          </p>
        </div>
        <button
          onClick={() => applyRange(appliedRange.start, appliedRange.end)}
          disabled={loading}
          className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-60 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </button>
      </div>

      {/* Date range controls */}
      <div className={cn(card, "p-4")}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap gap-1.5">
            {([
              ["today", "Today"],
              ["7d", "Last 7 days"],
              ["30d", "Last 30 days"],
              ["month", "This month"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => applyPreset(key)}
                disabled={loading}
                className={cn(
                  "text-xs font-medium px-3 py-1.5 rounded-full border transition-colors disabled:opacity-60",
                  activePreset === key
                    ? "border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                    : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <label className="text-xs text-gray-500 dark:text-gray-400">
              <span className="block mb-1">Start</span>
              <input
                type="date"
                value={start}
                max={end}
                aria-label="Start date"
                onChange={(e) => {
                  setStart(e.target.value);
                  setActivePreset(null);
                }}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              />
            </label>
            <label className="text-xs text-gray-500 dark:text-gray-400">
              <span className="block mb-1">End</span>
              <input
                type="date"
                value={end}
                min={start}
                aria-label="End date"
                onChange={(e) => {
                  setEnd(e.target.value);
                  setActivePreset(null);
                }}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
              />
            </label>
            <button
              onClick={() => {
                setActivePreset(null);
                applyRange(start, end);
              }}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-60 transition-colors"
            >
              Apply
            </button>
          </div>
          <div className="ml-auto text-xs text-gray-400 dark:text-gray-500 self-center">
            Showing <span className="font-medium text-gray-600 dark:text-gray-300">{appliedRange.start}</span> →{" "}
            <span className="font-medium text-gray-600 dark:text-gray-300">{appliedRange.end}</span> ({t.days} day{t.days === 1 ? "" : "s"})
          </div>
        </div>
        {errMsg && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{errMsg}</p>}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className={cn(card, "p-4")}>
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", k.bg)}>
              <k.icon className={cn("w-5 h-5", k.color)} />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{k.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{k.label}</p>
            {k.sub && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* Posts by status (range) */}
      <div className={cn(card, "p-5")}>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" /> Posts in range by status
        </h3>
        {totalPostsCohort === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No posts in this range</p>
        ) : (
          <>
            <div className="flex w-full h-3 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
              <div className="bg-gray-400 h-full" style={{ width: pct(t.draft, totalPostsCohort) }} title={`Draft: ${t.draft}`} />
              <div className="bg-amber-500 h-full" style={{ width: pct(t.ready, totalPostsCohort) }} title={`Ready: ${t.ready}`} />
              <div className="bg-green-500 h-full" style={{ width: pct(t.published, totalPostsCohort) }} title={`Published: ${t.published}`} />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3 text-sm">
              <StatusLegend color="bg-gray-400" label="Draft" count={t.draft} total={totalPostsCohort} />
              <StatusLegend color="bg-amber-500" label="Ready" count={t.ready} total={totalPostsCohort} />
              <StatusLegend color="bg-green-500" label="Published" count={t.published} total={totalPostsCohort} />
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-3">
              Posts grouped by their creation day (IST), split by current status.
            </p>
          </>
        )}
      </div>

      {/* Daily trend chart */}
      <div className={cn(card, "p-5")}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-400" /> Daily activity
          </h3>
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            {(Object.keys(METRIC_META) as Metric[]).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={cn(
                  "text-xs font-medium px-2.5 py-1 rounded-md transition-colors",
                  metric === m
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                )}
              >
                {METRIC_META[m].label}
              </button>
            ))}
          </div>
        </div>
        {t.images + t.content + t.totalCostInr === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-10">No activity in this range</p>
        ) : (
          <>
            <div className="flex items-end gap-1 h-44">
              {report.daily.map((d) => {
                const v = metricValue(d, metric);
                const h = v > 0 ? Math.max(6, Math.round((v / maxMetric) * 150)) : 0;
                const valLabel = metric === "cost" ? formatInr(v) : String(v);
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center justify-end" title={`${d.date} · ${valLabel}`}>
                    <div className={cn("w-full rounded-t-sm", METRIC_META[metric].bar)} style={{ height: `${h}px` }} />
                  </div>
                );
              })}
            </div>
            <div className="flex gap-1 mt-2">
              {report.daily.map((d, i) => (
                <div key={d.date} className="flex-1 text-center text-[9px] text-gray-400 dark:text-gray-500 truncate">
                  {i % labelStep === 0 ? d.date.slice(5) : ""}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Daily breakdown table */}
      <div className={cn(card, "p-5")}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" /> Daily breakdown
          </h3>
          <button
            onClick={downloadCsv}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
        <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white dark:bg-gray-900">
              <tr className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800">
                <th className="text-left font-medium py-2 pr-3">Date</th>
                <th className="text-right font-medium py-2 px-2">Images</th>
                <th className="text-right font-medium py-2 px-2">Content</th>
                <th className="text-right font-medium py-2 px-2">Draft</th>
                <th className="text-right font-medium py-2 px-2">Ready</th>
                <th className="text-right font-medium py-2 px-2">Pub.</th>
                <th className="text-right font-medium py-2 px-2">Image ₹</th>
                <th className="text-right font-medium py-2 px-2">Content ₹</th>
                <th className="text-right font-medium py-2 pl-2">Total ₹</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {report.daily.map((d) => (
                  <tr key={d.date} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="py-2 pr-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{d.date}</td>
                    <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">{d.images || "—"}</td>
                    <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">{d.content || "—"}</td>
                    <td className="py-2 px-2 text-right text-gray-500 dark:text-gray-400">{d.draft || "—"}</td>
                    <td className="py-2 px-2 text-right text-gray-500 dark:text-gray-400">{d.ready || "—"}</td>
                    <td className="py-2 px-2 text-right text-gray-500 dark:text-gray-400">{d.published || "—"}</td>
                    <td className="py-2 px-2 text-right text-gray-600 dark:text-gray-300">{d.imageCostInr ? formatInr(d.imageCostInr) : "—"}</td>
                    <td className="py-2 px-2 text-right text-gray-600 dark:text-gray-300">{d.contentCostInr ? formatInr(d.contentCostInr) : "—"}</td>
                    <td className="py-2 pl-2 text-right font-medium text-gray-900 dark:text-gray-100">{d.totalCostInr ? formatInr(d.totalCostInr) : "—"}</td>
                  </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 dark:border-gray-700 font-semibold text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800/50">
                <td className="py-2 pr-3">Total</td>
                <td className="py-2 px-2 text-right">{t.images}</td>
                <td className="py-2 px-2 text-right">{t.content}</td>
                <td className="py-2 px-2 text-right">{t.draft}</td>
                <td className="py-2 px-2 text-right">{t.ready}</td>
                <td className="py-2 px-2 text-right">{t.published}</td>
                <td className="py-2 px-2 text-right">{formatInr(t.imageCostInr)}</td>
                <td className="py-2 px-2 text-right">{formatInr(t.contentCostInr)}</td>
                <td className="py-2 pl-2 text-right">{formatInr(t.totalCostInr)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Image prompts */}
      <div className={cn(card, "p-5")}>
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-gray-400" /> Image prompts in range
            <span className="text-xs font-normal text-gray-400">({filteredPrompts.length})</span>
          </h3>
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={promptSearch}
              onChange={(e) => setPromptSearch(e.target.value)}
              placeholder="Search prompts..."
              aria-label="Search image prompts"
              className="pl-8 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 w-56"
            />
          </div>
        </div>
        {filteredPrompts.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
            {report.prompts.length === 0 ? "No images generated in this range" : "No prompts match your search"}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredPrompts.slice(0, promptLimit).map((p) => (
                <div key={p.postId} className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col">
                  <div className="relative aspect-video bg-gray-50 dark:bg-gray-800">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-300 dark:text-gray-600">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                    <span className="absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/55 text-white">
                      {p.isCarousel ? `Carousel · ${p.images}` : `${p.images} img`}
                    </span>
                  </div>
                  <div className="p-3 flex flex-col gap-2 flex-1">
                    <div className="flex items-center justify-between text-[11px] text-gray-400 dark:text-gray-500">
                      <span>{p.date}</span>
                      <span className="capitalize px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800">{p.postType}</span>
                    </div>
                    {p.prompt ? (
                      <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-3 flex-1">{p.prompt}</p>
                    ) : (
                      <p className="text-xs italic text-gray-400 dark:text-gray-500 flex-1">(no prompt stored)</p>
                    )}
                    {p.prompt && (
                      <button
                        onClick={() => copyPrompt(p.postId, p.prompt)}
                        className="self-start flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                      >
                        {copiedId === p.postId ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                        {copiedId === p.postId ? "Copied" : "Copy prompt"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {filteredPrompts.length > promptLimit && (
              <div className="text-center mt-4">
                <button
                  onClick={() => setPromptLimit((n) => n + 24)}
                  className="text-sm font-medium px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Show more ({filteredPrompts.length - promptLimit} more)
                </button>
              </div>
            )}
          </>
        )}
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-4">
          Prompts are stored latest-only per post; an older image of the same post may have used a different prompt.
        </p>
      </div>

      {/* Cost basis note */}
      <p className="text-xs text-gray-400 dark:text-gray-500">
        Costs are <span className="font-medium">estimates</span> (activity counts × published Gemini pricing: Nano Banana Pro 2K images and
        gemini-2.5-flash text), converted to INR; content cost assumes ~5 posts per generation batch, and cropped images are counted as
        their original generation. Actual billing lives in the Google Cloud / Gemini console.
      </p>
    </div>
  );
}

function pct(count: number, total: number): string {
  const v = total > 0 ? (count / total) * 100 : 0;
  return `${Math.round(v * 100) / 100}%`;
}

function StatusLegend({ color, label, count, total }: { color: string; label: string; count: number; total: number }) {
  const p = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className={cn("w-3 h-3 rounded-sm", color)} />
      <span className="text-gray-600 dark:text-gray-300 font-medium">{label}</span>
      <span className="text-gray-400 dark:text-gray-500">
        {count} ({p}%)
      </span>
    </div>
  );
}
