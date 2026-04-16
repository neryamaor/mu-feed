// Admin — Steps 2–6: Transcription → Translation → Phrase Marking →
// Dictionary Sync → Metadata + Publish.
//
// Receives videoId and fileUri from the upload screen via URL params.
// All wizard state lives in component state — nothing is persisted to
// Supabase until the admin explicitly advances each step.
//
// Step 2: Transcription (Whisper auto or manual) → saves segments to DB
// Step 3: Translation (Claude auto or manual) → edits words in memory
// Step 4: Phrase marking → groups words into phrases in memory
// Step 5: Dictionary sync → upserts dictionary_entries + translations,
//          handles conflicts, writes segment_words
// Step 6: Metadata (category, tags, difficulty) + Publish

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../services/supabase';
import { transcribeVideo } from '../../../services/whisper';
import { translateSegment } from '../../../services/translation';
import {
  insertSegment,
  lookupDictionaryEntry,
  insertDictionaryEntry,
  lookupTranslation,
  fetchAllTranslations,
  insertTranslation,
  replaceTranslation,
  insertSegmentWord,
} from '../../../services/dictionary';
import type {
  AdminSegment,
  AdminWord,
  AdminPhraseGroup,
  DictionaryConflict,
  Category,
} from '../../../types';

type WizardStep = 2 | 3 | 4 | 5 | 6;

// ─── Small helper: generate local UUIDs ──────────────────────────────────────
function localId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── Whisper segment → AdminSegment ──────────────────────────────────────────
function whisperToAdminSegment(
  seg: { start: number; end: number; text: string },
  orderIndex: number,
): AdminSegment {
  const arabicText = seg.text.trim();
  const rawWords = arabicText.split(/\s+/).filter(Boolean);
  const words: AdminWord[] = rawWords.map((w, i) => ({
    position: i,
    arabic: w,
    hebrew: '',
    transliteration: '',
    phraseGroupId: null,
  }));
  return {
    orderIndex,
    startTime: seg.start,
    endTime: seg.end,
    arabicText,
    segmentHebrew: '',
    segmentTransliteration: '',
    words,
    phraseGroups: [],
    savedSegmentId: null,
  };
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: WizardStep }) {
  const steps: WizardStep[] = [2, 3, 4, 5, 6];
  const labels = ['תמלול', 'תרגום', 'ביטויים', 'מילון', 'פרסום'];
  return (
    <View style={si.row}>
      {steps.map((s, i) => (
        <View key={s} style={si.item}>
          <View style={[si.pill, current === s && si.pillActive]}>
            <Text style={[si.pillText, current === s && si.pillTextActive]}>{s}</Text>
          </View>
          <Text style={[si.label, current === s && si.labelActive]}>{labels[i]}</Text>
        </View>
      ))}
    </View>
  );
}

