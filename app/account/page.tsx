import Link from "next/link";
import { redirect } from "next/navigation";
import { Heart, LayoutDashboard, LogOut, Package, Sprout } from "lucide-react";
import { ProfileForm } from "@/components/auth/ProfileForm";
import { getDict } from "@/lib/i18n/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabase, getUser } from "@/lib/supabase/server";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { t } = await getDict();
  if (!isSupabaseConfigured()) return <div className="container-x py-14"><p className="card mx-auto max-w-lg p-6 text-sm leading-7 text-warn">{t.auth.notConfigured}</p></div>;
  const user = await getUser();
  if (!user) redirect("/account/login?next=/account");
  const supabase = (await getSupabase())!;
  const { data: profile } = await supabase.from("profiles").select("full_name, city, preferred_locale").eq("id", user.id).single();
  const links = [
    { href: "/my-green-space", icon: Sprout, label: t.nav.space },
    { href: "/my-green-space?tab=wishlist", icon: Heart, label: t.nav.wishlist },
    { href: "/orders", icon: Package, label: t.nav.orders },
    ...(user.isAdmin ? [{ href: "/admin", icon: LayoutDashboard, label: t.nav.admin }] : []),
  ];
  return (
    <div className="container-x grid gap-8 py-12 lg:grid-cols-[18rem_1fr]">
      <aside className="card h-fit p-4">
        <p className="px-2 text-sm text-muted" dir="ltr">{user.email}</p>
        <nav className="mt-3 space-y-1">
          {links.map(({ href, icon: I, label }) => <Link key={href} href={href} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-deep hover:bg-soft"><I className="size-4 text-saudi" />{label}</Link>)}
        </nav>
        <form action={signOut} className="mt-3 border-t border-line pt-3"><button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-danger hover:bg-danger-bg"><LogOut className="size-4" />{t.auth.signOut}</button></form>
      </aside>
      <section className="card p-6 sm:p-8">
        <h1 className="mb-6 text-2xl font-bold text-deep">{t.auth.profile}</h1>
        <ProfileForm profile={profile ?? { full_name: null, city: null, preferred_locale: "ar" }} />
        <p className="mt-6 text-sm"><Link href="/account/update-password" className="text-saudi hover:underline">{t.auth.updatePassword}</Link></p>
      </section>
    </div>
  );
}
