ALTER TABLE public.fan_posts
  ADD COLUMN IF NOT EXISTS thumb_url text,
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS moderation_note text,
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderated_by uuid;

UPDATE public.fan_posts SET moderation_status = 'approved' WHERE moderation_status = 'pending' AND status = 'published';

DROP POLICY IF EXISTS "Anyone can view published fan posts" ON public.fan_posts;
CREATE POLICY "Anyone can view published approved fan posts"
ON public.fan_posts FOR SELECT
USING (status = 'published' AND moderation_status = 'approved');