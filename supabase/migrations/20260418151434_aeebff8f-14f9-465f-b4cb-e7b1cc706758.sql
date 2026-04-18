
-- Email drafts table for AI-assisted outbox
CREATE TABLE public.email_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | sent | discarded
  source TEXT NOT NULL DEFAULT 'manual', -- manual | ai_assistant
  conversation_id UUID REFERENCES public.ai_chat_conversations(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  sent_via TEXT, -- system | mailto
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders can manage email_drafts"
ON public.email_drafts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'founder'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'founder'::app_role));

CREATE TRIGGER update_email_drafts_updated_at
BEFORE UPDATE ON public.email_drafts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_email_drafts_status ON public.email_drafts(status, created_at DESC);
