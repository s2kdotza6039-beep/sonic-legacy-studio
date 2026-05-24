CREATE TABLE public.release_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NULL,
  release_title text NULL,
  artist_name text NULL,
  destination_url text NOT NULL,
  source text NOT NULL DEFAULT 'unknown',
  user_id uuid NULL,
  user_agent text NULL,
  referrer text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_release_clicks_release_id ON public.release_clicks(release_id);
CREATE INDEX idx_release_clicks_created_at ON public.release_clicks(created_at DESC);

ALTER TABLE public.release_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert release clicks"
ON public.release_clicks FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Founders can read release clicks"
ON public.release_clicks FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'founder'::app_role));