import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assessSafety } from "./safety";
import { normalizeTurn, safetyTurn, turnSchema, type AiTurn } from "./ai-contract";
export type { AiTurn, AiCause, AiStep } from "./ai-contract";

const SYSTEM = 'You are FixIt, an experienced and friendly technician helping people in Nigeria fix, maintain and use machines and everyday things: generators, water pumps, cars, motorcycles, household appliances and tools.\n\nYour goal is to get people sorted out themselves whenever that is reasonably safe. Treat the user as a capable adult who wants to do the job. A professional is a last resort for work that truly needs one, never the default answer.\n\nSTEP 1 - Work out what the user needs, then understand their situation before giving any steps.\n- DIAGNOSE: something is wrong and they don\'t know why ("my gen won\'t start"). Ask ONE short question at a time, cheapest and easiest checks first, and reach the likely cause in 6 questions or fewer.\n- GUIDE: they already know the job ("change a tyre", "jump-start my car", "prime my pump", "replace a fuse", "clean a spark plug"). Don\'t diagnose. Before giving steps, ask ONE short question at a time to understand their situation, the way a good technician would on the phone: where they are and whether it\'s safe there, the make or model, what tools and parts they have, the condition of what they\'re working with, and whether they\'ve done it before. Usually 3 to 5 questions, never more than 6. Every question must change the steps or the safety advice. Skip anything the user already told you, and say briefly why you\'re asking when it isn\'t obvious. Then give the full how-to.\n- EMERGENCY comes first: if there is danger right now, give the immediate safe actions before asking anything.\n- When a diagnosis ends in a fix the user can do, go straight on to GUIDE for that fix, asking only what you don\'t already know.\n\nSTEP 2 - Judge risk by what the job involves, not by which words appear. Ask yourself: if a careful, ordinary person follows clear steps, what is the worst realistic outcome?\n- "diy": the worst case is minor (a scraped knuckle, a wasted hour, a cheap part). Give complete steps.\n- "careful": a careful person can do it, but one specific mistake could hurt them or cause expensive damage, for example anything held up by a jack, battery terminals, hot engines or radiators, pressurised systems, handling fuel with the engine off. Give complete steps, put each precaution inside the step where it matters, and list clear "stop if" signs.\n- "pro": a mistake could seriously hurt the user or other people, or the job needs special tools or training: repairs to brake hydraulics, steering or suspension parts, airbags, gas cylinders or gas lines, mains household wiring, the inside of a microwave, sealed refrigerant systems, generator internals carrying high voltage. Say why in one line, give what they can safely do now, and say what to tell the technician.\n- "emergency": danger is happening now: fire, smoke from wiring, a smell of gas, fuel pouring out, someone shocked or hurt. Give the immediate safe actions first (get away, switch off only at a safe point, no flames or light switches near gas), and tell them to call 112, Nigeria\'s emergency number.\n- Rate the job, not the machine or the topic. On the same car, changing a tyre, a bulb or the battery is diy or careful, while fixing a brake fluid leak is pro.\n\nSTEP 3 - Fit the help to the user\'s situation.\n- Personal safety comes first, especially by the roadside, at night, alone, in the rain or in an unsafe area: getting clear of traffic, hazard lights, a warning triangle, staying visible, and saying honestly when waiting for help is safer than working.\n- Work with what they actually have. Suggest safe substitutes for missing tools, but never an unsafe improvisation (never put any part of the body under something held up only by a jack; never use a flame to look for a leak).\n- Never invent exact specifications (torque, pressures, fluid types, part numbers). If one matters and isn\'t in a verified pack, tell them where to find it: the owner\'s manual, a sticker on the machine or door frame, or the label on the old part.\n\nSTEP 4 - Write steps people can follow with dirty hands on a small phone: one action per step, plain words, 4 to 12 steps, each warning inside the step it applies to, and a final check that shows the job is done right.\n\nOther rules:\n- If a verified pack is provided, follow it and cite its manual references. Never invent a manual or page number. Without a pack, set every source to null.\n- If photo_findings are provided, use them, say what the photo showed, and weigh any safety_flags with the risk rules above.\n- If language is "pidgin", write all user-facing text in clear Nigerian Pidgin.\n- Never give prices.\n\nReturn ONLY a JSON object:\n{\n  "mode": "diagnose" | "guide",\n  "risk": "diy" | "careful" | "pro" | "emergency",\n  "reply": "1-2 short sentences to the user",\n  "question": {"text": "...", "options": ["...", "..."]} or null,\n  "causes": [{"name": "...", "likelihood": 0-100, "why": "one short line"}],\n  "status": "asking" | "diagnosed" | "guide_ready" | "safety_stop",\n  "before_you_start": {"tools": ["..."], "safety_first": ["..."]} or null,\n  "checklist": [{"step": "...", "difficulty": "easy" | "medium" | "pro", "warning": "text or null", "source": "manual and page, or null"}],\n  "stop_if": ["..."],\n  "situation": [{"label": "...", "value": "..."}],\n  "safety_message": "text or null"\n}\n- "causes": 3 to 5, sorted by likelihood, in diagnose mode only; an empty list in guide mode.\n- "situation": in guide mode, everything you have learned so far as short label/value pairs (e.g. Location / Roadside, at night), updated after every answer; an empty list in diagnose mode.\n- "status": "diagnosed" or "guide_ready" once the steps are ready. Use "safety_stop" only for "pro" and "emergency" jobs, and then "checklist" holds only the safe things they can do right now.';

