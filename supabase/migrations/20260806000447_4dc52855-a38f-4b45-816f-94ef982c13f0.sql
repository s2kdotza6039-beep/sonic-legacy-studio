ALTER TABLE public.content_posts
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS post_status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS hashtags text,
  ADD COLUMN IF NOT EXISTS caption text;

ALTER TABLE public.content_posts DROP CONSTRAINT IF EXISTS content_posts_post_status_check;
ALTER TABLE public.content_posts ADD CONSTRAINT content_posts_post_status_check
  CHECK (post_status IN ('draft','scheduled','published','failed'));