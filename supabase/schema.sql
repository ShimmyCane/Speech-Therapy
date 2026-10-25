-- Speech Therapy (Felix) — schema for the Family Supabase project
-- Project: twvqvutrcobedvuhnzxq
-- Every table is prefixed speech_ and registered in app_table_registry in the same file.
-- Storage bucket: speech-therapy (private). Paths: clips/, pictures/, docs/

-- 1. Major topics (the five future topic frameworks plus the current English and Mandarin tracks)
create table if not exists public.speech_topics (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  status text not null default 'planned' check (status in ('planned', 'active', 'retired')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 2. Lessons. Drafts are only visible to grown-ups. Felix sees published lessons only.
create table if not exists public.speech_lessons (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references public.speech_topics(id) on delete set null,
  track text not null check (track in ('en', 'zh')),
  lesson_no int not null check (lesson_no between 1 and 99),
  variant text not null default 'A',
  title text not null,
  focus text,
  mouth_text text,
  draft_words text[] not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'needs_recording', 'published', 'retired')),
  created_by text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (track, lesson_no, variant)
);

-- 3. Reusable parts. A lesson is built by picking elements in order.
create table if not exists public.speech_elements (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references public.speech_topics(id) on delete set null,
  kind text not null check (kind in ('warmup', 'mouth_card', 'listen', 'minimal_pair', 'say_it', 'sentence', 'game')),
  title text not null,
  body jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'approved', 'retired')),
  created_at timestamptz not null default now()
);

-- 4. Which elements a lesson uses, and in what order.
create table if not exists public.speech_lesson_elements (
  lesson_id uuid not null references public.speech_lessons(id) on delete cascade,
  element_id uuid not null references public.speech_elements(id) on delete cascade,
  position int not null,
  primary key (lesson_id, element_id)
);

-- 5. Words and sentences, each with a grown-up recording.
create table if not exists public.speech_words (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.speech_lessons(id) on delete cascade,
  text text not null,
  kind text not null default 'word' check (kind in ('word', 'sentence')),
  pinyin_or_ipa text,
  picture_path text,
  clip_path text,
  speaker text,
  recording_status text not null default 'missing'
    check (recording_status in ('missing', 'recorded', 'approved')),
  created_at timestamptz not null default now()
);

-- 6. Grown-up review log (approve, or ask for changes).
create table if not exists public.speech_reviews (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.speech_lessons(id) on delete cascade,
  reviewer text not null,
  decision text not null check (decision in ('approve', 'revise', 'comment')),
  notes text,
  created_at timestamptz not null default now()
);

-- 7. Felix's lesson sessions (scores only; no audio stored).
create table if not exists public.speech_sessions (
  id uuid primary key default gen_random_uuid(),
  member_name text not null default 'Felix',
  lesson_id uuid references public.speech_lessons(id) on delete set null,
  stars int not null default 0 check (stars between 0 and 3),
  duration_s int,
  created_at timestamptz not null default now()
);

-- 8. One row per try inside a session.
create table if not exists public.speech_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.speech_sessions(id) on delete cascade,
  word_id uuid references public.speech_words(id) on delete set null,
  stars int not null check (stars between 0 and 3),
  similarity numeric(4, 3),
  created_at timestamptz not null default now()
);

-- Row level security: signed-in family users only (same model as the other apps).
alter table public.speech_topics enable row level security;
alter table public.speech_lessons enable row level security;
alter table public.speech_elements enable row level security;
alter table public.speech_lesson_elements enable row level security;
alter table public.speech_words enable row level security;
alter table public.speech_reviews enable row level security;
alter table public.speech_sessions enable row level security;
alter table public.speech_attempts enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'speech_topics', 'speech_lessons', 'speech_elements', 'speech_lesson_elements',
    'speech_words', 'speech_reviews', 'speech_sessions', 'speech_attempts'
  ] loop
    execute format('drop policy if exists "signed_in_all" on public.%I', t);
    execute format(
      'create policy "signed_in_all" on public.%I for all to authenticated using (true) with check (true)',
      t);
  end loop;
end $$;

-- Storage: private bucket for model clips, pictures and working documents.
insert into storage.buckets (id, name, public)
values ('speech-therapy', 'speech-therapy', false)
on conflict (id) do nothing;

drop policy if exists "speech_storage_read" on storage.objects;
drop policy if exists "speech_storage_write" on storage.objects;
drop policy if exists "speech_storage_update" on storage.objects;

create policy "speech_storage_read" on storage.objects
  for select to authenticated using (bucket_id = 'speech-therapy');
create policy "speech_storage_write" on storage.objects
  for insert to authenticated with check (bucket_id = 'speech-therapy');
create policy "speech_storage_update" on storage.objects
  for update to authenticated using (bucket_id = 'speech-therapy');

-- Registry: announce every new table and the bucket's tables to this repository.
insert into public.app_table_registry (app, object_name, object_type, access, description, repo)
values
  ('speech', 'speech_topics', 'table', 'owner', 'Major lesson topics (five future frameworks + current tracks)', 'ShimmyAI'),
  ('speech', 'speech_lessons', 'table', 'owner', 'Lessons per track (en/zh), draft to published lifecycle', 'ShimmyAI'),
  ('speech', 'speech_elements', 'table', 'owner', 'Reusable lesson parts (warm-ups, listen, pairs, sentences)', 'ShimmyAI'),
  ('speech', 'speech_lesson_elements', 'table', 'owner', 'Which elements a lesson uses, in order', 'ShimmyAI'),
  ('speech', 'speech_words', 'table', 'owner', 'Words and sentences with grown-up recordings (storage paths)', 'ShimmyAI'),
  ('speech', 'speech_reviews', 'table', 'owner', 'Grown-up review log for lesson drafts', 'ShimmyAI'),
  ('speech', 'speech_sessions', 'table', 'owner', 'Felix lesson sessions (scores only)', 'ShimmyAI'),
  ('speech', 'speech_attempts', 'table', 'owner', 'Felix tries within a session (stars, similarity, no audio)', 'ShimmyAI')
