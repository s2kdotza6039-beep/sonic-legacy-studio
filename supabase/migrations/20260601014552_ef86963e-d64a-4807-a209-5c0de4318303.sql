-- 1) Remove r2_object_key from public track reads
REVOKE SELECT (r2_object_key) ON public.tracks FROM anon, authenticated, PUBLIC;

-- 2) Tighten always-true INSERT policies on playback_events and release_clicks
DROP POLICY IF EXISTS "Anyone can insert playback events" ON public.playback_events;
CREATE POLICY "Public can insert playback events"
ON public.playback_events
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (user_id IS NULL OR user_id = auth.uid())
  AND event_kind IN ('clamp','resume','upgrade_applied','seek_blocked','watchdog_clamp','tab_resume','re_unlock_prompt')
  AND (current_seconds IS NULL OR current_seconds >= 0)
  AND (allowed_seconds IS NULL OR allowed_seconds >= 0)
  AND (duration_seconds IS NULL OR duration_seconds >= 0)
  AND (user_agent IS NULL OR char_length(user_agent) <= 512)
);

DROP POLICY IF EXISTS "Anyone can insert release clicks" ON public.release_clicks;
CREATE POLICY "Public can insert release clicks"
ON public.release_clicks
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (user_id IS NULL OR user_id = auth.uid())
  AND char_length(destination_url) <= 2048
  AND char_length(source) <= 64
  AND (user_agent IS NULL OR char_length(user_agent) <= 512)
  AND (referrer IS NULL OR char_length(referrer) <= 2048)
);

-- 3) Revoke EXECUTE on internal SECURITY DEFINER helpers from public/anon/authenticated.
-- Keep: has_role (needed by RLS), approve_ai_draft/reject_ai_draft (founder RPCs).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_ai_draft_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_ai_draft_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_ai_draft_permissions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.block_non_founder_writes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;

-- 4) Explicit founder-only UPDATE/DELETE storage policies for submissions and contract-files
DROP POLICY IF EXISTS "Founders update submissions" ON storage.objects;
CREATE POLICY "Founders update submissions"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'submissions' AND public.has_role(auth.uid(), 'founder'::public.app_role))
WITH CHECK (bucket_id = 'submissions' AND public.has_role(auth.uid(), 'founder'::public.app_role));

DROP POLICY IF EXISTS "Founders delete submissions" ON storage.objects;
CREATE POLICY "Founders delete submissions"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'submissions' AND public.has_role(auth.uid(), 'founder'::public.app_role));

DROP POLICY IF EXISTS "Founders update contract files" ON storage.objects;
CREATE POLICY "Founders update contract files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'contract-files' AND public.has_role(auth.uid(), 'founder'::public.app_role))
WITH CHECK (bucket_id = 'contract-files' AND public.has_role(auth.uid(), 'founder'::public.app_role));
