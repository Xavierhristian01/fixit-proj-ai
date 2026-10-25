import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { repairSchema } from './repair-record';
import { z } from 'zod';
import type { Json } from '@/integrations/supabase/types';

export const saveRepair = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d) => repairSchema.parse(d)).handler(async ({ data, context }) => {
  const { error } = await context.supabase.from('repair_history').upsert({ ...data, user_id: context.userId, result: data.result as Json, identity: data.identity as Json, verification: data.verification as Json, updated_at: new Date().toISOString() });
  if (error) throw new Error('Could not save your repair. Please try again.');
  return { id: data.id };
});
export const listRepairs = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d) => z.object({ page: z.number().int().nonnegative() }).parse(d)).handler(async ({ data, context }) => {
  const { data: rows, error } = await context.supabase.from('repair_history').select('*').order('created_at', { ascending: false }).range(data.page * 20, data.page * 20 + 19);
  if (error) throw new Error('Could not load your repair history.');
  return (rows ?? []).map(row => ({ ...repairSchema.parse(row), created_at: row.created_at, updated_at: row.updated_at }));
});
export const deleteRepair = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((d) => z.string().uuid().parse(d)).handler(async ({ data, context }) => {
  const { error } = await context.supabase.from('repair_history').delete().eq('id', data);
  if (error) throw new Error('Could not delete this repair.');
  return { ok: true };
});