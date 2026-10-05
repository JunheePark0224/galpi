# 유입 채널 분석 노트 — 공개 홍보 (10-07)

> taxonomy v1.4 (3-1b). 홍보 링크의 `utm_*`는 E-01 `site_visited`의 `props`에, 들어온 곳의 호스트는 공통 `common.referrer`에 있다.
> Supabase SQL Editor에서 그대로 실행한다. 공개 시각은 아래 `'2026-10-07 00:00+09'`을 실제 공개 시각으로 바꾼다
> (`launch-plan.md` 0절 — 공개 직전에 테스트 기록을 지우므로 그 뒤 기록만 남는다).

## 규칙 요약

- **세션 하나 = 첫 접촉 하나.** 같은 탭에서 새로고침하면 E-01이 다시 남지만 `utm_*`는 같은 값이다 → 방문은 `session_id`로 센다.
- 표시가 없으면 `null` (주소를 직접 입력, 표시 없는 공유 링크, 다른 탭에서 새로 연 경우).
- 앱 안 브라우저(인스타그램·스레드·카톡)는 `referrer`가 대개 빈 문자열이다 → 채널은 `utm_source`가 먼저, 없을 때만 `referrer` 호스트로 짐작한다.
- `referrer`는 v1.4부터 호스트만(`l.instagram.com`). 그 전 기록은 주소 전체지만, 아래 식(`ref_host`)은 둘 다에서 호스트를 뽑는다.
- 비율은 차이의 크기 + 신뢰구간으로 본다 (CLAUDE.md 원칙 5). 채널마다 세션 수가 작으면 구간이 넓다는 것을 함께 적는다.

## 1. 채널별 방문 수 (utm_source)

```sql
-- 세션마다 첫 site_visited 한 줄 → utm_source별 세션 수·사람 수·E-01 줄 수
with visits as (
  select distinct on (common->>'session_id')
         common->>'session_id'                                   as sid,
         common->>'anon_id'                                      as anon,
         coalesce(props->>'utm_source', '(none)')                as utm_source,
         props->>'utm_medium'                                    as utm_medium,
         props->>'utm_campaign'                                  as utm_campaign,
         created_at
  from events
  where name = 'site_visited'
    and created_at >= timestamptz '2026-10-07 00:00+09'
  order by common->>'session_id', created_at
)
select utm_source, utm_medium, utm_campaign,
       count(*)             as sessions,
       count(distinct anon) as people
from visits
group by 1, 2, 3
order by sessions desc;
```

E-01 줄 수(새로고침 포함)가 필요하면 `distinct on` 없이 `count(*)`를 센다 — 세션 수와의 차이가 곧 재로딩 수다.

## 2. 표시가 없을 때 referrer 호스트로 짐작한 채널

```sql
with visits as (
  select distinct on (common->>'session_id')
         common->>'session_id' as sid,
         props->>'utm_source'  as utm_source,
         -- 옛 기록(주소 전체)과 v1.4 기록(호스트) 모두에서 호스트만 뽑는다
         nullif(substring(lower(common->>'referrer') from '^(?:[a-z][a-z0-9+.-]*://)?([^/:?#]+)'), '') as ref_host,
         (common->>'is_in_app_browser')::boolean as in_app
  from events
  where name = 'site_visited'
    and created_at >= timestamptz '2026-10-07 00:00+09'
  order by common->>'session_id', created_at
)
select coalesce(utm_source,
         case when ref_host like '%instagram.com' then 'instagram (referrer)'
              when ref_host like '%threads.net' or ref_host like '%threads.com' then 'threads (referrer)'
              when ref_host like '%linkedin.com' or ref_host = 'lnkd.in' or ref_host = 'com.linkedin.android' then 'linkedin (referrer)'
              when ref_host like '%kakao.com' then 'kakao (referrer)'
              when ref_host is null then '(direct / in-app, no tag)'
              else ref_host end) as channel,
       count(*)                          as sessions,
       count(*) filter (where in_app)    as in_app_sessions
from visits
group by 1
order by sessions desc;
```

## 3. 채널별 완주 — 방문 세션 중 결과 화면(S-06)까지 간 비율

```sql
with visits as (
  select distinct on (common->>'session_id')
         common->>'session_id' as sid,
         coalesce(props->>'utm_source', '(none)') as utm_source
  from events
  where name = 'site_visited'
    and created_at >= timestamptz '2026-10-07 00:00+09'
  order by common->>'session_id', created_at
),
reached as (
  select distinct common->>'session_id' as sid
  from events
  where name = 'result_viewed'
    and created_at >= timestamptz '2026-10-07 00:00+09'
)
select v.utm_source,
       count(*)                                   as sessions,
       count(r.sid)                               as reached_result,
       round(count(r.sid)::numeric / count(*), 3) as rate
from visits v
left join reached r using (sid)
group by 1
order by sessions desc;
```

신뢰구간은 노트북에서 채널별 `(reached_result, sessions)`로 Wilson 구간을 붙인다(taxonomy 5-3 보고 방식).

## Amplitude와 비교할 때

Amplitude는 같은 표시를 주소에서 스스로 읽어 유저 속성(`utm_source`, `initial_utm_source` …)으로 가진다(우리 `utm_*` 이벤트 속성은 Amplitude로 보내지 않는다 — taxonomy 2-7). Amplitude 세션은 30분 규칙이라 세션 수는 다를 수 있다. 다르면 이 SQL(원본 Supabase)을 기준으로 한다.
