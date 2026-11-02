"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Heart, Languages, Menu, Search, ShoppingBag, Sparkles, User, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { useCart, useSession, useT } from "./Providers";

interface NavCategory { slug: string; name: string }

export function Header({ categories }: { categories: NavCategory[] }) {
  const { t, locale } = useT();
  const { user } = useSession();
  const { count } = useCart();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [q, setQ] = useState("");
  const catRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setOpen(false); setCatOpen(false); }, [pathname]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setCatOpen(false); setOpen(false); } };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, []);

  const switchLang = async () => {
    await fetch("/api/locale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale: locale === "ar" ? "en" : "ar" }) });
    router.refresh();
  };
  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/shop?q=${encodeURIComponent(q.trim())}`);
  };

  const links = [
    { href: "/", label: t.nav.home },
    { href: "/shop", label: t.nav.shop },
    { href: "/nada-ai", label: t.nav.nada, icon: true },
    { href: "/my-green-space", label: t.nav.space },
  ];
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="container-x flex h-16 items-center gap-3 lg:h-[4.5rem]">
        <button className="btn-ghost -ms-2 px-2 lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu" aria-expanded={open}>
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
        <Link href="/" className="shrink-0" aria-label={t.nav.home}><Logo /></Link>

        <nav className="ms-6 hidden items-center gap-1 lg:flex" aria-label="Main">
          {links.slice(0, 2).map((l) => (
            <Link key={l.href} href={l.href} className={`rounded-full px-3 py-2 text-sm font-medium transition ${isActive(l.href) ? "bg-soft text-saudi" : "text-deep hover:text-saudi"}`}>{l.label}</Link>
          ))}
          <div className="relative" ref={catRef}>
            <button onClick={() => setCatOpen((v) => !v)} aria-expanded={catOpen} aria-haspopup="true"
              className={`flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium transition ${pathname.startsWith("/categories") ? "bg-soft text-saudi" : "text-deep hover:text-saudi"}`}>
              {t.nav.categories} <ChevronDown className={`size-4 transition ${catOpen ? "rotate-180" : ""}`} />
            </button>
            {catOpen && (
              <div className="card absolute start-0 top-12 grid w-[34rem] grid-cols-2 gap-1 p-3 animate-rise">
                {categories.map((c) => (
                  <Link key={c.slug} href={`/categories/${c.slug}`} className="rounded-lg px-3 py-2 text-sm text-deep hover:bg-soft hover:text-saudi">{c.name}</Link>
                ))}
                <Link href="/categories" className="col-span-2 mt-1 rounded-lg bg-soft px-3 py-2 text-center text-sm font-semibold text-saudi">{t.nav.allCategories}</Link>
              </div>
            )}
          </div>
          {links.slice(2).map((l) => (
            <Link key={l.href} href={l.href} className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition ${isActive(l.href) ? "bg-soft text-saudi" : "text-deep hover:text-saudi"}`}>
              {l.icon && <Sparkles className="size-4" />}{l.label}
            </Link>
          ))}
        </nav>

        <form onSubmit={submitSearch} className="ms-auto hidden max-w-xs flex-1 md:block" role="search">
          <label className="relative block">
            <span className="sr-only">{t.nav.search}</span>
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.nav.search} className="input rounded-full bg-soft/60 ps-9" />
          </label>
        </form>

        <div className="ms-auto flex items-center gap-0.5 md:ms-2">
          <button onClick={switchLang} className="btn-ghost px-2.5" aria-label={t.common.lang} title={t.common.lang}>
            <Languages className="size-5" /><span className="hidden text-xs xl:inline">{t.common.lang}</span>
          </button>
          <Link href="/my-green-space?tab=wishlist" className="btn-ghost hidden px-2.5 sm:inline-flex" aria-label={t.nav.wishlist}><Heart className="size-5" /></Link>
          <Link href={user ? "/account" : "/account/login"} className="btn-ghost px-2.5" aria-label={t.nav.account}><User className="size-5" /></Link>
          <Link href="/cart" className="btn-ghost relative px-2.5" aria-label={`${t.nav.cart} (${count})`}>
            <ShoppingBag className="size-5" />
            {count > 0 && <span className="absolute -top-0.5 end-0.5 grid min-w-5 place-items-center rounded-full bg-saudi px-1 text-[11px] font-bold text-white" aria-hidden>{count}</span>}
          </Link>
        </div>
      </div>

      {open && (
        <div className="border-t border-line bg-white lg:hidden">
          <div className="container-x space-y-1 py-4">
            <form onSubmit={submitSearch} role="search" className="mb-3">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.nav.search} className="input rounded-full" aria-label={t.nav.search} />
            </form>
            {links.map((l) => <Link key={l.href} href={l.href} className={`block rounded-xl px-3 py-2.5 font-medium ${isActive(l.href) ? "bg-soft text-saudi" : "text-deep"}`}>{l.label}</Link>)}
            <Link href="/categories" className="block rounded-xl px-3 py-2.5 font-medium text-deep">{t.nav.categories}</Link>
            <Link href="/my-green-space?tab=wishlist" className="block rounded-xl px-3 py-2.5 font-medium text-deep">{t.nav.wishlist}</Link>
            {user && <Link href="/orders" className="block rounded-xl px-3 py-2.5 font-medium text-deep">{t.nav.orders}</Link>}
            {user?.isAdmin && <Link href="/admin" className="block rounded-xl px-3 py-2.5 font-medium text-deep">{t.nav.admin}</Link>}
          </div>
        </div>
      )}
    </header>
  );
}
