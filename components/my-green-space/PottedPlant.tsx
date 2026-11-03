"use client";

import { CircleHelp, Droplets, Leaf, Plus, Sparkles, Sun } from "lucide-react";
import { PlantImage } from "@/components/store/PlantImage";

// A single plant standing on the garden shelf. Every plant uses exactly the same slot: the same arched
// photo frame (photo cropped with object-fit: cover), the same matching ceramic pot, the same baseline and
// the same label block — so species look different only through their own photos, never through the layout.

export type Habit = "upright" | "climbing" | "trailing" | "rosette" | "bushy" | "tree";
export type Size = "small" | "medium" | "large";

/** Shared slot geometry (px, multiplied by --plant-scale). The shelf in Garden.tsx aligns to POT_H + LABEL_H. */
export const SLOT = { width: 124, frameW: 108, frameH: 132, potW: 100, potH: 64, sink: 18 } as const;
/** Fixed label block under every pot (rem); the shelf sits in the gap above it. */
export const LABEL_BLOCK = "h-[3.25rem]";
const px = (n: number) => `calc(${n}px * var(--plant-scale, 1))`;

/** The one ceramic pot used for every plant: warm glazed white with a slim brand-green band. */
export function Pot({ width = SLOT.potW, empty = false, scaled = false }: { id?: string; width?: number; empty?: boolean; scaled?: boolean }) {
  const height = Math.round(width * (SLOT.potH / SLOT.potW));
  const gid = empty ? "pot-empty" : "pot-glaze";
  return (
    <svg viewBox="0 0 100 64" className="block overflow-visible" aria-hidden
      style={scaled ? { width: px(width), height: px(height) } : { width, height }}>
      <defs>
        <linearGradient id={gid} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={empty ? "#f3eee3" : "#e9e2d3"} />
          <stop offset="0.35" stopColor={empty ? "#fbf8f1" : "#fbf8f0"} />
          <stop offset="1" stopColor={empty ? "#ece6d8" : "#ddd4c1"} />
        </linearGradient>
      </defs>
      {/* contact shadow on the shelf */}
      <ellipse cx="50" cy="63" rx="36" ry="3" fill="rgb(60 45 25 / 0.18)" />
      {/* body */}
      <path d="M9 10 H91 L83 58 Q82 62 77 62 H23 Q18 62 17 58 Z" fill={`url(#${gid})`}
        stroke={empty ? "#a9c8a0" : "#d6ccb7"} strokeWidth={empty ? 1.6 : 0.9} strokeDasharray={empty ? "4 3" : undefined} vectorEffect="non-scaling-stroke" />
      {!empty && <path d="M12.6 30 H87.4" stroke="#006c35" strokeOpacity="0.55" strokeWidth="2.2" />}
      {!empty && <path d="M24 16 Q22 38 28 56" stroke="white" strokeOpacity="0.55" strokeWidth="4" strokeLinecap="round" fill="none" />}
      {/* rim + soil */}
      <rect x="4" y="3" width="92" height="10" rx="4.5" fill={empty ? "#f1ece0" : "#f4efe4"}
        stroke={empty ? "#a9c8a0" : "#d6ccb7"} strokeWidth={empty ? 1.6 : 0.9} strokeDasharray={empty ? "4 3" : undefined} vectorEffect="non-scaling-stroke" />
      <ellipse cx="50" cy="5.5" rx="41" ry="2.6" fill={empty ? "#e5dfd0" : "#5b4632"} />
    </svg>
  );
}

export interface PottedPlantProps {
  id: string;
  image: string | null;
  label: string;
  sublabel: string;
  status: "on_track" | "soil_check_due" | "light_mismatch" | "no_watering_recorded" | "unconfirmed";
  statusLabel: string;
  selected: boolean;
  watering: boolean;
  /** Briefly true right after a care log for this plant was saved. */
  celebrate?: boolean;
  /** Care tasks due now, from its own records. */
  due?: number;
  onSelect: () => void;
  index: number;
}

/** Shared slot wrapper: identical width, plant area height and label block for plants and the add slot. */
function Slot({ children, label, index }: { children: React.ReactNode; label: React.ReactNode; index: number }) {
  return (
    <li className="flex shrink-0 snap-center flex-col items-center" style={{ width: px(SLOT.width), animation: `settle 0.6s var(--ease-organic) ${index * 60}ms both` }}>
      {children}
      <span className={`mt-3 flex w-full flex-col items-center justify-start ${LABEL_BLOCK}`}>{label}</span>
    </li>
  );
}

