"use client";

import { useState } from "react";
import {
  X,
  Loader2,
  MessageSquare,
  BookOpen,
  Mail,
  Copy,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/Toast";

export interface RepurposeResult {
  format: string;
  content: {
    // Twitter thread
    tweets?: string[];
    // Blog post
    title?: string;
    content?: string;
    // Email newsletter
    subjectLine?: string;
    previewText?: string;
    body?: string;
    cta?: string;
  };
}

const FORMAT_META: Record<
  string,
  { icon: typeof MessageSquare; label: string; color: string; darkColor: string }
> = {
  "twitter-thread": {
    icon: MessageSquare,
    label: "Twitter/X Thread",
    color: "bg-sky-100 text-sky-700 border-sky-200",
    darkColor: "dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800",
  },
  "blog-post": {
    icon: BookOpen,
    label: "Blog Post",
    color: "bg-green-100 text-green-700 border-green-200",
    darkColor: "dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
  },
  "email-newsletter": {
    icon: Mail,
    label: "Email Newsletter",
    color: "bg-purple-100 text-purple-700 border-purple-200",
    darkColor: "dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800",
  },
};

function getCopyText(result: RepurposeResult): string {
  const { format, content } = result;
  if (format === "twitter-thread" && content.tweets) {
    return content.tweets.join("\n\n");
  }
  if (format === "blog-post") {
    return `${content.title || ""}\n\n${content.content || ""}`;
  }
  if (format === "email-newsletter") {
    return `Subject: ${content.subjectLine || ""}\nPreview: ${content.previewText || ""}\n\n${content.body || ""}\n\nCTA: ${content.cta || ""}`;
  }
  return JSON.stringify(content, null, 2);
}

/** Simple renderer: converts ## headings to styled text */
function BlogContent({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let paragraph: string[] = [];

  function flushParagraph() {
    if (paragraph.length > 0) {
      elements.push(
        <p key={`p-${elements.length}`} className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          {paragraph.join("\n")}
        </p>
      );
      paragraph = [];
    }
  }

  lines.forEach((line) => {
    if (line.startsWith("## ")) {
      flushParagraph();
      elements.push(
        <h5 key={`h-${elements.length}`} className="text-xs font-bold text-slate-900 dark:text-gray-100 mt-2 mb-1">
          {line.replace("## ", "")}
        </h5>
      );
    } else if (line.trim() === "") {
      flushParagraph();
    } else {
      paragraph.push(line);
    }
  });
  flushParagraph();

  return <div className="space-y-1.5">{elements}</div>;
}

export default function RepurposeModal({
  results,
  loading,
  onClose,
}: {
  results: RepurposeResult[];
  loading: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  function handleCopy(result: RepurposeResult) {
    navigator.clipboard.writeText(getCopyText(result));
    setCopiedFormat(result.format);
    toast("Copied to clipboard", "success");
    setTimeout(() => setCopiedFormat(null), 2000);
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#0D131F] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-gray-100">
              Repurpose Content
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Your post adapted for 3 platforms - copy and use anywhere
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Repurposing your content for 3 platforms...
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 w-full">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="bg-slate-50 dark:bg-white/[0.06] rounded-xl p-4 animate-pulse"
                  >
                    <div className="h-4 bg-slate-200 dark:bg-white/[0.08] rounded w-24 mb-3" />
                    <div className="space-y-2">
                      <div className="h-3 bg-slate-200 dark:bg-white/[0.08] rounded w-full" />
                      <div className="h-3 bg-slate-200 dark:bg-white/[0.08] rounded w-5/6" />
                      <div className="h-3 bg-slate-200 dark:bg-white/[0.08] rounded w-4/6" />
                      <div className="h-3 bg-slate-200 dark:bg-white/[0.08] rounded w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {results.map((result) => {
                const meta = FORMAT_META[result.format];
                if (!meta) return null;
                const Icon = meta.icon;
                const isCopied = copiedFormat === result.format;

                return (
                  <div
                    key={result.format}
                    className="bg-slate-50 dark:bg-white/[0.06] rounded-xl border border-slate-100 dark:border-white/10 flex flex-col overflow-hidden"
                  >
                    {/* Format badge */}
                    <div className="px-4 pt-4 pb-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border",
                          meta.color,
                          meta.darkColor
                        )}
                      >
                        <Icon className="w-3 h-3" />
                        {meta.label}
                      </span>
                    </div>

                    {/* Content preview */}
                    <div className="px-4 pb-3 flex-1 overflow-y-auto max-h-80">
                      {result.format === "twitter-thread" && result.content.tweets && (
                        <div className="space-y-2">
                          {result.content.tweets.map((tweet, i) => (
                            <div
                              key={i}
                              className="bg-white dark:bg-white/[0.03] rounded-lg p-3 border border-slate-200 dark:border-white/10"
                            >
                              <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                                {tweet}
                              </p>
                              <div className="flex items-center justify-between mt-1.5">
                                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                  Tweet {i + 1}
                                </span>
                                <span className={cn(
                                  "text-[10px] font-medium",
                                  tweet.length > 280
                                    ? "text-red-500"
                                    : tweet.length > 260
                                    ? "text-amber-500"
                                    : "text-slate-400 dark:text-slate-500"
                                )}>
                                  {tweet.length}/280
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {result.format === "blog-post" && (
                        <div>
                          {result.content.title && (
                            <h4 className="text-sm font-bold text-slate-900 dark:text-gray-100 mb-2">
                              {result.content.title}
                            </h4>
                          )}
                          {result.content.content && (
                            <BlogContent text={result.content.content} />
                          )}
                        </div>
                      )}

                      {result.format === "email-newsletter" && (
                        <div className="space-y-2.5">
                          {result.content.subjectLine && (
                            <div>
                              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                Subject
                              </span>
                              <p className="text-xs font-medium text-slate-900 dark:text-gray-100 mt-0.5">
                                {result.content.subjectLine}
                              </p>
                            </div>
                          )}
                          {result.content.previewText && (
                            <div>
                              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                Preview
                              </span>
                              <p className="text-xs text-slate-600 dark:text-slate-400 italic mt-0.5">
                                {result.content.previewText}
                              </p>
                            </div>
                          )}
                          {result.content.body && (
                            <div>
                              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                Body
                              </span>
                              <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed mt-0.5">
                                {result.content.body}
                              </p>
                            </div>
                          )}
                          {result.content.cta && (
                            <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-lg p-2.5 border border-emerald-100 dark:border-emerald-800">
                              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                                Call to Action
                              </span>
                              <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium mt-0.5">
                                {result.content.cta}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Copy button */}
                    <div className="px-4 py-3 border-t border-slate-100 dark:border-white/10 mt-auto">
                      <button
                        onClick={() => handleCopy(result)}
                        className={cn(
                          "w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold rounded-lg transition-colors",
                          isCopied
                            ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
                            : "border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-white/[0.03]"
                        )}
                      >
                        {isCopied ? (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy to Clipboard
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
