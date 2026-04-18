-- Add optional source credit field to videos.
-- Nullable — existing rows stay unaffected.

ALTER TABLE videos ADD COLUMN source_credit text;
