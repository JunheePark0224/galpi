-- 도감 v1 (PRD F-21, plans/2026-10-05-collection-dex.md): which picture parts each logged-in person has met on S-05.
-- Run this in the Supabase SQL Editor once, after 0003. Then run supabase/checks/collection_rls.sql (every line "ok").
--
-- Access: people READ their own rows with their session (RLS, like saves). Nobody but the server WRITES: the route
-- /api/collection/found checks the draw's signed seed, works the picture out again and inserts with the service role —
-- so a part cannot be faked in with the anon key ("전설을 꾸며 넣지 못하게"). No names, no free text here.

begin;

create table if not exists public.collection (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('animal', 'bg', 'sky', 'ground')),
  value text not null check (value ~ '^[a-zA-Z]{1,24}$'),   -- our part names (lib/art/combine.ts), checked again by the server
  first_met_at timestamptz not null default now(),
  first_art jsonb not null,                                 -- the whole picture it was first met in (D-05 shape)
  is_new boolean not null default true,                     -- NEW in the 도감 until the person has seen it once
  primary key (user_id, kind, value),
  constraint collection_art_size check (pg_column_size(first_art) < 2000)
);

alter table public.collection enable row level security;

-- Logged-in people: select their own rows only. No insert / update / delete grant — the service role (server) writes.
revoke all on public.collection from anon, authenticated;
grant select on public.collection to authenticated;

drop policy if exists collection_own_select on public.collection;
create policy collection_own_select on public.collection for select to authenticated using (user_id = (select auth.uid()));

commit;
