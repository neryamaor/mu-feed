// WordTooltip — small floating card positioned above (or below) the tapped word.
//
// Positioning:
//   - Horizontally centered on the tapped word, clamped to screen edges.
//   - Vertically above the word by default; flips below if the word is near
//     the top of the screen (y < ABOVE_THRESHOLD).
//   - Uses screen coordinates supplied by SubtitleOverlay via measure().
//
// Backdrop: fully transparent Pressable covering the full screen — catches
// tap-outside to close without adding any visual dimming (the video is still
// visible and provides context).
//
// Save button: writes to personal_dictionary via services/dictionary.ts.
// TODO (Task 1.2): replace DUMMY_USER_ID with supabase.auth.getUser().

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { saveToPersonalDictionary } from '../services/dictionary';
import { DUMMY_USER_ID } from '../constants';
import type { SegmentWordWithDetails } from '../types';
import type { WordButtonPosition } from './SubtitleOverlay';

// Card geometry constants
const CARD_WIDTH = 210;
const CARD_MARGIN = 14;   // min distance from screen edge
const WORD_GAP = 10;      // gap between word and card edge
// Words in the subtitle area sit near the bottom; flip to below only when
// the word is unusually high on screen (e.g. very first subtitle line).
const ABOVE_THRESHOLD = 160;

interface Props {
  word: SegmentWordWithDetails;
  position: WordButtonPosition;
  screenWidth: number;
  screenHeight: number;
  onClose: () => void;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function WordTooltip({
  word,
  position,
  screenWidth,
  screenHeight,
  onClose,
}: Props) {
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const arabicText = word.dictionary_entries?.arabic_text ?? '';
  const isPhrase = word.dictionary_entries?.is_phrase ?? false;
  const hebrew = word.translations?.hebrew_translation ?? '';
  const transliteration = word.translations?.transliteration ?? '';

  // ─── Positioning ────────────────────────────────────────────────────────────

  // Center card on the word horizontally, clamped to screen edges.
  const cardLeft = Math.max(
    CARD_MARGIN,
    Math.min(
      position.x + position.width / 2 - CARD_WIDTH / 2,
      screenWidth - CARD_WIDTH - CARD_MARGIN,
    ),
  );

  // Above the word unless near the top of the screen.
  const showAbove = position.y > ABOVE_THRESHOLD;
  const verticalStyle = showAbove
    ? { bottom: screenHeight - position.y + WORD_GAP }
    : { top: position.y + position.height + WORD_GAP };

  // ─── Save handler ────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (saveState !== 'idle') return;
    setSaveState('saving');

    // TODO (Task 1.2): replace DUMMY_USER_ID with supabase.auth.getUser()
    const err = await saveToPersonalDictionary(DUMMY_USER_ID, word.dictionary_entry_id);
    setSaveState(err ? 'error' : 'saved');
  }, [saveState, word.dictionary_entry_id]);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    // Full-screen transparent backdrop — tap outside the card to close.
    // Inner Pressable (the card) swallows touches so backdrop onPress doesn't fire.
    <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
      <Pressable
        style={[
          styles.card,
          { left: cardLeft, width: CARD_WIDTH },
          verticalStyle,
        ]}
        onPress={() => {}}
      >
        {/* Header row: arabic text + optional phrase badge */}
        <View style={styles.headerRow}>
          <Text style={styles.arabicText} numberOfLines={2}>
            {arabicText}
          </Text>
          {isPhrase && (
            <View style={styles.phraseBadge}>
              <Text style={styles.phraseBadgeText}>ביטוי</Text>
            </View>
          )}
        </View>

        {transliteration ? (
          <Text style={styles.transliteration}>{transliteration}</Text>
        ) : null}

        {hebrew ? (
          <Text style={styles.hebrewTranslation}>{hebrew}</Text>
        ) : null}

        {!hebrew && !transliteration ? (
          <Text style={styles.noTranslation}>אין תרגום זמין</Text>
        ) : null}

        <Pressable
          style={[
            styles.saveButton,
            saveState === 'saved' && styles.saveButtonSaved,
            saveState === 'error' && styles.saveButtonError,
          ]}
          onPress={handleSave}
          disabled={saveState !== 'idle'}
        >
          {saveState === 'saving' ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>
              {saveState === 'saved'
                ? 'נשמר ✓'
                : saveState === 'error'
                  ? 'התחבר כדי לשמור'
                  : 'שמור למילון'}
            </Text>
          )}
        </Pressable>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    backgroundColor: '#1c1c1e',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    // Subtle shadow so the card reads against any video background.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 3,
    gap: 6,
  },
  arabicText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
  },
  phraseBadge: {
    backgroundColor: 'rgba(251,191,36,0.2)',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginTop: 3,
  },
  phraseBadgeText: {
    color: '#fbbf24',
    fontSize: 10,
    fontWeight: '600',
  },
  transliteration: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'right',
    marginBottom: 2,
  },
  hebrewTranslation: {
    color: '#e5e7eb',
    fontSize: 15,
    textAlign: 'right',
    marginBottom: 10,
  },
  noTranslation: {
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 10,
  },
  saveButton: {
    backgroundColor: 'rgba(59,130,246,0.85)',
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
  },
  saveButtonSaved: {
    backgroundColor: 'rgba(22,163,74,0.85)',
  },
  saveButtonError: {
    backgroundColor: 'rgba(75,85,99,0.85)',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});
