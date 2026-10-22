---
id: T-2036
title: groups guard 배선 선행 6 — k6 s2-read.js groups 3 지점에 인증 cookie 선탑재
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-043, REQ-045, REQ-048, REQ-073]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-10-21
independentStream: q0056-groups-guard
dependsOn: [T-2035]
touchesFiles:
  [
    test/load/s2-read.js,
    test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts,
  ]
hqOrigin: Q-0056
plannerNote: P5 · Q-0056 ① groups 축 선행 6 — T-2031 Follow-up ④ k6 s2-read.js groups 3 지점 cookie (T-2023 동형)
---

# T-2036 — groups guard 배선 선행 6: k6 s2-read.js groups 3 지점에 인증 cookie 선탑재

## Why

[PLAN.md](../PLAN.md) `157 행` 오너 최우선 지시 아래 진행하는 Q-0056 arc 의 groups 축 여섯 번째 조각이다. 오너 결정은 `STATE.humanQuestions` Q-0056 `decision` 의 옵션 ① (persons → groups → parts 순서, 기존 `JwtAuthGuard` · `RolesGuard` · `@Roles` 재사용, 새 dependency 0) 이다. [T-2031](T-2031-groups-guard-precursor-cookie-preattach.md) `## Follow-ups` 가 정한 groups 축 순서에서 ① e2e · smoke (T-2031), ② web 계약 (T-2032 · T-2033), ③ perf 6 spec (T-2034 · T-2035, `20d5cd98`) 이 끝났고, 본 task 는 **④ k6 선행** 이다. persons 축 [T-2023](T-2023-k6-s2-persons-cookie-preattach.md) 과 같은 구조다.

`/api/groups` 를 때리는 k6 스크립트는 `s2-read.js` **하나뿐** 이다 (`s1-batch.js` · `s3-concurrent.js` 는 groups 참조 0 — 아래 pre-check). 그 안의 groups 3 지점이 모두 cookie 없이 나간다:

- `setup()` `139~143 행` — `POST /api/groups` seed (공용 `SEED_PARAMS`, tag `seed`)
- `default()` `167 행` — `GET /api/groups` 측정 (tag `groups`, `route:groups` p95 임계 대상)
- `teardown()` `183~189 행` — `DELETE /api/groups/:id` 회수 (공용 `TEARDOWN_PARAMS`, tag `teardown`)

⑤ 가 `GroupController` 에 guard 를 붙이면 세 지점이 **401** 이 되어 전역 `http_req_failed: rate<0.01` 과 `route:groups` p95 표본이 오염되고, seed POST 실패로 `group.json("id")` 가 깨져 teardown 까지 연쇄로 틀어진다. 부하 job 은 `workflow_dispatch` 전용이라 상시 CI 는 green 인 채로 침묵하는 유형의 파손이므로, arc 규약대로 guard 전에 소비처를 먼저 준비한다. 지금은 guard 가 없어 cookie 가 no-op 이므로 본 slice 는 단독 green 으로 머지된다. cookie 획득 배선 (`authCookie` 지역 const, `setup` `100~115 행`) 은 T-1624 · T-2023 이 이미 만들어 두었고, groups seed POST (`139 행`) 는 그보다 **뒤** 에 있어 블록 이동이 필요 없다.

issue-still-relevant pre-check (planner, 2026-10-21, `origin/main` = `dde9bd04`):

- `git grep -c "UseGuards\|@Roles" origin/main -- src/user/group.controller.ts` → **0 hit**. guard 미배선, arc 유효.
- `git grep -n "groups" origin/main -- test/load` → `s2-read.js` 만 hit (`81` 임계 · `140` seed POST · `167` 측정 GET · `185` 회수 DELETE, 나머지는 주석). `s1-batch.js` · `s3-concurrent.js` 는 0.
- `s2-read.js` 의 `headers: { Cookie: ` 는 persons 2 지점 (`122` · `164 행`) 과 `me` (`172 행`) 뿐이고 groups 3 지점은 0. 머리 주석 `10 행` · default 주석 `161~162 행` 이 "groups / parts 는 각자 축 몫이라 무변경" 이라고 적고 있다.
- `s2-read.js` · drift smoke spec 의 마지막 변경은 T-2028 (`246b2d0f`) 이고, T-2035 이후 main commit 은 bookkeeping 1 건 (`dde9bd04`) 이다. 본 slice 를 금지하는 owner 지시는 없다 (PLAN `158 행` 은 per-route perf baseline **신설** 금지라 저촉 0).