on conflict (app, object_name) do nothing;

-- Seed: five future topic frameworks (planned) and the two current tracks (active).
insert into public.speech_topics (code, title, description, status, sort_order) values
  ('en-core',     'English core sounds',      'Current English track: S sounds first, then the rest of the core sounds.', 'active', 1),
  ('zh-core',     'Mandarin core sounds',     'Current Mandarin track: S, SH, Z/C/S, tones and finals.', 'active', 2),
  ('sentences',   'Sentences and rhythm',     'Stress, intonation and linking words in short phrases.', 'planned', 3),
  ('vowels',      'Vowels and diphthongs',    'English vowel pairs and gliding sounds (ai, oi, ou).', 'planned', 4),
  ('endings',     'Word endings and clusters','Final consonants and tricky clusters (-sts, -nds, -lp).', 'planned', 5),
  ('tones',       'Mandarin tones in words',  'Tone changes in two-syllable words and phrases.', 'planned', 6),
  ('everyday',    'Everyday talk',            'Greetings, questions and short conversations for school and home.', 'planned', 7)
on conflict (code) do nothing;

-- Seed: 30 draft lessons (15 per track). Word lists are drafts for grown-up review.
insert into public.speech_lessons (track, lesson_no, variant, title, focus, draft_words, topic_id, status)
select v.track, v.lesson_no, 'A', v.title, v.focus, v.words,
       (select id from public.speech_topics where code = v.topic), 'draft'
from (values
  ('en', 1,  'Warm-up: lips, breath, humming', 'warm-up',       array['hum','buzz','pop'],               'en-core'),
  ('en', 2,  'S alone',                        's at the start', array['sun','sock','sit'],            'en-core'),
  ('en', 3,  'S words',                        's at the start', array['soup','six','sad'],            'en-core'),
  ('en', 4,  'S at the end',                   'final -s',       array['cats','bags','bus'],          'en-core'),
  ('en', 5,  'S blends',                       'sp, st, sk',     array['spoon','stop','sky'],         'en-core'),
  ('en', 6,  'S or SH',                        's vs sh',        array['see','she','sip','ship'],     'en-core'),
  ('en', 7,  'S or TH',                        's vs th',        array['sink','think'],               'en-core'),
  ('en', 8,  'TH sound',                       'th',             array['think','thumb','three'],      'en-core'),
  ('en', 9,  'Z sound',                        'z (buzzy s)',    array['zoo','buzz','is'],            'en-core'),
  ('en', 10, 'R or L',                         'r vs l',         array['red','led','rain','lain'],    'en-core'),
  ('en', 11, 'V or F',                         'v vs f',         array['very','fairy','van','fan'],   'en-core'),
  ('en', 12, 'Short vowels',                   'a vs e',         array['bat','bet','cat','pet'],      'en-core'),
  ('en', 13, 'Ship or sheep',                  'short vs long i', array['ship','sheep','bit','beat'], 'en-core'),
  ('en', 14, 'Ends of words',                  'final t, d, g',  array['cap','bed','dog'],            'en-core'),
  ('en', 15, 'Silly sentences',                's words together', array['Sam sees six snakes.'],     'sentences'),
  ('zh', 1,  'Warm-up: mouth and breath',      'warm-up',        array['啊','哦','嗯'],                  'zh-core'),
  ('zh', 2,  'Easy starts',                    'b p m',          array['爸爸','妈妈','包'],              'zh-core'),
  ('zh', 3,  'S sound',                        's',              array['四','丝','思'],                  'zh-core'),
  ('zh', 4,  'SH sound',                       'sh',             array['十','书','诗'],                  'zh-core'),
  ('zh', 5,  'S or SH',                        's vs sh',        array['四','十','思','诗'],             'zh-core'),
  ('zh', 6,  'Z, C, S',                        'z c s',          array['资','词','四'],                  'zh-core'),
  ('zh', 7,  'ZH, CH, R',                      'curled tongue',  array['吃','日','知'],                  'zh-core'),
  ('zh', 8,  'J, Q, X',                        'j q x',          array['七','鸡','西'],                  'zh-core'),
  ('zh', 9,  'S or X',                         's vs x',         array['思','西','四','戏'],             'zh-core'),
  ('zh', 10, 'Ü sound',                        'ü vs i',         array['鱼','雨','衣'],                  'zh-core'),
  ('zh', 11, 'N or NG',                        '-n vs -ng',      array['人','英','很','横'],             'zh-core'),
  ('zh', 12, 'Tones 1 and 2',                  'high flat, rising', array['妈','麻'],                    'tones'),
  ('zh', 13, 'Tones 3 and 4',                  'dip, falling',   array['马','骂'],                       'tones'),
  ('zh', 14, 'Neutral tone',                   'soft ending',    array['吗','的','妈妈'],                 'tones'),
  ('zh', 15, 'Silly sentence',                 'S sounds together', array['我四岁。'],                     'sentences')
) as v(track, lesson_no, title, focus, words, topic)
on conflict (track, lesson_no, variant) do nothing;
