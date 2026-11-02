"use client";

import { useEffect, useRef } from "react";

/**
 * Fades/slides children in when they enter the viewport (CSS in globals.css: [data-reveal]).
 * Server-rendered content stays visible without JS thanks to the <noscript>-safe default below.
 */
export function Reveal({ children, delay = 0, className = "", as: Tag = "div" }: { children: React.ReactNode; delay?: number; className?: string; as?: "div" | "section" | "li" | "article" }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) { el.dataset.shown = "true"; return; }
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.dataset.shown = "true"; io.disconnect(); } },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    // @ts-expect-error polymorphic ref
    <Tag ref={ref} data-reveal className={className} style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}>
      {children}
    </Tag>
  );
}
