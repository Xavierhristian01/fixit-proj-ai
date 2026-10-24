CREATE TABLE public.repair_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 machine_id text NOT NULL,
 machine_name text NOT NULL,
 job text NOT NULL,
 result jsonb NOT NULL,
 completed_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
 verification jsonb,
 identity jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.repair_history TO authenticated;
GRANT ALL ON public.repair_history TO service_role;
ALTER TABLE public.repair_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own repairs" ON public.repair_history FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
CREATE POLICY "Save own repairs" ON public.repair_history FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Update own repairs" ON public.repair_history FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Delete own repairs" ON public.repair_history FOR DELETE TO authenticated USING (user_id = (select auth.uid()));
CREATE INDEX repair_history_owner_date ON public.repair_history(user_id, created_at DESC);