-- video_favorites — lets users bookmark videos for later viewing.
-- UNIQUE (user_id, video_id) prevents duplicate saves.
-- RLS policies restrict all operations to the row owner (user_id = auth.uid()).

CREATE TABLE video_favorites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id   uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  saved_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, video_id)
);

CREATE INDEX idx_video_favorites_user_id ON video_favorites (user_id);

-- Enable RLS
ALTER TABLE video_favorites ENABLE ROW LEVEL SECURITY;

-- Users can read their own favorites
CREATE POLICY "users can select own favorites"
  ON video_favorites FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own favorites
CREATE POLICY "users can insert own favorites"
  ON video_favorites FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own favorites
CREATE POLICY "users can delete own favorites"
  ON video_favorites FOR DELETE
  USING (user_id = auth.uid());
