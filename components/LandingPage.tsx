"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import {
  Linkedin,
  Sparkles,
  Calendar,
  FileText,
  Image,
  TrendingUp,
  Zap,
  CheckCircle,
  ArrowRight,
  Clock,
  Target,
  BarChart3,
  Heart,
  ChevronDown,
  Star,
  Quote,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import Footer from "@/components/Footer";

const features = [
  {
    icon: Target,
    title: "Personalized Content Strategy",
    desc: "Get a data-driven content roadmap built around your expertise, industry trends, and audience — so every post has purpose.",
  },
  {
    icon: FileText,
    title: "30 Ready-to-Publish Posts",
    desc: "Thought leadership, actionable tips, engaging stories, questions, and listicles — all written in your voice, every month.",
  },
  {
    icon: Image,
    title: "Professional AI Images",
    desc: "Eye-catching, on-brand visuals generated for every post — no design skills needed, no stock photo hunting.",
  },
  {
    icon: Calendar,
    title: "Visual Content Calendar",
    desc: "Plan, schedule, and track your entire month of LinkedIn content in one clean, drag-free calendar view.",
  },
  {
    icon: FileText,
    title: "Newsletter Drafts",
    desc: "Full LinkedIn newsletter editions with compelling hooks, structured sections, key insights, and clear CTAs — ready to send.",
  },
  {
    icon: Zap,
    title: "One-Click LinkedIn Publishing",
    desc: "Review, refine, and publish directly to LinkedIn without copy-pasting. Your content goes live in seconds.",
  },
];

const testimonials = [
  {
    name: "Priya Sharma",
    role: "Marketing Director, SaaS Startup",
    text: "I went from posting once a month to 5x a week. Kruti.io generates content that actually sounds like me — my network noticed the difference immediately.",
    stars: 5,
  },
  {
    name: "Rahul Menon",
    role: "Founder & CEO, FinTech",
    text: "We used to spend 3 hours per LinkedIn post. Now our entire month of content is ready in minutes. The AI strategy is spot-on for our industry.",
    stars: 5,
  },
  {
    name: "Aisha Patel",
    role: "HR Consultant",
    text: "The content calendar and auto-publishing changed my game. I focus on my clients while Kruti.io keeps my LinkedIn active and growing.",
    stars: 5,
  },
];

const pricingHighlights = [
  "30 AI-generated posts per month",
  "Professional image generation",
  "Content calendar & scheduling",
  "One-click LinkedIn publishing",
  "Newsletter drafts",
  "Personalized content strategy",
];

const faqs = [
  {
    q: "What is Kruti.io and how does it work?",
    a: "Kruti.io is an AI-powered LinkedIn content platform. You connect your LinkedIn profile, and our AI analyzes your experience, industry, and voice to generate a personalized content strategy with 30 ready-to-publish posts, professional images, and newsletter drafts every month.",
  },
  {
    q: "Will the AI-generated posts sound like me?",
    a: "Yes. Kruti.io reads your LinkedIn profile — your headline, about section, experience, and past activity — to understand your tone, expertise, and audience. Every post is written to match your authentic professional voice, not generic AI-speak.",
  },
  {
    q: "Can I edit posts before publishing?",
    a: "Absolutely. Every post is created as a draft first. You can review, edit, rewrite, or discard any post before marking it ready to publish. You always have full control over what goes live on your LinkedIn profile.",
  },
  {
    q: "Is my LinkedIn account safe? Will I get banned?",
    a: "Absolutely safe. Kruti.io uses LinkedIn's official API and OAuth 2.0 — the same authorized method used by major platforms like Hootsuite and Buffer. We never store your password, never use scrapers or browser automation, and never violate LinkedIn's terms of service. Your account will not be flagged or banned because we only use LinkedIn-approved methods to publish content you explicitly approve.",
  },
  {
    q: "How many posts can I generate per month?",
    a: "You can generate up to 30 posts per billing cycle — that covers every working day of the month. Posts are generated in batches of 5, scheduled across weekdays, so you always have fresh content lined up.",
  },
  {
    q: "Do I need to write prompts or give instructions?",
    a: "No. Unlike other AI tools, Kruti.io doesn't need prompts. It automatically builds your content strategy based on your LinkedIn profile and industry. Just click generate and your posts are ready.",
  },
  {
    q: "What types of content does Kruti.io create?",
    a: "Kruti.io generates five content formats: thought leadership pieces, actionable tips, personal stories, engagement questions, and listicles. Each batch is a strategic mix designed to maximize reach and engagement.",
  },
  {
    q: "Does Kruti.io post directly to LinkedIn?",
    a: "Yes. Once you mark a post as ready, Kruti.io can automatically publish it to your LinkedIn feed at the scheduled time. You can also add AI-generated images to your posts with one click before publishing.",
  },
];

