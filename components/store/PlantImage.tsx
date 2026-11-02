"use client";

import Image from "next/image";
import { useState } from "react";
import { DewDrop } from "@/components/brand/Logo";

/** Optimised remote image with a branded fallback if the source fails. */
export function PlantImage({ src, alt, sizes, priority, className = "" }: { src: string | null; alt: string; sizes: string; priority?: boolean; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`grid h-full w-full place-items-center bg-soft ${className}`} role="img" aria-label={alt}>
        <DewDrop className="h-10 w-8 opacity-40" />
      </div>
    );
  }
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={`object-cover ${className}`} onError={() => setFailed(true)} />;
}
