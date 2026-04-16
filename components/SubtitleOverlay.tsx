// SubtitleOverlay — renders the active subtitle segment as an interactive overlay.
//
// Each word is a tappable unit. Words are laid out in RTL order (row-reverse)
// to match Arabic and Hebrew reading direction.
//
// The mode toggle cycles between Arabic script, Hebrew transliteration, or both
// stacked vertically per word.
//
// This component is only mounted when subtitles are visible (controlled by the
// parent via conditional rendering). The useSubtitles hook in FeedVideoItem
// continues running while this component is unmounted — so when it remounts,
// the correct active segment is passed immediately without a re-fetch.
//
// Used in: components/FeedVideoItem.tsx

import { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SegmentWithWords, SegmentWordWithDetails, SubtitleMode } from '../types';

const MODES: SubtitleMode[] = ['arabic', 'transliteration', 'both'];

// Labels shown on the mode-toggle pills.
// ع  = Arabic letter Ain (represents Arabic script)
// תע = short for "תעתיק" (Hebrew: transliteration)
// ×2 = both display modes stacked
const MODE_LABELS: Record<SubtitleMode, string> = {
  arabic: 'ع',
  transliteration: 'תע',
  both: '×2',
};

interface Props {
  activeSegment: SegmentWithWords | null;
  subtitleMode: SubtitleMode;
  onModeChange: (mode: SubtitleMode) => void;
  onWordTap: (word: SegmentWordWithDetails, position: WordButtonPosition) => void;
}

export default function SubtitleOverlay({
  activeSegment,
  subtitleMode,
  onModeChange,
  onWordTap,
}: Props) {
  // Must be called before the early return to satisfy Rules of Hooks.
  const insets = useSafeAreaInsets();

  // No active segment → render nothing (overlay is transparent).
  if (!activeSegment || activeSegment.segment_words.length === 0) return null;

  // Lift the panel above the tab bar on all devices:
  //   insets.bottom  — home indicator height (34px on modern iPhone, 0 elsewhere)
  //   49             — standard tab bar content height (iOS/Android)
  //   24             — breathing room between panel and tab bar
  const panelBottom = insets.bottom + 49 + 24;

  return (
    // pointerEvents="box-none": transparent areas pass touches through to the
    // video layer; only the interactive children (words, mode buttons) capture touches.
    <View style={[styles.overlay, { paddingBottom: panelBottom }]} pointerEvents="box-none">
      <View style={styles.panel}>
        {/* Mode toggle — right-aligned to match RTL text direction */}
        <View style={styles.modeRow}>
          {MODES.map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.modeBtn, mode === subtitleMode && styles.modeBtnActive]}
              onPress={() => onModeChange(mode)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={[styles.modeBtnText, mode === subtitleMode && styles.modeBtnTextActive]}>
                {MODE_LABELS[mode]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Words — row-reverse so word[0] appears on the right (RTL reading order) */}
        <View style={styles.wordsRow}>
          {activeSegment.segment_words.map((word) => (
            <WordButton
              key={word.id}
              word={word}
              mode={subtitleMode}
              onPress={(w, pos) => onWordTap(w, pos)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── WordButton ────────────────────────────────────────────────────────────────

/** Screen coordinates of a tapped word — used to position WordTooltip. */
export interface WordButtonPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WordButtonProps {
  word: SegmentWordWithDetails;
  mode: SubtitleMode;
  onPress: (word: SegmentWordWithDetails, position: WordButtonPosition) => void;
}

function WordButton({ word, mode, onPress }: WordButtonProps) {
  const ref = useRef<TouchableOpacity>(null);
  const arabic = word.dictionary_entries?.arabic_text ?? '';
  const translit = word.translations?.transliteration ?? '';

  const handlePress = () => {
    ref.current?.measure((_x, _y, width, height, pageX, pageY) => {
      onPress(word, { x: pageX, y: pageY, width, height });
    });
  };

  return (
    <TouchableOpacity
      ref={ref}
      style={styles.wordBtn}
      onPress={handlePress}
      activeOpacity={0.6}
    >
      {(mode === 'arabic' || mode === 'both') && arabic ? (
        <Text style={styles.arabicText}>{arabic}</Text>
      ) : null}
      {(mode === 'transliteration' || mode === 'both') && translit ? (
        <Text style={styles.translitText}>{translit}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },
  // Mode toggle row — right-aligned to match RTL content direction.
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
    marginBottom: 10,
  },
  modeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  modeBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: '#fff',
  },
  modeBtnText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '500',
  },
  modeBtnTextActive: {
    color: '#fff',
  },
  // Words container — row-reverse lays items right-to-left (RTL word order).
  wordsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 4,
  },
  wordBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    alignItems: 'flex-end',
  },
  arabicText: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '500',
    textAlign: 'right',
  },
  translitText: {
    color: '#d1d5db',
    fontSize: 13,
    textAlign: 'right',
  },
});
