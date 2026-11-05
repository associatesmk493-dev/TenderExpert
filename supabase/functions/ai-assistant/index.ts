import { createClient } from "npm:@supabase/supabase-js@2.102.0";
import { handleChat } from "./handler.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return respond({ error: "Sign in required" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const keys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  const key = keys ? JSON.parse(keys).default : Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) return respond({ error: "Supabase configuration missing" }, 500);

  // User-scoped client: every query below runs under the caller's JWT, so RLS applies. No service role.
  const db = createClient(url, key, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) return respond({ error: "Your session has expired. Please sign in again.", code: "AUTH_EXPIRED" }, 401);

  let body: unknown;
  try { body = await request.json(); } catch { return respond({ error: "Invalid JSON body" }, 400); }

  const result = await handleChat({ db, userId: data.user.id, env: (k) => Deno.env.get(k) }, body);
  return respond(result.body, result.status);
});
