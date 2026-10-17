import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ChevronDown, RotateCcw, SendHorizontal } from "lucide-react";
import type { Difficulty, Lang, Machine, Scenario } from "@/lib/mock-data";
import { diagnose, type AiTurn } from "@/lib/ai.functions";
import { safetyScenario } from "@/lib/safety";
import { Btn, TrustChip } from "./ui";
import { cn } from "@/lib/utils";

type Msg = { id: number; from: "user" | "bot"; text: string };
const diff: Record<AiTurn["checklist"][number]["difficulty"], Difficulty> = { easy: "Easy", medium: "Medium", pro: "Call a pro" };

function toResult(t: AiTurn): Scenario["result"] {
  if (t.status === "safety_stop") {
    const base = safetyScenario(t.safety_message ?? "This could be dangerous.").result;
    return { ...base, reason: t.safety_message ?? base.reason } as Scenario["result"];
  }
  const top = t.causes[0];
  return {
    kind: "fix",
    cause: top?.name ?? "Unclear fault",
    confidence: Math.round(top?.likelihood ?? 0),
    steps: t.checklist.map((s) => ({ text: s.step, difficulty: diff[s.difficulty], source: s.source ?? undefined })),
  };
}

export function DiagnosisScreen({
  machine, symptom, photoFindings, onBack, onDone,
}: { machine: Machine; symptom: string; photoFindings?: string | null; onBack: () => void; onDone: (r: Scenario["result"]) => void }) {
  const run = useServerFn(diagnose);
  const [lang, setLang] = useState<Lang>("en");
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, from: "user", text: symptom }]);
  const [convo, setConvo] = useState<{ role: "user" | "assistant"; content: string }[]>([{ role: "user", content: symptom }]);
  const [typing, setTyping] = useState(true);
  const [turn, setTurn] = useState<AiTurn | null>(null);
  const [qCount, setQCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastAnswer, setLastAnswer] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const done = turn != null && turn.status !== "asking";
  const causes = turn?.causes ?? [];

  async function ask(conversation: typeof convo, answerText: string | null) {
    setTyping(true); setError(null);
    try {
      const r = await run({ data: { machine: machine.name, language: lang === "en" ? "english" : "pidgin", conversation, last_answer: answerText, photo_findings: photoFindings ?? null } });
      if (!r.turn) { setError(r.error ?? "Something went wrong. Please try again."); return; }
      const t = r.turn;
      setConvo([...conversation, { role: "assistant", content: JSON.stringify(t) }]);
      setMsgs((m) => [...m, { id: m.length, from: "bot", text: t.reply }]);
      setTurn(t);
      if (t.status === "asking" && t.question) setQCount((n) => n + 1);
      if (t.status !== "asking") setTimeout(() => onDone(toResult(t)), 1400);
    } catch {
      setError("FixIt can't reach the technician right now. Please try again in a moment.");
    } finally {
      setTyping(false);
    }
  }

  useEffect(() => { void ask(convo, null); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, typing, turn, error]);

  function answer(text: string) {
    if (typing || done) return;
    const q = turn?.question?.text;
    setMsgs((m) => [...m, ...(q ? [{ id: m.length, from: "bot" as const, text: q }] : []), { id: m.length + (q ? 1 : 0), from: "user", text }]);
    const next = [...convo, { role: "user" as const, content: text }];
    setConvo(next);
    setLastAnswer(text);
    setTurn((t) => (t ? { ...t, question: null } : t));
    void ask(next, text);
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-2 border-b border-border bg-card px-2 py-2">
        <Btn variant="ghost" className="size-11 px-0" onClick={onBack} aria-label="Back"><ArrowLeft className="size-5" /></Btn>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{machine.name}</div>
          <TrustChip verified={machine.verified} />
        </div>
        <div className="flex shrink-0 rounded-[12px] bg-muted p-1 text-[13px] font-semibold">
          {(["en", "pcm"] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)} className="relative min-h-9 rounded-[9px] px-3">
              {lang === l && <motion.span layoutId="lang" className="absolute inset-0 rounded-[9px] bg-card shadow-float" />}
              <span className="relative">{l === "en" ? "English" : "Pidgin"}</span>
            </button>
          ))}
        </div>
      </header>

      <section className="border-b border-border bg-card px-4">
        <button onClick={() => setOpen(!open)} className="flex min-h-12 w-full items-center justify-between font-bold">
          Likely causes
          <motion.span animate={{ rotate: open ? 180 : 0 }}><ChevronDown className="size-5" /></motion.span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              {causes.length === 0 && <li className="pb-3 text-[14px] text-muted-foreground">Working it out...</li>}
              {causes.map((c, i) => (
                <motion.li key={c.name} layout transition={{ type: "spring", stiffness: 400, damping: 34 }} className="pb-3">
                  <div className="flex justify-between text-[14px]">
                    <span className={cn(i === 0 && "font-semibold")}>{c.name}</span>
                    <span className="tabular-nums text-muted-foreground">{Math.round(c.likelihood)}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <motion.div className={cn("h-full rounded-full", i === 0 ? "bg-primary" : "bg-secondary/40")} initial={{ width: 0 }} animate={{ width: `${c.likelihood}%` }} transition={{ duration: 0.5, ease: "easeOut" }} />
                  </div>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </section>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {msgs.map((m) => (
          <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("flex", m.from === "user" && "justify-end")}>
            <div className={cn("max-w-[82%] whitespace-pre-line rounded-[16px] px-4 py-3 text-[15px] leading-relaxed", m.from === "user" ? "rounded-br-sm bg-secondary text-secondary-foreground" : "rounded-bl-sm bg-card")}>
              {m.text}
            </div>
          </motion.div>
        ))}
        {typing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex w-fit gap-1 rounded-[16px] rounded-bl-sm bg-card px-4 py-4" aria-label="FixIt is typing">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className="size-2 rounded-full bg-muted-foreground" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
            ))}
          </motion.div>
        )}
        {error && !typing && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[16px] border border-border bg-card p-4">
            <p className="text-[15px]">{error}</p>
            <Btn variant="outline" className="mt-3 w-full" onClick={() => ask(convo, lastAnswer)}><RotateCcw className="size-4" />Try again</Btn>
          </motion.div>
        )}
        <AnimatePresence>
          {!typing && !done && !error && turn?.question && (
            <motion.div key={qCount} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: "easeOut" }} className="rounded-[16px] border border-border bg-card p-4">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-primary">Question {qCount}</div>
              <p className="mt-1 text-[17px] font-semibold leading-snug">{turn.question.text}</p>
              <div className={cn("mt-4 grid gap-2", turn.question.options.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
                {turn.question.options.map((o, i) => (
                  <Btn key={o} variant={i === turn.question!.options.length - 1 ? "outline" : "dark"} className="min-h-12 px-2" onClick={() => answer(o)}>{o}</Btn>
                ))}
              </div>
              <button onClick={() => inputRef.current?.focus()} className="mt-2 min-h-11 w-full text-[14px] font-semibold text-primary">Type an answer</button>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); if (input.trim()) { answer(input.trim()); setInput(""); } }}
        className="flex items-center gap-2 border-t border-border bg-card px-3 py-3"
      >
        <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder={lang === "en" ? "Type a message" : "Write wetin you see"} className="min-h-11 min-w-0 flex-1 rounded-[12px] bg-muted px-4 text-[16px] outline-none" />
        <Btn type="submit" disabled={!input.trim() || typing || done} className="size-11 shrink-0 px-0" aria-label="Send"><SendHorizontal className="size-5" /></Btn>
      </form>
    </div>
  );
}
