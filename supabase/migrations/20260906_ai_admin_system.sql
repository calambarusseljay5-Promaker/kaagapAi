-- ============================================================
-- KAAGAPAI: AI ADMIN SYSTEM (LOGS, SETTINGS & VERSIONING)
-- ============================================================

-- 1. AI Logs Table (Questions, Answers, Failed Queries, Unanswered Questions)
CREATE TABLE IF NOT EXISTS public.ai_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    resident_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resident_name TEXT DEFAULT 'Resident',
    question TEXT NOT NULL,
    answer TEXT,
    status VARCHAR(30) DEFAULT 'success', -- 'success', 'failed', 'unanswered'
    is_unanswered BOOLEAN DEFAULT FALSE,
    source VARCHAR(50) DEFAULT 'Resident Portal', -- 'Resident Portal', 'AI Playground', 'Admin Widget'
    model VARCHAR(100) DEFAULT 'qwen/qwen3.8-27b',
    duration_ms INTEGER DEFAULT 0,
    matched_knowledge TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast log filtering by status and date
CREATE INDEX IF NOT EXISTS ai_logs_status_idx ON public.ai_logs(status);
CREATE INDEX IF NOT EXISTS ai_logs_created_at_idx ON public.ai_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS ai_logs_is_unanswered_idx ON public.ai_logs(is_unanswered);

-- 2. AI Settings Table (System Prompt, AI Behavior, Safety Rules)
CREATE TABLE IF NOT EXISTS public.ai_settings (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'default',
    system_prompt TEXT,
    custom_instructions TEXT,
    model_provider VARCHAR(50) DEFAULT 'groq', -- 'groq', 'gemini'
    model_name VARCHAR(100) DEFAULT 'qwen/qwen3.8-27b',
    temperature FLOAT DEFAULT 0.2,
    max_tokens INTEGER DEFAULT 2048,
    tone VARCHAR(50) DEFAULT 'Taglish / Professional',
    profanity_filter_enabled BOOLEAN DEFAULT TRUE,
    anti_hallucination_enabled BOOLEAN DEFAULT TRUE,
    data_privacy_enabled BOOLEAN DEFAULT TRUE,
    custom_banned_words TEXT[] DEFAULT ARRAY[]::TEXT[],
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings row if not exists
INSERT INTO public.ai_settings (id, model_provider, model_name, temperature, tone, profanity_filter_enabled, anti_hallucination_enabled, data_privacy_enabled)
VALUES ('default', 'groq', 'qwen/qwen3.8-27b', 0.2, 'Taglish / Professional', TRUE, TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 3. AI Knowledge Version History Table (Detailed Rollback & Audit)
CREATE TABLE IF NOT EXISTS public.ai_knowledge_versions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    knowledge_id BIGINT REFERENCES public.ai_knowledge(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    audience TEXT DEFAULT 'All Residents',
    content TEXT NOT NULL,
    version VARCHAR(20) NOT NULL,
    change_summary TEXT DEFAULT 'Content update',
    created_by TEXT DEFAULT 'Admin',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_knowledge_versions_knowledge_id_idx ON public.ai_knowledge_versions(knowledge_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.ai_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_knowledge_versions ENABLE ROW LEVEL SECURITY;

-- Allow read/write for authenticated users (Admin)
CREATE POLICY "Allow authenticated full access on ai_logs"
ON public.ai_logs FOR ALL
TO authenticated
USING (TRUE)
WITH CHECK (TRUE);

-- Allow public or resident insert to ai_logs for question tracking
CREATE POLICY "Allow public insert on ai_logs"
ON public.ai_logs FOR INSERT
TO anon, authenticated
WITH CHECK (TRUE);

CREATE POLICY "Allow public read on ai_settings"
ON public.ai_settings FOR SELECT
TO anon, authenticated
USING (TRUE);

CREATE POLICY "Allow authenticated manage on ai_settings"
ON public.ai_settings FOR ALL
TO authenticated
USING (TRUE)
WITH CHECK (TRUE);

CREATE POLICY "Allow authenticated manage on ai_knowledge_versions"
ON public.ai_knowledge_versions FOR ALL
TO authenticated
USING (TRUE)
WITH CHECK (TRUE);
