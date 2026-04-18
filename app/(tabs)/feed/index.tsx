// Feed tab — fetches all published videos and renders them in the full-screen
// contextual feed component. All playback, snap, subtitle, and favorites logic
// lives in ContextualFeed.

import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '../../../services/supabase';
import ContextualFeed from '../../../components/ContextualFeed';
import type { FeedVideo } from '../../../types';

export default function FeedScreen() {
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('videos')
      .select(
        `
        *,
        video_categories (
          categories ( id, name )
        )
      `,
      )
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          setError(error.message);
        } else {
          setVideos((data as FeedVideo[]) ?? []);
        }
        setLoading(false);
      });
  }, []);

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

  if (videos.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No videos yet.</Text>
      </View>
    );
  }

  return <ContextualFeed videos={videos} initialIndex={0} />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 16,
  },
});
