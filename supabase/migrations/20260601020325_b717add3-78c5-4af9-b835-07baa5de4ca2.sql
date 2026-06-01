
-- Retry/backoff support on dispatch log
ALTER TABLE public.security_alert_dispatch_log
  ADD COLUMN IF NOT EXISTS attempt INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS rule_snapshot JSONB;

CREATE INDEX IF NOT EXISTS security_alert_dispatch_retry_idx
  ON public.security_alert_dispatch_log (status, next_retry_at)
  WHERE status = 'failed';

-- Dead-letter queue for exhausted retries
CREATE TABLE public.security_alert_dlq (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID,
  rule_name TEXT,
  channel TEXT,
  destination TEXT,
  matched_count INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  payload JSONB,
  rule_snapshot JSONB,
  first_failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, DELETE ON public.security_alert_dlq TO authenticated;
GRANT ALL ON public.security_alert_dlq TO service_role;

ALTER TABLE public.security_alert_dlq ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders read DLQ"
  ON public.security_alert_dlq FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'founder'));

CREATE POLICY "Founders purge DLQ"
  ON public.security_alert_dlq FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'founder'));

-- Retention configuration (single-row)
CREATE TABLE public.security_retention_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  audit_log_days INTEGER NOT NULL DEFAULT 90,
  dispatch_log_days INTEGER NOT NULL DEFAULT 30,
  dlq_days INTEGER NOT NULL DEFAULT 180,
  cleanup_enabled BOOLEAN NOT NULL DEFAULT true,
  last_cleanup_at TIMESTAMPTZ,
  last_cleanup_summary JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT only_one_row CHECK (id = 1),
  CONSTRAINT positive_days CHECK (audit_log_days > 0 AND dispatch_log_days > 0 AND dlq_days > 0)
);

GRANT SELECT, INSERT, UPDATE ON public.security_retention_config TO authenticated;
GRANT ALL ON public.security_retention_config TO service_role;

ALTER TABLE public.security_retention_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders manage retention config"
  ON public.security_retention_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder'))
  WITH CHECK (public.has_role(auth.uid(), 'founder'));

CREATE TRIGGER security_retention_config_updated_at
  BEFORE UPDATE ON public.security_retention_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults
INSERT INTO public.security_retention_config (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;
