-- P5 완료 기준 "다른 사람 책갈피가 보이지 않는다": run in the Supabase SQL Editor after 0003, as one script.
-- Two made-up people are created inside a transaction, act as each other, and vanish again: the script always ends
-- with an error box titled "RLS CHECK RESULT" (that error is what undoes everything). Read the lines in it —
-- every line must end in "ok". Any "FAILED" = stop and fix 0003.
-- If a different error appears instead, the check did not run to the end: send that message to Claude.

begin;

insert into auth.users (id, aud, role) values
  ('00000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b2', 'authenticated', 'authenticated');

create temp table rls_result (check_name text, ok boolean);
grant all on rls_result to authenticated, anon;

-- ── Person A: a profile, the first rod, a second rod, a bookmark ─────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","app_metadata":{"provider":"kakao"}}', true);
insert into public.profiles (user_id, provider) values ('00000000-0000-4000-8000-0000000000a1', 'kakao');
insert into public.shelves (id, user_id, name, position) values
  ('00000000-0000-4000-8000-00000000a5a5', '00000000-0000-4000-8000-0000000000a1', '첫 막대', 0),
  ('00000000-0000-4000-8000-00000000a6a6', '00000000-0000-4000-8000-0000000000a1', '둘째', 1);
insert into public.saves (user_id, isbn, art, shelf_id, position, reason, met_on)
  values ('00000000-0000-4000-8000-0000000000a1', '9788998441012', '{}', '00000000-0000-4000-8000-00000000a5a5', 0, '{}', '2026-10-01');
insert into rls_result select 'A1 sees own bookmark', count(*) = 1 from public.saves;
insert into rls_result select 'A2 sees own two rods', count(*) = 2 from public.shelves;

do $$
begin
  delete from public.shelves where position = 0;     -- the policy keeps position 0: deletes nothing
  insert into rls_result select 'A3 cannot delete the first rod', exists (select 1 from public.shelves where position = 0);
  begin
    insert into public.shelves (user_id, name, position) values ('00000000-0000-4000-8000-0000000000a1', 'x', 5);
    insert into rls_result values ('A4 no sixth rod position', false);
  exception when check_violation then
    insert into rls_result values ('A4 no sixth rod position', true);
  end;
  begin
    insert into public.shelves (user_id, name, position) values ('00000000-0000-4000-8000-0000000000a1', 'x', 1);
    insert into rls_result values ('A5 one rod per position', false);
  exception when unique_violation then
    insert into rls_result values ('A5 one rod per position', true);
  end;
  begin
    insert into public.shelves (user_id, name, position) values ('00000000-0000-4000-8000-0000000000a1', '열세글자가넘는막대이름입니다', 2);
    insert into rls_result values ('A6 rod name at most 12', false);
  exception when check_violation then
    insert into rls_result values ('A6 rod name at most 12', true);
  end;
end $$;

-- ── Person B ──────────────────────────────────────────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated","app_metadata":{"provider":"google"}}', true);
insert into rls_result select 'B1 sees no saves of A', count(*) = 0 from public.saves;
insert into rls_result select 'B2 sees no rods of A', count(*) = 0 from public.shelves;
insert into rls_result select 'B3 sees no profiles of A', count(*) = 0 from public.profiles;
with u as (update public.saves set position = 99 returning 1) insert into rls_result select 'B4 cannot move A''s bookmark', count(*) = 0 from u;
with d as (delete from public.shelves returning 1) insert into rls_result select 'B5 cannot delete A''s rod', count(*) = 0 from d;
with r as (update public.shelves set name = 'x' returning 1) insert into rls_result select 'B6 cannot rename A''s rod', count(*) = 0 from r;
with d as (delete from public.saves returning 1) insert into rls_result select 'B7 cannot remove A''s bookmark', count(*) = 0 from d;

do $$
begin
  insert into public.profiles (user_id, provider) values ('00000000-0000-4000-8000-0000000000b2', 'kakao');   -- B logged in with Google
  insert into rls_result values ('B0 cannot claim another login provider', false);
exception when insufficient_privilege then
  insert into rls_result values ('B0 cannot claim another login provider', true);
end $$;

-- B's own rows work.
insert into public.profiles (user_id, provider) values ('00000000-0000-4000-8000-0000000000b2', 'google');
insert into public.shelves (id, user_id, name, position)
  values ('00000000-0000-4000-8000-00000000b5b5', '00000000-0000-4000-8000-0000000000b2', '첫 막대', 0);
