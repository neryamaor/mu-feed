// Dictionary service — read/write logic for dictionary_entries and translations.
//
// saveToPersonalDictionary: called from WordTooltip when the user taps "save".
//
// Admin sync functions (lookupDictionaryEntry, insertDictionaryEntry, etc.)
// are used by the admin upload workflow (Task 1.8).

import { supabase } from './supabase';
import type { DictionaryEntry, Translation } from '../types';

/**
 * Saves a dictionary entry to the user's personal dictionary.
 * Returns null on success (including if the entry was already saved),
 * or an error message string on failure.
 */
export async function saveToPersonalDictionary(
  userId: string,
  dictionaryEntryId: string,
): Promise<string | null> {
  const { error } = await supabase
    .from('personal_dictionary')
    .insert({ user_id: userId, dictionary_entry_id: dictionaryEntryId });

  if (error) {
    // PostgreSQL UNIQUE violation (23505) = already saved → treat as success.
    if (error.code === '23505') return null;
    console.error('[dictionary] saveToPersonalDictionary failed:', error.message);
    return error.message;
  }

  return null;
}

// ─── Admin sync functions (Task 1.8) ─────────────────────────────────────────

/**
 * Looks up a dictionary entry by exact arabic_text.
 * Returns the first match, or null if not found.
 */
export async function lookupDictionaryEntry(arabicText: string): Promise<DictionaryEntry | null> {
  const { data, error } = await supabase
    .from('dictionary_entries')
    .select('*')
    .eq('arabic_text', arabicText)
    .maybeSingle();

  if (error) {
    console.error('[dictionary] lookupDictionaryEntry failed:', error.message);
    return null;
  }
  return data as DictionaryEntry | null;
}

/**
 * Inserts a new dictionary_entries row.
 * Returns the new entry's UUID.
 */
export async function insertDictionaryEntry(
  arabicText: string,
  isPhrase: boolean,
): Promise<string> {
  const { data, error } = await supabase
    .from('dictionary_entries')
    .insert({ arabic_text: arabicText, is_phrase: isPhrase })
    .select('id')
    .single();

  if (error) throw new Error(`insertDictionaryEntry failed: ${error.message}`);
  return (data as { id: string }).id;
}

/**
 * Looks up the first translation for an entry that exactly matches
 * the given Hebrew text. Returns null if no match exists.
 */
export async function lookupTranslation(
  entryId: string,
  hebrewTranslation: string,
): Promise<Translation | null> {
  const { data, error } = await supabase
    .from('translations')
    .select('*')
    .eq('entry_id', entryId)
    .eq('hebrew_translation', hebrewTranslation)
    .maybeSingle();

  if (error) {
    console.error('[dictionary] lookupTranslation failed:', error.message);
    return null;
  }
  return data as Translation | null;
}

/**
 * Fetches ALL translations for a given dictionary entry.
 */
export async function fetchAllTranslations(entryId: string): Promise<Translation[]> {
  const { data, error } = await supabase
    .from('translations')
    .select('*')
    .eq('entry_id', entryId);

  if (error) {
    console.error('[dictionary] fetchAllTranslations failed:', error.message);
    return [];
  }
  return (data as Translation[]) ?? [];
}

/**
 * Inserts a new translations row.
 * Returns the new translation's UUID.
 */
export async function insertTranslation(
  entryId: string,
  hebrewTranslation: string,
  transliteration: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('translations')
    .insert({ entry_id: entryId, hebrew_translation: hebrewTranslation, transliteration })
    .select('id')
    .single();

  if (error) throw new Error(`insertTranslation failed: ${error.message}`);
  return (data as { id: string }).id;
}

/**
 * Replaces the hebrew_translation + transliteration on an existing row.
 */
export async function replaceTranslation(
  translationId: string,
  hebrewTranslation: string,
  transliteration: string,
): Promise<void> {
  const { error } = await supabase
    .from('translations')
    .update({ hebrew_translation: hebrewTranslation, transliteration })
    .eq('id', translationId);

  if (error) throw new Error(`replaceTranslation failed: ${error.message}`);
}

/**
 * Inserts a segment_words row.
 */
export async function insertSegmentWord(
  segmentId: string,
  dictionaryEntryId: string,
  contextTranslationId: string,
  wordPosition: number,
): Promise<void> {
  const { error } = await supabase.from('segment_words').insert({
    segment_id: segmentId,
    dictionary_entry_id: dictionaryEntryId,
    context_translation_id: contextTranslationId,
    word_position: wordPosition,
  });

  if (error) throw new Error(`insertSegmentWord failed: ${error.message}`);
}

/**
 * Inserts a segments row.
 * Returns the new segment's UUID.
 */
export async function insertSegment(
  videoId: string,
  orderIndex: number,
  startTime: number,
  endTime: number,
  arabicText: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('segments')
    .insert({
      video_id: videoId,
      order_index: orderIndex,
      start_time: startTime,
      end_time: endTime,
      arabic_text: arabicText,
    })
    .select('id')
    .single();

  if (error) throw new Error(`insertSegment failed: ${error.message}`);
  return (data as { id: string }).id;
}
