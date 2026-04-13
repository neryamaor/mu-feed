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
- [ ] Initialize Expo project with TypeScript
- [ ] Install and configure Supabase client (`services/supabase.ts`)
- [ ] Set up environment variables file (`.env`)
- [ ] Run `SCHEMA.sql` in Supabase SQL Editor to create all tables
- [ ] Configure Expo Router for tab-based navigation
- [ ] Set up folder structure as defined in `ARCHITECTURE.md`
- [ ] Create shared TypeScript types in `types/index.ts`

### 1.2 Authentication
- [ ] Implement sign up screen using Supabase Auth
- [ ] Implement sign in screen using Supabase Auth
- [ ] Implement `useAuth` hook for session management
- [ ] Protect admin routes — check `admin_permissions` table on login
- [ ] Add sign out functionality

### 1.3 Video Feed
- [ ] Create `VideoCard` component (thumbnail, title, category, difficulty)
- [ ] Build feed screen that fetches published videos from Supabase
- [ ] Implement vertical scroll behavior
- [ ] Connect to Cloudflare Stream for video playback
- [ ] Build `VideoPlayer` component with basic playback controls

### 1.4 Interactive Subtitles
- [ ] Build `SubtitleOverlay` component that renders current segment as full sentence
- [ ] Implement `useSubtitles` hook — syncs segment display with video timestamp
- [ ] Make each word in subtitle tappable
- [ ] Add toggle button: Arabic script / Hebrew transliteration / both
- [ ] Auto-pause video when word is tapped

### 1.5 Tap-to-Translate
- [ ] Build `WordTooltip` component (inline popup, not a new screen)
- [ ] On word tap: fetch `context_translation_id` for that `segment_word`
- [ ] Display context translation and transliteration in tooltip
- [ ] If word is part of a phrase: display full phrase and its translation
- [ ] Add "save to dictionary" button inside tooltip
- [ ] Close tooltip on tap outside → resume video

### 1.6 Personal Dictionary
- [ ] Build personal dictionary screen
- [ ] Implement `useDictionary` hook
- [ ] On save: write to `personal_dictionary` table (user_id + dictionary_entry_id)
- [ ] Display all saved entries with ALL translations from `translations` table
- [ ] Handle duplicate save gracefully (UNIQUE constraint already in schema)

### 1.7 Search
- [ ] Build search screen with text input
- [ ] Implement `services/search.ts` — all search logic lives here only
- [ ] Search across: video title, tag name, arabic_text, hebrew_translation, transliteration
- [ ] Use `pg_trgm` similarity matching via Supabase
- [ ] Display results as list of matching videos

### 1.8 Admin Panel — Video Upload Workflow
- [ ] Build admin upload screen (protected route)
- [ ] Implement video file upload to Cloudflare Stream (`services/video.ts`)
- [ ] Save video record to Supabase with status = 'draft'
- [ ] Call Whisper API after upload (`services/whisper.ts`)
- [ ] Parse Whisper JSON response into segments and words
- [ ] Build transcription review UI — admin can correct Arabic text word by word
- [ ] Call translation API after transcription approval (`services/translation.ts`)
- [ ] Use prompt: "This is Palestinian Spoken Arabic. Translate to everyday Hebrew. Return only the translation, no explanation."
- [ ] Build translation review UI — admin can correct Hebrew translation
- [ ] Implement phrase marking — admin selects multiple words and marks as one unit
- [ ] Sync all words and phrases to `dictionary_entries` + `translations` tables via `services/dictionary.ts`
- [ ] Handle translation conflicts: if word exists with different translation → prompt admin: replace or add?
- [ ] Admin sets category, tags, and difficulty level
- [ ] Publish video: update status to 'published'

---

## Phase 2 — Advanced Features

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
