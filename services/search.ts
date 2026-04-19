// Search service — ALL search logic lives here exclusively.
//
// This is the single entry point for all search queries. Keeping it isolated
// means the Phase 3 migration from pg_trgm to Elasticsearch only touches this
// file. No other component or screen should contain search queries.
//
// ## Query pipeline
//
// searchVideos(query) →
//   1. detectLanguage — 'arabic' if query contains U+0600–06FF, else 'hebrew'
//   2. [parallel] fetchDictionaryResults — up to 3 matching dictionary entries
//   2. [parallel] fetchRawVideos — existing search_videos RPC (unchanged)
//   3. buildVideoResults — enriches each video with matchType / matchContext /
//      matchCount using batch queries (never one query per video)
//
// ## Batch query strategy (no per-video queries)
//
// After the RPC returns a list of matching videos, enrichment runs in bulk:
//   • ONE query fetches all tags for all matching videos
//   • ONE query fetches all segments for all matching videos
//   • (Hebrew only) ONE query finds matching dictionary entry IDs via translations
//   • (Hebrew only) ONE query finds which segments use those entries
//   • (Hebrew only) ONE query fetches segment_word positions for context reconstruction
//   • (Hebrew only) ONE query fetches context translations for those words
//
// Sentences are assembled in JavaScript by grouping on segment_id and sorting
// by word_position.

import { supabase } from './supabase';
import type { FeedVideo, SearchResults, DictionaryResult, VideoSearchResult } from '../types';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Search published videos and dictionary entries by title, tag, Arabic word,
 * Hebrew translation, or transliteration.
 *
 * Returns empty results for queries shorter than 2 characters (no network call).
 * Never throws — logs errors and returns empty results on failure.
 */
export async function searchVideos(query: string): Promise<SearchResults> {
  const q = query.trim();
  const searchLanguage = detectLanguage(q);

  if (q.length < 2) {
    return { dictionaryResults: [], videoResults: [], searchLanguage };
  }

  // Dictionary lookup and video list fetch run in parallel.
  const [dictionaryResults, rawVideos] = await Promise.all([
    fetchDictionaryResults(q, searchLanguage),
    fetchRawVideos(q),
  ]);

  const videoResults = await buildVideoResults(rawVideos, q, searchLanguage);

  return { dictionaryResults, videoResults, searchLanguage };
}

// ─── Language detection ───────────────────────────────────────────────────────

/** Returns 'arabic' if the query contains any Arabic-script character. */
function detectLanguage(q: string): 'arabic' | 'hebrew' {
  return /[\u0600-\u06FF]/.test(q) ? 'arabic' : 'hebrew';
}

// ─── Dictionary results ───────────────────────────────────────────────────────

async function fetchDictionaryResults(
  q: string,
  lang: 'arabic' | 'hebrew',
): Promise<DictionaryResult[]> {
  if (lang === 'arabic') {
    // Match arabic_text; take the first translation for display.
    const { data, error } = await supabase
      .from('dictionary_entries')
      .select('id, arabic_text, translations(hebrew_translation, transliteration)')
      .ilike('arabic_text', `%${q}%`)
      .limit(3);

    if (error) {
      console.error('[search] fetchDictionaryResults (arabic) failed:', error.message);
      return [];
    }

    return ((data ?? []) as Array<{
      id: string;
      arabic_text: string;
      translations: Array<{ hebrew_translation: string; transliteration: string }>;
    }>).map((entry) => ({
      entryId: entry.id,
      arabicText: entry.arabic_text,
      transliteration: entry.translations[0]?.transliteration ?? '',
      hebrewTranslation: entry.translations[0]?.hebrew_translation ?? '',
    }));
  } else {
    // Match hebrew_translation OR transliteration; the parent entry carries the Arabic.
    const { data, error } = await supabase
      .from('translations')
      .select('id, hebrew_translation, transliteration, dictionary_entries!inner(id, arabic_text)')
      .or(`hebrew_translation.ilike.%${q}%,transliteration.ilike.%${q}%`)
      .limit(10); // over-fetch to deduplicate by entry

    if (error) {
      console.error('[search] fetchDictionaryResults (hebrew) failed:', error.message);
      return [];
    }

    // Deduplicate by dictionary_entry id; return at most 3.
    const seen = new Set<string>();
    const results: DictionaryResult[] = [];
    for (const row of (data ?? []) as Array<{
      hebrew_translation: string;
      transliteration: string;
      dictionary_entries: { id: string; arabic_text: string };
    }>) {
      const entry = row.dictionary_entries;
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      results.push({
        entryId: entry.id,
        arabicText: entry.arabic_text,
        transliteration: row.transliteration,
        hebrewTranslation: row.hebrew_translation,
      });
      if (results.length >= 3) break;
    }
    return results;
  }
}

// ─── Raw video fetch (existing RPC) ──────────────────────────────────────────

