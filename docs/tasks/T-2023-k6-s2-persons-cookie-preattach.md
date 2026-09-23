---
id: T-2023
title: persons guard 배선 선행 4 — k6 s2-read.js persons 요청에 인증 cookie 선탑재
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-043, REQ-045, REQ-048, REQ-073]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-09-22
independentStream: q0056-persons-guard
dependsOn: [T-2022]
touchesFiles:
  [
    test/load/s2-read.js,
    test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts,
  ]
hqOrigin: Q-0056
plannerNote: P5 · Q-0056 ① persons 선행 4 — T-2020 Follow-up ③ k6 중 s2-read.js 만, persons 2 지점 cookie 선탑재
---

# T-2023 — persons guard 배선 선행 4: k6 s2-read.js persons 요청에 인증 cookie 선탑재

## Why

오너가 HQ **Q-0056** 에서 옵션 ① 을 승인했다 (`docs/STATE.json` `humanQuestions` Q-0056 `decision`, 2026-09-14). `api/persons` → `api/groups` → `api/parts` 순으로 기존 `JwtAuthGuard` · `RolesGuard` · `@Roles` 를 배선한다. persons 축의 정본 순서는 [T-2020](T-2020-persons-guard-precursor-cookie-preattach.md) `## Follow-ups` 의 ② perf 선행 → ③ k6 선행 → ④ guard 실배선이다. ② 는 [T-2021](T-2021-perf-mock-boot-guard-override-prep.md) (mock 부트 2 spec) + [T-2022](T-2022-persons-realdb-perf-cookie-preattach.md) (realdb 3 spec) 로 끝났고, 본 task 는 ③ **k6 선행의 첫 조각** 이다.

**③ 을 스크립트 단위로 쪼갠다** (T-2020 Follow-up 이 요구한 "착수 전 drift smoke 짝 개수 재측정" 결과). `/api/persons` 를 타격하는 k6 스크립트는 3 개이고 (`s1-batch.js` `138 행` 1 지점, `s2-read.js` `87` · `142 행` 2 지점, `s3-concurrent.js` `96` · `113` · `123` · `127` · `139 행` 5 지점) 이들을 감시하는 drift-guard 는 [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) **1 개 (5,057 행)** 뿐이다. 세 스크립트를 한 PR 에 담으면 그 guard 의 s1 · s2 · s3 섹션을 동시에 손봐야 하고 (특히 `4320 행` `apiRoutesOf(script)).toEqual(["/api/persons"])` 는 s3 에 signup · login 을 추가하면 곧바로 깨진다) diff 가 cap 을 넘는다. 그래서 스크립트당 1 slice 로 나누고, 본 task 는 **s2-read.js 만** 가져간다 — 셋 중 유일하게 `route:persons` p95 임계로 판정면을 갖는 스크립트다.

**issue-still-relevant 확인** (origin/main `4b78a6e7`): `git grep -c "UseGuards\|@Roles" origin/main -- src/user/person.controller.ts` 가 0 hit 이라 guard 는 아직 없다. `s2-read.js` 는 `122~129 행` 에서 이미 signup → login → `access_token` cookie 를 얻어 `authCookie` 로 return 하지만, 그 cookie 를 쓰는 곳은 `147~150 행` 의 `GET /api/auth/me` 뿐이고 persons 2 지점 (`87 행` setup 표본 조회 · `142 행` 측정 GET) 은 여전히 cookie 없이 나간다. ④ 가 guard 를 붙이면 두 지점이 **401** 이 되어 전역 `http_req_failed` (`rate<0.01`) 와 `route:persons` p95 표본이 동시에 오염된다.

지금은 guard 가 없어 cookie 가 no-op 이므로 본 slice 는 단독 green 으로 머지되고, ④ 시점의 k6 red 요인 중 s2 몫이 미리 제거된다. cookie 획득 배선 자체는 T-1624 가 이미 박제해 두었으므로 새 개념 · 새 `__ENV` 키 · 새 dependency 는 0 이다.

## Required Reading

