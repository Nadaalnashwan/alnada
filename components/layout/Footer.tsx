import Link from "next/link";
import { Sparkles, Sprout } from "lucide-react";
import { Leaf, Sprig } from "@/components/brand/Decor";
import { Logo } from "@/components/brand/Logo";
import type { Dict } from "@/lib/i18n/dict";

export function Footer({ t, categories }: { t: Dict; categories: { slug: string; name: string }[] }) {
  const linkCls = "text-white/70 transition hover:text-white";
  return (
    <footer className="mt-24 px-2 pb-2 sm:px-4 sm:pb-4">
      <div className="relative mx-auto max-w-[90rem] overflow-hidden rounded-[2.5rem] bg-forest-glow text-white">
        <Sprig className="absolute -bottom-8 end-[4%] h-72 w-44 text-white/[0.05]" />
        <Leaf className="absolute start-[38%] -top-10 h-40 w-20 rotate-[-20deg] text-white/[0.04]" />
        <div className="container-x relative grid gap-10 py-14 md:grid-cols-[1.6fr_1fr_1fr]">
          <div>
            <Logo tone="dark" />
            <p className="mt-5 max-w-sm text-sm leading-7 text-white/70">{t.footer.about}</p>
            <p className="mt-4 text-xl font-bold text-sprout">{t.tagline}</p>
          </div>
          <div>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold"><Sprout className="size-4 text-sprout" />{t.footer.shop}</h3>
            <ul className="space-y-2.5 text-sm">
              {categories.slice(0, 6).map((c) => <li key={c.slug}><Link className={linkCls} href={`/categories/${c.slug}`}>{c.name}</Link></li>)}
            </ul>
          </div>
          <div>
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold"><Sparkles className="size-4 text-sprout" />{t.brand}</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link className={linkCls} href="/nada-ai">{t.nav.nada}</Link></li>
              <li><Link className={linkCls} href="/my-green-space">{t.nav.space}</Link></li>
              <li><Link className={linkCls} href="/my-green-space?tab=wishlist">{t.nav.wishlist}</Link></li>
              <li><Link className={linkCls} href="/orders">{t.nav.orders}</Link></li>
            </ul>
          </div>
        </div>
        <div className="relative border-t border-white/10 py-5 text-center text-xs text-white/55">© {new Date().getFullYear()} AL NADA · الندى — Meta AI Bootcamp Project 4</div>
      </div>
    </footer>
  );
}
