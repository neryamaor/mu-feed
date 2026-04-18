// Shared TypeScript interfaces for all database tables.
// Field names and nullability mirror docs/SCHEMA.sql exactly.
// All ids are UUIDs represented as strings.

// ─── User tables ──────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  level: string;
  created_at: string;
}

export interface AdminPermissions {
  user_id: string;
  can_upload: boolean;
  can_edit: boolean;
  can_delete: boolean;
  granted_at: string;
}

// ─── Content tables ───────────────────────────────────────────────────────────

export interface Video {
  id: string;
  title: string;
  url: string;
  status: 'draft' | 'published';
  uploaded_by: string | null;
  difficulty_level: number | null;
  published_at: string | null;
  created_at: string;
  source_credit: string | null;
}

export interface Category {
  id: string;
  name: string;
}

export interface VideoCategory {
  video_id: string;
  category_id: string;
}

export interface Tag {
  id: string;
  name: string;
}

export interface VideoTag {
  video_id: string;
  tag_id: string;
}

export interface Segment {
  id: string;
  video_id: string;
  start_time: number;
  end_time: number;
  arabic_text: string;
  order_index: number;
}

export interface DictionaryEntry {
  id: string;
  arabic_text: string;
  is_phrase: boolean;
  created_at: string;
}

export interface Translation {
  id: string;
  entry_id: string;
  hebrew_translation: string;
  transliteration: string;
  created_at: string;
}

export interface SegmentWord {
  id: string;
  segment_id: string;
  dictionary_entry_id: string;
  // Specific translation chosen by the admin for this video context.
  // Null if no context-specific translation was assigned.
  context_translation_id: string | null;
  word_position: number;
}

export interface GrammarRule {
  id: string;
  title: string;
  category: string;
  content: string;
  updated_at: string;
}

// ─── Learning tables ──────────────────────────────────────────────────────────

// ─── Subtitle types ───────────────────────────────────────────────────────────

/** Which text is shown for each subtitle word. */
export type SubtitleMode = 'arabic' | 'transliteration' | 'both';

/**
 * A segment_words row joined with its dictionary entry and context translation.
 * Returned by useSubtitles — matches the Supabase nested-select shape.
 *
 * Both joined fields are single objects (forward FK → single row), not arrays.
 * Either can be null: dictionary_entries if data is missing, translations if
 * context_translation_id is null (no context-specific translation assigned).
 */
export interface SegmentWordWithDetails {
  id: string;
  segment_id: string;
  dictionary_entry_id: string;
  context_translation_id: string | null;
  word_position: number;
  dictionary_entries: { arabic_text: string; is_phrase: boolean } | null;
  translations: { transliteration: string; hebrew_translation: string } | null;
}

/** A segments row with its words pre-fetched and sorted by word_position. */
export interface SegmentWithWords extends Segment {
  segment_words: SegmentWordWithDetails[];
}

// ─── Query result shapes ──────────────────────────────────────────────────────

// Shape returned by the feed query: videos joined with their categories.
export interface FeedVideo extends Video {
  video_categories: Array<{
    categories: { id: string; name: string } | null;
  }>;
}

export interface PersonalDictionary {
  id: string;
  user_id: string;
  dictionary_entry_id: string;
  saved_at: string;
}

/**
 * A dictionary_entries row with ALL its translations joined.
 * Used by useDictionary — the personal dictionary screen shows every
 * translation for an entry, not just the context-specific one.
 */
export interface DictionaryEntryWithTranslations {
  id: string;
  arabic_text: string;
  is_phrase: boolean;
  translations: Array<{
    id: string;
    hebrew_translation: string;
    transliteration: string;
  }>;
}

/**
 * A personal_dictionary row joined with its dictionary entry + all translations.
 * Returned by useDictionary's Supabase nested-select query.
 */
export interface PersonalDictionaryWithEntry {
  id: string;
  saved_at: string;
  dictionary_entries: DictionaryEntryWithTranslations | null;
}

export interface VideoFavorite {
  id: string;
  userId: string;
  videoId: string;
  savedAt: string;
  /** Joined from videos table — title for display in the profile list. */
  videoTitle: string;
  /** Joined from videos table — Mux playback ID for thumbnail generation. */
  videoUrl: string;
}

export interface FlashcardSession {
  id: string;
  user_id: string;
  dictionary_entry_id: string;
  times_shown: number;
  times_correct: number;
  last_shown_at: string | null;
}

