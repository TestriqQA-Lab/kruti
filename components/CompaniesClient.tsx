"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  ArrowRight,
  Upload,
  Loader2,
  Globe,
  FileText,
  Mail,
} from "lucide-react";

// Reuse the same preference values the onboarding/settings flows use so AI
// generation behaves identically for companies.
const INDUSTRIES = [
  "Technology", "Finance", "Healthcare", "Marketing", "Sales",
  "Education", "Consulting", "Legal", "Real Estate", "Media",
  "Manufacturing", "Retail", "Non-profit", "Other",
];
const POSITIONING_OPTIONS = [
  "Thought Leader", "Industry Expert", "Storyteller", "Educator",
  "Entertainer", "Contrarian", "Practitioner", "Community Builder",
];
const CONTENT_GOALS = [
  "Lead Generation", "Network Building", "Brand Awareness", "Job Seeking",
  "Sales / Business Development", "Recruiting Top Talent",
];
const CONTENT_STYLES = [
  "Problem Agitation Solution", "Narrative / Story", "List / Tips",
  "Data-driven Insights", "Personal Story", "Case Study", "How-to / Tutorial",
  "Motivational", "Contrarian Take", "Q&A Format", "Behind the Scenes",
  "Predictions & Trends", "Lessons Learned", "Social Proof / Results",
];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export interface CompanyData {
  id: string;
  name: string;
  tagline: string | null;
  about: string | null;
  industry: string | null;
  website: string | null;
  logoUrl: string | null;
  positioning: string | null;
  contentGoals: string | null;
  contentStyles: string | null;
  targetAudience: string | null;
  tonePrefs: string | null;
  humanMode: boolean;
  postingSchedule: string | null;
  postSignature: string | null;
  timezone: string;
  plansCount: number;
  newslettersCount: number;
}

