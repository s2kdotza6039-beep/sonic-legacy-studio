
-- Trigger: enforce AI cannot create non-pending drafts, and cannot bypass approval
CREATE OR REPLACE FUNCTION public.enforce_ai_draft_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- AI-sourced drafts MUST be pending. No pre-approval, no auto-publish.
    IF NEW.source = 'ai_assistant' THEN
      IF NEW.status IS DISTINCT FROM 'pending' THEN
        RAISE EXCEPTION 'AI assistant can only create drafts with status=pending';
      END IF;
      IF NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL OR NEW.published_at IS NOT NULL OR NEW.target_id IS NOT NULL THEN
        RAISE EXCEPTION 'AI assistant cannot pre-approve, publish, or link target rows';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Only founders (via RPCs which set auth.uid()) may transition status / approve / publish.
    -- Service role and anon are blocked from mutating drafts post-insert.
    IF NOT has_role(auth.uid(), 'founder') THEN
      RAISE EXCEPTION 'Only founders can modify ai_drafts';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF NOT has_role(auth.uid(), 'founder') THEN
      RAISE EXCEPTION 'Only founders can delete ai_drafts';
    END IF;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_ai_draft_permissions ON public.ai_drafts;
CREATE TRIGGER trg_enforce_ai_draft_permissions
BEFORE INSERT OR UPDATE OR DELETE ON public.ai_drafts
FOR EACH ROW EXECUTE FUNCTION public.enforce_ai_draft_permissions();

-- Guardrail: block direct AI writes to publish-target tables.
-- These tables already have "Founders manage" RLS, but we add explicit deny for non-founder roles
-- so even if service-role code is ever pointed at them, the trigger fires.
CREATE OR REPLACE FUNCTION public.block_non_founder_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- approve_ai_draft / reject_ai_draft run as SECURITY DEFINER with a founder auth.uid(),
  -- so they pass. Service-role calls from edge functions (no auth.uid) are blocked.
  IF auth.uid() IS NULL OR NOT has_role(auth.uid(), 'founder') THEN
    RAISE EXCEPTION 'Only founders can write to %', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_news_writes ON public.news_posts;
CREATE TRIGGER trg_block_news_writes
BEFORE INSERT OR UPDATE OR DELETE ON public.news_posts
FOR EACH ROW EXECUTE FUNCTION public.block_non_founder_writes();

DROP TRIGGER IF EXISTS trg_block_events_writes ON public.events;
CREATE TRIGGER trg_block_events_writes
BEFORE INSERT OR UPDATE OR DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.block_non_founder_writes();

DROP TRIGGER IF EXISTS trg_block_announcements_writes ON public.announcements;
CREATE TRIGGER trg_block_announcements_writes
BEFORE INSERT OR UPDATE OR DELETE ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.block_non_founder_writes();

DROP TRIGGER IF EXISTS trg_block_invoices_writes ON public.invoices;
CREATE TRIGGER trg_block_invoices_writes
BEFORE INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.block_non_founder_writes();
