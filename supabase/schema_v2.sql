-- Speech Therapy V2: profiles, survey answers, word flags and version log.
-- Not yet applied. Run in the Family Supabase project (twvqvutrcobedvuhnzxq), same model as schema.sql
-- (signed-in family users only). The app works offline without these and syncs once they exist.

create table if not exists public.speech_v2_profiles (
  id uuid primary key,
  name text not null,
  notes text not null default '',
  locked boolean not null default false,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.speech_v2_survey_answers (
  profile_id uuid not null references public.speech_v2_profiles(id) on delete cascade,
  survey_id text not null,
  item_key text not null,
  tricky int not null check (tricky in (0, 1)),
  updated_at timestamptz not null default now(),
  primary key (profile_id, survey_id, item_key)
);

create table if not exists public.speech_v2_word_flags (
  profile_id uuid not null references public.speech_v2_profiles(id) on delete cascade,
  word text not null,
  level int not null check (level in (0, 1, 2)),   -- 0 easy, 1 tricky, 2 really tricky
  updated_at timestamptz not null default now(),
  primary key (profile_id, word)
);

create table if not exists public.speech_v2_versions (
  id uuid primary key,
  profile_id uuid not null references public.speech_v2_profiles(id) on delete cascade,
  kind text not null check (kind in ('lock', 'unlock', 'snapshot')),
  label text not null,
  note text not null default '',
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['speech_v2_profiles', 'speech_v2_survey_answers', 'speech_v2_word_flags', 'speech_v2_versions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "signed_in_all" on public.%I', t);
    execute format('create policy "signed_in_all" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

insert into public.app_table_registry (app, object_name, object_type, access, description, repo)
values
  ('speech', 'speech_v2_profiles', 'table', 'owner', 'V2 people profiles: name, notes, lock-in state', 'ShimmyAI'),
  ('speech', 'speech_v2_survey_answers', 'table', 'owner', 'V2 survey answers (easy/tricky) per person', 'ShimmyAI'),
  ('speech', 'speech_v2_word_flags', 'table', 'owner', 'V2 flashcard flags (easy/tricky/really tricky) per person', 'ShimmyAI'),
  ('speech', 'speech_v2_versions', 'table', 'owner', 'V2 version log: heat-map snapshots at lock-in', 'ShimmyAI')
on conflict (app, object_name) do nothing;
