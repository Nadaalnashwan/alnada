"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useT } from "@/components/layout/Providers";
import { getBrowserSupabase } from "@/lib/supabase/client";

type Mode = "login" | "signup" | "reset" | "update";

/** Only allow internal redirects after sign-in (prevents open redirects). */
const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/my-green-space");

export function AuthForm({ mode }: { mode: Mode }) {
  const { t, locale } = useT();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const supabase = getBrowserSupabase();

  if (!supabase) return <p className="card p-6 text-sm leading-7 text-warn">{t.auth.notConfigured}</p>;

  const friendly = (m: string) => {
    if (/invalid login/i.test(m)) return locale === "ar" ? "البريد أو كلمة المرور غير صحيحة." : "Incorrect email or password.";
    if (/already registered/i.test(m)) return locale === "ar" ? "هذا البريد مسجل مسبقًا. جرّب تسجيل الدخول." : "This email is already registered. Try signing in.";
    if (/password/i.test(m) && /6|characters|weak/i.test(m)) return locale === "ar" ? "كلمة المرور قصيرة أو ضعيفة (٨ أحرف على الأقل)." : "Password is too short or weak (at least 8 characters).";
    if (/rate/i.test(m)) return locale === "ar" ? "محاولات كثيرة، انتظر قليلًا." : "Too many attempts, please wait.";
    if (/not confirmed/i.test(m)) return locale === "ar" ? "أكّد بريدك الإلكتروني أولًا من الرابط المرسل لك." : "Please confirm your email first.";
    return t.common.error;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(safeNext(params.get("next")));
        router.refresh();
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error("password 6 characters");
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: `${location.origin}/auth/callback` } });
        if (error) throw error;
        if (data.session) { router.replace("/my-green-space"); router.refresh(); }
        else setMsg({ tone: "ok", text: t.auth.checkEmail });
      } else if (mode === "reset") {
        await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth/callback?next=/account/update-password` });
        setMsg({ tone: "ok", text: t.auth.resetSent }); // same message whether or not the email exists
      } else {
        if (password.length < 8) throw new Error("password 6 characters");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMsg({ tone: "ok", text: t.auth.saved });
        setTimeout(() => router.replace("/account"), 800);
      }
    } catch (err) {
      setMsg({ tone: "err", text: friendly((err as Error).message) });
    } finally {
      setBusy(false);
    }
  };

  const title = { login: t.auth.signIn, signup: t.auth.signUp, reset: t.auth.forgot, update: t.auth.updatePassword }[mode];
  return (
    <form onSubmit={submit} className="card mx-auto w-full max-w-md space-y-4 p-6 sm:p-8">
      <h1 className="text-2xl font-bold text-deep">{title}</h1>
      {mode === "login" && <p className="text-sm text-muted">{t.auth.why}</p>}
      {mode === "signup" && (
        <label className="block"><span className="label">{t.auth.fullName}</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" /></label>
      )}
      {mode !== "update" && (
        <label className="block"><span className="label">{t.auth.email}</span><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" dir="ltr" /></label>
      )}
      {mode !== "reset" && (
        <label className="block">
          <span className="label">{mode === "update" ? t.auth.newPassword : t.auth.password}</span>
          <input className="input" type="password" required minLength={mode === "login" ? 1 : 8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} dir="ltr" />
        </label>
      )}
      {msg && <p role={msg.tone === "err" ? "alert" : "status"} className={`rounded-xl p-3 text-sm ${msg.tone === "err" ? "bg-danger-bg text-danger" : "bg-soft text-saudi"}`}>{msg.text}</p>}
      <button className="btn-primary w-full py-3" disabled={busy}>{busy ? t.common.loading : mode === "reset" ? t.auth.reset : title}</button>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        {mode === "login" && <><Link className="text-saudi hover:underline" href="/account/reset">{t.auth.forgot}</Link><span className="text-muted">{t.auth.noAccount} <Link className="font-semibold text-saudi hover:underline" href={`/account/signup${params.get("next") ? `?next=${encodeURIComponent(params.get("next")!)}` : ""}`}>{t.auth.signUp}</Link></span></>}
        {mode === "signup" && <span className="text-muted">{t.auth.haveAccount} <Link className="font-semibold text-saudi hover:underline" href="/account/login">{t.auth.signIn}</Link></span>}
        {mode === "reset" && <Link className="text-saudi hover:underline" href="/account/login">{t.common.back}</Link>}
      </div>
    </form>
  );
}
