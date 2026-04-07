
CREATE TABLE public.betting_slips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  slip_number INTEGER NOT NULL,
  category TEXT NOT NULL DEFAULT 'SAFE',
  stake NUMERIC NOT NULL DEFAULT 0,
  estimated_odds NUMERIC NOT NULL DEFAULT 0,
  potential_return NUMERIC NOT NULL DEFAULT 0,
  actual_return NUMERIC DEFAULT NULL,
  result TEXT NOT NULL DEFAULT 'pending',
  match_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.betting_slips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders can manage betting slips"
ON public.betting_slips
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'founder'::app_role))
WITH CHECK (has_role(auth.uid(), 'founder'::app_role));

CREATE TABLE public.betting_selections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slip_id UUID NOT NULL REFERENCES public.betting_slips(id) ON DELETE CASCADE,
  home TEXT NOT NULL,
  away TEXT NOT NULL,
  market TEXT NOT NULL,
  probability NUMERIC NOT NULL DEFAULT 0,
  is_core BOOLEAN NOT NULL DEFAULT false,
  kickoff TEXT,
  league TEXT,
  result TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.betting_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders can manage betting selections"
ON public.betting_selections
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'founder'::app_role))
WITH CHECK (has_role(auth.uid(), 'founder'::app_role));

CREATE TRIGGER update_betting_slips_updated_at
BEFORE UPDATE ON public.betting_slips
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
