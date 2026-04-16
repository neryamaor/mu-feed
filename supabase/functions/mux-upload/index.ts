// Supabase Edge Function — Mux upload integration.
//
// Two actions, both via POST with JSON body:
//
//   { action: "create" }
//     → Creates a Mux Direct Upload URL.
//     → Returns { uploadUrl: string, uploadId: string }
//
//   { action: "poll", uploadId: string }
//     → Polls Mux for the playback ID once the upload is processed.
//     → Returns { playbackId: string | null }
//       playbackId is null when the asset is not ready yet — caller retries.
//
// Secrets required (set via `supabase secrets set`):
//   MUX_TOKEN_ID
//   MUX_TOKEN_SECRET

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const MUX_BASE = 'https://api.mux.com';

function muxAuthHeader(): string {
  const tokenId = Deno.env.get('MUX_TOKEN_ID') ?? '';
  const tokenSecret = Deno.env.get('MUX_TOKEN_SECRET') ?? '';
  return `Basic ${btoa(`${tokenId}:${tokenSecret}`)}`;
}

async function createUpload(): Promise<{ uploadUrl: string; uploadId: string }> {
  const res = await fetch(`${MUX_BASE}/video/v1/uploads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: muxAuthHeader(),
    },
    body: JSON.stringify({
      new_asset_settings: { playback_policy: ['public'] },
      cors_origin: '*',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mux create upload failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  return {
    uploadUrl: json.data.url as string,
    uploadId: json.data.id as string,
  };
}

async function pollPlaybackId(uploadId: string): Promise<string | null> {
  // Step 1 — retrieve upload to get asset_id
  const uploadRes = await fetch(`${MUX_BASE}/video/v1/uploads/${uploadId}`, {
    headers: { Authorization: muxAuthHeader() },
  });

  if (!uploadRes.ok) {
    throw new Error(`Mux poll upload failed: ${uploadRes.status}`);
  }

  const uploadJson = await uploadRes.json();
  const assetId = uploadJson.data?.asset_id as string | undefined;
  if (!assetId) return null; // asset not created yet

  // Step 2 — retrieve asset to get playback_ids
  const assetRes = await fetch(`${MUX_BASE}/video/v1/assets/${assetId}`, {
    headers: { Authorization: muxAuthHeader() },
  });

  if (!assetRes.ok) {
    throw new Error(`Mux poll asset failed: ${assetRes.status}`);
  }

  const assetJson = await assetRes.json();
  const playbackId = assetJson.data?.playback_ids?.[0]?.id as string | undefined;
  return playbackId ?? null;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const body = await req.json();

    if (body.action === 'create') {
      const result = await createUpload();
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (body.action === 'poll') {
      const { uploadId } = body as { uploadId: string };
      if (!uploadId) {
        return new Response(JSON.stringify({ error: 'uploadId required' }), { status: 400 });
      }
      const playbackId = await pollPlaybackId(uploadId);
      return new Response(JSON.stringify({ playbackId }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'unknown action' }), { status: 400 });
  } catch (err) {
    console.error('[mux-upload]', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
