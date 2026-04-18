// FeedVideoItem — a single full-screen video item in the TikTok-style feed.
// Encapsulates: video playback, subtitle overlay, action overlay.
// Word tooltip is added in Task 1.5.
//
// Native implementation — uses expo-video.
// Web: Metro resolves FeedVideoItem.web.tsx instead (HLS.js + DOM <video>).
//
// ─── Play/pause state machine ─────────────────────────────────────────────────
//
//   isActive        feed-level: this item is the visible video in the FlatList
//   isManuallyPaused user tapped the video area to pause (TikTok-style toggle)
//   isWordTapPaused  user tapped a subtitle word (pauses for upcoming tooltip)
//
//   Video plays only when:  isActive && !isManuallyPaused && !isWordTapPaused
//   On isActive=false:      both pause flags reset → next visit starts fresh
//
// ─── Video-tap vs word-tap (issue 1 / 6) ─────────────────────────────────────
//
//   Tap on video area  (Pressable, z=1):
//     → if word-paused: clear word-pause (one tap = one action, no double toggle)
//     → otherwise:      toggle isManuallyPaused
//
//   Tap on a word (TouchableOpacity inside SubtitleOverlay, z=2):
//     → sets isWordTapPaused=true
//     → does NOT reach the Pressable below (React Native responder system)
//
// ─── Interval cleanup (issue 5) ──────────────────────────────────────────────
//
//   Every setInterval has an explicit clearInterval in the same useEffect's
//   return function. Early-return paths produce no interval, so no cleanup is
//   needed for them. React always calls the previous cleanup before re-running.
//
// ─── Subtitle settings (issue 7) ─────────────────────────────────────────────
//
//   subtitleMode and subtitlesVisible are NOT local state — they come from the
//   parent feed (via useVideoPlayback) so they persist across videos.

import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Pressable } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useRouter } from 'expo-router';
import { getMuxStreamUrl } from '../services/video';
import { useSubtitles } from '../hooks/useSubtitles';
import FeedActionOverlay from './FeedActionOverlay';
import SubtitleOverlay from './SubtitleOverlay';
import WordTooltip from './WordTooltip';
import type { WordButtonPosition } from './SubtitleOverlay';
import type { FeedVideo, SegmentWordWithDetails, SubtitleMode } from '../types';

interface Props {
  video: FeedVideo;
  /** True when this item is the visible video in the feed. */
  isActive: boolean;
  isMuted: boolean;
  onMuteToggle: () => void;
  subtitlesVisible: boolean;
  onSubtitlesToggle: () => void;
  /** Feed-level subtitle mode — persists across videos (lives in useVideoPlayback). */
  subtitleMode: SubtitleMode;
  onModeChange: (mode: SubtitleMode) => void;
  /** When true, renders a small "Edit" button that navigates to the admin edit screen. */
  isAdmin?: boolean;
  isFavorited?: boolean;
  onFavoriteToggle?: () => void;
}

