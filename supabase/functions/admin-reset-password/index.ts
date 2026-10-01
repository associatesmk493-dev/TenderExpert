import { createClient } from "npm:@supabase/supabase-js@2.102.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return respond({ error: "Sign in required" }, 401);

  const projectUrl = Deno.env.get("SUPABASE_URL");
  const publishableKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  const publishableKey = publishableKeys
    ? JSON.parse(publishableKeys).default
    : Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!projectUrl || !publishableKey || !serviceRoleKey) {
    return respond({ error: "Supabase configuration missing" }, 500);
  }

  // Confirm the caller holds a valid session. TenderExpert currently treats
  // every signed-in account as an owner/admin (see AuthContext), so this
  // mirrors the same access model as the rest of the CRM.
  const callerClient = createClient(projectUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await callerClient.auth.getUser();
  if (authError || !auth.user) return respond({ error: "Invalid or expired session" }, 401);

  let body: { user_id?: string; new_password?: string };
  try {
    body = await request.json();
  } catch {
    return respond({ error: "Invalid request body" }, 400);
  }

  const { user_id, new_password } = body;
  if (!user_id || typeof user_id !== "string") return respond({ error: "user_id is required" }, 400);
  if (!new_password || new_password.length < 6) {
    return respond({ error: "Password must be at least 6 characters" }, 400);
  }

  const adminClient = createClient(projectUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await adminClient.auth.admin.updateUserById(user_id, { password: new_password });
  if (error) return respond({ error: error.message }, 400);

  return respond({ success: true, email: data.user?.email ?? null });
});