function parseArr(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

interface FormState {
  name: string;
  tagline: string;
  industry: string;
  website: string;
  about: string;
  targetAudience: string;
  positioning: string;
  contentGoals: string[];
  contentStyles: string[];
  postSignature: string;
  timezone: string;
  humanMode: boolean;
  days: string[];
  time: string;
}

function emptyForm(): FormState {
  return {
    name: "", tagline: "", industry: "", website: "", about: "",
    targetAudience: "", positioning: "", contentGoals: [], contentStyles: [],
    postSignature: "", timezone:
      typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata" : "Asia/Kolkata",
    humanMode: false,
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    time: "09:00",
  };
}

function formFromCompany(c: CompanyData): FormState {
  let days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  let time = "09:00";
  try {
    if (c.postingSchedule) {
      const sch = JSON.parse(c.postingSchedule);
      if (Array.isArray(sch.days) && sch.days.length) days = sch.days;
      if (typeof sch.time === "string") time = sch.time;
    }
  } catch {
    /* keep defaults */
  }
  return {
    name: c.name ?? "",
    tagline: c.tagline ?? "",
    industry: c.industry ?? "",
    website: c.website ?? "",
    about: c.about ?? "",
    targetAudience: c.targetAudience ?? "",
    positioning: c.positioning ?? "",
    contentGoals: parseArr(c.contentGoals),
    contentStyles: parseArr(c.contentStyles),
    postSignature: c.postSignature ?? "",
    timezone: c.timezone ?? "Asia/Kolkata",
    humanMode: c.humanMode ?? false,
    days,
    time,
  };
}

export default function CompaniesClient({ companies }: { companies: CompanyData[] }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyData | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setError("");
    setModalOpen(true);
  };

  const openEdit = (c: CompanyData) => {
    setEditing(c);
    setForm(formFromCompany(c));
    setError("");
    setModalOpen(true);
  };

  const toggleMulti = (val: string, key: "contentGoals" | "contentStyles" | "days") => {
    setForm((f) => {
      const arr = f[key];
      return { ...f, [key]: arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val] };
    });
  };

  const save = async () => {
    if (!form.name.trim()) {
      setError("Company name is required.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      name: form.name.trim(),
      tagline: form.tagline,
      industry: form.industry,
      website: form.website,
      about: form.about,
      targetAudience: form.targetAudience,
      positioning: form.positioning,
      contentGoals: form.contentGoals,
      contentStyles: form.contentStyles,
      postSignature: form.postSignature,
      timezone: form.timezone,
      humanMode: form.humanMode,
      postingSchedule: { days: form.days, time: form.time },
      onboardingCompleted: true,
    };
    try {
      const res = editing
        ? await fetch(`/api/company/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/company", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setModalOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File) => {
    if (!editing) return;
    setUploadingLogo(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch(`/api/company/${editing.id}/logo`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Logo upload failed");
    } finally {
      setUploadingLogo(false);
    }
  };

  const openWorkspace = async (id: string) => {
    setOpeningId(id);
    try {
      await fetch("/api/company/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace: id }),
      });
      router.push("/dashboard");
      router.refresh();
    } finally {
      setOpeningId(null);
    }
  };

  const remove = async (c: CompanyData) => {
    if (!confirm(`Delete "${c.name}"? This permanently removes all of its strategies, posts and newsletters.`)) {
      return;
    }
    setDeletingId(c.id);
    try {
      const res = await fetch(`/api/company/${c.id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setDeletingId(null);
    }
  };

  const inputCls =
    "w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:border-transparent";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Company Profiles</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create separate brand workspaces — each with its own strategy, posts, calendar, newsletters and analytics.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 bg-[#0A66C2] hover:bg-[#004182] text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors flex-shrink-0"
        >
          <Plus className="w-4 h-4" /> New Company
        </button>
      </div>

      {/* Empty state */}
      {companies.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-20 bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-linkedin-lightblue dark:bg-linkedin-blue/20 flex items-center justify-center mb-4">
            <Building2 className="w-7 h-7 text-[#0A66C2]" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white">No company profiles yet</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
            Add a company to generate content in its own voice — separate from your personal workspace.
          </p>
          <button
            onClick={openCreate}
            className="mt-5 inline-flex items-center gap-2 bg-[#0A66C2] hover:bg-[#004182] text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Create your first company
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {companies.map((c) => (
            <div
              key={c.id}
              className="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 flex flex-col hover:shadow-md hover:border-[#0A66C2]/40 transition-all"
            >
              <div className="flex items-start gap-3">
                {c.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.logoUrl} alt={c.name} className="w-12 h-12 rounded-xl object-cover border border-gray-200 dark:border-gray-700" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-linkedin-lightblue dark:bg-linkedin-blue/20 flex items-center justify-center text-[#0A66C2] font-bold text-lg">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">{c.name}</h3>
                  {c.industry && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{c.industry}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(c)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-[#0A66C2] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => remove(c)}
                    disabled={deletingId === c.id}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    {deletingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {c.tagline && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 line-clamp-2">{c.tagline}</p>
              )}

              <div className="flex items-center gap-4 mt-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {c.plansCount} plans</span>
                <span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {c.newslettersCount} newsletters</span>
              </div>

              <button
                onClick={() => openWorkspace(c.id)}
                disabled={openingId === c.id}
                className="mt-5 w-full inline-flex items-center justify-center gap-2 bg-[#0A66C2] hover:bg-[#004182] text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-60"
              >
                {openingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Open workspace
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !saving && setModalOpen(false)}>
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
              <h2 className="font-bold text-gray-900 dark:text-white">
                {editing ? "Edit company profile" : "New company profile"}
              </h2>
              <button onClick={() => !saving && setModalOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Logo (edit only) */}
              {editing && (
                <div className="flex items-center gap-4">
                  {editing.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={editing.logoUrl} alt="logo" className="w-14 h-14 rounded-xl object-cover border border-gray-200 dark:border-gray-700" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-linkedin-lightblue dark:bg-linkedin-blue/20 flex items-center justify-center text-[#0A66C2] font-bold text-xl">
                      {form.name.charAt(0).toUpperCase() || "C"}
                    </div>
                  )}
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-[#0A66C2] cursor-pointer hover:underline">
                    {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploadingLogo ? "Uploading..." : "Upload logo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadLogo(f);
                      }}
                    />
                  </label>
                </div>
              )}

              {/* Name + industry */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Company name *</label>
                  <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Acme Inc." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Industry</label>
                  <select className={inputCls} value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}>
                    <option value="">Select industry</option>
                    {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
              </div>

              {/* Tagline + website */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Tagline / headline</label>
                  <input className={inputCls} value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} placeholder="AI for modern teams" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Website</label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input className={inputCls + " pl-9"} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://acme.com" />
                  </div>
                </div>
              </div>

              {/* About */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">About the company</label>
                <textarea className={inputCls + " resize-none"} rows={3} value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} placeholder="What the company does, its mission and what makes it unique." />
              </div>

              {/* Target audience */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Target audience</label>
                <textarea className={inputCls + " resize-none"} rows={2} value={form.targetAudience} onChange={(e) => setForm({ ...form, targetAudience: e.target.value })} placeholder="Who the content should speak to (e.g. B2B SaaS founders, HR leaders)." />
              </div>

              {/* Positioning */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Content positioning</label>
                <select className={inputCls} value={form.positioning} onChange={(e) => setForm({ ...form, positioning: e.target.value })}>
                  <option value="">Select positioning</option>
                  {POSITIONING_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {/* Content goals */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Content goals</label>
                <div className="flex flex-wrap gap-2">
                  {CONTENT_GOALS.map((g) => {
                    const on = form.contentGoals.includes(g);
                    return (
                      <button key={g} type="button" onClick={() => toggleMulti(g, "contentGoals")}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${on ? "bg-[#0A66C2] border-[#0A66C2] text-white" : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-[#0A66C2]"}`}>
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Content styles */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Content styles</label>
                <div className="flex flex-wrap gap-2">
                  {CONTENT_STYLES.map((s) => {
                    const on = form.contentStyles.includes(s);
                    return (
                      <button key={s} type="button" onClick={() => toggleMulti(s, "contentStyles")}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${on ? "bg-[#0A66C2] border-[#0A66C2] text-white" : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-[#0A66C2]"}`}>
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Posting schedule */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Posting schedule</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {DAYS.map((d) => {
                    const on = form.days.includes(d);
                    return (
                      <button key={d} type="button" onClick={() => toggleMulti(d, "days")}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${on ? "bg-[#0A66C2] border-[#0A66C2] text-white" : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-[#0A66C2]"}`}>
                        {d.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Time:</span>
                  <input type="time" className={inputCls + " w-auto"} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                  <span className="text-xs text-gray-400">{form.timezone}</span>
                </div>
              </div>

              {/* Post signature */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Post signature (appended to posts)</label>
                <textarea className={inputCls + " resize-none"} rows={2} value={form.postSignature} onChange={(e) => setForm({ ...form, postSignature: e.target.value })} placeholder="e.g. — Team Acme | acme.com" />
              </div>

              {/* Human mode */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.humanMode} onChange={(e) => setForm({ ...form, humanMode: e.target.checked })} className="w-4 h-4 rounded accent-[#0A66C2]" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Human mode — make posts sound more natural &amp; less AI-like</span>
              </label>

              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            </div>

            <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-6 py-4 flex justify-end gap-3">
              <button onClick={() => !saving && setModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                Cancel
              </button>
              <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 bg-[#0A66C2] hover:bg-[#004182] text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {editing ? "Save changes" : "Create company"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
