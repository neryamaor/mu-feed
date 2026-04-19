// Favorites screen — shows the user's favorited videos as a 2-column grid.
//
// Fetches its own data on mount (source of truth — not passed via params).
// Tapping a card navigates to the contextual feed at /video/favorites/[id],
// passing the full FeedVideo[] list as a JSON param (same pattern as profile).

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getUserFavorites } from '../../../services/favorites';
import VideoCard from '../../../components/VideoCard';
import type { VideoFavorite, FeedVideo } from '../../../types';

export default function FavoritesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [favorites, setFavorites] = useState<VideoFavorite[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      getUserFavorites()
        .then(setFavorites)
        .catch(() => setFavorites([]))
        .finally(() => setLoading(false));
    }, []),
  );

  // Map VideoFavorite[] → FeedVideo[] once, shared across all card presses.
  const feedVideos: FeedVideo[] = favorites.map((f) => ({
    id: f.videoId,
    title: f.videoTitle,
    url: f.videoUrl,
    status: 'published' as const,
    uploaded_by: null,
    difficulty_level: null,
    published_at: null,
    created_at: f.savedAt,
    source_credit: null,
    video_categories: [],
  }));

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.title}>הסרטונים המועדפים שלי</Text>
        {/* Spacer keeps title centred */}
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6b7280" />
        </View>
      ) : favorites.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>עדיין לא שמרת סרטונים</Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          numColumns={2}
          renderItem={({ item }) => (
            <View style={styles.gridCell}>
              <VideoCard
                video={feedVideos.find((v) => v.id === item.videoId)!}
                onPress={() =>
                  router.push({
                    pathname: `/video/favorites/${item.videoId}`,
                    params: { videos: JSON.stringify(feedVideos) },
                  })
                }
              />
            </View>
          )}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backButton: {
    width: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  emptyText: {
    fontSize: 15,
    color: '#9ca3af',
    textAlign: 'center',
  },
  grid: {
    paddingVertical: 8,
    paddingBottom: 32,
  },
  gridCell: {
    flex: 1,
  },
});
