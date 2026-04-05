
CREATE TABLE public.artist_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL DEFAULT 'note',
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_artist_activities_artist_id ON public.artist_activities(artist_id);
CREATE INDEX idx_artist_activities_created_at ON public.artist_activities(created_at DESC);

ALTER TABLE public.artist_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders can manage artist activities"
ON public.artist_activities
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'founder'::app_role))
WITH CHECK (has_role(auth.uid(), 'founder'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.artist_activities;

CREATE TRIGGER update_artist_activities_updated_at
BEFORE UPDATE ON public.artist_activities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
