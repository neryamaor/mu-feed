// Admin — Video management list.
//
// Shows all videos (draft + published) ordered by creation date.
// Each row has an "ערוך" button that navigates to the edit screen.
// Protected: only reachable by users with a row in admin_permissions
// (enforced by app/admin/_layout.tsx).

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchAllVideosForAdmin } from '../../../services/videoEdit';
import type { AdminVideoListItem } from '../../../types';

export default function AdminVideoListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [videos, setVideos] = useState<AdminVideoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setVideos(await fetchAllVideosForAdmin());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function renderItem({ item }: { item: AdminVideoListItem }) {
    const dateLabel = item.publishedAt
      ? new Date(item.publishedAt).toLocaleDateString('he-IL')
      : null;

    return (
      <View style={styles.row}>
        <View style={styles.rowInfo}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.rowMeta}>
            <View
              style={[
                styles.statusBadge,
                item.status === 'published' ? styles.statusPublished : styles.statusDraft,
              ]}
            >
              <Text style={styles.statusText}>
                {item.status === 'published' ? 'פורסם' : 'טיוטה'}
              </Text>
            </View>
            {item.difficultyLevel != null && (
              <Text style={styles.metaText}>רמה {item.difficultyLevel}</Text>
            )}
            {dateLabel && <Text style={styles.metaText}>{dateLabel}</Text>}
          </View>
        </View>
        <Pressable
          style={styles.editButton}
          onPress={() => router.push(`/admin/videos/${item.id}/edit`)}
        >
          <Text style={styles.editButtonText}>ערוך</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16 }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ניהול סרטונים</Text>
        <Pressable style={styles.newButton} onPress={() => router.push('/admin/upload')}>
          <Text style={styles.newButtonText}>+ העלאה</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={load}>
            <Text style={styles.retryText}>נסה שוב</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(v) => v.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>אין סרטונים עדיין</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  newButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  newButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    gap: 12,
  },
  rowInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  rowTitle: {
    color: '#e5e7eb',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'right',
  },
  rowMeta: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusPublished: {
    backgroundColor: '#052e16',
  },
  statusDraft: {
    backgroundColor: '#1c1917',
  },
  statusText: {
    color: '#86efac',
    fontSize: 11,
    fontWeight: '600',
  },
  metaText: {
    color: '#6b7280',
    fontSize: 12,
  },
  editButton: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#374151',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editButtonText: {
    color: '#e5e7eb',
    fontSize: 13,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    color: '#f87171',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 16,
  },
});
