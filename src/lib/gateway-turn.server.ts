import { Output } from 'ai';
import { z } from 'zod';
import { createResponsesCall } from './gateway/responses.server';
const schema = z.object({
  mode: z.enum(['diagnose', 'guide']), risk: z.enum(['diy','careful','pro','emergency']), reply: z.string(),
  question: z.object({ text: z.string(), options: z.array(z.string()) }).nullable(),
  causes: z.array(z.object({ name: z.string(), likelihood: z.number(), why: z.string() })),
  status: z.enum(['asking','diagnosed','guide_ready','safety_stop']),
  before_you_start: z.object({ tools: z.array(z.string()), safety_first: z.array(z.string()) }).nullable(),
  checklist: z.array(z.object({ step: z.string(), difficulty: z.enum(['easy','medium','pro']), warning: z.string().nullable(), source: z.string().nullable() })),
  stop_if: z.array(z.string()), situation: z.array(z.object({ label: z.string(), value: z.string() })), safety_message: z.string().nullable(),
});
export async function gatewayTurn(request: Request, apiKey: string, instructions: string, messages: { role: 'user' | 'assistant'; content: string }[]) {
  const { result } = createResponsesCall(request, { apiKey, baseURL: 'https://ai.gateway.lovable.dev/v1', model: 'openai/gpt-6-astra' }, messages, instructions, Output.object({ schema }));
  return await result.output;
}