import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import type { Dict } from "@/lib/i18n/dict";

export function Footer({ t, categories }: { t: Dict; categories: { slug: string; name: string }[] }) {
  return (
    <footer className="mt-24 bg-deep text-white">
      <div className="container-x grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo tone="dark" />
          <p className="mt-4 max-w-sm text-sm leading-7 text-white/75">{t.footer.about}</p>
          <p className="mt-3 text-sm font-semibold text-soft">{t.tagline}</p>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold text-soft">{t.footer.shop}</h3>
          <ul className="space-y-2 text-sm text-white/80">
            {categories.slice(0, 6).map((c) => <li key={c.slug}><Link className="hover:text-white" href={`/categories/${c.slug}`}>{c.name}</Link></li>)}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold text-soft">{t.brand}</h3>
          <ul className="space-y-2 text-sm text-white/80">
            <li><Link className="hover:text-white" href="/nada-ai">{t.nav.nada}</Link></li>
            <li><Link className="hover:text-white" href="/my-green-space">{t.nav.space}</Link></li>
            <li><Link className="hover:text-white" href="/my-green-space?tab=wishlist">{t.nav.wishlist}</Link></li>
            <li><Link className="hover:text-white" href="/orders">{t.nav.orders}</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold text-soft">{t.footer.help}</h3>
          <p className="text-xs leading-6 text-white/70">{t.footer.demo}</p>
          <p className="mt-3 text-xs leading-6 text-white/60">{t.footer.credits}</p>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-white/60">© {new Date().getFullYear()} AL NADA · الندى — Meta AI Bootcamp Project 4</div>
    </footer>
  );
}