insert into public.saves (user_id, isbn, art, shelf_id, position, reason, met_on)
  values ('00000000-0000-4000-8000-0000000000b2', '9788998441012', '{}', '00000000-0000-4000-8000-00000000b5b5', 0, '{}', '2026-10-01');
insert into rls_result select 'B8 can keep own bookmark', count(*) = 1 from public.saves;

do $$
begin
  begin
    insert into public.shelves (user_id, name, position) values ('00000000-0000-4000-8000-0000000000a1', 'x', 3);
    insert into rls_result values ('B9 cannot add a rod for A', false);
  exception when insufficient_privilege then
    insert into rls_result values ('B9 cannot add a rod for A', true);
  end;
  begin
    insert into public.saves (user_id, isbn, art, shelf_id, position, reason, met_on)
      values ('00000000-0000-4000-8000-0000000000a1', '9788998441013', '{}', '00000000-0000-4000-8000-00000000a5a5', 0, '{}', '2026-10-01');
    insert into rls_result values ('B10 cannot write a bookmark as A', false);
  exception when insufficient_privilege then
    insert into rls_result values ('B10 cannot write a bookmark as A', true);
  end;
  -- Hanging a bookmark on A's rod is caught by the (shelf_id, user_id) key, which is checked at commit: force it now.
  begin
    insert into public.saves (user_id, isbn, art, shelf_id, position, reason, met_on)
      values ('00000000-0000-4000-8000-0000000000b2', '9788998441013', '{}', '00000000-0000-4000-8000-00000000a5a5', 0, '{}', '2026-10-01');
    set constraints public.saves_shelf_fkey immediate;
    insert into rls_result values ('B11 cannot use A''s rod', false);
  exception when foreign_key_violation then
    insert into rls_result values ('B11 cannot use A''s rod', true);
  end;
  begin
    update public.saves set shelf_id = '00000000-0000-4000-8000-00000000a6a6' where user_id = '00000000-0000-4000-8000-0000000000b2';
    set constraints public.saves_shelf_fkey immediate;
    insert into rls_result values ('B12 cannot move own bookmark onto A''s rod', false);
  exception when foreign_key_violation then
    insert into rls_result values ('B12 cannot move own bookmark onto A''s rod', true);
  end;
  set constraints public.saves_shelf_fkey deferred;
end $$;

-- ── A again: nothing of A changed ─────────────────────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated","app_metadata":{"provider":"kakao"}}', true);
insert into rls_result select 'C1 A''s bookmark unchanged',
  count(*) = 1 from public.saves where position = 0 and shelf_id = '00000000-0000-4000-8000-00000000a5a5';
insert into rls_result select 'C2 A''s rods unchanged', count(*) = 2 from public.shelves where name in ('첫 막대', '둘째');

-- ── Nobody logged in ──────────────────────────────────────────────────────────────────────────────────────────────
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
do $$
begin
  begin
    perform 1 from public.saves;
    insert into rls_result values ('D1 anon cannot read saves', false);
  exception when insufficient_privilege then
    insert into rls_result values ('D1 anon cannot read saves', true);
  end;
  begin
    perform 1 from public.shelves;
    insert into rls_result values ('D2 anon cannot read rods', false);
  exception when insufficient_privilege then
    insert into rls_result values ('D2 anon cannot read rods', true);
  end;
  begin
    perform 1 from public.events;
    insert into rls_result values ('D3 anon cannot read events', false);
  exception when insufficient_privilege then
    insert into rls_result values ('D3 anon cannot read events', true);
  end;
end $$;

-- ── Deleting an account takes its rods and bookmarks with it ────────────────────────────────────────────────────
reset role;
delete from auth.users where id = '00000000-0000-4000-8000-0000000000a1';
set constraints all immediate;
insert into rls_result select 'E1 account delete removes rods and bookmarks',
  not exists (select 1 from public.shelves where user_id = '00000000-0000-4000-8000-0000000000a1')
  and not exists (select 1 from public.saves where user_id = '00000000-0000-4000-8000-0000000000a1')
  and not exists (select 1 from public.profiles where user_id = '00000000-0000-4000-8000-0000000000a1');

-- The result, shown as an error so that the whole transaction is undone.
do $$
begin
  raise exception E'RLS CHECK RESULT\n%', (
    select string_agg(check_name || ': ' || case when ok then 'ok' else 'FAILED' end, E'\n' order by check_name)
    from rls_result);
end $$;
