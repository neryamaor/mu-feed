// Flashcards setup screen — lets the user choose direction and start a session.
//
// Entry point: dictionary tab → "כרטיסיות ›" button.
// On "התחל": fetches the full card list and pushes to /flashcards/session.

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getFlashcards } from '../../../services/flashcards';
import type { FlashcardDirection } from '../../../types';

type PracticeMode = 'all' | 'manual';

export default function FlashcardsSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [direction, setDirection] = useState<FlashcardDirection>('ar-to-he');
  const [mode, setMode] = useState<PracticeMode>('all');
  const [cardCount, setCardCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  // Reload count on every focus so it stays in sync with the dictionary.
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      getFlashcards()
        .then((cards) => setCardCount(cards.length))
        .catch(() => setCardCount(0))
        .finally(() => setLoading(false));
    }, []),
  );

  const isEmpty = cardCount === 0;
  const canStart = !isEmpty && mode === 'all' && !starting;

  async function handleStart() {
    if (!canStart) return;
    setStarting(true);
    try {
      const cards = await getFlashcards();
      router.push({
        pathname: '/flashcards/session',
        params: { cards: JSON.stringify(cards), direction },
      });
    } finally {
      setStarting(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.title}>כרטיסיות לימוד</Text>

      {/* ── Direction toggle ─────────────────────────────────────────────── */}
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionLabel}>כיוון התרגול</Text>
        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.togglePill, direction === 'ar-to-he' && styles.togglePillActive]}
            onPress={() => setDirection('ar-to-he')}
          >
            <Text style={[styles.toggleText, direction === 'ar-to-he' && styles.toggleTextActive]}>
              ערבית → עברית
            </Text>
          </Pressable>
          <Pressable
            style={[styles.togglePill, direction === 'he-to-ar' && styles.togglePillActive]}
            onPress={() => setDirection('he-to-ar')}
          >
            <Text style={[styles.toggleText, direction === 'he-to-ar' && styles.toggleTextActive]}>
              עברית → ערבית
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ── Practice mode ────────────────────────────────────────────────── */}
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionLabel}>מה לתרגל?</Text>

        {loading ? (
          <ActivityIndicator color="#6b7280" style={styles.loader} />
        ) : isEmpty ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              עדיין לא שמרת מילים. שמור מילים מסרטונים כדי להתחיל לתרגל.
            </Text>
          </View>
        ) : (
          <>
            {/* Option A — all words */}
            <Pressable
              style={[styles.modeCard, mode === 'all' && styles.modeCardActive]}
              onPress={() => setMode('all')}
            >
              <View style={styles.modeCardInner}>
                <View style={[styles.radioOuter, mode === 'all' && styles.radioOuterActive]}>
                  {mode === 'all' && <View style={styles.radioInner} />}
                </View>
                <Text style={[styles.modeCardText, mode === 'all' && styles.modeCardTextActive]}>
                  כל המילים שלי ({cardCount} מילים)
                </Text>
              </View>
            </Pressable>

            {/* Option B — manual selection (placeholder) */}
            <Pressable
              style={[styles.modeCard, mode === 'manual' && styles.modeCardActive]}
              onPress={() => setMode('manual')}
            >
              <View style={styles.modeCardInner}>
                <View style={[styles.radioOuter, mode === 'manual' && styles.radioOuterActive]}>
                  {mode === 'manual' && <View style={styles.radioInner} />}
                </View>
                <Text style={[styles.modeCardText, mode === 'manual' && styles.modeCardTextActive]}>
                  בחירה ידנית
                </Text>
              </View>
              {mode === 'manual' && (
                <Text style={styles.placeholderNote}>בקרוב — בחירה ידנית של מילים</Text>
              )}
            </Pressable>
          </>
        )}
      </View>

      {/* ── Start button ─────────────────────────────────────────────────── */}
      <View style={styles.startWrapper}>
        <TouchableOpacity
          style={[styles.startButton, !canStart && styles.startButtonDisabled]}
          onPress={handleStart}
          disabled={!canStart}
          activeOpacity={0.8}
        >
          {starting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.startButtonText}>התחל</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
    paddingHorizontal: 20,
  },
  title: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 28,
  },
  sectionBlock: {
    marginBottom: 24,
  },
  sectionLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  // Direction toggle
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 3,
  },
  togglePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  togglePillActive: {
    backgroundColor: '#2563eb',
  },
  toggleText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#ffffff',
  },
  // Mode cards
  modeCard: {
    backgroundColor: '#111',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 14,
    marginBottom: 10,
  },
  modeCardActive: {
    borderColor: '#2563eb',
    backgroundColor: 'rgba(37,99,235,0.08)',
  },
  modeCardInner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterActive: {
    borderColor: '#2563eb',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563eb',
  },
  modeCardText: {
    color: '#9ca3af',
    fontSize: 15,
    flex: 1,
    textAlign: 'right',
  },
  modeCardTextActive: {
    color: '#ffffff',
  },
  placeholderNote: {
    color: '#4b5563',
    fontSize: 13,
    textAlign: 'right',
    marginTop: 8,
  },
  // Empty state
  loader: {
    marginVertical: 16,
  },
  emptyState: {
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 20,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'right',
    lineHeight: 22,
  },
  // Start button
  startWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  startButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startButtonDisabled: {
    backgroundColor: '#1f2937',
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
});
