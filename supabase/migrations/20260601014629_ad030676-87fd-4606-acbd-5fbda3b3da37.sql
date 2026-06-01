-- Replace table-level SELECT with explicit column grants that exclude r2_object_key
REVOKE SELECT ON public.tracks FROM anon, authenticated;

GRANT SELECT (
  id, slug, title, artist_name, artist_slug, cover_url, duration_seconds,
  price_standard_cents, price_gold_cents, price_download_cents,
  pct_free, pct_standard, pct_gold, is_active, sort_order, created_at, updated_at
) ON public.tracks TO anon, authenticated;
