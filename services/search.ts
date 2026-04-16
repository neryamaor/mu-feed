// Search service — ALL search logic lives here exclusively.
//
// This is the single entry point for all search queries. Keeping it isolated
// means the Phase 3 migration from pg_trgm to Elasticsearch only touches this
// file. No other component or screen should contain search queries.
//
// Implementation: delegates to the `search_videos` PostgreSQL function via
// Supabase RPC. The function searches across five fields using ILIKE + gin_trgm
// indexes: videos.title, tags.name, dictionary_entries.arabic_text,
// translations.hebrew_translation, translations.transliteration.
//
// The `.select()` chained on the RPC adds video_categories in the same round-
// trip — PostgREST supports this because the function returns SETOF videos.
//
// Prerequisite: run supabase/migrations/20260415000000_search_videos_fn.sql
// in Supabase SQL Editor before this function will work.

import { supabase } from './supabase';
import type { FeedVideo } from '../types';

/**
 * Search published videos by title, tag, Arabic word, Hebrew translation,
 * or transliteration. Returns up to 50 results ordered by published_at DESC.
 *
 * Returns [] for queries shorter than 2 characters (no network call made).
 * Never throws — logs errors and returns [] on failure.
 */
export async function searchVideos(query: string): Promise<FeedVideo[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const { data, error } = await supabase
    .rpc('search_videos', { search_query: q })
    .select('*, video_categories(categories(id, name))');

  if (error) {
    console.error('[search] searchVideos failed:', error.message);
    return [];
  }

  return (data as FeedVideo[]) ?? [];
}
