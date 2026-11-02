"use client";

// AL NADA identity: a single dew drop holding a leaf — freshness, growth and calm intelligence.
// tone="light" for white/tinted backgrounds, tone="dark" for forest backgrounds.
import { useId } from "react";

export function DewDrop({ className = "", tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const id = useId().replace(/:/g, "");
  const dark = tone === "dark";
  return (
    <svg viewBox="0 0 32 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`g${id}`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor={dark ? "#ffffff" : "#3e9b4f"} />
          <stop offset="1" stopColor={dark ? "#dff1e6" : "#004d26"} />
        </linearGradient>
      </defs>
      <path d="M16 2.5C16 2.5 4 16.6 4 25.2a12 12 0 0 0 24 0C28 16.6 16 2.5 16 2.5Z" fill={`url(#g${id})`} />
      {/* leaf inside the drop */}
      <path d="M11.2 30.4c.6-6.1 4.4-10.3 10.2-11.6-.4 6.4-4.6 10.9-10.2 11.6Z" fill={dark ? "#006c35" : "#ffffff"} opacity={dark ? 0.9 : 0.92} />
      <path d="M11.6 30c2.6-3.4 5.2-6 8.7-9.6" stroke={dark ? "#dff1e6" : "#3e9b4f"} strokeWidth="0.9" strokeLinecap="round" fill="none" />
      {/* highlight */}
      <ellipse cx="11" cy="19" rx="1.6" ry="3.2" transform="rotate(24 11 19)" fill="#ffffff" opacity={dark ? 0.45 : 0.55} />
    </svg>
  );
}

export function Logo({ tone = "light", className = "", compact = false }: { tone?: "light" | "dark"; className?: string; compact?: boolean }) {
  const main = tone === "light" ? "text-forest" : "text-white";
  const sub = tone === "light" ? "text-saudi" : "text-sprout";
  return (
    <span className={`group/logo inline-flex items-center gap-2.5 ${className}`} aria-label="AL NADA — الندى">
      <span className="relative grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-dew to-white shadow-[var(--shadow-inner-dew)] ring-1 ring-saudi/10 transition duration-500 group-hover/logo:rotate-[-6deg]" style={tone === "dark" ? { background: "rgb(255 255 255 / 0.08)", boxShadow: "none" } : undefined}>
        <DewDrop tone={tone} className="h-7 w-6 animate-dew" />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className={`text-[1.5rem] font-bold ${main}`}>الندى</span>
          <span className={`mt-1 text-[0.6rem] font-semibold tracking-[0.38em] ${sub}`} dir="ltr">AL NADA</span>
        </span>
      )}
    </span>
  );
}
