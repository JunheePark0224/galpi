-- v1.7.1 (security review of the guest 도감 fix): a bookmark saved before logging in reaches the 도감 through
-- POST /api/collection/found with `kept: true` — the draw's signed ticket (v3, which also signs the draw's books) plus the
-- saved book. This table makes that a one-time claim: each bookmark of a draw (seed, iat, idx) can be claimed by ONE
-- person, so a shared ticket can never fill many 도감s. The route inserts with the person's own session; a second claim of
-- the same bookmark is a unique violation (409 for someone else, fine for the same person — they can see their own row).
--
-- Bookmarks are saved by the server only (security re-review): 0003's saves_own_insert let a person insert a row with the
-- anon key and their session — any picture, which 0005 then keeps as its first picture. From here on the server inserts
-- saves with the service role, user_id from the verified session and the picture worked out from the draw's signed ticket
-- (lib/library/savedArt). Reading, moving, decorating (0006 guards the art) and removing stay with the person's session.
--
-- Run this in the Supabase SQL Editor once, after 0003·0004·0005. Then run, each as its own query, supabase/checks/
-- p5_rls.sql, decorate_rls.sql and kept_claims_rls.sql (every line "ok"). Safe to run again.
-- The site needs SUPABASE_SERVICE_ROLE_KEY on the server for saving (without it a save answers 503 — fail closed).

begin;

create table if not exists public.collection_kept_claims (
  seed bigint not null check (seed between 0 and 4294967295),   -- the draw's art seed (lib/collection/ticket)
  iat bigint not null check (iat >= 0),                          -- when the ticket was issued (seconds)
  idx smallint not null check (idx between 0 and 9),             -- which bookmark of the draw (MAX_TICKET_PICKS = 10)
  user_id uuid not null references auth.users (id) on delete cascade,
  claimed_at timestamptz not null default now(),
  primary key (seed, iat, idx)
);

alter table public.collection_kept_claims enable row level security;

-- Logged-in people: insert and read their own claims only. No update / delete — a claim is final.
revoke all on public.collection_kept_claims from anon, authenticated;
grant select, insert on public.collection_kept_claims to authenticated;
grant select, insert, delete on public.collection_kept_claims to service_role;

drop policy if exists kept_claims_own_select on public.collection_kept_claims;
create policy kept_claims_own_select on public.collection_kept_claims
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists kept_claims_own_insert on public.collection_kept_claims;
create policy kept_claims_own_insert on public.collection_kept_claims
  for insert to authenticated with check (user_id = (select auth.uid()));

-- saves: no direct inserts with a person's session — the server (service role) saves bookmarks.
drop policy if exists saves_own_insert on public.saves;
revoke insert on public.saves from authenticated;
grant select, insert on public.saves to service_role;

commit;
