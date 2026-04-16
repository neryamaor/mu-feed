// useDictionary — fetches and manages the user's personal dictionary.
//
// For each saved entry, fetches ALL rows from the translations table
// (not just the context translation) so the dictionary screen can display
// every possible translation for a word or phrase.
//
// Query shape:
//   personal_dictionary
//     → dictionary_entries!dictionary_entry_id  (forward FK, single object)
//         → translations                         (reverse FK, array — all translations)
//
// Auth: accepts userId as a parameter. Pass DUMMY_USER_ID from constants/index.ts
// until Task 1.2 (Auth) is implemented, then pass the real user ID.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import type { PersonalDictionaryWithEntry } from '../types';

export function useDictionary(userId: string | null) {
  const [entries, setEntries] = useState<PersonalDictionaryWithEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('personal_dictionary')
      .select(
        `
        id,
        saved_at,
        dictionary_entries!dictionary_entry_id (
          id,
          arabic_text,
          is_phrase,
          translations ( id, hebrew_translation, transliteration )
        )
      `,
      )
      .eq('user_id', userId)
      .order('saved_at', { ascending: false });

    if (fetchError) {
      console.error('[useDictionary] fetch failed:', fetchError.message);
      setError(fetchError.message);
    } else {
      setEntries((data as PersonalDictionaryWithEntry[]) ?? []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Optimistic delete: remove from local state immediately, then call Supabase.
  // If the API call fails the entry stays removed (UX trade-off for speed);
  // a full re-fetch on next mount will restore it.
  const deleteEntry = useCallback(async (entryId: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== entryId));

    const { error: deleteError } = await supabase
      .from('personal_dictionary')
      .delete()
      .eq('id', entryId);

    if (deleteError) {
      console.error('[useDictionary] deleteEntry failed:', deleteError.message);
    }
  }, []);

  return { entries, loading, error, deleteEntry, refetch: fetchEntries };
}
