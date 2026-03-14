-- ── Divido Chatbot — Database Schema ────────────────────────────────────────
-- This file runs automatically on first `docker-compose up`
-- Safe to re-run — all statements use IF NOT EXISTS

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Knowledge Items ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_items (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    title              TEXT        NOT NULL,
    content            TEXT        NOT NULL,
    source_type        TEXT        NOT NULL CHECK (source_type IN ('canonical_doc', 'website')),
    source_name        TEXT        NOT NULL,
    topic              TEXT,
    intent_categories  TEXT[]      DEFAULT '{}',
    priority           INTEGER     DEFAULT 2,
    approved           BOOLEAN     DEFAULT TRUE,
    embedding          vector(768),
    updated_at         TIMESTAMP   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_embedding
    ON knowledge_items USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_knowledge_priority
    ON knowledge_items (priority ASC);

CREATE INDEX IF NOT EXISTS idx_knowledge_approved
    ON knowledge_items (approved);

-- ── Conversation Logs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversation_logs (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id              TEXT        NOT NULL,
    user_message            TEXT        NOT NULL,
    detected_intent         TEXT,
    retrieved_knowledge_ids TEXT[]      DEFAULT '{}',
    response_text           TEXT,
    clicked_buttons         TEXT[]      DEFAULT '{}',
    fallback_event          BOOLEAN     DEFAULT FALSE,
    created_at              TIMESTAMP   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_session
    ON conversation_logs (session_id);

CREATE INDEX IF NOT EXISTS idx_logs_created
    ON conversation_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_logs_intent
    ON conversation_logs (detected_intent);

CREATE INDEX IF NOT EXISTS idx_logs_fallback
    ON conversation_logs (fallback_event)
    WHERE fallback_event = TRUE;

-- ── Leads ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT        NOT NULL,
    email           TEXT        NOT NULL,
    phone           TEXT,
    session_id      TEXT,
    context_message TEXT,
    contacted       BOOLEAN     DEFAULT FALSE,
    created_at      TIMESTAMP   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_contacted
    ON leads (contacted);

CREATE INDEX IF NOT EXISTS idx_leads_created
    ON leads (created_at DESC);

-- ── Response Cache ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS response_cache (
    id            UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    message_hash  TEXT      UNIQUE NOT NULL,
    response_text TEXT      NOT NULL,
    hit_count     INTEGER   DEFAULT 0,
    created_at    TIMESTAMP DEFAULT NOW(),
    last_used_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cache_hash
    ON response_cache (message_hash);

CREATE INDEX IF NOT EXISTS idx_cache_created
    ON response_cache (created_at DESC);