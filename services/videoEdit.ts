// Video edit service — all data fetching and saving for the admin edit screen.
//
// Architectural rules enforced here:
//   - Saving translations updates translations rows ONLY (never dictionary_entries).
//   - Saving category/tags replaces join table rows (delete + insert).
//   - All Supabase queries stay in this file — not in the screen components.

import { supabase } from './supabase';
import type {
  AdminVideoListItem,
  VideoEditData,
  VideoEditSavePayload,
  EditableSegment,
  Category,
  Tag,
} from '../types';

/**
 * Returns all videos (draft + published) ordered by creation date (newest first).
 * Used by the admin video management list screen.
 */
export async function fetchAllVideosForAdmin(): Promise<AdminVideoListItem[]> {
  const { data, error } = await supabase
    .from('videos')
    .select('id, title, status, difficulty_level, published_at, created_at')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return ((data as Record<string, unknown>[]) ?? []).map((v) => ({
    id: v.id as string,
    title: v.title as string,
    status: v.status as 'draft' | 'published',
    difficultyLevel: v.difficulty_level as number | null,
    publishedAt: v.published_at as string | null,
    createdAt: v.created_at as string,
  }));
}

/**
 * Fetches all categories and tags for the edit screen's reference dropdowns.
 */
export async function fetchCategoriesAndTags(): Promise<{
  categories: Category[];
  tags: Tag[];
}> {
  const [catRes, tagRes] = await Promise.all([
    supabase.from('categories').select('id, name').order('name'),
    supabase.from('tags').select('id, name').order('name'),
  ]);

  if (catRes.error) throw new Error(catRes.error.message);
  if (tagRes.error) throw new Error(tagRes.error.message);

  return {
    categories: (catRes.data as Category[]) ?? [],
    tags: (tagRes.data as Tag[]) ?? [],
  };
}

/**
 * Fetches all editable data for a video: metadata + segments + per-word translations.
 * Segments and words are sorted by their position fields.
 */
export async function fetchVideoForEdit(videoId: string): Promise<VideoEditData> {
  const [videoRes, catRes, tagRes, segRes] = await Promise.all([
    supabase
      .from('videos')
      .select('id, title, status, difficulty_level, source_credit')
      .eq('id', videoId)
      .single(),
    supabase.from('video_categories').select('category_id').eq('video_id', videoId),
    supabase.from('video_tags').select('tag_id').eq('video_id', videoId),
    supabase
      .from('segments')
      .select(
        `
        id, order_index, start_time, end_time, arabic_text,
        segment_words (
          id, word_position, context_translation_id, dictionary_entry_id,
          dictionary_entries!dictionary_entry_id ( arabic_text ),
          translations!context_translation_id ( id, hebrew_translation, transliteration )
        )
      `,
      )
      .eq('video_id', videoId)
      .order('order_index'),
  ]);

  if (videoRes.error) throw new Error(videoRes.error.message);
  if (segRes.error) throw new Error(segRes.error.message);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const video = videoRes.data as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const segments: EditableSegment[] = ((segRes.data as any[]) ?? []).map((seg: any) => ({
    id: seg.id,
    orderIndex: seg.order_index,
    startTime: seg.start_time,
    endTime: seg.end_time,
    arabicText: seg.arabic_text,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    words: ((seg.segment_words as any[]) ?? [])
      .sort((a: any, b: any) => a.word_position - b.word_position)
      .map((sw: any) => ({
        segmentWordId: sw.id,
        wordPosition: sw.word_position,
        arabic: sw.dictionary_entries?.arabic_text ?? '',
        contextTranslationId: sw.context_translation_id,
        hebrew: sw.translations?.hebrew_translation ?? '',
        transliteration: sw.translations?.transliteration ?? '',
      })),
  }));

  return {
    id: video.id,
    title: video.title,
    status: video.status,
    difficultyLevel: video.difficulty_level,
    sourceCredit: video.source_credit ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    categoryId: ((catRes.data as any[]) ?? [])[0]?.category_id ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tagIds: ((tagRes.data as any[]) ?? []).map((t: any) => t.tag_id),
    segments,
  };
}

/**
 * Saves all editable fields for a video.
 *
 * Save rules:
 *   - videos: title + difficulty_level updated in-place.
 *   - video_categories: old row deleted, new row inserted (single category).
 *   - video_tags: old rows deleted, new ones inserted. New tag names are
 *     upserted into the tags table first.
 *   - segments: arabic_text, start_time, end_time updated in-place.
 *   - translations: hebrew_translation + transliteration updated in-place for
 *     each segment_word's context_translation_id — never touches dictionary_entries
 *     or any other video's translations.
 */
export async function saveVideoEdit(
  videoId: string,
  payload: VideoEditSavePayload,
): Promise<void> {
  // 1. Update video metadata
  const { error: vErr } = await supabase
    .from('videos')
    .update({
      title: payload.title,
      difficulty_level: payload.difficultyLevel,
      source_credit: payload.sourceCredit ?? null,
    })
    .eq('id', videoId);
  if (vErr) throw new Error(vErr.message);

  // 2. Replace category (one category per video)
  await supabase.from('video_categories').delete().eq('video_id', videoId);
  if (payload.categoryId) {
    const { error: cErr } = await supabase
      .from('video_categories')
      .insert({ video_id: videoId, category_id: payload.categoryId });
    if (cErr) throw new Error(cErr.message);
  }

  // 3. Replace tags — create new tag names first, then replace video_tags rows
  const createdTagIds: string[] = [];
  for (const name of payload.newTagNames) {
    const { data } = await supabase
      .from('tags')
      .upsert({ name }, { onConflict: 'name' })
      .select('id')
      .single();
    if (data) createdTagIds.push((data as { id: string }).id);
  }

  await supabase.from('video_tags').delete().eq('video_id', videoId);
  const allTagIds = [...payload.existingTagIds, ...createdTagIds];
  for (const tagId of allTagIds) {
    const { error: tErr } = await supabase
      .from('video_tags')
      .insert({ video_id: videoId, tag_id: tagId });
    if (tErr) throw new Error(tErr.message);
  }

  // 4. Update segment text + timing
  for (const seg of payload.segments) {
    const { error: sErr } = await supabase
      .from('segments')
      .update({
        arabic_text: seg.arabicText,
        start_time: seg.startTime,
        end_time: seg.endTime,
      })
      .eq('id', seg.id);
    if (sErr) throw new Error(sErr.message);
  }

  // 5. Update context translations (never dictionary_entries, never other videos' rows)
  for (const seg of payload.segments) {
    for (const word of seg.words) {
      if (!word.contextTranslationId) continue;
      const { error: trErr } = await supabase
        .from('translations')
        .update({
          hebrew_translation: word.hebrew,
          transliteration: word.transliteration,
        })
        .eq('id', word.contextTranslationId);
      if (trErr) throw new Error(trErr.message);
    }
  }
}
