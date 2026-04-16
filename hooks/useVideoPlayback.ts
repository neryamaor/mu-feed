// useVideoPlayback — feed-level playback state shared across all videos.
//
// All three values here are intentionally feed-level (not per-video) so they
// persist as the user scrolls between videos:
//
//   isMuted:         sound on by default (false), per PRD §6.1.
//   subtitlesVisible: shown by default (true). Hide is visual-only — useSubtitles
//                    continues tracking the active segment so subtitles restore
//                    instantly without a re-fetch. See ARCHITECTURE.md §5.6.
//   subtitleMode:    Arabic / transliteration / both. Lives here (not in
//                    useSubtitles) so the user's chosen mode persists across
//                    videos — each new FeedVideoItem inherits the last selection.

import { useState, useCallback } from 'react';
import type { SubtitleMode } from '../types';

export function useVideoPlayback() {
  const [isMuted, setIsMuted] = useState(false);
  const [subtitlesVisible, setSubtitlesVisible] = useState(true);
  const [subtitleMode, setSubtitleMode] = useState<SubtitleMode>('arabic');

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const toggleSubtitles = useCallback(() => {
    setSubtitlesVisible((prev) => !prev);
  }, []);

  return {
    isMuted,
    toggleMute,
    subtitlesVisible,
    toggleSubtitles,
    subtitleMode,
    setSubtitleMode,
  };
}
