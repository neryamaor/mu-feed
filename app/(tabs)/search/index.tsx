// Search screen — find videos by title, tag, Arabic word, Hebrew translation,
// or transliteration.
//
// All search logic lives in services/search.ts (ARCHITECTURE.md §5.1).
// Results are split into two sections:
//   1. Dictionary entries (up to 3) — shown above video results.
//   2. Video results — VideoCard + optional context line below each card.
//
// Query is debounced 300ms to avoid firing on every keystroke.
// Minimum 2 characters before a search is issued.

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { searchVideos } from '../../../services/search';
import VideoCard from '../../../components/VideoCard';
import type { SearchResults, DictionaryResult, VideoSearchResult } from '../../../types';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);

  // Debounce: wait 300ms after the user stops typing before hitting the DB.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      const data = await searchVideos(q);
      setResults(data);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const isIdle = query.trim().length < 2;
  const hasResults =
    results !== null &&
    (results.dictionaryResults.length > 0 || results.videoResults.length > 0);
  const isEmpty = !loading && !isIdle && !hasResults;

  // The list of FeedVideos passed to the contextual feed route.
  const feedVideos = results?.videoResults.map((r) => r.video) ?? [];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Text style={styles.heading}>חיפוש</Text>

      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder="חפש לפי שם, קטגוריה, מילה..."
        placeholderTextColor="#6b7280"
        textAlign="right"
        writingDirection="rtl"
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        returnKeyType="search"
      />

      {isIdle && (
        <View style={styles.centeredHint}>
          <Text style={styles.hintText}>חפש סרטון לפי כותרת, תג, מילה בערבית, תרגום או תעתיק</Text>
        </View>
      )}

      {!isIdle && loading && (
        <View style={styles.centeredHint}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      {isEmpty && (
        <View style={styles.centeredHint}>
          <Text style={styles.hintText}>לא נמצאו תוצאות עבור "{query.trim()}"</Text>
        </View>
      )}

      {!isIdle && !loading && hasResults && (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Dictionary results section ─────────────────────────── */}
          {results!.dictionaryResults.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>תוצאות מהמילון</Text>
              {results!.dictionaryResults.map((entry) => (
                <DictionaryCard key={entry.entryId} entry={entry} />
              ))}
            </View>
          )}

          {/* ── Video results section ──────────────────────────────── */}
          {results!.videoResults.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>סרטונים המכילים את הביטוי</Text>
              {results!.videoResults.map((result, index) => (
                <View key={result.video.id}>
                  {index > 0 && <View style={styles.separator} />}
                  <VideoCard
                    video={result.video}
                    onPress={() =>
                      router.push({
                        pathname: `/video/search/${result.video.id}`,
                        params: { videos: JSON.stringify(feedVideos) },
                      })
                    }
                  />
                  <ContextLine result={result} query={query.trim()} />
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Dictionary card ──────────────────────────────────────────────────────────

function DictionaryCard({ entry }: { entry: DictionaryResult }) {
  return (
    <View style={styles.dictCard}>
      <Text style={styles.dictArabic}>{entry.arabicText}</Text>
      <Text style={styles.dictTranslit}>{entry.transliteration}</Text>
      <Text style={styles.dictHebrew}>{entry.hebrewTranslation}</Text>
    </View>
  );
}

// ─── Context line below each video card ───────────────────────────────────────

function ContextLine({ result, query }: { result: VideoSearchResult; query: string }) {
  if (result.matchType === 'title' || !result.matchContext) return null;

  if (result.matchType === 'tag') {
    return (
      <Text style={styles.contextLine} numberOfLines={1}>
        תג: #{result.matchContext}
      </Text>
    );
  }

  // Segment match — highlight the query within the context text.
  return (
    <Text style={styles.contextLine} numberOfLines={2}>
      <HighlightedText text={result.matchContext} highlight={query} />
    </Text>
  );
}

// ─── Inline highlight helper ──────────────────────────────────────────────────

function HighlightedText({ text, highlight }: { text: string; highlight: string }) {
  if (!highlight) return <Text>{text}</Text>;

  const hl = highlight.toLowerCase();
  const parts: Array<{ text: string; match: boolean }> = [];
  let remaining = text;
  let lowerRemaining = remaining.toLowerCase();

  while (remaining.length > 0) {
    const idx = lowerRemaining.indexOf(hl);
    if (idx === -1) {
      parts.push({ text: remaining, match: false });
      break;
    }
    if (idx > 0) {
      parts.push({ text: remaining.slice(0, idx), match: false });
    }
    parts.push({ text: remaining.slice(idx, idx + hl.length), match: true });
    remaining = remaining.slice(idx + hl.length);
    lowerRemaining = remaining.toLowerCase();
  }

  return (
    <>
      {parts.map((p, i) =>
        p.match ? (
          <Text key={i} style={styles.contextHighlight}>
            {p.text}
          </Text>
        ) : (
          <Text key={i}>{p.text}</Text>
        ),
      )}
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  heading: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'right',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 10,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  section: {
    marginBottom: 8,
  },
  sectionHeader: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    paddingHorizontal: 20,
    paddingVertical: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginHorizontal: 20,
  },
  // Dictionary card
  dictCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dictArabic: {
    color: '#ffffff',
    fontSize: 18,
    textAlign: 'right',
    marginBottom: 4,
  },
  dictTranslit: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'right',
    marginBottom: 2,
  },
  dictHebrew: {
    color: '#60a5fa',
    fontSize: 14,
    textAlign: 'right',
  },
  // Context line
  contextLine: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'right',
    paddingHorizontal: 20,
    paddingBottom: 10,
    paddingTop: 2,
    lineHeight: 18,
  },
  contextHighlight: {
    color: '#ffffff',
    fontWeight: '700',
  },
  centeredHint: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  hintText: {
    color: '#6b7280',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
