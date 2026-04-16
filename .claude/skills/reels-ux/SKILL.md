---
name: reels-ux
description: >
  Use this skill whenever implementing, reviewing, or modifying any feature related to short-form video feed UX — including scrolling, playback, subtitles, overlays, gestures, audio, loading, or any component inside a video feed (FeedVideoItem, FlatList, overlays, etc.). Also use when the user asks "why does X feel off" or "make it feel more like TikTok/Instagram" or "review the video feed". Trigger even for small changes like a button tap or a subtitle toggle — these often have invisible UX implications covered here. The goal is not to copy TikTok/Instagram exactly, but to avoid missing critical UX patterns that users expect from any short-form video product.
---

# Reels / Short-Form Video UX Checklist

This skill defines the UX standard for the video feed. Read it before implementing or reviewing any feed-related feature. Use it as a self-check: go through each section and verify the current implementation satisfies it.

---

## 1. Scrolling & Snap

| # | Requirement | Why it matters |
|---|-------------|----------------|
| 1.1 | One video fills the full screen — `height = useWindowDimensions().height` | If height is off by even 1px, snap feels broken |
| 1.2 | `snapToInterval={height}` + `pagingEnabled` + `decelerationRate="fast"` | Android needs snapToInterval; iOS needs pagingEnabled; both need fast decel |
| 1.3 | `disableIntervalMomentum={true}` | Prevents fast-swipe from skipping multiple videos |
| 1.4 | Snap target is always the top of a video, never mid-video | Partial video views feel unpolished and break the mental model |
| 1.5 | Scroll is vertical only — no horizontal drift | Add `horizontal={false}` explicitly; accidental horizontal scroll breaks immersion |

**Self-check:** After scrolling quickly through 5 videos, does each one snap cleanly to the top? Does it work the same on Android and iOS?

---

## 2. Playback

| # | Requirement | Why it matters |
|---|-------------|----------------|
| 2.1 | Active video plays automatically when it enters the viewport | Users expect instant play, not a tap-to-start |
| 2.2 | Non-active videos are paused (not just muted) | Background playback drains battery and causes audio bleed |
| 2.3 | Single tap on video toggles pause/play (like TikTok) | Core interaction — users muscle-memorize this |
| 2.4 | A brief pause icon appears on tap-to-pause, then fades | Visual confirmation the tap registered |
| 2.5 | Video loops seamlessly when it ends | No black flash, no buffering on repeat |
| 2.6 | When returning to a video after scrolling away, it resumes from the beginning (not mid-video) | Mid-video resume feels disorienting in a feed context |
| 2.7 | `isWordTapPaused` resets to `false` when `isActive` becomes false | Prevents next video from starting frozen |

**Self-check:** Pause a video, scroll to the next one. Does it auto-play? Scroll back — does the first video restart?

---

## 3. Audio

| # | Requirement | Why it matters |
|---|-------------|----------------|
| 3.1 | Audio plays by default with the video | Mute-by-default kills engagement |
| 3.2 | Mute/unmute state persists across videos in a session | Users who mute once don't want to unmute every video |
| 3.3 | Mute button is always visible in the overlay, with clear on/off state | Users expect to find it in the top-right corner area |
| 3.4 | Tapping mute does not pause the video | Separate interactions; conflating them frustrates users |
| 3.5 | App respects iOS silent mode — video should still play but muted | System audio convention; violating it surprises users |

---

## 4. Gestures

| # | Requirement | Why it matters |
|---|-------------|----------------|
| 4.1 | Single tap on video = pause/play | Universal short-form video convention |
| 4.2 | Word tap = pause + highlight (does not conflict with video tap) | Must use separate Pressable layers with `pointerEvents` managed correctly |
| 4.3 | Tap on transparent overlay areas passes through to the video | `pointerEvents="box-none"` on overlay containers |
| 4.4 | No double-tap action is required (nice-to-have: like animation) | Double-tap like is a known pattern but not blocking |
| 4.5 | Long-press on video does not trigger a system action (no iOS preview) | Wrap video in a View with `onStartShouldSetResponder` if needed |
| 4.6 | After word-tap pause: tapping video (not a word) resumes play | Clear recovery path — user should never feel stuck |

