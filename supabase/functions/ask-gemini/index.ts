/**
 * Supabase Edge Function — ask-gemini
 * File path in your repo: supabase/functions/ask-gemini/index.ts
 *
 * DEPLOY:
 *   supabase functions deploy ask-gemini
 *
 * SET THE SECRET (Gemini key NEVER goes to the client):
 *   supabase secrets set GEMINI_API_KEY=AIzaSy...
 *   OR: Supabase Dashboard → Edge Functions → Secrets
 *
 * The frontend calls this via supabase.functions.invoke("ask-gemini")
 * and the Gemini API key stays entirely on Supabase's servers.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_KEY  = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_URL  = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing prompt" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 600,
          temperature: 0.7,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = (err as any)?.error?.message || `Gemini HTTP ${res.status}`;
      throw new Error(msg);
    }

    const data = await res.json();
    const text =
      (data as any)?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response from Gemini.";

    return new Response(
      JSON.stringify({ text }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
