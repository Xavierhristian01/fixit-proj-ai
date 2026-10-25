import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import { identitySchema } from './repair-record';

export const identifyLabel = createServerFn({ method: 'POST' }).inputValidator(d => z.object({ image: z.string().min(1).max(4_000_000) }).parse(d)).handler(async ({ data }) => {
  const key = process.env['LOVABLE_API_KEY'];
  if (!key) return { identity: null, error: 'AI photo scanning is not configured.' };
  try {
    const { scanLabel } = await import('./label.server');
    return { identity: identitySchema.parse(await scanLabel(getRequest(), key, data.image)), error: null };
  } catch (error) {
    return { identity: null, error: error instanceof Error ? error.message : 'Could not read the model label.' };
  }
});