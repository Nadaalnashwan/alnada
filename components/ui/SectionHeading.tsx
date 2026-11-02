import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

/** Eyebrow + title + optional lead and "view all" link — consistent hierarchy across sections. */
export function SectionHeading({ eyebrow, title, lead, href, linkLabel, locale, align = "start", tone = "light" }: {
  eyebrow?: string; title: string; lead?: string; href?: string; linkLabel?: string; locale: "ar" | "en"; align?: "start" | "center"; tone?: "light" | "dark";
}) {
  const Arrow = locale === "ar" ? ArrowLeft : ArrowRight;
  const dark = tone === "dark";
  return (
    <div className={`mb-9 flex gap-4 ${align === "center" ? "flex-col items-center text-center" : "flex-wrap items-end justify-between"}`}>
      <div className="max-w-2xl">
        {eyebrow && <p className={`mb-3 text-xs font-bold tracking-[0.18em] ${dark ? "text-sprout" : "text-leaf"}`}>{eyebrow}</p>}
        <h2 className={`section-title ${dark ? "!text-white" : ""}`}>{title}</h2>
        {lead && <p className={`mt-3 leading-8 ${dark ? "text-white/70" : "text-muted"}`}>{lead}</p>}
      </div>
      {href && linkLabel && (
        <Link href={href} className={`group inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${dark ? "bg-white/10 text-white hover:bg-white/15" : "bg-soft text-saudi hover:bg-dew"}`}>
          {linkLabel}<Arrow className="size-4 transition group-hover:-translate-x-0.5 ltr:group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
