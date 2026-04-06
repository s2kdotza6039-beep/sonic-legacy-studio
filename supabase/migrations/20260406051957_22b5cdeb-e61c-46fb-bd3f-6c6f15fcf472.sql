
-- Songs table
CREATE TABLE public.songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  artist_name TEXT,
  streams BIGINT NOT NULL DEFAULT 0,
  expected_publishing NUMERIC NOT NULL DEFAULT 0,
  actual_publishing NUMERIC NOT NULL DEFAULT 0,
  isrc TEXT,
  iswc TEXT,
  registered_capasso BOOLEAN NOT NULL DEFAULT false,
  registered_samro BOOLEAN NOT NULL DEFAULT false,
  release_date DATE,
  platform TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Founders can manage songs" ON public.songs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'founder'::app_role))
  WITH CHECK (has_role(auth.uid(), 'founder'::app_role));

CREATE TRIGGER update_songs_updated_at BEFORE UPDATE ON public.songs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Royalty income table
CREATE TABLE public.royalty_income (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  month TEXT NOT NULL,
  territory TEXT DEFAULT 'South Africa',
  gross NUMERIC NOT NULL DEFAULT 0,
  fees NUMERIC NOT NULL DEFAULT 0,
  net NUMERIC NOT NULL DEFAULT 0,
  paid BOOLEAN NOT NULL DEFAULT false,
  payment_date DATE,
  notes TEXT,
  song_id UUID REFERENCES public.songs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.royalty_income ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Founders can manage royalty income" ON public.royalty_income FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'founder'::app_role))
  WITH CHECK (has_role(auth.uid(), 'founder'::app_role));

CREATE TRIGGER update_royalty_income_updated_at BEFORE UPDATE ON public.royalty_income
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Territory data table
CREATE TABLE public.territory_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  song_id UUID REFERENCES public.songs(id) ON DELETE CASCADE NOT NULL,
  country TEXT NOT NULL,
  streams BIGINT NOT NULL DEFAULT 0,
  expected_revenue NUMERIC NOT NULL DEFAULT 0,
  actual_revenue NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.territory_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Founders can manage territory data" ON public.territory_data FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'founder'::app_role))
  WITH CHECK (has_role(auth.uid(), 'founder'::app_role));

CREATE TRIGGER update_territory_data_updated_at BEFORE UPDATE ON public.territory_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Royalty alerts table
CREATE TABLE public.royalty_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  message TEXT NOT NULL,
  song_id UUID REFERENCES public.songs(id) ON DELETE CASCADE,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  action_required TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.royalty_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Founders can manage royalty alerts" ON public.royalty_alerts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'founder'::app_role))
  WITH CHECK (has_role(auth.uid(), 'founder'::app_role));

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.songs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.royalty_income;
ALTER PUBLICATION supabase_realtime ADD TABLE public.royalty_alerts;