async function fetchRawVideos(q: string): Promise<FeedVideo[]> {
  const { data, error } = await supabase
    .rpc('search_videos', { search_query: q })
    .select('*, video_categories(categories(id, name))');

  if (error) {
    console.error('[search] fetchRawVideos failed:', error.message);
    return [];
  }

  return (data as FeedVideo[]) ?? [];
}

// ─── Video result enrichment ──────────────────────────────────────────────────

async function buildVideoResults(
  videos: FeedVideo[],
  q: string,
  lang: 'arabic' | 'hebrew',
): Promise<VideoSearchResult[]> {
  if (videos.length === 0) return [];

  const videoIds = videos.map((v) => v.id);
  const ql = q.toLowerCase();

  // ── Batch A: tags for all matching videos ──────────────────────────────────
  const { data: tagRows } = await supabase
    .from('video_tags')
    .select('video_id, tags!inner(name)')
    .in('video_id', videoIds);

  // videoId → first matching tag name
  const videoTagMap = new Map<string, string>();
  for (const row of (tagRows ?? []) as Array<{ video_id: string; tags: { name: string } }>) {
    const tagName = row.tags.name;
    if (tagName.toLowerCase().includes(ql) && !videoTagMap.has(row.video_id)) {
      videoTagMap.set(row.video_id, tagName);
    }
  }

  // ── Batch B: all segments for all matching videos ──────────────────────────
  const { data: segRows } = await supabase
    .from('segments')
    .select('id, video_id, arabic_text, order_index')
    .in('video_id', videoIds)
    .order('order_index', { ascending: true });

  const allSegments = (segRows ?? []) as Array<{
    id: string;
    video_id: string;
    arabic_text: string;
    order_index: number;
  }>;

  // Maps populated differently per language.
  // videoId → id of first matching segment
  const firstSegmentMap = new Map<string, string>();
  // videoId → count of matching segments (proxy for word occurrences)
  const segmentCountMap = new Map<string, number>();
  // segmentId → Hebrew sentence assembled from context translations
  const hebrewContextMap = new Map<string, string>();

  if (lang === 'arabic') {
    // Arabic: match is a substring of arabic_text (consistent with pg_trgm ILIKE).
    for (const seg of allSegments) {
      if (seg.arabic_text.includes(q) || seg.arabic_text.toLowerCase().includes(ql)) {
        segmentCountMap.set(seg.video_id, (segmentCountMap.get(seg.video_id) ?? 0) + 1);
        if (!firstSegmentMap.has(seg.video_id)) {
          firstSegmentMap.set(seg.video_id, seg.id);
        }
      }
    }
    // Arabic context = segment.arabic_text — assembled below when building results.
  } else {
    // Hebrew: must go through segment_words → dictionary_entries → translations.
    await enrichHebrewSegments(allSegments, q, ql, firstSegmentMap, segmentCountMap, hebrewContextMap);
  }

  // ── Assemble one VideoSearchResult per video ──────────────────────────────
  const results: VideoSearchResult[] = videos.map((video) => {
    const firstSegId = firstSegmentMap.get(video.id);
    const segCount = segmentCountMap.get(video.id) ?? 0;

    if (firstSegId && segCount > 0) {
      let matchContext: string | null;
      if (lang === 'arabic') {
        matchContext = allSegments.find((s) => s.id === firstSegId)?.arabic_text ?? null;
      } else {
        matchContext = hebrewContextMap.get(firstSegId) ?? null;
      }
      return { video, matchType: 'segment', matchContext, matchCount: segCount };
    }

    if (videoTagMap.has(video.id)) {
      return {
        video,
        matchType: 'tag',
        matchContext: videoTagMap.get(video.id)!,
        matchCount: 1,
      };
    }

    // Title match (or unknown — the RPC found it).
    return { video, matchType: 'title', matchContext: null, matchCount: 1 };
  });

  // Sort: segment matches first, then by matchCount DESC, then published_at DESC.
  results.sort((a, b) => {
    // Segment matches outrank tag and title matches.
    const typeOrder = { segment: 0, tag: 1, title: 2 };
    const typeDiff = typeOrder[a.matchType] - typeOrder[b.matchType];
    if (typeDiff !== 0) return typeDiff;

    if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;

    const dateA = a.video.published_at ?? a.video.created_at;
    const dateB = b.video.published_at ?? b.video.created_at;
    return dateB.localeCompare(dateA);
  });

  return results;
}

// ─── Hebrew segment enrichment (batch) ───────────────────────────────────────

/**
 * Fills firstSegmentMap, segmentCountMap, and hebrewContextMap for Hebrew searches.
 *
 * Query sequence (all batch — no per-video queries):
 *   C. Find dictionary_entry IDs whose translations match the query.
 *   D. Find segment IDs (from our video set) that use those entries.
 *   E. Fetch segment_word positions for the first matching segment per video.
 *   F. Fetch context translations for those words.
 * JavaScript assembles Hebrew sentences by grouping on segment_id and sorting
 * by word_position.
 */
