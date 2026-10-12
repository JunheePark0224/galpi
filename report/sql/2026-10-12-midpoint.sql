-- 10/12 중간 점검용 (Supabase → SQL Editor). 분석 시작점 2026-10-09 14:10 KST 이후만.
-- 결과는 SQL Editor의 [Download CSV]로 받아서 파일 이름 그대로 알려 주면 된다 (개인정보 없음: 익명 번호·숫자만).

-- ① 가설 1 핵심 차트 — 이용자 × pick_type별 반응 수 (이용자 단위로 묶어 신뢰구간을 내려고 이용자별로 받는다)
--    pick_type: recommended(좁혀 고른 4장) / random(시스템이 무작위로 넣은 1장, 5장 순서도 섞임)
--    파일 이름: q1_reactions_by_user.csv
select common->>'anon_id'                                        as anon,
       props->>'pick_type'                                       as pick_type,
       count(*)                                                  as reacted,
       count(*) filter (where props->>'reaction' = 'curious')    as curious
from events
where name = 'bookmark_reacted'
  and created_at >= timestamptz '2026-10-09 14:10+09'
group by 1, 2
order by 1, 2;

-- ② 가설 2 퍼널 — 단계별로 도달한 사람 수 (익명 번호 기준)
--    파일 이름: q2_funnel.csv
with s as (
  select common->>'anon_id' as anon, name
  from events
  where created_at >= timestamptz '2026-10-09 14:10+09'
)
select step, people from (
  select 1 as ord, '1 방문'               as step, count(distinct anon) as people from s where name = 'site_visited'
  union all select 2, '2 시작(갈피 잡으러 가기)', count(distinct anon) from s where name = 'entry_selected'
  union all select 3, '3 첫 질문 답',          count(distinct anon) from s where name = 'question_answered'
  union all select 4, '4 질문 끝',             count(distinct anon) from s where name = 'path_completed'
  union all select 5, '5 책갈피 봄',           count(distinct anon) from s where name = 'bookmark_shown'
  union all select 6, '6 책갈피에 반응',       count(distinct anon) from s where name = 'bookmark_reacted'
  union all select 7, '7 결과(뒤표지) 봄',     count(distinct anon) from s where name = 'result_viewed'
  union all select 8, '8 저장 또는 예스24',    count(distinct anon) from s where name in ('book_saved', 'yes24_link_clicked')
) t order by ord;

-- ③ 비즈니스 임팩트 — 책갈피까지 받고도 한 권도 고르지 않고 떠난 사람
--    "고름" = 궁금해요 1번 이상, 저장, 예스24 중 하나라도
--    파일 이름: q3_left_empty.csv
with shown as (
  select distinct common->>'anon_id' as anon from events
  where name = 'bookmark_shown' and created_at >= timestamptz '2026-10-09 14:10+09'
), picked as (
  select distinct common->>'anon_id' as anon from events
  where created_at >= timestamptz '2026-10-09 14:10+09'
    and ((name = 'bookmark_reacted' and props->>'reaction' = 'curious') or name in ('book_saved', 'yes24_link_clicked'))
)
select count(*)                                              as got_bookmarks,
       count(*) filter (where anon not in (select anon from picked)) as left_empty
from shown;

-- ④ 채널별 (어제 드린 것과 같음) — 방문·완주·예스24
--    파일 이름: q4_channels.csv
with visits as (
  select distinct on (common->>'session_id')
         common->>'session_id' as sid,
         common->>'anon_id'    as anon,
         coalesce(props->>'utm_source', '(none)') as source,
         props->>'utm_campaign' as campaign
  from events
  where name = 'site_visited'
    and created_at >= timestamptz '2026-10-09 14:10+09'
  order by common->>'session_id', created_at
),
done as (
  select distinct common->>'session_id' as sid from events
  where name = 'result_viewed' and created_at >= timestamptz '2026-10-09 14:10+09'
),
yes24 as (
  select distinct common->>'session_id' as sid from events
  where name = 'yes24_link_clicked' and created_at >= timestamptz '2026-10-09 14:10+09'
)
select v.source, v.campaign,
       count(distinct v.anon)                                   as people,
       count(*)                                                 as visits,
       count(*) filter (where v.sid in (select sid from done))  as finished,
       count(*) filter (where v.sid in (select sid from yes24)) as to_yes24
from visits v
group by 1, 2
order by people desc;
