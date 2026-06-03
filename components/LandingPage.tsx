"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import {
  Linkedin,
  ArrowRight,
  ArrowUpRight,
  Check,
  X,
  ChevronDown,
  Star,
  Target,
  FileText,
  Image as ImageIcon,
  Calendar,
  Newspaper,
  Zap,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import Footer from "@/components/Footer";

// ──────────────────────────────────────────────────────────────────────────
// Content
// ──────────────────────────────────────────────────────────────────────────

const navLinks = [
  { href: "#overview", n: "01", label: "Overview" },
  { href: "#how", n: "02", label: "How it works" },
  { href: "#features", n: "03", label: "Features" },
  { href: "#pricing", n: "04", label: "Pricing" },
  { href: "#faq", n: "05", label: "FAQ" },
];

const steps = [
  {
    n: "01",
    title: "Connect your LinkedIn",
    desc: "Sign in securely. We read your profile, headline, and experience to learn your authentic voice.",
  },
  {
    n: "02",
    title: "Generate your strategy",
    desc: "AI builds a personalized content plan — themes, pillars, and post types. No prompts to write.",
  },
  {
    n: "03",
    title: "Publish & grow",
    desc: "Review the drafts, add an image in one click, and publish straight to LinkedIn.",
  },
];

const features = [
  {
    icon: Target,
    title: "Personalized strategy",
    desc: "A data-driven roadmap built around your expertise, industry, and audience — so every post has a purpose.",
  },
  {
    icon: FileText,
    title: "30 ready-to-publish posts",
    desc: "Thought leadership, tips, stories, questions, and listicles — written in your voice, every month.",
  },
  {
    icon: ImageIcon,
    title: "Professional AI images",
    desc: "Eye-catching, on-brand visuals for every post. No design skills, no stock-photo hunting.",
  },
  {
    icon: Calendar,
    title: "Visual content calendar",
    desc: "Plan, schedule, and track a full month of LinkedIn content in one clean view.",
  },
  {
    icon: Newspaper,
    title: "Newsletter drafts",
    desc: "Full LinkedIn newsletter editions — hooks, sections, insights, and CTAs — ready to send.",
  },
  {
    icon: Zap,
    title: "One-click publishing",
    desc: "Review, refine, and publish to LinkedIn without copy-paste. Your content goes live in seconds.",
  },
];

const withoutKruti = [
  "Spending 2+ hours writing a single post",
  "Running out of ideas by Wednesday",
  "Inconsistent posting that kills your reach",
  "Generic content that sounds like everyone else",
];

const withKruti = [
  "30 posts generated in under 5 minutes",
  "Fresh themes and ideas every single batch",
  "Consistent daily posting on autopilot",
  "Content that sounds like you — it learns your voice",
];

const testimonials = [
  {
    name: "Priya Sharma",
    role: "Marketing Director, SaaS",
    initials: "PS",
    text: "I went from posting once a month to 5x a week. Kruti.io generates content that actually sounds like me.",
  },
  {
    name: "Rahul Menon",
    role: "Founder & CEO, FinTech",
    initials: "RM",
    text: "We used to spend 3 hours per post. Now our entire month of content is ready in minutes.",
  },
  {
    name: "Aisha Patel",
    role: "HR Consultant",
    initials: "AP",
    text: "The calendar and auto-publishing changed my game. Kruti.io keeps my LinkedIn active and growing.",
  },
];

const pricingIncludes = [
  "30 AI-generated posts per month",
  "Professional image generation",
  "Content calendar & scheduling",
  "One-click LinkedIn publishing",
  "Personalized content strategy",
  "Newsletter drafts",
];

