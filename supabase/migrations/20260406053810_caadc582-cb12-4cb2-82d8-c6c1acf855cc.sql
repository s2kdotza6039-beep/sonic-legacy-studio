
CREATE TABLE public.idea_boards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#8B5CF6',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.idea_boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders can manage idea boards" ON public.idea_boards FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'founder'::app_role))
  WITH CHECK (has_role(auth.uid(), 'founder'::app_role));

CREATE TRIGGER update_idea_boards_updated_at BEFORE UPDATE ON public.idea_boards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ideas ADD COLUMN board_id UUID REFERENCES public.idea_boards(id) ON DELETE SET NULL;
