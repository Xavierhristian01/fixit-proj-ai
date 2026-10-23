import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, Camera, Check, ClipboardList, Copy, Loader2, ShieldCheck, Volume2, MessageCircle, OctagonAlert, Phone, RotateCcw, TriangleAlert } from "lucide-react";
import type { Difficulty, Machine, Risk, Scenario } from "@/lib/mock-data";
import { buildMechanicBrief, buildReport } from "@/lib/ai-contract";
import { verifyFix, type FixVerdict } from "@/lib/ai.functions";
import { SpeakButton, useSpeaker } from "./voice";
import { PhotoThumb, usePhotoPicker } from "./photo";
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
  const voice = useSpeaker();
  const stepText = (i: number) => `Step ${i + 1}. ${r.steps[i]!.text}${r.steps[i]!.warning ? `. Warning: ${r.steps[i]!.warning}` : ""}`;
  const readFrom = (i: number) => voice.speak(r.steps.slice(i).map((_, k) => stepText(i + k)), i);
  const firstOpen = Math.max(0, r.steps.findIndex((_, i) => !done.includes(i)));
  const needsPro = r.kind === "safety" || risk === "pro" || risk === "emergency";
  const [showBrief, setShowBrief] = useState(needsPro);
  const brief = buildMechanicBrief(machine.name, r.job ?? symptom, r, done);
  const [copied, setCopied] = useState(false);
  const pic = usePhotoPicker();
  const verify = useServerFn(verifyFix);
  const [checking, setChecking] = useState(false);
  const [verdict, setVerdict] = useState<FixVerdict | null>(null);
  const [verifyError, setVerifyError] = useState("");
  const allDone = r.steps.length > 0 && done.length === r.steps.length;
  const runVerify = async () => {
    if (!pic.photo) return;
    setChecking(true); setVerifyError(""); setVerdict(null);
    try {
      const res = await verify({ data: { image: pic.photo.base64, machine: machine.name, job: r.job ?? symptom } });
      if (res.result) setVerdict(res.result); else setVerifyError(res.error ?? "Couldn't check that photo.");
    } catch { setVerifyError("Couldn't check that photo. Please try again."); }
    setChecking(false);
  };

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

      <div className="mt-8 flex items-center justify-between gap-3">
        <h2 className="text-lg">{r.kind === "safety" ? "What you can safely do now" : guide ? "Step by step" : "Try these, in order"}</h2>
        {r.steps.length > 0 && (voice.speaking !== null
          ? <Btn variant="outline" className="min-h-11 shrink-0 text-[14px]" onClick={voice.stop}>Stop reading</Btn>
          : <Btn variant="outline" className="min-h-11 shrink-0 text-[14px]" onClick={() => readFrom(firstOpen)}><Volume2 className="size-4" />Read aloud</Btn>)}
      </div>
      <ol className="mt-3 space-y-3">
        {r.steps.map((s, i) => {
          const checked = done.includes(i);
          return (
            <motion.li key={i} variants={rise} initial="hidden" animate="show" custom={Math.min(i + 1, 5)} className="flex items-start gap-2">
              <Btn variant="ghost" role="checkbox" aria-checked={checked} aria-label={`Step ${i + 1}: ${s.text}`} onClick={() => toggle(i)} className={cn("min-w-0 flex-1 items-start justify-start gap-3 rounded-[16px] bg-card p-4 text-left font-normal", voice.speaking === i && "ring-2 ring-primary")}>
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
              <SpeakButton active={voice.speaking === i} label={`Read step ${i + 1} aloud`} onClick={() => voice.speaking === i ? voice.stop() : voice.speak([stepText(i)], i)} />
            </motion.li>
          );
        })}
      </ol>

      {r.kind !== "safety" && Boolean(r.stop_if?.length) && <section className="mt-6 border-l-4 border-warning bg-warning-soft p-4"><h2 className="text-lg text-warning">Stop and get help if...</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-[15px]">{r.stop_if?.map((s, i) => <li key={i}>{s}</li>)}</ul></section>}
      {r.kind !== "safety" && allDone && (
        <section className="mt-6 rounded-[16px] bg-card p-4">
          <h2 className="flex items-center gap-2 text-lg"><ShieldCheck className="size-5 text-primary" />Check your fix with a photo</h2>
          <p className="mt-1 text-[14px] text-muted-foreground">Before you switch it back on, take a clear photo of the finished work.</p>
          {pic.input}
          <div className="mt-3"><PhotoThumb photo={pic.photo} onRemove={() => { pic.setPhoto(null); setVerdict(null); }} /></div>
          <div className="mt-2 flex gap-2">
            <Btn variant="outline" className="min-h-12 flex-1" onClick={pic.open}><Camera className="size-5" />{pic.photo ? "Retake" : "Take photo"}</Btn>
            {pic.photo && <Btn className="min-h-12 flex-1" onClick={runVerify} disabled={checking}>{checking ? <Loader2 className="size-5 animate-spin" /> : <ShieldCheck className="size-5" />}{checking ? "Checking..." : "Check my fix"}</Btn>}
          </div>
          {(pic.error || verifyError) && <p className="mt-2 text-[13px] text-muted-foreground">{pic.error || verifyError}</p>}
          {verdict && (
            <div role="status" className={cn("mt-3 rounded-[12px] p-3", verdict.verdict === "looks_good" ? "bg-success-soft text-success" : verdict.verdict === "unsafe" ? "border-2 border-destructive bg-destructive-soft text-destructive" : "bg-warning-soft text-warning")}>
              <div className="font-bold">{verdict.verdict === "looks_good" ? "Looks good" : verdict.verdict === "unsafe" ? "Don't switch it on yet" : "Check again"}</div>
              {verdict.notes.length > 0 && <ul className="mt-1 list-disc space-y-1 pl-5 text-[14px] text-foreground">{verdict.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
            </div>
          )}
        </section>
      )}

      <section className="mt-6 rounded-[16px] bg-card p-4">
        <button type="button" onClick={() => setShowBrief((v) => !v)} aria-expanded={showBrief} className="flex min-h-11 w-full items-center gap-2 text-left">
          <ClipboardList className="size-5 text-primary" />
          <span className="flex-1 text-lg font-bold">{needsPro ? "Brief for your mechanic" : "Need a mechanic?"}</span>
        </button>
        {showBrief && (
          <>
            <p className="mt-1 text-[14px] text-muted-foreground">Show this to the mechanic so you only pay for what's really wrong.</p>
            <pre className="mt-3 whitespace-pre-wrap rounded-[12px] bg-muted p-3 font-sans text-[14px] leading-relaxed">{brief}</pre>
            <div className="mt-3 flex gap-2">
              <Btn className="min-h-12 flex-1" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(brief)}`, "_blank", "noopener,noreferrer")}><MessageCircle className="size-5" />WhatsApp</Btn>
              <Btn variant="outline" className="min-h-12 flex-1" onClick={() => { void navigator.clipboard?.writeText(brief).then(() => setCopied(true)); }}><Copy className="size-5" />{copied ? "Copied" : "Copy"}</Btn>
            </div>
          </>
        )}
      </section>

      <div className="mt-8 space-y-3">
        <Btn className="min-h-12 w-full whitespace-normal" onClick={() => window.open(wa, "_blank", "noopener,noreferrer")}><MessageCircle className="size-5 shrink-0" />{guide ? "Share progress on WhatsApp" : "Send to a technician on WhatsApp"}</Btn>
        <Btn variant="outline" className="min-h-12 w-full" onClick={onRestart}><RotateCcw className="size-5" />Start a new problem</Btn>
      </div>
    </div>
  );
}