const faqs = [
  {
    q: "Is my LinkedIn account safe? Will I get banned?",
    a: "Absolutely safe. Kruti.io uses LinkedIn's official API and OAuth 2.0 — the same authorized method used by major platforms like Hootsuite and Buffer. We never store your password, never use scrapers or automation, and never violate LinkedIn's terms. Your account is never at risk because we only publish content you explicitly approve.",
  },
  {
    q: "Will the AI-generated posts sound like me?",
    a: "Yes. Kruti.io reads your LinkedIn profile — your headline, about section, experience, and activity — to understand your tone, expertise, and audience. Every post matches your authentic professional voice, not generic AI-speak.",
  },
  {
    q: "Can I edit posts before publishing?",
    a: "Always. Every post is created as a draft first. You can review, edit, rewrite, or discard any post before marking it ready. You stay in full control of what goes live.",
  },
  {
    q: "Do I need to write prompts or instructions?",
    a: "No. Unlike other AI tools, Kruti.io doesn't need prompts. It builds your content strategy automatically from your LinkedIn profile and industry. Just click generate.",
  },
];

const trust = ["Free to start", "No credit card", "Cancel anytime", "Official LinkedIn API"];

const mockPosts = [
  { title: "3 lessons from scaling our team 5 → 50", type: "Story", status: "Ready", dot: "bg-blue-500" },
  { title: "The hiring mistake most founders make", type: "Tips", status: "Scheduled", dot: "bg-violet-500" },
  { title: "Why we stopped chasing vanity metrics", type: "Thought", status: "Draft", dot: "bg-amber-500" },
  { title: "A simple framework for better 1:1s", type: "How-to", status: "Published", dot: "bg-emerald-500" },
];

// ──────────────────────────────────────────────────────────────────────────
// Building blocks
// ──────────────────────────────────────────────────────────────────────────

function Brand() {
  return (
    <a href="#overview" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 font-display text-lg font-bold text-white">
        K
      </span>
      <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">
        Kruti<span className="text-blue-600 dark:text-blue-400">.io</span>
      </span>
    </a>
  );
}

