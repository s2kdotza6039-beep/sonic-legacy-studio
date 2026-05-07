
CREATE OR REPLACE FUNCTION public.log_ai_draft_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Skip no-op updates and skip status transitions that are already logged
    -- by approve_ai_draft / reject_ai_draft RPCs (those write 'approved_and_published' / 'rejected').
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status NOT IN ('published','rejected') THEN
      INSERT INTO public.ai_activity_log (actor, actor_user_id, action, entity_type, entity_id, command, metadata)
      VALUES (
        CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'founder' END,
        auth.uid(),
        'status_changed',
        NEW.draft_type,
        NEW.id,
        NEW.command,
        jsonb_build_object('from', OLD.status, 'to', NEW.status, 'title', NEW.title)
      );
    ELSIF NEW.title IS DISTINCT FROM OLD.title OR NEW.payload IS DISTINCT FROM OLD.payload THEN
      INSERT INTO public.ai_activity_log (actor, actor_user_id, action, entity_type, entity_id, command, metadata)
      VALUES (
        CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'founder' END,
        auth.uid(),
        'edited_draft',
        NEW.draft_type,
        NEW.id,
        NEW.command,
        jsonb_build_object(
          'title', NEW.title,
          'changed_title', NEW.title IS DISTINCT FROM OLD.title,
          'changed_payload', NEW.payload IS DISTINCT FROM OLD.payload
        )
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.ai_activity_log (actor, actor_user_id, action, entity_type, entity_id, command, metadata)
    VALUES (
      CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'founder' END,
      auth.uid(),
      'deleted_draft',
      OLD.draft_type,
      OLD.id,
      OLD.command,
      jsonb_build_object('title', OLD.title, 'last_status', OLD.status)
    );
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_ai_draft_changes ON public.ai_drafts;
CREATE TRIGGER trg_log_ai_draft_changes
AFTER UPDATE OR DELETE ON public.ai_drafts
FOR EACH ROW EXECUTE FUNCTION public.log_ai_draft_changes();

-- Index to make the activity log fast to scan in the dashboard
CREATE INDEX IF NOT EXISTS idx_ai_activity_log_created_at ON public.ai_activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_activity_log_entity ON public.ai_activity_log (entity_type, entity_id);
