# PRD: Palestinian Spoken Arabic Learning App

## 1. Product Goal
An interactive platform for learning Palestinian Spoken Arabic through short video content. The core experience is a full-screen, TikTok-style vertical video feed where videos auto-play as the user scrolls, with interactive subtitles, tap-to-translate functionality, and a personal vocabulary system.

---

## 2. Target Audience
Anyone who wants to learn Palestinian Spoken Arabic in a fun and engaging way, preferring short video content over traditional textbook learning.

---

## 3. System Architecture

### 3.1 Core Components
The system consists of three parts:

**User App** — Full-screen auto-play video feed with interactive subtitle overlays, tap-to-translate, personal dictionary, active learning, and user profile. There is no separate video player screen — the feed itself is the player.

**Admin Panel** — A separate interface accessible only to authorized admins, for managing videos, subtitles, translations, and permissions.

**Global Database** — A shared repository of words, phrases, and grammar rules across the entire app. Dynamic — grows and updates over time.

### 3.2 Infrastructure
- **Primary database**: PostgreSQL
- **Full-text search (MVP)**: PostgreSQL `pg_trgm` extension — supports partial text matching on Arabic and Hebrew fields
- **Full-text search (future)**: Elasticsearch with Arabic stemming/root analysis — to be introduced when search quality becomes a bottleneck
- **Search indexes**: On `title` (videos), `arabic_text` (dictionary_entries), `hebrew_translation` (translations), and `transliteration` (translations)

> **Note on search**: The `pg_trgm` approach is intentionally isolated in one layer of the codebase to make migration to Elasticsearch straightforward. All search logic lives in a single service module.

---

## 4. Admin Panel

### 4.1 Permissions
- **Upload & Edit** — Any user authorized to upload videos may also edit them.
- **Delete** — A separate, restricted permission. Not all editors can delete.

### 4.2 Video Upload Workflow
The workflow follows a fixed sequence of steps:

**Step 1 — Video Upload:**
The admin uploads a video file to the system.

**Step 2 — Automatic Transcription:**
The system runs the Whisper API, which generates an Arabic transcription with word-level timestamps. The output format is JSON:

```json
{
  "segments": [
    {
      "start": 0.5,
      "end": 3.2,
      "text": "كيف حالك اليوم",
      "words": [
        { "word": "كيف", "transliteration": "כיף", "translation_id": "123" },
        { "word": "حالك", "transliteration": "חאלכ", "translation_id": "124" },
        { "word": "اليوم", "transliteration": "אליום", "translation_id": "125" }
      ]
    }
  ]
}
```

> Note: Whisper provides word-level timestamps, but only segment-level timing is used in the app. Word-level timestamps from Whisper are discarded. Words within a segment are mapped to the global dictionary, not individually timed.

**Step 3 — Transcription Review:**
The admin reviews and corrects the Arabic text. This step is completed before translation to ensure accuracy.

**Step 4 — Automatic Translation:**
After the transcription is approved, the system calls a language model API (Claude or GPT-4) with an explicit instruction:
> *"This is Palestinian Spoken Arabic. Translate to everyday Hebrew."*
This approach is preferred over Google Translate, which is optimized for Modern Standard Arabic and produces poor results for spoken dialects.

**Step 5 — Phrase Marking & Translation Review:**
The admin reviews the translation and may:
- Correct the translation of any individual word.
- Select multiple consecutive words and mark them as a single phrase unit (using standard text selection, then marking as a unit).
- Assign a dedicated translation to the marked phrase.
- If the phrase does not exist in the global database, it is created automatically.

**Step 6 — Sync to Database & Publish:**
After admin approval, the video and its associated data are synced to the database and published to the feed.

### 4.3 Interaction with the Global Database
When saving a translation:
- Word or phrase **does not exist** in the database → added automatically.
- Word exists with an **identical translation** → no action taken.
- Word exists with a **different translation** → the system prompts the admin: *Replace the existing translation, or add the new one as an additional option?*

---

## 5. Database Schema

### 5.1 Content Tables

