// Decorative botanical shapes. Purely visual (aria-hidden), drawn in brand greens.
// Used sparingly to add life and depth: never as content, never cartoonish.

type P = { className?: string; style?: React.CSSProperties };

/** A single elongated leaf with a midrib. */
export function Leaf({ className = "", style, fill = "currentColor" }: P & { fill?: string }) {
  return (
    <svg viewBox="0 0 64 120" className={className} style={style} aria-hidden="true">
      <path d="M32 4C12 34 8 70 32 116 56 70 52 34 32 4Z" fill={fill} />
      <path d="M32 14v96M32 40l-11-9M32 58l13-11M32 76l-12-10M32 94l11-9" stroke="white" strokeOpacity="0.35" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** A stem with alternating leaves — for section corners. */
export function Sprig({ className = "", style }: P) {
  return (
    <svg viewBox="0 0 120 200" className={className} style={style} aria-hidden="true" fill="none">
      <path d="M60 196C58 150 62 96 70 8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      {[
        { y: 160, d: -1 }, { y: 128, d: 1 }, { y: 96, d: -1 }, { y: 66, d: 1 }, { y: 38, d: -1 },
      ].map(({ y, d }, i) => (
        <path key={i} d={`M${61 + i} ${y}c${d * 12}-10 ${d * 34}-12 ${d * 46}-2c${-d * 14} 12 ${-d * 36} 10 ${-d * 46} 2Z`} fill="currentColor" opacity={0.85 - i * 0.08} />
      ))}
    </svg>
  );
}

/** Organic soft blob for backgrounds. */
export function Blob({ className = "", style, variant = 1 }: P & { variant?: 1 | 2 | 3 }) {
  const d = {
    1: "M421 315Q399 380 337 413T214 432Q147 418 98 363T47 237Q57 165 112 112T241 51Q311 47 365 92T437 199Q443 250 421 315Z",
    2: "M436 296Q392 342 352 395T246 449Q180 444 127 401T55 286Q38 216 82 156T200 70Q262 47 327 70T427 157Q480 250 436 296Z",
    3: "M404 309Q384 368 330 408T214 437Q152 417 109 368T66 246Q74 175 125 123T244 66Q311 63 361 105T428 211Q424 250 404 309Z",
  }[variant];
  return (
    <svg viewBox="0 0 500 500" className={className} style={style} aria-hidden="true">
      <path d={d} fill="currentColor" />
    </svg>
  );
}

/** A cluster of glossy dew drops. */
export function DewCluster({ className = "" }: P) {
  const drops: [number, number, number, number][] = [[0, 0, 15, 0], [34, 22, 9, 0.6], [8, 44, 6, 1.2], [44, -6, 5, 1.8]];
  return (
    <div aria-hidden className={`pointer-events-none relative size-20 ${className}`}>
      {drops.map(([x, y, s, delay], i) => (
        <span key={i} className="absolute animate-dew rounded-full bg-gradient-to-br from-white via-white to-dew shadow-[var(--shadow-inner-dew)] ring-1 ring-saudi/10"
          style={{ insetInlineStart: x, top: y, width: s * 2, height: s * 2, animationDelay: `${delay}s` }} />
      ))}
    </div>
  );
}

/** A planter pot silhouette that sits under a plant image ("plant box"). */
export function Pot({ className = "", tone = "#e4efe6", rim = "#cfe2d3", style }: P & { tone?: string; rim?: string }) {
  return (
    <svg viewBox="0 0 200 90" className={className} style={style} aria-hidden="true" preserveAspectRatio="none">
      <path d="M6 6h188v16H6z" fill={rim} rx="6" />
      <path d="M18 22h164l-14 62a8 8 0 0 1-8 6H40a8 8 0 0 1-8-6L18 22Z" fill={tone} />
      <path d="M30 40h140" stroke="white" strokeOpacity="0.5" strokeWidth="2" />
    </svg>
  );
}
