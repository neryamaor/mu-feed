# ARCHITECTURE: Palestinian Spoken Arabic Learning App

## 1. Overview

This document describes the technical architecture of the app. It is intended as a reference for Claude Code and any developer working on the project. All decisions here should be treated as the source of truth for how the codebase is structured.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Native + Expo |
| Backend & Database | Supabase (PostgreSQL) |
| Video Storage & Streaming | Mux |
| Transcription | Whisper API (OpenAI) |
| Translation + Transliteration | Claude API (Anthropic) |
| Search (MVP) | PostgreSQL pg_trgm (via Supabase) |
| Search (future) | Elasticsearch |

---

## 3. Repository Structure

```
/
├── app/                        # React Native (Expo) screens and navigation
│   ├── (tabs)/                 # Tab-based navigation
│   │   ├── feed/               # Full-screen auto-play video feed (main screen + player)
│   │   ├── search/             # Search screen
│   │   ├── dictionary/         # Personal dictionary screen
│   │   ├── flashcards/         # Active learning screen
│   │   └── profile/            # User profile screen
│   └── admin/                  # Admin panel screens (protected)
│       ├── upload/             # Video upload and transcription workflow
│       ├── review/             # Transcription and translation review
│       └── dictionary/         # Global dictionary management
│
├── components/                 # Reusable UI components
│   ├── FeedVideoItem.tsx       # Single full-screen video item in the feed (video + overlays)
│   ├── SubtitleOverlay.tsx     # Interactive subtitle display (overlay on video)
│   ├── WordTooltip.tsx         # Tap-to-translate popup
│   ├── FeedActionOverlay.tsx   # UI action buttons overlaid on video (save, share, etc.)
│   ├── VideoCard.tsx           # Video thumbnail card (used in search results, not in feed)
│   └── FlashCard.tsx           # Flashcard component
│
├── services/                   # Business logic and external API calls
│   ├── supabase.ts             # Supabase client initialization
│   ├── search.ts               # ALL search logic lives here (pg_trgm → Elasticsearch migration point)
│   ├── whisper.ts              # Whisper API transcription calls
│   ├── translation.ts          # Claude API translation + transliteration calls
│   ├── video.ts                # Video upload and Mux integration
│   └── dictionary.ts           # Global dictionary read/write logic
│
├── hooks/                      # Custom React hooks
│   ├── useVideoFeed.ts         # Feed-level video management (which video is active, preloading)
│   ├── useVideoPlayback.ts     # Single video playback state (play, pause, loop, mute)
│   ├── useSubtitles.ts         # Subtitle sync with video timestamp
│   ├── useDictionary.ts        # Personal dictionary state
│   └── useAuth.ts              # Authentication state
│
├── types/                      # TypeScript type definitions
│   └── index.ts                # All shared types and interfaces
│
├── docs/                       # Project documentation
│   ├── PRD.md                  # Product requirements
│   ├── ARCHITECTURE.md         # This file
│   ├── SCHEMA.sql              # Database schema
│   └── TASKS.md                # Development task list
│
├── supabase/
│   └── migrations/             # Database migration files
│
└── constants/
    └── index.ts                # App-wide constants (API endpoints, config)
```

---

## 4. Core Data Flow

### 4.1 User watches a video

```
User opens the app → feed screen loads
  → app/feed fetches published videos from Supabase (videos table)
  → Feed renders as a full-screen paged list (snap-to-video, one video visible at a time)
  → Video auto-plays immediately when visible, loops at end, sound on by default
  → useSubtitles hook fetches segments + segment_words for the current video
  → SubtitleOverlay renders current segment as overlay on the video, synced to timestamp
  → User can hide subtitles (visual-only; useSubtitles continues tracking in background)
  → User swipes → feed snaps to next video, previous pauses, next auto-plays
  → FeedActionOverlay shows action buttons on the video (save to favorites, etc.)
  → User taps a word in the subtitle overlay
  → WordTooltip fetches all translations for that dictionary_entry_id
  → Video pauses automatically
  → User closes tooltip → video resumes
```

### 4.2 User saves a word

```
User taps "save" in WordTooltip
  → useDictionary hook writes to personal_dictionary table
  → personal_dictionary stores user_id + dictionary_entry_id
  → Personal dictionary screen fetches all entries for this user
  → For each entry: fetches ALL translations from translations table
```

### 4.3 User searches for a video

```
User types in search screen
  → services/search.ts handles the query (single entry point for all search logic)
  → Searches across: videos.title, tags.name, dictionary_entries.arabic_text,
    translations.hebrew_translation, translations.transliteration
  → pg_trgm similarity matching on all fields
  → Returns list of matching videos with their metadata
```

### 4.4 Admin uploads a video

```
Admin uploads video file
  → services/video.ts uploads to Mux → gets back Mux asset ID + streaming URL
  → Supabase stores video record with status = 'draft'

  [Transcription step — auto or manual]
  → Auto: services/whisper.ts sends video URL to Whisper API
    → Whisper returns JSON with segments + word-level data
  → Manual: admin pastes Arabic text directly; admin adds segment timestamps manually
  → Admin reviews and corrects Arabic text segment by segment

  [Translation + Transliteration step — auto or manual]
  → Auto: services/translation.ts sends corrected Arabic to Claude API
    → Single API call returns both Hebrew translation AND Hebrew-letter transliteration
    → Prompt includes Palestinian dialect context and transliteration rules
  → Manual: admin pastes Hebrew translation and/or transliteration directly
  → Admin reviews and corrects translation and transliteration per segment

  [Phrase marking step — always manual]
  → Admin taps first word, then last word of a phrase → range is highlighted
  → Admin taps "Mark as phrase" → phrase unit is created with its own translation
  → If phrase does not exist in global dictionary → created automatically

  [Dictionary sync]
  → services/dictionary.ts syncs all words and phrases to dictionary_entries + translations
    - New entries → insert
    - Existing entry, same translation → skip
    - Existing entry, different translation → prompt admin: replace or add?

  [Metadata + publish]
  → Admin sets category, tags, difficulty level
  → Video status updated to 'published'
```

