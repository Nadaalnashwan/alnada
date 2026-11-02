"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CloudOff, CornerDownLeft, HeartPulse, History, Lock, Plus, Search, SendHorizontal, Sparkles, Sprout, Trash2, X } from "lucide-react";
import { Leaf } from "@/components/brand/Decor";
import { DewDrop } from "@/components/brand/Logo";
import { PlantBox } from "@/components/my-green-space/PlantBox";
import { useCart, useSession, useT } from "@/components/layout/Providers";
import { PlantImage } from "@/components/store/PlantImage";
import type { ChatBlock, ChatContext, ChatResponse } from "@/lib/ai/schemas";
import { ChatBlockView, RichText } from "./ChatBlocks";

type Workflow = ChatContext["workflow"];
interface Msg { role: "user" | "assistant"; content: string; blocks?: ChatBlock[]; error?: string; intent?: string }

/** Context-aware follow-up chips shown after Nada's latest reply. */
const FOLLOW_UPS: Record<string, { ar: string[]; en: string[] }> = {
  recommend_plant: { ar: ["وريني خيارات أرخص", "ضيفي النبتة الأولى للسلة", "احفظي الثانية في قائمة أمنياتي"], en: ["Show me cheaper options", "Add the first one to my cart", "Save the second to my wishlist"] },
  cheaper_options: { ar: ["ضيفي النبتة الأولى للسلة", "قارني بين الأولى والثانية"], en: ["Add the first one to my cart", "Compare the first and second"] },
  get_plant_care: { ar: ["وش علامات زيادة الري؟", "متى أغيّر الأصيص؟"], en: ["What are signs of overwatering?", "When should I repot?"] },
  investigate_plant_problem: { ar: ["كيف أفحص الجذور؟", "وش التربة المناسبة لها؟"], en: ["How do I check the roots?", "Which soil suits it?"] },
  save_care_log: { ar: ["كيف حال نباتاتي؟", "متى آخر مرة سقيتها؟"], en: ["How are my plants?", "When did I last water it?"] },
  get_my_plants: { ar: ["أي نبتة تحتاج انتباه؟", "وريني النباتات اللي سألتك عنها الأسبوع اللي فات"], en: ["Which plant needs attention?", "Show plants I asked about last week"] },
  get_plant_history: { ar: ["سقيتها اليوم", "كيف أعتني فيها؟"], en: ["I watered it today", "How do I care for it?"] },
};
export interface PlantOption { id: string; title: string; image: string | null }
interface SessionRow { id: string; title: string | null; updated_at: string }

