-- 10/19 질문 화면 점검 (Supabase → SQL Editor). 공개(2026-10-09 14:10 KST) 이후, 개발자 기기 3대 제외.
-- 피드백 "질문이 길고 계속된다"(10-13·10-14)와 "이전 질문 답 강조"(10-14) 전에 데이터부터 본다.
-- 한 판 = 익명 번호 + 방문 번호 + round. 두 쿼리를 따로 실행하고 결과 표를 그대로 붙여 넣으면 된다.

-- ① 몇 번째 질문에서 그만두나 — 그 깊이까지 온 판 중, 거기서 더 답하지 않고 길도 끝내지 않은 판의 비율
--    길수록 그만두는 비율이 오르면 "길다"는 느낌이 실제 이탈로 이어진다는 뜻
with q as (
  select common->>'anon_id' || '|' || (common->>'session_id') || '|' || (common->>'round') as game,
         name, (props->>'depth')::int as depth
  from events
  where name in ('question_answered', 'path_completed')
    and created_at >= timestamptz '2026-10-09 14:10+09'
    and common->>'anon_id' not in ('963f449d-d96b-45cc-b03a-6d5f150477fa', 'abc42f53-3c38-4a94-a4fe-b4c16e2b2c56', 'de3d99af-cb69-4479-bfc6-451ae9780373')
),
games as (
  select game,
         max(depth) filter (where name = 'question_answered') as deepest,
         bool_or(name = 'path_completed')                     as completed
  from q group by game
)
select d.depth                                                         as "질문 깊이",
       count(*) filter (where g.deepest >= d.depth)                     as "여기까지 답한 판",
       count(*) filter (where g.deepest = d.depth and not g.completed)  as "여기서 그만둔 판",
       round(100.0 * count(*) filter (where g.deepest = d.depth and not g.completed)
             / nullif(count(*) filter (where g.deepest >= d.depth), 0), 1) as "그만둔 비율 %",
       count(*) filter (where g.deepest = d.depth and g.completed)      as "여기서 길이 끝난 판"
from games g
cross join generate_series(1, 12) as d(depth)
group by d.depth
having count(*) filter (where g.deepest >= d.depth) > 0
order by d.depth;

-- ② [← 이전 질문]을 얼마나 쓰나 — 질문에 한 번이라도 답한 사람 중 이전 질문을 누른 사람, 누른 곳별 횟수
with base as (
  select common->>'anon_id' as anon, name, props->>'source' as source
  from events
  where name in ('question_answered', 'question_back_clicked')
    and created_at >= timestamptz '2026-10-09 14:10+09'
    and common->>'anon_id' not in ('963f449d-d96b-45cc-b03a-6d5f150477fa', 'abc42f53-3c38-4a94-a4fe-b4c16e2b2c56', 'de3d99af-cb69-4479-bfc6-451ae9780373')
)
select '질문에 답한 사람'                       as "항목", count(distinct anon) filter (where name = 'question_answered') as "값" from base
union all select '이전 질문을 누른 사람',        count(distinct anon) filter (where name = 'question_back_clicked') from base
union all select '누른 횟수 — 질문 화면',        count(*) filter (where name = 'question_back_clicked' and source = 'question') from base
union all select '누른 횟수 — 길 요약(S-04)',    count(*) filter (where name = 'question_back_clicked' and source = 'first_page') from base
union all select '누른 횟수 — 휴대폰 뒤로가기',  count(*) filter (where name = 'question_back_clicked' and source = 'device_back') from base;
