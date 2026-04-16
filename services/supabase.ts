// Supabase client — single shared instance used by all services.
//
// Environment variable naming: Expo requires the EXPO_PUBLIC_ prefix to bundle
// variables into the client. The canonical names from ARCHITECTURE.md
// (SUPABASE_URL, SUPABASE_ANON_KEY) are used as the suffix.

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
      'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Edge Function invocation helper ─────────────────────────────────────────
//
// supabase.functions.invoke() uses the Supabase anon key as the Bearer token.
// New-style Supabase publishable keys (sb_publishable_*) use ES256, which
// Supabase's Edge Functions routing layer rejects with 401 UNSUPPORTED_TOKEN_ALGORITHM.
//
// This helper calls Edge Functions via raw fetch so we control the headers.
// Functions must be deployed with --no-verify-jwt so the routing layer does
// not attempt to parse/verify the token.
//
// Signature matches supabase.functions.invoke: returns { data, error }.

export async function invokeFn(
  functionName: string,
  body: Record<string, unknown> | FormData,
): Promise<{ data: unknown; error: Error | null }> {
  const url = `${supabaseUrl}/functions/v1/${functionName}`;

  // Prefer the user's session JWT; fall back to the anon key.
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token ?? supabaseAnonKey;

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        // apikey is required by Supabase's edge network even with --no-verify-jwt.
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
        // Only set Content-Type for JSON; let the browser set it for FormData.
        ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
      },
      body: isFormData ? (body as FormData) : JSON.stringify(body),
    });

    const text = await res.text();

    if (!res.ok) {
      return { data: null, error: new Error(`${functionName} HTTP ${res.status}: ${text}`) };
    }

    let data: unknown = text;
    try {
      data = JSON.parse(text);
    } catch {
      // Non-JSON response — return raw text.
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}
