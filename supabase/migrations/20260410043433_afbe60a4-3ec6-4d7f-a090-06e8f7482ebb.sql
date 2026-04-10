
-- CEO Contacts
CREATE TABLE public.ceo_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  role TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ceo_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Founders can manage ceo_contacts" ON public.ceo_contacts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder')) WITH CHECK (public.has_role(auth.uid(), 'founder'));
CREATE TRIGGER update_ceo_contacts_updated_at BEFORE UPDATE ON public.ceo_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CEO Todos
CREATE TABLE public.ceo_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date DATE,
  is_done BOOLEAN NOT NULL DEFAULT false,
  category TEXT NOT NULL DEFAULT 'General',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ceo_todos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Founders can manage ceo_todos" ON public.ceo_todos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder')) WITH CHECK (public.has_role(auth.uid(), 'founder'));
CREATE TRIGGER update_ceo_todos_updated_at BEFORE UPDATE ON public.ceo_todos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CEO Notes (Notepad)
CREATE TABLE public.ceo_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Untitled',
  content TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ceo_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Founders can manage ceo_notes" ON public.ceo_notes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder')) WITH CHECK (public.has_role(auth.uid(), 'founder'));
CREATE TRIGGER update_ceo_notes_updated_at BEFORE UPDATE ON public.ceo_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Touring & Travel Log
CREATE TABLE public.touring_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  artist_name TEXT,
  venue TEXT,
  city TEXT,
  country TEXT NOT NULL DEFAULT 'South Africa',
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'Planned',
  budget NUMERIC DEFAULT 0,
  actual_cost NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.touring_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Founders can manage touring_log" ON public.touring_log FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder')) WITH CHECK (public.has_role(auth.uid(), 'founder'));
CREATE TRIGGER update_touring_log_updated_at BEFORE UPDATE ON public.touring_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AI Chat Conversations
CREATE TABLE public.ai_chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_chat_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Founders can manage ai_chat_conversations" ON public.ai_chat_conversations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder')) WITH CHECK (public.has_role(auth.uid(), 'founder'));
CREATE TRIGGER update_ai_chat_conversations_updated_at BEFORE UPDATE ON public.ai_chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AI Chat Messages
CREATE TABLE public.ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Founders can manage ai_chat_messages" ON public.ai_chat_messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder')) WITH CHECK (public.has_role(auth.uid(), 'founder'));

-- Subscriptions Tracker
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL,
  description TEXT,
  cost NUMERIC NOT NULL DEFAULT 0,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  start_date DATE,
  expiry_date DATE,
  auto_renew BOOLEAN NOT NULL DEFAULT false,
  reminder_days INTEGER NOT NULL DEFAULT 7,
  status TEXT NOT NULL DEFAULT 'active',
  category TEXT NOT NULL DEFAULT 'Software',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Founders can manage subscriptions" ON public.subscriptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'founder')) WITH CHECK (public.has_role(auth.uid(), 'founder'));
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
