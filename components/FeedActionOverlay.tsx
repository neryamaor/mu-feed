// FeedActionOverlay — UI action buttons rendered on top of the video in the feed.
// The outer container is pointerEvents="box-none" so taps on transparent areas
// fall through to the video beneath. Only the visible buttons capture touches.
//
// Current actions:
//   - Mute toggle
//   - Subtitles toggle (hide/show — visual only, useSubtitles keeps running)
//   - Favorites toggle (save/unsave the current video)

import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';

interface Props {
  isMuted: boolean;
  onMuteToggle: () => void;
  subtitlesVisible: boolean;
  onSubtitlesToggle: () => void;
  isFavorited: boolean;
  onFavoriteToggle: () => void;
}

export default function FeedActionOverlay({
  isMuted,
  onMuteToggle,
  subtitlesVisible,
  onSubtitlesToggle,
  isFavorited,
  onFavoriteToggle,
}: Props) {
  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.actions}>
        <ActionButton onPress={onMuteToggle} label={isMuted ? '🔇' : '🔊'} />
        {/* CC = closed captions — industry-standard icon for subtitle toggle */}
        <ActionButton
          onPress={onSubtitlesToggle}
          label="CC"
          active={subtitlesVisible}
        />
        <ActionButton
          onPress={onFavoriteToggle}
          label={isFavorited ? '♥' : '♡'}
          active={isFavorited}
        />
      </View>
    </View>
  );
}

// ─── ActionButton ──────────────────────────────────────────────────────────────

interface ActionButtonProps {
  onPress: () => void;
  label: string;
  /** When true the button appears highlighted (used for toggle-on state). */
  active?: boolean;
}

function ActionButton({ onPress, label, active }: ActionButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, active === false && styles.buttonInactive]}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Text style={[styles.label, active === false && styles.labelInactive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  actions: {
    position: 'absolute',
    right: 16,
    bottom: 220,
    alignItems: 'center',
    gap: 12,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonInactive: {
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  label: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  labelInactive: {
    color: 'rgba(255,255,255,0.45)',
  },
});
