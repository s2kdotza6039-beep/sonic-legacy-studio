-- Pin search_path on the trigger function (already SECURITY DEFINER)
ALTER FUNCTION public.log_ai_draft_created() SET search_path = public;

-- Restrict SECURITY DEFINER RPCs to authenticated users only
REVOKE ALL ON FUNCTION public.approve_ai_draft(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_ai_draft(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_ai_draft(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_ai_draft(uuid, text) TO authenticated;

-- Tighten public-insert policies on booking_enquiries / sponsor_leads
DROP POLICY IF EXISTS "Public can create booking_enquiries" ON public.booking_enquiries;
CREATE POLICY "Public can create booking_enquiries" ON public.booking_enquiries
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    char_length(name) BETWEEN 1 AND 200
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND char_length(email) <= 255
    AND (message IS NULL OR char_length(message) <= 5000)
    AND status = 'new'
  );

DROP POLICY IF EXISTS "Public can create sponsor_leads" ON public.sponsor_leads;
CREATE POLICY "Public can create sponsor_leads" ON public.sponsor_leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    char_length(company) BETWEEN 1 AND 200
    AND (email IS NULL OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
    AND (message IS NULL OR char_length(message) <= 5000)
    AND status = 'new'
  );