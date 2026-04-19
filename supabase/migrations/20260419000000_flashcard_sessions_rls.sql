-- flashcard_sessions: add UNIQUE constraint + RLS policies
--
-- The SCHEMA.sql has no UNIQUE constraint on (user_id, dictionary_entry_id),
-- which prevents a clean SELECT-then-UPDATE/INSERT pattern. This migration
-- adds the constraint and enables RLS so user writes are properly scoped.
--
-- Matches the same pattern used in 20260418155744_add_video_favorites.sql.

-- One stats row per (user, word) pair.
ALTER TABLE flashcard_sessions
  ADD CONSTRAINT flashcard_sessions_user_entry_unique
  UNIQUE (user_id, dictionary_entry_id);

-- Enable RLS (off by default in SCHEMA.sql for this table).
ALTER TABLE flashcard_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own flashcard sessions"
  ON flashcard_sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own flashcard sessions"
  ON flashcard_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own flashcard sessions"
  ON flashcard_sessions FOR UPDATE
  USING (user_id = auth.uid());
