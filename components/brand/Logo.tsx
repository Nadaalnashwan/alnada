// AL NADA wordmark: a single dew drop with a soft highlight, beside the Arabic and Latin names.
// tone="light" for white backgrounds, tone="dark" for green backgrounds.

export function DewDrop({ className = "", tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const fill = tone === "light" ? "#006C35" : "#FFFFFF";
  const shine = tone === "light" ? "#EAF5EE" : "#006C35";
  return (
    <svg viewBox="0 0 24 30" className={className} aria-hidden="true">
      <path d="M12 1.5C12 1.5 3 12.2 3 18.6a9 9 0 0 0 18 0C21 12.2 12 1.5 12 1.5Z" fill={fill} />
      <path d="M8.2 18.2c0-2.3 1.3-4.6 2.6-6.4" stroke={shine} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.9" />
    </svg>
  );
}

export function Logo({ tone = "light", className = "" }: { tone?: "light" | "dark"; className?: string }) {
  const main = tone === "light" ? "text-deep" : "text-white";
  const sub = tone === "light" ? "text-saudi" : "text-soft";
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} aria-label="AL NADA — الندى">
      <DewDrop tone={tone} className="h-8 w-6 shrink-0 animate-dew" />
      <span className="flex flex-col leading-none">
        <span className={`text-[1.45rem] font-bold ${main}`}>الندى</span>
        <span className={`mt-0.5 text-[0.62rem] font-semibold tracking-[0.32em] ${sub}`} dir="ltr">AL NADA</span>
      </span>
    </span>
  );
}