## Required Reading

- `docs/STATE.json` 의 `humanQuestions` Q-0056 `decision` (오너 승인 원문 · 조건)
- [docs/tasks/T-2031-groups-guard-precursor-cookie-preattach.md](T-2031-groups-guard-precursor-cookie-preattach.md) `## Follow-ups` — groups 축 순서 ④ · ⑤ 와 api.md tier 행 누락 미결 항목
- **선례 (그대로 따른다)**: [docs/tasks/T-2023-k6-s2-persons-cookie-preattach.md](T-2023-k6-s2-persons-cookie-preattach.md) — 같은 파일 persons 축의 cookie 선탑재. 인라인 params 형태 (`{ headers: { Cookie: authCookie }, tags: { route: "seed" } }`) 와 drift smoke 갱신 방식
- [test/load/s2-read.js](../../test/load/s2-read.js) — `1~37 행` (머리 주석, 특히 `9~10 행` "groups / parts 는 각자 축 몫이라 무변경"), `58~64 행` (`SEED_PARAMS` · `TEARDOWN_PARAMS` — **선언은 유지**, parts 가 계속 쓴다), `100~115 행` (`authCookie` 조립), `139~143 행` (groups seed POST), `159~175 행` (`default`), `177~193 행` (`teardown`)
- [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) — 본 변경으로 실측과 어긋나는 기존 단언 (실행 시점에 다시 확인한다):
  - `945 행` `expect(setup.match(/SEED_PARAMS/g)).toHaveLength(4)` — groups seed POST 가 인라인 params 로 바뀌면 **3** 이 된다
  - `1137 행` `expect(script.match(/headers: \{ Cookie: /g)).toHaveLength(3)` — 3 곳 → **6** 곳 (setup persons · setup groups · default persons · default groups · default me · teardown groups)
  - `1164~1171 행` negative (1) "groups · parts GET 은 문자 단위 무변경 — Cookie 잔존 0" — groups 는 이제 cookie 를 싣고 **parts 만** 무변경이다
  - `736~749 행` T-1623 teardown 단언 (`http.del(` 2 회 · `tags: { route: "teardown" }` · `for (let i = 0;` 2 회) 과 `840~852 행` (2) 읽기 tag 등장 2 회 단언 — 본 변경 뒤에도 **그대로 green 이어야 하는** 단언이다 (groups 측정 GET 의 `route: "groups"` 는 1 회 유지)
  - `958~970 행` default 단언 (`http.get(` 4 회 · `S2_ROUTES` 등장 순서 · `me` 가 마지막) — 그대로 green 이어야 한다
- [docs/architecture/api.md](../architecture/api.md) `89~93 행` — groups tier (GET = `User+`, POST · DELETE = `Admin+`)
- [src/user/group.controller.ts](../../src/user/group.controller.ts) — guard 가 아직 없음을 재확인 (**수정 금지**, 읽기만)
- [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) — 부하 job 은 수동 발화 전용이라 본 변경은 상시 CI 의 k6 실행을 유발하지 않는다 (**무변경**)

## Acceptance Criteria

**s2-read.js groups 3 지점 cookie 선탑재**

- [ ] `setup()` 의 groups seed POST 가 공용 `SEED_PARAMS` 대신 인라인 params `{ headers: { "Content-Type": "application/json", Cookie: authCookie }, tags: { route: "seed" } }` 를 쓴다 (tag 는 `seed` 그대로라 `route:groups` p95 표본 오염 0). parts seed POST 는 **문자 단위 무변경** (`SEED_PARAMS` 유지).
- [ ] `default(data)` 의 groups GET 이 `{ headers: { Cookie: data.authCookie }, tags: { route: "groups" } }` 로 cookie 를 싣는다 (persons GET `163~166 행` 과 같은 형태). parts GET 은 **문자 단위 무변경** 이다.
- [ ] `teardown(data)` 의 groups DELETE 가 공용 `TEARDOWN_PARAMS` 대신 `{ headers: { Cookie: data.authCookie }, tags: { route: "teardown" } }` 를 쓴다. parts DELETE 는 `TEARDOWN_PARAMS` 그대로이고, `SEED_PARAMS` · `TEARDOWN_PARAMS` 선언 (`58~64 행`) 도 유지한다.
- [ ] 분기 0 유지 — 스크립트에 `if (` · `} else` · ` ? ` · ` && ` 가 새로 생기지 않는다. 새 `__ENV` 키 · 새 route tag · 임계 (`p(95)<3000` 5 회 · `rate<0.01` 1 회) · `vus: 5` · `duration: "20s"` 변경 0.
- [ ] 주석 갱신: 머리 주석에 `(T-2036)` 단락 1 개 — "guard 배선 선행 (Q-0056 ① groups 축 ④) — groups 3 지점 (seed POST · 측정 GET · 회수 DELETE) 에 인증 cookie 를 선탑재한다. 현재 `group.controller.ts` 는 guard 미부착이라 cookie 는 no-op 이고, ⑤ 가 guard 를 붙이면 401 이 `http_req_failed` 와 `route:groups` p95 를 오염시킨다" 취지. `9~10 행` · `161~162 행` 의 "groups / parts 는 각자 축 몫이라 무변경" 서술은 "parts 는 parts 축 몫이라 무변경" 으로 고친다. 변경 지점마다 `(T-2036)` 주석 1 줄을 둔다.

