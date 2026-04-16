// Supabase Edge Function — Whisper transcription.
//
// Accepts multipart/form-data with a `file` field (video or audio).
// Forwards the file to OpenAI Whisper and returns an array of segments.
//
// Request:  POST multipart/form-data  { file: <video blob> }
// Response: { segments: Array<{ start: number, end: number, text: string }> }
//
// Word-level timestamps from Whisper are discarded — only segment-level
// timing is returned (ARCHITECTURE.md §5.2).
//
// Secret required: WHISPER_API_KEY

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const apiKey = Deno.env.get('WHISPER_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'WHISPER_API_KEY not set' }), { status: 500 });
  }

  try {
    // The client sends multipart/form-data with a `file` field.
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return new Response(JSON.stringify({ error: 'file field required' }), { status: 400 });
    }

    // Build the multipart request for OpenAI Whisper.
    const whisperForm = new FormData();
    whisperForm.append('file', file, 'video.mp4');
    whisperForm.append('model', 'whisper-1');
    whisperForm.append('language', 'ar');
    whisperForm.append('response_format', 'verbose_json');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: whisperForm,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Whisper API error: ${res.status} ${text}`);
    }

    const json = await res.json();

    // Map to our simplified segment shape — discard word-level timestamps.
    const segments = (json.segments ?? []).map((s: {
      start: number;
      end: number;
      text: string;
    }) => ({
      start: s.start,
      end: s.end,
      text: s.text.trim(),
    }));

    return new Response(JSON.stringify({ segments }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[whisper-transcribe]', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
