// Supabase Edge Function — AI metadata suggestions for a video transcript.
//
// Request:  POST application/json
//   { transcript: string, categories: string[] }
//
// Response:
//   { title: string, tags: string[], category: string }
//   or on failure:
//   { error: string }
//
// Uses the same TRANSLATION_API_KEY / TRANSLATION_API_PROVIDER secrets as
// the translate-segment function. Provider defaults to "claude".
//
// Secrets required:
//   TRANSLATION_API_KEY
//   TRANSLATION_API_PROVIDER   (optional — defaults to "claude")

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

function buildSystemPrompt(categoryList: string): string {
  return `You are a Palestinian Arabic content assistant. Given a transcript of a short video in Palestinian Arabic, return a JSON object with exactly three fields:
- "title": a short, natural Hebrew title for the video (max 6 words)
- "tags": an array of 3-5 relevant Hebrew tags (single words or short phrases)
- "category": the single most appropriate category from this list: ${categoryList}

Return only valid JSON. No explanation, no markdown, no code fences.`;
}

async function callClaude(
  transcript: string,
  systemPrompt: string,
  apiKey: string,
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 256,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Transcript:\n${transcript}` }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API error: ${res.status} ${text}`);
  }

  const json = await res.json();
  return json.content?.[0]?.text ?? '';
}

async function callOpenAI(
  transcript: string,
  systemPrompt: string,
  apiKey: string,
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 256,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Transcript:\n${transcript}` },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${text}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? '';
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const apiKey = Deno.env.get('TRANSLATION_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'TRANSLATION_API_KEY not set' }), {
      status: 500,
    });
  }

  const provider = (Deno.env.get('TRANSLATION_API_PROVIDER') ?? 'claude').toLowerCase();

  try {
    const { transcript, categories } = (await req.json()) as {
      transcript: string;
      categories: string[];
    };

    if (!transcript?.trim()) {
      return new Response(JSON.stringify({ error: 'transcript required' }), { status: 400 });
    }
    if (!Array.isArray(categories) || categories.length === 0) {
      return new Response(JSON.stringify({ error: 'categories required' }), { status: 400 });
    }

    const categoryList = categories.join(', ');
    const systemPrompt = buildSystemPrompt(categoryList);

    const rawText =
      provider === 'openai'
        ? await callOpenAI(transcript.trim(), systemPrompt, apiKey)
        : await callClaude(transcript.trim(), systemPrompt, apiKey);

    // Strip markdown code fences if the model wraps the JSON anyway.
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('[suggest-metadata] JSON parse failed:', cleaned);
      return new Response(JSON.stringify({ error: 'parse_failed', raw: cleaned }), {
        status: 422,
      });
    }

    const result = parsed as Record<string, unknown>;
    if (
      typeof result.title !== 'string' ||
      !Array.isArray(result.tags) ||
      typeof result.category !== 'string'
    ) {
      console.error('[suggest-metadata] unexpected shape:', result);
      return new Response(JSON.stringify({ error: 'invalid_shape' }), { status: 422 });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[suggest-metadata]', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