**Self-check:** Tap a word → video pauses. Now tap an empty area of the video → does it resume?

---

## 5. Subtitles & Overlay

| # | Requirement | Why it matters |
|---|-------------|----------------|
| 5.1 | Subtitles are visible by default | Language-learning context — subtitles are the core feature |
| 5.2 | `subtitlesVisible` and `subtitleMode` live at feed level, not per-video | Settings persist when scrolling — users set it once |
| 5.3 | Hiding subtitles does not unmount `useSubtitles` hook | Instant restore with no re-fetch or timing gap |
| 5.4 | Active subtitle segment updates every 100ms | Feels in sync with speech |
| 5.5 | RTL text (Arabic/Hebrew) uses `flexDirection: 'row-reverse'` | Words in wrong order is a critical bug for the target audience |
| 5.6 | Subtitle overlay uses `pointerEvents="box-none"` | Transparent areas must not eat touches meant for the video |
| 5.7 | Subtitle mode toggle (e.g. Arabic / Transliteration / Translation) is always accessible | Users switch modes frequently; burying it kills the feature |
| 5.8 | No subtitle flicker when switching modes | Mode switch should be instant with no layout jump |

---

## 6. Loading & Performance

| # | Requirement | Why it matters |
|---|-------------|----------------|
| 6.1 | Next 2–3 videos are preloaded before the user reaches them | Zero wait time on scroll is the benchmark |
| 6.2 | `windowSize` and `initialNumToRender` are tuned on FlatList | Prevents dropped frames on older devices |
| 6.3 | Every `setInterval` has a `clearInterval` in its `useEffect` cleanup | Stacked timers → slowdown → crash. Non-negotiable. |
| 6.4 | Every subscription / event listener is removed on unmount | Same principle as 6.3 |
| 6.5 | `getActiveSegment` is a stable `useCallback` — not recreated on every render | Called 10x/second; instability causes re-render cascade |
| 6.6 | Videos not in the active window are fully paused and not polling | Background polling is invisible in dev but brutal on real devices |
| 6.7 | Loading placeholder shown while video buffers (spinner or skeleton) | Blank screen feels broken; any indicator is better |

**Self-check:** Scroll through 20 videos rapidly. Open React DevTools or Profiler. Are intervals accumulating?

---

## 7. Visual Polish

| # | Requirement | Why it matters |
|---|-------------|----------------|
| 7.1 | No black frames between videos during scroll | Caused by video not preloaded; very noticeable |
| 7.2 | Overlay UI (buttons, subtitles) has enough contrast against any video | Use semi-transparent backgrounds or text shadows |
| 7.3 | Tap feedback is immediate — no perceptible delay on any button | >100ms delay feels broken on mobile |
| 7.4 | CC / subtitle toggle button shows clear active/inactive state | Icon color or fill change; not just opacity |
| 7.5 | Progress bar (if present) does not jump or flicker | Smooth update tied to currentTime |
| 7.6 | Safe area insets respected (notch, home indicator) | Bottom overlay buttons must not be under the home bar |

---

## 8. State Management Rules

These are architectural rules, not suggestions. Violating them causes bugs that are hard to debug.

| # | Rule |
|---|------|
| 8.1 | `subtitlesVisible` and `subtitleMode` → feed level (useVideoPlayback or context) |
| 8.2 | `isWordTapPaused` → per-video, resets on `isActive = false` |
| 8.3 | `currentTime` polling → starts only when `isActive = true`, clears on `isActive = false` or unmount |
| 8.4 | `useSubtitles` → per-video, always mounted, fetch on mount, never refetch on re-render |
| 8.5 | Mute state → feed level, persists across videos |

---

## How to use this skill

When implementing a feature, find the relevant section(s) above and verify each row. If a row is not satisfied, fix it before moving on.

When reviewing existing code, use this as a rubric: go section by section and flag any row that is not currently satisfied. Report findings as: **[section#.row#] description of the gap**.

When the user asks "does this feel right?" or "why does X feel off?" — map the symptom to a row in this checklist and address the root cause.