- `docs/STATE.json` 의 `humanQuestions` Q-0056 `decision` — 오너 승인 원문 · 조건
- [docs/tasks/T-2020-persons-guard-precursor-cookie-preattach.md](T-2020-persons-guard-precursor-cookie-preattach.md) `## Follow-ups` — persons 축 잔여 ②~④ 순서, "③ 착수 전 drift smoke 짝 개수 재측정" 지시, executor 의 과소추정 메모
- [test/load/s2-read.js](../../test/load/s2-read.js) — `18~29 행` (머리 주석 T-1624 · T-1672 서술), `51~57 행` (`SEED_PARAMS` · `TEARDOWN_PARAMS` 선언), `80~92 행` (`setup` 앞머리 — `stamp` → devset persons 조회 → `personIds` 추출 chain), `112~136 행` (인증 부트스트랩 → `accessToken` → `return { ..., authCookie }`), `139~152 행` (`default` — guard-free GET 3 종 + `me` 1 종)
- [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) — 갱신이 필요한 지점이 여기 모여 있다.
  - `437~442 행` `S2_ROUTES` (persons · groups · parts 3 종 tag ↔ 경로) 와 `444~455 행` `GUARDED_PREFIXES`
  - `459~524 행` T-1622 happy-path (`tags: { route: "<tag>" }` 문자열 단언 — cookie 추가와 무관하게 성립해야 한다)
  - `709~735 행` T-1623 happy-path (`setup.match(/http\.post\(/g)).toHaveLength(4)`, `http.get(\`${BASE_URL}/api/persons\`` 정확히 1 회, `S2_PERSON_IDS_CHAIN`)
  - `923~941 행` T-1624 happy-path — **`expect(setup.match(/SEED_PARAMS/g)).toHaveLength(5)` 가 본 변경으로 깨지는 유일한 기존 단언이다**
  - `942~956 행` `default` 단언 (`http.get(` 4 회 · `S2_ROUTES` 등장 순서 · `me` 가 마지막)
  - `975~990 행` `s2Body` 블록 분리 단언 (setup 에 `me` 부재 / default 에 login · signup 부재)
  - `1009~1072 행` negative (1)~(6) — guarded prefix 0 · `/api/users` 1 회 · `Authorization` · `Bearer ` · `eyJ` 0 · 임계 6 종 · `__ENV.` 2 회 · 분기 토큰 (`if (` · `} else` · ` ? ` · ` && `) 0
- [docs/architecture/api.md](../architecture/api.md) `79~83 행` — persons 5 route tier (GET 2 = `User+`)
- [src/user/person.controller.ts](../../src/user/person.controller.ts) — guard 가 아직 없음을 재확인 (본 task 에서 **수정 금지**)
- [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) — 부하 job 은 `workflow_dispatch` 수동 발화 전용이라 본 변경은 상시 CI 의 k6 실행을 유발하지 않는다 (workflow 는 **무변경**)

## Acceptance Criteria

- [ ] `test/load/s2-read.js` `setup()` 의 인증 부트스트랩 블록 (`112~129 행` — 주석 · `credentials` · `POST /api/users` · `POST /api/auth/login` · `accessToken`) 을 devset persons 조회 (`87 행`) **앞** 으로 옮기고, `const authCookie = \`access_token=${accessToken}\`;` 를 지역 const 로 뽑아 `return` 의 `authCookie:` 가 그 const 를 재사용한다. 이동 후에도 `stamp` 선언은 블록보다 앞에 있다.
- [ ] `setup()` 의 persons 표본 조회가 cookie 를 싣는다 — `http.get(\`${BASE_URL}/api/persons\`, { headers: { Cookie: authCookie }, tags: { route: "seed" } })` 형태. `route: "seed"` tag 는 유지해 `route:persons` p95 표본이 오염되지 않는다.
- [ ] `default(data)` 의 persons GET (`142 행`) 이 `{ headers: { Cookie: data.authCookie }, tags: { route: "persons" } }` 로 cookie 를 싣는다. `groups` · `parts` GET 은 **문자 단위 무변경** 이다.
- [ ] 머리 주석에 본 slice 의 근거 1 단락을 추가한다 — "(T-2023) guard 배선 선행 (Q-0056 ④) — persons 2 지점에 인증 cookie 를 선탑재한다. 현재 `person.controller.ts` 는 guard 미부착이라 cookie 는 no-op 이고, ④ 가 guard 를 붙이면 401 이 `http_req_failed` 와 `route:persons` p95 를 오염시킨다" 취지. 기존 "guard-free 목록 GET 3 종뿐이다" 서술 (`7~9 행`) 은 persons 가 곧 guarded 가 된다는 사실과 어긋나므로 같은 취지로 갱신한다.
- [ ] drift-guard 갱신: `load-workflow-k6-harness-wiring-drift.smoke-spec.ts` `931 행` 의 `expect(setup.match(/SEED_PARAMS/g)).toHaveLength(5)` 를 `4` 로 내리고, 줄어든 1 건이 cookie params 로 바뀐 persons 조회임을 단언으로 못 박는다 (`setup` 이 `headers: { Cookie: authCookie }` 와 `tags: { route: "seed" }` 를 같은 호출에 담는다). 수치만 내리고 대체 단언을 안 두면 안 된다.
- [ ] happy-path 신규 단언 (public 관찰면 = 스크립트 소스): ① `default` 의 persons GET 이 `headers: { Cookie: data.authCookie }` + `tags: { route: "persons" }` 를 함께 싣는다. ② `setup` 안에서 login 획득이 persons 조회보다 **앞** 에 온다 (`indexOf` 비교 — 순서가 역전되면 `authCookie` 가 TDZ 로 깨진다). ③ `authCookie` 지역 const 가 `return` 과 setup 내부 두 곳에서 쓰인다.
- [ ] error path 단언 1+: 새 단언이 쓰는 추출기 (`s2Body` · `s2Script`) 의 블록 부재 → `null` / non-string → `TypeError` 계약이 유지됨을 확인한다 (`991~1007 행` 기존 단언 재사용으로 충족되면 그 사실을 PR body 에 적고 신규 helper 는 도입하지 않는다). 0-byte read 가 조용히 PASS 하지 않아야 한다.
- [ ] 분기 cover: 본 변경은 k6 스크립트에 분기를 추가하지 않는다 — negative (6) 의 `["if (", "} else", " ? ", " && "]` 잔존 0 단언이 그대로 green 임을 확인한다. guard spec 쪽 신규 단언도 분기 없는 문자열 대조뿐이다.
- [ ] negative (예외 분기마다 1+): ① `groups` · `parts` GET 에 `Cookie` 잔존 0 (persons 축 경계 보존 — groups · parts 는 각자 arc 몫). ② `Authorization` · `Bearer ` · `eyJ` 리터럴 0 유지 (토큰은 run 시점 login 으로만 획득). ③ `__ENV.` 등장 2 회 유지 (새 env 키 0). ④ 임계 6 종 · `p(95)<3000` 5 회 · `rate<0.01` 1 회 · `vus: 5` · `duration: "20s"` 무변경. ⑤ 합성 mutation 대조군 — persons GET 의 `headers: { Cookie: ... }` 를 제거한 문자열이 새 단언을 fail 시킨다. ⑥ 합성 mutation 대조군 — login 획득을 persons 조회 뒤로 되돌린 문자열이 순서 단언을 fail 시킨다.
- [ ] regression (hqOrigin Q-0056): 위 ⑤ ⑥ 두 mutation 단언이 곧 regression 가드다. 누가 cookie 부착이나 순서 이동을 되돌리면 ④ guard 배선 전에 이 smoke spec 이 먼저 red 가 된다. PR body 에 s2-read.js 의 cookie 부착 2 지점 · 이동된 블록 범위를 파일 · 행 표로 적는다.
- [ ] `pnpm test:smoke` 통과 — 특히 `load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 전 구간 (s1 · s2 · s3 섹션 모두) green 이고 it 개수는 신규 단언만큼만 늘어난다. 실 k6 실행 · 실 HTTP · 실 GitHub Actions 발화는 0 이다.
- [ ] R-110: `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — production 변경 0 LOC 이라 수치는 불변이어야 한다.
- [ ] 동작 무변경 경계: `git diff --stat origin/main -- src prisma web test/helpers .github` 가 비어 있고, `git diff --stat` 이 `touchesFiles` 2 파일 이내다.

