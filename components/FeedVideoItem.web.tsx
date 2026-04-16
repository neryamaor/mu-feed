// FeedVideoItem — web implementation.
// Metro resolves this file for web builds; FeedVideoItem.tsx is used for native.
// Uses a native <video> DOM element + hls.js because the HTML5 video element
// does not support HLS natively on Chrome/Firefox.
//
// All behaviour mirrors the native FeedVideoItem exactly —
// see FeedVideoItem.tsx for the full play/pause state machine documentation.
//
// ─── Play/pause state machine ─────────────────────────────────────────────────
//
//   isActive        feed-level: this item is the visible video in the FlatList
//   isManuallyPaused user tapped the video area to pause (TikTok-style toggle)
//   isWordTapPaused  user tapped a subtitle word (pauses for upcoming tooltip)
//
//   Video plays only when:  isActive && !isManuallyPaused && !isWordTapPaused
//   On isActive=false:      both pause flags reset → next visit starts fresh

import { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, useWindowDimensions, Pressable } from 'react-native';
import Hls from 'hls.js';
import { getMuxStreamUrl } from '../services/video';
import { useSubtitles } from '../hooks/useSubtitles';
import FeedActionOverlay from './FeedActionOverlay';
import SubtitleOverlay from './SubtitleOverlay';
import WordTooltip from './WordTooltip';
import type { WordButtonPosition } from './SubtitleOverlay';
import type { FeedVideo, SegmentWordWithDetails, SubtitleMode } from '../types';

interface Props {
  video: FeedVideo;
  isActive: boolean;
  isMuted: boolean;
  onMuteToggle: () => void;
  subtitlesVisible: boolean;
  onSubtitlesToggle: () => void;
  /** Feed-level subtitle mode — persists across videos (lives in useVideoPlayback). */
  subtitleMode: SubtitleMode;
  onModeChange: (mode: SubtitleMode) => void;
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
}: Props) {
  const { width, height } = useWindowDimensions();
  // React Native Web renders View as <div>, so this cast is valid on web.
  const containerRef = useRef<View>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  // User tapped the video area to pause (TikTok-style manual toggle).
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  // User tapped a subtitle word — paused to show tooltip.
  const [isWordTapPaused, setIsWordTapPaused] = useState(false);
  // The word currently shown in the tooltip (null = tooltip closed).
  const [tappedWord, setTappedWord] = useState<SegmentWordWithDetails | null>(null);
  // Screen coordinates of the tapped word — used to position the tooltip card.
  const [tappedWordPosition, setTappedWordPosition] = useState<WordButtonPosition | null>(null);

  const streamUrl = getMuxStreamUrl(video.url);

  const { getActiveSegment } = useSubtitles(video.id);

  // Mount the <video> element and attach HLS once per component instance.
  useEffect(() => {
    const container = containerRef.current as unknown as HTMLElement;
    if (!container) return;

    const videoEl = document.createElement('video');
    videoEl.loop = true;
    videoEl.playsInline = true;
    videoEl.muted = isMuted;
    videoEl.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;background:#000;';
    container.appendChild(videoEl);
    videoElRef.current = videoEl;

    if (Hls.isSupported()) {
      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(videoEl);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.error('[FeedVideoItem] hls.js fatal error:', data.type, data.details);
        }
      });
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari supports HLS natively — no hls.js needed.
      videoEl.src = streamUrl;
    } else {
      console.error('[FeedVideoItem] HLS is not supported in this browser.');
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      if (container.contains(videoEl)) container.removeChild(videoEl);
      videoElRef.current = null;
    };
  }, [streamUrl]); // re-run only if the source URL changes

  // ─── Play/pause effect ──────────────────────────────────────────────────────
  // Plays only when all three conditions are met. Resetting both pause flags
  // on isActive=false guarantees the next video always starts clean.
  useEffect(() => {
    const videoEl = videoElRef.current;
    if (!videoEl) return;
    if (isActive && !isManuallyPaused && !isWordTapPaused) {
      videoEl.play().catch(() => {
        // Autoplay may be blocked until the user interacts with the page.
      });
    } else {
      videoEl.pause();
      if (!isActive) {
        setIsManuallyPaused(false);
        setIsWordTapPaused(false);
      }
    }
  }, [isActive, isManuallyPaused, isWordTapPaused]);

  // ─── Mute sync ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (videoElRef.current) {
      videoElRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // ─── currentTime polling ────────────────────────────────────────────────────
  // Stops whenever the video is not actually advancing to avoid wasted state
  // updates. Cleanup: every code path that creates an interval returns
  // clearInterval. Early-return paths create no interval and need no cleanup.
  useEffect(() => {
    if (!isActive || isWordTapPaused || isManuallyPaused) return;
    const interval = setInterval(() => {
      if (videoElRef.current) {
        setCurrentTime(videoElRef.current.currentTime);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isActive, isWordTapPaused, isManuallyPaused]);

  // ─── Tap handlers ───────────────────────────────────────────────────────────

  // Word tap: open tooltip and pause. Does NOT reach the Pressable below
  // because React Native's responder system gives the gesture to the innermost
  // handler (the TouchableOpacity in SubtitleOverlay).
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
  //   • If word-paused → clear word-pause
  //   • Otherwise → toggle manual pause (TikTok-style play/pause)
  const handleVideoTap = useCallback(() => {
    if (isWordTapPaused) {
      setIsWordTapPaused(false);
    } else {
      setIsManuallyPaused((prev) => !prev);
    }
  }, [isWordTapPaused]);

  const activeSegment = getActiveSegment(currentTime);

  return (
    <View ref={containerRef} style={[styles.container, { width, height }]}>
      {/* The <video> DOM element is appended imperatively inside containerRef */}

      {/* Transparent tap area for video-area taps (z above video, below overlays) */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleVideoTap} />

      {subtitlesVisible && (
        <SubtitleOverlay
          activeSegment={activeSegment}
          subtitleMode={subtitleMode}
          onModeChange={onModeChange}
          onWordTap={handleWordTap}
        />
      )}

      <FeedActionOverlay
        isMuted={isMuted}
        onMuteToggle={onMuteToggle}
        subtitlesVisible={subtitlesVisible}
        onSubtitlesToggle={onSubtitlesToggle}
      />

      {/* Layer 4 — Word tooltip (above all other layers) */}
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
});
