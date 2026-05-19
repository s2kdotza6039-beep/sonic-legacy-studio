
CREATE TABLE public.payfast_notify_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  m_payment_id text,
  payment_id uuid,
  signature_ok boolean NOT NULL DEFAULT false,
  amount_ok boolean NOT NULL DEFAULT false,
  was_idempotent_skip boolean NOT NULL DEFAULT false,
  pf_payment_status text,
  expected_amount_cents integer,
  received_amount text,
  verify_reason text,
  outcome text NOT NULL,
  source_ip text,
  raw_payload jsonb,
  raw_body_hash text
);

CREATE INDEX idx_payfast_notify_log_created_at ON public.payfast_notify_log (created_at DESC);
CREATE INDEX idx_payfast_notify_log_m_payment_id ON public.payfast_notify_log (m_payment_id);
CREATE INDEX idx_payfast_notify_log_outcome ON public.payfast_notify_log (outcome);

ALTER TABLE public.payfast_notify_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders read payfast_notify_log"
  ON public.payfast_notify_log FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'founder'::app_role));

CREATE POLICY "Service role manages payfast_notify_log"
  ON public.payfast_notify_log FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
