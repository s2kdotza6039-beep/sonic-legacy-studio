
-- Security audit log (CSV exports + admin-only operations)
CREATE TABLE public.security_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_user_id UUID,
  action TEXT NOT NULL,            -- e.g. 'csv_export', 'alert_dispatched'
  entity TEXT,                     -- e.g. 'security_events'
  row_count INTEGER,
  filters JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.security_audit_log TO authenticated;
GRANT ALL ON public.security_audit_log TO service_role;

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders read security audit"
  ON public.security_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'founder'));

CREATE POLICY "Founders insert security audit"
  ON public.security_audit_log FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'founder')
    AND actor_user_id = auth.uid()
    AND length(action) BETWEEN 1 AND 64
    AND (entity IS NULL OR length(entity) <= 64)
    AND (user_agent IS NULL OR length(user_agent) <= 512)
  );

CREATE INDEX security_audit_log_created_at_idx
  ON public.security_audit_log (created_at DESC);

-- Configurable alert rules
CREATE TABLE public.security_alert_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  event_source TEXT NOT NULL,            -- 'playback' | 'payfast' | 'ai' | 'audit'
  event_kind TEXT NOT NULL,              -- e.g. 'seek_blocked', '*'
  threshold INTEGER NOT NULL DEFAULT 5,  -- # events
  window_minutes INTEGER NOT NULL DEFAULT 15,
  channel TEXT NOT NULL,                 -- 'email' | 'webhook'
  destination TEXT NOT NULL,             -- email address or https URL
  cooldown_minutes INTEGER NOT NULL DEFAULT 30,
  last_triggered_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT alert_channel_chk CHECK (channel IN ('email','webhook')),
  CONSTRAINT alert_source_chk CHECK (event_source IN ('playback','payfast','ai','audit'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_alert_rules TO authenticated;
GRANT ALL ON public.security_alert_rules TO service_role;

ALTER TABLE public.security_alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders manage alert rules"
  ON public.security_alert_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder'))
  WITH CHECK (public.has_role(auth.uid(), 'founder'));

CREATE TRIGGER security_alert_rules_updated_at
  BEFORE UPDATE ON public.security_alert_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Dispatch log (history of fired alerts)
CREATE TABLE public.security_alert_dispatch_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id UUID REFERENCES public.security_alert_rules(id) ON DELETE SET NULL,
  rule_name TEXT,
  channel TEXT,
  destination TEXT,
  matched_count INTEGER,
  status TEXT NOT NULL,                -- 'sent' | 'failed' | 'skipped_cooldown'
  error TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.security_alert_dispatch_log TO authenticated;
GRANT ALL ON public.security_alert_dispatch_log TO service_role;

ALTER TABLE public.security_alert_dispatch_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders read dispatch log"
  ON public.security_alert_dispatch_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'founder'));
