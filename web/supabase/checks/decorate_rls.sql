-- 책갈피 꾸미기: run in the Supabase SQL Editor after 0005, as one script. Like p5_rls.sql it always ends with an error
-- box titled "RLS CHECK RESULT" (that error undoes everything) — every line in it must end in "ok". Any "FAILED" = stop
-- and fix 0005. If a different error appears instead, the check did not run to the end: send that message to Claude.

begin;

create temp table rls_result (check_name text, ok boolean);
grant all on rls_result to authenticated, anon;

-- The backfill: every bookmark kept before 0005 has its first picture.
insert into rls_result select 'O1 every bookmark has original_art', not exists (select 1 from public.saves where original_art is null);

insert into auth.users (id, aud, role) values
  ('00000000-0000-4000-8000-0000000000e1', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f2', 'authenticated', 'authenticated');
-- E has met the otter (the server's write): after 0006 the database, too, lets a bookmark use only collected parts.
insert into public.collection (user_id, kind, value, first_art) values
  ('00000000-0000-4000-8000-0000000000e1', 'animal', 'otter', '{"animal":"otter","bg":"peach","sky":"moon","ground":"none","rare":true}');

-- ── Person E keeps a bookmark (the app does not send original_art; one sent anyway is ignored) ──────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
insert into public.shelves (id, user_id, name, position) values
  ('00000000-0000-4000-8000-00000000e5e5', '00000000-0000-4000-8000-0000000000e1', '첫 막대', 0);
set local role service_role;                          -- bookmarks are saved by the server only (0007)
insert into public.saves (user_id, isbn, art, original_art, shelf_id, position, reason, met_on) values
  ('00000000-0000-4000-8000-0000000000e1', '9788998441012', '{"animal":"fox","bg":"peach","sky":"moon","ground":"none","rare":false}',
   '{"animal":"bluedragon"}', '00000000-0000-4000-8000-00000000e5e5', 0, '{}', '2026-10-05');
insert into public.saves (user_id, isbn, art, shelf_id, position, reason, met_on) values
  ('00000000-0000-4000-8000-0000000000e1', '9788998441029', '{"animal":"cat","bg":"leaf","sky":"cloud","ground":"grass","rare":false}',
   '00000000-0000-4000-8000-00000000e5e5', 1, '{}', '2026-10-05');
insert into rls_result select 'E1 a new bookmark keeps its art as original_art',
  count(*) = 2 and bool_and(original_art = art) from public.saves;
set local role authenticated;

-- Decorating: art changes, original_art stays — also when an update tries to set it.
update public.saves set art = '{"animal":"otter","bg":"peach","sky":"moon","ground":"none","rare":true}' where isbn = '9788998441012';
update public.saves set original_art = '{"animal":"whitetiger"}' where isbn = '9788998441029';
insert into rls_result select 'E2 decorating changes art, not original_art',
  art ->> 'animal' = 'otter' and original_art ->> 'animal' = 'fox' from public.saves where isbn = '9788998441012';
insert into rls_result select 'E3 original_art cannot be overwritten',
  original_art ->> 'animal' = 'cat' from public.saves where isbn = '9788998441029';

-- ── Person F: cannot see or decorate E's bookmarks (RLS as in 0003) ─────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f2","role":"authenticated"}', true);
insert into rls_result select 'F1 sees no bookmark of E', count(*) = 0 from public.saves;
with u as (update public.saves set art = '{"animal":"redbird"}' returning 1)
  insert into rls_result select 'F2 cannot decorate E''s bookmark', count(*) = 0 from u;

-- ── Nobody logged in ────────────────────────────────────────────────────────────────────────────────────────────
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
do $$
begin
  perform 1 from public.saves;
  insert into rls_result values ('G1 anon cannot read saves', false);
exception when insufficient_privilege then
  insert into rls_result values ('G1 anon cannot read saves', true);
end $$;

reset role;
insert into rls_result select 'E4 E''s first picture is still the fox',
  original_art ->> 'animal' = 'fox' and art ->> 'animal' = 'otter'
  from public.saves where user_id = '00000000-0000-4000-8000-0000000000e1' and isbn = '9788998441012';

do $$
begin
  raise exception E'RLS CHECK RESULT\n%', (
    select string_agg(check_name || ': ' || case when ok then 'ok' else 'FAILED' end, E'\n' order by check_name)
    from rls_result);
end $$;
