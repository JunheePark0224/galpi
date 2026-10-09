-- 공개 직전 시험 기록 지우기 (2026-10-09, docs/deploy.md 6절 · marketing-plan.md 1절)
-- Supabase → SQL Editor에서 사용자가 실행한다. 한 단계씩, 결과를 보고 다음 단계로.
-- 지우는 것: events 표의 시험 기록(친구 시험·개발·최종 점검). 이 시각이 분석 시작점이 된다.
-- 그리고 도감 전체(사용자 결정 10-09: 아직 이용자가 없으니 모두 같은 출발선에서 — 0008과 같은 방법).
-- 지우지 않는 것: 갈피 우체통 글(feedback_sent — 친구들의 의견, 질적 자료), 로그인 계정·저장한 책갈피·막대
--   (saves·shelves — 사람의 실제 보관함. 분석은 events로만 한다).

-- ① 지금 몇 줄인지 이름별로 본다 (지우기 전 기록)
select name, count(*) as rows, min(created_at) as first_at, max(created_at) as last_at
from events
group by name
order by rows desc;

-- ② 우체통 글을 먼저 살펴본다 (남겨 둔다 — 화면에서 복사해 두고 싶으면 여기서)
select created_at, props->>'feedback_text' as letter
from events
where name = 'feedback_sent'
order by created_at;

-- ③ 지운다 — 우체통 글만 빼고 지금 이전의 모든 기록. 한 번에 한 묶음으로.
begin;
delete from events
where name <> 'feedback_sent'
  and created_at < now();
-- 지운 줄 수가 ①의 합(우체통 줄 제외)과 같은지 확인한 뒤:
commit;
-- 이상하면 commit 대신: rollback;

-- ③-2 도감 초기화 — 모은 부분과, 같은 뽑기 표로 두 번 기록되지 않게 막는 표시를 함께 비운다 (0008 2·3단계와 같음)
select count(*) as collection_rows from public.collection;
select count(*) as claim_rows from public.collection_kept_claims;
begin;
delete from public.collection;
delete from public.collection_kept_claims;
commit;
-- 이미 꾸민 책갈피의 그림은 그대로 남는다(처음 그림 부분은 언제든 다시 고를 수 있음). 꾸밀 때 고를 수 있는 것만 처음부터 다시 모은다.

-- ④ 남은 기록 확인 — events에는 feedback_sent만, 도감은 0
select name, count(*) from events group by name;
select count(*) as collection_rows from public.collection;

-- ⑤ 이 시각을 적어 둔다 (분석 시작점 — Amplitude 대시보드 시작점도 같은 날로)
select now() as analysis_start;