// ─── Admin workflow types (Task 1.8) ─────────────────────────────────────────

/** One segment returned by Whisper (word-level timestamps discarded). */
export interface WhisperSegment {
  start: number;
  end: number;
  text: string;
}

/**
 * Result of a single Claude call for one Arabic segment.
 * Contains both full-segment fields (for display reference) and per-word
 * data (required to populate dictionary_entries + segment_words in the DB).
 */
export interface TranslationResult {
  translation: string;
  transliteration: string;
  words: Array<{
    arabic: string;
    hebrew: string;
    transliteration: string;
  }>;
}

/** One word inside an admin review segment — all fields are editable. */
export interface AdminWord {
  position: number;
  arabic: string;
  hebrew: string;
  transliteration: string;
  /** null = standalone word; set = this word belongs to a phrase group. */
  phraseGroupId: string | null;
}

/** A phrase the admin marked across consecutive words in a segment. */
export interface AdminPhraseGroup {
  /** Local UUID — used for tracking before the dictionary sync. */
  id: string;
  startPosition: number;
  endPosition: number;
  /** Words joined with a space — becomes dictionary_entries.arabic_text. */
  arabicText: string;
  hebrew: string;
  transliteration: string;
}

/** One segment in the admin review wizard — all fields are mutable. */
export interface AdminSegment {
  orderIndex: number;
  startTime: number;
  endTime: number;
  arabicText: string;
  /** Full-segment translation — used as reference during review. */
  segmentHebrew: string;
  /** Full-segment transliteration — used as reference during review. */
  segmentTransliteration: string;
  words: AdminWord[];
  phraseGroups: AdminPhraseGroup[];
  /** Set after the segment is saved to Supabase in Step 2. */
  savedSegmentId: string | null;
}

/**
 * A conflict surfaced during dictionary sync (Step 5).
 * Exists when a word already has a translation in the DB that differs from
 * the new one supplied by the admin.
 */
export interface DictionaryConflict {
  arabicText: string;
  entryId: string;
  existingTranslationId: string;
  existingHebrew: string;
  newHebrew: string;
  newTransliteration: string;
  /** Back-references into segments/words so the sync can resume after resolution. */
  segmentIndex: number;
  wordPosition: number;
  resolution: 'replace' | 'add' | null;
}

// ─── AI metadata suggestion (Task 1.10) ──────────────────────────────────────

/**
 * Result of the `suggest-metadata` Edge Function call.
 * Title and tags are Hebrew strings; category matches one of the
 * existing category names from the `categories` table.
 */
export interface MetadataSuggestion {
  title: string;
  tags: string[];
  /** One of the category names passed in the request (case-insensitive match). */
  category: string;
}

// ─── Admin edit types (Task 1.9) ──────────────────────────────────────────────

/** Row shown in the admin video management list. */
export interface AdminVideoListItem {
  id: string;
  title: string;
  status: 'draft' | 'published';
  difficultyLevel: number | null;
  publishedAt: string | null;
  createdAt: string;
}

/** One word in the edit screen — combines segment_words + its context translation. */
export interface EditableSegmentWord {
  segmentWordId: string;
  wordPosition: number;
  /** dictionary_entries.arabic_text — display only, never written. */
  arabic: string;
  /** null = word has no context translation; translation inputs are disabled. */
  contextTranslationId: string | null;
  hebrew: string;
  transliteration: string;
}

/** One segment as loaded for editing. */
export interface EditableSegment {
  id: string;
  orderIndex: number;
  startTime: number;
  endTime: number;
  arabicText: string;
  words: EditableSegmentWord[];
}

/** Full data shape fetched for the edit screen. */
export interface VideoEditData {
  id: string;
  title: string;
  status: 'draft' | 'published';
  difficultyLevel: number | null;
  categoryId: string | null;
  tagIds: string[];
  segments: EditableSegment[];
  sourceCredit: string | null;
}

/** Payload passed to saveVideoEdit(). */
export interface VideoEditSavePayload {
  title: string;
  difficultyLevel: number | null;
  categoryId: string | null;
  sourceCredit: string | null;
  /** IDs of existing tags to keep associated. */
  existingTagIds: string[];
  /** Names of brand-new tags to create and associate. */
  newTagNames: string[];
  segments: Array<{
    id: string;
    arabicText: string;
    startTime: number;
    endTime: number;
    words: Array<{
      segmentWordId: string;
      contextTranslationId: string | null;
      hebrew: string;
      transliteration: string;
    }>;
  }>;
}
