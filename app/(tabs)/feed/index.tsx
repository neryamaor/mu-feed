import { useEffect, useState, useCallback } from 'react';
import {
  FlatList,
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { supabase } from '../../../services/supabase';
import FeedVideoItem from '../../../components/FeedVideoItem';
import { useVideoFeed } from '../../../hooks/useVideoFeed';
import { useVideoPlayback } from '../../../hooks/useVideoPlayback';
import type { FeedVideo } from '../../../types';

export default function FeedScreen() {
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // useWindowDimensions is the authoritative source for screen height.
  // It is passed to both snapToInterval and getItemLayout so they always
  // agree — this is what makes Android snapping reliable.
  const { height } = useWindowDimensions();

  const { activeIndex, onViewableItemsChanged, viewabilityConfig } = useVideoFeed();
  const {
    isMuted,
    toggleMute,
    subtitlesVisible,
    toggleSubtitles,
    subtitleMode,
    setSubtitleMode,
  } = useVideoPlayback();

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

  // getItemLayout provides exact dimensions upfront — required for
  // snapToInterval + getItemLayout to work reliably on both iOS and Android.
  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: height,
      offset: height * index,
      index,
    }),
    [height],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: FeedVideo; index: number }) => (
      <FeedVideoItem
        video={item}
        isActive={index === activeIndex}
        isMuted={isMuted}
        onMuteToggle={toggleMute}
        subtitlesVisible={subtitlesVisible}
        onSubtitlesToggle={toggleSubtitles}
        subtitleMode={subtitleMode}
        onModeChange={setSubtitleMode}
      />
    ),
    [activeIndex, isMuted, toggleMute, subtitlesVisible, toggleSubtitles, subtitleMode, setSubtitleMode],
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

  if (videos.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>No videos yet.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={videos}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      getItemLayout={getItemLayout}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig.current}
      showsVerticalScrollIndicator={false}
      // Snap-to-video — both props are required for cross-platform reliability:
      //   pagingEnabled:          iOS native UIScrollView paging
      //   snapToInterval:         Android explicit snap interval (= screen height)
      //   decelerationRate:       quick snap deceleration on both platforms
      //   disableIntervalMomentum: prevents skipping multiple videos in one swipe
      pagingEnabled
      snapToInterval={height}
      decelerationRate="fast"
      disableIntervalMomentum
      // windowSize=5: renders current + 2 above + 2 below = preloads next 2 videos.
      // Each mounted-but-inactive FeedVideoItem loads its video via expo-video /
      // HLS.js immediately, so the next video is buffered before the user gets there.
      windowSize={5}
      maxToRenderPerBatch={2}
      initialNumToRender={1}
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: '#000',
  },
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
