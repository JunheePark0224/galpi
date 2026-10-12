-- 갈피 이벤트 원자료 (분석 기간, 본인 기기 제외) → data/raw/events/events_<날짜>.csv (깃에 올리지 않음)
-- 빼는 것: 계정 번호(user_id) → 로그인 여부만, 우체통 글·직접 쓴 글(텍스트), 전체 referrer 주소 → 호스트만
-- SQL Editor 결과 개수 제한은 "No limit"으로
select e.created_at at time zone 'Asia/Seoul'          as at_kst,
       e.name,
       e.common->>'anon_id'                            as anon,
       e.common->>'session_id'                         as session,
       (e.common->>'user_id') is not null              as is_logged_in,
       e.common->>'round'                              as round,
       e.common->>'entry'                              as entry,
       e.common->>'mode'                               as mode,
       e.common->>'device'                             as device,
       e.common->>'is_in_app_browser'                  as in_app,
       e.common->>'is_returning'                       as returning,
       e.common->>'screen_version'                     as screen_version,
       nullif(substring(lower(e.common->>'referrer') from '^(?:[a-z][a-z0-9+.-]*://)?([^/:?#]+)'), '') as ref_host,
       (e.props - 'feedback_text' - 'goal_text' - 'missing_text')::text as props
from events e
where e.created_at >= timestamptz '2026-10-09 14:10+09'
  and e.common->>'anon_id' not in ('963f449d-d96b-45cc-b03a-6d5f150477fa', 'abc42f53-3c38-4a94-a4fe-b4c16e2b2c56', 'de3d99af-cb69-4479-bfc6-451ae9780373')
order by e.created_at;