const steps = [
  {
    step: "01",
    title: "Connect Your LinkedIn",
    desc: "Sign in securely with LinkedIn. We analyze your profile, headline, and experience to understand your professional voice.",
  },
  {
    step: "02",
    title: "Generate Your Strategy",
    desc: "AI builds a personalized content plan with themes, pillars, and post types tailored to your goals and audience.",
  },
  {
    step: "03",
    title: "Publish & Grow",
    desc: "Review AI-crafted posts, add images with one click, and publish directly to LinkedIn. Watch your engagement soar.",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-200 dark:border-gray-800">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-5 text-left gap-4"
      >
        <span className="font-medium text-gray-900 dark:text-white">{q}</span>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          open ? "max-h-48 pb-5" : "max-h-0"
        }`}
      >
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

export default function LandingPage({ callbackUrl }: { callbackUrl?: string }) {
  const handleSignIn = () => {
    signIn("linkedin", { callbackUrl: callbackUrl || "/dashboard" });
  };

  const isRedirect = callbackUrl && callbackUrl !== "/dashboard" && callbackUrl !== "/";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-950 dark:to-gray-900">
      {isRedirect && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-4 py-3 text-center text-sm font-medium flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4" />
          Please sign in to access that page.
        </div>
      )}
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Kruti.io — AI LinkedIn Content Platform" className="h-9 w-auto" />
        </div>
        <div className="flex items-center gap-4">
          <a href="/blog" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-[#0A66C2] transition-colors">Blog</a>
          <button
            onClick={handleSignIn}
            className="flex items-center gap-2 bg-linkedin-blue text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-linkedin-darkblue transition-colors"
          >
            <Linkedin className="w-4 h-4" />
            Sign in with LinkedIn
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-full text-sm font-medium mb-6">
          <Heart className="w-4 h-4" />
          Powered by AI, crafted with love in Mumbai
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white leading-tight mb-6">
          Stop Writing LinkedIn Posts.
          <br />
          <span className="text-linkedin-blue">Start Growing Your Brand.</span>
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-4">
          Kruti.io turns your LinkedIn profile into a content engine — generating 30 strategic posts,
          professional images, and newsletters every month, all in your authentic voice.
        </p>
        <p className="text-base text-gray-500 dark:text-gray-500 max-w-xl mx-auto mb-10">
          Trusted by founders, marketers, and professionals who want to build authority on LinkedIn
          without spending hours writing.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={handleSignIn}
            className="inline-flex items-center gap-3 linkedin-gradient text-white px-8 py-4 rounded-xl text-lg font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-blue-200 dark:shadow-blue-900/30"
          >
            <Linkedin className="w-6 h-6" />
            Start Creating for Free
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 flex items-center justify-center gap-4 flex-wrap">
          <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-green-500" /> Free to start</span>
          <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-green-500" /> No credit card required</span>
          <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-green-500" /> Cancel anytime</span>
          <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-green-500" /> Uses LinkedIn&apos;s official API</span>
        </p>
      </section>

      {/* How It Works */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-3">
          From Zero to 30 Posts in 3 Steps
        </h2>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-12 max-w-xl mx-auto">
          No prompts to write. No templates to fill. Just connect and go.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((s) => (
            <div key={s.step} className="text-center">
              <div className="w-14 h-14 bg-linkedin-blue text-white rounded-2xl flex items-center justify-center text-xl font-bold mx-auto mb-4">
                {s.step}
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-lg">{s.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-3">
          Everything You Need to Dominate LinkedIn
        </h2>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-12 max-w-xl mx-auto">
          Strategy, content, images, scheduling, and publishing — all in one platform built for busy professionals.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm card-hover"
            >
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-linkedin-blue" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{f.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* LinkedIn Official API Trust Banner */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
          <div className="w-14 h-14 bg-green-100 dark:bg-green-900/50 rounded-2xl flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-7 h-7 text-green-600 dark:text-green-400" />
          </div>
          <div className="text-center md:text-left">
            <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-1">
              100% Safe &amp; Compliant — Powered by LinkedIn&apos;s Official API
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Kruti.io uses LinkedIn&apos;s official API to publish content on your behalf. Your account is never at risk
              of being flagged or banned. We follow LinkedIn&apos;s guidelines and terms of service — no scrapers, no
              browser automation, no grey-area hacks. Just the official, approved way to post.
            </p>
          </div>
        </div>
      </section>

      {/* Social Proof / Stats */}
      <section className="linkedin-gradient text-white py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Build Your LinkedIn Authority in Minutes, Not Hours
          </h2>
          <p className="text-blue-100 text-lg mb-10">
            While others stare at a blank page, you will be publishing strategic content that gets noticed.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: "30", label: "Posts per month" },
              { value: "4", label: "Content pillars" },
              { value: "1", label: "Newsletter edition" },
              { value: "< 5 min", label: "Setup time" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-4xl font-bold">{stat.value}</div>
                <div className="text-blue-200 text-sm mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pain Point → Solution */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm p-8 md:p-12">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6 text-center">
            Sound Familiar?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="space-y-4">
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium uppercase tracking-wider">Without Kruti.io</p>
              {[
                "Spending 2+ hours writing a single post",
                "Running out of ideas by Wednesday",
                "Inconsistent posting kills your reach",
                "Generic content that sounds like everyone else",
              ].map((pain) => (
                <div key={pain} className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5 flex-shrink-0">&#10005;</span>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{pain}</p>
                </div>
              ))}
            </div>
            <div className="space-y-4">
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium uppercase tracking-wider">With Kruti.io</p>
              {[
                "30 posts generated in under 5 minutes",
                "Fresh themes and ideas every single batch",
                "Consistent daily posting on autopilot",
                "Content that sounds like you — because it learns your voice",
              ].map((sol) => (
                <div key={sol} className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">{sol}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="text-center">
            <button
              onClick={handleSignIn}
              className="inline-flex items-center gap-2 linkedin-gradient text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity"
            >
              <Sparkles className="w-5 h-5" />
              Start Creating Content Now
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-3">
          Loved by Professionals
        </h2>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-12 max-w-xl mx-auto">
          See how professionals are growing their LinkedIn presence with Kruti.io
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm"
            >
              <div className="flex items-center gap-0.5 mb-3">
                {Array.from({ length: t.stars }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                ))}
              </div>
              <div className="flex items-start gap-2 mb-3">
                <Quote className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0 mt-1" />
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{t.text}</p>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{t.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-[#0A66C2] to-[#004182] px-8 py-6 text-white text-center">
            <p className="text-sm font-medium text-blue-200 mb-1">Simple, Transparent Pricing</p>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl font-bold">&#8377;999</span>
              <span className="text-blue-200">/month</span>
            </div>
            <p className="text-sm text-blue-200 mt-1">or $19/month for international users</p>
          </div>
          <div className="px-8 py-6">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Everything included:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {pricingHighlights.map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 text-center">
              <button
                onClick={handleSignIn}
                className="inline-flex items-center gap-2 linkedin-gradient text-white px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity"
              >
                <Sparkles className="w-5 h-5" />
                Start 7-Day Free Trial
              </button>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">No credit card required. Cancel anytime.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-3">
          Frequently Asked Questions
        </h2>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-10 max-w-xl mx-auto">
          Got questions? We have answers. If you need more help, reach out to us anytime.
        </p>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm px-6 md:px-8">
          {faqs.map((faq) => (
            <FAQItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-3xl mx-auto px-6 pb-20 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Ready to Become a LinkedIn Thought Leader?
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-xl mx-auto">
          Join professionals who are growing their personal brand on LinkedIn with AI-powered content
          that actually sounds human.
        </p>
        <button
          onClick={handleSignIn}
          className="inline-flex items-center gap-3 linkedin-gradient text-white px-8 py-4 rounded-xl text-lg font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-blue-200 dark:shadow-blue-900/30"
        >
          <Linkedin className="w-6 h-6" />
          Get Started Free — No Credit Card Needed
        </button>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-6">
          Kruti.io is proudly built by Cinute Digital Pvt. Ltd., Mumbai, India.
        </p>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
