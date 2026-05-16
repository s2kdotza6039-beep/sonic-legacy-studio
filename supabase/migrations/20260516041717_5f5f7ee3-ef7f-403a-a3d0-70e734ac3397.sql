
-- =========================================
-- TRACKS
-- =========================================
CREATE TABLE public.tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  artist_name text NOT NULL,
  artist_slug text,
  r2_object_key text NOT NULL,
  cover_url text,
  duration_seconds integer,
  price_standard_cents integer NOT NULL DEFAULT 350,
  price_gold_cents integer NOT NULL DEFAULT 500,
  price_download_cents integer NOT NULL DEFAULT 1000,
  pct_free numeric NOT NULL DEFAULT 0.25,
  pct_standard numeric NOT NULL DEFAULT 0.55,
  pct_gold numeric NOT NULL DEFAULT 1.00,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads active tracks"
  ON public.tracks FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Founders manage tracks"
  ON public.tracks FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'founder'))
  WITH CHECK (has_role(auth.uid(), 'founder'));

CREATE TRIGGER trg_tracks_updated_at
  BEFORE UPDATE ON public.tracks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- PAYMENTS
-- =========================================
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  m_payment_id text UNIQUE NOT NULL,                 -- our reference sent to PayFast
  pf_payment_id text,                                -- PayFast's id (filled by ITN)
  user_id uuid,                                       -- nullable: guest checkout allowed
  buyer_email text,
  track_id uuid REFERENCES public.tracks(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('tier_standard','tier_gold','download')),
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'ZAR',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','cancelled')),
  signature_verified boolean NOT NULL DEFAULT false,
  itn_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_user ON public.payments(user_id);
CREATE INDEX idx_payments_email ON public.payments(buyer_email);
CREATE INDEX idx_payments_track ON public.payments(track_id);
CREATE INDEX idx_payments_status ON public.payments(status);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders manage payments"
  ON public.payments FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'founder'))
  WITH CHECK (has_role(auth.uid(), 'founder'));

CREATE POLICY "Users read their own payments"
  ON public.payments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role manages payments"
  ON public.payments FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- DOWNLOAD TOKENS
-- =========================================
CREATE TABLE public.download_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_download_tokens_token ON public.download_tokens(token);

ALTER TABLE public.download_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders read download tokens"
  ON public.download_tokens FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'founder'));

CREATE POLICY "Service role manages download tokens"
  ON public.download_tokens FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =========================================
-- SEED initial tracks
-- =========================================
INSERT INTO public.tracks (slug, title, artist_name, artist_slug, r2_object_key, sort_order)
VALUES
  ('kule-life', 'Kule Life', 'Pitch Black Afro', 'pitch-black-afro',
   'KULE%20LIFE%20-%20PBA%20edit.mp3', 1),
  ('shooting-star', 'Shooting Star', 'Wijo da Weekend', 'wijo-da-weekend',
   'SHOOTING%20STAR%20-%20WIJO%20DA%20WEEKEND%20.mp3', 2)
ON CONFLICT (slug) DO NOTHING;
