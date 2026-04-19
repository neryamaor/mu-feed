// Flashcards service — data access for the active-learning feature.
//
// getFlashcards()      — builds FlashcardCard[] from the user's personal dictionary.
// recordCardResult()   — writes cumulative stats to flashcard_sessions (fire-and-forget).
//
// Stats are write-only for this task. The session round logic lives entirely
// in the UI (session.tsx) and does NOT read from flashcard_sessions.

import { supabase } from './supabase';
import type { FlashcardCard } from '../types';

// ─── Card fetch ───────────────────────────────────────────────────────────────

/**
 * Returns all personal dictionary entries as FlashcardCard[].
 * Uses the first translation row for each entry (by insert order).
 * Entries with no translations are skipped.
 */
export async function getFlashcards(): Promise<FlashcardCard[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('personal_dictionary')
    .select(
      'dictionary_entry_id, dictionary_entries(id, arabic_text, translations(hebrew_translation, transliteration))',
    )
    .eq('user_id', user.id)
    .order('saved_at', { ascending: false });

  if (error) {
    console.error('[flashcards] getFlashcards failed:', error.message);
    return [];
  }

  const rows = (data ?? []) as Array<{
    dictionary_entry_id: string;
    dictionary_entries: {
      id: string;
      arabic_text: string;
      translations: Array<{ hebrew_translation: string; transliteration: string }>;
    } | null;
  }>;

  const cards: FlashcardCard[] = [];
  for (const row of rows) {
    const entry = row.dictionary_entries;
    if (!entry) continue;
    const t = entry.translations[0];
    if (!t) continue;
    cards.push({
      entryId: entry.id,
      arabicText: entry.arabic_text,
      transliteration: t.transliteration,
      hebrewTranslation: t.hebrew_translation,
    });
  }
  return cards;
}

// ─── Stats write (fire-and-forget) ───────────────────────────────────────────

/**
 * Increments cumulative stats for one (user, entry) pair.
 * Uses SELECT-then-UPDATE/INSERT to handle the increment correctly.
 *
 * NEVER awaited by the caller — errors are logged and swallowed so
 * they never block the swipe animation.
 */
export async function recordCardResult(
  dictionaryEntryId: string,
  known: boolean,
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: existing } = await supabase
      .from('flashcard_sessions')
      .select('id, times_shown, times_correct')
      .eq('user_id', user.id)
      .eq('dictionary_entry_id', dictionaryEntryId)
      .maybeSingle();

    if (existing) {
      const row = existing as { id: string; times_shown: number; times_correct: number };
      await supabase
        .from('flashcard_sessions')
        .update({
          times_shown: row.times_shown + 1,
          times_correct: row.times_correct + (known ? 1 : 0),
          last_shown_at: new Date().toISOString(),
        })
        .eq('id', row.id);
    } else {
      await supabase.from('flashcard_sessions').insert({
        user_id: user.id,
        dictionary_entry_id: dictionaryEntryId,
        times_shown: 1,
        times_correct: known ? 1 : 0,
        last_shown_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error('[flashcards] recordCardResult failed:', err);
  }
}
