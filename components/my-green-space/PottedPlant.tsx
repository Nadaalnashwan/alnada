"use client";

import { CircleHelp, Droplets, Plus, Sun } from "lucide-react";
import { PlantImage } from "@/components/store/PlantImage";

// A single plant standing on the garden shelf: its real photo shaped into a silhouette that follows
// the species' growth habit and size, planted in a decorative pot. Pots/tones are stable per plant.

export type Habit = "upright" | "climbing" | "trailing" | "rosette" | "bushy" | "tree";
export type Size = "small" | "medium" | "large";

const CROWN_SHAPE: Record<Habit, string> = {
  upright: "46% 46% 42% 42% / 60% 60% 40% 40%",
  climbing: "44% 44% 40% 40% / 62% 62% 38% 38%",
  tree: "50% 50% 46% 46% / 66% 66% 34% 34%",
  bushy: "54% 46% 50% 50% / 58% 56% 44% 42%",
  trailing: "50% 50% 46% 46% / 46% 46% 54% 54%",
  rosette: "50%",
};
const BASE: Record<Size, [number, number]> = { small: [92, 92], medium: [114, 128], large: [132, 172] };
const HABIT_SCALE: Record<Habit, [number, number]> = {
  upright: [0.92, 1.08], climbing: [0.9, 1.14], tree: [0.94, 1.12], bushy: [1.08, 0.92], trailing: [1.16, 0.88], rosette: [1, 0.86],
};

const POTS = [
  { body: "#f3eee3", rim: "#e6dcc6", band: "#e9e1cf", soil: "#5b4632" }, // ivory ceramic
  { body: "#c9ddcc", rim: "#b4cfb9", band: "#bed6c3", soil: "#4f3d2c" }, // sage glaze
  { body: "#c98a68", rim: "#b8775a", band: "#c07f5f", soil: "#4d3a28" }, // natural clay
  { body: "#2f6a4a", rim: "#245a3d", band: "#2a6243", soil: "#3f3022" }, // deep green glaze
  { body: "#fbfaf6", rim: "#ebe8df", band: "#f1eee6", soil: "#5a4531" }, // matte white
] as const;
const POT_SHAPES = ["tapered", "cylinder", "bowl", "footed"] as const;

