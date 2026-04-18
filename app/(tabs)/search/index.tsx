// Search screen — find videos by title, tag, Arabic word, Hebrew translation,
// or transliteration.
//
// All search logic lives in services/search.ts (ARCHITECTURE.md §5.1).
// Results are displayed as VideoCard components (the component built for
// non-feed contexts). Tapping a card is a no-op until the feed supports
// deep-linking to a specific video (TODO Task 1.7+).
//
// Query is debounced 300ms to avoid firing on every keystroke.
// Minimum 2 characters before a search is issued.

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  ListRenderItem,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { searchVideos } from '../../../services/search';
import VideoCard from '../../../components/VideoCard';
import type { FeedVideo } from '../../../types';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FeedVideo[]>([]);
  const [loading, setLoading] = useState(false);

  // Debounce: wait 300ms after the user stops typing before hitting the DB.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
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

  const renderItem: ListRenderItem<FeedVideo> = useCallback(
    ({ item }) => (
      <VideoCard
        video={item}
        onPress={() =>
          router.push({
            pathname: `/video/search/${item.id}`,
            params: { videos: JSON.stringify(results) },
          })
        }
      />
    ),
    [results, router],
  );

  const isIdle = query.trim().length < 2;
  const isEmpty = !loading && !isIdle && results.length === 0;

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
        // writingDirection ensures correct cursor placement on Android for RTL input.
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

      {!isIdle && !loading && results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separator}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
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
  list: {
    paddingBottom: 32,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginHorizontal: 20,
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
