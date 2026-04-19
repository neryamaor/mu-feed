// Flashcards session screen — the card-swiping experience.
//
// Receives `cards` (JSON FlashcardCard[]) and `direction` (FlashcardDirection)
// as navigation params from the setup screen.
//
// Animation:
//   - Card flip: Animated.spring on a single Value interpolated to rotateY.
//   - Swipe: PanResponder + Animated.ValueXY (no react-native-reanimated needed).
//   - Tilt: position.x interpolated to rotate.
//   - Overlay labels: position.x interpolated to opacity.
//
// Round logic lives entirely in component state — flashcard_sessions is write-only.

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Animated,
  PanResponder,
  Dimensions,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { recordCardResult } from '../../../services/flashcards';
import type { FlashcardCard, FlashcardDirection } from '../../../types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.4;

type Phase = 'swiping' | 'roundComplete' | 'sessionComplete';

export default function FlashcardsSessionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cards: cardsParam, direction: dirParam } = useLocalSearchParams<{
    cards: string;
    direction: string;
  }>();

  const allCards: FlashcardCard[] = JSON.parse(cardsParam ?? '[]');
  const direction = (dirParam ?? 'ar-to-he') as FlashcardDirection;

  // ── Round state ─────────────────────────────────────────────────────────────
  const [currentRound, setCurrentRound] = useState<FlashcardCard[]>(allCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  // leftSwiped accumulates unknown cards for the next round.
  // We use a ref for commitSwipe so the closure always sees the latest value.
  const leftSwipedRef = useRef<FlashcardCard[]>([]);
  const hasSwipedRef = useRef(false); // Fix 3B: true after the first swipe ever
  const [leftSwipedCount, setLeftSwipedCount] = useState(0); // for display
  const [knownCount, setKnownCount] = useState(0); // right-swipes this round
  const [roundNumber, setRoundNumber] = useState(1);
  const [isFlipped, setIsFlipped] = useState(false);
  const [phase, setPhase] = useState<Phase>('swiping');

  // ── Animated values ─────────────────────────────────────────────────────────
  const position = useRef(new Animated.ValueXY()).current;
  const flipAnim = useRef(new Animated.Value(0)).current;
  const hintOpacity = useRef(new Animated.Value(1)).current; // Fix 3B: fades to 0 after first swipe

  // ── Derived animated interpolations ─────────────────────────────────────────
  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 0.5, 0, SCREEN_WIDTH * 0.5],
    outputRange: ['-10deg', '0deg', '10deg'],
    extrapolate: 'clamp',
  });

  const yidatiOpacity = position.x.interpolate({
    inputRange: [0, SCREEN_WIDTH * 0.25],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const loYadatiOpacity = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 0.25, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Flip interpolations — front and back faces
  const frontRotateY = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });
  const backRotateY = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  // ── Wobble hint on first card (Fix 3A) ───────────────────────────────────────
  // Animates position.x so the tilt + overlay labels reinforce the swipe hint.
  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.sequence([
        Animated.timing(position.x, { toValue: -30, duration: 400, useNativeDriver: false }),
        Animated.timing(position.x, { toValue: 0,   duration: 300, useNativeDriver: false }),
        Animated.timing(position.x, { toValue: 30,  duration: 400, useNativeDriver: false }),
        Animated.timing(position.x, { toValue: 0,   duration: 300, useNativeDriver: false }),
      ]).start();
    }, 600);
    return () => clearTimeout(timer);
  }, []); // run once on mount

  // ── Flip handler ────────────────────────────────────────────────────────────
  const flipCard = useCallback(() => {
    const toValue = isFlipped ? 0 : 180;
    setIsFlipped((f) => !f);
    Animated.spring(flipAnim, {
      toValue,
      useNativeDriver: true,
      friction: 8,
      tension: 10,
    }).start();
  }, [isFlipped, flipAnim]);

  // ── Advance to next card ─────────────────────────────────────────────────────
  const advanceCard = useCallback(
    (index: number, round: FlashcardCard[]) => {
      position.setValue({ x: 0, y: 0 });
      setIsFlipped(false);
      flipAnim.setValue(0);

      const nextIndex = index + 1;
      if (nextIndex >= round.length) {
        // Round ended — decide next phase.
        const unknown = leftSwipedRef.current;
        if (unknown.length === 0) {
          setPhase('sessionComplete');
        } else {
          setLeftSwipedCount(unknown.length);
          setPhase('roundComplete');
        }
      } else {
        setCurrentIndex(nextIndex);
      }
    },
    [position, flipAnim],
  );

  // ── Commit swipe ─────────────────────────────────────────────────────────────
  const commitSwipe = useCallback(
    (dir: 'left' | 'right', index: number, round: FlashcardCard[]) => {
      const card = round[index];
      const known = dir === 'right';

      // Fade hint text on first swipe (Fix 3B).
      if (!hasSwipedRef.current) {
        hasSwipedRef.current = true;
        Animated.timing(hintOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      }

      // Fire-and-forget stat write — never awaited.
      recordCardResult(card.entryId, known);

      if (!known) {
        leftSwipedRef.current = [...leftSwipedRef.current, card];
      } else {
        setKnownCount((c) => c + 1);
      }

      Animated.timing(position, {
        toValue: { x: dir === 'right' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5, y: 0 },
        duration: 280,
        useNativeDriver: false,
      }).start(() => advanceCard(index, round));
    },
    [position, advanceCard],
  );

  // ── PanResponder ─────────────────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_e, gesture) => {
        if (Math.abs(gesture.dx) < 10 && Math.abs(gesture.dy) < 10) {
          // Tap (no meaningful drag) → flip the card.
          flipCard();
        } else if (gesture.dx > SWIPE_THRESHOLD) {
          // Use functional access to currentIndex/currentRound to avoid stale closure.
          setCurrentIndex((idx) => {
            setCurrentRound((round) => {
              commitSwipe('right', idx, round);
              return round;
            });
            return idx;
          });
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          setCurrentIndex((idx) => {
            setCurrentRound((round) => {
              commitSwipe('left', idx, round);
              return round;
            });
            return idx;
          });
        } else {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
            friction: 5,
          }).start();
        }
      },
    }),
  ).current;

  // ── Start next round ─────────────────────────────────────────────────────────
  function startNextRound() {
    const nextRound = leftSwipedRef.current;
    leftSwipedRef.current = [];
    setLeftSwipedCount(0);
    setKnownCount(0);
    setCurrentRound(nextRound);
    setCurrentIndex(0);
    setRoundNumber((r) => r + 1);
    position.setValue({ x: 0, y: 0 });
    flipAnim.setValue(0);
    setIsFlipped(false);
    setPhase('swiping');
  }

  // ── Restart session ──────────────────────────────────────────────────────────
  function restartSession() {
    leftSwipedRef.current = [];
    setLeftSwipedCount(0);
    setKnownCount(0);
    setCurrentRound(allCards);
    setCurrentIndex(0);
    setRoundNumber(1);
    position.setValue({ x: 0, y: 0 });
    flipAnim.setValue(0);
    setIsFlipped(false);
    setPhase('swiping');
  }

  // ── Close confirmation ────────────────────────────────────────────────────────
  function handleClose() {
    Alert.alert('סיום תרגול', 'האם לסיים את התרגול?', [
      { text: 'ביטול', style: 'cancel' },
      { text: 'סיים', style: 'destructive', onPress: () => router.back() },
    ]);
  }

  // ── Current card data ─────────────────────────────────────────────────────────
  const card = currentRound[currentIndex];
  const nextCard = currentRound[currentIndex + 1];

  // ── Render helpers ────────────────────────────────────────────────────────────
  function CardFace({
    card: c,
    isFront,
    rotateY,
  }: {
    card: FlashcardCard;
    isFront: boolean;
    rotateY: Animated.AnimatedInterpolation<string>;
  }) {
    const showArabicSide = isFront ? direction === 'ar-to-he' : direction === 'he-to-ar';
    return (
      <Animated.View
        style={[
          styles.cardFace,
          { transform: [{ perspective: 1000 }, { rotateY }] },
          !isFront && styles.cardFaceBack,
        ]}
      >
        {showArabicSide ? (
          <View style={styles.cardContent}>
            <Text style={styles.cardArabic}>{c.arabicText}</Text>
            <Text style={styles.cardTranslit}>{c.transliteration}</Text>
          </View>
        ) : (
          <View style={styles.cardContent}>
            <Text style={styles.cardHebrew}>{c.hebrewTranslation}</Text>
          </View>
        )}
        <Text style={styles.flipHint}>הקש להפוך</Text>
      </Animated.View>
    );
  }

  // ── Phase: round complete ─────────────────────────────────────────────────────
  if (phase === 'roundComplete') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.overlayCenter}>
          <Text style={styles.overlayTitle}>סיבוב {roundNumber} הושלם</Text>
          <Text style={styles.overlayBody}>
            {leftSwipedCount} מילים לא ידעת — ננסה שוב
          </Text>
          <TouchableOpacity style={styles.overlayButton} onPress={startNextRound}>
            <Text style={styles.overlayButtonText}>התחל סיבוב {roundNumber + 1}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Phase: session complete ───────────────────────────────────────────────────
  if (phase === 'sessionComplete') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.overlayCenter}>
          <Text style={styles.completeEmoji}>🎉</Text>
          <Text style={styles.overlayTitle}>סיימת!</Text>
          <Text style={styles.overlayBody}>
            ידעת את כל {allCards.length} המילים
          </Text>
          <Text style={styles.overlayMeta}>סיבובים: {roundNumber}</Text>
          <TouchableOpacity style={styles.overlayButton} onPress={restartSession}>
            <Text style={styles.overlayButtonText}>התחל שוב</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.overlaySecondaryButton}
            onPress={() => router.navigate('/(tabs)/dictionary')}
          >
            <Text style={styles.overlaySecondaryText}>חזרה למילון</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Phase: swiping ────────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.progress}>
          סיבוב {roundNumber} • כרטיס {currentIndex + 1} מתוך {currentRound.length}
        </Text>
      </View>

      {/* Permanent score pills */}
      <View style={styles.pillsRow}>
        <View style={[styles.pill, styles.pillLeft]}>
          <Text style={styles.pillText}>לא ידעתי {leftSwipedCount}</Text>
        </View>
        <View style={[styles.pill, styles.pillRight]}>
          <Text style={styles.pillText}>ידעתי {knownCount}</Text>
        </View>
      </View>

      {/* Card stack — fixed-size wrapper centered by flex parent (Fix 1) */}
      <View style={styles.cardArea}>
        <View style={styles.cardStack}>
          {/* Next card (static, behind) */}
          {nextCard && (
            <View style={[styles.cardContainer, styles.cardBehind]}>
              <View style={styles.cardStatic}>
                <View style={styles.cardContent}>
                  <Text style={styles.cardPlaceholder}>—</Text>
                </View>
              </View>
            </View>
          )}

          {/* Current card (animated) */}
          {card && (
            <Animated.View
              style={[
                styles.cardContainer,
                {
                  transform: [
                    { translateX: position.x },
                    { translateY: position.y },
                    { rotate },
                  ],
                  zIndex: 1,
                },
              ]}
              {...panResponder.panHandlers}
            >
              {/* "ידעתי" label (green, right swipe) */}
              <Animated.View style={[styles.swipeLabel, styles.swipeLabelRight, { opacity: yidatiOpacity }]}>
                <Text style={styles.swipeLabelText}>ידעתי ✓</Text>
              </Animated.View>

              {/* "לא ידעתי" label (red, left swipe) */}
              <Animated.View style={[styles.swipeLabel, styles.swipeLabelLeft, { opacity: loYadatiOpacity }]}>
                <Text style={styles.swipeLabelText}>לא ידעתי ✗</Text>
              </Animated.View>

              {/* Front face */}
              <CardFace card={card} isFront rotateY={frontRotateY} />
              {/* Back face */}
              <CardFace card={card} isFront={false} rotateY={backRotateY} />
            </Animated.View>
          )}
        </View>
      </View>

      {/* First-card swipe hint (Fix 3B) — fades out after first swipe */}
      <Animated.View style={[styles.hintRow, { opacity: hintOpacity }]}>
        <Text style={styles.hintText}>
          👈 החלק שמאלה — לא ידעתי{'    '}ידעתי — החלק ימינה 👉
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  // ── Top bar ──
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  closeButton: {
    color: '#6b7280',
    fontSize: 20,
    fontWeight: '600',
  },
  progress: {
    color: '#6b7280',
    fontSize: 13,
    textAlign: 'center',
    flex: 1,
    marginRight: 8,
  },
  // ── Score pills ──
  pillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  pill: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  pillLeft: {
    backgroundColor: 'rgba(220,38,38,0.20)',
  },
  pillRight: {
    backgroundColor: 'rgba(22,163,74,0.20)',
  },
  pillText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  // ── Card area ──
  cardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Fixed-size wrapper so justifyContent:'center' on cardArea vertically
  // centers the card stack (absolute children don't participate in flex flow).
  cardStack: {
    width: SCREEN_WIDTH - 40,
    height: 320,
  },
  cardContainer: {
    position: 'absolute',
    width: '100%',
  },
  cardBehind: {
    transform: [{ scale: 0.95 }],
    opacity: 0.6,
    zIndex: 0,
  },
  cardStatic: {
    backgroundColor: '#111',
    borderRadius: 20,
    height: 320,
    borderWidth: 1,
    borderColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardPlaceholder: {
    color: '#374151',
    fontSize: 32,
  },
  // ── Card faces (flip) ──
  cardFace: {
    position: 'absolute',
    width: '100%',
    height: 320,
    backgroundColor: '#111',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1f2937',
    backfaceVisibility: 'hidden',
    justifyContent: 'space-between',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  cardFaceBack: {
    backgroundColor: '#0f1f3d',
    borderColor: '#1e3a5f',
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardArabic: {
    color: '#ffffff',
    fontSize: 38,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  cardHebrew: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  cardTranslit: {
    color: '#9ca3af',
    fontSize: 16,
    textAlign: 'center',
  },
  flipHint: {
    color: '#374151',
    fontSize: 12,
    textAlign: 'center',
  },
  // ── Swipe labels ──
  swipeLabel: {
    position: 'absolute',
    top: 24,
    zIndex: 2,
    borderWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  swipeLabelRight: {
    right: 20,
    borderColor: '#16a34a',
  },
  swipeLabelLeft: {
    left: 20,
    borderColor: '#dc2626',
  },
  swipeLabelText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  // ── First-card swipe hint (Fix 3B) ──
  hintRow: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
  },
  hintText: {
    color: '#4b5563',
    fontSize: 13,
    textAlign: 'center',
  },
  // ── Overlays (round complete / session complete) ──
  overlayCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  completeEmoji: {
    fontSize: 56,
    marginBottom: 8,
  },
  overlayTitle: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  overlayBody: {
    color: '#9ca3af',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  overlayMeta: {
    color: '#4b5563',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
  },
  overlayButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  overlayButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  overlaySecondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
    width: '100%',
  },
  overlaySecondaryText: {
    color: '#6b7280',
    fontSize: 16,
  },
});
