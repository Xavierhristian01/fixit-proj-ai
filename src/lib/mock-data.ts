export type MachineId = "generator" | "pump" | "car" | "fan" | "other";
export type Lang = "en" | "pcm";
export type Difficulty = "Easy" | "Medium" | "Call a pro";

export interface Machine {
  id: MachineId;
  name: string;
  verified: boolean;
  symptoms: string[];
}

export const machines: Machine[] = [
  { id: "generator", name: "Generator", verified: true, symptoms: ["Won't start", "Starts but can't carry load", "Black smoke", "Strange noise"] },
  { id: "pump", name: "Water pump", verified: true, symptoms: ["Runs but no water", "Won't start", "Overheating", "Strange noise"] },
  { id: "car", name: "Car", verified: true, symptoms: ["Brakes feel soft", "Won't start", "Overheating", "Strange noise"] },
  { id: "fan", name: "Standing fan", verified: true, symptoms: ["Won't spin", "Spins slowly", "Strange noise", "Burning smell"] },
  { id: "other", name: "Something else", verified: false, symptoms: ["Won't start", "Overheating", "Strange noise", "Leaking"] },
];

export interface Cause { id: string; label: string; pct: number }
export interface Question {
  text: Record<Lang, string>;
  /** cause percentages after each answer */
  effects: Record<"yes" | "no" | "unsure", Record<string, number>>;
}
export type Mode = "diagnose" | "guide";
export type Risk = "diy" | "careful" | "pro" | "emergency";
export interface Step { text: string; difficulty: Difficulty; source?: string; warning?: string | null }
export interface ResultDetails {
  mode?: Mode;
  risk?: Risk;
  job?: string;
  before_you_start?: { tools: string[]; safety_first: string[] } | null;
  stop_if?: string[];
  situation?: { label: string; value: string }[];
}
export const quickFixes: Record<MachineId, string[]> = {
  car: ["Change a tyre", "Jump-start", "Check engine oil"],
  generator: ["Clean the spark plug", "Change the oil"],
  pump: ["Prime the pump"],
  fan: ["Clean the fan"],
  other: [],
};
export interface Scenario {
  intro: Record<Lang, string>;
  causes: Cause[];
  questions: Question[];
  result:
    | ({ kind: "fix"; cause: string; confidence: number; steps: Step[] } & ResultDetails)
    | ({ kind: "guide"; steps: Step[] } & ResultDetails)
    | ({ kind: "safety"; reason: string; steps: Step[] } & ResultDetails);
}

const pump: Scenario = {
  intro: {
    en: "Okay, a surface pump that runs but delivers no water. Let's narrow it down with a few quick questions.",
    pcm: "Okay, pump dey run but water no dey come. Make we check am small small with some quick questions.",
  },
  causes: [
    { id: "prime", label: "Lost prime", pct: 34 },
    { id: "foot", label: "Leaking foot valve", pct: 22 },
    { id: "air", label: "Air leak in suction pipe", pct: 18 },
    { id: "impeller", label: "Blocked impeller", pct: 14 },
    { id: "dry", label: "Dry well or empty tank", pct: 12 },
  ],
  questions: [
    {
      text: { en: "Is there water in the well or tank right now?", pcm: "Water dey inside the well or tank now now?" },
      effects: {
        yes: { prime: 38, foot: 26, air: 20, impeller: 12, dry: 4 },
        no: { dry: 70, prime: 12, foot: 8, air: 6, impeller: 4 },
        unsure: { prime: 32, foot: 22, air: 18, dry: 16, impeller: 12 },
      },
    },
    {
      text: { en: "Does the pump lose water overnight, so you have to refill it before starting?", pcm: "The pump dey lose water for night, so you go pour water inside before you start am?" },
      effects: {
        yes: { foot: 44, prime: 30, air: 16, impeller: 6, dry: 4 },
        no: { prime: 36, air: 30, impeller: 22, foot: 8, dry: 4 },
        unsure: { prime: 34, foot: 30, air: 20, impeller: 12, dry: 4 },
      },
    },
    {
      text: { en: "Do you hear a hissing or sucking sound near the inlet pipe when it runs?", pcm: "You dey hear like hiss or suck sound near the pipe wey dey bring water when e dey run?" },
      effects: {
        yes: { air: 46, foot: 28, prime: 18, impeller: 5, dry: 3 },
        no: { foot: 52, prime: 30, impeller: 10, air: 5, dry: 3 },
        unsure: { foot: 40, prime: 28, air: 22, impeller: 7, dry: 3 },
      },
    },
  ],
  result: {
    kind: "fix",
    cause: "Leaking foot valve",
    confidence: 52,
    steps: [
      { text: "Switch off the pump and unplug it before touching anything.", difficulty: "Easy" },
      { text: "Remove the priming plug and fill the pump casing with clean water until it overflows.", difficulty: "Easy", source: "Pedrollo PKm60 manual, p. 12" },
      { text: "Refit the plug, run for 2 minutes. If water comes then stops by morning, the foot valve is leaking.", difficulty: "Easy" },
      { text: "Pull up the suction pipe and clean leaves or sand from the foot valve flap.", difficulty: "Medium", source: "Pedrollo PKm60 manual, p. 18" },
      { text: "Replace the foot valve if the flap is cracked or won't seal (about N4,000 to N8,000).", difficulty: "Medium" },
      { text: "If it still won't hold water, have a plumber pressure-test the suction line.", difficulty: "Call a pro" },
    ],
  },
};

