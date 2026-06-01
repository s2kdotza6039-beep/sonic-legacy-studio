
ALTER TABLE public.security_alert_rules
  DROP CONSTRAINT IF EXISTS alert_source_chk;
ALTER TABLE public.security_alert_rules
  ADD CONSTRAINT alert_source_chk CHECK (
    event_source = ANY (ARRAY['playback','payfast','ai','audit','delivery_meta'])
  );

-- Re-create trigger validator to also accept the meta event_kinds.
CREATE OR REPLACE FUNCTION public.validate_security_alert_rule()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
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

  IF NEW.event_source = 'delivery_meta' THEN
    IF NEW.event_kind NOT IN ('delivery_spike','retry_rate_high','dlq_rate_high') THEN
      RAISE EXCEPTION 'delivery_meta rules require event_kind in (delivery_spike, retry_rate_high, dlq_rate_high)';
    END IF;
    -- For rate kinds, threshold is a percentage (1..100); for spike it is an absolute count.
    IF NEW.event_kind IN ('retry_rate_high','dlq_rate_high') AND (NEW.threshold < 1 OR NEW.threshold > 100) THEN
      RAISE EXCEPTION 'Rate threshold must be a percentage between 1 and 100';
    END IF;
  END IF;

  IF NEW.threshold < 1 OR NEW.window_minutes < 1 OR NEW.cooldown_minutes < 0 THEN
    RAISE EXCEPTION 'Numeric bounds violated';
  END IF;

  RETURN NEW;
END;
$$;
