import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, Check, MessageCircle, OctagonAlert, Phone, RotateCcw, TriangleAlert } from "lucide-react";
import type { Difficulty, Machine, Risk, Scenario } from "@/lib/mock-data";
import { buildReport } from "@/lib/ai-contract";
import { Btn, TrustChip, rise } from "./ui";
import { cn } from "@/lib/utils";

const tag: Record<Difficulty, string> = {
  Easy: "bg-success-soft text-success",
  Medium: "bg-warning-soft text-warning",
  "Call a pro": "bg-secondary text-secondary-foreground",
};
const riskTag: Record<Risk, string> = {
  diy: "bg-success-soft text-success", careful: "bg-warning-soft text-warning",
  pro: "bg-destructive-soft text-destructive", emergency: "bg-destructive-soft text-destructive",
};
const riskLabel: Record<Risk, string> = { diy: "DIY", careful: "Careful", pro: "Pro", emergency: "Emergency" };

export function ResultScreen({ machine, symptom, scenario, onBack, onRestart }: { machine: Machine; symptom: string; scenario: Scenario; onBack: () => void; onRestart: () => void }) {
  const r = scenario.result;
  const [done, setDone] = useState<number[]>([]);
  const toggle = (i: number) => setDone((d) => d.includes(i) ? d.filter((x) => x !== i) : [...d, i]);
  const wa = `https://wa.me/?text=${encodeURIComponent(buildReport(machine.name, r.job ?? symptom, r, done))}`;
  const guide = r.mode === "guide" || r.kind === "guide";
  const risk = r.risk ?? (r.kind === "safety" ? "pro" : "diy");

  return (
    <div className="min-h-dvh px-5 pb-10">
      <header className="flex h-16 items-center gap-2">
        <Btn variant="ghost" className="-ml-3 size-11 shrink-0 px-0" onClick={onBack} aria-label="Back"><ArrowLeft className="size-5" /></Btn>
        <span className="min-w-0 flex-1 truncate font-bold">{machine.name}</span>
        <TrustChip verified={machine.verified} />
      </header>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className={cn("rounded-full px-3 py-1 text-[13px] font-semibold", riskTag[risk])}>{riskLabel[risk]}</span>
        <span className="text-[13px] text-muted-foreground">{done.length}/{r.steps.length} completed</span>
      </div>

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
      ) : r.kind === "safety" ? (
        <motion.div variants={rise} initial="hidden" animate="show" custom={0} className="rounded-[16px] border-2 border-destructive bg-destructive-soft p-5">
          <OctagonAlert className="size-8 text-destructive" />
          <h1 className="mt-2 text-[24px] leading-tight text-destructive">{risk === "emergency" ? "Stop. Get to safety now." : "Stop. This needs a professional."}</h1>
          <p className="mt-2 text-[15px] leading-relaxed">{r.reason}</p>
        </motion.div>
      ) : <motion.h1 variants={rise} initial="hidden" animate="show" custom={0} className="text-[26px] leading-tight">{r.job ?? symptom}</motion.h1>}

      {risk === "emergency" && <a href="tel:112" className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-[12px] bg-destructive px-4 text-lg font-bold text-destructive-foreground"><Phone className="size-6" />Call 112</a>}

      {r.kind !== "safety" && r.before_you_start && (
        <section className="mt-6 rounded-[16px] bg-card p-4">
          <h2 className="text-lg">Before you start</h2>
          {r.before_you_start.tools.length > 0 && <div className="mt-3"><h3 className="text-[14px]">Tools &amp; parts</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-[15px]">{r.before_you_start.tools.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
          {r.before_you_start.safety_first.length > 0 && <div className="mt-4"><h3 className="text-[14px] text-warning">Safety first</h3><ul className="mt-2 list-disc space-y-2 pl-5 text-[15px]">{r.before_you_start.safety_first.map((t, i) => <li key={i}>{t}</li>)}</ul></div>}
        </section>
      )}

      <h2 className="mt-8 text-lg">{r.kind === "safety" ? "What you can safely do now" : guide ? "Step by step" : "Try these, in order"}</h2>
      <ol className="mt-3 space-y-3">
        {r.steps.map((s, i) => {
          const checked = done.includes(i);
          return (
            <motion.li key={i} variants={rise} initial="hidden" animate="show" custom={Math.min(i + 1, 5)}>
              <Btn variant="ghost" role="checkbox" aria-checked={checked} aria-label={`Step ${i + 1}: ${s.text}`} onClick={() => toggle(i)} className="w-full items-start justify-start gap-3 rounded-[16px] bg-card p-4 text-left font-normal">
                <motion.span animate={{ scale: checked ? [1, 1.15, 1] : 1 }} className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-[8px] border-2", checked ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                  {checked && <Check className="size-4" strokeWidth={3} />}
                </motion.span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[15px] leading-snug", checked && "text-muted-foreground line-through")}><span className="font-bold">{i + 1}.</span> {s.text}</span>
                  {s.warning && <span className="mt-3 flex gap-2 rounded-[8px] bg-warning-soft p-3 text-[14px] leading-snug text-warning"><TriangleAlert className="mt-0.5 size-4 shrink-0" /><span>{s.warning}</span></span>}
                  <span className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", tag[s.difficulty])}>{s.difficulty}</span>
                    {s.source && <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground"><BookOpen className="size-3" />Source: {s.source}</span>}
                  </span>
                </span>
              </Btn>
            </motion.li>
          );
        })}
      </ol>

      {r.kind !== "safety" && Boolean(r.stop_if?.length) && <section className="mt-6 border-l-4 border-warning bg-warning-soft p-4"><h2 className="text-lg text-warning">Stop and get help if...</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-[15px]">{r.stop_if?.map((s, i) => <li key={i}>{s}</li>)}</ul></section>}
      <div className="mt-8 space-y-3">
        <Btn className="min-h-12 w-full whitespace-normal" onClick={() => window.open(wa, "_blank", "noopener,noreferrer")}><MessageCircle className="size-5 shrink-0" />{guide ? "Share progress on WhatsApp" : "Send to a technician on WhatsApp"}</Btn>
        <Btn variant="outline" className="min-h-12 w-full" onClick={onRestart}><RotateCcw className="size-5" />Start a new problem</Btn>
      </div>
    </div>
  );
}