function hash(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

export function Pot({ id, width, empty = false, scaled = false }: { id: string; width: number; empty?: boolean; scaled?: boolean }) {
  const h = hash(id);
  const tone = POTS[h % POTS.length];
  const light = tone.body === "#f3eee3" || tone.body === "#fbfaf6"; // ivory/white pots need an outline on the ivory wall
  const shape = POT_SHAPES[(h >> 3) % POT_SHAPES.length];
  const height = Math.round(width * (shape === "bowl" ? 0.5 : shape === "cylinder" ? 0.7 : 0.64));
  const body = {
    tapered: "M8 14 H92 L82 96 Q81 100 76 100 H24 Q19 100 18 96 Z",
    cylinder: "M12 14 H88 V94 Q88 100 82 100 H18 Q12 100 12 94 Z",
    bowl: "M6 14 H94 Q92 70 72 92 Q66 100 56 100 H44 Q34 100 28 92 Q8 70 6 14 Z",
    footed: "M10 14 H90 Q88 58 70 78 L74 92 Q75 100 68 100 H32 Q25 100 26 92 L30 78 Q12 58 10 14 Z",
  }[shape];
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="block overflow-visible" aria-hidden
      style={scaled ? { width: `calc(${width}px * var(--plant-scale, 1))`, height: `calc(${height}px * var(--plant-scale, 1))` } : { width, height }}>
      {!empty && <ellipse cx="50" cy="14" rx="42" ry="6" fill={tone.soil} />}
      <path d={body} fill={empty ? "#f4f0e6" : tone.body} stroke={empty ? "#a9c8a0" : light ? "#d9d0bb" : "none"} strokeWidth={empty ? 2 : light ? 1.2 : 0} strokeDasharray={empty ? "5 4" : undefined} vectorEffect="non-scaling-stroke" />
      {empty && <ellipse cx="50" cy="14" rx="40" ry="5" fill="#e3dccb" />}
      {!empty && <path d="M24 30 Q22 60 30 88" stroke="white" strokeOpacity="0.35" strokeWidth="5" strokeLinecap="round" fill="none" />}
      {!empty && shape !== "bowl" && <path d={`M${shape === "cylinder" ? 12 : 11} 40 H${shape === "cylinder" ? 88 : 89}`} stroke={tone.band} strokeWidth="3" />}
      <rect x="2" y="6" width="96" height="12" rx="5" fill={empty ? "#ece6d6" : tone.rim} stroke={empty ? "#a9c8a0" : light ? "#d9d0bb" : "none"} strokeWidth={empty ? 2 : light ? 1.2 : 0} strokeDasharray={empty ? "5 4" : undefined} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export interface PottedPlantProps {
  id: string;
  image: string | null;
  label: string;
  sublabel: string;
  habit: Habit;
  size: Size;
  status: "on_track" | "soil_check_due" | "light_mismatch" | "no_watering_recorded" | "unconfirmed";
  statusLabel: string;
  selected: boolean;
  watering: boolean;
  onSelect: () => void;
  index: number;
}

export function PottedPlant({ id, image, label, sublabel, habit, size, status, statusLabel, selected, watering, onSelect, index }: PottedPlantProps) {
  const [bw, bh] = BASE[size];
  const [sx, sy] = HABIT_SCALE[habit];
  const w = Math.round(bw * sx);
  const h = Math.round(bh * sy);
  const potW = Math.round(Math.max(76, w * 0.8));
  const trailing = habit === "trailing";
  const alert = status === "soil_check_due" || status === "light_mismatch";
  const StatusIcon = status === "soil_check_due" ? Droplets : status === "light_mismatch" ? Sun : status === "unconfirmed" ? CircleHelp : null;

  return (
    <li className="flex shrink-0 snap-center flex-col items-center" style={{ animation: `settle 0.6s var(--ease-organic) ${index * 70}ms both` }}>
      <button type="button" onClick={onSelect} aria-pressed={selected} aria-controls="plant-details" aria-label={`${label} — ${statusLabel}`}
        className="group relative flex flex-col items-center rounded-[2rem] px-2 pt-3 outline-none transition duration-500 ease-[var(--ease-organic)] focus-visible:ring-2 focus-visible:ring-saudi/60">
        {/* selection glow */}
        <span aria-hidden className={`pointer-events-none absolute inset-x-0 bottom-6 top-0 rounded-full bg-[radial-gradient(closest-side,rgb(140_197_111/0.45),transparent)] transition duration-700 ${selected ? "animate-glow opacity-100" : "opacity-0 group-hover:opacity-50"}`} />

        <span className={`relative flex flex-col items-center transition duration-500 ease-[var(--ease-organic)] ${selected ? "-translate-y-2" : "group-hover:-translate-y-1"}`}>
          {/* watering drops */}
          {watering && (
            <span aria-hidden className="pointer-events-none absolute -top-2 z-30 flex gap-2">
              {[0, 1, 2].map((d) => <span key={d} className="block h-3.5 w-2.5 animate-drip rounded-[50%_50%_50%_50%/60%_60%_40%_40%] bg-gradient-to-b from-sky-200 to-sky-400 shadow-sm" style={{ animationDelay: `${d * 160}ms` }} />)}
            </span>
          )}
          {/* climbing plants get a moss pole */}
          {habit === "climbing" && <span aria-hidden className="absolute bottom-6 z-0 w-1.5 rounded-full bg-[#7a6248]" style={{ height: `calc(${h + 10}px * var(--plant-scale, 1))` }} />}
          {/* foliage — the real photo, shaped like the plant */}
          <span className={`relative block origin-bottom overflow-hidden bg-soft shadow-[0_14px_24px_-14px_rgb(11_58_34/0.6)] ring-2 transition duration-500 group-hover:animate-sway-soft ${selected ? "scale-[1.04] ring-white" : "ring-white/70"} ${trailing ? "z-20 -mb-7" : "z-0 -mb-4"}`}
            style={{ width: `calc(${w}px * var(--plant-scale, 1))`, height: `calc(${h}px * var(--plant-scale, 1))`, borderRadius: CROWN_SHAPE[habit] }}>
            <PlantImage src={image} alt="" sizes={`${w * 2}px`} />
            <span className="absolute inset-0 bg-gradient-to-t from-forest/25 via-transparent to-white/10" />
          </span>
          {/* pot */}
          <span className="relative z-10 drop-shadow-[0_10px_8px_rgb(11_58_34/0.18)]">
            <Pot id={id} width={potW} scaled />
            {StatusIcon && (
              <span className={`absolute -end-1.5 -top-1 grid size-6 place-items-center rounded-full shadow-sm ring-2 ring-white ${alert ? "bg-warn-bg text-warn" : "bg-white text-muted"}`} title={statusLabel}>
                <StatusIcon className="size-3.5" />
              </span>
            )}
          </span>
        </span>

        {/* name tag */}
        <span className={`relative z-10 mt-3 max-w-[8rem] rounded-full px-3 py-1 sm:max-w-[9.5rem] text-center text-xs font-bold transition duration-300 ${selected ? "bg-saudi text-white shadow-[var(--shadow-glow)]" : "bg-white/90 text-forest ring-1 ring-saudi/10 group-hover:bg-white"}`}>
          <span className="block truncate">{label}</span>
        </span>
        <span className="mt-1 max-w-[9rem] truncate text-[10px] text-muted">{sublabel}</span>
        <span aria-hidden className={`mt-1 h-2 w-2 rotate-45 rounded-[2px] bg-saudi transition duration-300 ${selected ? "opacity-100" : "opacity-0"}`} />
      </button>
    </li>
  );
}

/** The "add a plant" control: an empty pot with a plus, standing on the same shelf. */
export function AddPlantPot({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <li className="flex shrink-0 snap-center flex-col items-center">
      <a href={href} className="group flex flex-col items-center rounded-[2rem] px-2 pt-3 outline-none focus-visible:ring-2 focus-visible:ring-saudi/60">
        <span className="relative -mb-3 grid size-16 place-items-center rounded-full border-2 border-dashed border-saudi/35 bg-white text-saudi shadow-[var(--shadow-card)] transition duration-500 group-hover:-translate-y-1 group-hover:rotate-90 group-hover:border-saudi group-hover:bg-saudi group-hover:text-white">
          <Plus className="size-7" />
        </span>
        <Pot id="add-plant" width={80} empty scaled />
        <span className="mt-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-saudi ring-1 ring-saudi/15 transition group-hover:bg-saudi group-hover:text-white">{label}</span>
        <span className="mt-1 text-[10px] text-muted">{hint}</span>
      </a>
    </li>
  );
}
