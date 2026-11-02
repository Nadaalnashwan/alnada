"use client";

import Link from "next/link";
import { useState } from "react";
import { Sprout } from "lucide-react";
import { useT } from "@/components/layout/Providers";

export function AddToSpaceButton({ orderId, alreadyAdded }: { orderId: string; alreadyAdded: boolean }) {
  const { t } = useT();
  const [state, setState] = useState<"idle" | "busy" | "done" | "err">(alreadyAdded ? "done" : "idle");
  const [added, setAdded] = useState<number | null>(null);
  const run = async () => {
    setState("busy");
    const res = await fetch(`/api/orders/${orderId}/add-to-space`, { method: "POST" });
    if (!res.ok) return setState("err");
    setAdded((await res.json()).added);
    setState("done");
  };
  if (state === "done") return (
    <p className="rounded-2xl bg-soft p-4 text-sm text-saudi" role="status">
      {added === 0 || alreadyAdded ? t.checkout.alreadyAdded : t.checkout.addedToSpace} · <Link href="/my-green-space" className="font-semibold underline">{t.nav.space}</Link>
    </p>
  );
  return (
    <div>
      <button onClick={run} disabled={state === "busy"} className="btn-primary py-3"><Sprout className="size-5" />{t.checkout.addToSpace}</button>
      {state === "err" && <p role="alert" className="mt-2 text-sm text-danger">{t.common.error}</p>}
    </div>
  );
}
