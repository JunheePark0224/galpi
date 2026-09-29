-- PRD D-01~D-06. Only our own data: ISBN, our tags, our one-liners, saves, events.
create table if not exists events (
  id bigint generated always as identity primary key,
  name text not null,
  props jsonb not null default '{}',
  common jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists events_name_time on events (name, created_at);

create table if not exists books (
  isbn text primary key,
  entry text not null check (entry in ('leaf', 'target')),
  slot text not null,
  field text,
  topic text,
  genre text not null,
  pages int not null,
  way text check (way in ('개념', '실습', '사례')),
  axes jsonb,
  keywords text[] not null default '{}',
  one_liner text not null,
  one_liner_style text not null check (one_liner_style in ('summary', 'question'))
);

create table if not exists saves (
  user_id uuid not null,
  isbn text not null references books(isbn),
  art jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, isbn)          -- one bookmark per book
);

alter table events enable row level security;   -- written only by the server (service role)
alter table books enable row level security;
alter table saves enable row level security;    -- P5 adds per-user policies
