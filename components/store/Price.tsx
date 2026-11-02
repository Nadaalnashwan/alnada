import { formatSAR } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/dict";

export function Price({ amount, compareAt, locale, className = "" }: { amount: number; compareAt?: number | null; locale: Locale; className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-2 ${className}`}>
      <span className="font-bold text-deep">{formatSAR(amount, locale)}</span>
      {compareAt && compareAt > amount && <s className="text-xs text-muted">{formatSAR(compareAt, locale)}</s>}
    </span>
  );
}
