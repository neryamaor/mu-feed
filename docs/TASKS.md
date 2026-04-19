# TASKS: Palestinian Spoken Arabic Learning App

## How to use this file
Each task has a status indicator:
- `[ ]` — not started
- `[x]` — complete
- `[-]` — in progress

Work through phases in order. Do not start Phase 2 before Phase 1 is complete.
Each task should be given to Claude Code with the relevant context files (PRD.md, ARCHITECTURE.md, SCHEMA.sql).

---

## Phase 1 — Foundation

### 1.1 Project Setup
- [x] Initialize Expo project with TypeScript
- [x] Install and configure Supabase client (`services/supabase.ts`)
- [x] Set up environment variables file (`.env`)
- [x] Run `SCHEMA.sql` in Supabase SQL Editor to create all tables
- [x] Configure Expo Router for tab-based navigation
- [x] Set up folder structure as defined in `ARCHITECTURE.md`
- [x] Create shared TypeScript types in `types/index.ts`

### 1.2 Authentication
- [x] Implement sign up screen using Supabase Auth
- [x] Implement sign in screen using Supabase Auth
- [x] Implement `useAuth` hook for session management
- [x] Protect admin routes — check `admin_permissions` table on login
- [x] Admin panel entry point must be completely invisible to regular users — only users with a row in `admin_permissions` see any indication that an admin area exists
- [x] Add sign out functionality

### 1.3 Video Feed (Full-Screen Auto-Play)
- [x] Build `FeedVideoItem` component — full-screen video with overlay support
- [x] Implement auto-play behavior: video plays when visible, pauses when scrolled away
- [x] Implement auto-loop: video restarts automatically when it reaches the end
- [x] Sound on by default
- [x] Build feed screen as a vertical FlatList of `FeedVideoItem` components (one video visible at a time, full-screen)
- [x] Snap-to-video: `pagingEnabled`, `snapToInterval` (screen height), `decelerationRate="fast"`, `disableIntervalMomentum=true` — user cannot stop between two videos or skip multiple in one swipe
- [x] Fetch published videos from Supabase and render in feed
- [x] Connect to Mux for video streaming (`services/video.ts`)
- [x] Build `FeedActionOverlay` component — UI action buttons displayed on top of the video (e.g., save to favorites; exact actions TBD)
- [x] Preload adjacent videos for smooth scroll experience
- [x] Implement loading state for feed (while videos are fetching/buffering) — design TBD
- [x] Keep `VideoCard` component for use in search results only (thumbnail, title, category, difficulty)

### 1.4 Interactive Subtitles
- [x] Build `SubtitleOverlay` component that renders current segment as overlay on the feed video
- [x] Implement `useSubtitles` hook — syncs segment display with video timestamp
- [x] Make each word in subtitle tappable
- [x] Add toggle button: Arabic script / Hebrew transliteration / both
- [x] Add option to fully hide subtitles — visual-only hide; `useSubtitles` continues tracking the current segment in the background so subtitles restore instantly
- [x] Auto-pause video when word is tapped

### 1.5 Tap-to-Translate
- [x] Build `WordTooltip` component (inline popup, not a new screen)
- [x] On word tap: fetch `context_translation_id` for that `segment_word`
- [x] Display context translation and transliteration in tooltip
- [x] If word is part of a phrase: display full phrase and its translation
- [x] Add "save to dictionary" button inside tooltip
- [x] Close tooltip on tap outside → resume video

### 1.6 Personal Dictionary
- [x] Build personal dictionary screen
- [x] Implement `useDictionary` hook
- [x] On save: write to `personal_dictionary` table (user_id + dictionary_entry_id)
- [x] Display all saved entries with ALL translations from `translations` table
- [x] Handle duplicate save gracefully (UNIQUE constraint already in schema)

### 1.7 Search
- [x] Build search screen with text input
- [x] Implement `services/search.ts` — all search logic lives here only
- [x] Search across: video title, tag name, arabic_text, hebrew_translation, transliteration
- [x] Use `pg_trgm` similarity matching via Supabase
- [x] Display results as list of matching videos

### 1.8 Admin Panel — Video Upload Workflow

This is a multi-step wizard. Each step has both an automatic (API-powered) path and a manual input path. The admin can skip any API call and type or paste content directly.

