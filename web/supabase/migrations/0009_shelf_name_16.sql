-- 11-05 (user): a rod name may be up to 16 characters (was 12, 0003). Same rule otherwise: 1 or more, not only spaces.
-- lib/library/validate.ts SHELF_NAME_MAX is the same number. Run this in the Supabase SQL Editor BEFORE deploying the
-- site that allows 16 — until then a 13–16 character name is refused by the database (the screen says it could not save).
-- 0003 wrote the check inline, so Postgres named it shelves_name_check.

begin;
alter table public.shelves drop constraint if exists shelves_name_check;
alter table public.shelves add constraint shelves_name_check
  check (char_length(name) between 1 and 16 and btrim(name) <> '');
commit;

-- check: one row, ending "between 1 and 16"
select pg_get_constraintdef(oid) from pg_constraint where conname = 'shelves_name_check';
