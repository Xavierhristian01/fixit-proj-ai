import type { Scenario } from "./mock-data";

const patterns: { re: RegExp; reason: string }[] = [
  { re: /\bbrak(e|es|ing)\b/i, reason: "Brake problems can make the vehicle impossible to stop." },
  { re: /\bsteer(ing)?\b/i, reason: "Steering problems can make you lose control of the vehicle." },
  { re: /\b(gas|fuel|petrol|diesel|lpg|cooking gas)\b.*\b(leak|leaking|smell)\b|\b(leak|leaking|smell)\b.*\b(gas|fuel|petrol|diesel|lpg)\b/i, reason: "Gas or fuel leaks can catch fire or explode." },
  { re: /\bsmok(e|ing|y)\b/i, reason: "Smoke can mean something is overheating or burning." },
  { re: /\bburn(ing|t)?\b.*\bsmell\b|\bsmell\b.*\bburn(ing|t)?\b|\bburning\b/i, reason: "A burning smell can mean wiring or parts are overheating." },
  { re: /\bspark(s|ing)?\b/i, reason: "Sparks can cause electric shock or fire." },
  { re: /\b(mains|nepa|phcn|socket|live wire|wiring|electrocut\w*|shock(ed|ing)?)\b/i, reason: "Mains electricity can kill." },
];

export function safetyReason(text: string): string | null {
  for (const p of patterns) if (p.re.test(text)) return p.reason;
  return null;
}

export function safetyScenario(reason: string): Scenario {
  return {
    intro: { en: reason, pcm: reason },
    causes: [],
    questions: [],
    result: {
      kind: "safety",
      reason: `${reason} Stop using it now. Do not try to repair this yourself. Switch off and disconnect power or fuel only if it is safe to do so, keep people away, and call a qualified technician.`,
      steps: [
        { text: "Stop using the machine and keep people away from it.", difficulty: "Easy" },
        { text: "Only switch off or disconnect power or fuel if you can do it safely.", difficulty: "Easy" },
        { text: "Have a qualified technician inspect and repair it.", difficulty: "Call a pro" },
      ],
    },
  };
}
