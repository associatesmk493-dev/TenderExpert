-- AI assistant: conversations, messages, action log (audit + idempotency + confirmations).
-- Additive and idempotent. Rows are private to their owner; the edge function uses the
-- caller's JWT (no service role), so these policies are what protects them.

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null default 'New chat',
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_conversations_user_updated_idx on public.ai_conversations(user_id, updated_at desc);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  role text not null check (role in ('user','assistant')),
  content text not null,
  request_id text,                       -- client-generated id; makes a retried request replayable
  tool_events jsonb not null default '[]'::jsonb, -- [{tool,status,summary,link,action_id}]
  model text,
  usage jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ai_messages_conv_created_idx on public.ai_messages(conversation_id, created_at);
create unique index if not exists ai_messages_request_role_key
  on public.ai_messages(conversation_id, request_id, role) where request_id is not null;

create table if not exists public.ai_action_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  tool text not null,
  arguments jsonb not null default '{}'::jsonb,
  arguments_hash text not null,
  idempotency_key text not null,
  status text not null check (status in ('started','succeeded','failed','pending_confirmation','confirmed','cancelled','expired')),
  requires_confirmation boolean not null default false,
  confirmation_reason text,
  result jsonb,
  error text,
  target_table text,
  target_id uuid,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index if not exists ai_action_log_user_created_idx on public.ai_action_log(user_id, created_at desc);
create index if not exists ai_action_log_conv_idx on public.ai_action_log(conversation_id);

-- One row per model request: drives the per-user rate limit and cost visibility (no content stored).
create table if not exists public.ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  model text,
  input_tokens integer,
  output_tokens integer,
  tool_rounds smallint,
  outcome text
);
create index if not exists ai_usage_log_user_created_idx on public.ai_usage_log(user_id, created_at desc);

drop trigger if exists ai_conversations_updated_at on public.ai_conversations;
create trigger ai_conversations_updated_at before update on public.ai_conversations
  for each row execute function public.set_updated_at();
drop trigger if exists ai_action_log_updated_at on public.ai_action_log;
create trigger ai_action_log_updated_at before update on public.ai_action_log
  for each row execute function public.set_updated_at();

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_action_log enable row level security;
alter table public.ai_usage_log enable row level security;

do $$ declare t text; begin
  foreach t in array array['ai_conversations','ai_messages','ai_action_log','ai_usage_log'] loop
    execute format('drop policy if exists "owner_select_%1$s" on public.%1$I', t);
    execute format('create policy "owner_select_%1$s" on public.%1$I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('drop policy if exists "owner_insert_%1$s" on public.%1$I', t);
    execute format('create policy "owner_insert_%1$s" on public.%1$I for insert to authenticated with check (user_id = (select auth.uid()))', t);
  end loop;
  foreach t in array array['ai_conversations','ai_action_log'] loop
    execute format('drop policy if exists "owner_update_%1$s" on public.%1$I', t);
    execute format('create policy "owner_update_%1$s" on public.%1$I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

drop policy if exists "owner_delete_ai_conversations" on public.ai_conversations;
create policy "owner_delete_ai_conversations" on public.ai_conversations
  for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.ai_conversations to authenticated;
grant select, insert on public.ai_messages to authenticated;
grant select, insert, update on public.ai_action_log to authenticated;
grant select, insert on public.ai_usage_log to authenticated;