export function PottedPlant({ id, image, label, sublabel, status, statusLabel, selected, watering, celebrate = false, due = 0, onSelect, index }: PottedPlantProps) {
  const alert = status === "soil_check_due" || status === "light_mismatch";
  const StatusIcon = status === "soil_check_due" ? Droplets : status === "light_mismatch" ? Sun : status === "unconfirmed" ? CircleHelp : null;

  return (
    <Slot index={index} label={
      <button type="button" onClick={onSelect} tabIndex={-1} aria-hidden className="flex w-full flex-col items-center">
        <span className={`max-w-full truncate rounded-full px-3 py-1 text-xs font-bold leading-4 transition duration-300 ${selected ? "bg-saudi text-white shadow-[var(--shadow-glow)]" : "bg-white text-forest ring-1 ring-saudi/10"}`}>{label}</span>
        <span className="mt-1 h-4 max-w-full truncate text-[11px] leading-4 text-muted">{sublabel}</span>
      </button>
    }>
      <button type="button" onClick={onSelect} aria-pressed={selected} aria-controls="plant-details" aria-label={`${label} — ${statusLabel}${due ? ` · ${due}` : ""}`} data-plant-id={id}
        className="group relative flex flex-col items-center rounded-[1.75rem] outline-none focus-visible:ring-2 focus-visible:ring-saudi/60 focus-visible:ring-offset-4 focus-visible:ring-offset-transparent">
        {/* soft light behind the selected plant */}
        <span aria-hidden className={`pointer-events-none absolute -inset-x-3 -top-3 bottom-6 rounded-full bg-[radial-gradient(closest-side,rgb(140_197_111/0.38),transparent)] transition duration-700 ${selected ? "animate-glow opacity-100" : "opacity-0 group-hover:opacity-60"}`} />
        {watering && (
          <span aria-hidden className="pointer-events-none absolute -top-2 z-30 flex gap-2">
            {[0, 1, 2].map((d) => <span key={d} className="block h-3.5 w-2.5 animate-drip rounded-[50%_50%_50%_50%/60%_60%_40%_40%] bg-gradient-to-b from-sky-200 to-sky-400 shadow-sm" style={{ animationDelay: `${d * 160}ms` }} />)}
          </span>
        )}
        {/* a small celebration only after a care log was really saved */}
        {celebrate && (
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-1 z-30 flex justify-center gap-5 text-leaf">
            {[Leaf, Sparkles, Leaf].map((I, d) => <I key={d} className="size-4 animate-bloom" style={{ animationDelay: `${d * 120}ms` }} />)}
          </span>
        )}
        {/* care tasks due now (from records) — a gentle attention dot on the frame */}
        {due > 0 && !selected && (
          <span aria-hidden className="absolute -top-1 start-2 z-20 grid min-w-5 place-items-center rounded-full bg-warn-bg px-1 text-[10px] font-bold leading-5 text-warn shadow-sm ring-2 ring-white">
            <span className="absolute inset-0 animate-ping rounded-full bg-warn/20 [animation-duration:2.4s]" />{due}
          </span>
        )}
        {/* identical arched frame for every plant; the photo always covers it */}
        <span className={`relative z-0 block origin-bottom overflow-hidden rounded-t-full rounded-b-[1.1rem] bg-soft shadow-[0_16px_26px_-16px_rgb(16_61_40/0.55)] ring-[3px] transition duration-500 ease-[var(--ease-organic)] group-hover:animate-sway-soft ${selected ? "scale-[1.04] ring-white" : "ring-white/80 group-hover:scale-[1.02]"}`}
          style={{ width: px(SLOT.frameW), height: px(SLOT.frameH), marginBottom: px(-SLOT.sink) }}>
          <PlantImage src={image} alt="" sizes={`${SLOT.frameW * 2}px`} className="object-[center_40%]" />
          <span className="absolute inset-0 bg-gradient-to-t from-forest/25 via-transparent to-white/10" />
        </span>
        <span className="relative z-10 drop-shadow-[0_8px_8px_rgb(16_61_40/0.14)]">
          <Pot scaled />
          {StatusIcon && (
            <span className={`absolute -end-1 top-0 grid size-6 place-items-center rounded-full shadow-sm ring-2 ring-white ${alert ? "bg-warn-bg text-warn" : "bg-white text-muted"}`} title={statusLabel}>
              <StatusIcon className="size-3.5" />
            </span>
          )}
        </span>
      </button>
    </Slot>
  );
}

/** The "add a plant" slot: the same frame outline and the same pot, empty, on the same shelf. */
export function AddPlantPot({ href, label, hint, index = 0 }: { href: string; label: string; hint: string; index?: number }) {
  return (
    <Slot index={index} label={<a href={href} tabIndex={-1} aria-hidden className="flex w-full flex-col items-center"><span className="max-w-full truncate rounded-full bg-white px-3 py-1 text-xs font-bold leading-4 text-saudi ring-1 ring-saudi/15">{label}</span><span className="mt-1 h-4 max-w-full truncate text-[11px] leading-4 text-muted">{hint}</span></a>}>
      <a href={href} aria-label={label} className="group relative flex flex-col items-center rounded-[1.75rem] outline-none focus-visible:ring-2 focus-visible:ring-saudi/60">
        <span className="relative z-0 grid place-items-center rounded-t-full rounded-b-[1.1rem] border-2 border-dashed border-saudi/25 bg-white/50 transition duration-500 group-hover:border-saudi/60 group-hover:bg-white"
          style={{ width: px(SLOT.frameW), height: px(SLOT.frameH), marginBottom: px(-SLOT.sink) }}>
          <span className="-mt-4 grid size-12 place-items-center rounded-full bg-white text-saudi shadow-[var(--shadow-card)] transition duration-500 group-hover:rotate-90 group-hover:bg-saudi group-hover:text-white"><Plus className="size-6" /></span>
        </span>
        <span className="relative z-10"><Pot empty scaled /></span>
      </a>
    </Slot>
  );
}
