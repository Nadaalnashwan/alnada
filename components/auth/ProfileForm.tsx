"use client";

import { useActionState } from "react";
import { useT } from "@/components/layout/Providers";
import { updateProfile } from "@/app/account/actions";

export function ProfileForm({ profile }: { profile: { full_name: string | null; city: string | null; preferred_locale: string } }) {
  const { t } = useT();
  const [state, action, pending] = useActionState(updateProfile, null);
  return (
    <form action={action} className="space-y-4">
      <label className="block"><span className="label">{t.auth.fullName}</span><input name="full_name" defaultValue={profile.full_name ?? ""} className="input" maxLength={120} /></label>
      <label className="block"><span className="label">{t.checkout.city}</span><input name="city" defaultValue={profile.city ?? ""} className="input" maxLength={80} /></label>
      <label className="block"><span className="label">Language / اللغة</span>
        <select name="preferred_locale" defaultValue={profile.preferred_locale} className="input"><option value="ar">العربية</option><option value="en">English</option></select>
      </label>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>{t.auth.save}</button>
        {state && <span role="status" className={state.ok ? "text-sm text-saudi" : "text-sm text-danger"}>{state.ok ? t.auth.saved : t.common.error}</span>}
      </div>
    </form>
  );
}
