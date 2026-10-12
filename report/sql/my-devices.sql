-- 내 기기의 익명 번호 찾기 (Supabase → SQL Editor). 분석에서 뺄 개발자 기기 목록(report/README.md)과 맞춰 본다.
-- 먼저 휴대폰·PC에서 각각 갈피에 본인 계정으로 한 번씩 로그인해 둘 것. '본인 이메일'만 바꿔서 실행.
select common->>'anon_id'  as anon_id,
       min(created_at)     as first_seen,
       max(created_at)     as last_seen,
       count(*)            as events
from events
where common->>'user_id' in (
  select id::text from auth.users where email = '본인 이메일'
)
group by 1
order by last_seen desc;
