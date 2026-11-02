"use client";

import Link from "next/link";
import { useState } from "react";
import { Bookmark, Check, Heart, Minus, Plus, ShoppingBag, Sparkles, Sprout } from "lucide-react";
import { useCart, useSession, useT, useWishlist } from "@/components/layout/Providers";

export function ProductActions({ productId, speciesSlug, stock, name }: { productId: string; speciesSlug: string | null; stock: number; name: string }) {
  const { t } = useT();
  const { user, dbReady } = useSession();
  const cart = useCart();
  const wish = useWishlist();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [explored, setExplored] = useState(false);
  const soldOut = stock < 1;
  const max = Math.min(20, stock);

  const addToCart = () => { cart.add(productId, qty); setAdded(true); setTimeout(() => setAdded(false), 1500); };
  const toggleWish = async () => {
    const r = await wish.toggle(productId);
    setNote(r === "auth" ? t.auth.required : r === "error" ? t.common.error : null);
  };
  const saveExplored = async () => {
    if (!user || !dbReady) { setNote(t.auth.required); return; }
    const res = await fetch("/api/explored", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ speciesSlug, productId, source: "product_view" }) });
    if (res.ok) setExplored(true); else setNote(t.common.error);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-full border border-line" role="group" aria-label={t.cart.qty}>
          <button className="grid size-10 place-items-center text-deep disabled:opacity-40" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="−"><Minus className="size-4" /></button>
          <span className="w-8 text-center font-semibold" aria-live="polite">{qty}</span>
          <button className="grid size-10 place-items-center text-deep disabled:opacity-40" onClick={() => setQty((q) => Math.min(max, q + 1))} disabled={qty >= max} aria-label="+"><Plus className="size-4" /></button>
        </div>
        <button onClick={addToCart} disabled={soldOut} className="btn-primary flex-1 py-3 text-base">
          {added ? <Check className="size-5" /> : <ShoppingBag className="size-5" />}{soldOut ? t.product.outOfStock : added ? t.product.added : t.product.addToCart}
        </button>
        <button onClick={toggleWish} className="btn-outline size-12 p-0" aria-pressed={wish.ids.has(productId)} aria-label={wish.ids.has(productId) ? t.product.wishlisted : t.product.wishlist}>
          <Heart className={`size-5 ${wish.ids.has(productId) ? "fill-saudi" : ""}`} />
        </button>
      </div>
      {speciesSlug && (
        <div className="grid gap-2 sm:grid-cols-3">
          <Link href={`/nada-ai?plant=${speciesSlug}`} className="btn-ghost justify-start rounded-xl bg-soft"><Sparkles className="size-4" />{t.product.askNada}</Link>
          <button onClick={saveExplored} disabled={explored} className="btn-ghost justify-start rounded-xl bg-soft">
            {explored ? <Check className="size-4" /> : <Bookmark className="size-4" />}{explored ? t.nada.saved : t.product.exploredSave}
          </button>
          <Link href={`/my-green-space/add?species=${speciesSlug}`} className="btn-ghost justify-start rounded-xl bg-soft"><Sprout className="size-4" />{t.product.markOwned}</Link>
        </div>
      )}
      {note && <p className="text-sm text-warn" role="status">{note} {note === t.auth.required && <Link href="/account/login" className="font-semibold underline">{t.auth.signIn}</Link>} <span className="sr-only">{name}</span></p>}
    </div>
  );
}
