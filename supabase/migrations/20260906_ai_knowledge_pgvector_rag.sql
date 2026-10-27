-- ============================================================
-- KAAGAPAI: SUPABASE PGVECTOR, RAG & KNOWLEDGE VERSIONING SETUP
-- ============================================================

-- 1. Enable pgvector extension in extensions schema
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2. Upgrade / Create ai_knowledge table with version control & status
CREATE TABLE IF NOT EXISTS public.ai_knowledge (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    audience TEXT DEFAULT 'All Residents',
    content TEXT NOT NULL,
    source_file TEXT,
    source_type TEXT DEFAULT 'manual',
    version VARCHAR(20) DEFAULT '1.0',
    status VARCHAR(20) DEFAULT 'Active', -- Active, Draft, Archived
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure required columns exist if table was already created
ALTER TABLE public.ai_knowledge ADD COLUMN IF NOT EXISTS version VARCHAR(20) DEFAULT '1.0';
ALTER TABLE public.ai_knowledge ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.ai_knowledge ADD COLUMN IF NOT EXISTS source_file TEXT;
ALTER TABLE public.ai_knowledge ADD COLUMN IF NOT EXISTS audience TEXT DEFAULT 'All Residents';
ALTER TABLE public.ai_knowledge ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual';

-- 3. Create semantic chunks table with 768-dimension vector for Gemini text-embedding-004
CREATE TABLE IF NOT EXISTS public.ai_knowledge_chunks (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    knowledge_id BIGINT REFERENCES public.ai_knowledge(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding extensions.vector(768),
    chunk_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create HNSW Vector Index for ultra-fast semantic similarity search
CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_embedding_idx 
ON public.ai_knowledge_chunks 
USING hnsw (embedding extensions.vector_cosine_ops);

-- 5. RPC Function: match_knowledge_chunks (Semantic RAG Retrieval)
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
    query_embedding extensions.vector(768),
    match_threshold FLOAT DEFAULT 0.60,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id BIGINT,
    knowledge_id BIGINT,
    title TEXT,
    category TEXT,
    content TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.knowledge_id,
        k.title,
        k.category,
        c.content,
        (1 - (c.embedding <=> query_embedding))::FLOAT AS similarity
    FROM public.ai_knowledge_chunks c
    JOIN public.ai_knowledge k ON c.knowledge_id = k.id
    WHERE k.is_active = TRUE
      AND (k.status = 'Active' OR k.status = 'Approved')
      AND (1 - (c.embedding <=> query_embedding)) >= match_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.ai_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated and anonymous users to active knowledge
CREATE POLICY "Allow public read on active knowledge"
ON public.ai_knowledge FOR SELECT
TO anon, authenticated
USING (is_active = TRUE);

CREATE POLICY "Allow public read on active chunks"
ON public.ai_knowledge_chunks FOR SELECT
TO anon, authenticated
USING (TRUE);

-- Allow full management for authenticated users (Admin)
CREATE POLICY "Allow authenticated insert knowledge"
ON public.ai_knowledge FOR ALL
TO authenticated
USING (TRUE)
WITH CHECK (TRUE);

CREATE POLICY "Allow authenticated insert chunks"
ON public.ai_knowledge_chunks FOR ALL
TO authenticated
USING (TRUE)
WITH CHECK (TRUE);
