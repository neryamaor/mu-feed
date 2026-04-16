// Whisper transcription service.
//
// Sends the admin's video file to the `whisper-transcribe` Supabase Edge
// Function, which forwards it to OpenAI Whisper and returns segment data.
//
// Only segment-level timing is returned — word-level timestamps from Whisper
// are discarded by the Edge Function (ARCHITECTURE.md §5.2).

import { invokeFn } from './supabase';
import type { WhisperSegment } from '../types';

/**
 * Transcribes a video file via Whisper.
 *
 * @param fileUri  Local file URI from expo-document-picker (e.g. file:///…).
 * @returns        Segments ordered by start time. Returns [] on error.
 */
export async function transcribeVideo(fileUri: string): Promise<WhisperSegment[]> {
  try {
    const formData = new FormData();
    // React Native: FormData accepts an object with uri/type/name for file fields.
    formData.append('file', {
      uri: fileUri,
      type: 'video/mp4',
      name: 'video.mp4',
    } as unknown as Blob);

    const { data, error } = await invokeFn('whisper-transcribe', formData);

    if (error) {
      console.error('[whisper] transcribeVideo failed:', error.message);
      return [];
    }

    const segments = (data as { segments?: WhisperSegment[] }).segments ?? [];
    return segments.sort((a, b) => a.start - b.start);
  } catch (err) {
    console.error('[whisper] transcribeVideo error:', err);
    return [];
  }
}
