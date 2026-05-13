-- Create releases CMS table for music releases
CREATE TABLE public.releases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_id TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  title TEXT NOT NULL,
  release_type TEXT NOT NULL DEFAULT 'Single',
  status TEXT NOT NULL DEFAULT 'New Single',
  cover_url TEXT,
  cloudflare_url TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  released_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads releases"
ON public.releases FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Founders manage releases"
ON public.releases FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'founder'::app_role))
WITH CHECK (has_role(auth.uid(), 'founder'::app_role));

CREATE TRIGGER update_releases_updated_at
BEFORE UPDATE ON public.releases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the two current new singles
INSERT INTO public.releases (artist_id, artist_name, title, release_type, status, cloudflare_url, is_featured, sort_order)
VALUES
  ('pitch-black-afro', 'Pitch Black Afro', 'Kule Life', 'Single', 'New Single', 'https://newsingle.s2kdotza.com/pitch-black-afro/kule-life', true, 1),
  ('wijo-da-weekend', 'WIJO da WEEKEND', 'Shooting Star', 'Single', 'New Single', 'https://newsingle.s2kdotza.com/wijo-da-weekend/shooting-star', true, 2);
