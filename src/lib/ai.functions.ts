import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Scenario } from "./mock-data";

const SYSTEM = `You are FixIt AI, a practical technician helping people in Nigeria troubleshoot generators, water pumps, cars and household items.
Return ONLY JSON matching:
{"intro":{"en":string,"pcm":string},
 "causes":[{"id":string,"label":string,"pct":number}],
 "questions":[{"text":{"en":string,"pcm":string},"effects":{"yes":{[causeId]:number},"no":{...},"unsure":{...}}}],
 "result":{"kind":"fix","cause":string,"confidence":number,"steps":[{"text":string,"difficulty":"Easy"|"Medium"|"Call a pro"}]}
   OR {"kind":"safety","reason":string,"steps":[...]}}
Rules: 3-5 causes, percentages sum to 100. 2-3 yes/no questions; each effects map covers every cause id and sums to 100. "pcm" is Nigerian Pidgin. 4-6 short steps, first step is always a safety step (switch off/unplug). Prices in Naira written like N4,000. Plain language, no emoji.
If anything involves brakes, steering, gas or fuel leaks, smoke, burning smells, sparks or mains electricity, result.kind MUST be "safety".`;

export const diagnose = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ machine: z.string().max(60), symptom: z.string().min(1).max(600) }).parse(d))
  .handler(async ({ data }): Promise<{ scenario: Scenario | null; error?: string }> => {
    const key = process.env["GROQ_API_KEY"];
    if (!key) return { scenario: null, error: "missing key" };
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: `Machine: ${data.machine}\nProblem: ${data.symptom}` },
          ],
        }),
      });
      if (!res.ok) {
        console.error("groq", res.status, await res.text());
        return { scenario: null, error: "ai unavailable" };
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const s = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as Scenario;
      if (!s.intro || !Array.isArray(s.causes) || !Array.isArray(s.questions) || !s.result?.steps) throw new Error("bad shape");
      return { scenario: s };
    } catch (e) {
      console.error("diagnose", e);
      return { scenario: null, error: "ai unavailable" };
    }
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
