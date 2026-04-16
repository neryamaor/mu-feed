-- search_videos: full-text search across titles, tags, Arabic words, and translations.
--
-- Returns published videos where search_query matches any of:
--   videos.title
--   tags.name                        (via video_tags)
--   dictionary_entries.arabic_text   (via segment_words → segments)
--   translations.hebrew_translation  (via dictionary_entries → segment_words → segments)
--   translations.transliteration     (same path)
--
-- SQL-injection safety: search_query is a bound function parameter, not string-
-- concatenated into the query text. PL/pgSQL passes it as a value to the ILIKE
-- operator, so no escaping or sanitisation is needed at the call site.
--
-- ILIKE '%…%' leverages the existing gin_trgm indexes on all five columns.
-- DISTINCT deduplicates videos matched by multiple paths.
-- LIMIT 50 caps result size; prevents memory pressure when common words like
-- "في" would otherwise return the entire published catalogue.
-- Returns SETOF videos so PostgREST can chain .select() to add category data.
--
-- Run this in Supabase SQL Editor before using the search screen.

CREATE OR REPLACE FUNCTION search_videos(search_query text)
RETURNS SETOF videos AS $$
  SELECT DISTINCT v.*
  FROM videos v
  WHERE v.status = 'published'
    AND (
      -- 1. Video title
      v.title ILIKE '%' || search_query || '%'

      -- 2. Tag name
      OR EXISTS (
        SELECT 1
        FROM video_tags vt
        JOIN tags t ON t.id = vt.tag_id
        WHERE vt.video_id = v.id
          AND t.name ILIKE '%' || search_query || '%'
      )

      -- 3. Arabic word / phrase (dictionary_entries.arabic_text)
      OR EXISTS (
        SELECT 1
        FROM segments seg
        JOIN segment_words sw ON sw.segment_id = seg.id
        JOIN dictionary_entries de ON de.id = sw.dictionary_entry_id
        WHERE seg.video_id = v.id
          AND de.arabic_text ILIKE '%' || search_query || '%'
      )

      -- 4. Hebrew translation or transliteration
      OR EXISTS (
        SELECT 1
        FROM segments seg
        JOIN segment_words sw ON sw.segment_id = seg.id
        JOIN dictionary_entries de ON de.id = sw.dictionary_entry_id
        JOIN translations tr ON tr.entry_id = de.id
        WHERE seg.video_id = v.id
          AND (   tr.hebrew_translation ILIKE '%' || search_query || '%'
               OR tr.transliteration    ILIKE '%' || search_query || '%')
      )
    )
  ORDER BY v.published_at DESC
  LIMIT 50;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
