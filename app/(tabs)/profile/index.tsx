import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../hooks/useAuth';
import { getUserFavorites } from '../../../services/favorites';
import type { VideoFavorite, FeedVideo } from '../../../types';

export default function ProfileScreen() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [favorites, setFavorites] = useState<VideoFavorite[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);

  // Reload favorites whenever the tab comes into focus
  useFocusEffect(
    useCallback(() => {
      setFavoritesLoading(true);
      getUserFavorites()
        .then(setFavorites)
        .catch(() => setFavorites([]))
        .finally(() => setFavoritesLoading(false));
    }, []),
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]}
    >
      {/* Header row: email + gear icon */}
      <View style={styles.headerRow}>
        <Text style={styles.email}>{user?.email}</Text>
        <TouchableOpacity
          style={styles.gearButton}
          onPress={() => router.push('/profile/settings')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="settings-outline" size={22} color="#6b7280" />
        </TouchableOpacity>
      </View>

      {/* Admin entry point — only rendered for users with admin_permissions */}
      {isAdmin && (
        <TouchableOpacity
          style={styles.adminButton}
          onPress={() => router.push('/admin/upload')}
        >
          <Text style={styles.adminButtonText}>Admin Panel</Text>
        </TouchableOpacity>
      )}

      {/* ── Favorites section ──────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>הסרטונים המועדפים שלי</Text>

        {favoritesLoading ? (
          <ActivityIndicator color="#6b7280" style={styles.favLoader} />
        ) : favorites.length === 0 ? (
          <Text style={styles.emptyFavorites}>
            עדיין לא שמרת סרטונים. לחץ על ♡ בפיד כדי לשמור סרטון.
          </Text>
        ) : (
          favorites.map((fav) => (
            <Pressable
              key={fav.id}
              style={styles.favItem}
              onPress={() => {
                // Map VideoFavorite[] → FeedVideo[] so ContextualFeed receives
                // the correct shape. Fields not available here default to null/[].
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
                router.push({
                  pathname: `/video/favorites/${fav.videoId}`,
                  params: { videos: JSON.stringify(feedVideos) },
                });
              }}
            >
              <Text style={styles.favTitle} numberOfLines={2}>
                {fav.videoTitle}
              </Text>
              <Text style={styles.favChevron}>›</Text>
            </Pressable>
          ))
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    paddingHorizontal: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  email: {
    fontSize: 16,
    color: '#6b7280',
    flex: 1,
    textAlign: 'right',
  },
  gearButton: {
    marginLeft: 12,
  },
  adminButton: {
    borderWidth: 1,
    borderColor: '#1a1a1a',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  adminButtonText: { color: '#1a1a1a', fontWeight: '600', fontSize: 16 },

  // ── Favorites ──
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
    textAlign: 'right',
    marginBottom: 12,
  },
  favLoader: {
    marginVertical: 16,
  },
  emptyFavorites: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'right',
    lineHeight: 20,
  },
  favItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  favTitle: {
    flex: 1,
    fontSize: 15,
    color: '#111',
    textAlign: 'right',
  },
  favChevron: {
    fontSize: 18,
    color: '#d1d5db',
    marginLeft: 8,
  },

});
