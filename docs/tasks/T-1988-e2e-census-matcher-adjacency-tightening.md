---
id: T-1988
title: e2e 커버리지 census 매칭기 정밀화 — suffix segment 인접성 + 동적 segment 위치 고정
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 150
estimatedFiles: 1
dependsOn: [T-1987]
touchesFiles: [test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts]
independentStream: route-e2e-census-matcher-precision
created: 2026-09-09
plannerNote: P5 · T-1985 reviewer MINOR 1·2 (인접성 미검사·동적 segment 관대) — 스캐너 단일화가 끝나 매칭기만 남았다
---

# T-1988 — e2e 커버리지 census 매칭기 정밀화 (suffix segment 인접성 + 동적 segment 위치 고정)

## Why

[docs/PLAN.md](../PLAN.md) `166 행` 의 E2E 커버리지 축을 지키는 [route-e2e-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts) 는 route 1 개가 e2e 소스에 등장하는지를 `isCoveredBy` 로 판정하는데, 그 판정이 두 군데서 느슨하다. [T-1985 PR #1558](https://github.com/myungjoo/Assessment-Agent/pull/1558) reviewer 가 MINOR 1·2 로 남긴 그대로다 — (1) suffix 를 **segment 별로 파일 전역에서** 찾기 때문에 한 e2e 파일이 여러 prefix 를 다루면 서로 다른 route 의 조각이 합쳐져 false-covered 가 가능하고, (2) 동적 segment(`:id`) 매칭 `/(?:\$\{[^}]*\}|[A-Za-z0-9_.-]+)/` 은 **파일 어디든 `/토큰` 하나만 있으면 참**이라 사실상 prefix 검사만이 유일한 판별자다. reviewer 는 셋 다 CLAUDE.md §3 "다른 주제" 라 별도 slice 로 미뤘고, MINOR 3(토크나이저 중복)은 T-1986·T-1987 이 이미 닫았다. 남은 건 매칭기 정밀도 하나다.

**issue-still-relevant pre-check (origin/main `c98b8f25`, 본 fire 실측)**:

- 느슨함 미해소 — `git show origin/main:test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts` 의 `54~66 행` `isCoveredBy` 가 여전히 `hasPath(seg)`(segment 별 전역 검색) + 전역 동적 토큰 정규식이다. 인접성 검사 도입 흔적 0.
- MINOR 3 은 안착 완료 — 같은 파일 `19~23 행` 이 `censusRoutes`/`findFiles`/`RouteRecord` 를 [test/helpers/route-census.ts](../../test/helpers/route-census.ts) 에서 import 한다(T-1987, main `84b26d29`). 본 task 는 그 위에 매칭기만 손댄다.
- **정밀화가 실측 수치를 흔들지 않음을 planner 가 사전 실측했다** — 현행 로직 대비 "suffix segment 를 인접 chain 으로 매칭 + 동적 segment 를 그 chain 안 위치에서만 매칭" 으로 좁혔을 때 실 저장소(controller 23 · route 89 · e2e 38)의 미커버 집합은 **여전히 정확히 2 건**(`GET /api/admin/import/running` · `GET /api/admin/import/modes`)이다. 즉 allowlist · `MIN` 재기준선 조정이 **불필요**하다.
- 반면 **전체 경로를 통째로 인접 매칭**하는 더 강한 안은 채택하지 않는다 — planner 실측에서 미커버가 2 → 7~14 건으로 늘었는데, 그 증가분은 실제 공백이 아니라 e2e 가 URL 을 `const BASE = "/api/x"` + 템플릿으로 조립하기 때문에 생기는 **거짓 미커버**다(예: `DELETE /api/persons/:personId/identities/:identityId`). 본 task 는 그 안을 명시적으로 기각한다(§Out of Scope).
- `docs/tasks/` 에 `T-1988` 미사용(1987 개), 동일 의도 PENDING task 0.

소비처 동반 의무(CLAUDE.md §3) — **비해당**. 신설 helper 가 아니라 같은 파일 안에서 소비되는 spec-local 순수 함수 1 개의 정밀화다.

## Required Reading

- [test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts) — 전체 `221 행`. 수정 대상은 `41 행` `BOUNDARY` · `42 행` `esc` · `50~66 행` `isCoveredBy` 와 그 doc 주석, `129~166 행` Flow describe(합성 `ROUTE` 팩토리 + 분기 (a)~(d)). **무접촉** 구간: `31 행` `MIN` · `34~39 행` allowlist · `68~77 행` `uncoveredLabels` · `79~87 행` IO · `89~128 행` Happy/Negative describe · `168~220 행` 자기검증 · Error path.
- [test/helpers/route-census.ts](../../test/helpers/route-census.ts) `74~90 행` — `RouteRecord` 필드 정의(`prefix` · `suffix` · `label` 이 본 매칭기의 입력). 본 task 는 helper 를 **수정하지 않는다**.
- [test/e2e/export-job-status-read.e2e-spec.ts](../../test/e2e/export-job-status-read.e2e-spec.ts) `27 행` · `100~102 행` — e2e 가 `const BASE` + 템플릿 리터럴로 URL 을 조립하는 대표 형태. 전체 경로 통째 인접 매칭을 기각하는 근거.
- [test/e2e/service-identities.e2e-spec.ts](../../test/e2e/service-identities.e2e-spec.ts) `1~3 행`(대상 route 목록) · `116 행`(`` `/api/persons/${personId}/identities` `` 조립) — 다중 동적 segment(`:personId`/`:identityId`) route 가 e2e 에 나타나는 실제 표기. 정밀화 후에도 커버로 남아야 하는 대표 route 다.
- [CLAUDE.md](../../CLAUDE.md) `§3.2` — R-110 · R-112 · R-113.

## Acceptance Criteria

- [ ] `isCoveredBy` 를 다음 두 축으로 좁힌다. **suffix segment 인접성** — `route.suffix` 의 segment 를 각각 전역 검색하지 않고 `/seg1/seg2/…` **한 덩어리 정규식**으로 조립해 한 번에 매칭한다. **동적 segment 위치 고정** — `:param` 은 그 덩어리 안의 해당 위치에서만 `(?:\$\{[^}]*\}|[A-Za-z0-9_.-]+)` 로 매칭하며, 파일 전역의 임의 `/토큰` 은 더 이상 근거가 되지 않는다. prefix 존재 검사(`hasPath(route.prefix)`)와 `BOUNDARY` 접두 충돌 방지는 그대로 유지한다.
- [ ] **실측 불변** — `pnpm test:smoke` 에서 census 수치가 정밀화 전과 같다: controller 23 · route 89 · e2e spec 38 · 커버 87 · 미커버 정확히 2 건(allowlist 와 양방향 일치). `MIN` 값 · allowlist 항목 · reason 태그를 **바꾸지 않고** 통과해야 한다. 만약 미커버가 2 건을 벗어나면 재기준선을 잡지 말고 진행을 멈춘 뒤 그 route 목록을 `## Follow-ups` 에 남긴다(planner 실측과 어긋난다는 신호).
- [ ] **happy-path 1+** — 다중 segment route(`ROUTE("api/z", ":id/status")`)가 `` `${BASE}/${id}/status` `` 형태와 `"/api/z/abc-123/status"` 실 문자열 양쪽에서 여전히 커버로 판정된다(기존 `143~148 행` 단언 보존 + 다중 동적 segment 케이스 1+ 추가).
- [ ] **error path 1+** — 기존 Error path 계약(`210 행` 이하: 없는 디렉터리 throw · `@Controller` 부재 throw · non-string `TypeError`)이 무접촉으로 통과함을 확인하고, 매칭기 자체에 대해 빈 문자열 소스(`isCoveredBy(route, "")`)가 예외 없이 `false` 를 돌려준다는 단언 1+ 를 둔다(조용한 true 흡수 금지).
- [ ] **분기별 1+** — (a) suffix 빈 문자열(`@Get()`) → prefix 만으로 판정(기존 `149~155 행` 보존) (b) 정적 다중 segment → 인접할 때만 true (c) 동적 segment 1 개 (d) 동적 segment 2 개 이상(`:personId/identities/:identityId`) (e) 접두 충돌 방지(`/running` vs `/running-xyz`, 기존 `161~165 행` 보존) — 각 1+.
- [ ] **negative case 를 예외 분기마다 1+** — 본 task 가 새로 잡아야 하는 거짓 커버가 실제로 red 가 됨을 합성 입력으로 증명한다: (1) `/api/z` 와 `/detail` 이 **같은 파일의 서로 다른 지점**에 흩어져 있으면(`get("/api/z")` + `get("/api/other/detail")`) `ROUTE("api/z", "detail")` 은 미커버 (2) `ROUTE("api/z", ":id/status")` 에 대해 파일에 `/api/z` 와 무관한 `/${otherId}` 만 있고 `/…/status` 인접 조합이 없으면 미커버 (3) segment 순서가 뒤집힌 표기(`/status/${id}`)는 커버로 세지 않음 (4) 부분 chain(`/api/z/${id}` 만 있고 `/status` 없음)은 미커버 — 각 1+.
- [ ] `isCoveredBy` 의 doc 주석(`50~53 행`)을 정밀화 후 사실로 갱신한다 — "segment 별 존재로 나눠 본다" 는 서술이 거짓으로 남지 않게 한다. 파일 상단 헤더 주석에 T-1988 근거 1~2 줄(reviewer MINOR 1·2 출처 + 전체 경로 인접 매칭을 기각한 이유) 추가.
- [ ] it 총계는 **18 개 이내**로 유지하고 cap(≤ 300 LOC / ≤ 5 파일) 안에 든다. 초과가 보이면 분기 it 을 `it.each` 로 묶는다.
- [ ] `pnpm lint && pnpm build && pnpm test` green, `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). `src/` 0 LOC 변경이라 전역 coverage 는 불변이어야 한다.
- [ ] `pnpm test:smoke` 에서 두 census suite(guard 축 · e2e 축)가 모두 PASS 하고 guard 축 spec 은 **무접촉**이다. CI `smoke test` leg green 확인(R-113).

## Out of Scope

- **전체 경로(prefix+suffix) 통째 인접 매칭 채택 금지** — planner 실측에서 거짓 미커버 5~12 건을 만든다(위 §Why). 필요하면 e2e 소스의 `const BASE = "..."` 상수 인라인 후 매칭이라는 별도 안을 새 slice 로 검토한다.
- `MIN` 하한값 · allowlist 항목 · reason 태그 조정, census 수치 재기준선.
- [test/helpers/route-census.ts](../../test/helpers/route-census.ts) 및 그 colocated spec 수정 — 본 slice 는 e2e 축 spec 1 파일만 건드린다.
- [route-auth-guard-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts) 본문 수정 — guard 축은 `isCoveredBy` 를 쓰지 않는다.
- 미커버 2 건(`import/running` · `import/modes`)에 e2e 신규 작성 — T-1981 이 realdb perf-spec 중복을 근거로 명시 이월한 축이다.
- `src/` · `web/` · `prisma/` · `test/e2e/` · `test/perf/` · `test/load/` · `.github/workflows/` · `package.json` 변경(PLAN `157`·`158`·`183 행` 오너 게이트 미침범).
- `docs/requirements.md` REQ status 재판정(§3.1 판정 규칙 6 — 구현 후 1 회).
- `scripts/daily-test.sh` leg 추가(Q-0054 선례 — drift-guard parity spec 3 종 동반이라 cap 초과).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **잔여 느슨함 — 동적 segment 로 시작하는 chain 은 앵커 미적용** (본 slice 실측). 정적 시작 chain 은 "route prefix 바로 뒤 또는 새 경로 조각 시작" 앵커를 요구하지만, 동적 시작 chain 에 같은 앵커를 걸면 `POST /api/persons/:personId/identities/:identityId/primary` 가 **거짓 미커버**가 된다 — [service-identities.e2e-spec.ts](../../test/e2e/service-identities.e2e-spec.ts) `122~124 행` 이 `` `${identityEndpointFor(a, b)}/primary` `` 로 조립해 `/:identityId` 앞의 `/` 가 builder 안에 숨기 때문이다(앵커 전면 적용 시 미커버 2 → 3). 그래서 그 축만 남겨 뒀고, 그 결과 동적 시작 chain 은 여전히 남의 경로 꼬리를 빌릴 여지가 있다.
- 위 route 의 현행 커버 근거는 같은 파일 `118 행` 한국어 주석의 `PATCH/DELETE/primary` **우연 매치** 하나뿐이다(본 slice 실측). 주석 표현만 바뀌어도 census 가 red 가 되므로, §Out of Scope 의 "e2e 소스 `const BASE` · builder 인라인 후 매칭" 안을 별도 slice 로 검토한 뒤 앵커를 전 chain 으로 확대한다.
