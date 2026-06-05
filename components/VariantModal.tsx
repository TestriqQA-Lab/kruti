"use client";

import { X, Loader2, Zap, BookOpen, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Variant {
  title: string;
  body: string;
  hashtags: string[];
  imagePrompt: string;
  style: string;
}

const STYLE_META: Record<string, { icon: typeof Zap; color: string; darkColor: string; label: string }> = {
  "Bold & Direct": {
    icon: Zap,
    color: "bg-orange-100 text-orange-700 border-orange-200",
    darkColor: "dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
    label: "Bold & Direct",
  },
  "Personal Story": {
    icon: BookOpen,
    color: "bg-purple-100 text-purple-700 border-purple-200",
    darkColor: "dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800",
    label: "Personal Story",
  },
  "Practical & Tactical": {
    icon: Wrench,
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    darkColor: "dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
    label: "Practical & Tactical",
  },
};

export default function VariantModal({
  variants,
  loading,
  onSelect,
  onClose,
}: {
  variants: Variant[];
  loading: boolean;
  onSelect: (variant: Variant) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#0D131F] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-gray-100">
              Choose a Variant
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Three different styles generated for this post — pick your favorite
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
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Generating 3 variants with different styles...
              </p>
              {/* Skeleton cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mt-4">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="bg-slate-50 dark:bg-white/[0.06] rounded-xl p-5 animate-pulse space-y-3"
                  >
                    <div className="h-5 bg-slate-200 dark:bg-white/[0.08] rounded w-24" />
                    <div className="h-4 bg-slate-200 dark:bg-white/[0.08] rounded w-full" />
                    <div className="space-y-2">
                      <div className="h-3 bg-slate-200 dark:bg-white/[0.08] rounded w-full" />
                      <div className="h-3 bg-slate-200 dark:bg-white/[0.08] rounded w-5/6" />
                      <div className="h-3 bg-slate-200 dark:bg-white/[0.08] rounded w-4/6" />
                      <div className="h-3 bg-slate-200 dark:bg-white/[0.08] rounded w-full" />
                      <div className="h-3 bg-slate-200 dark:bg-white/[0.08] rounded w-3/6" />
                    </div>
                    <div className="h-8 bg-slate-200 dark:bg-white/[0.08] rounded w-full mt-4" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {variants.map((variant, i) => {
                const meta = STYLE_META[variant.style] ?? STYLE_META["Bold & Direct"];
                const Icon = meta.icon;
                return (
                  <div
                    key={i}
                    className="flex flex-col bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    {/* Style badge */}
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

                    {/* Title */}
                    <div className="px-4 pb-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-gray-100 line-clamp-2">
                        {variant.title}
                      </h3>
                    </div>

                    {/* Body preview */}
                    <div className="px-4 pb-3 flex-1">
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-8 whitespace-pre-wrap">
                        {variant.body}
                      </p>
                    </div>

                    {/* Hashtags */}
                    <div className="px-4 pb-3">
                      <div className="flex flex-wrap gap-1">
                        {variant.hashtags.slice(0, 3).map((tag, j) => (
                          <span
                            key={j}
                            className="text-[10px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded"
                          >
                            #{tag}
                          </span>
                        ))}
                        {variant.hashtags.length > 3 && (
                          <span className="text-[10px] text-slate-400">
                            +{variant.hashtags.length - 3}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action */}
                    <div className="px-4 pb-4">
                      <button
                        onClick={() => onSelect(variant)}
                        className="w-full py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Use This
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
