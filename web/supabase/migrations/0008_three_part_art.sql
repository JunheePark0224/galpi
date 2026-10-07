-- 10-07 A (user decision, 시안 deco/sky.html A): a bookmark picture is three parts — animal + background + ground prop.
-- The sky props (moon, cloud, stars, birds, bigStar, rainbow, shooting, goldmoon) are gone; the fireflies left the ground
-- props and became the 한정판 background "summer" (여름밤). Nobody has really used the service yet, so the 도감 and the
-- test data are RESET for launch — everyone starts fair:
--   1. the 0006 art guard is replaced by the three-part one (lib/library/decorate.ts partAllowed, lib/art/combine.ts isRare);
--   2. collection: every row is deleted (the 도감 starts empty), and its kind check no longer allows 'sky';
--   3. collection_kept_claims: cleared (they were claims on v3 tickets, which the server no longer accepts — ticket v4);
--   4. saves: every bookmark goes back to its first picture, made three-part — the sky key dropped, fireflies → the empty
--      ground ("none"), `rare` worked out again. original_art the same. Bookmarks, rods and their order are kept.
-- Run this in the Supabase SQL Editor once, AFTER the new site is deployed (an older site would draw four-part pictures
-- and its tickets would no longer be accepted). Run it EXACTLY ONCE, at launch: the schema part is idempotent, but running it
-- again would wipe the collection and claims again and undo every decorated picture. Then run supabase/checks/three_part_art.sql (every line
-- "ok") and, each as its own query, supabase/checks/art_guard.sql and collection_rls.sql.
--
-- The rare lists below must stay equal to KIND_TIERS limited + first_edition — src/lib/library/artGuardSql.test.ts checks.

begin;

-- 1. The art guard, three parts. Same rule as 0006: every part is the empty ground, the bookmark's first picture's part,
-- or in the person's own collection rows; the stored picture is rebuilt with only its four keys.
create or replace function public.saves_art_guard() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  k text;
  v text;
  rare boolean := false;
begin
  foreach k in array array['animal', 'bg', 'ground'] loop
    if jsonb_typeof(new.art -> k) is distinct from 'string' then
      raise exception 'bookmark picture has no %', k using errcode = 'check_violation';
    end if;
    v := new.art ->> k;
    if not ((k = 'ground' and v = 'none')
            or old.original_art ->> k = v
            or exists (select 1 from public.collection c where c.user_id = new.user_id and c.kind = k and c.value = v)) then
      raise exception 'bookmark picture: % is not in this person''s collection', k using errcode = 'insufficient_privilege';
    end if;
    rare := rare or v = any (case k
      when 'animal' then array['whale', 'redpanda', 'fennec', 'otter', 'panda', 'koala', 'bluedragon', 'whitetiger', 'redbird', 'blacktortoise']
      when 'bg' then array['cherry', 'sunset', 'aurora', 'summer', 'galaxy', 'study']
      when 'ground' then array['clover', 'teacup', 'jar', 'quill', 'goldbook', 'musicbox']
    end);
  end loop;
  new.art := jsonb_build_object('animal', new.art ->> 'animal', 'bg', new.art ->> 'bg', 'ground', new.art ->> 'ground', 'rare', rare);
  return new;
end $$;

drop trigger if exists saves_art_guard on public.saves;
create trigger saves_art_guard before update on public.saves
  for each row when (new.art is distinct from old.art) execute function public.saves_art_guard();

-- 2. The 도감 starts empty; no sky rows can come back.
delete from public.collection;
alter table public.collection drop constraint if exists collection_kind_check;
alter table public.collection add constraint collection_kind_check check (kind in ('animal', 'bg', 'ground'));

-- 3. Claims on old tickets.
delete from public.collection_kept_claims;

-- 4. Every bookmark: its first picture, three parts. The two triggers would keep original_art and check art against an
-- empty 도감, so they are off for this one update only (inside this transaction).
create or replace function pg_temp.three_part(a jsonb) returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'animal', a ->> 'animal',
    'bg', a ->> 'bg',
    'ground', g,
    'rare', (a ->> 'animal') = any (array['whale', 'redpanda', 'fennec', 'otter', 'panda', 'koala', 'bluedragon', 'whitetiger', 'redbird', 'blacktortoise'])
         or (a ->> 'bg') = any (array['cherry', 'sunset', 'aurora', 'summer', 'galaxy', 'study'])
         or g = any (array['clover', 'teacup', 'jar', 'quill', 'goldbook', 'musicbox']))
  from (select case when a ->> 'ground' = 'firefly' then 'none' else a ->> 'ground' end as g) parts
$$;

alter table public.saves disable trigger saves_original_art;
alter table public.saves disable trigger saves_art_guard;
update public.saves
  set original_art = pg_temp.three_part(original_art), art = pg_temp.three_part(original_art)
  where art is distinct from pg_temp.three_part(original_art) or original_art is distinct from pg_temp.three_part(original_art);
alter table public.saves enable trigger saves_art_guard;
alter table public.saves enable trigger saves_original_art;

commit;
