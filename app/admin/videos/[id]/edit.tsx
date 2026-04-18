// Admin — Video edit screen.
//
// Single scrollable form — not a wizard. All fields are visible at once.
// Editable: title, difficulty, category, tags, segment arabic_text + timing,
// per-word hebrew_translation + transliteration.
//
// Save rules:
//   - segments.arabic_text / start_time / end_time: updated in-place.
//   - translations rows: updated in-place via context_translation_id — never
//     touches dictionary_entries or any other video's translations.
//   - title / difficulty / category / tags: updated in videos + join tables.
//
// Protected: only reachable by users with a row in admin_permissions
// (enforced by app/admin/_layout.tsx).

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
import {
  fetchVideoForEdit,
  fetchCategoriesAndTags,
  saveVideoEdit,
} from '../../../../services/videoEdit';
import type {
  EditableSegment,
  Category,
  Tag,
  VideoEditSavePayload,
} from '../../../../types';

export default function AdminVideoEditScreen() {
  const { id: videoId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ─── Form state ───────────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [sourceCredit, setSourceCredit] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [newTagNames, setNewTagNames] = useState<string[]>([]);
  const [segments, setSegments] = useState<EditableSegment[]>([]);

  // ─── Reference data ───────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<Category[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);

  // ─── Load on mount ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!videoId) return;

    Promise.all([fetchVideoForEdit(videoId), fetchCategoriesAndTags()])
      .then(([editData, refData]) => {
        setTitle(editData.title);
        setDifficulty(editData.difficultyLevel);
        setCategoryId(editData.categoryId);
        setSourceCredit(editData.sourceCredit ?? '');
        setSelectedTagIds(editData.tagIds);
        setSegments(editData.segments);
        setCategories(refData.categories);
        setAllTags(refData.tags);
        setLoadingData(false);
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : String(err));
        setLoadingData(false);
      });
  }, [videoId]);

  // ─── Tag handlers ──────────────────────────────────────────────────────────────

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  }

  function addNewTag() {
    const name = newTagInput.trim();
    if (!name) return;
    // Skip if already in existing tags or in the pending new tags list
    if (allTags.some((t) => t.name === name) || newTagNames.includes(name)) {
      setNewTagInput('');
      return;
    }
    setNewTagNames((prev) => [...prev, name]);
    setNewTagInput('');
  }

  function removeNewTag(name: string) {
    setNewTagNames((prev) => prev.filter((n) => n !== name));
  }

  // ─── Segment / word update handlers ───────────────────────────────────────────

  function updateSegmentField(
    segIdx: number,
    field: 'arabicText' | 'startTime' | 'endTime',
    value: string,
  ) {
    setSegments((prev) => {
      const updated = [...prev];
      const seg = { ...updated[segIdx] };
      if (field === 'arabicText') {
        seg.arabicText = value;
      } else if (field === 'startTime') {
        seg.startTime = parseFloat(value) || 0;
      } else {
        seg.endTime = parseFloat(value) || 0;
      }
      updated[segIdx] = seg;
      return updated;
    });
  }

  function updateWordField(
    segIdx: number,
    wordIdx: number,
    field: 'hebrew' | 'transliteration',
    value: string,
  ) {
    setSegments((prev) => {
      const updated = [...prev];
      const seg = { ...updated[segIdx] };
      seg.words = seg.words.map((w, i) => (i === wordIdx ? { ...w, [field]: value } : w));
      updated[segIdx] = seg;
      return updated;
    });
  }

  // ─── Save ─────────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert('שגיאה', 'יש להזין כותרת.');
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    const payload: VideoEditSavePayload = {
      title: title.trim(),
      difficultyLevel: difficulty,
      categoryId,
      sourceCredit: sourceCredit.trim() || null,
      existingTagIds: selectedTagIds,
      newTagNames,
      segments: segments.map((seg) => ({
        id: seg.id,
        arabicText: seg.arabicText,
        startTime: seg.startTime,
        endTime: seg.endTime,
        words: seg.words.map((w) => ({
          segmentWordId: w.segmentWordId,
          contextTranslationId: w.contextTranslationId,
          hebrew: w.hebrew,
          transliteration: w.transliteration,
        })),
      })),
    };

    try {
      await saveVideoEdit(videoId!, payload);
      setSaveSuccess(true);
      // Promote newly-created tags into allTags so they appear selected going forward
      if (newTagNames.length > 0) {
        setAllTags((prev) => [
          ...prev,
          ...newTagNames.map((n) => ({ id: `pending-${n}`, name: n })),
        ]);
        setNewTagNames([]);
      }
    } catch (err) {
      Alert.alert('שגיאה בשמירה', err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  // ─── Loading / error states ───────────────────────────────────────────────────

  if (loadingData) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.errorText}>{loadError}</Text>
      </View>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>עריכת סרטון</Text>
        <Pressable style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelText}>ביטול</Text>
        </Pressable>
      </View>

      {/* ── Title ──────────────────────────────────────────────────────────── */}
      <Text style={styles.fieldLabel}>כותרת</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="כותרת הסרטון"
        placeholderTextColor="#6b7280"
        textAlign="right"
      />

      {/* ── Difficulty ────────────────────────────────────────────────────── */}
      <Text style={styles.fieldLabel}>רמת קושי</Text>
      <View style={styles.diffRow}>
        {[1, 2, 3, 4, 5].map((d) => (
          <Pressable
            key={d}
            style={[styles.diffButton, difficulty === d && styles.diffButtonActive]}
            onPress={() => setDifficulty(d)}
          >
            <Text style={[styles.diffText, difficulty === d && styles.diffTextActive]}>
              {d}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── Category ──────────────────────────────────────────────────────── */}
      <Text style={styles.fieldLabel}>קטגוריה</Text>
      {categories.map((cat) => (
        <Pressable
          key={cat.id}
          style={[styles.radioRow, categoryId === cat.id && styles.radioRowSelected]}
          onPress={() => setCategoryId(cat.id)}
        >
          <Text style={styles.radioText}>{cat.name}</Text>
          {categoryId === cat.id && <Text style={styles.radioCheck}>✓</Text>}
        </Pressable>
      ))}

      {/* ── Tags ──────────────────────────────────────────────────────────── */}
      <Text style={[styles.fieldLabel, { marginTop: 20 }]}>תגיות</Text>
      <View style={styles.chipWrap}>
        {allTags.map((tag) => (
          <Pressable
            key={tag.id}
            style={[styles.tagChip, selectedTagIds.includes(tag.id) && styles.tagChipSelected]}
            onPress={() => toggleTag(tag.id)}
          >
            <Text
              style={[
                styles.tagChipText,
                selectedTagIds.includes(tag.id) && styles.tagChipTextSelected,
              ]}
            >
              {tag.name}
            </Text>
          </Pressable>
        ))}
        {newTagNames.map((name) => (
          <View key={name} style={[styles.tagChip, styles.tagChipSelected, styles.tagChipNew]}>
            <Text style={[styles.tagChipText, styles.tagChipTextSelected]}>{name}</Text>
            <Pressable onPress={() => removeNewTag(name)}>
              <Text style={styles.tagChipRemove}> ✕</Text>
            </Pressable>
          </View>
        ))}
      </View>
      <View style={styles.tagInputRow}>
        <TextInput
          style={[styles.input, styles.tagInput]}
          value={newTagInput}
          onChangeText={setNewTagInput}
          placeholder="תגית חדשה"
          placeholderTextColor="#6b7280"
          textAlign="right"
          onSubmitEditing={addNewTag}
          returnKeyType="done"
        />
        <Pressable style={styles.smallButton} onPress={addNewTag}>
          <Text style={styles.smallButtonText}>הוסף</Text>
        </Pressable>
      </View>

      {/* ── Credit / Source ───────────────────────────────────────────────── */}
      <Text style={[styles.fieldLabel, { marginTop: 20 }]}>קרדיט / מקור (אופציונלי)</Text>
      <TextInput
        style={styles.input}
        value={sourceCredit}
        onChangeText={setSourceCredit}
        placeholder="למשל: @username, YouTube, TikTok, תוכן מקורי"
        placeholderTextColor="#6b7280"
        textAlign="right"
      />

      {/* ── Segments ──────────────────────────────────────────────────────── */}
      <Text style={[styles.fieldLabel, { marginTop: 20 }]}>סגמנטים</Text>
      {segments.map((seg, segIdx) => (
        <View key={seg.id} style={styles.segCard}>
          {/* Segment header: index + time range */}
          <View style={styles.segHeader}>
            <Text style={styles.segIndex}>#{segIdx + 1}</Text>
            <View style={styles.segTimeRow}>
              <TextInput
                style={styles.timeInput}
                value={String(seg.startTime)}
                onChangeText={(v) => updateSegmentField(segIdx, 'startTime', v)}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#6b7280"
              />
              <Text style={styles.timeSep}>—</Text>
              <TextInput
                style={styles.timeInput}
                value={String(seg.endTime)}
                onChangeText={(v) => updateSegmentField(segIdx, 'endTime', v)}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#6b7280"
              />
              <Text style={styles.timeUnit}>שנ׳</Text>
            </View>
          </View>

          {/* Arabic text */}
          <TextInput
            style={[styles.input, styles.segArabicInput]}
            value={seg.arabicText}
            onChangeText={(v) => updateSegmentField(segIdx, 'arabicText', v)}
            multiline
            textAlign="right"
            placeholder="טקסט ערבי"
            placeholderTextColor="#6b7280"
          />

          {/* Per-word translation rows */}
          {seg.words.length > 0 && (
            <>
              <View style={styles.wordHeaderRow}>
                <Text style={[styles.wordHeaderCell, { width: 80 }]}>ערבית</Text>
                <Text style={[styles.wordHeaderCell, { flex: 1 }]}>עברית</Text>
                <Text style={[styles.wordHeaderCell, { flex: 1 }]}>תעתיק</Text>
              </View>
              {seg.words.map((word, wIdx) => (
                <View key={word.segmentWordId} style={styles.wordRow}>
                  <Text style={styles.wordArabic}>{word.arabic}</Text>
                  <TextInput
                    style={[
                      styles.wordInput,
                      { flex: 1 },
                      !word.contextTranslationId && styles.wordInputDisabled,
                    ]}
                    value={word.hebrew}
                    onChangeText={(v) => updateWordField(segIdx, wIdx, 'hebrew', v)}
                    placeholder="עברית"
                    placeholderTextColor="#6b7280"
                    textAlign="right"
                    editable={!!word.contextTranslationId}
                  />
                  <TextInput
                    style={[
                      styles.wordInput,
                      { flex: 1 },
                      !word.contextTranslationId && styles.wordInputDisabled,
                    ]}
                    value={word.transliteration}
                    onChangeText={(v) => updateWordField(segIdx, wIdx, 'transliteration', v)}
                    placeholder="תעתיק"
                    placeholderTextColor="#6b7280"
                    textAlign="right"
                    editable={!!word.contextTranslationId}
                  />
                </View>
              ))}
            </>
          )}
        </View>
      ))}

      {/* ── Save feedback ─────────────────────────────────────────────────── */}
      {saveSuccess && (
        <View style={styles.successBox}>
          <Text style={styles.successText}>השינויים נשמרו בהצלחה ✓</Text>
        </View>
      )}

      {/* ── Save button ───────────────────────────────────────────────────── */}
      <Pressable
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>שמור שינויים</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  screenTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  cancelButton: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#374151',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelText: {
    color: '#e5e7eb',
    fontSize: 14,
  },
  fieldLabel: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'right',
    marginBottom: 8,
    marginTop: 4,
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
  diffRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginBottom: 8,
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
  diffText: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: '600',
  },
  diffTextActive: {
    color: '#fff',
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
  chipWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  tagChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#374151',
  },
  tagChipSelected: {
    backgroundColor: '#1e3a5f',
    borderColor: '#3b82f6',
  },
  tagChipNew: {
    backgroundColor: '#052e16',
    borderColor: '#16a34a',
  },
  tagChipText: {
    color: '#9ca3af',
    fontSize: 13,
  },
  tagChipTextSelected: {
    color: '#93c5fd',
  },
  tagChipRemove: {
    color: '#f87171',
    fontSize: 11,
  },
  tagInputRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  tagInput: {
    flex: 1,
    marginBottom: 0,
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
  segCard: {
    backgroundColor: '#111',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  segHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  segIndex: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '700',
  },
  segTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeInput: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    width: 62,
    textAlign: 'center',
  },
  timeSep: {
    color: '#6b7280',
    fontSize: 12,
  },
  timeUnit: {
    color: '#6b7280',
    fontSize: 11,
  },
  segArabicInput: {
    marginBottom: 10,
  },
  wordHeaderRow: {
    flexDirection: 'row-reverse',
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  wordHeaderCell: {
    color: '#6b7280',
    fontSize: 10,
    textAlign: 'right',
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
  },
  wordInputDisabled: {
    opacity: 0.35,
  },
  errorText: {
    color: '#f87171',
    textAlign: 'center',
  },
  successBox: {
    backgroundColor: '#052e16',
    borderWidth: 1,
    borderColor: '#16a34a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  successText: {
    color: '#86efac',
    fontSize: 14,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonDisabled: {
    backgroundColor: '#14532d',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
