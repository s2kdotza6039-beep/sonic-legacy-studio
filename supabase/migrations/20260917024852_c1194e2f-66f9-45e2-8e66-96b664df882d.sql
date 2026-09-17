-- 1. Allow real outcome statuses in email_send_log
ALTER TABLE public.email_send_log DROP CONSTRAINT IF EXISTS email_send_log_status_check;
ALTER TABLE public.email_send_log ADD CONSTRAINT email_send_log_status_check
  CHECK (status = ANY (ARRAY['pending','queued','accepted','sent','delivered','rate_limited','suppressed','failed','bounced','complained','dlq']));

-- 2. Outbox delivery correlation
ALTER TABLE public.email_drafts
  ADD COLUMN IF NOT EXISTS delivery_message_id TEXT,
  ADD COLUMN IF NOT EXISTS delivery_status TEXT,
  ADD COLUMN IF NOT EXISTS delivery_error TEXT,
  ADD COLUMN IF NOT EXISTS delivery_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS email_drafts_delivery_message_id_idx
  ON public.email_drafts (delivery_message_id);

-- 3. Public contact enquiries
CREATE TABLE IF NOT EXISTS public.contact_enquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  email TEXT NOT NULL CHECK (char_length(email) BETWEEN 5 AND 200 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  department TEXT NOT NULL CHECK (department IN ('business','booking','partnership','press','other')),
  subject TEXT NOT NULL CHECK (char_length(subject) BETWEEN 3 AND 200),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 10 AND 5000),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewing','answered','archived')),
  notified_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.contact_enquiries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_enquiries TO authenticated;
GRANT ALL ON public.contact_enquiries TO service_role;

ALTER TABLE public.contact_enquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit an enquiry"
  ON public.contact_enquiries FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'new' AND notified_message_id IS NULL);

CREATE POLICY "Founders manage enquiries"
  ON public.contact_enquiries FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'founder'::app_role));

CREATE POLICY "Founders update enquiries"
  ON public.contact_enquiries FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'founder'::app_role))
  WITH CHECK (has_role(auth.uid(), 'founder'::app_role));

CREATE POLICY "Founders delete enquiries"
  ON public.contact_enquiries FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'founder'::app_role));

CREATE TRIGGER update_contact_enquiries_updated_at
  BEFORE UPDATE ON public.contact_enquiries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();