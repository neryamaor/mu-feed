import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import type { FeedVideo } from '../types';
import { getMuxThumbnailUrl } from '../services/video';

interface Props {
  video: FeedVideo;
  onPress: () => void;
}

export default function VideoCard({ video, onPress }: Props) {
  const categoryName = video.video_categories[0]?.categories?.name;
  const thumbnailUrl = getMuxThumbnailUrl(video.url);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <Image
        source={{ uri: thumbnailUrl }}
        style={styles.thumbnail}
        resizeMode="cover"
      />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {video.title}
        </Text>
        <View style={styles.meta}>
          {categoryName && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{categoryName}</Text>
            </View>
          )}
          <DifficultyDots level={video.difficulty_level} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function DifficultyDots({ level }: { level: number | null }) {
  if (!level) return null;
  return (
    <View style={styles.dotsRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={[styles.dot, i <= level ? styles.dotFilled : styles.dotEmpty]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#e5e7eb',
  },
  info: {
    padding: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    lineHeight: 22,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotFilled: {
    backgroundColor: '#1a1a1a',
  },
  dotEmpty: {
    backgroundColor: '#d1d5db',
  },
});