## Out of Scope

- `test/load/s1-batch.js` (`138 행` 1 지점) · `test/load/s3-concurrent.js` (`96` · `113` · `123` · `127` · `139 행` 5 지점 + 인증 부트스트랩 신설) — ③ 의 남은 두 조각이라 별도 slice (Follow-ups).
- `src/user/person.controller.ts` guard 실배선 · `person.controller.spec.ts` guard metadata 단언 · `persons.e2e-spec.ts` 401/403 단언 · census `KNOWN_GAP_REQ_043` 축소 · `person-measure-confirm-realdb.perf-spec.ts` 의 cookie-less 200 단언 flip — persons **마지막** slice (④) 몫.
- `s2-read.js` 의 `groups` · `parts` GET 에 cookie 부착 — groups · parts 축 arc 몫 (같은 파일이지만 축 경계를 지킨다).
- `.github/workflows/load-k6.yml` · `package.json` 의 `test:load:s2` · `__ENV` 키 · 임계값 (`p(95)<3000` · `rate<0.01`) · `vus` · `duration` · `stages` 변경.
- k6 실행 · 부하 job 발화 · baseline 수치 재산정 · 새 route tag 추가.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) 와 [test/perf/README.md](../../test/perf/README.md) 의 "cookie 없이 측정" · "인증 노이즈 0" 서술 갱신 — ④ 머지 후 doc-only direct slice 로 한 번에 (T-2022 Follow-ups 와 합침).
- `docs/requirements.md` REQ status 재판정 — arc 머지 후 REQ 당 1 회 (CLAUDE.md §3.1 규칙 6).
- "API localhost 외 차단" — 오너가 철회했다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner, arc 계획 — Q-0056 persons 축 잔여) ③ 의 남은 두 조각을 순서대로 큐잉한다.
  - ③b **s1-batch.js**: `138 행` persons 표본 조회에 cookie 부착 (`authCookie` 는 `101 행` 에서 이미 획득돼 순서 이동 불요). guard spec `3731 행` `expect(setup).toContain("/api/persons\`, SEED_PARAMS)")` 와 `1645 행` 이하 negative 섹션이 함께 갱신 대상이다 (2 파일).
  - ③c **s3-concurrent.js**: 인증 부트스트랩이 아예 없어 signup → login → cookie 를 신설하고 persons 5 지점에 싣는다. guard spec `4320 행` `expect(apiRoutesOf(script)).toEqual(["/api/persons"])` 가 `/api/users` · `/api/auth/login` 추가로 깨지므로 그 단언의 재정의를 같은 PR 에 담는다 (2 파일, 셋 중 가장 큰 조각 — 추정치를 넉넉히 잡는다).
  - 그 뒤 ④ persons guard 실배선. 정본 순서는 [T-2020](T-2020-persons-guard-precursor-cookie-preattach.md) `## Follow-ups`.