export function NadaChat({ plants, aiReady, initialPrompt, initialPlantId }: { plants: PlantOption[]; aiReady: boolean; initialPrompt?: string; initialPlantId?: string }) {
  const { t, locale } = useT();
  const { user, dbReady } = useSession();
  const cart = useCart();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState(initialPrompt ?? "");
  const [busy, setBusy] = useState(false);
  const [workflow, setWorkflow] = useState<Workflow>("general");
  const [context, setContext] = useState<Partial<ChatContext>>({ save_explored: true });
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<string | null>(initialPlantId ?? null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const signedIn = Boolean(user && dbReady);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy]);
  const loadSessions = useCallback(() => {
    if (!signedIn) return;
    fetch("/api/chat/sessions").then((r) => (r.ok ? r.json() : { sessions: [] })).then((d) => setSessions(d.sessions));
  }, [signedIn]);
  useEffect(loadSessions, [loadSessions]);

  const send = async (text: string, opts: { userPlantId?: string | null } = {}) => {
    const message = text.trim();
    if (!message || busy) return;
    const history = messages.filter((m) => !m.error).slice(-10).map((m) => ({ role: m.role, content: m.content.slice(0, 3500) }));
    setMessages((m) => [...m, { role: "user", content: message }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history, context, sessionId, workflow, userPlantId: opts.userPlantId ?? selectedPlant }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = data.error === "AI_NOT_CONFIGURED" ? t.nada.notConfigured : data.error === "RATE_LIMITED" || data.error === "AI_RATE_LIMITED" ? t.nada.rateLimited : t.nada.error;
        setMessages((m) => [...m, { role: "assistant", content: "", error: err }]);
        return;
      }
      const r = data as ChatResponse;
      for (const a of r.clientActions) if (a.type === "add_to_cart") cart.add(a.productId);
      const confirmations: ChatBlock[] = r.clientActions.map(() => ({ type: "action", status: "success", message: locale === "ar" ? "أضفتها لسلتك ✓" : "Added to your cart ✓" }));
      setMessages((m) => [...m, { role: "assistant", content: r.reply, blocks: [...confirmations, ...r.blocks], error: r.replyError ? t.nada.error : undefined, intent: r.intent }]);
      setContext(r.context);
      setWorkflow(r.context.workflow);
      if (r.sessionId && r.sessionId !== sessionId) { setSessionId(r.sessionId); loadSessions(); }
      setSelectedPlant(null);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "", error: t.nada.error }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const startWorkflow = (w: Workflow, prompt: string) => {
    setWorkflow(w);
    setInput(prompt);
    inputRef.current?.focus();
  };

  const newChat = () => { setMessages([]); setSessionId(null); setContext({ save_explored: context.save_explored ?? true }); setWorkflow("general"); };
  const openSession = async (id: string) => {
    const res = await fetch(`/api/chat/sessions/${id}`);
    if (!res.ok) return;
    const d = await res.json();
    setSessionId(id);
    setContext(d.session.context ?? {});
    setMessages(d.messages.map((m: { role: "user" | "assistant"; content: string; payload?: { blocks?: ChatBlock[] } }) => ({ role: m.role, content: m.content, blocks: m.payload?.blocks })));
    setShowHistory(false);
  };
  const deleteSession = async (id: string) => {
    await fetch(`/api/chat/sessions/${id}`, { method: "DELETE" });
    if (id === sessionId) newChat();
    loadSessions();
  };

  const ar = locale === "ar";
  const workflows = [
    { w: "care" as const, icon: Sprout, title: t.nada.care, desc: t.nada.careDesc, prompt: ar ? "عندي نبتة " : "I have a ", tone: "from-[#e7f4ea] to-[#d3ebdb] text-saudi" },
    { w: "rescue" as const, icon: HeartPulse, title: t.nada.rescue, desc: t.nada.rescueDesc, prompt: ar ? "نبتتي " : "My plant ", tone: "from-[#fbf3e1] to-[#f3e5c2] text-warn" },
    { w: "finder" as const, icon: Search, title: t.nada.finder, desc: t.nada.finderDesc, prompt: ar ? "أبي نبتة لـ" : "I want a plant for ", tone: "from-[#eaf3f1] to-[#d3e7e2] text-deep" },
  ];
  const chosenPlant = plants.find((p) => p.id === selectedPlant);
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant" && !m.error);
  const followUps = !busy && lastAssistant?.intent ? (FOLLOW_UPS[lastAssistant.intent]?.[locale] ?? []) : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
      {/* Sidebar: history & plants */}
      <aside className={`${showHistory ? "block" : "hidden"} space-y-4 lg:block`}>
        <button onClick={newChat} className="btn-primary w-full py-3"><Plus className="size-4" />{t.nada.newChat}</button>
        {signedIn ? (
          <div className="card p-3">
            <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-bold text-forest"><History className="size-4 text-saudi" />{t.nada.history}</h2>
            {sessions.length === 0 ? <p className="px-1 text-xs text-muted">{ar ? "محادثاتك تنحفظ هنا" : "Your chats are saved here"}</p> : (
              <ul className="max-h-80 space-y-0.5 overflow-y-auto">
                {sessions.map((s) => (
                  <li key={s.id} className={`group flex items-center rounded-xl transition ${s.id === sessionId ? "bg-soft" : "hover:bg-mist"}`}>
                    <button onClick={() => openSession(s.id)} className="min-w-0 flex-1 truncate px-2.5 py-2 text-start text-sm text-deep">{s.title ?? "…"}</button>
                    <button onClick={() => deleteSession(s.id)} className="p-2 text-muted opacity-0 transition group-hover:opacity-100 focus:opacity-100" aria-label="Delete"><Trash2 className="size-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
            <label className="mt-3 flex items-start gap-2 border-t border-line px-1 pt-3 text-xs leading-5 text-muted">
              <input type="checkbox" className="mt-0.5 accent-saudi" checked={context.save_explored ?? true} onChange={(e) => setContext((c) => ({ ...c, save_explored: e.target.checked }))} />
              {ar ? "احفظ النباتات اللي أسأل عنها في «نباتات استكشفتها» (تقدر تمسحها من مساحتك الخضراء)" : "Save plants I ask about to “Explored plants” (you can clear them in your Green Space)"}
            </label>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-[1.5rem] bg-botanical p-4 text-xs leading-6 text-muted ring-1 ring-saudi/10">
            <Lock className="mb-2 size-4 text-saudi" />{t.nada.guestNote}{" "}
            <Link href="/account/login?next=/nada-ai" className="font-semibold text-saudi underline">{t.auth.signIn}</Link>
          </div>
        )}
        {plants.length > 0 && (
          <div className="card p-3">
            <h2 className="mb-2.5 flex items-center gap-2 px-1 text-sm font-bold text-forest"><Sprout className="size-4 text-saudi" />{t.nada.choosePlant}</h2>
            <div className="grid grid-cols-3 gap-2 lg:grid-cols-2">
              {plants.map((p) => (
                <button key={p.id} onClick={() => setSelectedPlant((s) => (s === p.id ? null : p.id))} aria-pressed={selectedPlant === p.id}
                  className={`group rounded-2xl p-1 text-start ring-2 transition ${selectedPlant === p.id ? "bg-soft ring-saudi" : "ring-transparent hover:bg-mist"}`}>
                  <PlantBox id={p.id} image={p.image} alt="" size="sm" />
                  <p className="truncate px-1 pt-1.5 text-[11px] font-semibold text-deep">{p.title}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* Conversation */}
      <section className="card flex min-h-[74dvh] flex-col overflow-hidden ring-1 ring-saudi/[0.06]">
        <div className="relative flex items-center justify-between overflow-hidden bg-forest-glow px-4 py-3.5 text-white sm:px-5">
          <Leaf className="absolute end-24 -top-6 h-20 w-10 rotate-45 text-white/[0.06]" />
          <div className="relative flex items-center gap-3">
            <span className="relative grid size-11 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
              <DewDrop tone="dark" className="size-8" />
              <span className="absolute -bottom-0.5 -end-0.5 size-3 rounded-full bg-sprout ring-2 ring-forest" />
            </span>
            <div>
              <h1 className="font-bold">{t.nada.title}</h1>
              <p className="text-[11px] text-white/65">{t.nada.subtitle} · <span dir="ltr">Meta Llama</span></p>
            </div>
          </div>
          <button className="relative btn bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/15 lg:hidden" onClick={() => setShowHistory((v) => !v)}><History className="size-4" />{t.nada.history}</button>
        </div>

        <div className="relative flex-1 space-y-6 overflow-y-auto bg-gradient-to-b from-mist/70 to-white p-4 sm:p-6" aria-live="polite">
          {!aiReady && <p className="rounded-2xl bg-warn-bg p-3 text-sm text-warn">{t.nada.notConfigured}</p>}
          {messages.length === 0 && (
            <div className="relative mx-auto max-w-2xl py-6 text-center">
              <div className="relative mx-auto grid size-24 place-items-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-dew/60 [animation-duration:3s]" />
                <span className="absolute inset-2 rounded-full bg-gradient-to-br from-white to-dew shadow-[var(--shadow-inner-dew)]" />
                <DewDrop className="relative h-12 w-10 animate-dew" />
              </div>
              <h2 className="mt-5 animate-rise text-2xl font-bold text-forest sm:text-3xl">{t.nada.welcome}</h2>
              <p className="mx-auto mt-2 max-w-md animate-rise text-sm leading-7 text-muted [animation-delay:80ms]">{ar ? "أعرف نباتات متجرنا، وأقرأ سجلات نباتاتك (بإذنك) عشان أعطيك نصيحة تخصك." : "I know our store's plants and can read your plant records (with your permission) to give advice that fits you."}</p>
              <div className="mt-8 grid gap-3 text-start sm:grid-cols-3">
                {workflows.map(({ w, icon: I, title, desc, prompt, tone }, i) => (
                  <button key={w} onClick={() => startWorkflow(w, prompt)}
                    className={`group animate-rise rounded-[1.5rem] bg-white p-4 ring-1 transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] ${workflow === w ? "ring-2 ring-saudi" : "ring-saudi/10"}`}
                    style={{ animationDelay: `${160 + i * 90}ms` }}>
                    <span className={`grid size-11 place-items-center rounded-2xl bg-gradient-to-br ${tone} transition duration-500 group-hover:rotate-[-8deg]`}><I className="size-5" /></span>
                    <p className="mt-3.5 text-sm font-bold leading-6 text-forest">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">{desc}</p>
                  </button>
                ))}
              </div>
              <div className="mt-7 flex flex-wrap justify-center gap-2">
                {[...(signedIn && plants.length ? t.nada.personalSuggestions : []), ...t.nada.suggestions].map((s, i) => (
                  <button key={s} onClick={() => send(s)} disabled={!aiReady}
                    className="animate-rise inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[13px] text-deep ring-1 ring-saudi/10 transition hover:-translate-y-0.5 hover:bg-saudi hover:text-white disabled:opacity-50"
                    style={{ animationDelay: `${420 + i * 50}ms` }}>
                    <Sparkles className="size-3.5 text-leaf" />{s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => m.role === "user" ? (
            <div key={i} className="flex animate-rise justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-[1.4rem] rounded-se-md bg-gradient-to-b from-[#0a7a3f] to-saudi px-4 py-3 text-sm leading-7 text-white shadow-[0_8px_20px_-12px_rgb(0_108_53/0.8)]">{m.content}</p>
            </div>
          ) : (
            <div key={i} className="flex animate-rise gap-3">
              <span className="mt-1 grid size-9 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-white to-dew shadow-[var(--shadow-inner-dew)]"><DewDrop className="h-5 w-4" /></span>
              <div className="min-w-0 flex-1 space-y-3">
                {m.content && (
                  <div className="rounded-[1.4rem] rounded-ss-md bg-white px-4 py-3.5 text-sm text-ink shadow-[var(--shadow-card)] ring-1 ring-saudi/[0.06]">
                    <p className="mb-1 text-[11px] font-bold text-saudi">{t.nada.title}</p>
                    <RichText text={m.content} />
                  </div>
                )}
                {m.error && <p className="flex items-start gap-2 rounded-2xl bg-danger-bg px-4 py-3 text-sm text-danger" role="alert"><CloudOff className="mt-0.5 size-4 shrink-0" />{m.error}</p>}
                {m.blocks?.map((b, j) => <ChatBlockView key={j} block={b} onChoose={(id, label) => { setSelectedPlant(id); send(`${messages[i - 1]?.content ?? ""} (${label})`, { userPlantId: id }); }} />)}
              </div>
            </div>
          ))}
          {followUps.length > 0 && (
            <div className="flex flex-wrap gap-2 ps-12">
              {followUps.map((f) => (
                <button key={f} onClick={() => send(f)} disabled={!aiReady} className="animate-rise inline-flex items-center gap-1.5 rounded-full border border-saudi/20 bg-white px-3 py-1.5 text-xs font-medium text-saudi transition hover:bg-saudi hover:text-white">
                  <CornerDownLeft className="size-3 rtl:-scale-x-100" />{f}
                </button>
              ))}
            </div>
          )}
          {busy && (
            <div className="flex items-center gap-3 text-sm text-muted" role="status">
              <span className="grid size-9 place-items-center rounded-2xl bg-gradient-to-br from-white to-dew shadow-[var(--shadow-inner-dew)]"><DewDrop className="h-5 w-4" /></span>
              <span className="flex items-end gap-1 rounded-full bg-white px-4 py-3 shadow-[var(--shadow-card)]" aria-hidden>
                {[0, 1, 2].map((d) => <DewDrop key={d} className="h-3 w-2.5 animate-bounce" />)}
              </span>
              <span className="text-xs">{t.nada.thinking}</span>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="border-t border-line bg-white p-3 sm:p-4">
          {chosenPlant && (
            <p className="mb-2.5 inline-flex animate-pop items-center gap-2 rounded-full bg-soft py-1 pe-2 ps-1 text-xs font-medium text-deep">
              <span className="relative size-6 overflow-hidden rounded-full bg-white"><PlantImage src={chosenPlant.image} alt="" sizes="24px" /></span>
              {t.space.ask} {chosenPlant.title}
              <button type="button" onClick={() => setSelectedPlant(null)} className="grid size-5 place-items-center rounded-full text-muted hover:bg-white" aria-label={t.common.close}><X className="size-3" /></button>
            </p>
          )}
          <div className="flex items-end gap-2 rounded-[1.6rem] bg-mist p-1.5 ring-1 ring-saudi/10 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-saudi/30">
            <label className="flex-1">
              <span className="sr-only">{t.nada.placeholder}</span>
              <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} rows={1} maxLength={1500}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                placeholder={t.nada.placeholder} className="max-h-40 min-h-11 w-full resize-none bg-transparent px-3 py-2.5 text-sm outline-none" />
            </label>
            <button disabled={busy || !input.trim() || !aiReady} className="btn-primary size-11 shrink-0 p-0" aria-label={t.nada.send}><SendHorizontal className="size-5 rtl:rotate-180" /></button>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted">{t.nada.disclaimer}</p>
        </form>
      </section>
    </div>
  );
}
