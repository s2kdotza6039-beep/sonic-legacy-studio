CREATE TABLE public.playback_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NULL,
  track_id uuid NULL REFERENCES public.tracks(id) ON DELETE SET NULL,
  event_kind text NOT NULL CHECK (event_kind IN ('clamp','resume','upgrade_applied','seek_blocked','watchdog_clamp','tab_resume','re_unlock_prompt')),
  tier text NULL,
  current_seconds numeric NULL,
  allowed_seconds numeric NULL,
  duration_seconds numeric NULL,
  payment_ref text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_playback_events_track ON public.playback_events(track_id, created_at DESC);
CREATE INDEX idx_playback_events_kind ON public.playback_events(event_kind, created_at DESC);
CREATE INDEX idx_playback_events_user ON public.playback_events(user_id, created_at DESC);

ALTER TABLE public.playback_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert playback events"
ON public.playback_events FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Founders can read playback events"
ON public.playback_events FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'founder'));