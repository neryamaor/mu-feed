// useVideoFeed — feed-level video management.
// Tracks which video index is currently active (visible on screen) and
// provides the viewability config + callback for the FlatList.
//
// Design note: onViewableItemsChanged is stored in a useRef so its reference
// never changes — React Native FlatList crashes if this callback is swapped
// after the initial render.

import { useState, useRef } from 'react';
import type { ViewToken } from 'react-native';

export function useVideoFeed(initialIndex = 0) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  // Keep a ref to the setter so the stable callback below always has access
  // to the latest dispatch without needing to be recreated.
  const setActiveIndexRef = useRef(setActiveIndex);
  setActiveIndexRef.current = setActiveIndex;

  // Stable function reference — never changes after mount.
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndexRef.current(viewableItems[0].index);
      }
    },
  ).current;

  // A video is considered active when ≥60% of its height is on screen.
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  });

  return { activeIndex, onViewableItemsChanged, viewabilityConfig };
}
