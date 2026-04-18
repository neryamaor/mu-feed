// ContextualFeed — reusable full-screen TikTok-style feed component.
//
// Used by:
//   - app/(tabs)/feed/index.tsx  (main feed, no close button)
//   - app/video/[source]/[id].tsx (contextual feed from favorites or search,
//                                  with a close button that navigates back)
//
// Accepts a pre-loaded video list and an initial index. All snap-to-video
// behaviour, playback state, subtitle state, and favorites state live here.

import { useEffect, useState, useCallback } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FeedVideoItem from './FeedVideoItem';
import { useVideoFeed } from '../hooks/useVideoFeed';
import { useVideoPlayback } from '../hooks/useVideoPlayback';
import { useAuth } from '../hooks/useAuth';
import { getFavoritedVideoIds, toggleFavorite } from '../services/favorites';
import type { FeedVideo } from '../types';

interface Props {
  videos: FeedVideo[];
  initialIndex: number;
  onClose?: () => void;
}

export default function ContextualFeed({ videos, initialIndex, onClose }: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const { activeIndex, onViewableItemsChanged, viewabilityConfig } = useVideoFeed(initialIndex);
  const {
    isMuted,
    toggleMute,
    subtitlesVisible,
    toggleSubtitles,
    subtitleMode,
    setSubtitleMode,
  } = useVideoPlayback();
  const { isAdmin } = useAuth();

  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    getFavoritedVideoIds()
      .then(setFavoritedIds)
      .catch(() => {});
  }, []);

  const handleFavoriteToggle = useCallback(async (videoId: string) => {
    // Optimistic update
    setFavoritedIds((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) { next.delete(videoId); } else { next.add(videoId); }
      return next;
    });
    try {
      await toggleFavorite(videoId);
    } catch {
      // Revert on error
      setFavoritedIds((prev) => {
        const next = new Set(prev);
        if (next.has(videoId)) { next.delete(videoId); } else { next.add(videoId); }
        return next;
      });
    }
  }, []);

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
        isActive={index === activeIndex && isFocused}
        isMuted={isMuted}
        onMuteToggle={toggleMute}
        subtitlesVisible={subtitlesVisible}
        onSubtitlesToggle={toggleSubtitles}
        subtitleMode={subtitleMode}
        onModeChange={setSubtitleMode}
        isAdmin={isAdmin}
        isFavorited={favoritedIds.has(item.id)}
        onFavoriteToggle={() => handleFavoriteToggle(item.id)}
      />
    ),
    [activeIndex, isFocused, isMuted, toggleMute, subtitlesVisible, toggleSubtitles, subtitleMode, setSubtitleMode, isAdmin, favoritedIds, handleFavoriteToggle],
  );

  return (
    <>
      <FlatList
        data={videos}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        initialScrollIndex={initialIndex}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig.current}
        showsVerticalScrollIndicator={false}
        pagingEnabled
        snapToInterval={height}
        decelerationRate="fast"
        disableIntervalMomentum
        windowSize={5}
        maxToRenderPerBatch={2}
        initialNumToRender={1}
        style={styles.list}
      />

      {/* Close button — only rendered when a close handler is provided */}
      {onClose && (
        <Pressable
          style={[styles.closeButton, { top: insets.top + 8 }]}
          onPress={onClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: '#000',
  },
  closeButton: {
    position: 'absolute',
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