**videos**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | Unique identifier |
| url | string | Video file URL |
| title | string | Video title |
| status | string | draft / published |
| uploaded_by | uuid FK → users | Admin who uploaded |
| difficulty_level | int | 1–5 scale |
| published_at | timestamp | Publication date |
| created_at | timestamp | Upload date |

**categories**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | Unique identifier |
| name | string | Category name (e.g. Food, Cars) |

**video_categories**
| Column | Type | Description |
|--------|------|-------------|
| video_id | uuid FK → videos | |
| category_id | uuid FK → categories | |

**tags**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | Unique identifier |
| name | string | Tag label |

**video_tags**
| Column | Type | Description |
|--------|------|-------------|
| video_id | uuid FK → videos | |
| tag_id | uuid FK → tags | |

**segments**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | Unique identifier |
| video_id | uuid FK → videos | Parent video |
| start_time | float | Segment start (seconds) |
| end_time | float | Segment end (seconds) |
| arabic_text | string | Full Arabic sentence |
| order_index | int | Display order |

**segment_words**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | Unique identifier |
| segment_id | uuid FK → segments | Parent segment |
| dictionary_entry_id | uuid FK → dictionary_entries | Maps to global dictionary |
| context_translation_id | uuid FK → translations | Specific translation for this video context |
| word_position | int | Position within segment |

**dictionary_entries**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | Unique identifier |
| arabic_text | string | Arabic word or phrase (indexed for search) |
| is_phrase | boolean | True if multi-word unit |
| created_at | timestamp | |

**translations**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | Unique identifier |
| entry_id | uuid FK → dictionary_entries | Parent dictionary entry |
| hebrew_translation | string | Hebrew translation (indexed for search) |
| transliteration | string | Hebrew transliteration (indexed for search) |
| created_at | timestamp | |

**grammar_rules**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | Unique identifier |
| title | string | Rule name |
| category | string | e.g. verb forms, syntax |
| content | text | Full explanation |
| updated_at | timestamp | |

### 5.2 User Tables

**users**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | Unique identifier |
| email | string | |
| level | string | Current language level |
| created_at | timestamp | |

**admin_permissions**
| Column | Type | Description |
|--------|------|-------------|
| user_id | uuid FK → users | |
| can_upload | boolean | |
| can_edit | boolean | |
| can_delete | boolean | |
| granted_at | timestamp | |

**personal_dictionary**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | Unique identifier |
| user_id | uuid FK → users | |
| dictionary_entry_id | uuid FK → dictionary_entries | Saved word or phrase |
| saved_at | timestamp | |

**flashcard_sessions**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | Unique identifier |
| user_id | uuid FK → users | |
| dictionary_entry_id | uuid FK → dictionary_entries | |
| times_shown | int | Total exposures |
| times_correct | int | Correct answers |
| last_shown_at | timestamp | |

---

## 6. User App

### 6.1 Video Feed (Main Screen)
The main screen of the app is a full-screen, TikTok-style vertical video feed. Each video occupies the entire screen. As the user scrolls vertically, the next video appears. This is the core experience — there is no separate video player screen.

**Feed behavior:**
- Videos auto-play as they become visible on screen — no tap required to start.
- Videos loop automatically when they reach the end.
- Sound is on by default.
- Snap-to-video: the feed snaps to one video at a time (paging behavior). The user cannot stop between two videos. Implemented via `pagingEnabled`, `snapToInterval` (screen height), `decelerationRate="fast"`, and `disableIntervalMomentum` (prevents skipping multiple videos in one swipe).
- One video is visible at a time (full-screen).
- Interactive subtitles are rendered directly as an overlay on the playing video.
- The user can fully hide subtitles. When hidden, subtitle data remains loaded in memory so subtitles can be restored instantly without re-fetching.
- UI action overlays are displayed on top of the video (e.g., save to favorites, share — exact actions to be defined later).
- A loading state is displayed while videos are being fetched or buffered (design to be defined separately).

The video pool is finite (not infinite scroll). Feed ordering logic is deferred to a later phase — in the MVP, all published videos are available to all users.

