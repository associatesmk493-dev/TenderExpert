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

  if (!projectUrl || !publishableKey) return respond({ error: "Supabase configuration missing" }, 500);

  const supabase = createClient(projectUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return respond({ error: "Invalid or expired session" }, 401);

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey || apiKey === "replace_with_your_openai_api_key") {
    return respond({ error: "OPENAI_API_KEY is not configured", code: "AI_KEY_NOT_CONFIGURED" }, 503);
  }

  try {
    const body = await request.json();
    const messages = Array.isArray(body.messages)
      ? body.messages
          .filter((message: { role?: string; content?: string }) =>
            (message.role === "user" || message.role === "assistant") && typeof message.content === "string")
          .slice(-12)
          .map((message: { role: string; content: string }) => ({ role: message.role, content: message.content.slice(0, 4000) }))
      : [];

    if (!messages.length || messages[messages.length - 1]?.role !== "user") {
      return respond({ error: "A user message is required" }, 400);
    }

    const [leads, tasks, payments, tenders, proposals] = await Promise.all([
      supabase.from("b2g_leads").select("organization_name,contact_name,industry,pipeline,stage,heat,ai_score,proposal_value,expected_revenue,probability,next_follow_up_at,next_best_action,service_interest,notes").order("ai_score", { ascending: false }).limit(30),
      supabase.from("b2g_tasks").select("title,task_type,priority,due_at,completed_at,b2g_leads(organization_name)").is("completed_at", null).order("due_at").limit(25),
      supabase.from("b2g_payment_milestones").select("milestone_name,amount,gst_amount,amount_received,due_date,status,b2g_projects(project_name,payment_model,contract_value)").order("due_date").limit(30),
      supabase.from("tender_opportunities").select("tender_title,tender_number,authority_name,estimated_value,submission_deadline,go_no_go,match_score,status,b2g_leads(organization_name)").order("submission_deadline").limit(20),
      supabase.from("b2g_proposals").select("proposal_number,subject,subtotal,gst_amount,status,payment_model,b2g_leads(organization_name)").order("created_at", { ascending: false }).limit(20),
    ]);

    const crmContext = {
      current_time_india: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      leads: leads.data || [], tasks: tasks.data || [], payments: payments.data || [],
      tenders: tenders.data || [], proposals: proposals.data || [],
    };

    const system = `You are TenderExpert AI, the private B2G CRM assistant for MK & Associates / TenderExpert in India.
Help with brand/product approvals, government business development, tender consultancy, vendor registration, BOQ/specifications, technical presentations and government market entry.
Use ONLY the CRM data below when stating client names, figures, stages, payment balances, follow-ups, tender deadlines or proposal statuses. Never invent CRM records.
Balance due is amount + gst_amount - amount_received. Identify hot leads, overdue tasks, outstanding collections, conversion opportunities and next-best actions.
When asked, draft professional proposals, quotations, WhatsApp follow-ups, emails, tender assessments, government-readiness assessments or brand-approval checklists.
Reply in the same language/style as the user (English, Hindi or Hinglish), format amounts in INR, and keep answers practical and concise.
CRM DATA: ${JSON.stringify(crmContext)}`;

    const openai = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini",
        messages: [{ role: "system", content: system }, ...messages],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!openai.ok) {
      const details = await openai.json().catch(() => ({}));
      console.error("TenderExpert AI provider error", openai.status, details?.error?.message);
      return respond({ error: details?.error?.message || "AI provider request failed" }, openai.status);
    }

    const result = await openai.json();
    const answer = result.choices?.[0]?.message?.content;
    if (!answer) return respond({ error: "AI provider returned an empty response" }, 502);
    return respond({ answer, model: result.model, mode: "live" });
  } catch (error) {
    console.error("TenderExpert AI request error", error);
    return respond({ error: "Could not process the AI request" }, 500);
  }
});