function CTAButton({ onClick, children, full }: { onClick: () => void; children: React.ReactNode; full?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 ${
        full ? "w-full" : ""
      }`}
    >
      {children}
    </button>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
      {children}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    Ready: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
    Scheduled: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
    Draft: "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400",
    Published: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status]}`}>{status}</span>;
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200 dark:border-white/10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-6 py-5 text-left"
        aria-expanded={open}
      >
        <span className="text-base font-medium text-slate-900 dark:text-slate-100">{q}</span>
        <ChevronDown
          className={`h-5 w-5 flex-shrink-0 text-slate-400 transition-transform duration-300 ${
            open ? "rotate-180 text-blue-600 dark:text-blue-400" : ""
          }`}
        />
      </button>
      <div
        className={`grid transition-all duration-300 ease-out ${
          open ? "grid-rows-[1fr] pb-5 opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <p className="text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">{a}</p>
        </div>
      </div>
    </div>
  );
}

// The product UI shown in the hero — a clean "Posts" workspace.
function ProductPanel() {
  return (
    <div className="animate-fade-up [animation-delay:160ms] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_-28px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-white/10">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Content workspace
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
          <Sparkles className="h-3 w-3" /> 5 posts ready
        </span>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
        {mockPosts.map((p, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3.5">
            <span className={`h-2 w-2 flex-shrink-0 rounded-full ${p.dot}`} />
            <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{p.title}</span>
            <span className="hidden rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-white/5 dark:text-slate-400 sm:inline">
              {p.type}
            </span>
            <StatusPill status={p.status} />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-400 dark:border-white/10">
        <span>This week · Mon–Fri · 9:00 AM</span>
        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <Check className="h-3.5 w-3.5" /> Auto-publishing on
        </span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────────

export default function LandingPage({ callbackUrl }: { callbackUrl?: string }) {
  const handleSignIn = () => {
    signIn("linkedin", { callbackUrl: callbackUrl || "/dashboard" });
  };

  const isRedirect = callbackUrl && callbackUrl !== "/dashboard" && callbackUrl !== "/";

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-slate-900 antialiased dark:bg-[#0A0E14] dark:text-slate-100">
      {isRedirect && (
        <div className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertCircle className="h-4 w-4" />
          Please sign in to access that page.
        </div>
      )}

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-[#F6F8FB]/85 px-5 py-3 backdrop-blur dark:border-white/10 dark:bg-[#0A0E14]/85 lg:hidden">
        <div className="flex items-center justify-between">
          <Brand />
          <CTAButton onClick={handleSignIn}>
            <Linkedin className="h-4 w-4" /> Start free
          </CTAButton>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-8 sm:px-8 lg:grid-cols-[260px_1fr] lg:items-start lg:gap-12 lg:py-10">
        {/* ── Left rail (desktop) ──────────────────────────────────────── */}
        <aside className="hidden lg:sticky lg:top-8 lg:block">
          <div className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
            <Brand />
            <nav className="flex flex-col gap-1">
              {navLinks.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                >
                  <span className="font-display text-xs tabular-nums text-slate-400 group-hover:text-blue-500">
                    {l.n}
                  </span>
                  {l.label}
                </a>
              ))}
              <a
                href="/blog"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
              >
                <span className="font-display text-xs tabular-nums text-slate-400">06</span>
                Blog
              </a>
            </nav>
            <div className="border-t border-slate-200 pt-5 dark:border-white/10">
              <CTAButton onClick={handleSignIn} full>
                <Linkedin className="h-4 w-4" /> Start free
              </CTAButton>
              <p className="mt-3 text-center text-xs text-slate-400">7-day free trial · No card</p>
            </div>
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <main className="min-w-0">
          {/* Hero */}
          <section id="overview" className="scroll-mt-24">
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Powered by AI, crafted with love in Mumbai
              </span>
            </div>
            <h1 className="animate-fade-up [animation-delay:80ms] mt-6 font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.5rem]">
              Stop writing LinkedIn posts.{" "}
              <span className="text-blue-600 dark:text-blue-400">Start growing your brand.</span>
            </h1>
            <p className="animate-fade-up [animation-delay:140ms] mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">
              Kruti.io turns your LinkedIn profile into a content engine — generating 30 strategic
              posts, professional images, and newsletters every month, all in your authentic voice.
            </p>
            <div className="animate-fade-up [animation-delay:200ms] mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <button
                onClick={handleSignIn}
                className="group inline-flex items-center gap-2.5 rounded-lg bg-blue-600 px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
              >
                <Linkedin className="h-5 w-5" />
                Start creating for free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <a
                href="#how"
                className="inline-flex items-center gap-1 text-base font-medium text-slate-700 transition-colors hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400"
              >
                See how it works <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
            <div className="animate-fade-up [animation-delay:260ms] mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500 dark:text-slate-500">
              {trust.map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-blue-500" />
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-12">
              <ProductPanel />
            </div>
          </section>

          {/* How it works */}
          <section id="how" className="scroll-mt-24 border-t border-slate-200 pt-16 dark:border-white/10 mt-20 sm:mt-24">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              From zero to 30 posts in three steps
            </h2>
            <div className="mt-12 grid gap-8 sm:grid-cols-3">
              {steps.map((s) => (
                <div key={s.n}>
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 font-display text-sm font-bold text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                    {s.n}
                  </span>
                  <h3 className="mt-4 font-display text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">{s.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Features */}
          <section id="features" className="scroll-mt-24 border-t border-slate-200 pt-16 dark:border-white/10 mt-20 sm:mt-24">
            <Eyebrow>Everything you need</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              A whole content team, quietly working
            </h2>
            <div className="mt-12 grid gap-5 sm:grid-cols-2">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="group rounded-2xl border border-slate-200 bg-white p-6 transition-colors hover:border-blue-300 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-blue-500/40"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 font-display text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">{f.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Comparison */}
          <section className="scroll-mt-24 border-t border-slate-200 pt-16 dark:border-white/10 mt-20 sm:mt-24">
            <Eyebrow>Sound familiar?</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              The old way, and a calmer way
            </h2>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.03]">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Without Kruti.io</p>
                <ul className="mt-5 space-y-3.5">
                  {withoutKruti.map((t) => (
                    <li key={t} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-white/5">
                        <X className="h-3 w-3" />
                      </span>
                      <span className="text-[15px] text-slate-500 dark:text-slate-400">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-6 dark:border-blue-500/20 dark:bg-blue-500/[0.06]">
                <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">With Kruti.io</p>
                <ul className="mt-5 space-y-3.5">
                  {withKruti.map((t) => (
                    <li key={t} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                        <Check className="h-3 w-3" />
                      </span>
                      <span className="text-[15px] font-medium text-slate-800 dark:text-slate-100">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Testimonials */}
          <section className="scroll-mt-24 border-t border-slate-200 pt-16 dark:border-white/10 mt-20 sm:mt-24">
            <Eyebrow>Loved by professionals</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Trusted by founders &amp; marketers
            </h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((t) => (
                <figure
                  key={t.name}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <blockquote className="mt-3 flex-1 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
                    “{t.text}”
                  </blockquote>
                  <figcaption className="mt-5 flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                      {t.initials}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{t.name}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-500">{t.role}</span>
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>

          {/* Pricing */}
          <section id="pricing" className="scroll-mt-24 border-t border-slate-200 pt-16 dark:border-white/10 mt-20 sm:mt-24">
            <Eyebrow>Simple pricing</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              One plan. Everything included.
            </h2>
            <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03] sm:grid sm:grid-cols-2">
              <div className="border-b border-slate-100 p-8 dark:border-white/10 sm:border-b-0 sm:border-r">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                  7-day free trial
                </span>
                <div className="mt-5 flex items-end gap-1.5">
                  <span className="font-display text-5xl font-bold tracking-tight">₹999</span>
                  <span className="mb-1.5 text-slate-500 dark:text-slate-400">/month</span>
                </div>
                <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">or $19/month for international users</p>
                <div className="mt-7">
                  <CTAButton onClick={handleSignIn} full>
                    <Linkedin className="h-4 w-4" /> Start your free trial
                  </CTAButton>
                  <p className="mt-3 text-center text-xs text-slate-400">No credit card required. Cancel anytime.</p>
                </div>
              </div>
              <div className="p-8">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Everything included</p>
                <ul className="mt-4 space-y-3">
                  {pricingIncludes.map((item) => (
                    <li key={item} className="flex items-center gap-3">
                      <Check className="h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                      <span className="text-[15px] text-slate-700 dark:text-slate-300">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section id="faq" className="scroll-mt-24 border-t border-slate-200 pt-16 dark:border-white/10 mt-20 sm:mt-24">
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">Questions, answered</h2>
            <div className="mt-8 border-t border-slate-200 dark:border-white/10">
              {faqs.map((f) => (
                <FAQItem key={f.q} q={f.q} a={f.a} />
              ))}
            </div>
          </section>

          {/* Final CTA */}
          <section className="mt-20 sm:mt-24">
            <div className="relative overflow-hidden rounded-2xl bg-slate-900 px-6 py-14 text-center dark:bg-blue-600 sm:px-12">
              <div className="pointer-events-none absolute inset-0 opacity-20 [background:radial-gradient(circle_at_50%_0%,#60a5fa,transparent_60%)]" />
              <h2 className="relative font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Ready to build your brand on LinkedIn?
              </h2>
              <p className="relative mx-auto mt-3 max-w-lg text-base text-slate-300 dark:text-blue-50">
                Join the founders and marketers growing their presence with content that actually
                sounds human.
              </p>
              <button
                onClick={handleSignIn}
                className="relative mt-8 inline-flex items-center gap-2.5 rounded-lg bg-white px-6 py-3.5 text-base font-semibold text-slate-900 transition-transform hover:-translate-y-0.5"
              >
                <Linkedin className="h-5 w-5" />
                Get started free
                <ArrowRight className="h-4 w-4" />
              </button>
              <p className="relative mt-5 text-xs text-slate-400 dark:text-blue-100/80">
                Built by Cinute Digital Pvt. Ltd., Mumbai, India.
              </p>
            </div>
          </section>
        </main>
      </div>

      <Footer />
    </div>
  );
}
