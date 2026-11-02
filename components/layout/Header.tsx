"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Heart, Home, Languages, Menu, Package, Search, ShoppingBag, Sparkles, Sprout, Store, User, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { PlantImage } from "@/components/store/PlantImage";
import { useCart, useSession, useT } from "./Providers";

interface NavCategory { slug: string; name: string; image?: string | null }

/** Header categories menu highlights these; the rest are listed compactly. */
const FEATURED = ["indoor", "outdoor", "pet-friendly", "low-light", "cacti-succulents", "gifts"];

function IconButton({ href, label, children, badge, onClick }: { href?: string; label: string; children: React.ReactNode; badge?: number; onClick?: () => void }) {
  const cls = "relative grid size-10 place-items-center rounded-full text-deep transition duration-300 hover:bg-soft hover:text-saudi";
  const inner = (
    <>
      {children}
      {badge ? <span key={badge} className="absolute -top-0.5 end-0 grid min-w-5 animate-pop place-items-center rounded-full bg-saudi px-1 text-[11px] font-bold text-white ring-2 ring-white" aria-hidden>{badge}</span> : null}
    </>
  );
  return href ? <Link href={href} className={cls} aria-label={label}>{inner}</Link> : <button onClick={onClick} className={cls} aria-label={label} title={label}>{inner}</button>;
}

