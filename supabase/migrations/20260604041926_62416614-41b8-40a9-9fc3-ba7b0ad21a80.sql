ALTER TABLE public.playback_events DROP CONSTRAINT IF EXISTS playback_events_event_kind_check;
ALTER TABLE public.playback_events ADD CONSTRAINT playback_events_event_kind_check CHECK (event_kind = ANY (ARRAY[
  'clamp','resume','upgrade_applied','seek_blocked','watchdog_clamp','tab_resume','re_unlock_prompt',
  'worker_granted','worker_denied_signature','worker_denied_expired','worker_denied_path','worker_denied_range','worker_denied_replay','worker_denied_rate_limit'
]));