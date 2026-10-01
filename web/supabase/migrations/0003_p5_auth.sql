-- P5 (PRD F-11·F-13, D-04·D-05): who logged in, their rods (막대) and the bookmarks on them.
-- Run this in the Supabase SQL Editor once, after 0001 and 0002. Then run supabase/checks/p5_rls.sql to see that one
-- person cannot read or change another's rows (PHASES P5 완료 기준).
--
-- Access: the app's API routes call Supabase with the logged-in person's session and the anon key, so these RLS
-- policies and grants are what keep people apart. events and books stay server-only (service role).
-- No names, no emails here: the Google email stays in auth.users (Supabase Auth) only (taxonomy 6-3d).
-- Supabase Auth → Sign In / Providers: keep "Allow anonymous sign-ins" OFF (anonymous users would be `authenticated`).

begin;

-- saves had no rows before P5; the new columns below are NOT NULL without defaults.
do $$
begin
  if exists (select 1 from public.saves) then
    raise exception 'saves is not empty — move its rows to a rod by hand before running 0003';
  end if;
end $$;

-- D-04: one row per person, written by /auth/callback on the first login (a new row = first login, E-14).
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text not null check (provider in ('kakao', 'google')),
  created_at timestamptz not null default now()
);

-- C-17 rods: at most five per person (position 0..4, one rod per position). Position 0 is the first rod, made by the
-- server with the first save, and cannot be deleted (policy below). The name is the person's own words (≤12 characters)
-- — kept here only, never in events (taxonomy 6-1).
create table if not exists public.shelves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 12 and btrim(name) <> ''),
  position int not null check (position between 0 and 4),
  created_at timestamptz not null default now(),
  unique (user_id, position),
  unique (id, user_id)                  -- target of saves' (shelf_id, user_id) key: a bookmark only on its owner's rod
);

-- D-05: the bookmark as it was met. isbn is checked against the published catalogue by the server — books.json, not
-- the books table, is the catalogue (the daily pipeline adds books without touching this database).
-- saves_shelf_fkey is checked at commit (deferred): deleting an account cascades to rods and bookmarks in any order,
-- while deleting a rod that still holds bookmarks fails.
alter table public.saves drop constraint if exists saves_isbn_fkey;
alter table public.saves
  add constraint saves_user_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  add column shelf_id uuid not null,
  add column position int not null,     -- order on the rod, smallest first; a new or moved bookmark goes in front (min - 1)
  add column reason jsonb not null,     -- 나온 이유 at the time (label + items), for the back face
  add column met_on date not null,      -- 만난 날 (Korean date the bookmark was met)
  add constraint saves_shelf_fkey foreign key (shelf_id, user_id) references public.shelves (id, user_id)
    deferrable initially deferred,
  add constraint saves_isbn_format check (isbn ~ '^97[89][0-9]{10}$'),
  add constraint saves_art_size check (pg_column_size(art) < 2000),
  add constraint saves_reason_size check (pg_column_size(reason) < 4000);
create index if not exists saves_shelf_order on public.saves (shelf_id, position);

-- At most 500 bookmarks per person — the API checks too, this keeps a direct call with the anon key in bounds.
create or replace function public.saves_limit() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.saves where user_id = new.user_id) >= 500 then
    raise exception 'too many bookmarks' using errcode = 'check_violation';
  end if;
  return new;
end $$;
drop trigger if exists saves_limit on public.saves;
create trigger saves_limit before insert on public.saves for each row execute function public.saves_limit();

alter table public.profiles enable row level security;
alter table public.shelves enable row level security;
-- saves: RLS already on (0001)

-- Only what the app needs, only for logged-in people. events and books: nobody but the service role.
revoke all on public.profiles, public.shelves, public.saves, public.events, public.books from anon, authenticated;
grant select, insert on public.profiles to authenticated;
grant select, insert, update, delete on public.shelves, public.saves to authenticated;

-- Each person sees and changes only their own rows. (select auth.uid()) is evaluated once per statement.
create policy profiles_own_select on public.profiles for select to authenticated using (user_id = (select auth.uid()));
create policy profiles_own_insert on public.profiles for insert to authenticated
  with check (user_id = (select auth.uid()) and provider = (select auth.jwt() -> 'app_metadata' ->> 'provider'));

create policy shelves_own_select on public.shelves for select to authenticated using (user_id = (select auth.uid()));
create policy shelves_own_insert on public.shelves for insert to authenticated with check (user_id = (select auth.uid()));
create policy shelves_own_update on public.shelves for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy shelves_own_delete on public.shelves for delete to authenticated
  using (user_id = (select auth.uid()) and position > 0);

create policy saves_own_select on public.saves for select to authenticated using (user_id = (select auth.uid()));
create policy saves_own_insert on public.saves for insert to authenticated with check (user_id = (select auth.uid()));
create policy saves_own_update on public.saves for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy saves_own_delete on public.saves for delete to authenticated using (user_id = (select auth.uid()));

commit;
