CREATE OR REPLACE FUNCTION public.validate_security_alert_rule()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  min_cooldown int;
BEGIN
  IF NEW.channel = 'email' THEN
    IF NEW.destination !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR char_length(NEW.destination) > 255 THEN
      RAISE EXCEPTION 'Invalid email destination for channel=email';
    END IF;
    min_cooldown := 5;
  ELSIF NEW.channel = 'webhook' THEN
    IF NEW.destination !~ '^https://[^\s]+$' THEN
      RAISE EXCEPTION 'Webhook destination must be an https:// URL';
    END IF;
    min_cooldown := 1;
  ELSE
    RAISE EXCEPTION 'Unsupported channel: %', NEW.channel;
  END IF;

  IF NEW.event_source = 'delivery_meta' THEN
    IF NEW.event_kind NOT IN ('delivery_spike','retry_rate_high','dlq_rate_high') THEN
      RAISE EXCEPTION 'delivery_meta rules require event_kind in (delivery_spike, retry_rate_high, dlq_rate_high)';
    END IF;
    IF NEW.event_kind IN ('retry_rate_high','dlq_rate_high') AND (NEW.threshold < 1 OR NEW.threshold > 100) THEN
      RAISE EXCEPTION 'Rate threshold must be a percentage between 1 and 100';
    END IF;
  END IF;

  IF NEW.threshold < 1 OR NEW.window_minutes < 1 OR NEW.cooldown_minutes < 0 THEN
    RAISE EXCEPTION 'Numeric bounds violated';
  END IF;

  -- Per-channel hard floor cooldown so dry-runs and real deliveries cannot be
  -- bypassed by setting cooldown_minutes below the safe minimum.
  IF NEW.cooldown_minutes < min_cooldown THEN
    RAISE EXCEPTION 'Cooldown for channel=% must be at least % minutes (got %)',
      NEW.channel, min_cooldown, NEW.cooldown_minutes;
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure trigger is attached (idempotent)
DROP TRIGGER IF EXISTS validate_security_alert_rule_trg ON public.security_alert_rules;
CREATE TRIGGER validate_security_alert_rule_trg
BEFORE INSERT OR UPDATE ON public.security_alert_rules
FOR EACH ROW EXECUTE FUNCTION public.validate_security_alert_rule();