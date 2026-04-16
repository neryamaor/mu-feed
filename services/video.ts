// Video service — Mux integration.
//
// SECTION 1: URL helpers — safe to import in React Native.
//   videos.url stores the Mux playback ID (not the full HLS URL).
//   These functions derive the stream URL and thumbnail URL from it.
//
// SECTION 2: Upload functions — server-side only (Supabase Edge Function).
//   Uses @mux/mux-node. DO NOT import this section in React Native bundles.
//   Implementation deferred to Task 1.8 (admin upload workflow).

// ─── Section 1: Client-safe URL helpers ──────────────────────────────────────

/**
 * Returns the HLS streaming URL for a given Mux playback ID.
 * The playback ID is stored in videos.url in Supabase.
 */
export function getMuxStreamUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

/**
 * Returns a thumbnail image URL for a given Mux playback ID.
 * @param playbackId  The Mux playback ID (stored in videos.url).
 * @param timeSeconds Timestamp in the video to grab the thumbnail from (default 3s).
 */
export function getMuxThumbnailUrl(playbackId: string, timeSeconds = 3): string {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?width=640&time=${timeSeconds}`;
}

// ─── Section 2: Admin upload helpers (Task 1.8) ───────────────────────────────
//
// These functions call the `mux-upload` Supabase Edge Function, which holds
// the Mux API credentials server-side. Safe to import in React Native.

import { supabase, invokeFn } from './supabase';

/**
 * Asks the mux-upload Edge Function to create a Mux Direct Upload URL.
 * Returns the upload URL (for PUT) and the upload ID (for polling).
 *
 * Calls the function via raw fetch with explicit apikey header so the request
 * works regardless of whether the Supabase anon key is in the legacy JWT
 * (HS256) or new publishable (ES256) format.  The Edge Functions are deployed
 * with --no-verify-jwt so Supabase does not try to parse the token itself.
 */
export async function requestMuxUpload(): Promise<{ uploadUrl: string; uploadId: string }> {
  const { data, error } = await invokeFn('mux-upload', { action: 'create' });
  if (error) throw error;
  return data as { uploadUrl: string; uploadId: string };
}

/**
 * Uploads the video file directly to Mux via the signed PUT URL.
 * No credentials required — the URL itself is the auth token.
 */
export async function uploadFileToMux(uploadUrl: string, fileUri: string): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4' },
    // React Native: pass an object with uri/type/name as the body.
    // The fetch polyfill reads the file from the device.
    body: { uri: fileUri, type: 'video/mp4', name: 'upload.mp4' } as unknown as BodyInit,
  });
  if (!res.ok) {
    throw new Error(`uploadFileToMux failed: HTTP ${res.status}`);
  }
}

/**
 * Polls the mux-upload Edge Function until the Mux playback ID is ready.
 * Retries up to 30 times with a 2-second interval (60 s total).
 * Throws if the playback ID is not available within the retry window.
 */
export async function pollMuxPlaybackId(uploadId: string): Promise<string> {
  const MAX_ATTEMPTS = 30;
  const DELAY_MS = 2000;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data, error } = await invokeFn('mux-upload', { action: 'poll', uploadId });
    if (error) throw new Error(`pollMuxPlaybackId failed: ${error.message}`);

    const { playbackId } = data as { playbackId: string | null };
    if (playbackId) return playbackId;

    // Wait before the next attempt (except on the last iteration).
    if (attempt < MAX_ATTEMPTS - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  throw new Error('Mux playback ID not ready after 60 seconds — try again.');
}

/**
 * Creates a draft video record in Supabase.
 * videos.url stores the Mux playback ID (used by getMuxStreamUrl).
 * Returns the new video's UUID.
 */
export async function saveDraftVideo(
  title: string,
  playbackId: string,
  uploadedBy: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('videos')
    .insert({ title, url: playbackId, status: 'draft', uploaded_by: uploadedBy })
    .select('id')
    .single();

  if (error) throw new Error(`saveDraftVideo failed: ${error.message}`);
  return (data as { id: string }).id;
}