**drift smoke 갱신 — 기존 단언 갱신만 (신규 `it` · `describe` 0)**

- [ ] 본 slice 는 test 도구 코드 (k6 harness) 를 대상으로 하므로 사용자 지시에 따라 drift smoke 에 **신규 `it` · 신규 `describe` 를 만들지 않는다** (T-2028 선례). 실측과 어긋나게 된 기존 단언만 갱신한다:
  - `945 행` `SEED_PARAMS` 수 `4 → 3` 으로 내리고, 같은 `it` 안에 줄어든 1 건이 groups seed POST 의 인라인 cookie params 임을 단언 1 줄로 못 박는다 (수치만 내리면 cookie 소실이 조용히 통과한다 — T-2023 `942~946 행` 동형).
  - `1137 행` `headers: { Cookie: ` 수 `3 → 6` 으로 올리고 주석의 위치 열거를 6 곳으로 고친다.
  - `1164~1171 행` negative (1) 을 "parts GET 은 문자 단위 무변경 — Cookie 잔존 0 (parts 축 경계 보존)" 으로 좁히고, 같은 `it` 안에 groups GET 이 `headers: { Cookie: data.authCookie }` 와 `tags: { route: "groups" }` 를 같은 호출에 싣는다는 단언을 넣는다. `it` 제목 문자열도 그에 맞게 고친다.
  - 위 3 지점 외에 실행 시점에 red 가 되는 기존 단언이 더 있으면 같은 원칙 (실측 일치 + 대체 단언 동반) 으로 갱신하고, 그 목록을 PR body 에 적는다.
- [ ] 갱신 지점마다 `(T-2036)` 주석 1 줄로 사유를 남긴다. T-1623 teardown 단언 (`736~749 행`) · 읽기 tag 2 회 단언 (`840~852 행`) · default 단언 (`958~970 행`) · T-2023 persons describe (`1092~1220 행`) 의 persons 관련 단언은 **문자 단위 무변경** 으로 green 이어야 한다.

**R-110 / R-112 판정**

