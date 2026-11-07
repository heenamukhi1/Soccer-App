create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  email text,
  message text not null,
  created_at timestamptz not null default now(),
  constraint app_feedback_message_not_blank check (char_length(btrim(message)) > 0)
);

alter table public.app_feedback enable row level security;

create policy "Anyone can submit feedback"
  on public.app_feedback for insert
  to anon, authenticated
  with check (char_length(btrim(message)) > 0);
