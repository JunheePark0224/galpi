-- 책갈피 꾸미기, kept by the database too (PRD F-13·F-21): 0003 lets a logged-in person UPDATE their own saves rows
-- (saves_own_update — the app moves bookmarks with their session), so with the public anon key and their own session
-- they could set saves.art to any picture directly, skipping PATCH /api/library/saves/art and its 도감 check. This trigger
-- makes the database refuse what that route refuses: when art changes, every part must be
--   the empty ground ("none" — drawn, never collected), or
--   the same part of the bookmark's first picture (original_art, 0005 — kept before a login, maybe never recorded), or
--   in the person's own collection rows (0004 — written by the server only, service role).
-- That is lib/library/decorate.ts partAllowed(). `rare` is worked out again from the parts (lib/art/combine.ts isRare: any
-- part 한정판 or 초판본) and the stored picture is rebuilt with only its five keys, like parseArt.
-- Moving a bookmark (shelf_id / position) does not change art, so it is not checked. original_art stays as 0005 keeps it.
-- Run this in the Supabase SQL Editor once, after 0005 (safe to run again). Then run supabase/checks/art_guard.sql
-- (every line "ok").
--
-- collection needs nothing new: 0004 grants logged-in people select only, so the 도감 cannot be faked from the browser.
-- The rare lists below must stay equal to KIND_TIERS limited + first_edition — src/lib/library/artGuardSql.test.ts checks.

begin;

-- security definer: reads the owner's collection rows whatever role runs the update (RLS would show the same rows to the
-- person; this also covers the server's own role). A trigger function cannot be called on its own, so no rpc is opened.
create or replace function public.saves_art_guard() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  k text;
  v text;
  rare boolean := false;
begin
  foreach k in array array['animal', 'bg', 'sky', 'ground'] loop
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
      when 'animal' then array['redpanda', 'fennec', 'otter', 'panda', 'koala', 'bluedragon', 'whitetiger', 'redbird', 'blacktortoise']
      when 'bg' then array['cherry', 'sunset', 'aurora', 'galaxy', 'study']
      when 'sky' then array['rainbow', 'shooting', 'goldmoon']
      when 'ground' then array['clover', 'firefly', 'goldbook']
    end);
  end loop;
  new.art := jsonb_build_object(
    'animal', new.art ->> 'animal', 'bg', new.art ->> 'bg', 'sky', new.art ->> 'sky', 'ground', new.art ->> 'ground', 'rare', rare);
  return new;
end $$;

drop trigger if exists saves_art_guard on public.saves;
create trigger saves_art_guard before update on public.saves
  for each row when (new.art is distinct from old.art) execute function public.saves_art_guard();

commit;
