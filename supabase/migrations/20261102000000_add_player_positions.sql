alter table public.player_profiles
  add column if not exists positions text[] not null default '{}';

update public.player_profiles
set positions = (
  select coalesce(array_agg(value), '{}')
  from unnest(regexp_split_to_array(coalesce(position, ''), '\s*,\s*')) as value
  where upper(btrim(value)) = any (array['GK', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'])
)
where positions = '{}';
