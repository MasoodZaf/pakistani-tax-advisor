-- AI Consultant: per-user conversations + messages.
-- Apply: psql -d tax_advisor -f backend/database/migrations/add-ai-consultant-tables.sql
-- Idempotent: re-runs are safe.

BEGIN;

CREATE TABLE IF NOT EXISTS ai_conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT 'New conversation',
  include_pii   BOOLEAN NOT NULL DEFAULT FALSE,
  archived      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user
  ON ai_conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
  content         TEXT NOT NULL,
  tokens_prompt   INTEGER,
  tokens_output   INTEGER,
  model           TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation
  ON ai_messages(conversation_id, created_at ASC);

-- Bump updated_at on conversation when a new message arrives.
CREATE OR REPLACE FUNCTION touch_ai_conversation()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ai_conversations
     SET updated_at = NOW()
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_ai_conversation ON ai_messages;
CREATE TRIGGER trg_touch_ai_conversation
AFTER INSERT ON ai_messages
FOR EACH ROW EXECUTE FUNCTION touch_ai_conversation();

COMMIT;
