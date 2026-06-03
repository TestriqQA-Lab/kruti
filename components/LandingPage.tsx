"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import {
  Linkedin,
  ArrowRight,
  ArrowUpRight,
  Check,
  Minus,
  Sparkles,
  Star,
  ChevronDown,
  Target,
  FileText,
  Image as ImageIcon,
  Calendar,
  Newspaper,
  Zap,
  AlertCircle,
} from "lucide-react";
import Footer from "@/components/Footer";

// ──────────────────────────────────────────────────────────────────────────
// Content
// ──────────────────────────────────────────────────────────────────────────

const steps = [
  {
    n: "01",
    title: "Connect your LinkedIn",
    desc: "Sign in securely with LinkedIn. We read your profile, headline, and experience to learn your authentic voice.",
  },
  {
    n: "02",
    title: "Generate your strategy",
    desc: "AI builds a personalized content plan — themes, pillars, and post types tailored to your goals. No prompts to write.",
  },
  {
    n: "03",
    title: "Publish & grow",
    desc: "Review the drafts, add an image in one click, and publish straight to LinkedIn. Watch your engagement compound.",
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
    desc: "Plan, schedule, and track a full month of LinkedIn content in one clean calendar view.",
  },
  {
    icon: Newspaper,
    title: "Newsletter drafts",
    desc: "Full LinkedIn newsletter editions — hooks, sections, key insights, and clear CTAs — ready to send.",
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
    role: "Marketing Director, SaaS Startup",
    initials: "PS",
    text: "I went from posting once a month to 5x a week. Kruti.io generates content that actually sounds like me — my network noticed the difference immediately.",
  },
  {
    name: "Rahul Menon",
    role: "Founder & CEO, FinTech",
    initials: "RM",
    text: "We used to spend 3 hours per LinkedIn post. Now our entire month of content is ready in minutes. The strategy is spot-on for our industry.",
  },
  {
    name: "Aisha Patel",
    role: "HR Consultant",
    initials: "AP",
    text: "The content calendar and auto-publishing changed my game. I focus on my clients while Kruti.io keeps my LinkedIn active and growing.",
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
    a: "Yes. Kruti.io reads your LinkedIn profile — your headline, about section, experience, and activity — to understand your tone, expertise, and audience. Every post is written to match your authentic professional voice, not generic AI-speak.",
  },
  {
    q: "Can I edit posts before publishing?",
    a: "Always. Every post is created as a draft first. You can review, edit, rewrite, or discard any post before marking it ready. You stay in full control of what goes live on your profile.",
  },
  {
    q: "Do I need to write prompts or instructions?",
    a: "No. Unlike other AI tools, Kruti.io doesn't need prompts. It builds your content strategy automatically from your LinkedIn profile and industry. Just click generate and your posts are ready.",
  },
];

const trust = ["Free to start", "No credit card required", "Cancel anytime", "Official LinkedIn API"];

// ──────────────────────────────────────────────────────────────────────────
// Building blocks
// ──────────────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <a href="/" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-orange-400 font-display text-lg font-semibold text-white shadow-sm shadow-rose-500/30">
        K
      </span>
      <span className="font-display text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
        Kruti<span className="text-rose-500">.io</span>
      </span>
    </a>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-500 dark:text-rose-300">
      {children}
    </span>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-stone-200 dark:border-white/10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-6 py-6 text-left"
        aria-expanded={open}
      >
        <span className="text-lg font-medium text-stone-900 dark:text-stone-100">{q}</span>
        <span
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
            open
              ? "rotate-180 border-transparent bg-gradient-to-br from-rose-500 to-orange-400 text-white"
              : "border-stone-300 text-stone-400 dark:border-white/15"
          }`}
        >
          <ChevronDown className="h-4 w-4" />
        </span>
      </button>
      <div
        className={`grid transition-all duration-300 ease-out ${
          open ? "grid-rows-[1fr] pb-6 opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <p className="max-w-2xl text-base leading-relaxed text-stone-600 dark:text-stone-400">{a}</p>
        </div>
      </div>
    </div>
  );
}

