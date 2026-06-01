
-- Bounds on alert rule numeric fields
ALTER TABLE public.security_alert_rules
  DROP CONSTRAINT IF EXISTS alert_threshold_bounds,
  DROP CONSTRAINT IF EXISTS alert_window_bounds,
  DROP CONSTRAINT IF EXISTS alert_cooldown_bounds,
  DROP CONSTRAINT IF EXISTS alert_name_bounds,
  DROP CONSTRAINT IF EXISTS alert_event_kind_bounds,
  DROP CONSTRAINT IF EXISTS alert_destination_bounds;

ALTER TABLE public.security_alert_rules
  ADD CONSTRAINT alert_threshold_bounds CHECK (threshold BETWEEN 1 AND 100000),
  ADD CONSTRAINT alert_window_bounds CHECK (window_minutes BETWEEN 1 AND 10080),
  ADD CONSTRAINT alert_cooldown_bounds CHECK (cooldown_minutes BETWEEN 0 AND 10080),
  ADD CONSTRAINT alert_name_bounds CHECK (char_length(name) BETWEEN 1 AND 120),
  ADD CONSTRAINT alert_event_kind_bounds CHECK (char_length(event_kind) BETWEEN 1 AND 64),
  ADD CONSTRAINT alert_destination_bounds CHECK (char_length(destination) BETWEEN 3 AND 512);

-- Validate destination format vs channel via trigger (CHECK can't reference
-- two columns easily across versions; trigger keeps it explicit and clear)
CREATE OR REPLACE FUNCTION public.validate_security_alert_rule()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.channel = 'email' THEN
    IF NEW.destination !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR char_length(NEW.destination) > 255 THEN
      RAISE EXCEPTION 'Invalid email destination for channel=email';
    END IF;
  ELSIF NEW.channel = 'webhook' THEN
    IF NEW.destination !~ '^https://[^\s]+$' THEN
      RAISE EXCEPTION 'Webhook destination must be an https:// URL';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported channel: %', NEW.channel;
  END IF;

  IF NEW.threshold < 1 OR NEW.window_minutes < 1 OR NEW.cooldown_minutes < 0 THEN
    RAISE EXCEPTION 'Numeric bounds violated';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_security_alert_rule_trg ON public.security_alert_rules;
CREATE TRIGGER validate_security_alert_rule_trg
BEFORE INSERT OR UPDATE ON public.security_alert_rules
FOR EACH ROW EXECUTE FUNCTION public.validate_security_alert_rule();

-- Cap retention day values
ALTER TABLE public.security_retention_config
  DROP CONSTRAINT IF EXISTS retention_days_bounds;
ALTER TABLE public.security_retention_config
  ADD CONSTRAINT retention_days_bounds CHECK (
    audit_log_days BETWEEN 1 AND 3650 AND
    dispatch_log_days BETWEEN 1 AND 3650 AND
    dlq_days BETWEEN 1 AND 3650
  );

-- Belt-and-braces founder-only re-grants (already restricted via existing RLS).
REVOKE ALL ON public.security_alert_rules FROM anon;
REVOKE ALL ON public.security_retention_config FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.security_alert_rules TO authenticated;
GRANT SELECT, UPDATE ON public.security_retention_config TO authenticated;
GRANT ALL ON public.security_alert_rules TO service_role;
GRANT ALL ON public.security_retention_config TO service_role;