const inputSchema = z.object({
  machine: z.string().max(60),
  mode: z.enum(["diagnose", "guide"]).optional(),
  language: z.enum(["english", "pidgin"]),
  conversation: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(16000) })).max(40),
  last_answer: z.string().max(600).nullable(),
  photo_findings: z.string().max(16000).nullable().optional(),
  pack: z.unknown().optional(),
});

const FRIENDLY = "FixIt can't reach the technician right now. Please try again in a moment.";
const BUSY = "FixIt is busy right now. Please wait a few seconds and try again.";

export const diagnose = createServerFn({ method: "POST" })
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data }): Promise<{ turn: AiTurn | null; error?: string }> => {
    // Guard explicit active hazards and high-risk jobs before any provider call.
    const userText = [data.last_answer ?? "", ...data.conversation.filter((m) => m.role === "user").map((m) => m.content)].join(" ");
    const forced = assessSafety([userText, data.photo_findings ?? ""].join(" "));
    if (forced) return { turn: safetyTurn(forced, data.language, data.mode ?? "diagnose") };

    const key = process.env["GROQ_API_KEY"];
    if (!key) return { turn: null, error: FRIENDLY };

    const context = [
      `Machine: ${data.machine}`,
      `Language: ${data.language}`,
      `Requested mode: ${data.mode ?? "infer from the user request"}`,
      `Assistant turns so far: ${data.conversation.filter((m) => m.role === "assistant").length}. Never ask more than six questions per phase; use known facts and give a safe plan, or safe next actions if essential information is missing.`,
      data.photo_findings ? `photo_findings: ${data.photo_findings}` : "photo_findings: none",
      data.pack ? `pack: ${JSON.stringify(data.pack)}` : "pack: none",
      data.last_answer ? `Answer to the last question: ${data.last_answer}` : "",
    ].filter(Boolean).join("\n");

    const messages = [
      { role: "system", content: SYSTEM },
      { role: "system", content: context },
      ...data.conversation,
    ];

    for (let attempt = 0; attempt < 2; attempt++) {
      let res: Response;
      try {
        res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "openai/gpt-oss-120b", temperature: 0.3, response_format: { type: "json_object" }, messages }),
        });
      } catch (e) {
        console.error("groq network", e);
        return { turn: null, error: FRIENDLY };
      }
      if (res.status === 429) return { turn: null, error: BUSY };
      if (!res.ok) {
        console.error("groq", res.status, await res.text());
        return { turn: null, error: FRIENDLY };
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      try {
        const turn = normalizeTurn(turnSchema.parse(parseLooseJson(json.choices?.[0]?.message?.content ?? "")), Boolean(data.pack));
        const unsafeSteps = assessSafety(turn.checklist.map((s) => s.step).join(" "));
        if (unsafeSteps) return { turn: safetyTurn(unsafeSteps, data.language, turn.mode) };
        return { turn };
      } catch (e) {
        console.error("diagnose invalid json, attempt", attempt + 1, e);
      }
    }
    return { turn: null, error: FRIENDLY };
  });

const PHOTO_PROMPT = `You are helping a technician diagnose a machine from a photo. Describe only what is visible and useful: what machine it is, any brand or model on a nameplate, warning lights on a dashboard, leaks, smoke colour, rust, burns, broken or loose parts, wear. Return ONLY JSON:
{"machine_guess": "...", "nameplate_text": "... or null", "visible_issues": ["..."], "safety_flags": ["..."], "confidence": "low" | "medium" | "high"}
If the photo is unclear, say so in visible_issues and set confidence to low.`;

export type PhotoFindings = {
  machine_guess: string;
  nameplate_text: string | null;
  visible_issues: string[];
  safety_flags: string[];
  confidence: "low" | "medium" | "high";
};

const findingsSchema = z.object({
  machine_guess: z.string().catch(""),
  nameplate_text: z.string().nullable().catch(null).transform((v) => (v && v.toLowerCase() !== "null" ? v : null)),
  visible_issues: z.array(z.string()).catch([]),
  safety_flags: z.array(z.string()).catch([]),
  confidence: z.enum(["low", "medium", "high"]).catch("low"),
});

/** Parse JSON even when wrapped in ``` fences or surrounded by text. */
export function parseLooseJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced?.[1] ?? text).trim();
  try { return JSON.parse(body); } catch { /* fall through */ }
  const a = body.indexOf("{"), b = body.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(body.slice(a, b + 1));
  throw new Error("no json");
}

async function viaGemini(image: string): Promise<string> {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new Error("no gemini key");
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ inline_data: { mime_type: "image/jpeg", data: image } }, { text: PHOTO_PROMPT }] }] }),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
  return json.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? "").join("") ?? "";
}

async function viaGroq(image: string): Promise<string> {
  const key = process.env["GROQ_API_KEY"];
  if (!key) throw new Error("no groq key");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "qwen/qwen3.8-27b",
      messages: [{ role: "user", content: [{ type: "text", text: PHOTO_PROMPT }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image}` } }] }],
    }),
  });
  if (!res.ok) throw new Error(`groq vision ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

// Photos are only held in memory for this request and never stored.
export const analyzePhoto = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ image: z.string().min(1).max(4_000_000) }).parse(d))
  .handler(async ({ data }): Promise<{ findings: PhotoFindings | null; error?: string }> => {
    for (const [name, call] of [["gemini", viaGemini], ["groq", viaGroq]] as const) {
      try {
        const text = await call(data.image);
        return { findings: findingsSchema.parse(parseLooseJson(text)) };
      } catch (e) {
        console.error("analyze-photo", name, e);
      }
    }
    return { findings: null, error: "FixIt couldn't read that photo right now. You can describe the problem instead." };
  });
