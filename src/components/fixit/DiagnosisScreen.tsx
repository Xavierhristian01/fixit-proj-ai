import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Camera, ChevronDown, RotateCcw, SendHorizontal } from "lucide-react";
import type { Lang, Machine, Mode, Scenario } from "@/lib/mock-data";
import { analyzePhoto, diagnose, type AiTurn, type PhotoFindings } from "@/lib/ai.functions";
import { toResult, type AiCause } from "@/lib/ai-contract";
import { Btn, TrustChip } from "./ui";
import { FindingsCard, PhotoBubble, PhotoThumb, usePhotoPicker, type Photo } from "./photo";
import { cn } from "@/lib/utils";

type Msg =
  | { id: number; from: "user" | "bot"; kind: "text"; text: string }
  | { id: number; from: "user"; kind: "photo"; url: string; analyzing: boolean }
  | { id: number; from: "bot"; kind: "findings"; findings: PhotoFindings };
export function DiagnosisScreen({
  machine, symptom, photo, initialMode, onBack, onDone,
}: { machine: Machine; symptom: string; photo?: Photo | null; initialMode?: Mode | undefined; onBack: () => void; onDone: (r: Scenario["result"]) => void }) {
  const run = useServerFn(diagnose);
  const runPhoto = useServerFn(analyzePhoto);
  const pic = usePhotoPicker();
  const nextId = useRef(0);
  const id = () => nextId.current++;
  const [lang, setLang] = useState<Lang>("en");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [convo, setConvo] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [findingsText, setFindingsText] = useState<string | null>(null);
  const [typing, setTyping] = useState(true);
  const [turn, setTurn] = useState<AiTurn | null>(null);
  const [qCount, setQCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastAnswer, setLastAnswer] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const lastCause = useRef<AiCause | undefined>(undefined);
  const completionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const done = turn != null && turn.status !== "asking";
  const causes = turn?.causes ?? [];
  const guide = (turn?.mode ?? initialMode) === "guide";

  async function ask(conversation: typeof convo, answerText: string | null, findings: string | null) {
    setTyping(true); setError(null);
    try {
      const r = await run({ data: { machine: machine.name, mode: initialMode, language: lang === "en" ? "english" : "pidgin", conversation, last_answer: answerText, photo_findings: findings } });
      if (!r.turn) { setError(r.error ?? "Something went wrong. Please try again."); return; }
      const t = r.turn;
      setConvo([...conversation, { role: "assistant", content: JSON.stringify(t) }]);
      setMsgs((m) => [...m, { id: id(), from: "bot", kind: "text", text: t.reply }]);
      setTurn(t);
      if (t.causes[0]) lastCause.current = t.causes[0];
      if (t.status === "asking" && t.question) setQCount((n) => n + 1);
      if (t.status !== "asking") completionTimer.current = setTimeout(() => onDone(toResult(t, symptom, lastCause.current)), t.risk === "emergency" ? 0 : 1400);
    } catch {
      setError("FixIt can't reach the technician right now. Please try again in a moment.");
    } finally {
      setTyping(false);
    }
  }

  /** Send text and/or a photo. Photos are analysed first; findings go to the technician. */
  async function send(text: string, p: Photo | null, isFirst = false) {
    const q = !isFirst ? turn?.question?.text : undefined;
    const add: Msg[] = [];
    if (q) add.push({ id: id(), from: "bot", kind: "text", text: q });
    if (text) add.push({ id: id(), from: "user", kind: "text", text });
    const photoId = p ? id() : -1;
    if (p) add.push({ id: photoId, from: "user", kind: "photo", url: p.url, analyzing: true });
    setMsgs((m) => [...m, ...add]);
    setTurn((t) => (t ? { ...t, question: null } : t));
    setTyping(!p);

    let findings = findingsText;
    let userContent = text;
    if (p) {
      let f: PhotoFindings | null = null;
      try { f = (await runPhoto({ data: { image: p.base64 } })).findings; } catch { /* handled below */ }
      setMsgs((m) => m.map((x) => (x.id === photoId && x.kind === "photo" ? { ...x, analyzing: false } : x)));
      if (f) {
        setMsgs((m) => [...m, { id: id(), from: "bot", kind: "findings", findings: f }]);
        const ft = JSON.stringify(f);
        findings = findings ? `${findings}\n${ft}` : ft;
        setFindingsText(findings);
      } else {
        setMsgs((m) => [...m, { id: id(), from: "bot", kind: "text", text: "I couldn't read that photo, so I'll go on what you tell me." }]);
      }
      userContent = text || "I sent a photo.";
    }
    const next = [...convo, { role: "user" as const, content: userContent || symptom }];
    setConvo(next);
    setLastAnswer(isFirst ? null : userContent);
    await ask(next, isFirst ? null : userContent, findings);
  }

  const started = useRef(false);
  useEffect(() => { if (started.current) return; started.current = true; void send(symptom, photo ?? null, true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => () => { clearTimeout(completionTimer.current); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, typing, turn, error]);

  const busy = typing || msgs.some((m) => m.kind === "photo" && m.analyzing);
  function answer(text: string, p: Photo | null = null) {
    if (busy || done) return;
    void send(text, p);
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
          {guide ? "Your situation" : "Likely causes"}
          <motion.span animate={{ rotate: open ? 180 : 0 }}><ChevronDown className="size-5" /></motion.span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              {guide ? (turn?.situation.length ? turn.situation.map((s) => (
                <motion.li key={s.label} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: "easeOut" }} className="flex gap-3 pb-3 text-[14px]">
                  <span className="w-24 shrink-0 text-muted-foreground">{s.label}</span><span className="min-w-0 flex-1 font-medium">{s.value}</span>
                </motion.li>
              )) : <li className="pb-3 text-[14px] text-muted-foreground">Getting the details...</li>) : <>
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
              </>}
            </motion.ul>
          )}
        </AnimatePresence>
      </section>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {msgs.map((m) => (
          <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("flex", m.from === "user" && "justify-end")}>
            {m.kind === "photo" ? <PhotoBubble url={m.url} analyzing={m.analyzing} /> : m.kind === "findings" ? <FindingsCard f={m.findings} /> : (
              <div className={cn("max-w-[82%] whitespace-pre-line rounded-[16px] px-4 py-3 text-[15px] leading-relaxed", m.from === "user" ? "rounded-br-sm bg-secondary text-secondary-foreground" : "rounded-bl-sm bg-card")}>
                {m.text}
              </div>
            )}
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
            <Btn variant="outline" className="mt-3 w-full" onClick={() => ask(convo, lastAnswer, findingsText)}><RotateCcw className="size-4" />Try again</Btn>
          </motion.div>
        )}
        <AnimatePresence>
          {!typing && !done && !error && turn?.question && (
            <motion.div key={qCount} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: "easeOut" }} className="rounded-[16px] border border-border bg-card p-4">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-primary">Question {qCount}</div>
              <p className="mt-1 text-[17px] font-semibold leading-snug">{turn.question.text}</p>
              <div className={cn("mt-4 grid gap-2", turn.question.options.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
                {turn.question.options.map((o, i) => (
                  <Btn key={o} variant={i === (turn.question?.options.length ?? 0) - 1 ? "outline" : "dark"} className="min-h-12 whitespace-normal break-words px-2" onClick={() => answer(o)}>{o}</Btn>
                ))}
              </div>
              <button onClick={() => inputRef.current?.focus()} className="mt-2 min-h-11 w-full text-[14px] font-semibold text-primary">Type an answer</button>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); if ((input.trim() || pic.photo) && !busy && !done) { answer(input.trim(), pic.photo); setInput(""); pic.setPhoto(null); } }}
        className="border-t border-border bg-card px-3 py-3"
      >
        <PhotoThumb photo={pic.photo} onRemove={() => pic.setPhoto(null)} />
        {pic.input}
        <div className="flex items-center gap-2">
          <Btn type="button" variant="outline" className="size-11 shrink-0 px-0" aria-label="Add a photo" onClick={pic.open} disabled={done}><Camera className="size-5" /></Btn>
          <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder={lang === "en" ? "Type a message" : "Write wetin you see"} className="min-h-11 min-w-0 flex-1 rounded-[12px] bg-muted px-4 text-[16px] outline-none" />
          <Btn type="submit" disabled={(!input.trim() && !pic.photo) || busy || done} className="size-11 shrink-0 px-0" aria-label="Send"><SendHorizontal className="size-5" /></Btn>
        </div>
        {pic.error && <p className="mt-2 text-[13px] text-muted-foreground">{pic.error}</p>}
      </form>
    </div>
  );
}
