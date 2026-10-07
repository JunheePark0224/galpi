-- 도감 v1: run in the Supabase SQL Editor after 0004 (and again after 0008 — no sky kind), as one script. Like p5_rls.sql it always ends with an error box titled
-- "RLS CHECK RESULT" (that error undoes everything) — every line in it must end in "ok". Any "FAILED" = stop and fix 0004.
-- If a different error appears instead, the check did not run to the end: send that message to Claude.

begin;

insert into auth.users (id, aud, role) values
  ('00000000-0000-4000-8000-0000000000c1', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000d2', 'authenticated', 'authenticated');

-- The server (service role, here the editor's own role) records one part for each person.
insert into public.collection (user_id, kind, value, first_art) values
  ('00000000-0000-4000-8000-0000000000c1', 'animal', 'fox', '{"animal":"fox","bg":"peach","ground":"none","rare":false}'),
  ('00000000-0000-4000-8000-0000000000d2', 'animal', 'cat', '{"animal":"cat","bg":"peach","ground":"none","rare":false}');

create temp table rls_result (check_name text, ok boolean);
grant all on rls_result to authenticated, anon, service_role;

do $$
begin
  begin
    insert into public.collection (user_id, kind, value, first_art) values ('00000000-0000-4000-8000-0000000000c1', 'hat', 'x', '{}');
    insert into rls_result values ('S1 only the three kinds', false);
  exception when check_violation then
    insert into rls_result values ('S1 only the three kinds', true);
  end;
  begin
    insert into public.collection (user_id, kind, value, first_art) values ('00000000-0000-4000-8000-0000000000c1', 'animal', 'fox', '{}');
    insert into rls_result values ('S2 one row per part', false);
  exception when unique_violation then
    insert into rls_result values ('S2 one row per part', true);
  end;
end $$;

-- ── Person C, logged in ─────────────────────────────────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
insert into rls_result select 'C1 sees own part only', count(*) = 1 and bool_and(value = 'fox') from public.collection;

do $$
begin
  begin
    insert into public.collection (user_id, kind, value, first_art)
      values ('00000000-0000-4000-8000-0000000000c1', 'animal', 'bluedragon', '{}');
    insert into rls_result values ('C2 cannot write a part in (server only)', false);
  exception when insufficient_privilege then
    insert into rls_result values ('C2 cannot write a part in (server only)', true);
  end;
  begin
    update public.collection set is_new = false;
    insert into rls_result values ('C3 cannot change rows', false);
  exception when insufficient_privilege then
    insert into rls_result values ('C3 cannot change rows', true);
  end;
  begin
    delete from public.collection;
    insert into rls_result values ('C4 cannot delete rows', false);
  exception when insufficient_privilege then
    insert into rls_result values ('C4 cannot delete rows', true);
  end;
end $$;

-- ── The server (service_role): may record and clear NEW ────────────────────────────────────────────────────────
reset role;
select set_config('request.jwt.claims', '', true);
set local role service_role;
do $$
begin
  insert into public.collection (user_id, kind, value, first_art)
    values ('00000000-0000-4000-8000-0000000000c1', 'ground', 'grass', '{"animal":"fox","bg":"peach","ground":"none","rare":false}')
    on conflict do nothing;
  update public.collection set is_new = false where user_id = '00000000-0000-4000-8000-0000000000c1';
  insert into rls_result select 'S3 service_role can record and clear NEW',
    count(*) = 2 and bool_and(not is_new) from public.collection where user_id = '00000000-0000-4000-8000-0000000000c1';
exception when insufficient_privilege then
  insert into rls_result values ('S3 service_role can record and clear NEW', false);
end $$;

-- ── Nobody logged in ────────────────────────────────────────────────────────────────────────────────────────────
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
do $$
begin
  perform 1 from public.collection;
  insert into rls_result values ('D1 anon cannot read the 도감', false);
exception when insufficient_privilege then
  insert into rls_result values ('D1 anon cannot read the 도감', true);
end $$;

-- ── Deleting an account takes its 도감 with it ──────────────────────────────────────────────────────────────────
reset role;
delete from auth.users where id = '00000000-0000-4000-8000-0000000000c1';
insert into rls_result select 'E1 account delete removes the 도감',
  not exists (select 1 from public.collection where user_id = '00000000-0000-4000-8000-0000000000c1');

do $$
begin
  raise exception E'RLS CHECK RESULT\n%', (
    select string_agg(check_name || ': ' || case when ok then 'ok' else 'FAILED' end, E'\n' order by check_name)
    from rls_result);
end $$;
