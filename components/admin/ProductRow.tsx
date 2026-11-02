"use client";

import { useActionState } from "react";
import { updateProduct } from "@/app/admin/actions";
import { useT } from "@/components/layout/Providers";

export function ProductRow({ p }: { p: { id: string; sku: string; name: string; kind: string; price: number; stock: number; active: boolean; image: string | null } }) {
  const { t } = useT();
  const [state, action, pending] = useActionState(updateProduct, null);
  return (
    <tr className="border-t border-line align-middle">
      <td className="px-3 py-2 font-mono text-xs" dir="ltr">{p.sku}</td>
      <td className="px-3 py-2">{p.name}<span className="block text-xs text-muted">{p.kind}</span></td>
      <td className="px-3 py-2" colSpan={4}>
        <form action={action} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={p.id} />
          <label className="flex items-center gap-1 text-xs">{t.admin.price}<input name="price_sar" type="number" step="0.01" min={0} defaultValue={p.price} className="input w-24 px-2 py-1.5" /></label>
          <label className="flex items-center gap-1 text-xs">{t.admin.stock}<input name="stock" type="number" min={0} defaultValue={p.stock} className={`input w-20 px-2 py-1.5 ${p.stock < 5 ? "border-warn" : ""}`} /></label>
          <label className="flex items-center gap-1 text-xs"><input name="is_active" type="checkbox" defaultChecked={p.active} className="accent-saudi" />{t.admin.active}</label>
          <label className="flex items-center gap-1 text-xs">{t.admin.image}<input name="image_url" type="url" placeholder={p.image ?? "https://…"} className="input w-40 px-2 py-1.5" dir="ltr" /></label>
          <button className="btn-primary px-3 py-1.5 text-xs" disabled={pending}>{t.admin.save}</button>
          {state && <span className={`text-xs ${state.ok ? "text-saudi" : "text-danger"}`}>{state.ok ? "✓" : state.error}</span>}
        </form>
      </td>
    </tr>
  );
}
