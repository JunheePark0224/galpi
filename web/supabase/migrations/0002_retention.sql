-- F-16 v0: events older than one year are deleted daily (pg_cron).
-- Run this in the Supabase SQL Editor. If `create extension` fails with a permission error,
-- turn pg_cron on in the dashboard (Database -> Extensions -> pg_cron) and run this file again.
create extension if not exists pg_cron;
select cron.schedule(
  'galpi-events-retention',
  '17 3 * * *',
  $$delete from public.events where created_at < now() - interval '1 year'$$
);