const si = StyleSheet.create({
  row: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  item: { alignItems: 'center', gap: 4 },
  pill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  pillActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  pillText: { color: '#6b7280', fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: '#fff' },
  label: { color: '#6b7280', fontSize: 10 },
  labelActive: { color: '#fff' },
});

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminReviewScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { videoId, fileUri } = useLocalSearchParams<{ videoId: string; fileUri: string }>();

  const [step, setStep] = useState<WizardStep>(2);
  const [segments, setSegments] = useState<AdminSegment[]>([]);
  const [conflicts, setConflicts] = useState<DictionaryConflict[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<number | null>(null);

  // Step 2
  const [whisperLoading, setWhisperLoading] = useState(false);
  // Manual "add segment" form
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');
  const [manualText, setManualText] = useState('');
  const [step2Saving, setStep2Saving] = useState(false);

  // Step 3
  const [translateProgress, setTranslateProgress] = useState('');

  // Step 4 — phrase marking
  const [phraseStart, setPhraseStart] = useState<{ segIdx: number; wordPos: number } | null>(null);
  const [phraseEnd, setPhraseEnd] = useState<{ segIdx: number; wordPos: number } | null>(null);
  const [phraseHebrew, setPhraseHebrew] = useState('');
  const [phraseTranslit, setPhraseTranslit] = useState('');

  // Step 5
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  // Pending segment_words to write after conflict resolution
  const [pendingSegmentWords, setPendingSegmentWords] = useState<
    Array<{
      segmentId: string;
      entryId: string;
      translationId: string;
      wordPosition: number;
    }>
  >([]);

  // Step 6
  const [publishing, setPublishing] = useState(false);

  // ─── Load categories (for Step 6) ──────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .order('name')
      .then(({ data }) => setCategories((data as Category[]) ?? []));
  }, []);

  // ─── Step 5: run sync automatically when entering step ─────────────────────
  useEffect(() => {
    if (step === 5 && !syncDone && !syncLoading) {
      runDictionarySync();
    }
  }, [step]);

  // ─── Step 2 handlers ────────────────────────────────────────────────────────

  async function handleRunWhisper() {
    if (!fileUri) return;
    setWhisperLoading(true);
    const result = await transcribeVideo(decodeURIComponent(fileUri));
    if (result.length === 0) {
      Alert.alert('שגיאה', 'Whisper לא הצליח לתמלל. הזן סגמנטים ידנית.');
    } else {
      setSegments(result.map((s, i) => whisperToAdminSegment(s, i)));
    }
    setWhisperLoading(false);
  }

  function addManualSegment() {
    const start = parseFloat(manualStart);
    const end = parseFloat(manualEnd);
    const text = manualText.trim();
    if (!text || isNaN(start) || isNaN(end)) return;

    const newSeg = whisperToAdminSegment({ start, end, text }, segments.length);
    setSegments((prev) => [...prev, newSeg]);
    setManualStart('');
    setManualEnd('');
    setManualText('');
  }

  function updateSegmentArabic(idx: number, value: string) {
    setSegments((prev) => {
      const updated = [...prev];
      const seg = { ...updated[idx], arabicText: value };
      // Re-split words when Arabic text changes
      const rawWords = value.split(/\s+/).filter(Boolean);
      seg.words = rawWords.map((w, i) => ({
        position: i,
        arabic: w,
        hebrew: seg.words[i]?.hebrew ?? '',
        transliteration: seg.words[i]?.transliteration ?? '',
        phraseGroupId: null,
      }));
      seg.phraseGroups = [];
      updated[idx] = seg;
      return updated;
    });
  }

  function deleteSegment(idx: number) {
    setSegments((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, orderIndex: i })));
  }

  async function saveSegments() {
    if (segments.length === 0) {
      Alert.alert('שגיאה', 'יש להוסיף לפחות סגמנט אחד.');
      return;
    }
    setStep2Saving(true);
    try {
      const updated = await Promise.all(
        segments.map(async (seg) => {
          const id = await insertSegment(
            videoId,
            seg.orderIndex,
            seg.startTime,
            seg.endTime,
            seg.arabicText,
          );
          return { ...seg, savedSegmentId: id };
        }),
      );
      setSegments(updated);
      setStep(3);
    } catch (err) {
      Alert.alert('שגיאה', err instanceof Error ? err.message : String(err));
    } finally {
      setStep2Saving(false);
    }
  }

  // ─── Step 3 handlers ────────────────────────────────────────────────────────

  async function translateAll() {
    for (let i = 0; i < segments.length; i++) {
      setTranslateProgress(`מתרגם ${i + 1}/${segments.length}...`);
      const result = await translateSegment(segments[i].arabicText);
      if (!result) continue;

      setSegments((prev) => {
        const updated = [...prev];
        const seg = { ...updated[i] };
        seg.segmentHebrew = result.translation;
        seg.segmentTransliteration = result.transliteration;

        // Merge per-word data from Claude into existing word objects
        seg.words = seg.words.map((w) => {
          const match = result.words.find((rw) => rw.arabic === w.arabic);
          return match
            ? { ...w, hebrew: match.hebrew, transliteration: match.transliteration }
            : w;
        });
        updated[i] = seg;
        return updated;
      });
    }
    setTranslateProgress('');
  }

  function updateWord(
    segIdx: number,
    wordPos: number,
    field: 'hebrew' | 'transliteration',
    value: string,
  ) {
    setSegments((prev) => {
      const updated = [...prev];
      const seg = { ...updated[segIdx] };
      seg.words = seg.words.map((w) =>
        w.position === wordPos ? { ...w, [field]: value } : w,
      );
      updated[segIdx] = seg;
      return updated;
    });
  }

  // ─── Step 4 handlers ─────────────────────────────────────────────────────────

  function handleWordChipTap(segIdx: number, wordPos: number) {
    if (!phraseStart || phraseStart.segIdx !== segIdx) {
      // Start a new selection on this segment
      setPhraseStart({ segIdx, wordPos });
      setPhraseEnd(null);
      return;
    }
    if (phraseStart.wordPos === wordPos) {
      // Deselect
      setPhraseStart(null);
      setPhraseEnd(null);
      return;
    }
    // Second tap — set end
    const start = Math.min(phraseStart.wordPos, wordPos);
    const end = Math.max(phraseStart.wordPos, wordPos);
    setPhraseStart({ segIdx, wordPos: start });
    setPhraseEnd({ segIdx, wordPos: end });
  }

  function confirmPhrase() {
    if (!phraseStart || !phraseEnd) return;
    const { segIdx } = phraseStart;
    const seg = segments[segIdx];
    const wordsInRange = seg.words.filter(
      (w) => w.position >= phraseStart.wordPos && w.position <= phraseEnd.wordPos,
    );
    const arabicText = wordsInRange.map((w) => w.arabic).join(' ');

    const group: AdminPhraseGroup = {
      id: localId(),
      startPosition: phraseStart.wordPos,
      endPosition: phraseEnd.wordPos,
      arabicText,
      hebrew: phraseHebrew.trim(),
      transliteration: phraseTranslit.trim(),
    };

    setSegments((prev) => {
      const updated = [...prev];
      const s = { ...updated[segIdx] };
      // Mark words in range as belonging to this group
      s.words = s.words.map((w) =>
        w.position >= group.startPosition && w.position <= group.endPosition
          ? { ...w, phraseGroupId: group.id }
          : w,
      );
      s.phraseGroups = [...s.phraseGroups, group];
      updated[segIdx] = s;
      return updated;
    });

    setPhraseStart(null);
    setPhraseEnd(null);
    setPhraseHebrew('');
    setPhraseTranslit('');
  }

  function deletePhrase(segIdx: number, groupId: string) {
    setSegments((prev) => {
      const updated = [...prev];
      const s = { ...updated[segIdx] };
      s.phraseGroups = s.phraseGroups.filter((g) => g.id !== groupId);
      s.words = s.words.map((w) =>
        w.phraseGroupId === groupId ? { ...w, phraseGroupId: null } : w,
      );
      updated[segIdx] = s;
      return updated;
    });
  }

  // ─── Step 5: dictionary sync ─────────────────────────────────────────────────

  async function runDictionarySync() {
    setSyncLoading(true);
    const newConflicts: DictionaryConflict[] = [];
    const pending: typeof pendingSegmentWords = [];

    for (let segIdx = 0; segIdx < segments.length; segIdx++) {
      const seg = segments[segIdx];
      if (!seg.savedSegmentId) continue;

      // Build the effective word list for this segment, respecting phrase groups.
      // For each word position, emit either the phrase (if first word of group)
      // or the individual word. Words that are in a phrase but not first are skipped.
      const phraseGroupMap = new Map<string, AdminPhraseGroup>(
        seg.phraseGroups.map((g) => [g.id, g]),
      );

      for (const word of seg.words) {
        const isInPhrase = word.phraseGroupId !== null;
        const isFirstInPhrase =
          isInPhrase &&
          phraseGroupMap.get(word.phraseGroupId!)?.startPosition === word.position;

        let arabic: string;
        let hebrew: string;
        let transliteration: string;
        let isPhrase: boolean;
        let wordPosition: number;

        if (isInPhrase && !isFirstInPhrase) {
          // Covered by the phrase entry — skip individual word
          continue;
        } else if (isInPhrase && isFirstInPhrase) {
          const group = phraseGroupMap.get(word.phraseGroupId!)!;
          arabic = group.arabicText;
          hebrew = group.hebrew;
          transliteration = group.transliteration;
          isPhrase = true;
          wordPosition = word.position;
        } else {
          arabic = word.arabic;
          hebrew = word.hebrew;
          transliteration = word.transliteration;
          isPhrase = false;
          wordPosition = word.position;
        }

        if (!arabic || !hebrew) continue;

        try {
          let entryId: string;
          const existing = await lookupDictionaryEntry(arabic);
          if (!existing) {
            entryId = await insertDictionaryEntry(arabic, isPhrase);
          } else {
            entryId = existing.id;
          }

          const existingTr = await lookupTranslation(entryId, hebrew);
          if (existingTr) {
            // Identical translation already in DB — use it directly
            pending.push({
              segmentId: seg.savedSegmentId!,
              entryId,
              translationId: existingTr.id,
              wordPosition,
            });
          } else {
            const allTr = await fetchAllTranslations(entryId);
            if (allTr.length > 0) {
              // Conflict: entry exists with different translation(s)
              newConflicts.push({
                arabicText: arabic,
                entryId,
                existingTranslationId: allTr[0].id,
                existingHebrew: allTr[0].hebrew_translation,
                newHebrew: hebrew,
                newTransliteration: transliteration,
                segmentIndex: segIdx,
                wordPosition,
                resolution: null,
              });
            } else {
              // New translation for existing entry — insert
              const translationId = await insertTranslation(entryId, hebrew, transliteration);
              pending.push({
                segmentId: seg.savedSegmentId!,
                entryId,
                translationId,
                wordPosition,
              });
            }
          }
        } catch (err) {
          console.error('[sync]', err);
        }
      }
    }

    setPendingSegmentWords(pending);

    if (newConflicts.length === 0) {
      // No conflicts — write all segment_words now
      await writeSegmentWords(pending);
      setSyncDone(true);
    } else {
      setConflicts(newConflicts);
    }

    setSyncLoading(false);
  }

  async function writeSegmentWords(
    rows: typeof pendingSegmentWords,
  ) {
    for (const row of rows) {
      try {
        await insertSegmentWord(
          row.segmentId,
          row.entryId,
          row.translationId,
          row.wordPosition,
        );
      } catch (err) {
        console.error('[sync] insertSegmentWord failed:', err);
      }
    }
  }

  function setConflictResolution(idx: number, resolution: 'replace' | 'add') {
    setConflicts((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, resolution } : c)),
    );
  }

  const allConflictsResolved =
    conflicts.length > 0 && conflicts.every((c) => c.resolution !== null);

  async function applyConflictResolutions() {
    const extraPending: typeof pendingSegmentWords = [];

    for (const conflict of conflicts) {
      const seg = segments[conflict.segmentIndex];
      if (!seg.savedSegmentId) continue;

      let translationId: string;

      if (conflict.resolution === 'replace') {
        await replaceTranslation(
          conflict.existingTranslationId,
          conflict.newHebrew,
          conflict.newTransliteration,
        );
        translationId = conflict.existingTranslationId;
      } else {
        // 'add' — insert as additional translation
        translationId = await insertTranslation(
          conflict.entryId,
          conflict.newHebrew,
          conflict.newTransliteration,
        );
      }

      extraPending.push({
        segmentId: seg.savedSegmentId,
        entryId: conflict.entryId,
        translationId,
        wordPosition: conflict.wordPosition,
      });
    }

    const allRows = [...pendingSegmentWords, ...extraPending];
    await writeSegmentWords(allRows);
    setConflicts([]);
    setSyncDone(true);
  }

  // ─── Back / Cancel ───────────────────────────────────────────────────────────

  function clearStepsAfter(targetStep: WizardStep) {
    if (targetStep <= 2) {
      // Clear steps 3+: translations, phrases, sync, publish
      setSegments((prev) =>
        prev.map((seg) => ({
          ...seg,
          segmentHebrew: '',
          segmentTransliteration: '',
          words: seg.words.map((w) => ({ ...w, hebrew: '', transliteration: '', phraseGroupId: null })),
          phraseGroups: [],
        })),
      );
      setTranslateProgress('');
      setPhraseStart(null);
      setPhraseEnd(null);
      setPhraseHebrew('');
      setPhraseTranslit('');
      setConflicts([]);
      setPendingSegmentWords([]);
      setSyncDone(false);
      setSyncLoading(false);
      setSelectedCategoryId(null);
      setTags([]);
      setTagInput('');
      setDifficulty(null);
    } else if (targetStep === 3) {
      // Clear steps 4+: phrases, sync, publish
      setSegments((prev) =>
        prev.map((seg) => ({
          ...seg,
          phraseGroups: [],
          words: seg.words.map((w) => ({ ...w, phraseGroupId: null })),
        })),
      );
      setPhraseStart(null);
      setPhraseEnd(null);
      setPhraseHebrew('');
      setPhraseTranslit('');
      setConflicts([]);
      setPendingSegmentWords([]);
      setSyncDone(false);
      setSyncLoading(false);
      setSelectedCategoryId(null);
      setTags([]);
      setTagInput('');
      setDifficulty(null);
    } else if (targetStep === 4) {
      // Clear steps 5+: sync, publish
      setConflicts([]);
      setPendingSegmentWords([]);
      setSyncDone(false);
      setSyncLoading(false);
      setSelectedCategoryId(null);
      setTags([]);
      setTagInput('');
      setDifficulty(null);
    } else if (targetStep === 5) {
      // Clear step 6: publish; also reset sync so it re-runs on step 5 mount
      setConflicts([]);
      setPendingSegmentWords([]);
      setSyncDone(false);
      setSyncLoading(false);
      setSelectedCategoryId(null);
      setTags([]);
      setTagInput('');
      setDifficulty(null);
    }
  }

  function goBack() {
    if (step <= 2) return;
    const target = (step - 1) as WizardStep;
    clearStepsAfter(target);
    setStep(target);
  }

  function handleCancel() {
    Alert.alert(
      'ביטול',
      'האם לבטל? הסרטון הטיוטה נשמר ב-Supabase ויש למחוק אותו ידנית אם צריך.',
      [
        { text: 'המשך עריכה', style: 'cancel' },
        {
          text: 'בטל',
          style: 'destructive',
          onPress: () => router.replace('/(tabs)/feed'),
        },
      ],
    );
  }

  // ─── Step 6: publish ─────────────────────────────────────────────────────────

  function addTag() {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput('');
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  async function handlePublish() {
    if (!selectedCategoryId) {
      Alert.alert('שגיאה', 'יש לבחור קטגוריה.');
      return;
    }
    if (!difficulty) {
      Alert.alert('שגיאה', 'יש לבחור רמת קושי.');
      return;
    }

    setPublishing(true);
    try {
      // Upsert tags → insert into video_tags
      for (const tagName of tags) {
        const { data: tagData } = await supabase
          .from('tags')
          .upsert({ name: tagName }, { onConflict: 'name' })
          .select('id')
          .single();
        if (tagData) {
          await supabase
            .from('video_tags')
            .insert({ video_id: videoId, tag_id: (tagData as { id: string }).id })
            .throwOnError();
        }
      }

      // Set category
      await supabase
        .from('video_categories')
        .insert({ video_id: videoId, category_id: selectedCategoryId })
        .throwOnError();

      // Publish
      await supabase
        .from('videos')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
          difficulty_level: difficulty,
        })
        .eq('id', videoId)
        .throwOnError();

      router.replace('/(tabs)/feed');
    } catch (err) {
      Alert.alert('שגיאה', err instanceof Error ? err.message : String(err));
    } finally {
      setPublishing(false);
    }
  }

  // ─── Render helpers ──────────────────────────────────────────────────────────

  function renderStep2() {
    return (
      <View>
        <Text style={styles.stepTitle}>שלב 2 — תמלול</Text>

        <View style={styles.buttonRow}>
          <Pressable style={styles.actionButton} onPress={handleRunWhisper} disabled={whisperLoading}>
            {whisperLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionButtonText}>הפעל Whisper</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>הוספה ידנית</Text>
        <View style={styles.manualForm}>
          <TextInput
            style={[styles.input, styles.inputSmall]}
            value={manualStart}
            onChangeText={setManualStart}
            placeholder="התחלה (שניות)"
            placeholderTextColor="#6b7280"
            keyboardType="decimal-pad"
          />
          <TextInput
            style={[styles.input, styles.inputSmall]}
            value={manualEnd}
            onChangeText={setManualEnd}
            placeholder="סוף (שניות)"
            placeholderTextColor="#6b7280"
            keyboardType="decimal-pad"
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={manualText}
            onChangeText={setManualText}
            placeholder="טקסט ערבי"
            placeholderTextColor="#6b7280"
            textAlign="right"
          />
          <Pressable style={styles.smallButton} onPress={addManualSegment}>
            <Text style={styles.smallButtonText}>הוסף</Text>
          </Pressable>
        </View>

        {segments.map((seg, idx) => (
          <View key={idx} style={styles.segmentCard}>
            <View style={styles.segmentHeader}>
              <Text style={styles.segmentIndex}>#{idx + 1}</Text>
              <Text style={styles.segmentTime}>
                {seg.startTime.toFixed(1)}s — {seg.endTime.toFixed(1)}s
              </Text>
              <Pressable onPress={() => deleteSegment(idx)}>
                <Text style={styles.deleteText}>מחק</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.segmentInput}
              value={seg.arabicText}
              onChangeText={(v) => updateSegmentArabic(idx, v)}
              multiline
              textAlign="right"
            />
          </View>
        ))}

        <Pressable
          style={[styles.primaryButton, step2Saving && styles.primaryButtonDisabled]}
          onPress={saveSegments}
          disabled={step2Saving}
        >
          {step2Saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>אשר ושמור סגמנטים</Text>
          )}
        </Pressable>
      </View>
    );
  }

  function renderStep3() {
    return (
      <View>
        <Text style={styles.stepTitle}>שלב 3 — תרגום</Text>

        <Pressable
          style={[styles.actionButton, { marginBottom: 16 }]}
          onPress={translateAll}
          disabled={!!translateProgress}
        >
          {translateProgress ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.actionButtonText}>{translateProgress}</Text>
            </View>
          ) : (
            <Text style={styles.actionButtonText}>תרגם הכל עם Claude</Text>
          )}
        </Pressable>

        {segments.map((seg, segIdx) => (
          <View key={segIdx} style={styles.segmentCard}>
            <Text style={styles.segmentArabic}>{seg.arabicText}</Text>

            {/* Segment-level reference */}
            {seg.segmentHebrew ? (
              <Text style={styles.segmentRefHebrew}>
                📌 {seg.segmentHebrew} / {seg.segmentTransliteration}
              </Text>
            ) : null}

            {/* Per-word editing */}
            {seg.words.map((word) => (
              <View key={word.position} style={styles.wordRow}>
                <Text style={styles.wordArabic}>{word.arabic}</Text>
                <TextInput
                  style={[styles.wordInput, { flex: 1 }]}
                  value={word.hebrew}
                  onChangeText={(v) => updateWord(segIdx, word.position, 'hebrew', v)}
                  placeholder="עברית"
                  placeholderTextColor="#6b7280"
                  textAlign="right"
                />
                <TextInput
                  style={[styles.wordInput, { flex: 1 }]}
                  value={word.transliteration}
                  onChangeText={(v) => updateWord(segIdx, word.position, 'transliteration', v)}
                  placeholder="תעתיק"
                  placeholderTextColor="#6b7280"
                  textAlign="right"
                />
              </View>
            ))}
          </View>
        ))}

        <Pressable style={styles.primaryButton} onPress={() => setStep(4)}>
          <Text style={styles.primaryButtonText}>אשר תרגום</Text>
        </Pressable>
      </View>
    );
  }

  function renderStep4() {
    const selectionActive = phraseStart !== null && phraseEnd !== null;

    return (
      <View>
        <Text style={styles.stepTitle}>שלב 4 — סימון ביטויים (אופציונלי)</Text>
        <Text style={styles.hintText}>
          הקש על מילה ראשונה, אחר כך על מילה אחרונה, ואז סמן כביטוי.
        </Text>

        {segments.map((seg, segIdx) => (
          <View key={segIdx} style={styles.segmentCard}>
            <Text style={styles.segmentArabic}>{seg.arabicText}</Text>

            {/* Word chips */}
            <View style={styles.chipRow}>
              {seg.words.map((word) => {
                const isStart =
                  phraseStart?.segIdx === segIdx && phraseStart?.wordPos === word.position;
                const isInRange =
                  phraseStart?.segIdx === segIdx &&
                  phraseEnd?.segIdx === segIdx &&
                  word.position >= phraseStart.wordPos &&
                  word.position <= phraseEnd.wordPos;
                const isMarked = word.phraseGroupId !== null;

                return (
                  <Pressable
                    key={word.position}
                    style={[
                      styles.chip,
                      isMarked && styles.chipMarked,
                      isInRange && styles.chipRange,
                      isStart && styles.chipStart,
                    ]}
                    onPress={() => handleWordChipTap(segIdx, word.position)}
                  >
                    <Text style={styles.chipText}>{word.arabic}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Phrase marking form — shown when a range on this segment is selected */}
            {selectionActive && phraseStart?.segIdx === segIdx && (
              <View style={styles.phraseForm}>
                <TextInput
                  style={styles.input}
                  value={phraseHebrew}
                  onChangeText={setPhraseHebrew}
                  placeholder="תרגום הביטוי"
                  placeholderTextColor="#6b7280"
                  textAlign="right"
                />
                <TextInput
                  style={styles.input}
                  value={phraseTranslit}
                  onChangeText={setPhraseTranslit}
                  placeholder="תעתיק הביטוי"
                  placeholderTextColor="#6b7280"
                  textAlign="right"
                />
                <Pressable style={styles.smallButton} onPress={confirmPhrase}>
                  <Text style={styles.smallButtonText}>סמן כביטוי</Text>
                </Pressable>
              </View>
            )}

            {/* Existing phrase badges */}
            {seg.phraseGroups.map((group) => (
              <View key={group.id} style={styles.phraseBadge}>
                <Text style={styles.phraseBadgeText}>
                  {group.arabicText} → {group.hebrew}
                </Text>
                <Pressable onPress={() => deletePhrase(segIdx, group.id)}>
                  <Text style={styles.deleteText}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ))}

        <Pressable style={styles.primaryButton} onPress={() => setStep(5)}>
          <Text style={styles.primaryButtonText}>המשך לסנכרון מילון</Text>
        </Pressable>
      </View>
    );
  }

  function renderStep5() {
    if (syncLoading) {
      return (
        <View style={styles.centeredBox}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.statusText}>מסנכרן מילון...</Text>
        </View>
      );
    }

    if (syncDone) {
      return (
        <View>
          <Text style={styles.stepTitle}>שלב 5 — סנכרון מילון</Text>
          <View style={styles.successBox}>
            <Text style={styles.successText}>אין התנגשויות — הכל תקין ✓</Text>
          </View>
          <Pressable style={styles.primaryButton} onPress={() => setStep(6)}>
            <Text style={styles.primaryButtonText}>המשך לפרסום</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View>
        <Text style={styles.stepTitle}>שלב 5 — סנכרון מילון</Text>
        <Text style={styles.hintText}>
          נמצאו {conflicts.length} התנגשויות. יש לבחור פעולה לכל אחת.
        </Text>

        {conflicts.map((conflict, idx) => (
          <View key={idx} style={styles.conflictCard}>
            <Text style={styles.conflictArabic}>{conflict.arabicText}</Text>
            <View style={styles.conflictRow}>
              <View style={styles.conflictSide}>
                <Text style={styles.conflictLabel}>קיים</Text>
                <Text style={styles.conflictValue}>{conflict.existingHebrew}</Text>
              </View>
              <View style={styles.conflictSide}>
                <Text style={styles.conflictLabel}>חדש</Text>
                <Text style={styles.conflictValue}>{conflict.newHebrew}</Text>
              </View>
            </View>
            <View style={styles.conflictButtons}>
              <Pressable
                style={[
                  styles.conflictButton,
                  conflict.resolution === 'replace' && styles.conflictButtonActive,
                ]}
                onPress={() => setConflictResolution(idx, 'replace')}
              >
                <Text style={styles.conflictButtonText}>החלף</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.conflictButton,
                  conflict.resolution === 'add' && styles.conflictButtonActive,
                ]}
                onPress={() => setConflictResolution(idx, 'add')}
              >
                <Text style={styles.conflictButtonText}>הוסף כנוסף</Text>
              </Pressable>
            </View>
          </View>
        ))}

        <Pressable
          style={[styles.primaryButton, !allConflictsResolved && styles.primaryButtonDisabled]}
          onPress={applyConflictResolutions}
          disabled={!allConflictsResolved}
        >
          <Text style={styles.primaryButtonText}>אשר והמשך לפרסום</Text>
        </Pressable>
      </View>
    );
  }

  function renderStep6() {
    return (
      <View>
        <Text style={styles.stepTitle}>שלב 6 — פרסום</Text>

        {/* Category */}
        <Text style={styles.sectionLabel}>קטגוריה</Text>
        {categories.map((cat) => (
          <Pressable
            key={cat.id}
            style={[
              styles.radioRow,
              selectedCategoryId === cat.id && styles.radioRowSelected,
            ]}
            onPress={() => setSelectedCategoryId(cat.id)}
          >
            <Text style={styles.radioText}>{cat.name}</Text>
            {selectedCategoryId === cat.id && <Text style={styles.radioCheck}>✓</Text>}
          </Pressable>
        ))}

        {/* Tags */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>תגיות</Text>
        <View style={styles.tagInputRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={tagInput}
            onChangeText={setTagInput}
            placeholder="שם תגית"
            placeholderTextColor="#6b7280"
            textAlign="right"
            onSubmitEditing={addTag}
            returnKeyType="done"
          />
          <Pressable style={styles.smallButton} onPress={addTag}>
            <Text style={styles.smallButtonText}>הוסף</Text>
          </Pressable>
        </View>
        <View style={styles.chipRow}>
          {tags.map((tag) => (
            <View key={tag} style={styles.tagChip}>
              <Text style={styles.tagChipText}>{tag}</Text>
              <Pressable onPress={() => removeTag(tag)}>
                <Text style={styles.deleteText}> ✕</Text>
              </Pressable>
            </View>
          ))}
        </View>

        {/* Difficulty */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>רמת קושי</Text>
        <View style={styles.difficultyRow}>
          {[1, 2, 3, 4, 5].map((d) => (
            <Pressable
              key={d}
              style={[styles.diffButton, difficulty === d && styles.diffButtonActive]}
              onPress={() => setDifficulty(d)}
            >
              <Text style={[styles.diffButtonText, difficulty === d && styles.diffButtonTextActive]}>
                {d}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[styles.primaryButton, { marginTop: 32 }, publishing && styles.primaryButtonDisabled]}
          onPress={handlePublish}
          disabled={publishing}
        >
          {publishing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>פרסם</Text>
          )}
        </Pressable>
      </View>
    );
  }

  // ─── Root render ─────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      keyboardShouldPersistTaps="handled"
    >
      <StepIndicator current={step} />

      {/* Back / Cancel navigation row */}
      <View style={styles.navRow}>
        {step > 2 ? (
          <Pressable style={styles.navButton} onPress={goBack}>
            <Text style={styles.navButtonText}>חזור</Text>
          </Pressable>
        ) : (
          <View style={styles.navButtonPlaceholder} />
        )}
        <Pressable style={[styles.navButton, styles.navButtonCancel]} onPress={handleCancel}>
          <Text style={[styles.navButtonText, styles.navButtonCancelText]}>ביטול</Text>
        </Pressable>
      </View>

      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
      {step === 5 && renderStep5()}
      {step === 6 && renderStep6()}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 60,
  },
  stepTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 16,
  },
  sectionLabel: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'right',
    marginBottom: 8,
  },
  hintText: {
    color: '#6b7280',
    fontSize: 13,
    textAlign: 'right',
    marginBottom: 16,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  manualForm: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  inputSmall: {
    width: 90,
    marginBottom: 0,
  },
  segmentCard: {
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  segmentHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  segmentIndex: {
    color: '#6b7280',
    fontSize: 12,
  },
  segmentTime: {
    color: '#6b7280',
    fontSize: 12,
  },
  segmentInput: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    fontSize: 15,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    textAlign: 'right',
  },
  segmentArabic: {
    color: '#e5e7eb',
    fontSize: 15,
    textAlign: 'right',
    marginBottom: 10,
    lineHeight: 22,
  },
  segmentRefHebrew: {
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  wordRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  wordArabic: {
    color: '#9ca3af',
    fontSize: 13,
    width: 80,
    textAlign: 'right',
  },
  wordInput: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    fontSize: 13,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 0,
  },
  primaryButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 12,
  },
  primaryButtonDisabled: {
    backgroundColor: '#14532d',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  smallButton: {
    backgroundColor: '#374151',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  deleteText: {
    color: '#ef4444',
    fontSize: 13,
  },
  chipRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  chip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipStart: {
    borderColor: '#eab308',
    backgroundColor: '#422006',
  },
  chipRange: {
    backgroundColor: '#713f12',
    borderColor: '#eab308',
  },
  chipMarked: {
    backgroundColor: '#1e3a5f',
    borderColor: '#3b82f6',
  },
  chipText: {
    color: '#e2e8f0',
    fontSize: 14,
  },
  phraseForm: {
    marginTop: 10,
    gap: 8,
  },
  phraseBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e3a5f',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
  },
  phraseBadgeText: {
    color: '#93c5fd',
    fontSize: 13,
  },
  centeredBox: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  statusText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  successBox: {
    backgroundColor: '#052e16',
    borderWidth: 1,
    borderColor: '#16a34a',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  successText: {
    color: '#86efac',
    fontSize: 15,
    textAlign: 'center',
  },
  conflictCard: {
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  conflictArabic: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'right',
    marginBottom: 10,
  },
  conflictRow: {
    flexDirection: 'row-reverse',
    gap: 12,
    marginBottom: 12,
  },
  conflictSide: {
    flex: 1,
  },
  conflictLabel: {
    color: '#6b7280',
    fontSize: 11,
    textAlign: 'right',
    marginBottom: 2,
  },
  conflictValue: {
    color: '#e5e7eb',
    fontSize: 14,
    textAlign: 'right',
  },
  conflictButtons: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  conflictButton: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  conflictButtonActive: {
    backgroundColor: '#1e3a5f',
    borderColor: '#3b82f6',
  },
  conflictButtonText: {
    color: '#e5e7eb',
    fontSize: 13,
  },
  radioRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#222',
  },
  radioRowSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#0f172a',
  },
  radioText: {
    color: '#e5e7eb',
    fontSize: 14,
  },
  radioCheck: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '700',
  },
  tagInputRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  tagChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#1e3a5f',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  tagChipText: {
    color: '#93c5fd',
    fontSize: 13,
  },
  difficultyRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  diffButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  diffButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  diffButtonText: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: '600',
  },
  diffButtonTextActive: {
    color: '#fff',
  },
  navRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  navButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#374151',
  },
  navButtonPlaceholder: {
    width: 70,
  },
  navButtonText: {
    color: '#e5e7eb',
    fontSize: 14,
  },
  navButtonCancel: {
    borderColor: '#7f1d1d',
    backgroundColor: '#1a1a1a',
  },
  navButtonCancelText: {
    color: '#f87171',
  },
});
