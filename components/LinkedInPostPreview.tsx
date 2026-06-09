"use client";

import { useState } from "react";
import {
  Eye,
  Globe,
  MoreHorizontal,
  ThumbsUp,
  Heart,
  MessageCircle,
  Repeat2,
  Send,
  FileText,
} from "lucide-react";
import Image from "next/image";
import { formatPostBody, cleanInline } from "@/lib/format";

interface LinkedInPostPreviewProps {
  name: string | null;
  image: string | null;
  headline: string | null;
  title: string;
  body: string;
  hashtags: string[];
  postSignature: string | null;
  imageUrl: string | null;
  carouselImages?: string[];
  documentName?: string | null;
  watermark?: string | null;
}

const TRUNCATE_LENGTH = 210;

const ENGAGEMENT_BUTTONS = [
  { icon: ThumbsUp, label: "Like" },
  { icon: MessageCircle, label: "Comment" },
  { icon: Repeat2, label: "Repost" },
  { icon: Send, label: "Send" },
];

export default function LinkedInPostPreview({
  name,
  image,
  headline,
  title,
  body,
  hashtags,
  postSignature,
  imageUrl,
  carouselImages = [],
  documentName,
  watermark,
}: LinkedInPostPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const [slide, setSlide] = useState(0);

  // Compose full post text: hook directly above the body (no blank-line gap),
  // with markdown stripped and list items spaced for an accurate preview.
  const cleanBody = formatPostBody(body);
  const fullText = title ? `${cleanInline(title)}\n${cleanBody}` : cleanBody;
  const shouldTruncate = fullText.length > TRUNCATE_LENGTH;

  return (
    <div className="mt-4">
      {/* Section label */}
      <div className="flex items-center gap-2 mb-3">
        <Eye className="w-4 h-4 text-slate-400 dark:text-slate-500" />
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          LinkedIn Preview
        </span>
      </div>

      {/* LinkedIn card */}
      <div className="bg-white dark:bg-[#1b1f23] border border-slate-200 dark:border-white/10 rounded-lg overflow-hidden shadow-sm max-w-[552px]">
        {/* Author header */}
        <div className="px-4 pt-3 pb-2 flex items-start gap-2.5">
          {/* Avatar */}
          {image ? (
            <Image
              src={image}
              alt={name ?? "User"}
              width={48}
              height={48}
              className="rounded-full flex-shrink-0"
              unoptimized
            />
          ) : (
            <div className="w-12 h-12 bg-[#0A66C2] rounded-full flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
              {name?.[0]?.toUpperCase() ?? "U"}
            </div>
          )}

          {/* Name, headline, time */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold text-slate-900 dark:text-gray-100 truncate">
                {name ?? "Your Name"}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
                &bull; 1st
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate leading-snug">
              {headline ?? "Your headline"}
            </p>
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 leading-snug">
              <span>Just now</span>
              <span>&bull;</span>
              <Globe className="w-3 h-3" />
            </div>
          </div>

          {/* Three-dot menu (decorative) */}
          <MoreHorizontal className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0 mt-1" />
        </div>

        {/* Post body */}
        <div className="px-4 pb-2">
          {fullText ? (
            <p className="text-[14px] text-slate-900 dark:text-gray-100 whitespace-pre-wrap leading-[1.4]">
              {expanded || !shouldTruncate
                ? fullText
                : fullText.slice(0, TRUNCATE_LENGTH).trimEnd()}
              {shouldTruncate && !expanded && (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="text-slate-500 dark:text-slate-400 hover:text-[#0A66C2] hover:underline ml-1 text-[14px]"
                >
                  ...see more
                </button>
              )}
            </p>
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500 italic">
              Your post content will appear here...
            </p>
          )}
        </div>

        {/* Hashtags */}
        {hashtags.length > 0 && (
          <div className="px-4 pb-2">
            <p className="text-[14px] text-[#0A66C2] dark:text-blue-400 leading-[1.4]">
              {hashtags.map((tag) => `#${tag}`).join(" ")}
            </p>
          </div>
        )}

        {/* Signature */}
        {postSignature && (
          <div className="px-4 pb-2">
            <p className="text-[14px] text-slate-600 dark:text-slate-400 whitespace-pre-line leading-[1.4]">
              {postSignature}
            </p>
          </div>
        )}

        {/* Watermark */}
        {watermark && (
          <div className="px-4 pb-2">
            <p className="text-[14px] text-slate-600 dark:text-slate-400 whitespace-pre-line leading-[1.4]">
              {watermark}
            </p>
          </div>
        )}

        {/* Post media - PDF document, else carousel slider, else single image */}
        {documentName ? (
          <div className="mx-4 mb-3 rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden">
            <div className="aspect-[1.91/1] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/[0.06] dark:to-white/[0.02] flex items-center justify-center">
              <FileText className="w-12 h-12 text-slate-400 dark:text-slate-500" />
            </div>
            <div className="px-3 py-2 border-t border-slate-200 dark:border-white/10 flex items-center gap-2">
              <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-[13px] font-medium text-slate-700 dark:text-slate-200 truncate">
                {documentName}
              </span>
              <span className="ml-auto text-[11px] text-slate-400">PDF</span>
            </div>
          </div>
        ) : carouselImages.length > 0 ? (
          <div className="relative w-full aspect-square bg-slate-100 dark:bg-white/[0.06] select-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={carouselImages[Math.min(slide, carouselImages.length - 1)]}
              alt={`Slide ${Math.min(slide, carouselImages.length - 1) + 1}`}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <span className="absolute top-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">
              {Math.min(slide, carouselImages.length - 1) + 1}/{carouselImages.length}
            </span>
            {carouselImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setSlide((s) => (s > 0 ? s - 1 : carouselImages.length - 1))}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/45 hover:bg-black/65 text-white flex items-center justify-center text-lg leading-none"
                  aria-label="Previous slide"
                >
                  &#8249;
                </button>
                <button
                  type="button"
                  onClick={() => setSlide((s) => (s < carouselImages.length - 1 ? s + 1 : 0))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/45 hover:bg-black/65 text-white flex items-center justify-center text-lg leading-none"
                  aria-label="Next slide"
                >
                  &#8250;
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {carouselImages.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 rounded-full transition-all ${
                        i === Math.min(slide, carouselImages.length - 1) ? "w-4 bg-white" : "w-1.5 bg-white/50"
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : imageUrl ? (
          <div className="relative w-full aspect-[1.91/1] bg-slate-100 dark:bg-white/[0.06]">
            <Image src={imageUrl} alt="Post image" fill className="object-cover" unoptimized />
          </div>
        ) : null}

        {/* Reactions bar (decorative) */}
        <div className="px-4 py-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1">
            <span className="flex -space-x-0.5">
              <span className="w-[18px] h-[18px] rounded-full bg-[#0A66C2] flex items-center justify-center ring-1 ring-white dark:ring-[#1b1f23]">
                <ThumbsUp className="w-2.5 h-2.5 text-white" />
              </span>
              <span className="w-[18px] h-[18px] rounded-full bg-red-500 flex items-center justify-center ring-1 ring-white dark:ring-[#1b1f23]">
                <Heart className="w-2.5 h-2.5 text-white" />
              </span>
            </span>
            <span className="ml-1">42</span>
          </div>
          <div className="flex items-center gap-2">
            <span>5 comments</span>
            <span>&bull;</span>
            <span>2 reposts</span>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-200 dark:border-white/10 mx-4" />

        {/* Engagement buttons (decorative) */}
        <div className="px-2 py-0.5 flex items-center justify-between">
          {ENGAGEMENT_BUTTONS.map(({ icon: Icon, label }) => (
            <button
              key={label}
              type="button"
              disabled
              className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 rounded-lg cursor-default hover:bg-transparent"
            >
              <Icon className="w-5 h-5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
