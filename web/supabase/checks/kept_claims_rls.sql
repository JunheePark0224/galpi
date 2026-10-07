-- v1.7.1: run in the Supabase SQL Editor after 0007 (0003·0004·0005 before it), as one script. Like collection_rls.sql it always ends with an error
-- box titled "RLS CHECK RESULT" (that error undoes everything) — every line in it must end in "ok". Any "FAILED" = stop and
-- fix 0007. If a different error appears instead, the check did not run to the end: send that message to Claude.

begin;

insert into auth.users (id, aud, role) values
  ('00000000-0000-4000-8000-0000000000e1', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f2', 'authenticated', 'authenticated');

create temp table rls_result (check_name text, ok boolean);
grant all on rls_result to authenticated, anon, service_role;

-- ── Person E, logged in ─────────────────────────────────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
do $$
begin
  begin
    insert into public.collection_kept_claims (seed, iat, idx, user_id) values (7, 100, 1, '00000000-0000-4000-8000-0000000000e1');
    insert into rls_result values ('K1 a person claims a bookmark for themselves', true);
  exception when others then
    insert into rls_result values ('K1 a person claims a bookmark for themselves', false);
  end;
  begin
    insert into public.collection_kept_claims (seed, iat, idx, user_id) values (7, 100, 2, '00000000-0000-4000-8000-0000000000f2');
    insert into rls_result values ('K2 cannot claim in someone else''s name', false);
  exception when insufficient_privilege then
    insert into rls_result values ('K2 cannot claim in someone else''s name', true);
  end;
  begin
    insert into public.collection_kept_claims (seed, iat, idx, user_id) values (7, 100, 10, '00000000-0000-4000-8000-0000000000e1');
    insert into rls_result values ('K3 only bookmark places 0..9', false);
  exception when check_violation then
    insert into rls_result values ('K3 only bookmark places 0..9', true);
  end;
  begin
    update public.collection_kept_claims set user_id = '00000000-0000-4000-8000-0000000000f2';
    insert into rls_result values ('K4 a claim cannot be handed over', false);
  exception when insufficient_privilege then
    insert into rls_result values ('K4 a claim cannot be handed over', true);
  end;
  begin
    delete from public.collection_kept_claims;
    insert into rls_result values ('K5 a claim cannot be given up', false);
  exception when insufficient_privilege then
    insert into rls_result values ('K5 a claim cannot be given up', true);
  end;
end $$;
insert into rls_result select 'K6 sees own claim', count(*) = 1 from public.collection_kept_claims;

-- ── Person F, logged in: the same bookmark is taken, and E's claim is not visible ────────────────────────────────────
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f2","role":"authenticated"}', true);
do $$
begin
  begin
    insert into public.collection_kept_claims (seed, iat, idx, user_id) values (7, 100, 1, '00000000-0000-4000-8000-0000000000f2');
    insert into rls_result values ('K7 one person per bookmark of a draw', false);
  exception when unique_violation then
    insert into rls_result values ('K7 one person per bookmark of a draw', true);
  end;
end $$;
insert into rls_result select 'K8 cannot see another person''s claim', count(*) = 0 from public.collection_kept_claims;

-- ── Bookmarks are saved by the server only (0007): a person cannot insert one with their own session ─────────────────
do $$
begin
  insert into public.shelves (id, user_id, name, position)
    values ('00000000-0000-4000-8000-00000000f5f5', '00000000-0000-4000-8000-0000000000f2', '첫 막대', 0);
  begin
    insert into public.saves (user_id, isbn, art, shelf_id, position, reason, met_on)
      values ('00000000-0000-4000-8000-0000000000f2', '9788998441012', '{"animal":"bluedragon","bg":"galaxy","ground":"none","rare":true}',
              '00000000-0000-4000-8000-00000000f5f5', 0, '{}', '2026-10-05');
    insert into rls_result values ('K11 a person cannot insert a bookmark directly', false);
  exception when insufficient_privilege then
    insert into rls_result values ('K11 a person cannot insert a bookmark directly', true);
  end;
end $$;
reset role;
set local role service_role;
do $$
begin
  insert into public.saves (user_id, isbn, art, shelf_id, position, reason, met_on)
    values ('00000000-0000-4000-8000-0000000000f2', '9788998441012', '{"animal":"fox","bg":"peach","ground":"none","rare":false}',
            '00000000-0000-4000-8000-00000000f5f5', 0, '{}', '2026-10-05');
  insert into rls_result values ('K12 the server saves bookmarks', true);
exception when others then
  insert into rls_result values ('K12 the server saves bookmarks', false);
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f2","role":"authenticated"}', true);
insert into rls_result select 'K13 the person still reads their bookmark', count(*) = 1 from public.saves;
with u as (update public.saves set position = 3 returning 1) insert into rls_result select 'K14 the person still moves it', count(*) = 1 from u;
with d as (delete from public.saves returning 1) insert into rls_result select 'K15 the person still removes it', count(*) = 1 from d;

-- ── Nobody logged in ────────────────────────────────────────────────────────────────────────────────────────────
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
do $$
begin
  perform 1 from public.collection_kept_claims;
  insert into rls_result values ('K9 anon cannot read claims', false);
exception when insufficient_privilege then
  insert into rls_result values ('K9 anon cannot read claims', true);
end $$;

-- ── Deleting an account takes its claims with it ────────────────────────────────────────────────────────────────
reset role;
delete from auth.users where id = '00000000-0000-4000-8000-0000000000e1';
insert into rls_result select 'K10 account delete removes its claims',
  not exists (select 1 from public.collection_kept_claims where user_id = '00000000-0000-4000-8000-0000000000e1');

do $$
begin
  raise exception E'RLS CHECK RESULT\n%', (
    select string_agg(check_name || ': ' || case when ok then 'ok' else 'FAILED' end, E'\n' order by check_name)
    from rls_result);
end $$;
