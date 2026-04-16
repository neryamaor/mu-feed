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

---

## Phase 2 — Advanced Features

### 2.0 UI Polish
- [ ] Set correct tab order: feed in the center, profile in the bottom right
- [ ] Review and finalize tab bar design and icons
- [ ] Design and implement feed loading state (skeleton/spinner/animation while videos fetch or buffer) — design to be chosen by product owner

### 2.1 Feed Filtering
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
- [ ] Build profile screen
- [ ] Display: current level, total words saved, flashcard stats
- [ ] Allow user to update their level

### 2.5 Admin Panel — Dictionary Management
- [ ] Build global dictionary management screen for admins
- [ ] Allow admin to view, edit, and delete dictionary entries
- [ ] Allow admin to add or remove translations for existing entries

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