// useSubtitles — fetches and tracks subtitle segments for a single video.
//
// Fetches all segments + words once when the video ID is first seen, then
// exposes a stable getActiveSegment() function that the caller polls with
// the current playback time to find which segment is on screen.
//
// Data is never re-fetched for the same videoId. This hook continues running
// even when subtitles are visually hidden (see ARCHITECTURE.md §5.6 and
// CLAUDE.md) so subtitles can be restored instantly without a re-fetch.
//
// subtitleMode (Arabic / transliteration / both) intentionally does NOT live
// here — it lives in useVideoPlayback so the user's selection persists across
// videos. This hook is purely responsible for data fetching and segment lookup.
//
// Supabase join notes:
//   segment_words.dictionary_entry_id → dictionary_entries  (forward FK → single obj)
//   segment_words.context_translation_id → translations     (forward FK → single obj, nullable)
// The !column_name hints make the FK usage explicit and avoid ambiguity.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import type { SegmentWithWords } from '../types';

export function useSubtitles(videoId: string) {
  const [segments, setSegments] = useState<SegmentWithWords[]>([]);

  useEffect(() => {
    if (!videoId) return;

    supabase
      .from('segments')
      .select(
        `
        id, video_id, start_time, end_time, arabic_text, order_index,
        segment_words (
          id, segment_id, word_position, dictionary_entry_id, context_translation_id,
          dictionary_entries!dictionary_entry_id ( arabic_text, is_phrase ),
          translations!context_translation_id ( transliteration, hebrew_translation )
        )
      `,
      )
      .eq('video_id', videoId)
      .order('order_index')
      .then(({ data, error }) => {
        if (error) {
          console.error('[useSubtitles] Failed to fetch segments:', error.message);
          return;
        }
        if (data) {
          // Sort words within each segment by position (Supabase doesn't
          // guarantee nested array order).
          const sorted = (data as SegmentWithWords[]).map((s) => ({
            ...s,
            segment_words: [...s.segment_words].sort(
              (a, b) => a.word_position - b.word_position,
            ),
          }));
          setSegments(sorted);
        }
      });
  }, [videoId]);

  // getActiveSegment is a stable function (only re-created when segment data
  // changes after the initial fetch). The caller polls this with currentTime
  // every ~100ms; keeping it stable avoids unnecessary effect re-runs.
  const getActiveSegment = useCallback(
    (currentTime: number) =>
      segments.find((s) => currentTime >= s.start_time && currentTime < s.end_time) ?? null,
    [segments],
  );

  return { getActiveSegment };
}
