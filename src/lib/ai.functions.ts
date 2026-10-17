import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { safetyReason } from "./safety";

const SYSTEM = `You are FixIt, a careful, friendly mechanical technician helping people in Nigeria troubleshoot machines: generators, water pumps, cars and household appliances.
Work like a good technician: ask ONE short question at a time, starting with the cheapest and easiest checks. Reach a diagnosis in 6 questions or fewer.
After every user message, return ONLY a JSON object:
{
  "reply": "1-2 short sentences to the user",
  "question": {"text": "...", "options": ["Yes", "No", "Not sure"]} or null,
  "causes": [{"name": "...", "likelihood": 0-100, "why": "one short line"}],
  "status": "asking" | "diagnosed" | "safety_stop",
  "checklist": [{"step": "...", "difficulty": "easy" | "medium" | "pro", "source": "manual and page, or null"}],
  "safety_message": "text or null"
}
Rules:
- Give 3 to 5 causes, sorted by likelihood. Update them after every answer.
- Fill "checklist" only when status is "diagnosed": 3 to 6 safe steps, easiest first.
- If the user mentions brakes, steering, a gas or fuel leak, smoke, a burning smell, sparks, exposed wires or mains electricity, set status to "safety_stop", explain why in safety_message, and give no repair steps.
- If a verified pack is provided, follow it and cite its manual references. Never invent a manual or page number. Without a pack, set every source to null.
- If photo_findings are provided, use them and say what the photo showed.
- If language is "pidgin", write reply, question, options and checklist in clear Nigerian Pidgin.
- Never give prices. Keep it practical for someone in Nigeria.`;

export type AiCause = { name: string; likelihood: number; why: string };
export type AiStep = { step: string; difficulty: "easy" | "medium" | "pro"; source: string | null };
export type AiTurn = {
  reply: string;
  question: { text: string; options: string[] } | null;
  causes: AiCause[];
  status: "asking" | "diagnosed" | "safety_stop";
  checklist: AiStep[];
  safety_message: string | null;
};

const turnSchema = z.object({
  reply: z.string(),
  question: z.object({ text: z.string(), options: z.array(z.string()).min(1) }).nullable().catch(null),
  causes: z.array(z.object({ name: z.string(), likelihood: z.coerce.number(), why: z.string().catch("") })).catch([]),
  status: z.enum(["asking", "diagnosed", "safety_stop"]),
  checklist: z.array(z.object({ step: z.string(), difficulty: z.enum(["easy", "medium", "pro"]).catch("medium"), source: z.string().nullable().catch(null) })).catch([]),
  safety_message: z.string().nullable().catch(null),
});

const inputSchema = z.object({
  machine: z.string().max(60),
  language: z.enum(["english", "pidgin"]),
  conversation: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) })).max(40),
  last_answer: z.string().max(600).nullable(),
  photo_findings: z.string().max(2000).nullable().optional(),
  pack: z.unknown().optional(),
});

const FRIENDLY = "FixIt can't reach the technician right now. Please try again in a moment.";
const BUSY = "FixIt is busy right now. Please wait a few seconds and try again.";

export const diagnose = createServerFn({ method: "POST" })
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data }): Promise<{ turn: AiTurn | null; error?: string }> => {
    // Hard safety rule: never rely on the model alone.
    const userText = [data.last_answer ?? "", ...data.conversation.filter((m) => m.role === "user").map((m) => m.content)].join(" ");
    const forced = safetyReason(userText);

    const key = process.env["GROQ_API_KEY"];
    if (!key) return { turn: null, error: FRIENDLY };

    const context = [
      `Machine: ${data.machine}`,
      `Language: ${data.language}`,
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
        const turn = turnSchema.parse(JSON.parse(json.choices?.[0]?.message?.content ?? "")) as AiTurn;
        turn.causes.sort((a, b) => b.likelihood - a.likelihood);
        const aiSafety = safetyReason([turn.reply, ...turn.checklist.map((s) => s.step)].join(" "));
        if (forced || (turn.status === "diagnosed" && aiSafety)) {
          return { turn: { ...turn, status: "safety_stop", question: null, checklist: [], safety_message: turn.safety_message ?? forced ?? aiSafety } };
        }
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
