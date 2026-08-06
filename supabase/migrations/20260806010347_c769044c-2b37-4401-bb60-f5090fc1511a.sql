-- 1. Knowledge vault: founder-only reads
DROP POLICY IF EXISTS "Signed-in users can view knowledge vault" ON public.knowledge_vault;
CREATE POLICY "Founders can view knowledge vault"
ON public.knowledge_vault FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'founder'::app_role));

-- 2. Tracks: remove public row access to base table (exposes r2_object_key)
DROP POLICY IF EXISTS "Public reads active tracks" ON public.tracks;
REVOKE SELECT ON public.tracks FROM anon;

-- Safe public projection excluding r2_object_key
CREATE OR REPLACE VIEW public.tracks_public AS
  SELECT id, slug, title, artist_name, artist_slug, cover_url, duration_seconds,
         price_standard_cents, price_gold_cents, price_download_cents,
         pct_free, pct_standard, pct_gold, is_active, sort_order,
         created_at, updated_at
  FROM public.tracks
  WHERE is_active = true;

GRANT SELECT ON public.tracks_public TO anon, authenticated;