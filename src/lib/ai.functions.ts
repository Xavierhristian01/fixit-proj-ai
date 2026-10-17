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

export const analyzePhoto = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ image: z.string().max(6_000_000), mimeType: z.string().regex(/^image\//), machine: z.string().max(60) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ description: string | null; error?: string }> => {
    const key = process.env["GEMINI_API_KEY"];
    if (!key) return { description: null, error: "missing key" };
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemma-4-26b-a4b-it:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                { text: `This photo shows a ${data.machine}. In one or two plain sentences, describe the visible problem (damage, leaks, burn marks, smoke, loose or broken parts). If you cannot see a problem, describe what part is shown. No emoji, no preamble.` },
                { inline_data: { mime_type: data.mimeType, data: data.image } },
              ],
            }],
          }),
        },
      );
      if (!res.ok) {
        console.error("gemini", res.status, await res.text());
        return { description: null, error: "ai unavailable" };
      }
      const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
      return text ? { description: text } : { description: null, error: "empty" };
    } catch (e) {
      console.error("analyze-photo", e);
      return { description: null, error: "ai unavailable" };
    }
  });
