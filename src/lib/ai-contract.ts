import { z } from "zod";
import type { Mode, Scenario } from "./mock-data";
import { safetyScenario, type SafetyDecision } from "./safety";

export const turnSchema = z.object({
  mode: z.enum(["diagnose", "guide"]),
  risk: z.enum(["diy", "careful", "pro", "emergency"]),
  reply: z.string(),
  question: z.object({ text: z.string(), options: z.array(z.string()).min(1).max(6) }).nullable(),
  causes: z.array(z.object({ name: z.string(), likelihood: z.coerce.number().min(0).max(100), why: z.string() })).max(5),
  status: z.enum(["asking", "diagnosed", "guide_ready", "safety_stop"]),
  before_you_start: z.object({ tools: z.array(z.string()), safety_first: z.array(z.string()) }).nullable(),
  checklist: z.array(z.object({ step: z.string(), difficulty: z.enum(["easy", "medium", "pro"]), warning: z.string().nullable(), source: z.string().nullable() })).max(12),
  stop_if: z.array(z.string()),
  situation: z.array(z.object({ label: z.string(), value: z.string() })),
  safety_message: z.string().nullable(),
});
export type AiTurn = z.infer<typeof turnSchema>;
export type AiCause = AiTurn["causes"][number];
export type AiStep = AiTurn["checklist"][number];

export function safetyTurn(decision: SafetyDecision, language: "english" | "pidgin", mode: Mode): AiTurn {
  const result = safetyScenario(decision.reason, language === "pidgin" ? "pcm" : "en", decision).result;
  const reason = result.kind === "safety" ? result.reason : decision.reason;
  return { mode, risk: decision.risk, reply: reason, question: null, causes: [], status: "safety_stop", before_you_start: null,
    checklist: result.steps.map((s) => ({ step: s.text, difficulty: "easy", warning: null, source: null })),
    stop_if: [], situation: [], safety_message: reason };
}

export function normalizeTurn(turn: AiTurn, hasPack: boolean): AiTurn {
  const risky = turn.risk === "pro" || turn.risk === "emergency";
  const visible = [turn.reply, turn.question?.text ?? "", ...turn.causes.map((c) => c.why),
    ...turn.checklist.flatMap((s) => [s.step, s.warning ?? ""]), ...turn.stop_if,
    ...turn.before_you_start?.tools ?? [], ...turn.before_you_start?.safety_first ?? []].join(" ");
  if (!hasPack && /\b\d+(?:[.,]\d+)?\s*(?:n\s*[·.-]?\s*m|nm|psi|bar|kpa|mpa|ft[ -]?lb|lb[ -]?ft|litres?|liters?|ml|sae\s*\d+|w-?\d+)\b|\b\d{1,2}w[- ]?\d{2}\b/i.test(visible)) throw new Error("Unverified exact specification: refer to the manual, machine sticker or old-part label instead");
  if (turn.checklist.length > 12) throw new Error("Guides must have at most 12 steps");
  if (!risky && turn.status === "safety_stop") throw new Error("DIY work cannot be a safety stop");
  if (!risky && turn.status !== "asking" && (turn.checklist.length < 4 || !turn.before_you_start)) throw new Error("Ready guides need preparation and 4–12 steps");
  if (turn.status === "asking" && !turn.question && !risky) throw new Error("Missing question");
  if (turn.mode === "diagnose" && !risky && turn.causes.length < 3) throw new Error("Diagnosis needs 3–5 causes");
  return { ...turn,
    status: risky ? "safety_stop" : turn.status,
    question: risky || turn.status !== "asking" ? null : turn.question,
    causes: turn.mode === "guide" ? [] : [...turn.causes].sort((a, b) => b.likelihood - a.likelihood),
    situation: turn.mode === "guide" ? turn.situation : [],
    checklist: !risky && turn.status === "asking" ? [] : turn.checklist.map((s) => ({ ...s, source: hasPack ? s.source : null })),
  };
}

export function toResult(t: AiTurn, job: string, cause?: AiCause): Scenario["result"] {
  const details = { mode: t.mode, risk: t.risk, job, before_you_start: t.before_you_start, stop_if: t.stop_if, situation: t.situation,
    steps: t.checklist.map((s) => ({ text: s.step, difficulty: s.difficulty === "easy" ? "Easy" as const : s.difficulty === "medium" ? "Medium" as const : "Call a pro" as const, warning: s.warning, ...(s.source ? { source: s.source } : {}) })) };
  if (t.status === "safety_stop") return { ...details, kind: "safety", reason: t.safety_message ?? t.reply };
  const top = t.causes[0] ?? cause;
  if (top) return { ...details, kind: "fix", cause: top.name, confidence: Math.round(top.likelihood) };
  return { ...details, kind: "guide" };
}

export function buildReport(machine: string, job: string, r: Scenario["result"], done: number[]): string {
  const guide = r.mode === "guide" || r.kind === "guide";
  const summary = r.kind === "fix" ? `Most likely: ${r.cause} (${r.confidence}%)` : r.kind === "safety" ? `Safety stop: ${r.reason}` : `Risk: ${r.risk ?? "diy"}`;
  return [`FixIt AI report`, `Machine: ${machine}`, `${guide ? "Job" : "Problem"}: ${job}`, summary,
    ...(guide ? ["Steps completed:", ...r.steps.flatMap((s, i) => done.includes(i) ? [`${i + 1}. ${s.text}`] : []), ...(done.length === 0 ? ["None yet"] : [])] : []),
  ].join("\n");
}