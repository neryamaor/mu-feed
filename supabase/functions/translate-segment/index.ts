// Supabase Edge Function — Translation + transliteration via Claude or OpenAI.
//
// Request:  POST application/json  { arabicText: string }
// Response: {
//   translation: string,       // full-segment Hebrew translation
//   transliteration: string,   // full-segment Hebrew-letter transliteration
//   words: Array<{
//     arabic: string,
//     hebrew: string,
//     transliteration: string
//   }>
// }
//
// Provider is selected via TRANSLATION_API_PROVIDER env var:
//   "claude"  → Anthropic Claude (default)
//   "openai"  → OpenAI GPT-4o
//
// Secrets required:
//   TRANSLATION_API_KEY
//   TRANSLATION_API_PROVIDER   (optional — defaults to "claude")

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const SYSTEM_PROMPT = `You are a Palestinian Arabic language expert.
Given a segment of spoken Palestinian Arabic, return a JSON object with exactly three fields:
- "translation": natural everyday Hebrew translation of the full segment
- "transliteration": phonetic rendering of the full segment in Hebrew letters, as commonly used by Israeli Arabic learners
- "words": array of objects (one per word in the Arabic text, in order), each with:
    - "arabic": the Arabic word exactly as it appears in the text
    - "hebrew": natural Hebrew translation of this word in context
    - "transliteration": phonetic Hebrew-letter rendering of this word

Return only valid JSON. No explanation, no markdown, no code fences.`;

async function callClaude(arabicText: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: arabicText }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API error: ${res.status} ${text}`);
  }

  const json = await res.json();
  return json.content?.[0]?.text ?? '';
}

async function callOpenAI(arabicText: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 1024,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: arabicText },
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
    return new Response(JSON.stringify({ error: 'TRANSLATION_API_KEY not set' }), { status: 500 });
  }

  const provider = (Deno.env.get('TRANSLATION_API_PROVIDER') ?? 'claude').toLowerCase();

  try {
    const { arabicText } = await req.json() as { arabicText: string };
    if (!arabicText?.trim()) {
      return new Response(JSON.stringify({ error: 'arabicText required' }), { status: 400 });
    }

    const rawText =
      provider === 'openai'
        ? await callOpenAI(arabicText.trim(), apiKey)
        : await callClaude(arabicText.trim(), apiKey);

    // Strip markdown code fences if the model wraps the JSON anyway.
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('[translate-segment] JSON parse failed:', cleaned);
      return new Response(JSON.stringify({ error: 'parse_failed', raw: cleaned }), { status: 422 });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[translate-segment]', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
