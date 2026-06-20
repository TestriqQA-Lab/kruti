"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Robust user avatar. LinkedIn `picture` URLs are signed and time-limited, so they
 * 403 once they expire (and Next's image optimizer can be blocked fetching them
 * server-side) - which previously showed a broken-image icon. This renders a plain
 * <img> (no optimizer) with referrerPolicy="no-referrer" (avoids hotlink blocks) and
 * falls back to the user's initial on any load error, so a stale URL degrades to a
 * clean initials avatar instead of a broken image.
 */
export default function Avatar({
  src,
  name,
  size = 36,
  className,
  fallbackClassName = "bg-blue-600 text-white",
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
  fallbackClassName?: string;
}) {
  const [failed, setFailed] = useState(false);

  // Reset the error state if the URL changes (e.g. after a profile refresh).
  useEffect(() => setFailed(false), [src]);

  const initial = (name?.trim()?.charAt(0) ?? "U").toUpperCase();
  const dims = { width: size, height: size };

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? "User"}
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={cn("rounded-full object-cover flex-shrink-0", className)}
        style={dims}
      />
    );
  }

  return (
    <div
      className={cn("rounded-full flex items-center justify-center font-semibold flex-shrink-0", fallbackClassName, className)}
      style={{ ...dims, fontSize: Math.round(size * 0.42) }}
      aria-label={name ?? "User"}
    >
      {initial}
    </div>
  );
}
