"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DICTS, type Dict, type Locale } from "@/lib/i18n/dict";

// ───────────────────────── locale ─────────────────────────
const LocaleCtx = createContext<{ locale: Locale; t: Dict }>({ locale: "ar", t: DICTS.ar });
export const useT = () => useContext(LocaleCtx);

// ───────────────────────── session ────────────────────────
export interface ClientUser { id: string; email: string | null; isAdmin: boolean; fullName: string | null }
const SessionCtx = createContext<{ user: ClientUser | null; dbReady: boolean }>({ user: null, dbReady: false });
export const useSession = () => useContext(SessionCtx);

// ───────────────────────── cart ───────────────────────────
export interface CartLine { productId: string; qty: number }
interface CartApi {
  lines: CartLine[];
  count: number;
  add: (productId: string, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  synced: boolean;
}
const CartCtx = createContext<CartApi | null>(null);
export const useCart = () => {
  const c = useContext(CartCtx);
  if (!c) throw new Error("useCart outside provider");
  return c;
};

const CART_KEY = "alnada.cart.v1";
const clampQty = (n: number) => Math.max(1, Math.min(20, Math.floor(n)));

function readLocalCart(): CartLine[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((l) => typeof l?.productId === "string" && Number.isFinite(l?.qty)).map((l) => ({ productId: l.productId, qty: clampQty(l.qty) })) : [];
  } catch {
    return [];
  }
}

// ───────────────────────── wishlist ───────────────────────
interface WishlistApi { ids: Set<string>; toggle: (productId: string) => Promise<"added" | "removed" | "auth" | "error">; ready: boolean }
const WishCtx = createContext<WishlistApi | null>(null);
export const useWishlist = () => {
  const c = useContext(WishCtx);
  if (!c) throw new Error("useWishlist outside provider");
  return c;
};

export function Providers({ locale, user, dbReady, children }: { locale: Locale; user: ClientUser | null; dbReady: boolean; children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [synced, setSynced] = useState(false);
  const loaded = useRef(false);

  // Load: signed-in users get their saved account cart merged with anything added as a guest.
  useEffect(() => {
    const local = readLocalCart();
    if (!user || !dbReady) {
      setLines(local);
      loaded.current = true;
      return;
    }
    fetch("/api/cart")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { lines: CartLine[] }) => {
        const merged = new Map(data.lines.map((l) => [l.productId, l.qty]));
        for (const l of local) merged.set(l.productId, clampQty((merged.get(l.productId) ?? 0) + l.qty));
        setLines([...merged].map(([productId, qty]) => ({ productId, qty })));
        localStorage.removeItem(CART_KEY);
        setSynced(true);
      })
      .catch(() => setLines(local))
      .finally(() => (loaded.current = true));
  }, [user, dbReady]);

  // Persist on change.
  useEffect(() => {
    if (!loaded.current) return;
    if (user && dbReady && synced) {
      const ctrl = new AbortController();
      const t = setTimeout(() => {
        fetch("/api/cart", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines }), signal: ctrl.signal }).catch(() => {});
      }, 300);
      return () => { clearTimeout(t); ctrl.abort(); };
    }
    try { localStorage.setItem(CART_KEY, JSON.stringify(lines)); } catch { /* storage unavailable */ }
  }, [lines, user, dbReady, synced]);

  const add = useCallback((productId: string, qty = 1) => {
    setLines((prev) => {
      const found = prev.find((l) => l.productId === productId);
      if (found) return prev.map((l) => (l.productId === productId ? { ...l, qty: clampQty(l.qty + qty) } : l));
      return [...prev, { productId, qty: clampQty(qty) }];
    });
  }, []);
  const setQty = useCallback((productId: string, qty: number) => setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, qty: clampQty(qty) } : l))), []);
  const remove = useCallback((productId: string) => setLines((prev) => prev.filter((l) => l.productId !== productId)), []);
  const clear = useCallback(() => setLines([]), []);
  const cart = useMemo<CartApi>(() => ({ lines, count: lines.reduce((a, l) => a + l.qty, 0), add, setQty, remove, clear, synced }), [lines, add, setQty, remove, clear, synced]);

  // Wishlist (account only)
  const [wishIds, setWishIds] = useState<Set<string>>(new Set());
  const [wishReady, setWishReady] = useState(false);
  useEffect(() => {
    if (!user || !dbReady) { setWishIds(new Set()); setWishReady(true); return; }
    fetch("/api/wishlist").then((r) => (r.ok ? r.json() : { ids: [] })).then((d) => setWishIds(new Set(d.ids))).finally(() => setWishReady(true));
  }, [user, dbReady]);
  const toggle = useCallback(async (productId: string) => {
    if (!user || !dbReady) return "auth" as const;
    const has = wishIds.has(productId);
    const res = await fetch("/api/wishlist", { method: has ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId }) });
    if (!res.ok) return "error" as const;
    setWishIds((prev) => {
      const next = new Set(prev);
      if (has) next.delete(productId); else next.add(productId);
      return next;
    });
    return has ? ("removed" as const) : ("added" as const);
  }, [user, dbReady, wishIds]);
  const wish = useMemo(() => ({ ids: wishIds, toggle, ready: wishReady }), [wishIds, toggle, wishReady]);

  return (
    <LocaleCtx.Provider value={{ locale, t: DICTS[locale] }}>
      <SessionCtx.Provider value={{ user, dbReady }}>
        <CartCtx.Provider value={cart}>
          <WishCtx.Provider value={wish}>{children}</WishCtx.Provider>
        </CartCtx.Provider>
      </SessionCtx.Provider>
    </LocaleCtx.Provider>
  );
}
