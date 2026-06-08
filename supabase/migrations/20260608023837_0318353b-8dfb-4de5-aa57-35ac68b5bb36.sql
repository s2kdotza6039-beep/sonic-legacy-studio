
CREATE TABLE IF NOT EXISTS public.phase2_deploy_state (
  step_id text PRIMARY KEY,
  checked boolean NOT NULL DEFAULT false,
  last_run_at timestamptz,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.phase2_deploy_state TO authenticated;
GRANT ALL ON public.phase2_deploy_state TO service_role;

ALTER TABLE public.phase2_deploy_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders manage phase2_deploy_state"
  ON public.phase2_deploy_state
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'founder'::app_role))
  WITH CHECK (has_role(auth.uid(), 'founder'::app_role));

CREATE TRIGGER phase2_deploy_state_updated_at
  BEFORE UPDATE ON public.phase2_deploy_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
