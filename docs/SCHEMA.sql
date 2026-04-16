-- ============================================================
-- Palestinian Spoken Arabic Learning App
-- Database Schema for Supabase (PostgreSQL)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- USER TABLES (must come first)
-- ============================================================

-- Extends Supabase's built-in auth.users with app-specific fields
CREATE TABLE users (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL UNIQUE,
  level      text NOT NULL DEFAULT 'beginner',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_permissions (
  user_id     uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  can_upload  boolean NOT NULL DEFAULT false,
  can_edit    boolean NOT NULL DEFAULT false,
  can_delete  boolean NOT NULL DEFAULT false,
  granted_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- CONTENT TABLES
-- ============================================================

CREATE TABLE videos (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title            text NOT NULL,
  url              text NOT NULL,
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  uploaded_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  difficulty_level int CHECK (difficulty_level BETWEEN 1 AND 5),
  published_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE
);

CREATE TABLE video_categories (
  video_id    uuid REFERENCES videos(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (video_id, category_id)
);

CREATE TABLE tags (
  id   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE
);

CREATE TABLE video_tags (
  video_id uuid REFERENCES videos(id) ON DELETE CASCADE,
  tag_id   uuid REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (video_id, tag_id)
);

CREATE TABLE segments (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id    uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  start_time  float NOT NULL,
  end_time    float NOT NULL,
  arabic_text text NOT NULL,
  order_index int NOT NULL
);

CREATE TABLE dictionary_entries (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  arabic_text text NOT NULL,
  is_phrase   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE translations (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id            uuid NOT NULL REFERENCES dictionary_entries(id) ON DELETE CASCADE,
  hebrew_translation  text NOT NULL,
  transliteration     text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE segment_words (
  id                     uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  segment_id             uuid NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  dictionary_entry_id    uuid NOT NULL REFERENCES dictionary_entries(id),
  context_translation_id uuid REFERENCES translations(id),
  word_position          int NOT NULL
);

CREATE TABLE grammar_rules (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title      text NOT NULL,
  category   text NOT NULL,
  content    text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE personal_dictionary (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dictionary_entry_id uuid NOT NULL REFERENCES dictionary_entries(id) ON DELETE CASCADE,
  saved_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, dictionary_entry_id)
);

CREATE TABLE flashcard_sessions (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dictionary_entry_id uuid NOT NULL REFERENCES dictionary_entries(id) ON DELETE CASCADE,
  times_shown         int NOT NULL DEFAULT 0,
  times_correct       int NOT NULL DEFAULT 0,
  last_shown_at       timestamptz
);

-- ============================================================
-- SEARCH INDEXES (pg_trgm)
-- ============================================================

-- Video title search
CREATE INDEX idx_videos_title_trgm
  ON videos USING gin (title gin_trgm_ops);

-- Tag name search
CREATE INDEX idx_tags_name_trgm
  ON tags USING gin (name gin_trgm_ops);

-- Arabic word/phrase search
CREATE INDEX idx_dictionary_entries_arabic_trgm
  ON dictionary_entries USING gin (arabic_text gin_trgm_ops);

-- Hebrew translation search
CREATE INDEX idx_translations_hebrew_trgm
  ON translations USING gin (hebrew_translation gin_trgm_ops);

-- Transliteration search
CREATE INDEX idx_translations_transliteration_trgm
  ON translations USING gin (transliteration gin_trgm_ops);

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================

-- Fetch all segments for a video in order
CREATE INDEX idx_segments_video_id
  ON segments (video_id, order_index);

-- Fetch all words in a segment in order
CREATE INDEX idx_segment_words_segment_id
  ON segment_words (segment_id, word_position);

-- Fetch all translations for a dictionary entry
CREATE INDEX idx_translations_entry_id
  ON translations (entry_id);

-- Fetch user's personal dictionary
CREATE INDEX idx_personal_dictionary_user_id
  ON personal_dictionary (user_id);

-- Fetch user's flashcard sessions
CREATE INDEX idx_flashcard_sessions_user_id
  ON flashcard_sessions (user_id);