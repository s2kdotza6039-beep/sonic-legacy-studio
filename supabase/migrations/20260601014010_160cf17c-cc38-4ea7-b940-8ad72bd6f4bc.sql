
-- ============================================================
-- Security fixes (multiple findings)
-- ============================================================

-- 1) tracks.r2_object_key: hide internal storage key from anonymous (public) readers.
--    Authenticated founders (via MusicAdmin/SandboxPayments) keep access; edge functions
--    use the service role which bypasses column grants.
REVOKE SELECT (r2_object_key) ON public.tracks FROM anon;

-- 2) contract_templates: restrict to founders only (was open to any authenticated user
--    with USING(true) policies on UPDATE/DELETE).
DROP POLICY IF EXISTS "Authenticated users can create templates" ON public.contract_templates;
DROP POLICY IF EXISTS "Authenticated users can update templates" ON public.contract_templates;
DROP POLICY IF EXISTS "Authenticated users can delete templates" ON public.contract_templates;
DROP POLICY IF EXISTS "Authenticated users can view templates"   ON public.contract_templates;

CREATE POLICY "Founders read contract templates"   ON public.contract_templates
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'founder'));
CREATE POLICY "Founders insert contract templates" ON public.contract_templates
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'founder'));
CREATE POLICY "Founders update contract templates" ON public.contract_templates
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'founder'))
  WITH CHECK (public.has_role(auth.uid(), 'founder'));
CREATE POLICY "Founders delete contract templates" ON public.contract_templates
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'founder'));

-- 3) submissions storage bucket: make private and restrict reads to founders.
--    Keep public INSERT so the Careers form can still accept submissions from
--    unauthenticated visitors. Founders/service role can list/read.
UPDATE storage.buckets SET public = false WHERE id = 'submissions';

DROP POLICY IF EXISTS "Anyone can read submissions" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload submissions" ON storage.objects;

CREATE POLICY "Founders read submissions"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'submissions' AND public.has_role(auth.uid(), 'founder'));

CREATE POLICY "Public can upload submissions"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'submissions');

-- 4) realtime.messages: explicit deny-by-default policy. Only founders can subscribe
--    to realtime channels. service_role bypasses RLS for server-side broadcasts.
DROP POLICY IF EXISTS "Founders only realtime" ON realtime.messages;
CREATE POLICY "Founders only realtime"
  ON realtime.messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'founder'));

-- 5) Function search_path hardening for the email helpers (the rest already SET search_path).
ALTER FUNCTION public.enqueue_email(text, jsonb)            SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint)             SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

-- 6) SECURITY DEFINER functions: revoke EXECUTE from anon/authenticated where the
--    function is not meant to be called from the API. Triggers run with definer rights
--    regardless of EXECUTE grants, so revoking is safe for trigger-only functions.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.block_non_founder_writes()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_ai_draft_permissions()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_ai_draft_changes()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_ai_draft_created()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb)            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint)             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
