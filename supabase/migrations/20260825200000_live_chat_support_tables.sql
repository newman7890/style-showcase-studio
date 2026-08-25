-- Database Migration for Smart Live Chat Support System (AI + Admin Escalation)
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL DEFAULT 'Guest Customer',
  customer_email TEXT,
  status TEXT NOT NULL DEFAULT 'ai_active' CHECK (status IN ('ai_active', 'escalated', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'assistant', 'admin')),
  sender_name TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies for chat_sessions
CREATE POLICY "Public and users can manage own chat sessions"
  ON public.chat_sessions
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Policies for chat_messages
CREATE POLICY "Public and users can manage chat messages"
  ON public.chat_messages
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Enable Supabase Realtime for chat_messages & chat_sessions
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE public.chat_messages, public.chat_sessions;
COMMIT;

-- Indexes for fast query performance
CREATE INDEX IF NOT EXISTS chat_messages_session_id_idx ON public.chat_messages(session_id);
CREATE INDEX IF NOT EXISTS chat_sessions_status_idx ON public.chat_sessions(status);
