# AI assistant – deployment handoff

Edge Function `ai-assistant` (OpenAI Responses API + function calling) replaces the rule-based chatbot.
The old `tenderexpert-ai` function is no longer called by the UI and can be removed later.

## 1. Apply the migration
`supabase/migrations/20261105100000_ai_assistant.sql` (creates `ai_conversations`, `ai_messages`,
`ai_action_log`, `ai_usage_log`, owner-only RLS). Run it in the SQL editor or `supabase db push`.

## 2. Set secrets (never commit them, never paste them in chat)
```bash
supabase secrets set OPENAI_API_KEY=<your key> OPENAI_MODEL=gpt-4.1
```
Optional tuning (defaults in brackets): `AI_MAX_TOOL_ROUNDS` [6], `AI_MAX_TOOL_CALLS` [12], `AI_TOOL_TIMEOUT_MS` [15000],
`AI_REQUEST_TIMEOUT_MS` [60000], `AI_MAX_RESULT_CHARS` [12000], `AI_RATE_LIMIT_PER_HOUR` [40], `AI_RATE_LIMIT_PER_DAY` [250],
`AI_HISTORY_MESSAGES` [12], `AI_MAX_OUTPUT_TOKENS` [1800].

## 3. Deploy
```bash
supabase functions deploy ai-assistant
```
`verify_jwt = true` is set in `supabase/config.toml`. Then deploy the frontend as usual.

## 4. Discount policy (decision needed)
The repository defines no discount rules, so by default **every discount** needs the user's Confirm click.
To allow automatic drafts up to N %, set (as an admin):
```sql
insert into integration_settings(provider, enabled, config)
values ('openai', true, '{"max_auto_discount_pct": 5}')
on conflict (provider) do update set config = integration_settings.config || excluded.config;
```

## Notes
- Tenancy: the CRM is single-tenant (all signed-in users share data via `team_*` RLS). The function uses only the caller's JWT
  (no service role), so any stricter RLS you add later applies to the assistant automatically.
- Proposal `subtotal` is saved as the taxable value *after* discount (discount stored in `discount_amount`); GST default 18%.
- "Send" is not possible: `mark_proposal_sent` only sets status in the CRM (after confirmation) and does not email the client.
- Stage changes, closing, reassigning leads are intentionally unsupported by the assistant.
- Chat content is stored in `ai_messages` (owner-only). Logs contain no message text.
