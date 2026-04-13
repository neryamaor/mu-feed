# ARCHITECTURE: Palestinian Spoken Arabic Learning App

## 1. Overview

This document describes the technical architecture of the app. It is intended as a reference for Claude Code and any developer working on the project. All decisions here should be treated as the source of truth for how the codebase is structured.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Native + Expo |
| Backend & Database | Supabase (PostgreSQL) |
| Video Storage & Streaming | Cloudflare Stream |
| Transcription | Whisper API |
| Translation | Claude API or GPT-4 API |
| Search (MVP) | PostgreSQL pg_trgm (via Supabase) |
| Search (future) | Elasticsearch |

---

## 3. Repository Structure

```
/
├── app/                        # React Native (Expo) screens and navigation
│   ├── (tabs)/                 # Tab-based navigation
│   │   ├── feed/               # Video feed screen
│   │   ├── search/             # Search screen
│   │   ├── dictionary/         # Personal dictionary screen
│   │   ├── flashcards/         # Active learning screen
│   │   └── profile/            # User profile screen
│   ├── video/                  # Video player screen
│   └── admin/                  # Admin panel screens (protected)
│       ├── upload/             # Video upload and transcription workflow
│       ├── review/             # Transcription and translation review
│       └── dictionary/         # Global dictionary management
│
├── components/                 # Reusable UI components
│   ├── VideoPlayer.tsx         # Video player with subtitle overlay
│   ├── SubtitleOverlay.tsx     # Interactive subtitle display
│   ├── WordTooltip.tsx         # Tap-to-translate popup
│   ├── VideoCard.tsx           # Video thumbnail in feed
│   └── FlashCard.tsx           # Flashcard component
│
├── services/                   # Business logic and external API calls
│   ├── supabase.ts             # Supabase client initialization
│   ├── search.ts               # ALL search logic lives here (pg_trgm → Elasticsearch migration point)
│   ├── whisper.ts              # Whisper API transcription calls
│   ├── translation.ts          # Claude/GPT-4 translation calls
│   ├── video.ts                # Video upload and Cloudflare Stream integration
│   └── dictionary.ts           # Global dictionary read/write logic
│
├── hooks/                      # Custom React hooks
│   ├── useVideo.ts             # Video playback state
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
User opens feed
  → app/feed fetches published videos from Supabase (videos table)
  → User taps a video
  → app/video loads video URL from Cloudflare Stream
  → useSubtitles hook fetches segments + segment_words for this video
  → SubtitleOverlay renders current segment based on video timestamp
  → User taps a word
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
  → services/video.ts uploads to Cloudflare Stream → gets back video URL
  → Supabase stores video record with status = 'draft'
  → services/whisper.ts sends video to Whisper API
  → Whisper returns JSON with segments + word-level data
  → Admin reviews and corrects Arabic text in review UI
  → services/translation.ts sends corrected Arabic to Claude/GPT-4 API
    with prompt: "This is Palestinian Spoken Arabic. Translate to everyday Hebrew."
  → Admin reviews and corrects Hebrew translation
  → Admin marks phrase groups where needed
  → services/dictionary.ts syncs all words and phrases to dictionary_entries + translations
    - New entries → insert
    - Existing entry, same translation → skip
    - Existing entry, different translation → prompt admin: replace or add?
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

---

## 6. External API Contracts

### 6.1 Whisper API
- **Input**: video file or URL
- **Output**: JSON with segments and word-level data
- **Used in**: `services/whisper.ts`
- **Note**: Only segment-level timing is persisted. Word-level timestamps are used only during the admin review workflow and are not stored.

### 6.2 Claude / GPT-4 Translation API
- **Input**: Arabic text segment + system prompt
- **System prompt**: `"This is Palestinian Spoken Arabic. Translate to everyday Hebrew. Return only the translation, no explanation."`
- **Output**: Hebrew translation string
- **Used in**: `services/translation.ts`

### 6.3 Cloudflare Stream
- **Input**: video file upload
- **Output**: streaming URL + video ID
- **Used in**: `services/video.ts`
- **Note**: The streaming URL is stored in `videos.url`

---

## 7. Environment Variables

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
CLOUDFLARE_STREAM_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
WHISPER_API_KEY=
TRANSLATION_API_KEY=        # Claude or GPT-4
TRANSLATION_API_PROVIDER=   # "claude" or "openai"
```

---

## 8. Future Considerations

| Topic | Current approach | Future approach |
|-------|-----------------|-----------------|
| Search | pg_trgm | Elasticsearch with Arabic root analysis |
| Feed ordering | Chronological | Personalized based on user level and history |
| Access tiers | All users have full access | Limited access for free users |
| Admin authoring | Manual transcription review | Assisted with AI suggestions |
