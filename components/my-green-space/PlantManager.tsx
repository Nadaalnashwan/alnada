"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Camera, Pencil, Trash2 } from "lucide-react";
import { useSession, useT } from "@/components/layout/Providers";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { formatDate } from "@/lib/i18n/format";

const ACTIVITIES = ["watering", "fertilizing", "repotting", "pruning", "cleaning", "observation"] as const;

export function CareLogForm({ plantId }: { plantId: string }) {
  const { t } = useT();
  const router = useRouter();
  const [activity, setActivity] = useState<(typeof ACTIVITIES)[number]>("watering");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const date = fd.get("date") as string;
    setBusy(true);
    setErr(false);
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch("/api/care-logs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plantId, activity, notes: fd.get("notes") || null, occurredAt: date && date !== today ? new Date(`${date}T12:00:00`).toISOString() : null }),
    });
    setBusy(false);
    if (!res.ok) { setErr(true); return; }
    (e.target as HTMLFormElement).reset();
    router.refresh();
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t.plant.log}>
        {ACTIVITIES.map((a) => <button type="button" role="radio" aria-checked={activity === a} key={a} onClick={() => setActivity(a)} className={`chip px-3 py-1.5 ${activity === a ? "bg-saudi text-white" : ""}`}>{t.plant.activity[a]}</button>)}
      </div>
      <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
        <label><span className="sr-only">{t.plant.when}</span><input type="date" name="date" defaultValue={new Date().toISOString().slice(0, 10)} max={new Date().toISOString().slice(0, 10)} className="input" /></label>
        <label><span className="sr-only">{t.plant.notesPh}</span><input name="notes" maxLength={1000} placeholder={t.plant.notesPh} className="input" /></label>
        <button className="btn-primary" disabled={busy}>{t.plant.saveLog}</button>
      </div>
      {err && <p role="alert" className="text-sm text-danger">{t.common.error}</p>}
    </form>
  );
}

export function DeleteLogButton({ id }: { id: string }) {
  const router = useRouter();
  return <button onClick={async () => { await fetch("/api/care-logs", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); router.refresh(); }} className="text-muted hover:text-danger" aria-label="Delete"><Trash2 className="size-3.5" /></button>;
}

export function PlantEditor({ plant }: { plant: { id: string; nickname: string | null; location: string | null; light_condition: string | null; watering_preference: string | null; notes: string | null } }) {
  const { t, locale } = useT();
  const { user } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState<string | null>(null);

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    await fetch(`/api/user-plants/${plant.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      nickname: fd.get("nickname") || null, location: fd.get("location") || null, light_condition: fd.get("light") || null,
      watering_preference: fd.get("watering") || null, notes: fd.get("notes") || null }) });
    setBusy(false);
    setOpen(false);
    router.refresh();
  };
  const remove = async () => {
    if (!confirm(t.plant.removeConfirm)) return;
    const res = await fetch(`/api/user-plants/${plant.id}`, { method: "DELETE" });
    if (res.ok) { router.push("/my-green-space"); router.refresh(); }
  };
  const upload = async (file: File) => {
    setPhotoErr(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) { setPhotoErr(locale === "ar" ? "صورة JPG/PNG/WebP أقل من ٥ ميجا" : "JPG/PNG/WebP under 5 MB"); return; }
    const sb = getBrowserSupabase();
    if (!sb || !user) return;
    const path = `${user.id}/${plant.id}-${Date.now()}.${file.type.split("/")[1]}`;
    const { error } = await sb.storage.from("plant-photos").upload(path, file, { contentType: file.type, upsert: false });
    if (error) { setPhotoErr(t.common.error); return; }
    await fetch(`/api/user-plants/${plant.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ photo_path: path }) });
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setOpen((v) => !v)} className="btn-outline px-3 py-2 text-xs"><Pencil className="size-3.5" />{t.plant.edit}</button>
        <label className="btn-outline cursor-pointer px-3 py-2 text-xs"><Camera className="size-3.5" />{locale === "ar" ? "صورة نبتتي" : "My plant photo"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        <button onClick={remove} className="btn-ghost px-3 py-2 text-xs text-danger"><Trash2 className="size-3.5" />{t.plant.remove}</button>
      </div>
      {photoErr && <p role="alert" className="text-xs text-danger">{photoErr}</p>}
      {open && (
        <form onSubmit={save} className="card grid gap-3 p-4 sm:grid-cols-2">
          <label><span className="label">{t.addPlant.nickname}</span><input name="nickname" defaultValue={plant.nickname ?? ""} maxLength={60} className="input" /></label>
          <label><span className="label">{t.addPlant.location}</span><input name="location" defaultValue={plant.location ?? ""} maxLength={80} className="input" /></label>
          <label><span className="label">{t.addPlant.light}</span>
            <select name="light" defaultValue={plant.light_condition ?? ""} className="input"><option value="">—</option>{(["low", "medium", "bright_indirect", "full_sun"] as const).map((l) => <option key={l} value={l}>{t.attr.light[l]}</option>)}</select>
          </label>
          <label><span className="label">{t.addPlant.watering}</span><input name="watering" defaultValue={plant.watering_preference ?? ""} maxLength={120} className="input" /></label>
          <label className="sm:col-span-2"><span className="label">{t.addPlant.notes}</span><textarea name="notes" defaultValue={plant.notes ?? ""} maxLength={1000} rows={2} className="input" /></label>
          <button className="btn-primary sm:col-span-2" disabled={busy}>{t.auth.save}</button>
        </form>
      )}
    </div>
  );
}

export function LogDate({ iso }: { iso: string }) {
  const { locale } = useT();
  return <>{formatDate(iso, locale, { day: "numeric", month: "long", year: "numeric" })}</>;
}
