
CREATE TABLE public.command_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command text NOT NULL,
  frequency text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('hourly','daily','weekly')),
  hour_of_day int NOT NULL DEFAULT 9,
  day_of_week int,
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.command_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Founders manage command_schedules" ON public.command_schedules
  FOR ALL TO authenticated USING (has_role(auth.uid(),'founder'))
  WITH CHECK (has_role(auth.uid(),'founder'));
CREATE POLICY "Service role reads command_schedules" ON public.command_schedules
  FOR SELECT TO public USING (auth.role() = 'service_role');
CREATE POLICY "Service role updates command_schedules" ON public.command_schedules
  FOR UPDATE TO public USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE TRIGGER trg_command_schedules_updated BEFORE UPDATE ON public.command_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.command_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command text NOT NULL,
  triggered_by text NOT NULL DEFAULT 'manual',
  schedule_id uuid REFERENCES public.command_schedules(id) ON DELETE SET NULL,
  triggered_by_user uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  error_message text,
  draft_ids uuid[] NOT NULL DEFAULT '{}',
  draft_count int NOT NULL DEFAULT 0
);
ALTER TABLE public.command_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Founders read command_runs" ON public.command_runs
  FOR SELECT TO authenticated USING (has_role(auth.uid(),'founder'));
CREATE POLICY "Founders insert command_runs" ON public.command_runs
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'founder'));
CREATE POLICY "Founders update command_runs" ON public.command_runs
  FOR UPDATE TO authenticated USING (has_role(auth.uid(),'founder'))
  WITH CHECK (has_role(auth.uid(),'founder'));
CREATE POLICY "Service role manages command_runs" ON public.command_runs
  FOR ALL TO public USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_command_runs_started_at ON public.command_runs(started_at DESC);
CREATE INDEX idx_command_schedules_next_run ON public.command_schedules(next_run_at) WHERE is_active;
