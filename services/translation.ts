// Translation + transliteration service.
//
// Calls the `translate-segment` Supabase Edge Function, which calls the
// Claude API (or OpenAI, based on TRANSLATION_API_PROVIDER secret).
//
// A single call per segment returns:
//   - Full-segment Hebrew translation
//   - Full-segment Hebrew-letter transliteration
//   - Per-word array (arabic, hebrew, transliteration) for dictionary sync
//
// This is consistent with TASKS.md §1.8 Step 3: "single call per segment".
// The per-word data is an extension of the original spec — it is required
// by the schema (segment_words.context_translation_id → translations).

import { invokeFn } from './supabase';
import type { TranslationResult } from '../types';

/**
 * Translates an Arabic segment to Hebrew, with per-word breakdown.
 *
 * @param arabicText  The segment's Arabic text (e.g. "كيف حالك اليوم").
 * @returns           TranslationResult, or null on error (caller uses manual path).
 */
export async function translateSegment(arabicText: string): Promise<TranslationResult | null> {
  try {
    const { data, error } = await invokeFn('translate-segment', {
      arabicText: arabicText.trim(),
    });

    if (error) {
      console.error('[translation] translateSegment failed:', error.message);
      return null;
    }

    const result = data as { error?: string; translation?: string } & TranslationResult;
    if (result.error) {
      console.error('[translation] API error:', result.error);
      return null;
    }

    if (!result.translation || !result.transliteration || !Array.isArray(result.words)) {
      console.error('[translation] unexpected response shape:', result);
      return null;
    }

    return result;
  } catch (err) {
    console.error('[translation] translateSegment error:', err);
    return null;
  }
}
