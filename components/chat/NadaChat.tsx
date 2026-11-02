"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { HeartPulse, History, Plus, Search, SendHorizontal, Sprout, Trash2 } from "lucide-react";
import { DewDrop } from "@/components/brand/Logo";
import { useCart, useSession, useT } from "@/components/layout/Providers";
import { PlantImage } from "@/components/store/PlantImage";
import type { ChatBlock, ChatContext, ChatResponse } from "@/lib/ai/schemas";
import { ChatBlockView, RichText } from "./ChatBlocks";

type Workflow = ChatContext["workflow"];
interface Msg { role: "user" | "assistant"; content: string; blocks?: ChatBlock[]; error?: string }
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
      setMessages((m) => [...m, { role: "assistant", content: r.reply, blocks: [...confirmations, ...r.blocks], error: r.replyError ? t.nada.error : undefined }]);
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

  const workflows = [
    { w: "care" as const, icon: Sprout, title: t.nada.care, desc: t.nada.careDesc, prompt: locale === "ar" ? "عندي نبتة " : "I have a " },
    { w: "rescue" as const, icon: HeartPulse, title: t.nada.rescue, desc: t.nada.rescueDesc, prompt: locale === "ar" ? "نبتتي " : "My plant " },
    { w: "finder" as const, icon: Search, title: t.nada.finder, desc: t.nada.finderDesc, prompt: locale === "ar" ? "أبي نبتة لـ" : "I want a plant for " },
  ];
  const chosenPlant = plants.find((p) => p.id === selectedPlant);

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      {/* Sidebar: history & plants */}
      <aside className={`${showHistory ? "block" : "hidden"} space-y-4 lg:block`}>
        <button onClick={newChat} className="btn-primary w-full"><Plus className="size-4" />{t.nada.newChat}</button>
        {signedIn ? (
          <div className="card p-3">
            <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-deep"><History className="size-4" />{t.nada.history}</h2>
            {sessions.length === 0 ? <p className="px-1 text-xs text-muted">—</p> : (
              <ul className="max-h-80 space-y-0.5 overflow-y-auto">
                {sessions.map((s) => (
                  <li key={s.id} className={`group flex items-center rounded-lg ${s.id === sessionId ? "bg-soft" : "hover:bg-soft/60"}`}>
                    <button onClick={() => openSession(s.id)} className="min-w-0 flex-1 truncate px-2 py-2 text-start text-sm text-deep">{s.title ?? "…"}</button>
                    <button onClick={() => deleteSession(s.id)} className="p-2 text-muted opacity-0 transition group-hover:opacity-100 focus:opacity-100" aria-label="Delete"><Trash2 className="size-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
            <label className="mt-3 flex items-start gap-2 border-t border-line px-1 pt-3 text-xs text-muted">
              <input type="checkbox" className="mt-0.5 accent-saudi" checked={context.save_explored ?? true} onChange={(e) => setContext((c) => ({ ...c, save_explored: e.target.checked }))} />
              {locale === "ar" ? "احفظ النباتات اللي أسأل عنها في «نباتات استكشفتها» (تقدر تمسحها من مساحتك الخضراء)" : "Save plants I ask about to “Explored plants” (you can clear them in your Green Space)"}
            </label>
          </div>
        ) : (
          <p className="card p-4 text-xs leading-6 text-muted">{t.nada.guestNote} <Link href="/account/login?next=/nada-ai" className="font-semibold text-saudi underline">{t.auth.signIn}</Link></p>
        )}
        {plants.length > 0 && (
          <div className="card p-3">
            <h2 className="mb-2 px-1 text-sm font-semibold text-deep">{t.nada.choosePlant}</h2>
            <div className="grid grid-cols-3 gap-2 lg:grid-cols-2">
              {plants.map((p) => (
                <button key={p.id} onClick={() => setSelectedPlant((s) => (s === p.id ? null : p.id))} aria-pressed={selectedPlant === p.id}
                  className={`overflow-hidden rounded-xl border-2 text-start transition ${selectedPlant === p.id ? "border-saudi" : "border-transparent"}`}>
                  <div className="relative aspect-square bg-soft"><PlantImage src={p.image} alt="" sizes="100px" /></div>
                  <p className="truncate px-1.5 py-1 text-[11px] font-medium text-deep">{p.title}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* Conversation */}
      <section className="card flex min-h-[70dvh] flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-soft"><DewDrop className="h-5 w-4" /></span>
            <div>
              <h1 className="text-sm font-bold text-deep">{t.nada.title}</h1>
              <p className="text-[11px] text-muted">{t.nada.subtitle} · Meta Llama</p>
            </div>
          </div>
          <button className="btn-ghost px-3 py-1.5 text-xs lg:hidden" onClick={() => setShowHistory((v) => !v)}><History className="size-4" />{t.nada.history}</button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6" aria-live="polite">
          {!aiReady && <p className="rounded-2xl bg-warn-bg p-3 text-sm text-warn">{t.nada.notConfigured}</p>}
          {messages.length === 0 && (
            <div className="mx-auto max-w-2xl py-6 text-center animate-rise">
              <DewDrop className="mx-auto h-14 w-11 animate-dew" />
              <h2 className="mt-4 text-2xl font-bold text-deep">{t.nada.welcome}</h2>
              <div className="mt-8 grid gap-3 text-start sm:grid-cols-3">
                {workflows.map(({ w, icon: I, title, desc, prompt }) => (
                  <button key={w} onClick={() => startWorkflow(w, prompt)} className={`rounded-2xl border p-4 transition hover:border-saudi hover:shadow-[var(--shadow-card)] ${workflow === w ? "border-saudi bg-soft" : "border-line bg-white"}`}>
                    <I className="size-6 text-saudi" />
                    <p className="mt-3 text-sm font-semibold leading-6 text-deep">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">{desc}</p>
                  </button>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {[...(signedIn && plants.length ? t.nada.personalSuggestions : []), ...t.nada.suggestions].map((s) => (
                  <button key={s} onClick={() => send(s)} disabled={!aiReady} className="chip px-3.5 py-1.5 text-[13px] hover:bg-saudi hover:text-white disabled:opacity-50">{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-se-sm bg-saudi px-4 py-2.5 text-sm leading-7 text-white">{m.content}</p>
            </div>
          ) : (
            <div key={i} className="flex gap-3">
              <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-soft"><DewDrop className="h-4 w-3" /></span>
              <div className="min-w-0 flex-1 space-y-3">
                {m.content && <div className="rounded-2xl rounded-ss-sm bg-soft/70 px-4 py-3 text-sm text-ink"><RichText text={m.content} /></div>}
                {m.error && <p className="rounded-2xl bg-danger-bg px-4 py-3 text-sm text-danger" role="alert">{m.error}</p>}
                {m.blocks?.map((b, j) => <ChatBlockView key={j} block={b} onChoose={(id, label) => { setSelectedPlant(id); send(`${messages[i - 1]?.content ?? ""} (${label})`, { userPlantId: id }); }} />)}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-3 text-sm text-muted">
              <span className="grid size-8 place-items-center rounded-full bg-soft"><DewDrop className="h-4 w-3" /></span>
              <span className="flex gap-1" aria-hidden>{[0, 1, 2].map((d) => <span key={d} className="size-1.5 animate-pulse-dot rounded-full bg-saudi" style={{ animationDelay: `${d * 0.2}s` }} />)}</span>
              {t.nada.thinking}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="border-t border-line p-3 sm:p-4">
          {chosenPlant && (
            <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-soft px-3 py-1 text-xs text-deep">
              {t.space.ask} {chosenPlant.title}
              <button type="button" onClick={() => setSelectedPlant(null)} className="text-muted" aria-label={t.common.close}>×</button>
            </p>
          )}
          <div className="flex items-end gap-2">
            <label className="flex-1">
              <span className="sr-only">{t.nada.placeholder}</span>
              <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} rows={1} maxLength={1500}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                placeholder={t.nada.placeholder} className="input max-h-40 min-h-12 resize-none rounded-2xl py-3" />
            </label>
            <button disabled={busy || !input.trim() || !aiReady} className="btn-primary size-12 shrink-0 p-0" aria-label={t.nada.send}><SendHorizontal className="size-5 rtl:rotate-180" /></button>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted">{t.nada.disclaimer}</p>
        </form>
      </section>
    </div>
  );
}
