import type { Metadata } from "next";
import { CheckoutForm } from "@/components/cart/CheckoutForm";
import { toCard } from "@/lib/catalog/card";
import { getAllProducts } from "@/lib/catalog/repo";
import { getDict } from "@/lib/i18n/server";
import { getSupabase, getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "الدفع التجريبي | Demo checkout" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const { locale } = await getDict();
  const [products, user, supabase] = [(await getAllProducts()).map((p) => toCard(p, locale)), await getUser(), await getSupabase()];
  let defaults = { name: "", city: "" };
  if (user && supabase) {
    const { data } = await supabase.from("profiles").select("full_name, city").eq("id", user.id).maybeSingle();
    defaults = { name: data?.full_name ?? "", city: data?.city ?? "" };
  }
  return <div className="container-x py-10"><CheckoutForm products={products} defaults={defaults} /></div>;
}
