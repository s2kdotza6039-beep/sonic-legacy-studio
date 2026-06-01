
-- 1. Saved filter presets for the Security Audit Log viewer
CREATE TABLE public.security_audit_log_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_audit_log_presets TO authenticated;
GRANT ALL ON public.security_audit_log_presets TO service_role;

ALTER TABLE public.security_audit_log_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders read own presets"
  ON public.security_audit_log_presets FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'founder') AND owner_user_id = auth.uid());

CREATE POLICY "Founders write own presets"
  ON public.security_audit_log_presets FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'founder') AND owner_user_id = auth.uid());

CREATE POLICY "Founders update own presets"
  ON public.security_audit_log_presets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'founder') AND owner_user_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'founder') AND owner_user_id = auth.uid());

CREATE POLICY "Founders delete own presets"
  ON public.security_audit_log_presets FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'founder') AND owner_user_id = auth.uid());

CREATE TRIGGER trg_security_audit_log_presets_updated
BEFORE UPDATE ON public.security_audit_log_presets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Scheduled CSV exports for the Security Audit Log
CREATE TABLE public.security_scheduled_exports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  cadence TEXT NOT NULL CHECK (cadence IN ('daily','weekly')),
  lookback_hours INTEGER NOT NULL DEFAULT 24 CHECK (lookback_hours BETWEEN 1 AND 720),
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('email','webhook')),
  destination TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_status TEXT,
  last_error TEXT,
  last_row_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_scheduled_exports TO authenticated;
GRANT ALL ON public.security_scheduled_exports TO service_role;

ALTER TABLE public.security_scheduled_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders read scheduled exports"
  ON public.security_scheduled_exports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'founder'));

CREATE POLICY "Founders create scheduled exports"
  ON public.security_scheduled_exports FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'founder') AND owner_user_id = auth.uid());

CREATE POLICY "Founders update scheduled exports"
  ON public.security_scheduled_exports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'founder'))
  WITH CHECK (public.has_role(auth.uid(), 'founder'));

CREATE POLICY "Founders delete scheduled exports"
  ON public.security_scheduled_exports FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'founder'));

CREATE TRIGGER trg_security_scheduled_exports_updated
BEFORE UPDATE ON public.security_scheduled_exports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Validation: destination must match delivery_method
CREATE OR REPLACE FUNCTION public.validate_scheduled_export()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.delivery_method = 'email' THEN
    IF NEW.destination !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR char_length(NEW.destination) > 255 THEN
      RAISE EXCEPTION 'Invalid email destination for delivery_method=email';
    END IF;
  ELSIF NEW.delivery_method = 'webhook' THEN
    IF NEW.destination !~ '^https://[^\s]+$' THEN
      RAISE EXCEPTION 'Webhook destination must be an https:// URL';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_scheduled_export
BEFORE INSERT OR UPDATE ON public.security_scheduled_exports
FOR EACH ROW EXECUTE FUNCTION public.validate_scheduled_export();