export function Header({ categories }: { categories: NavCategory[] }) {
  const { t, locale } = useT();
  const { user } = useSession();
  const { count } = useCart();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [q, setQ] = useState("");
  const catRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setOpen(false); setCatOpen(false); }, [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    const onClick = (e: MouseEvent) => { if (catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setCatOpen(false); setOpen(false); } };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("scroll", onScroll); document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, []);
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; }, [open]);

  const switchLang = async () => {
    await fetch("/api/locale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale: locale === "ar" ? "en" : "ar" }) });
    router.refresh();
  };
  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/shop?q=${encodeURIComponent(q.trim())}`);
  };

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const navLink = (href: string, label: string, icon?: React.ReactNode) => (
    <Link href={href} aria-current={isActive(href) ? "page" : undefined}
      className={`relative flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition duration-300 ${isActive(href) ? "bg-white text-saudi shadow-sm" : "text-deep/80 hover:text-saudi"}`}>
      {icon}{label}
    </Link>
  );
  const featured = FEATURED.map((s) => categories.find((c) => c.slug === s)).filter((c): c is NavCategory => !!c);
  const others = categories.filter((c) => !FEATURED.includes(c.slug));

  return (
    <>
      <header className="sticky top-0 z-40 px-2 pt-2 sm:px-4 sm:pt-3">
        <div className={`container-x !px-3 flex h-16 items-center gap-2 rounded-[1.4rem] transition duration-500 sm:!px-4 ${scrolled ? "glass shadow-[var(--shadow-card)] ring-1 ring-saudi/5" : "bg-white/0"}`}>
          <button className="grid size-10 place-items-center rounded-full text-deep hover:bg-soft lg:hidden" onClick={() => setOpen(true)} aria-label={locale === "ar" ? "القائمة" : "Menu"} aria-expanded={open}>
            <Menu className="size-5" />
          </button>
          <Link href="/" className="shrink-0" aria-label={t.nav.home}><Logo /></Link>

          <nav className="ms-5 hidden items-center gap-0.5 rounded-full bg-mist p-1 ring-1 ring-saudi/5 lg:flex" aria-label="Main">
            {navLink("/", t.nav.home)}
            {navLink("/shop", t.nav.shop)}
            <div className="relative" ref={catRef}>
              <button onClick={() => setCatOpen((v) => !v)} aria-expanded={catOpen} aria-haspopup="true"
                className={`flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-medium transition ${pathname.startsWith("/categories") || catOpen ? "bg-white text-saudi shadow-sm" : "text-deep/80 hover:text-saudi"}`}>
                {t.nav.categories} <ChevronDown className={`size-4 transition duration-300 ${catOpen ? "rotate-180" : ""}`} />
              </button>
              {catOpen && (
                <div className="card absolute start-0 top-14 w-[40rem] animate-rise overflow-hidden p-4">
                  <div className="grid grid-cols-3 gap-2.5">
                    {featured.map((c) => (
                      <Link key={c.slug} href={`/categories/${c.slug}`} className="group flex items-center gap-3 rounded-2xl p-2 transition hover:bg-mist">
                        <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-soft ring-1 ring-saudi/10"><PlantImage src={c.image ?? null} alt="" sizes="48px" className="transition duration-500 group-hover:scale-110" /></span>
                        <span className="text-sm font-semibold text-deep group-hover:text-saudi">{c.name}</span>
                      </Link>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
                    {others.map((c) => <Link key={c.slug} href={`/categories/${c.slug}`} className="chip bg-mist px-3 py-1.5 transition hover:bg-saudi hover:text-white">{c.name}</Link>)}
                  </div>
                </div>
              )}
            </div>
            {navLink("/nada-ai", t.nav.nada, <Sparkles className="size-4 text-leaf" />)}
            {navLink("/my-green-space", t.nav.space)}
          </nav>

          <form onSubmit={submitSearch} className="ms-auto hidden max-w-[15rem] flex-1 md:block" role="search">
            <label className="relative block">
              <span className="sr-only">{t.nav.search}</span>
              <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.nav.search} className="input rounded-full border-transparent bg-mist ps-10 focus:bg-white" />
            </label>
          </form>

          <div className="ms-auto flex items-center md:ms-1">
            <button onClick={switchLang} className="hidden h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-deep transition hover:bg-soft hover:text-saudi sm:flex" aria-label={t.common.lang}>
              <Languages className="size-4" />{t.common.lang}
            </button>
            <span className="hidden sm:block"><IconButton href="/my-green-space?tab=wishlist" label={t.nav.wishlist}><Heart className="size-[1.15rem]" /></IconButton></span>
            <IconButton href={user ? "/account" : "/account/login"} label={t.nav.account}><User className="size-[1.15rem]" /></IconButton>
            <IconButton href="/cart" label={`${t.nav.cart} (${count})`} badge={count}><ShoppingBag className="size-[1.15rem]" /></IconButton>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <div className={`fixed inset-0 z-50 lg:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
        <div className={`absolute inset-0 bg-forest/40 backdrop-blur-sm transition duration-300 ${open ? "opacity-100" : "opacity-0"}`} onClick={() => setOpen(false)} />
        <aside className={`absolute inset-y-0 start-0 flex w-[88%] max-w-sm flex-col overflow-y-auto bg-white shadow-2xl transition duration-500 ease-[var(--ease-organic)] ${open ? "translate-x-0" : "ltr:-translate-x-full rtl:translate-x-full"}`} role="dialog" aria-modal="true" aria-label={locale === "ar" ? "القائمة" : "Menu"}>
          <div className="flex items-center justify-between bg-botanical p-4">
            <Logo />
            <button onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-full bg-white text-deep shadow-sm" aria-label={t.common.close}><X className="size-5" /></button>
          </div>
          <div className="space-y-5 p-4">
            <form onSubmit={submitSearch} role="search">
              <label className="relative block">
                <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.nav.search} className="input rounded-full bg-mist ps-10" aria-label={t.nav.search} />
              </label>
            </form>
            <nav className="grid grid-cols-2 gap-2">
              {[
                { href: "/", label: t.nav.home, icon: Home },
                { href: "/shop", label: t.nav.shop, icon: Store },
                { href: "/nada-ai", label: t.nav.nada, icon: Sparkles },
                { href: "/my-green-space", label: t.nav.space, icon: Sprout },
                { href: "/my-green-space?tab=wishlist", label: t.nav.wishlist, icon: Heart },
                { href: user ? "/orders" : "/account/login", label: user ? t.nav.orders : t.auth.signIn, icon: user ? Package : User },
              ].map(({ href, label, icon: I }) => (
                <Link key={href} href={href} className={`flex items-center gap-2.5 rounded-2xl p-3 text-sm font-semibold transition ${isActive(href.split("?")[0]) && href !== "/my-green-space?tab=wishlist" ? "bg-saudi text-white" : "bg-mist text-deep"}`}>
                  <I className="size-[1.1rem]" />{label}
                </Link>
              ))}
            </nav>
            <div>
              <p className="mb-2.5 text-xs font-bold tracking-[0.16em] text-leaf">{t.nav.categories}</p>
              <div className="grid grid-cols-3 gap-2">
                {featured.map((c) => (
                  <Link key={c.slug} href={`/categories/${c.slug}`} className="group flex flex-col items-center gap-1.5 text-center">
                    <span className="relative aspect-square w-full overflow-hidden rounded-2xl bg-soft"><PlantImage src={c.image ?? null} alt="" sizes="110px" /></span>
                    <span className="text-[11px] font-semibold leading-4 text-deep">{c.name}</span>
                  </Link>
                ))}
              </div>
              <Link href="/categories" className="btn-outline mt-3 w-full">{t.nav.allCategories}</Link>
            </div>
            <button onClick={switchLang} className="btn-ghost w-full bg-mist"><Languages className="size-4" />{t.common.lang}</button>
            {user?.isAdmin && <Link href="/admin" className="btn-ghost w-full">{t.nav.admin}</Link>}
          </div>
        </aside>
      </div>
    </>
  );
}
