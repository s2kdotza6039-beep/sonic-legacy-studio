
CREATE TABLE public.artist_scorecards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_name TEXT NOT NULL,
  review_month TEXT NOT NULL,
  discipline INTEGER NOT NULL DEFAULT 0,
  music_output INTEGER NOT NULL DEFAULT 0,
  live_performance INTEGER NOT NULL DEFAULT 0,
  content_brand INTEGER NOT NULL DEFAULT 0,
  audience_growth INTEGER NOT NULL DEFAULT 0,
  business_cooperation INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER GENERATED ALWAYS AS (discipline + music_output + live_performance + content_brand + audience_growth + business_cooperation) STORED,
  tier TEXT GENERATED ALWAYS AS (
    CASE
      WHEN (discipline + music_output + live_performance + content_brand + audience_growth + business_cooperation) < 40 THEN 'Probation'
      WHEN (discipline + music_output + live_performance + content_brand + audience_growth + business_cooperation) < 60 THEN 'Development'
      WHEN (discipline + music_output + live_performance + content_brand + audience_growth + business_cooperation) < 80 THEN 'Core Roster'
      ELSE 'Flagship'
    END
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.artist_scorecards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders can manage scorecards" ON public.artist_scorecards FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'founder'::app_role))
  WITH CHECK (has_role(auth.uid(), 'founder'::app_role));

CREATE TRIGGER update_artist_scorecards_updated_at BEFORE UPDATE ON public.artist_scorecards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
