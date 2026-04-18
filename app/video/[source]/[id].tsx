// Contextual feed route — renders a full-screen feed for a sub-list of videos.
//
// Launched from:
//   - Profile screen favorites list  → source = 'favorites'
//   - Search screen results list     → source = 'search'
//
// The video list is passed as a JSON-serialised navigation param ('videos').
// This avoids re-fetching: the source screen already has the list loaded.
// If parsing fails or the list is empty, navigates back immediately.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import ContextualFeed from '../../../components/ContextualFeed';
import type { FeedVideo } from '../../../types';

export default function ContextualFeedRoute() {
  const router = useRouter();
  const { id, videos: videosParam } =
    useLocalSearchParams<{ source: string; id: string; videos: string }>();

  // Parse the video list passed from the source screen
  let videos: FeedVideo[] = [];
  let parseError = false;
  try {
    const parsed = JSON.parse(videosParam ?? '[]');
    if (Array.isArray(parsed)) {
      videos = parsed as FeedVideo[];
    } else {
      parseError = true;
    }
  } catch {
    parseError = true;
  }

  if (parseError || videos.length === 0) {
    // Params missing or malformed — go back rather than silently re-fetching.
    // Using a render-time push is fine here; it fires before the first paint.
    router.back();
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  // Find the tapped video in the list. Default to 0 if not found (shouldn't happen).
  const initialIndex = Math.max(0, videos.findIndex((v) => v.id === id));

  return (
    <ContextualFeed
      videos={videos}
      initialIndex={initialIndex}
      onClose={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
  },
});