export default function FeedVideoItem({
  video,
  isActive,
  isMuted,
  onMuteToggle,
  subtitlesVisible,
  onSubtitlesToggle,
  subtitleMode,
  onModeChange,
  isAdmin = false,
  isFavorited = false,
  onFavoriteToggle,
}: Props) {
  const router = useRouter();
  // useWindowDimensions is the single source of truth for screen height.
  // snapToInterval in the FlatList uses the same value → reliable Android snap.
  const { width, height } = useWindowDimensions();

  const [currentTime, setCurrentTime] = useState(0);
  // User tapped the video area to pause (TikTok-style manual toggle).
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  // User tapped a subtitle word — paused to show tooltip.
  const [isWordTapPaused, setIsWordTapPaused] = useState(false);
  // The word currently shown in the tooltip (null = tooltip closed).
  const [tappedWord, setTappedWord] = useState<SegmentWordWithDetails | null>(null);
  // Screen coordinates of the tapped word — used to position the tooltip card.
  const [tappedWordPosition, setTappedWordPosition] = useState<WordButtonPosition | null>(null);
  // Credit popup open state.
  const [creditVisible, setCreditVisible] = useState(false);

  const { getActiveSegment } = useSubtitles(video.id);

  const player = useVideoPlayer(getMuxStreamUrl(video.url), (p) => {
    p.loop = true;
    p.muted = isMuted;
  });

  // ─── Play/pause effect ──────────────────────────────────────────────────────
  // Plays only when all three conditions are met. Resetting both pause flags
  // on isActive=false guarantees the next video always starts clean (issue 6).
  useEffect(() => {
    if (isActive && !isManuallyPaused && !isWordTapPaused) {
      player.play();
    } else {
      player.pause();
      if (!isActive) {
        setIsManuallyPaused(false);
        setIsWordTapPaused(false);
      }
    }
  }, [isActive, isManuallyPaused, isWordTapPaused, player]);

  // ─── Temporary error logging (remove after diagnosis) ───────────────────────
  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status, error }) => {
      console.log('[FeedVideoItem] statusChange', {
        videoId: video.id,
        url: getMuxStreamUrl(video.url),
        status,
        error: error ?? null,
      });
    });
    return () => sub.remove();
  }, [player, video.id, video.url]);

  // ─── Mute sync ──────────────────────────────────────────────────────────────
  useEffect(() => {
    player.muted = isMuted;
  }, [isMuted, player]);

  // ─── currentTime polling ────────────────────────────────────────────────────
  // Polls at ~100ms for subtitle segment sync. Stops whenever the video is not
  // actually advancing (inactive, word-paused, or manually paused) to avoid
  // wasted state updates.
  //
  // Cleanup: every code path that creates an interval returns clearInterval.
  // Early-return paths create no interval and need no cleanup.
  // React calls the previous effect's cleanup before re-running — so if the
  // interval was running and deps change, clearInterval fires before the next
  // evaluation. No stacking, no leaks. (issue 5)
  useEffect(() => {
    if (!isActive || isWordTapPaused || isManuallyPaused) return;
    const id = setInterval(() => {
      try {
        setCurrentTime(player.currentTime);
      } catch {
        // Player not ready on the first tick — ignore silently.
      }
    }, 100);
    return () => clearInterval(id);
  }, [isActive, isWordTapPaused, isManuallyPaused, player]);

  // ─── Tap handlers ───────────────────────────────────────────────────────────

  // Word tap: open tooltip and pause. Does NOT reach the Pressable below
  // because React Native's responder system gives the gesture to the
  // innermost handler (the TouchableOpacity in SubtitleOverlay).
  const handleWordTap = useCallback((word: SegmentWordWithDetails, position: WordButtonPosition) => {
    setTappedWord(word);
    setTappedWordPosition(position);
    setIsWordTapPaused(true);
  }, []);

  // Tooltip close: clear the word and resume the video.
  const handleTooltipClose = useCallback(() => {
    setTappedWord(null);
    setTappedWordPosition(null);
    setIsWordTapPaused(false);
  }, []);

  // Video-area tap: one tap = one action to keep UX predictable.
  //   • If word-paused → clear word-pause (resuming the tooltip pause takes
  //     priority over toggling manual pause in the same gesture).
  //   • Otherwise → toggle manual pause (TikTok-style play/pause). (issue 1)
  const handleVideoTap = useCallback(() => {
    if (isWordTapPaused) {
      setIsWordTapPaused(false);
    } else {
      setIsManuallyPaused((prev) => !prev);
    }
  }, [isWordTapPaused]);

  const activeSegment = getActiveSegment(currentTime);

  return (
    <View style={[styles.container, { width, height }]}>
      {/* Layer 0 — Video (not interactive) */}
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />

      {/* Layer 1 — Transparent Pressable for video-area taps.
          SubtitleOverlay and FeedActionOverlay are rendered above this with
          pointerEvents="box-none" on their containers, so transparent areas
          of those overlays fall through to this Pressable on both iOS and
          Android. Word/button taps are caught by their own TouchableOpacity
          elements and never reach this layer. (issue 1, issue 3) */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleVideoTap} />

      {/* Layer 2 — Subtitle overlay.
          Conditionally mounted; useSubtitles always runs so the correct
          segment is ready when subtitles are un-hidden (issue 7). */}
      {subtitlesVisible && (
        <SubtitleOverlay
          activeSegment={activeSegment}
          subtitleMode={subtitleMode}
          onModeChange={onModeChange}
          onWordTap={handleWordTap}
        />
      )}

      {/* Layer 3 — Action buttons (mute, subtitle toggle, favorites) */}
      <FeedActionOverlay
        isMuted={isMuted}
        onMuteToggle={onMuteToggle}
        subtitlesVisible={subtitlesVisible}
        onSubtitlesToggle={onSubtitlesToggle}
        isFavorited={isFavorited}
        onFavoriteToggle={onFavoriteToggle ?? (() => {})}
      />

      {/* Layer 3b — Top-left button column: admin edit + credit info */}
      {(isAdmin || !!video.source_credit) && (
        <View style={styles.topLeftColumn}>
          {isAdmin && (
            <Pressable
              style={styles.adminEditButton}
              onPress={() => router.push(`/admin/videos/${video.id}/edit`)}
            >
              <Text style={styles.adminEditText}>✏ ערוך</Text>
            </Pressable>
          )}
          {!!video.source_credit && (
            <Pressable
              style={styles.creditButton}
              onPress={() => setCreditVisible(true)}
            >
              <Text style={styles.creditButtonText}>ⓘ</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Credit popup — tap-outside backdrop closes the popup */}
      {creditVisible && (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCreditVisible(false)} />
          <View style={styles.creditPopupContainer} pointerEvents="box-none">
            <Pressable style={styles.creditPopup} onPress={() => {}}>
              <Text style={styles.creditPopupText}>{video.source_credit}</Text>
            </Pressable>
          </View>
        </>
      )}

      {/* Layer 4 — Word tooltip.
          Rendered above all other layers. The backdrop inside WordTooltip
          covers the full screen and blocks touches to layers below. */}
      {tappedWord && tappedWordPosition && (
        <WordTooltip
          word={tappedWord}
          position={tappedWordPosition}
          screenWidth={width}
          screenHeight={height}
          onClose={handleTooltipClose}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
  },
  topLeftColumn: {
    position: 'absolute',
    top: 60,
    left: 16,
    flexDirection: 'column',
    gap: 8,
  },
  adminEditButton: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  adminEditText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  creditButton: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  creditButtonText: {
    color: '#fff',
    fontSize: 18,
  },
  creditPopupContainer: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 16,
  },
  creditPopup: {
    backgroundColor: 'rgba(20,20,20,0.92)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
  creditPopupText: {
    color: '#e5e7eb',
    fontSize: 14,
    textAlign: 'right',
  },
});
