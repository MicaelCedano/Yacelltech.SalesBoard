"use client";

import React, { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

interface AvatarBadgeProps {
  src: string | null | undefined;
  name: string;
  accentColor?: string;
  size?: "sm" | "md" | "lg" | "xl" | "tv";
  isFirstPlace?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AvatarBadgeProps["size"]>, string> = {
  sm: "h-9 w-9 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-20 w-20 text-xl",
  tv: "h-16 w-16 sm:h-20 sm:w-20 2xl:h-24 2xl:w-24 text-lg sm:text-xl",
};

// Existing YacellTech uploads are 648×1011 promotional cards. Their portrait
// occupies this square, above the printed name. Frame it without rewriting the
// original upload; ordinary photos continue using the normal centered crop.
const PORTRAIT_CARD_FRAME: React.CSSProperties = {
  position: "absolute",
  left: `${(-154 / 340) * 100}%`,
  top: `${(-180 / 340) * 100}%`,
  width: `${(648 / 340) * 100}%`,
  height: `${(1011 / 340) * 100}%`,
  maxWidth: "none",
};

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "YT";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

export function AvatarBadge({
  src,
  name,
  accentColor = "#007AFF",
  size = "md",
  isFirstPlace = false,
  className,
}: AvatarBadgeProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [portraitCardSrc, setPortraitCardSrc] = useState<string | null>(null);
  const showImage = Boolean(src && src !== failedSrc);
  const framePortrait = Boolean(src && src === portraitCardSrc);
  const updateFraming = useCallback((image: HTMLImageElement | null) => {
    if (!image?.complete || image.naturalWidth === 0) return;
    const { naturalWidth, naturalHeight } = image;
    // Exact proportions also support larger exports of this template.
    const isPortraitCard = naturalWidth * 1011 === naturalHeight * 648;
    setPortraitCardSrc(isPortraitCard ? src ?? null : null);
  }, [src]);

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden select-none bg-muted",
        SIZE_CLASSES[size],
        isFirstPlace
          ? "ring-1 ring-separator"
          : "",
        className
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={updateFraming}
          src={src!}
          alt={name}
          decoding="async"
          onLoad={(event) => updateFraming(event.currentTarget)}
          onError={() => setFailedSrc(src ?? null)}
          data-framing={framePortrait ? "portrait-card" : "photo"}
          style={framePortrait ? PORTRAIT_CARD_FRAME : undefined}
          className="h-full w-full object-cover bg-muted"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center font-medium text-foreground"
          style={{
            backgroundColor: `${accentColor}16`,
          }}
        >
          {getInitials(name)}
        </div>
      )}
    </div>
  );
}