**Step 1 — Video Upload**
- [x] Build admin upload screen (protected route, visible only to users in `admin_permissions`)
- [x] Implement video file upload to Mux via `services/video.ts` — use Mux direct upload URL flow
- [x] Store Mux asset ID and streaming URL in Supabase; save video record with `status = 'draft'`

**Step 2 — Transcription**
- [x] Auto path: call Whisper API via `services/whisper.ts` using the Mux video URL
- [x] Parse Whisper JSON response into segments (start_time, end_time, arabic_text, words array)
- [x] Manual path: admin can skip Whisper and paste Arabic text directly; admin sets segment timestamps manually
- [x] Build transcription review UI — displays each segment with its timestamp; admin can edit Arabic text per segment
- [x] Save approved segments to `segments` table

**Step 3 — Translation + Transliteration**
- [x] Auto path: call Claude API via `services/translation.ts` — single call per segment returns both `translation` (Hebrew) and `transliteration` (Hebrew letters) as JSON
- [x] Claude system prompt: treat input as Palestinian Spoken Arabic; return natural everyday Hebrew translation and phonetic Hebrew-letter transliteration; return only valid JSON `{ "translation": "...", "transliteration": "..." }`
- [x] Manual path: admin can skip Claude and type/paste Hebrew translation and/or transliteration directly per segment
- [x] Build translation review UI — displays each segment with its Arabic text, Hebrew translation, and transliteration side by side; admin can edit any field

**Step 4 — Phrase Marking**
- [x] In the translation review UI, allow admin to mark multi-word phrases:
  - Admin taps first word → word is highlighted
  - Admin taps last word → full range is highlighted
  - "Mark as phrase" button appears → tapping it creates a phrase unit
  - Admin enters or confirms the phrase translation
- [x] Phrase creates a new `dictionary_entries` row with `is_phrase = true` if it doesn't already exist

**Step 5 — Dictionary Sync**
- [x] After admin approves all segments: run `services/dictionary.ts` sync
- [x] For each word and phrase:
  - Does not exist in `dictionary_entries` → INSERT new entry and translation
  - Exists with identical translation → skip
  - Exists with different translation → show conflict UI: admin chooses "replace" or "add as additional translation"
- [x] Write approved `segment_words` rows linking each word to its `dictionary_entry_id` and `context_translation_id`

**Step 6 — Metadata + Publish**
- [x] Admin sets: category (select from existing), tags (multi-select or create new), difficulty level (1–5)
- [x] Publish button: update video `status` to `'published'` and set `published_at` timestamp

### 1.9 Admin Panel — Post-Publish Video Editing

