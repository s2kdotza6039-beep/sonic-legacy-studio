CREATE TABLE public.security_scheduled_export_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id uuid NOT NULL,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  finished_at timestamp with time zone,
  status text NOT NULL CHECK (status = ANY (ARRAY['queued','sent','failed'])),
  retry_count integer NOT NULL DEFAULT 0,
  row_count integer,
  delivery_method text,
  destination text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_scheduled_export_runs_schedule_id ON public.security_scheduled_export_runs(schedule_id, started_at DESC);

GRANT SELECT ON public.security_scheduled_export_runs TO authenticated;
GRANT ALL ON public.security_scheduled_export_runs TO service_role;

ALTER TABLE public.security_scheduled_export_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders read scheduled export runs"
  ON public.security_scheduled_export_runs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'founder'::app_role));

CREATE POLICY "Service role manages scheduled export runs"
  ON public.security_scheduled_export_runs
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');