import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Camera, ChevronDown, SendHorizontal } from "lucide-react";
import { applyEffect, type Cause, type Lang, type Machine, type Scenario } from "@/lib/mock-data";
import { Btn, TrustChip } from "./ui";
import { cn } from "@/lib/utils";

type Msg = { id: number; from: "user" | "bot"; text: string };
type Answer = "yes" | "no" | "unsure";
const labels: Record<Answer, string> = { yes: "Yes", no: "No", unsure: "Not sure" };

export function DiagnosisScreen({
  machine, symptom, scenario, onBack, onDone,
}: { machine: Machine; symptom: string; scenario: Scenario; onBack: () => void; onDone: (c: Cause[]) => void }) {
  const [lang, setLang] = useState<Lang>("en");
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, from: "user", text: symptom }]);
  const [typing, setTyping] = useState(true);
  const [qIndex, setQIndex] = useState(0);
  const [causes, setCauses] = useState(scenario.causes);
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const finished = qIndex >= scenario.questions.length;

  useEffect(() => {
    const t = setTimeout(() => {
      setMsgs((m) => [...m, { id: 1, from: "bot", text: scenario.intro[lang] }]);
      setTyping(false);
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, typing, qIndex]);

  function answer(a: Answer, text?: string) {
    const q = scenario.questions[qIndex]!;
    setMsgs((m) => [...m, { id: m.length, from: "bot", text: q.text[lang] }, { id: m.length + 1, from: "user", text: text ?? labels[a] }]);
    setTyping(true);
    setTimeout(() => {
      const next = applyEffect(causes, q.effects[a]);
      setCauses(next);
      setTyping(false);
      const n = qIndex + 1;
      setQIndex(n);
      if (n >= scenario.questions.length) {
        setMsgs((m) => [...m, { id: m.length, from: "bot", text: lang === "en" ? "Thanks. I have enough to give you a plan." : "Thank you. I don get enough to give you plan." }]);
        setTimeout(() => onDone(next), 1100);
      }
    }, 900);
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
              {causes.map((c, i) => (
                <motion.li key={c.id} layout transition={{ type: "spring", stiffness: 400, damping: 34 }} className="pb-3">
                  <div className="flex justify-between text-[14px]">
                    <span className={cn(i === 0 && "font-semibold")}>{c.label}</span>
                    <span className="tabular-nums text-muted-foreground">{c.pct}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <motion.div className={cn("h-full rounded-full", i === 0 ? "bg-primary" : "bg-secondary/40")} initial={{ width: 0 }} animate={{ width: `${c.pct}%` }} transition={{ duration: 0.5, ease: "easeOut" }} />
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
            <div className={cn("max-w-[82%] rounded-[16px] px-4 py-3 text-[15px] leading-relaxed", m.from === "user" ? "rounded-br-sm bg-secondary text-secondary-foreground" : "rounded-bl-sm bg-card")}>
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
        <AnimatePresence>
          {!typing && !finished && (
            <motion.div key={qIndex} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="rounded-[16px] border border-border bg-card p-4">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-primary">Question {qIndex + 1} of {scenario.questions.length}</div>
              <p className="mt-1 text-[17px] font-semibold leading-snug">{scenario.questions[qIndex]?.text[lang]}</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {(["yes", "no", "unsure"] as const).map((a) => (
                  <Btn key={a} variant={a === "unsure" ? "outline" : "dark"} className="min-h-12" onClick={() => answer(a)}>{labels[a]}</Btn>
                ))}
              </div>
              <button onClick={() => inputRef.current?.focus()} className="mt-2 min-h-11 w-full text-[14px] font-semibold text-primary">Type an answer</button>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); if (input.trim() && !typing && !finished) { answer("unsure", input.trim()); setInput(""); } }}
        className="flex items-center gap-2 border-t border-border bg-card px-3 py-3"
      >
        <Btn type="button" variant="outline" className="size-11 shrink-0 px-0" aria-label="Add a photo"><Camera className="size-5" /></Btn>
        <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder={lang === "en" ? "Type a message" : "Write wetin you see"} className="min-h-11 min-w-0 flex-1 rounded-[12px] bg-muted px-4 text-[16px] outline-none" />
        <Btn type="submit" disabled={!input.trim()} className="size-11 shrink-0 px-0" aria-label="Send"><SendHorizontal className="size-5" /></Btn>
      </form>
    </div>
  );
}
