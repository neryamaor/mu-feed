// Admin — Step 1: Video Upload.
//
// The admin enters a title, picks a video file, and uploads it to Mux via
// the mux-upload Edge Function.  On success, a draft video record is saved
// to Supabase and the wizard continues to the review screen.
//
// Protected: only reachable by users with a row in admin_permissions
// (enforced by app/admin/_layout.tsx).

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../hooks/useAuth';
import {
  requestMuxUpload,
  uploadFileToMux,
  pollMuxPlaybackId,
  saveDraftVideo,
} from '../../../services/video';

type Stage = 'idle' | 'uploading' | 'polling' | 'error';

interface PickedFile {
  uri: string;
  name: string;
}

export default function AdminUploadScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [statusText, setStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['video/*'],
      copyToCacheDirectory: true,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    setFile({ uri: asset.uri, name: asset.name });
    setErrorMessage('');
  }

  async function handleUpload() {
    if (!title.trim() || !file || !user) return;

    setStage('uploading');
    setErrorMessage('');

    try {
      // Step A — get Mux direct upload URL
      setStatusText('יוצר קישור העלאה...');
      const { uploadUrl, uploadId } = await requestMuxUpload();

      // Step B — PUT the file directly to Mux
      setStatusText('מעלה קובץ ל-Mux...');
      await uploadFileToMux(uploadUrl, file.uri);

      // Step C — poll until Mux finishes processing
      setStage('polling');
      setStatusText('ממתין לעיבוד הסרטון...');
      const playbackId = await pollMuxPlaybackId(uploadId);

      // Step D — save draft record to Supabase
      setStatusText('שומר בסופאבייס...');
      const videoId = await saveDraftVideo(title.trim(), playbackId, user.id);

      // Navigate to review wizard with the video ID and file URI
      router.push(
        `/admin/review?videoId=${videoId}&fileUri=${encodeURIComponent(file.uri)}`,
      );
    } catch (err) {
      setStage('error');
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }

  const canUpload = title.trim().length > 0 && file !== null && stage === 'idle';
  const isBusy = stage === 'uploading' || stage === 'polling';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.heading}>העלאת סרטון חדש</Text>
      <Text style={styles.subheading}>שלב 1 מתוך 6</Text>

      {/* Title */}
      <Text style={styles.label}>כותרת</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="כותרת הסרטון"
        placeholderTextColor="#6b7280"
        textAlign="right"
        editable={!isBusy}
      />

      {/* File picker */}
      <Text style={styles.label}>קובץ וידאו</Text>
      <Pressable style={styles.pickButton} onPress={pickFile} disabled={isBusy}>
        <Text style={styles.pickButtonText}>
          {file ? `✓ ${file.name}` : 'בחר קובץ...'}
        </Text>
      </Pressable>

      {/* Upload button */}
      <Pressable
        style={[styles.uploadButton, !canUpload && styles.uploadButtonDisabled]}
        onPress={handleUpload}
        disabled={!canUpload}
      >
        <Text style={styles.uploadButtonText}>העלה לMux</Text>
      </Pressable>

      {/* Progress */}
      {isBusy && (
        <View style={styles.progressRow}>
          <ActivityIndicator color="#fff" />
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
      )}

      {/* Error */}
      {stage === 'error' && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Pressable onPress={() => setStage('idle')}>
            <Text style={styles.retryText}>נסה שנית</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
  heading: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 4,
  },
  subheading: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'right',
    marginBottom: 28,
  },
  label: {
    color: '#9ca3af',
    fontSize: 13,
    textAlign: 'right',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 20,
  },
  pickButton: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#374151',
    borderStyle: 'dashed',
  },
  pickButtonText: {
    color: '#9ca3af',
    fontSize: 15,
    textAlign: 'right',
  },
  uploadButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  uploadButtonDisabled: {
    backgroundColor: '#1e3a6e',
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  progressRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  statusText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  errorBox: {
    backgroundColor: '#1c0a0a',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    borderRadius: 8,
    padding: 14,
    marginTop: 8,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
    textAlign: 'right',
    marginBottom: 8,
  },
  retryText: {
    color: '#60a5fa',
    fontSize: 14,
    textAlign: 'right',
  },
});