const carBrakes: Scenario = {
  intro: {
    en: "Soft brakes can be dangerous. Let me ask one quick question first.",
    pcm: "Brake wey soft fit dey dangerous. Make I ask you one quick question first.",
  },
  causes: [
    { id: "fluid", label: "Low or leaking brake fluid", pct: 40 },
    { id: "air", label: "Air in brake lines", pct: 30 },
    { id: "master", label: "Failing master cylinder", pct: 20 },
    { id: "pads", label: "Worn brake pads", pct: 10 },
  ],
  questions: [
    {
      text: { en: "Does the pedal sink closer to the floor than usual?", pcm: "The brake pedal dey go down near floor pass as e suppose?" },
      effects: {
        yes: { fluid: 48, master: 28, air: 18, pads: 6 },
        no: { air: 40, fluid: 30, pads: 20, master: 10 },
        unsure: { fluid: 42, air: 30, master: 20, pads: 8 },
      },
    },
  ],
  result: {
    kind: "safety",
    reason: "A soft or sinking brake pedal usually means a fluid leak or air in the lines. The brakes can fail without warning. Do not drive the car. Have it towed or ask a mechanic to come to you.",
    steps: [
      { text: "Park on level ground and do not drive.", difficulty: "Easy" },
      { text: "Look under each wheel for wet, oily spots and note what you see for the mechanic.", difficulty: "Easy" },
      { text: "Brake system repair and bleeding.", difficulty: "Call a pro" },
    ],
  },
};

function generic(machine: string, symptom: string): Scenario {
  return {
    intro: {
      en: `Got it: ${machine.toLowerCase()}, "${symptom.toLowerCase()}". A couple of questions will help.`,
      pcm: `I don hear: ${machine.toLowerCase()}, "${symptom.toLowerCase()}". Make I ask you small questions.`,
    },
    causes: [
      { id: "power", label: "Power supply problem", pct: 35 },
      { id: "wear", label: "Worn or loose part", pct: 28 },
      { id: "dirt", label: "Dirt or blockage", pct: 22 },
      { id: "fault", label: "Internal fault", pct: 15 },
    ],
    questions: [
      {
        text: { en: "Did the problem start suddenly?", pcm: "The wahala start suddenly?" },
        effects: {
          yes: { power: 42, fault: 26, wear: 18, dirt: 14 },
          no: { wear: 40, dirt: 32, power: 16, fault: 12 },
          unsure: { power: 32, wear: 30, dirt: 24, fault: 14 },
        },
      },
      {
        text: { en: "Has it been cleaned or serviced in the last 6 months?", pcm: "Dem don clean or service am for the last 6 months?" },
        effects: {
          yes: { power: 44, fault: 30, wear: 18, dirt: 8 },
          no: { dirt: 44, wear: 30, power: 16, fault: 10 },
          unsure: { dirt: 34, power: 28, wear: 24, fault: 14 },
        },
      },
    ],
    result: {
      kind: "fix",
      cause: "Dirt or blockage",
      confidence: 44,
      steps: [
        { text: "Switch off and unplug before checking anything.", difficulty: "Easy" },
        { text: "Check the plug, fuse and power source with another appliance.", difficulty: "Easy" },
        { text: "Clean dust and debris from vents, filters and moving parts.", difficulty: "Easy" },
        { text: "Tighten any loose screws, belts or connections.", difficulty: "Medium" },
        { text: "If nothing changes, take it to a repair technician.", difficulty: "Call a pro" },
      ],
    },
  };
}

export function getScenario(machine: Machine, symptom: string): Scenario {
  if (machine.id === "pump" && symptom === "Runs but no water") return pump;
  if (machine.id === "car" && symptom === "Brakes feel soft") return carBrakes;
  return generic(machine.name, symptom);
}

export function applyEffect(causes: Cause[], effect: Record<string, number>): Cause[] {
  return causes
    .map((c) => ({ ...c, pct: effect[c.id] ?? c.pct }))
    .sort((a, b) => b.pct - a.pct);
}
