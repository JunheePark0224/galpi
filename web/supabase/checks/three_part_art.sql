-- Three-part pictures (10-07 A): run in the Supabase SQL Editor after 0008, as one script. Like p5_rls.sql it always ends
-- with an error box titled "RLS CHECK RESULT" (that error undoes everything) — every line in it must end in "ok". Any
-- "FAILED" = stop and fix 0008. If a different error appears instead, the check did not run to the end: send that message
-- to Claude.

begin;

create temp table rls_result (check_name text, ok boolean);
grant all on rls_result to authenticated, anon, service_role;

-- ── What 0008 cleaned (the real rows, before the test rows below) ────────────────────────────────────────────────
insert into rls_result select 'A1 no sky or firefly rows in the 도감',
  not exists (select 1 from public.collection where kind not in ('animal', 'bg', 'ground') or value = 'firefly');
insert into rls_result select 'A2 every bookmark picture is three parts + rare (no sky key, no fireflies)',
  not exists (select 1 from public.saves
    where (select array_agg(k order by k) from jsonb_object_keys(art) k) is distinct from array['animal', 'bg', 'ground', 'rare']
       or (select array_agg(k order by k) from jsonb_object_keys(original_art) k) is distinct from array['animal', 'bg', 'ground', 'rare']
       or art ->> 'ground' = 'firefly' or original_art ->> 'ground' = 'firefly');
-- ── The three-part guard, with a made-up person K ────────────────────────────────────────────────────────────────
insert into auth.users (id, aud, role) values ('00000000-0000-4000-8000-0000000000e9', 'authenticated', 'authenticated');

do $$
begin
  insert into public.collection (user_id, kind, value, first_art)
    values ('00000000-0000-4000-8000-0000000000e9', 'sky', 'moon', '{}');
  insert into rls_result values ('A3 the 도감 refuses a sky row', false);
exception when check_violation then
  insert into rls_result values ('A3 the 도감 refuses a sky row', true);
end $$;

insert into public.collection (user_id, kind, value, first_art) values
  ('00000000-0000-4000-8000-0000000000e9', 'bg', 'summer', '{"animal":"cat","bg":"summer","ground":"none","rare":true}');
insert into public.shelves (id, user_id, name, position) values
  ('00000000-0000-4000-8000-00000000e9e9', '00000000-0000-4000-8000-0000000000e9', '첫 막대', 0);
set local role service_role;                          -- bookmarks are saved by the server only (0007)
insert into public.saves (user_id, isbn, art, shelf_id, position, reason, met_on) values
  ('00000000-0000-4000-8000-0000000000e9', '9788998441012', '{"animal":"fox","bg":"peach","ground":"grass","rare":false}',
   '00000000-0000-4000-8000-00000000e9e9', 0, '{}', '2026-10-07');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e9","role":"authenticated"}', true);

-- Allowed: the 여름밤 background K met; rare worked out again (sent false, 여름밤 is 한정판); an old sky key is dropped.
update public.saves set art = '{"animal":"fox","bg":"summer","ground":"grass","rare":false}' where isbn = '9788998441012';
insert into rls_result select 'K1 a met 여름밤 is allowed, counted rare, the sky key dropped',
  art = '{"animal":"fox","bg":"summer","ground":"grass","rare":true}'::jsonb from public.saves where isbn = '9788998441012';

do $$
begin
  update public.saves set art = '{"animal":"fox","bg":"peach","ground":"firefly","rare":true}' where isbn = '9788998441012';
  insert into rls_result values ('K2 fireflies are no longer a ground prop', false);
exception when insufficient_privilege then
  insert into rls_result values ('K2 fireflies are no longer a ground prop', true);
end $$;

do $$
begin
  update public.saves set art = '{"animal":"fox","bg":"peach"}' where isbn = '9788998441012';
  insert into rls_result values ('K3 a picture without its ground is refused', false);
exception when check_violation then
  insert into rls_result values ('K3 a picture without its ground is refused', true);
end $$;

update public.saves set art = original_art where isbn = '9788998441012';
insert into rls_result select 'K4 back to the first picture (처음 그림으로)',
  art = '{"animal":"fox","bg":"peach","ground":"grass","rare":false}'::jsonb from public.saves where isbn = '9788998441012';

reset role;

do $$
begin
  raise exception E'RLS CHECK RESULT\n%', (
    select string_agg(check_name || ': ' || case when ok then 'ok' else 'FAILED' end, E'\n' order by check_name)
    from rls_result);
end $$;
