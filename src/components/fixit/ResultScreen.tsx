import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, Check, MessageCircle, OctagonAlert, RotateCcw } from "lucide-react";
import type { Difficulty, Machine, Scenario } from "@/lib/mock-data";
import { Btn, TrustChip, rise } from "./ui";
import { cn } from "@/lib/utils";

const tag: Record<Difficulty, string> = {
  Easy: "bg-success-soft text-success",
  Medium: "bg-accent text-accent-foreground",
  "Call a pro": "bg-secondary text-secondary-foreground",
};

export function ResultScreen({ machine, symptom, scenario, onBack, onRestart }: { machine: Machine; symptom: string; scenario: Scenario; onBack: () => void; onRestart: () => void }) {
  const r = scenario.result;
  const [done, setDone] = useState<number[]>([]);
  const toggle = (i: number) => setDone((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]));
  const summary = r.kind === "fix" ? `Most likely: ${r.cause} (${r.confidence}%)` : "Safety stop: needs a professional";
  const wa = `https://wa.me/?text=${encodeURIComponent(`FixIt AI report\nMachine: ${machine.name}\nProblem: ${symptom}\n${summary}`)}`;

  return (
    <div className="min-h-dvh px-5 pb-10">
      <header className="flex h-16 items-center gap-2">
        <Btn variant="ghost" className="-ml-3 size-11 px-0" onClick={onBack} aria-label="Back"><ArrowLeft className="size-5" /></Btn>
        <span className="font-bold">{machine.name}</span>
        <TrustChip verified={machine.verified} />
      </header>

      {r.kind === "fix" ? (
        <motion.div variants={rise} initial="hidden" animate="show" custom={0} className="rounded-[16px] bg-secondary p-5 text-secondary-foreground">
          <div className="text-[13px] font-semibold uppercase tracking-wide opacity-70">Most likely cause</div>
          <h1 className="mt-1 text-[26px] leading-tight">{r.cause}</h1>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary-foreground/15">
              <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${r.confidence}%` }} transition={{ duration: 0.6, delay: 0.2 }} />
            </div>
            <span className="text-[14px] font-semibold tabular-nums">{r.confidence}% confidence</span>
          </div>
        </motion.div>
      ) : (
        <motion.div variants={rise} initial="hidden" animate="show" custom={0} className="rounded-[16px] border-2 border-destructive bg-destructive-soft p-5">
          <OctagonAlert className="size-8 text-destructive" />
          <h1 className="mt-2 text-[24px] leading-tight text-destructive">Stop. This needs a professional.</h1>
          <p className="mt-2 text-[15px] leading-relaxed">{r.reason}</p>
        </motion.div>
      )}

      <h2 className="mt-8 text-lg">{r.kind === "fix" ? "Try these, in order" : "While you wait"}</h2>
      <ol className="mt-3 space-y-3">
        {r.steps.map((s, i) => {
          const checked = done.includes(i);
          return (
            <motion.li key={i} variants={rise} initial="hidden" animate="show" custom={i + 1}>
              <button onClick={() => toggle(i)} className="flex w-full gap-3 rounded-[16px] bg-card p-4 text-left">
                <motion.span animate={{ scale: checked ? [1, 1.15, 1] : 1 }} className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-[8px] border-2", checked ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                  {checked && <Check className="size-4" strokeWidth={3} />}
                </motion.span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[15px] leading-snug", checked && "text-muted-foreground line-through")}>{s.text}</span>
                  <span className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", tag[s.difficulty])}>{s.difficulty}</span>
                    {s.source && <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground"><BookOpen className="size-3" />Source: {s.source}</span>}
                  </span>
                </span>
              </button>
            </motion.li>
          );
        })}
      </ol>

      <div className="mt-8 space-y-3">
        <Btn className="w-full min-h-12" onClick={() => window.open(wa, "_blank")}><MessageCircle className="size-5" />Send to a technician on WhatsApp</Btn>
        <Btn variant="outline" className="w-full min-h-12" onClick={onRestart}><RotateCcw className="size-5" />Start a new problem</Btn>
      </div>
    </div>
  );
}
