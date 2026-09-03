CREATE OR REPLACE FUNCTION public.block_non_founder_writes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND has_role(auth.uid(), 'founder') THEN
    RETURN NEW;
  END IF;

  -- Coordinators may draft/edit events, but never publish them.
  IF TG_TABLE_NAME = 'events'
     AND auth.uid() IS NOT NULL
     AND has_role_coordinator(auth.uid()) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Coordinators cannot delete events';
    END IF;
    IF NEW.status = 'published' THEN
      RAISE EXCEPTION 'Only founders can publish events';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Only founders can write to %', TG_TABLE_NAME;
END;
$function$;