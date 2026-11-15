alter table public.player_profiles
  add column if not exists latest_analysis jsonb,
  add column if not exists latest_analysis_at timestamptz;
