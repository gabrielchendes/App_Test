-- ==============================================================================
-- SCHEMA SUPABASE: TABELAS DEDICADAS PARA A EXPERT IA
-- ==============================================================================
-- Execute este script no SQL Editor do seu painel Supabase para criar as tabelas
-- dedicadas com índices de alta performance para o chat e a memória dos alunos.
-- ==============================================================================

-- 1. Tabela Dedicada para Mensagens da Expert IA
CREATE TABLE IF NOT EXISTS public.ai_chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_email TEXT,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    timestamp TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de Alta Performance para busca instantânea por aluno
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_user_created ON public.ai_chat_messages (user_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ai_chat_messages_email_created ON public.ai_chat_messages (user_email, created_at ASC);

-- 2. Tabela Dedicada para a Memória de Fatos do Aluno (User Memory Profile)
CREATE TABLE IF NOT EXISTS public.ai_user_memory (
    user_id TEXT PRIMARY KEY,
    user_email TEXT,
    user_name TEXT,
    partner_name TEXT,
    relationship_status TEXT,
    facts JSONB DEFAULT '[]'::jsonb,
    topics JSONB DEFAULT '[]'::jsonb,
    recent_advice JSONB DEFAULT '[]'::jsonb,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Índice por email para recuperação de memória por email
CREATE INDEX IF NOT EXISTS idx_ai_user_memory_email ON public.ai_user_memory (user_email);

-- 3. Habilitar Row Level Security (RLS) e Políticas de Acesso
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_user_memory ENABLE ROW LEVEL SECURITY;

-- Políticas para permitir leitura e escrita pela aplicação
DROP POLICY IF EXISTS "Allow all access to ai_chat_messages" ON public.ai_chat_messages;
CREATE POLICY "Allow all access to ai_chat_messages"
    ON public.ai_chat_messages
    FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to ai_user_memory" ON public.ai_user_memory;
CREATE POLICY "Allow all access to ai_user_memory"
    ON public.ai_user_memory
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 4. Conceder permissões para os papéis anon, authenticated e service_role
GRANT ALL ON TABLE public.ai_chat_messages TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.ai_user_memory TO anon, authenticated, service_role;