async function enrichHebrewSegments(
  allSegments: Array<{ id: string; video_id: string; arabic_text: string; order_index: number }>,
  _q: string,
  ql: string,
  firstSegmentMap: Map<string, string>,
  segmentCountMap: Map<string, number>,
  hebrewContextMap: Map<string, string>,
): Promise<void> {
  if (allSegments.length === 0) return;

  const allSegmentIds = allSegments.map((s) => s.id);

  // ── Batch C: dictionary entries whose translations match ───────────────────
  const { data: matchingTransRows, error: errC } = await supabase
    .from('translations')
    .select('entry_id')
    .or(`hebrew_translation.ilike.%${ql}%,transliteration.ilike.%${ql}%`);

  if (errC) {
    console.error('[search] enrichHebrewSegments batch C failed:', errC.message);
    return;
  }

  const matchingEntryIds = [
    ...new Set((matchingTransRows ?? []).map((r: { entry_id: string }) => r.entry_id)),
  ];
  if (matchingEntryIds.length === 0) return;

  // ── Batch D: segment_words in our video set that use those entries ─────────
  const { data: matchingSwRows, error: errD } = await supabase
    .from('segment_words')
    .select('segment_id, dictionary_entry_id')
    .in('segment_id', allSegmentIds)
    .in('dictionary_entry_id', matchingEntryIds);

  if (errD) {
    console.error('[search] enrichHebrewSegments batch D failed:', errD.message);
    return;
  }

  const matchingSwData = (matchingSwRows ?? []) as Array<{
    segment_id: string;
    dictionary_entry_id: string;
  }>;
  if (matchingSwData.length === 0) return;

  // Build segment → video map for order_index lookup.
  const segmentMeta = new Map(
    allSegments.map((s) => [s.id, { video_id: s.video_id, order_index: s.order_index }]),
  );

  // Count occurrences and find first matching segment per video.
  // Segments are already ordered by order_index (from Batch B).
  const matchingSegmentIds = new Set(matchingSwData.map((sw) => sw.segment_id));
  for (const segId of matchingSegmentIds) {
    const meta = segmentMeta.get(segId);
    if (!meta) continue;
    segmentCountMap.set(meta.video_id, (segmentCountMap.get(meta.video_id) ?? 0) + 1);
    // Keep the first (lowest order_index) matching segment per video.
    const existing = firstSegmentMap.get(meta.video_id);
    if (!existing || meta.order_index < segmentMeta.get(existing)!.order_index) {
      firstSegmentMap.set(meta.video_id, segId);
    }
  }

  const firstSegmentIds = [...firstSegmentMap.values()];
  if (firstSegmentIds.length === 0) return;

  // ── Batch E: segment_words for first matching segments ────────────────────
  const { data: swRows, error: errE } = await supabase
    .from('segment_words')
    .select('segment_id, word_position, context_translation_id')
    .in('segment_id', firstSegmentIds)
    .not('context_translation_id', 'is', null)
    .order('word_position', { ascending: true });

  if (errE) {
    console.error('[search] enrichHebrewSegments batch E failed:', errE.message);
    return;
  }

  const swData = (swRows ?? []) as Array<{
    segment_id: string;
    word_position: number;
    context_translation_id: string;
  }>;

  const contextTranslationIds = swData.map((sw) => sw.context_translation_id);
  if (contextTranslationIds.length === 0) return;

  // ── Batch F: fetch the context translations ────────────────────────────────
  const { data: transRows, error: errF } = await supabase
    .from('translations')
    .select('id, hebrew_translation')
    .in('id', contextTranslationIds);

  if (errF) {
    console.error('[search] enrichHebrewSegments batch F failed:', errF.message);
    return;
  }

  const transMap = new Map(
    ((transRows ?? []) as Array<{ id: string; hebrew_translation: string }>).map((t) => [
      t.id,
      t.hebrew_translation,
    ]),
  );

  // ── Assemble Hebrew sentences per segment (group + sort by word_position) ──
  const wordsBySegment = new Map<string, Array<{ pos: number; hebrew: string }>>();
  for (const sw of swData) {
    const hebrew = transMap.get(sw.context_translation_id);
    if (!hebrew) continue;
    if (!wordsBySegment.has(sw.segment_id)) wordsBySegment.set(sw.segment_id, []);
    wordsBySegment.get(sw.segment_id)!.push({ pos: sw.word_position, hebrew });
  }

  for (const [segId, words] of wordsBySegment) {
    words.sort((a, b) => a.pos - b.pos);
    hebrewContextMap.set(segId, words.map((w) => w.hebrew).join(' '));
  }
}