// Warm post preview shown in the hero.
function PostPreview() {
  return (
    <div className="relative animate-fade-up [animation-delay:240ms]">
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-tr from-rose-400/30 via-orange-300/20 to-amber-300/20 blur-3xl" />
      <div className="rounded-3xl border border-stone-200/80 bg-white/90 p-5 shadow-[0_30px_70px_-25px_rgba(190,90,60,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05]">
        <div className="mb-3 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
            <Sparkles className="h-3 w-3" /> AI draft
          </span>
          <span className="text-xs text-stone-400">Scheduled · Mon 9:00 AM</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-full bg-gradient-to-br from-stone-200 to-stone-300 dark:from-stone-700 dark:to-stone-600" />
          <div className="space-y-1.5">
            <div className="h-2.5 w-28 rounded-full bg-stone-200 dark:bg-white/10" />
            <div className="h-2 w-20 rounded-full bg-stone-100 dark:bg-white/5" />
          </div>
        </div>
        <p className="mt-4 font-display text-[15px] font-medium text-stone-800 dark:text-stone-100">
          3 lessons I learned scaling our team from 5 to 50 →
        </p>
        <div className="mt-2.5 space-y-2">
          <div className="h-2.5 w-full rounded-full bg-stone-100 dark:bg-white/5" />
          <div className="h-2.5 w-[90%] rounded-full bg-stone-100 dark:bg-white/5" />
          <div className="h-2.5 w-[72%] rounded-full bg-stone-100 dark:bg-white/5" />
        </div>
        <div className="relative mt-4 h-28 overflow-hidden rounded-2xl bg-gradient-to-br from-rose-400 via-rose-300 to-orange-300">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_22%,white,transparent_45%)] opacity-40" />
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/15 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
            <ImageIcon className="h-3 w-3" /> AI image
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {["#Leadership", "#Growth", "#Startups"].map((t) => (
            <span
              key={t}
              className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-500 dark:bg-rose-500/10 dark:text-rose-300"
            >
              {t}
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-1.5 border-t border-stone-100 pt-3 text-xs text-stone-400 dark:border-white/10">
          <Check className="h-3.5 w-3.5 text-rose-500" /> Published to LinkedIn · Just now
        </div>
      </div>

      <div className="absolute -right-3 -top-4 flex items-center gap-2 rounded-2xl border border-stone-200/80 bg-white/90 px-3 py-2 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-stone-900/80 sm:-right-6">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-orange-400 text-white">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <span className="text-xs font-semibold text-stone-900 dark:text-stone-100">30 posts / month</span>
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
    <div className="min-h-screen bg-[#FDF7F3] text-stone-900 antialiased dark:bg-[#16110F] dark:text-stone-100">
      {isRedirect && (
        <div className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertCircle className="h-4 w-4" />
          Please sign in to access that page.
        </div>
      )}

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-stone-200/60 bg-[#FDF7F3]/80 backdrop-blur-md dark:border-white/10 dark:bg-[#16110F]/80">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
          <Logo />
          <div className="hidden items-center gap-8 md:flex">
            {[
              { href: "#how", label: "How it works" },
              { href: "#features", label: "Features" },
              { href: "#pricing", label: "Pricing" },
              { href: "/blog", label: "Blog" },
            ].map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-[15px] font-medium text-stone-600 transition-colors hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
              >
                {l.label}
              </a>
            ))}
          </div>
          <button
            onClick={handleSignIn}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-500 to-orange-400 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 transition-all hover:shadow-rose-500/40 hover:-translate-y-0.5"
          >
            <Linkedin className="h-4 w-4" />
            Start free
          </button>
        </nav>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 -top-20 -z-10 h-[560px] bg-[radial-gradient(45%_60%_at_25%_25%,rgba(244,63,94,0.18),transparent_70%),radial-gradient(40%_55%_at_80%_10%,rgba(251,146,60,0.18),transparent_70%)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-12">
          {/* left */}
          <div className="lg:col-span-7">
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/70 px-3.5 py-1.5 text-sm font-medium text-stone-600 dark:border-white/10 dark:bg-white/5 dark:text-stone-300">
                <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-rose-500 to-orange-400" />
                Powered by AI, crafted with love in Mumbai
              </span>
            </div>
            <h1 className="animate-fade-up [animation-delay:80ms] mt-6 font-display text-[2.9rem] font-semibold leading-[1.04] tracking-[-0.02em] sm:text-6xl lg:text-[4.1rem]">
              Stop writing LinkedIn posts.{" "}
              <span className="bg-gradient-to-r from-rose-500 to-orange-400 bg-clip-text text-transparent">
                Start growing your brand.
              </span>
            </h1>
            <p className="animate-fade-up [animation-delay:140ms] mt-6 max-w-xl text-lg leading-relaxed text-stone-600 dark:text-stone-400 sm:text-xl">
              Kruti.io turns your LinkedIn profile into a content engine — generating 30 strategic
              posts, professional images, and newsletters every month, all in your authentic voice.
            </p>
            <div className="animate-fade-up [animation-delay:200ms] mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <button
                onClick={handleSignIn}
                className="group inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-rose-500 to-orange-400 px-7 py-3.5 text-base font-semibold text-white shadow-xl shadow-rose-500/30 transition-all hover:-translate-y-0.5 hover:shadow-rose-500/50"
              >
                <Linkedin className="h-5 w-5" />
                Start creating for free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <a
                href="#how"
                className="inline-flex items-center gap-1 text-base font-medium text-stone-700 transition-colors hover:text-rose-500 dark:text-stone-300"
              >
                See how it works <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
            <div className="animate-fade-up [animation-delay:260ms] mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-stone-500 dark:text-stone-500">
              {trust.map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-rose-500" />
                  {t}
                </span>
              ))}
            </div>
          </div>
          {/* right */}
          <div className="animate-fade-up [animation-delay:180ms] lg:col-span-5">
            <PostPreview />
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
        <div className="max-w-2xl">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            From zero to 30 posts in three steps
          </h2>
          <p className="mt-4 text-lg text-stone-600 dark:text-stone-400">
            No prompts to write. No templates to fill. Just connect and go.
          </p>
        </div>
        <div className="mt-16 grid gap-10 sm:grid-cols-3 sm:gap-8">
          {steps.map((s) => (
            <div key={s.n} className="border-t border-stone-200 pt-6 dark:border-white/10">
              <span className="bg-gradient-to-br from-rose-500 to-orange-400 bg-clip-text font-display text-5xl font-semibold text-transparent">
                {s.n}
              </span>
              <h3 className="mt-4 font-display text-xl font-medium">{s.title}</h3>
              <p className="mt-2.5 text-base leading-relaxed text-stone-600 dark:text-stone-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section
        id="features"
        className="border-y border-stone-200 bg-white py-24 dark:border-white/10 dark:bg-white/[0.02] sm:py-32"
      >
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="max-w-2xl">
            <Eyebrow>Everything you need</Eyebrow>
            <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              A whole content team, quietly working
            </h2>
            <p className="mt-4 text-lg text-stone-600 dark:text-stone-400">
              Strategy, content, images, scheduling, and publishing — built for busy professionals.
            </p>
          </div>
          <div className="mt-16 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="group">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500/10 to-orange-400/10 text-rose-500 ring-1 ring-inset ring-rose-500/20 transition-all group-hover:from-rose-500 group-hover:to-orange-400 group-hover:text-white">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-display text-xl font-medium">{f.title}</h3>
                <p className="mt-2 text-base leading-relaxed text-stone-600 dark:text-stone-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comparison ───────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 py-24 sm:px-8 sm:py-32">
        <div className="max-w-2xl">
          <Eyebrow>Sound familiar?</Eyebrow>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            The old way, and a calmer way
          </h2>
        </div>
        <div className="mt-12 grid overflow-hidden rounded-3xl border border-stone-200 dark:border-white/10 md:grid-cols-2">
          <div className="border-b border-stone-200 p-8 dark:border-white/10 md:border-b-0 md:border-r">
            <p className="text-sm font-semibold uppercase tracking-widest text-stone-400">Without Kruti.io</p>
            <ul className="mt-6 space-y-4">
              {withoutKruti.map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-400 dark:bg-white/10">
                    <Minus className="h-3 w-3" />
                  </span>
                  <span className="text-base text-stone-500 dark:text-stone-400">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-gradient-to-br from-rose-50 to-orange-50 p-8 dark:from-rose-500/[0.08] dark:to-orange-400/[0.05]">
            <p className="text-sm font-semibold uppercase tracking-widest text-rose-500 dark:text-rose-300">
              With Kruti.io
            </p>
            <ul className="mt-6 space-y-4">
              {withKruti.map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-orange-400 text-white">
                    <Check className="h-3 w-3" />
                  </span>
                  <span className="text-base font-medium text-stone-800 dark:text-stone-100">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────── */}
      <section className="border-y border-stone-200 bg-white py-24 dark:border-white/10 dark:bg-white/[0.02] sm:py-32">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="max-w-2xl">
            <Eyebrow>Loved by professionals</Eyebrow>
            <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Trusted by founders &amp; marketers
            </h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <figure
                key={t.name}
                className="flex flex-col rounded-3xl border border-stone-200 bg-[#FDF7F3] p-7 dark:border-white/10 dark:bg-white/[0.03]"
              >
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <blockquote className="mt-4 flex-1 text-base leading-relaxed text-stone-700 dark:text-stone-300">
                  “{t.text}”
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-orange-400 text-sm font-semibold text-white">
                    {t.initials}
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-stone-900 dark:text-stone-100">{t.name}</span>
                    <span className="block text-sm text-stone-500 dark:text-stone-500">{t.role}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section id="pricing" className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Simple pricing</Eyebrow>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            One plan. Everything included.
          </h2>
          <p className="mt-4 text-lg text-stone-600 dark:text-stone-400">
            No tiers, no add-ons, no surprises. Start with a 7-day free trial.
          </p>
        </div>

        <div className="relative mx-auto mt-12 max-w-lg">
          <div className="absolute -inset-5 -z-10 rounded-[2.5rem] bg-gradient-to-tr from-rose-400/25 to-orange-300/20 blur-3xl" />
          <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[0_30px_70px_-30px_rgba(190,90,60,0.4)] dark:border-white/10 dark:bg-white/[0.04]">
            <div className="border-b border-stone-100 px-8 py-9 text-center dark:border-white/10">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-rose-500 to-orange-400 px-3 py-1 text-xs font-semibold text-white">
                7-day free trial
              </span>
              <div className="mt-5 flex items-end justify-center gap-1.5">
                <span className="font-display text-6xl font-semibold tracking-tight">₹999</span>
                <span className="mb-2 text-stone-500 dark:text-stone-400">/month</span>
              </div>
              <p className="mt-1.5 text-sm text-stone-500 dark:text-stone-400">or $19/month for international users</p>
            </div>
            <div className="px-8 py-8">
              <ul className="space-y-3.5">
                {pricingIncludes.map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-orange-400 text-white">
                      <Check className="h-3 w-3" />
                    </span>
                    <span className="text-base text-stone-700 dark:text-stone-300">{item}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={handleSignIn}
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose-500 to-orange-400 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-rose-500/30 transition-all hover:-translate-y-0.5 hover:shadow-rose-500/50"
              >
                <Linkedin className="h-5 w-5" />
                Start your free trial
              </button>
              <p className="mt-3.5 text-center text-sm text-stone-400 dark:text-stone-500">
                No credit card required. Cancel anytime.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="border-t border-stone-200 dark:border-white/10">
        <div className="mx-auto max-w-3xl px-5 py-24 sm:px-8 sm:py-32">
          <div className="text-center">
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Questions, answered
            </h2>
          </div>
          <div className="mt-12 border-t border-stone-200 dark:border-white/10">
            {faqs.map((f) => (
              <FAQItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="px-5 pb-24 sm:px-8">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-rose-500 to-orange-400 px-6 py-16 text-center shadow-2xl shadow-rose-500/30 sm:px-12 sm:py-20">
          <div className="pointer-events-none absolute inset-0 opacity-25 [background:radial-gradient(circle_at_50%_0%,white,transparent_55%)]" />
          <h2 className="relative font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Ready to build your brand on LinkedIn?
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-lg text-rose-50">
            Join the founders and marketers growing their presence with AI-powered content that
            actually sounds human.
          </p>
          <button
            onClick={handleSignIn}
            className="relative mt-9 inline-flex items-center gap-2.5 rounded-full bg-white px-7 py-3.5 text-base font-semibold text-rose-600 shadow-xl transition-all hover:-translate-y-0.5"
          >
            <Linkedin className="h-5 w-5" />
            Get started free
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className="relative mt-6 text-sm text-rose-50/80">
            Kruti.io is proudly built by Cinute Digital Pvt. Ltd., Mumbai, India.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
