// Personal dictionary screen — lists all words and phrases the user has saved.
//
// Each entry shows:
//   - Arabic text (RTL, right-aligned)
//   - "ביטוי" badge for phrases
//   - ALL translations from the global dictionary (not just the context one)
//     Each translation: transliteration (gray) + Hebrew translation (white)
//
// Swipe left on any entry to reveal a delete button (react-native-gesture-handler).
//
// Auth: uses DUMMY_USER_ID until Task 1.2 (Auth) replaces it with the real user.
// TODO (Task 1.2): replace DUMMY_USER_ID with supabase.auth.getUser().

import { useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  ListRenderItem,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { RectButton } from 'react-native-gesture-handler';
import { useDictionary } from '../../../hooks/useDictionary';
import { DUMMY_USER_ID } from '../../../constants';
import type { PersonalDictionaryWithEntry } from '../../../types';

export default function DictionaryScreen() {
  const insets = useSafeAreaInsets();
  const { entries, loading, error, deleteEntry, refetch } = useDictionary(DUMMY_USER_ID);

  // Re-fetch every time the tab comes into focus so words saved from the feed
  // appear immediately without a full app restart.
  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  const renderItem: ListRenderItem<PersonalDictionaryWithEntry> = useCallback(
    ({ item }) => <DictionaryItem item={item} onDelete={deleteEntry} />,
    [deleteEntry],
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Text style={styles.heading}>המילון שלי</Text>

      {entries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>המילון ריק</Text>
          <Text style={styles.emptySubtitle}>
            הקש על מילה בכתוביות כדי לשמור אותה כאן
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separator}
        />
      )}
    </View>
  );
}

// ─── DictionaryItem ───────────────────────────────────────────────────────────
// Owns its Swipeable ref so it can close the swipe after the delete action fires.

interface DictionaryItemProps {
  item: PersonalDictionaryWithEntry;
  onDelete: (id: string) => void;
}

function DictionaryItem({ item, onDelete }: DictionaryItemProps) {
  const swipeableRef = useRef<Swipeable>(null);
  const entry = item.dictionary_entries;
  if (!entry) return null;

  const handleDelete = () => {
    swipeableRef.current?.close();
    onDelete(item.id);
  };

  const renderRightActions = () => (
    <RectButton style={styles.deleteAction} onPress={handleDelete}>
      <Text style={styles.deleteText}>מחק</Text>
    </RectButton>
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      friction={2}
      overshootRight={false}
    >
      <View style={styles.item}>
        {/* Arabic + phrase badge — RTL row */}
        <View style={styles.arabicRow}>
          <Text style={styles.arabicText}>{entry.arabic_text}</Text>
          {entry.is_phrase && (
            <View style={styles.phraseBadge}>
              <Text style={styles.phraseBadgeText}>ביטוי</Text>
            </View>
          )}
        </View>

        {/* All translations */}
        {entry.translations.length > 0 ? (
          entry.translations.map((t) => (
            <View key={t.id} style={styles.translationRow}>
              {t.transliteration ? (
                <Text style={styles.transliteration}>{t.transliteration}</Text>
              ) : null}
              {t.hebrew_translation ? (
                <Text style={styles.hebrewTranslation}>{t.hebrew_translation}</Text>
              ) : null}
            </View>
          ))
        ) : (
          <Text style={styles.noTranslation}>אין תרגום זמין</Text>
        )}
      </View>
    </Swipeable>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heading: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'right',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  list: {
    paddingBottom: 32,
  },
  // ── Entry item ──
  item: {
    backgroundColor: '#000',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  arabicRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  arabicText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
  },
  phraseBadge: {
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  phraseBadgeText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '600',
  },
  // ── Translation rows ──
  translationRow: {
    alignItems: 'flex-end',
    marginTop: 2,
  },
  transliteration: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'right',
  },
  hebrewTranslation: {
    color: '#e5e7eb',
    fontSize: 15,
    textAlign: 'right',
  },
  noTranslation: {
    color: '#4b5563',
    fontSize: 13,
    textAlign: 'right',
  },
  // ── Swipe-to-delete action ──
  deleteAction: {
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },
  deleteText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  // ── Misc ──
  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginHorizontal: 20,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  emptyTitle: {
    color: '#6b7280',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#4b5563',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
