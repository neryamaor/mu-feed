// Favorites service — all logic for saving and fetching user video favorites.
//
// Uses supabase.auth.getUser() internally so callers never need to pass userId.
// UNIQUE constraint on (user_id, video_id) makes duplicate saves a no-op.

import { supabase } from './supabase';
import type { VideoFavorite } from '../types';

/**
 * Returns the set of video IDs the current user has favorited.
 * Used by the feed screen to initialise per-video heart state.
 */
export async function getFavoritedVideoIds(): Promise<Set<string>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data } = await supabase
    .from('video_favorites')
    .select('video_id')
    .eq('user_id', user.id);

  return new Set(((data ?? []) as { video_id: string }[]).map((r) => r.video_id));
}

/**
 * Toggles favorite state for a video.
 * Returns true if the video is now favorited, false if it was removed.
 */
export async function toggleFavorite(videoId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check current state
  const { data: existing } = await supabase
    .from('video_favorites')
    .select('id')
    .eq('user_id', user.id)
    .eq('video_id', videoId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('video_favorites')
      .delete()
      .eq('id', (existing as { id: string }).id)
      .throwOnError();
    return false;
  } else {
    await supabase
      .from('video_favorites')
      .insert({ user_id: user.id, video_id: videoId })
      .throwOnError();
    return true;
  }
}

/**
 * Returns the current user's favorited videos with title and saved_at,
 * ordered by most recently saved first.
 */
export async function getUserFavorites(): Promise<VideoFavorite[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('video_favorites')
    .select(`
      id,
      video_id,
      saved_at,
      videos ( id, title, url, status )
    `)
    .eq('user_id', user.id)
    .order('saved_at', { ascending: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const video = row.videos as { id: string; title: string; url: string; status: string } | null;
    return {
      id: row.id as string,
      userId: user.id,
      videoId: row.video_id as string,
      savedAt: row.saved_at as string,
      videoTitle: video?.title ?? '',
      videoUrl: video?.url ?? '',
    };
  });
}
