-- 책갈피 꾸미기 (PRD F-13·F-21, plans/2026-10-05-decorate.md): saves.art is the picture the person sees now (they may
-- swap its parts for ones in their 도감); original_art keeps the picture the bookmark was first kept with, for
-- [처음 그림으로].
-- Run this in the Supabase SQL Editor once, after 0004. Then run supabase/checks/decorate_rls.sql (every line "ok").
--
-- Access: nothing new. saves keeps its RLS (0003 — each person their own rows). original_art is written by the trigger
-- below only: a new row copies its art, an update keeps the old value — so neither the app nor a direct call with the
-- anon key can change what "처음 그림" is. Which parts a picture may use is checked by the server (/api/library/saves/art).

begin;

alter table public.saves add column if not exists original_art jsonb;
update public.saves set original_art = art where original_art is null;          -- every bookmark so far: its first picture
alter table public.saves alter column original_art set not null;
alter table public.saves drop constraint if exists saves_original_art_size;
alter table public.saves add constraint saves_original_art_size check (pg_column_size(original_art) < 2000);

-- Before-row trigger (runs before the not-null check): insert = art as it was kept; update = never changes.
create or replace function public.saves_original_art() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.original_art := new.art;
  else
    new.original_art := old.original_art;
  end if;
  return new;
end $$;
drop trigger if exists saves_original_art on public.saves;
create trigger saves_original_art before insert or update on public.saves
  for each row execute function public.saves_original_art();

commit;
