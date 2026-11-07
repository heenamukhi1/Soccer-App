create table if not exists public.player_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analysis jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists player_analyses_user_created_idx
  on public.player_analyses (user_id, created_at desc);

alter table public.player_analyses enable row level security;

create policy "Users can view their own analyses"
  on public.player_analyses for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own analyses"
  on public.player_analyses for insert
  with check ((select auth.uid()) = user_id);
