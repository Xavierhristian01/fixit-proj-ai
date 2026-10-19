import type { Lang, Risk, Scenario } from "./mock-data";

export type SafetyDecision = { risk: Extract<Risk, "pro" | "emergency">; reason: string; steps: string[] };

/** Only explicit active hazards or high-risk work stop a request, never a topic word. */
export function assessSafety(text: string): SafetyDecision | null {
  const evidence = text.toLowerCase()
    .replace(/\b(?:no|not|without)\s+(?:any\s+)?(?:fire|smoke|sparks|gas smell|fuel leak|leaks|burning smell)\b/g, "")
    .replace(/\b(?:hand|parking)\s*brake\s+(?:on|engaged|applied)\b/g, "");
  const emergency = /\b(?:on fire|caught fire|fire spreading|flames|someone (?:is |was )?(?:shocked|hurt)|(?:person|child) (?:is |was )?(?:shocked|electrocuted)|electric shock|electrocuted)\b|\b(?:smoke|smoking|sparking|sparks|burning smell)\b[^.!?]{0,65}\b(?:wir(?:e|es|ing)|socket|electrical panel|battery)\b|\b(?:wir(?:e|es|ing)|socket|electrical panel|battery)\b[^.!?]{0,65}\b(?:smoke|smoking|sparking|burning)\b|\b(?:smell|smells|smelling|leak|leaking)\b[^.!?]{0,40}\b(?:gas|lpg|cooking gas)\b|\b(?:gas|lpg|cooking gas)\b[^.!?]{0,40}\b(?:smell|leak|leaking)\b|\b(?:fuel|petrol|diesel)\b[^.!?]{0,40}\b(?:pouring|gushing|spraying)\b/.test(evidence);
  if (emergency) return {
    risk: "emergency", reason: "There is an active risk of fire, explosion or serious injury.",
    steps: ["Get yourself and others away from the danger and out of traffic.", "Do not touch someone still in contact with electricity. Disconnect power only from a safe point.", "Keep flames away. Near a gas smell, do not operate light switches, plugs or phones; move away first.", "Call 112 from a safe place and describe the danger and your location."],
  };
  const pro = /\bbrakes?\b[^.!?]{0,45}\b(?:soft|sink\w*|fail\w*|leak\w*|hydraulic|bleed\w*|fluid|repair\w*)\b|\b(?:repair\w*|fix\w*|bleed\w*)\b[^.!?]{0,45}\bbrakes?\b|\bsteering\b[^.!?]{0,45}\b(?:heavy|stuck|fail\w*|loose|repair\w*|leak\w*)\b|\b(?:repair\w*|replace\w*|fix\w*)\b[^.!?]{0,45}\b(?:steering|suspension|airbags?|gas (?:line|cylinder)|mains (?:wir\w*|electricity)|household wiring|refrigerant)\b|\b(?:fuel|petrol|diesel)\b[^.!?]{0,45}\bleak\w*\b|\bleak\w*\b[^.!?]{0,45}\b(?:fuel|petrol|diesel)\b|\b(?:inside|internals?|open|repair)\b[^.!?]{0,40}\bmicrowave\b|\bmicrowave\b[^.!?]{0,40}\b(?:inside|internals?)\b|\b(?:mains wiring|live wire|high voltage|generator internals|sealed refrigerant)\b/.test(evidence);
  if (pro) return {
    risk: "pro", reason: "This job can cause serious injury or loss of vehicle control and needs trained help.",
    steps: ["Stop using the affected machine. Do not drive with brake or steering faults.", "Keep people clear and switch off only if you can do so safely.", "Note the symptoms, visible damage and model without opening or repairing dangerous parts.", "Tell a qualified technician what happened; arrange recovery rather than driving an unsafe vehicle."],
  };
  return null;
}

export function safetyReason(text: string): string | null {
  return assessSafety(text)?.reason ?? null;
}

export function safetyScenario(reason: string, lang: Lang = "en", decision?: SafetyDecision): Scenario {
  const risk = decision?.risk ?? "pro";
  const pcm = lang === "pcm";
  const message = pcm
    ? risk === "emergency" ? "Danger dey happen now. Move go safe place and call 112." : "This work fit seriously injure person. Stop using am and get trained technician."
    : decision?.reason ?? reason;
  const steps = pcm ? [
    "Move yourself and other people away from danger and traffic.",
    "Switch am off only from safe place. No touch person wey electricity still dey shock.",
    "No flame near gas. No operate switch, plug or phone near gas smell; move away first.",
    risk === "emergency" ? "Call 112 from safe place; tell dem your location and wetin happen." : "Tell trained technician the model and wetin happen. No drive if brake or steering get fault.",
  ] : decision?.steps ?? ["Stop using the machine and keep people away.", "Switch off only at a safe point.", "Note what happened without opening dangerous parts.", "Tell a qualified technician the symptoms and model."];
  return { intro: { en: message, pcm: message }, causes: [], questions: [], result: {
    kind: "safety", risk, reason: message, steps: steps.map((text) => ({ text, difficulty: "Easy" })),
  } };
}