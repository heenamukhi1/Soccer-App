create table if not exists public.player_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  position text not null,
  preferred_foot text not null,
  age smallint not null check (age between 5 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.player_profiles enable row level security;

create policy "Users can view their own player profile"
  on public.player_profiles for select
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own player profile"
  on public.player_profiles for insert
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own player profile"
  on public.player_profiles for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.set_player_profile_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists player_profiles_set_updated_at on public.player_profiles;
create trigger player_profiles_set_updated_at
  before update on public.player_profiles
  for each row execute function public.set_player_profile_updated_at();
