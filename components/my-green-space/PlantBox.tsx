"use client";

import { Pot, Leaf } from "@/components/brand/Decor";
import { PlantImage } from "@/components/store/PlantImage";

// Pot palettes stay in the green/cream family; each plant gets a stable one (hash of its id),
// so a collection looks varied but cohesive — like a styled indoor garden shelf.
export const POT_TONES = [
  { bg: "from-[#eef7f0] to-[#dcefe2]", pot: "#cfe4d5", rim: "#b9d4bd" },
  { bg: "from-[#f6f3ea] to-[#ebe6d6]", pot: "#e7ddc6", rim: "#d8cbaa" },
  { bg: "from-[#e8f4ec] to-[#cfe8d8]", pot: "#9fcaa9", rim: "#86b892" },
  { bg: "from-[#f1f6ef] to-[#e1ecd9]", pot: "#d7e6c8", rim: "#bfd5ab" },
  { bg: "from-[#ecf3f4] to-[#d8e8e6]", pot: "#c4dcd7", rim: "#a9c9c2" },
] as const;

export function potToneFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return POT_TONES[h % POT_TONES.length];
}

/** The "plant in its pot" visual: arch photo planted into a styled planter. */
export function PlantBox({ id, image, alt, size = "md", ownPhoto = false, priority = false }: {
  id: string; image: string | null; alt: string; size?: "sm" | "md"; ownPhoto?: boolean; priority?: boolean;
}) {
  const tone = potToneFor(id);
  const h = size === "sm" ? "h-44" : "h-60 sm:h-64";
  return (
    <div className={`relative ${h} overflow-hidden rounded-[1.5rem] bg-gradient-to-b ${tone.bg}`}>
      {/* soft leaf shadows on the "wall" */}
      <Leaf className="absolute -start-4 top-6 h-24 w-12 -rotate-[28deg] text-saudi/[0.06]" />
      <Leaf className="absolute -end-3 top-2 h-20 w-10 rotate-[24deg] text-saudi/[0.07]" />
      {/* the plant */}
      <div className="absolute inset-x-[16%] bottom-[24%] top-[7%] overflow-hidden arch shadow-[0_18px_30px_-18px_rgb(11_58_34/0.55)] ring-4 ring-white/70 transition duration-700 ease-[var(--ease-organic)] group-hover:-translate-y-1.5">
        <PlantImage src={image} alt={alt} sizes="(min-width:1024px) 22vw, 60vw" priority={priority} className="transition duration-700 group-hover:scale-105" />
        {ownPhoto && <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent" />}
      </div>
      {/* planter */}
      <Pot className="absolute inset-x-[10%] bottom-0 h-[30%] w-[80%] drop-shadow-[0_-4px_8px_rgb(11_58_34/0.08)]" tone={tone.pot} rim={tone.rim} />
      {/* floor shadow */}
      <span className="absolute inset-x-[18%] -bottom-1 h-3 rounded-[50%] bg-forest/10 blur-md" />
    </div>
  );
}
