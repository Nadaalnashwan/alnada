// AL NADA official mark (public/brand/alnada-mark*.png — the exact supplied artwork, only trimmed).
// The icon itself is never recoloured or redrawn. On dark surfaces it sits on a light badge.
import Image from "next/image";

const MARK = "/brand/alnada-mark-256.png"; // 174 × 256 (aspect of the original 743 × 1096)

/** The brand mark. `tone="dark"` places it on a soft ivory badge for dark backgrounds. */
export function DewDrop({ className = "", tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const img = <Image src={MARK} alt="" width={174} height={256} className="h-full w-auto object-contain" aria-hidden priority={false} />;
  if (tone === "dark") {
    return <span className={`inline-grid aspect-square place-items-center rounded-full bg-cream p-[14%] shadow-sm ${className}`} aria-hidden>{img}</span>;
  }
  return <span className={`inline-grid place-items-center ${className}`} aria-hidden>{img}</span>;
}

export function Logo({ tone = "light", className = "", compact = false }: { tone?: "light" | "dark"; className?: string; compact?: boolean }) {
  const main = tone === "light" ? "text-forest" : "text-white";
  const sub = tone === "light" ? "text-saudi" : "text-sprout";
  return (
    <span className={`group/logo inline-flex items-center gap-2.5 ${className}`} aria-label="AL NADA — الندى">
      <DewDrop tone={tone} className={`${tone === "dark" ? "size-11" : "h-11 w-8"} transition duration-500 group-hover/logo:-rotate-6`} />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className={`text-[1.5rem] font-bold ${main}`}>الندى</span>
          <span className={`mt-1 text-[0.6rem] font-semibold tracking-[0.38em] ${sub}`} dir="ltr">AL NADA</span>
        </span>
      )}
    </span>
  );
}