Example categories: Cars, Food, Jokes, Stand-up, Daily Life, Grooming, Shopping, Current Affairs, and more.

### 6.2 Video Search
Users can search for videos by:
- **Title** — searches the video's title field
- **Category** — fixed list managed by admins
- **Tags** — free-form labels added by admins per video
- **Word or phrase** — searches across `arabic_text`, `hebrew_translation`, and `transliteration` fields; returns all videos containing a matching word or phrase in their subtitles

### 6.3 Interactive Subtitles
- Subtitles are displayed as an overlay directly on the auto-playing video in the feed — not in a separate screen.
- The current subtitle segment is synced with the video's playback timestamp.
- The user can toggle between Arabic script, Hebrew transliteration, or both.
- The user can fully hide subtitles. This is a visual-only hide — subtitle data stays loaded in memory so it can be restored instantly.
- Every word is tappable (when subtitles are visible).

### 6.4 Tap-to-Translate (Inline Tooltip)
When a user taps a word:
- The video **pauses automatically**.
- A small inline tooltip opens (not a new screen).
- If the word is part of a defined phrase → the full phrase is displayed as a single unit with its translation.
- If the word is standalone → its translation for this specific context is shown.
- The tooltip includes a button to save to the personal dictionary.
- When the user closes the tooltip, the video resumes.

### 6.5 Personal Dictionary
- Users save words and phrases from videos or from the global database.
- Each saved entry displays **all possible translations** from the global database, not just the one shown in the video.
- Serves as the basis for active learning.

### 6.6 Active Learning
Auto-generated flashcards based on the user's personal dictionary.

### 6.7 User Profile
Learning statistics, current level, and progress history.

---

## 7. Development Phases

### Phase 1 — MVP
- Full-screen auto-play video feed (TikTok-style, one video at a time, snap-to-video, auto-loop, sound on)
- Subtitles overlay on the video with toggle between Arabic and transliteration, and option to hide completely
- Tap-to-translate with inline tooltip and video pause
- Save to personal dictionary
- Video search by category, tags, and word/phrase (PostgreSQL pg_trgm)
- Admin panel: video upload, Whisper transcription, review, translation, phrase marking, publish

### Phase 2 — Advanced Features
- Feed filtering by category and difficulty level
- Active learning with flashcards
- Dedicated grammar section
- Full user profile

### Phase 3 — Future
- Elasticsearch with Arabic root analysis (replace pg_trgm)
- Limited access tier for free users (details to be defined separately)
- Feed personalization logic (ordering, recommendations)

---

## 8. Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Frontend | React Native + Expo | Single codebase for iOS, Android, and web |
| Backend & Database | Supabase | Managed PostgreSQL, built-in auth, file storage, and auto-generated API |
| Video Storage | Mux | Purpose-built for video streaming, handles encoding and delivery, free tier for development |
| Transcription | Whisper API | Arabic transcription with word-level timestamps |
| Translation | Claude API or GPT-4 API | Best quality for Palestinian Spoken Arabic |
| Search (MVP) | PostgreSQL pg_trgm | Built into Supabase, zero extra infrastructure |
| Search (future) | Elasticsearch | Arabic root-aware full-text search |

> **Development approach**: The app is built with Claude Code, using structured markdown files (PRD, ARCHITECTURE, SCHEMA, TASKS) as input. All architectural decisions are documented to ensure Claude Code has full context at all times.

---

## 9. Key Technical Dependencies
- **Whisper API** — Automatic transcription with segment-level timing and word mapping
- **Claude API or GPT-4 API** — Translation of Palestinian Spoken Arabic to everyday Hebrew
- **Supabase** — PostgreSQL database, authentication, file storage, and API
- **Mux** — Video hosting and delivery (free tier for development)
- **PostgreSQL pg_trgm** — MVP full-text search, built into Supabase
- **Elasticsearch** (future) — Arabic root-aware full-text search
- **Subtitle data format** — JSON with segment-level timing and word-to-dictionary mapping