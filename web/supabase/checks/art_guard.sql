-- 꾸미기 guard: run in the Supabase SQL Editor after 0006, as one script. Like p5_rls.sql it always ends with an error box
-- titled "RLS CHECK RESULT" (that error undoes everything) — every line in it must end in "ok". Any "FAILED" = stop and
-- fix 0006. If a different error appears instead, the check did not run to the end: send that message to Claude.

begin;

create temp table rls_result (check_name text, ok boolean);
grant all on rls_result to authenticated, anon;

insert into auth.users (id, aud, role) values
  ('00000000-0000-4000-8000-0000000000a7', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b8', 'authenticated', 'authenticated');

-- The server (service role, here the editor's own role) recorded: person H has the otter, person J the white tiger.
insert into public.collection (user_id, kind, value, first_art) values
  ('00000000-0000-4000-8000-0000000000a7', 'animal', 'otter', '{"animal":"otter","bg":"peach","sky":"moon","ground":"none","rare":true}'),
  ('00000000-0000-4000-8000-0000000000b8', 'animal', 'whitetiger', '{"animal":"whitetiger","bg":"peach","sky":"moon","ground":"none","rare":true}');

-- The 도감 is still written by the server only (0004).
insert into rls_result select 'C1 logged-in people cannot write the collection',
  not has_table_privilege('authenticated', 'public.collection', 'INSERT')
  and not has_table_privilege('authenticated', 'public.collection', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.collection', 'DELETE')
  and not has_table_privilege('anon', 'public.collection', 'INSERT');

-- ── Person H, logged in, with the anon key (what a direct call can do) ──────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a7","role":"authenticated"}', true);

do $$
begin
  insert into public.collection (user_id, kind, value, first_art)
    values ('00000000-0000-4000-8000-0000000000a7', 'animal', 'bluedragon', '{}');
  insert into rls_result values ('C2 H cannot add a part to their own collection', false);
exception when insufficient_privilege then
  insert into rls_result values ('C2 H cannot add a part to their own collection', true);
end $$;

insert into public.shelves (id, user_id, name, position) values
  ('00000000-0000-4000-8000-00000000a7a7', '00000000-0000-4000-8000-0000000000a7', '첫 막대', 0);
insert into public.saves (user_id, isbn, art, shelf_id, position, reason, met_on) values
  ('00000000-0000-4000-8000-0000000000a7', '9788998441012', '{"animal":"fox","bg":"peach","sky":"moon","ground":"grass","rare":false}',
   '00000000-0000-4000-8000-00000000a7a7', 0, '{}', '2026-10-05');

-- Allowed: a part in H's collection; rare is worked out again (sent false, otter is 한정판) and extra keys are dropped.
update public.saves set art = '{"animal":"otter","bg":"peach","sky":"moon","ground":"grass","rare":false,"x":1}'
  where isbn = '9788998441012';
insert into rls_result select 'H1 a collected part is allowed, rare worked out again',
  art = '{"animal":"otter","bg":"peach","sky":"moon","ground":"grass","rare":true}'::jsonb from public.saves where isbn = '9788998441012';

-- Allowed: the empty ground (never collected).
update public.saves set art = '{"animal":"otter","bg":"peach","sky":"moon","ground":"none","rare":true}' where isbn = '9788998441012';
insert into rls_result select 'H2 the empty ground is allowed', art ->> 'ground' = 'none' from public.saves where isbn = '9788998441012';

-- Allowed: back to the first picture (its parts were never recorded in H's collection).
update public.saves set art = original_art where isbn = '9788998441012';
insert into rls_result select 'H3 the first picture is allowed (처음 그림으로)',
  art = '{"animal":"fox","bg":"peach","sky":"moon","ground":"grass","rare":false}'::jsonb from public.saves where isbn = '9788998441012';

-- Allowed: moving a bookmark does not touch art.
update public.saves set position = 7 where isbn = '9788998441012';
insert into rls_result select 'H4 moving still works', position = 7 from public.saves where isbn = '9788998441012';

do $$
begin
  update public.saves set art = '{"animal":"bluedragon","bg":"peach","sky":"moon","ground":"grass","rare":true}'
    where isbn = '9788998441012';
  insert into rls_result values ('H5 a part H never met is refused', false);
exception when insufficient_privilege then
  insert into rls_result values ('H5 a part H never met is refused', true);
end $$;

do $$
begin
  update public.saves set art = '{"animal":"whitetiger","bg":"peach","sky":"moon","ground":"grass","rare":true}'
    where isbn = '9788998441012';
  insert into rls_result values ('H6 a part only J has is refused', false);
exception when insufficient_privilege then
  insert into rls_result values ('H6 a part only J has is refused', true);
end $$;

do $$
begin
  update public.saves set art = '{"animal":"fox","bg":"galaxy","sky":"moon","ground":"grass","rare":true}' where isbn = '9788998441012';
  insert into rls_result values ('H7 a 초판본 background H never met is refused', false);
exception when insufficient_privilege then
  insert into rls_result values ('H7 a 초판본 background H never met is refused', true);
end $$;

do $$
begin
  update public.saves set art = '{"animal":"fox","bg":"peach","sky":"moon"}' where isbn = '9788998441012';
  insert into rls_result values ('H8 a picture without all four parts is refused', false);
exception when check_violation then
  insert into rls_result values ('H8 a picture without all four parts is refused', true);
end $$;

reset role;
insert into rls_result select 'H9 H''s bookmark is still the first picture',
  art = original_art and art ->> 'animal' = 'fox' from public.saves where user_id = '00000000-0000-4000-8000-0000000000a7';

do $$
begin
  raise exception E'RLS CHECK RESULT\n%', (
    select string_agg(check_name || ': ' || case when ok then 'ok' else 'FAILED' end, E'\n' order by check_name)
    from rls_result);
end $$;
