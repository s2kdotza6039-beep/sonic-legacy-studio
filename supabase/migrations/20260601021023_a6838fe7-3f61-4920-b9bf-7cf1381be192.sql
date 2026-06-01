
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

  IF NEW.threshold < 1 OR NEW.window_minutes < 1 OR NEW.cooldown_minutes < 0 THEN
    RAISE EXCEPTION 'Numeric bounds violated';
  END IF;

  RETURN NEW;
END;
$$;
