import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";
import { toCard } from "@/lib/catalog/card";
import { getAllProducts } from "@/lib/catalog/repo";
import { getDict } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "السلة | Cart" };

export default async function CartPage() {
  const { locale } = await getDict();
  const products = (await getAllProducts()).map((p) => toCard(p, locale));
  return <div className="container-x py-10"><CartView products={products} /></div>;
}