---

## 5. Key Architectural Decisions

### 5.1 Search is isolated in one module
All search logic lives exclusively in `services/search.ts`. No other file should contain search queries. This is intentional — when we migrate from `pg_trgm` to Elasticsearch, only this file needs to change.

### 5.2 Subtitle timing is segment-level only
Whisper returns word-level timestamps but we store and use only segment-level timing (`start_time`, `end_time` on the `segments` table). Individual words within a segment are mapped to the dictionary but are not individually timed.

### 5.3 Two translation references per word
Each `segment_words` row holds two references:
- `dictionary_entry_id` → the word in the global dictionary (with all its possible translations)
- `context_translation_id` → the specific translation chosen by the admin for this video context

When the user taps a word in the video, they see the context translation. When they save the word to their personal dictionary, they see all translations from the global dictionary.

### 5.4 Admin panel is part of the same app
The admin panel lives under `app/admin/` and is protected by permission checks using the `admin_permissions` table. It is not a separate application. Access is controlled by `can_upload`, `can_edit`, and `can_delete` flags.

### 5.5 Supabase handles authentication
User authentication (sign up, sign in, session management) is handled entirely by Supabase Auth. The `users` table in our schema extends Supabase's built-in auth user with app-specific fields (level, etc.).

### 5.6 Feed is the player (no separate video screen)
There is no separate video player screen. The feed screen itself is the player — each item in the feed is a full-screen video that auto-plays when visible. This is a TikTok-style architecture:
- Videos auto-play when they scroll into view and pause when they scroll out.
- Videos loop automatically when they reach the end.
- Sound is on by default.
- Snap-to-video: the feed uses paging behavior (`pagingEnabled`, `snapToInterval=screenHeight`, `decelerationRate="fast"`, `disableIntervalMomentum=true`). The user cannot stop between two videos and cannot skip multiple videos in one swipe.
- One video is visible at a time (full-screen).
- Subtitles, action buttons (save to favorites, etc.), and word tooltips are all rendered as overlays directly on the video in the feed.
- Subtitle hide is visual-only: when the user hides subtitles, the data stays loaded in memory. The `useSubtitles` hook continues tracking the current segment so subtitles can be restored instantly without re-fetching.
- The `FeedVideoItem` component encapsulates: video playback, subtitle overlay, action overlay, and tooltip.
- `VideoCard` (thumbnail card) is only used outside the feed, e.g. in search results.

### 5.7 Translation and transliteration are generated together
`services/translation.ts` makes a single Claude API call per segment that returns both the Hebrew translation and the Hebrew-letter transliteration. This avoids a second API call and keeps the two values contextually consistent. The transliteration style may be refined over time by updating the prompt — no code changes required.

### 5.8 Every admin workflow step supports manual input
In the video upload workflow, every automated step (transcription, translation, transliteration) also has a manual input path. The admin can skip the API call entirely and paste or type their own content. This supports edge cases where the API output is unusable, where the admin has pre-prepared content, or where a specific segment requires expert correction.

### 5.9 Phrase marking UX
In the translation review step, the admin marks multi-word phrases by tapping the first word, then the last word. The range is highlighted. A "Mark as phrase" button creates the phrase unit and prompts for a dedicated translation.

---

## 6. External API Contracts

### 6.1 Whisper API
- **Input**: Mux video URL
- **Output**: JSON with segments and word-level data
- **Used in**: `services/whisper.ts`
- **Note**: Only segment-level timing is persisted. Word-level timestamps are used only during the admin review workflow and are not stored.

### 6.2 Claude API — Translation + Transliteration
- **Input**: Arabic text segment + system prompt
- **System prompt**:
```
You are a Palestinian Arabic language expert. Given a segment of spoken Palestinian Arabic, return a JSON object with exactly two fields:
- "translation": natural everyday Hebrew translation of the segment
- "transliteration": phonetic rendering of the Arabic in Hebrew letters, as commonly used by Israeli Arabic learners

Return only valid JSON. No explanation, no markdown.
```
- **Output**: `{ "translation": "...", "transliteration": "..." }`
- **Used in**: `services/translation.ts`
- **Note**: Transliteration rules will be refined over time by updating the system prompt only — no code changes required.

### 6.3 Mux
- **Input**: video file upload (direct upload URL from Mux API)
- **Output**: Mux asset ID + streaming playback URL
- **Used in**: `services/video.ts`
- **Note**: The streaming playback URL is stored in `videos.url`. The Mux asset ID should also be stored for future management operations.

---

## 7. Environment Variables

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
MUX_TOKEN_ID=
MUX_TOKEN_SECRET=
OPENAI_API_KEY=              # Used for Whisper transcription
ANTHROPIC_API_KEY=           # Used for translation + transliteration (Claude API)
```

---

## 8. Future Considerations

| Topic | Current approach | Future approach |
|-------|-----------------|-----------------|
| Search | pg_trgm | Elasticsearch with Arabic root analysis |
| Feed ordering | Chronological | Personalized based on user level and history |
| Access tiers | All users have full access | Limited access for free users |
| Admin authoring | Manual transcription review | Assisted with AI suggestions |
| Transliteration rules | LLM prompt-based | Explicit rule table if consistency issues arise |
| Dictionary enrichment | Grows organically from video uploads | Possible future bulk import from external Arabic-Hebrew lexicons |