- [x] Admin video list screen (`app/admin/videos/index.tsx`) — shows all videos (draft + published), title, status badge, difficulty, published date; "ערוך" button navigates to the edit screen; "+ העלאה" button links to the upload flow; accessible from a "ניהול סרטונים" link in the upload screen header
- [x] Admin edit screen (`app/admin/videos/[id]/edit.tsx`) — single scrollable form (not a wizard); editable fields: title, difficulty (1–5), category (radio), tags (toggle chips + inline create), segments (arabic_text, start_time, end_time, per-word hebrew + transliteration)
- [x] Save logic: title/difficulty → `videos`; category → delete+insert `video_categories`; tags → upsert `tags`, delete+insert `video_tags`; segment text/timing → `segments`; translations → `translations` rows via `context_translation_id` only (never `dictionary_entries`, never other videos' rows)
- [x] Feed edit button — `FeedVideoItem` accepts `isAdmin?: boolean`; when true shows a small "✏ ערוך" overlay button (top-left) that navigates to the edit screen; `isAdmin` is passed from the feed screen via `useAuth`
- [x] All data fetching and saving logic in `services/videoEdit.ts` (`fetchAllVideosForAdmin`, `fetchVideoForEdit`, `fetchCategoriesAndTags`, `saveVideoEdit`)
- [x] New types added to `types/index.ts`: `AdminVideoListItem`, `EditableSegmentWord`, `EditableSegment`, `VideoEditData`, `VideoEditSavePayload`
- [x] Words without a `context_translation_id` have their translation inputs disabled (no translation row to update)
- [x] Cancel button navigates back without saving; success/error feedback shown inline after save

**Decisions:**
- Translation saves use UPDATE in-place on the `translations` row (not copy-on-write). If a translations row is shared across videos via an identical context_translation_id, editing one would affect the other. In practice this is unlikely since each upload creates new translation rows; copy-on-write deferred to Phase 2 if it becomes an issue.
- Video file (Mux asset) is not replaceable from the edit screen — out of scope per task spec.

### 1.10 AI Suggestions for Video Metadata

- [x] New Edge Function `supabase/functions/suggest-metadata/index.ts` — accepts `{ transcript, categories[] }`, calls Claude (or OpenAI via `TRANSLATION_API_PROVIDER`), returns `{ title, tags, category }`; strips markdown fences, validates shape, returns `{ error }` on failure
- [x] `suggestVideoMetadata(transcript, categoryNames)` added to `services/translation.ts` — calls `suggest-metadata` Edge Function, returns `MetadataSuggestion | null` (null on any error)
- [x] `MetadataSuggestion` type added to `types/index.ts`
- [x] After `translateAll()` completes in Step 3, fires `suggestVideoMetadata` as a background promise (non-blocking); result stored in `aiSuggestion` state when it resolves
- [x] `useEffect` watches `[aiSuggestion, step]` and pre-fills Step 6 fields when they are still empty: title → `videoTitle`, tags → `tags`, category → `selectedCategoryId` (matched by name, case-insensitive)
- [x] Step 6 gains a title `TextInput` (pre-fillable); publish handler includes `title` override when filled
- [x] "✨ הוצע ע"י AI" label shown next to title / category / tags headings when the field was AI-filled; label clears when admin edits the field
- [x] Graceful fallback: if suggestion call fails, Step 6 loads normally with empty fields
- [x] `clearStepsAfter`: going back to Step 2 clears `aiSuggestion` (translation redone → suggestion stale); going back to Steps 3–5 keeps `aiSuggestion` but clears `videoTitle` and AI-suggested flags so Step 6 can re-prefill when re-entered

**Decisions:**
- Suggestion fires after `translateAll()` (end of Step 3), not after manual confirmation. This maximises the time available for the network call before the admin reaches Step 6.
- Category matching is case-insensitive string comparison against category names — no fuzzy matching needed since Claude is given the exact list.
- Title field in Step 6 is optional: if left empty, the title set in Step 1 (upload screen) is preserved.

### 1.11 Credit / Source Field and Feed Display
- [x] Migration `supabase/migrations/20260417000000_add_source_credit.sql` — `ALTER TABLE videos ADD COLUMN source_credit text;`
- [x] `source_credit: string | null` added to `Video` interface; `sourceCredit` added to `VideoEditData` and `VideoEditSavePayload` in `types/index.ts`
- [x] `services/videoEdit.ts` — `source_credit` included in `fetchVideoForEdit` select and `saveVideoEdit` UPDATE
- [x] Wizard Step 6 (`app/admin/review/index.tsx`) — "קרדיט / מקור" optional TextInput; saved as `source_credit` (empty → null) on publish; cleared by `clearStep6Fields`
- [x] Admin edit screen (`app/admin/videos/[id]/edit.tsx`) — same "קרדיט / מקור" field loaded from DB and saved via `saveVideoEdit`
- [x] `FeedVideoItem` — ⓘ button (top-left, only when `source_credit` non-empty); tapping opens inline popup showing credit text; tapping outside the popup closes it; stacks below admin edit button when both visible

**Decisions:**
- Empty string credit field saves as `null` (not empty string) so the ⓘ button check `!!video.source_credit` works correctly.
- Popup is positioned at bottom-left of the screen (above tab bar) to avoid covering subtitles.

### 1.12 Copyright & DMCA Page
- [x] Static screen at `app/(tabs)/profile/copyright.tsx` — no database queries
- [x] Sections (in Hebrew): intro paragraph, Content & Copyright, Report Copyright Infringement (DMCA), Disclaimer
- [x] DMCA contact button opens `mailto:neryamaor1@gmail.com` with pre-filled subject "Copyright Infringement Report — MuFeed"
- [x] "זכויות יוצרים וחוק" row added to profile screen (`app/(tabs)/profile/index.tsx`) navigates to the copyright screen

**Decisions:**
- Screen is inside `app/(tabs)/profile/` (not a new tab) so Expo Router's file-based routing serves it as a stack push within the profile tab — no layout changes needed.
- Text is right-aligned Hebrew throughout; the email address is displayed as-is below the button for copy reference.
- Back button uses `router.back()` (not `router.replace`) so the user returns to the profile screen naturally.

### 1.13 — Pause Feed Video When Leaving Tab
- [x] `useIsFocused()` from `@react-navigation/native` imported in feed screen
- [x] `isActive` prop for each `FeedVideoItem` gated on `isFocused`: `index === activeIndex && isFocused`
- [x] When tab loses focus all videos receive `isActive=false` → existing play/pause effect pauses them; when tab regains focus the active video resumes — no changes to `useVideoPlayback` or `FeedVideoItem`

**Decisions:**
- Used `useIsFocused` (already available via React Navigation, which Expo Router wraps) rather than `useFocusEffect` because the value is needed as a prop condition, not a side-effect callback.
- No changes to `FeedVideoItem` or `useVideoPlayback` — the pause is achieved purely by gating the `isActive` prop.

### 1.14 — Restructure Tab Order and Navigation
- [x] New tab order: Feed | מילון (Dictionary) | למידה (Learn) | חיפוש (Search) | פרופיל (Profile)
- [x] `app/(tabs)/_layout.tsx` updated — Flashcards registered with `href: null` to hide from tab bar while keeping route accessible
- [x] New `app/(tabs)/learn/index.tsx` — segmented control (row-reverse RTL) toggles between "מילון גלובלי" and "דקדוק"; both sections show placeholder empty state with "בקרוב" message
- [x] `app/(tabs)/dictionary/index.tsx` — "כרטיסיות ›" button in header row navigates to `/flashcards`
- [x] Tab labels updated to Hebrew: פיד, מילון, למידה, חיפוש, פרופיל

**Decisions:**
- Flashcards kept as a valid route (`href: null` hides the tab but preserves navigation) so the flashcards screen remains accessible from the dictionary screen without any extra routing setup.
- Learn tab uses a local `useState` toggle rather than nested navigation — the two sections are simple placeholders and don't require their own route stack yet.

### 1.15 — Favorites System
- [x] Migration `supabase/migrations/20260418155744_add_video_favorites.sql` — `video_favorites` table with `(user_id, video_id)` UNIQUE constraint and `idx_video_favorites_user_id` index
- [x] `VideoFavorite` type added to `types/index.ts`
- [x] `services/favorites.ts` — `getFavoritedVideoIds()`, `toggleFavorite(videoId)`, `getUserFavorites()`; all use `supabase.auth.getUser()` internally
- [x] `FeedActionOverlay` — new `isFavorited` + `onFavoriteToggle` props; heart button (♡/♥) added to action column
- [x] `FeedVideoItem` — `isFavorited?` and `onFavoriteToggle?` props forwarded to `FeedActionOverlay`
- [x] Feed screen — loads `getFavoritedVideoIds()` on mount; `handleFavoriteToggle` does optimistic update + `toggleFavorite` call with revert on error; `favoritedIds` and handler passed to each `FeedVideoItem`
- [x] Profile screen — "הסרטונים המועדפים שלי" section reloads on tab focus via `useFocusEffect`; tapping a favorite shows alert "סרטון בודד — בקרוב" (single-video view deferred to Task 2.6)
- [x] Profile screen switched from `View` to `ScrollView` to accommodate the favorites list

**Decisions:**
- Optimistic update on heart tap: local state updates immediately, DB call fires async, reverts on error. No loading state needed on the button.
- `getUserFavorites()` joins `videos` table to get title for display — avoids a second fetch in the profile screen.
- Single-video navigation deferred to Task 2.6 per spec — tapping a favorite shows an alert placeholder.

**Post-ship fix:** Migration `20260418155744_add_video_favorites.sql` was updated before push to: (1) replace `uuid_generate_v4()` with `gen_random_uuid()` (remote DB lacks the `uuid-ossp` extension), (2) change `REFERENCES users(id)` to `REFERENCES auth.users(id)`, (3) enable RLS and add SELECT / INSERT / DELETE policies (`user_id = auth.uid()`). Without these policies all reads and writes were silently rejected by Supabase's default RLS-enabled-but-no-policies state.

### 1.16 — Contextual Feed (Shared Feed for Favorites & Search)
- [x] `components/ContextualFeed.tsx` — reusable full-screen feed component; accepts `videos: FeedVideo[]`, `initialIndex: number`, `onClose?: () => void`; contains all hook logic (`useVideoFeed`, `useVideoPlayback`, `useAuth`, `useIsFocused`, `useSafeAreaInsets`, favorites state); close button (absolute, top-left circle) rendered only when `onClose` provided
- [x] `app/video/[source]/[id].tsx` — contextual feed route; parses `videos` JSON param from navigation, finds `initialIndex` by `id`, renders `<ContextualFeed>`; calls `router.back()` on bad/missing params
- [x] `hooks/useVideoFeed.ts` — added optional `initialIndex = 0` param so `ContextualFeed` can start scrolled to the tapped video; non-breaking change
- [x] `app/(tabs)/feed/index.tsx` — refactored to thin wrapper (~40 lines); all hook calls moved to `ContextualFeed`; returns `<ContextualFeed videos={videos} initialIndex={0} />`
- [x] `app/(tabs)/profile/index.tsx` — tap handler maps `VideoFavorite[]` → `FeedVideo[]` with safe defaults, navigates to `/video/favorites/${fav.videoId}` with `videos` JSON param
- [x] `app/(tabs)/search/index.tsx` — `VideoCard` `onPress` navigates to `/video/search/${item.id}` with `videos: JSON.stringify(results)`

**Decisions:**
- Video list is passed as `JSON.stringify(FeedVideo[])` navigation param — no re-fetch in the contextual feed route. Source screens (profile, search) already have the list loaded.
- Profile maps `VideoFavorite[]` → `FeedVideo[]` at navigation time with null/[] defaults for missing fields (`source_credit: null`, `video_categories: []`, etc.) — `FeedVideoItem` only needs `id`, `url`, and `source_credit`.
- Route fails fast: if `videos` param is absent or malformed, calls `router.back()` immediately rather than re-fetching or showing an error screen.
- `source` segment in the route (`favorites` / `search`) is available for future analytics but not used in the current implementation.

---

## Phase 2 — Advanced Features

### 2.0 Final Tab Structure and Navigation Restructure
- [x] `app/(tabs)/_layout.tsx` — new RTL tab order: פרופיל | מילון | לימוד | חיפוש | פיד; Ionicons added to every tab; dark tab bar (`#111`); active color `#2563eb`
- [x] `app/(tabs)/profile/index.tsx` — gear icon (⚙) in top-right navigates to settings; sign out + legal buttons removed (moved to settings)
- [x] `app/(tabs)/profile/settings.tsx` (NEW) — "אודות MuFeed" paragraph, "זכויות יוצרים וחוק" row (navigates to copyright), "התנתקות" sign out button (red), version string "גרסה 1.0.0"
- [x] `app/(tabs)/dictionary/index.tsx` — segmented control added; Section A (מילון אישי) = existing personal dict content with "כרטיסיות ›" button; Section B (מילון גלובלי) = placeholder "בקרוב"
- [x] `app/(tabs)/learn/index.tsx` — sections renamed: דקדוק (was "מילון גלובלי", placeholder) + ביטויים (new, placeholder); global dictionary moved to מילון tab

**Decisions:**
- Icon library: `@expo/vector-icons` / `Ionicons` — bundled with Expo SDK, no additional install needed. Icons chosen: `person-outline`, `book-outline`, `school-outline`, `search-outline`, `play-circle-outline`.
- Settings screen is a stack push within the profile tab (file at `app/(tabs)/profile/settings.tsx`) — Expo Router's file-based routing serves it as a modal/push without any extra layout configuration.
- Sign out moved entirely to settings; profile screen now shows only user info, admin entry, and favorites. Keeps the profile screen focused.
- Learn tab no longer has "מילון גלובלי" — that concept lives in the מילון tab (Section B). Learn is reserved for grammar and expressions.

### 2.1 Enhanced Search — Dictionary Results and Context
- [x] Language detection: Arabic (U+0600–U+06FF) vs Hebrew — drives all enrichment paths
- [x] `DictionaryResult`, `VideoSearchResult`, `SearchResults` types added to `types/index.ts`
- [x] `services/search.ts` fully rewritten — `searchVideos()` now returns `SearchResults`; all logic here, no search code elsewhere
- [x] Dictionary results (up to 3): Arabic → ilike `arabic_text`; Hebrew → ilike `translations` (dedup by entry)
- [x] Video enrichment — Batch A (tags), Batch B (segments), Arabic JS filter OR Hebrew batch pipeline (C/D/E/F); never one query per video
- [x] Hebrew context reconstruction: `segment_words` → `context_translation_id` → `translations`; assembled in JS by grouping on `segment_id` and sorting by `word_position`
- [x] Match priority: `segment` > `tag` > `title`; sorted by `matchCount DESC`, then `published_at DESC`
- [x] Search screen UI updated: dictionary cards section above video results; section header "סרטונים המכילים את הביטוי"; context line below each VideoCard (segment with query highlight / `תג: #name` / nothing for title); navigation passes `videoResults.map(r => r.video)` to contextual feed

**Decisions:**
- Hebrew context uses `context_translation_id` (video-specific translation), not the global dictionary translation — matches what the subtitle overlay shows.
- Highlight is case-insensitive substring match in JS — consistent with pg_trgm ILIKE used in the DB queries.
- Batch C/D/E/F are always run for Hebrew searches, even when the video set is small — simpler than conditional single-query fallback, and the queries are cheap indexed lookups.

### 2.2 Feed Filtering
- [ ] Add filter UI to feed screen (by category, by difficulty level)
- [ ] Implement filtered queries to Supabase

### 2.2 Active Learning — Flashcards
- [ ] Build `FlashCard` component
- [ ] Build flashcards screen
- [ ] Auto-generate flashcards from user's personal dictionary
- [ ] Track `times_shown` and `times_correct` in `flashcard_sessions` table
- [ ] Implement simple spaced repetition logic (show less-known words more often)

### 2.3 Grammar Section
- [ ] Build grammar rules screen
- [ ] Fetch and display `grammar_rules` from Supabase
- [ ] Filter by category (verb forms, syntax, etc.)
- [ ] Admin UI: create and edit grammar rules

### 2.4 User Profile
Note: profile screen base already exists from task 1.12 (copyright navigation added). This task completes it with stats and level editing.
- [ ] Build profile screen
- [ ] Display: current level, total words saved, flashcard stats
- [ ] Allow user to update their level

### 2.5 Admin Panel — Dictionary Management
- [ ] Build global dictionary management screen for admins
- [ ] Allow admin to view, edit, and delete dictionary entries
- [ ] Allow admin to add or remove translations for existing entries
- [ ] Allow admin to manually add new dictionary entries (arabic_text + translation + transliteration) without going through the video upload flow

---

## Phase 3 — Future

### 3.1 Search Upgrade
- [ ] Set up Elasticsearch instance
- [ ] Configure Arabic root/stemming analyzer
- [ ] Index `dictionary_entries` and `translations` in Elasticsearch
- [ ] Replace `pg_trgm` logic in `services/search.ts` with Elasticsearch queries
- [ ] No other files need to change (search is isolated)

### 3.2 Feed Personalization
- [ ] Define personalization logic (based on user level, watch history)
- [ ] Implement feed ordering algorithm

### 3.3 Access Tiers
- [ ] Define free vs. paid feature set
- [ ] Implement access control based on subscription status

---

## Notes for Claude Code

When starting a new task, always provide these files as context:
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/SCHEMA.sql`

Key reminders:
- All search logic goes in `services/search.ts` only — never elsewhere
- All external API calls go in `services/` only — never in components or screens
- Subtitle timing is segment-level only — do not store word-level timestamps
- Each `segment_word` has two translation references: `dictionary_entry_id` (global) and `context_translation_id` (video-specific)
- Admin panel is part of the same app, protected by `admin_permissions` table
- Video platform is Mux — never reference Cloudflare Stream
- Translation and transliteration are always generated together in a single Claude API call via `services/translation.ts`
- Every automated step in the admin upload workflow (transcription, translation, transliteration) must also have a manual input path
- Phrase marking UX: tap first word → tap last word → "Mark as phrase" button