- [ ] R-112 (1)~(4) 적용 판정: production 코드 (`src/`) 변경 **0 LOC**, 신규 · 수정 public symbol 0, production 분기 0 인 부하 harness 선탑재다. happy-path · 분기 cover 는 갱신된 drift smoke 단언 (groups 3 지점 cookie 부착 · parts 무변경 · 분기 토큰 0) 이 green 인 것으로 충족한다. error path 는 drift smoke 의 기존 추출기 계약 단언 (`1144~1161 행` — 블록 부재 `null` · non-string `TypeError`, 0-byte 조용한 PASS 차단) 이 그대로 green 인 것으로 충족하며 신규 helper 는 도입하지 않는다. negative 는 ① parts 3 지점 Cookie 잔존 0 (축 경계) ② `Authorization` · `Bearer ` · `eyJ` 리터럴 0 ③ `__ENV.` 2 회 ④ 임계 프로파일 무변경 — 모두 기존 단언 재사용 — 이 green 인 것으로 충족한다. 무 cookie 401 · User cookie 403 은 guard 가 아직 없어 지금 단언할 수 없다 (⑤ 몫).
- [ ] regression (`hqOrigin` Q-0056): 갱신된 `SEED_PARAMS` 3 · `Cookie` 6 · groups GET cookie 단언이 곧 regression 가드다 — 누가 groups cookie 부착을 되돌리면 ⑤ guard 배선 전에 drift smoke 가 먼저 red 가 된다. PR body 에 s2-read.js 의 cookie 부착 3 지점과 갱신한 drift 단언을 파일 · 행 표로 적는다.
- [ ] `pnpm test:smoke` 통과 — 특히 `load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 전 구간 (s1 · s2 · s3 섹션 모두) green 이고 `it` 개수는 변경 전과 **같다**. 실 k6 실행 · 실 HTTP · 부하 job 발화는 0 이다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — production 변경 0 이라 수치 불변.
- [ ] 동작 무변경 경계: `git diff --stat origin/main -- src prisma web test/helpers .github` 가 비어 있고, `git diff --stat` 이 `touchesFiles` 2 파일 이내 · diff ≤ 300 LOC 다.

## Out of Scope

- `src/user/group.controller.ts` guard 실배선 · `group.controller.spec.ts` · e2e 401 · 403 신규 단언 · census `KNOWN_GAP_REQ_043` 축소 — groups 축 ⑤ 몫.
- **s2 bootstrap 자격 tier 상향** (stamp 파생 `User` 계정 → S1 이 만든 bootstrap SuperAdmin 자격) — 아래 Follow-ups 의 별도 선행 slice 몫. 본 slice 는 cookie 부착 위치만 바꾸고 `credentials` 블록 (`100~103 행`) 은 문자 단위 무변경이다.
- `s2-read.js` 의 parts 3 지점 (seed POST · 측정 GET · 회수 DELETE) — parts 축 arc 몫.
- `s1-batch.js` · `s3-concurrent.js` · `.github/workflows/load-k6.yml` · `package.json` 변경, 임계 · `vus` · `duration` · `stages` 변경, 새 route tag, k6 실행 · baseline 재산정.
- [test/perf/README.md](../../test/perf/README.md) · [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) 의 "cookie 없이 측정" 류 서술 정정 — ⑤ 머지 후 doc-only direct slice 로 한 번에 (T-2022 · T-2035 Follow-ups 와 합침).
- `docs/requirements.md` REQ status 재판정 · api.md doc-sync — 3 controller arc 머지 후 REQ 당 1 회 (CLAUDE.md §3.1).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner, arc 계획 — Q-0056 groups 축 잔여) 정본은 [T-2031](T-2031-groups-guard-precursor-cookie-preattach.md) `## Follow-ups`. 본 task 머지로 ④ 의 cookie 부착이 끝난다. 다음은 ⑤ guard 실배선 read 4 route → write 5 route → e2e 401 · 403 (T-2027 · T-2029 · T-2030 선례).
- (planner, ⑤ write 축 착수 전 필수 — T-2028 동형 선행) s2-read.js 의 인증 계정은 stamp 파생 email 이라 이 run 의 첫 user 가 아니므로 **`User` 등급** 이다 ([api.md](../architecture/api.md) `75 행` — `countAll === 0` 일 때만 `SuperAdmin`). groups seed POST · 회수 DELETE 는 write tier (`Admin+`) 라 ⑤ write 축이 머지되는 순간 **403** 으로 바뀐다 (cookie 가 있어도). 그래서 ⑤ write 축 전에 s2 setup 이 `s1-batch.js` · `s3-concurrent.js` 와 같은 bootstrap 자격증명 리터럴로 login 하도록 올리는 slice (`s2-read.js` + drift smoke 2 파일, T-2028 선례 — `945 행` 근처 `stamp` 자격증명 핀 2 개 치환 포함) 를 큐잉한다. 이 상향은 parts 축 write 에도 그대로 쓰인다. read 축 (⑤a) 은 `User` cookie 로 충분하므로 그 앞에 둘 필요는 없다.
- (planner, 미결 — ⑤ 착수 전 확정 필요) api.md groups 표에 tier 행이 없는 4 route 문제는 T-2031 `## Follow-ups` 둘째 항목에 그대로 남아 있다.
- (planner 판정, CLAUDE.md §3 소비처 동반 의무) helper · factory 신설 없음 — 기존 스크립트 1 개의 요청 params 와 기존 drift 단언 수정이다 → 하한 해당 없음.
- (planner 판정, cap) base 110 LOC (s2-read.js: 3 지점 params ~15 + 주석 ~20 · drift spec: 기존 단언 3~4 지점 갱신 + 대체 단언 ~40 + 주석 ~10), test harness 수정이라 multiplier × 1.0 (T-2023 est 150 선례 — 그쪽은 블록 이동 + 신규 `it` 포함이라 본 task 가 더 작다). `estimatedFiles` 2 → cap 안, `sizeExempt` 불요.
