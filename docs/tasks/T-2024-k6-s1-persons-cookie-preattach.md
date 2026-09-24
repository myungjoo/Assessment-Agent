---
id: T-2024
title: persons guard 배선 선행 5 — k6 s1-batch.js persons 표본 조회에 인증 cookie 선탑재
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-043, REQ-045, REQ-048, REQ-073]
estimatedDiff: 180
estimatedFiles: 2
created: 2026-09-24
independentStream: q0056-persons-guard
dependsOn: [T-2023]
touchesFiles:
  [
    test/load/s1-batch.js,
    test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts,
  ]
hqOrigin: Q-0056
plannerNote: P5 · Q-0056 ① persons 선행 5 — T-2023 Follow-up ③b, s1-batch.js persons 1 지점 cookie 선탑재
---

# T-2024 — persons guard 배선 선행 5: k6 s1-batch.js persons 표본 조회에 인증 cookie 선탑재

## Why

오너가 HQ **Q-0056** 에서 옵션 ① 을 승인했다 (`docs/STATE.json` `humanQuestions` Q-0056 `decision`, 2026-09-14). `api/persons` → `api/groups` → `api/parts` 순으로 기존 `JwtAuthGuard` · `RolesGuard` · `@Roles` 를 배선한다. persons 축의 정본 순서는 [T-2020](T-2020-persons-guard-precursor-cookie-preattach.md) `## Follow-ups` 의 ② perf 선행 → ③ k6 선행 → ④ guard 실배선이다. ② 는 [T-2021](T-2021-perf-mock-boot-guard-override-prep.md) + [T-2022](T-2022-persons-realdb-perf-cookie-preattach.md) 로 끝났고, ③ 은 [T-2023](T-2023-k6-s2-persons-cookie-preattach.md) 이 `s2-read.js` 를 가져갔다. 본 task 는 T-2023 `## Follow-ups` 이 박제한 **③b — `s1-batch.js`** 조각이다.

세 k6 스크립트를 한 PR 에 담지 않고 스크립트당 1 slice 로 쪼갠 이유는 셋을 감시하는 drift-guard 가 [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) **1 개 (5,207 행)** 뿐이라 동시 개정 시 cap 을 넘기 때문이다 (T-2023 `## Why` 근거 그대로).

**issue-still-relevant 확인** (origin/main `1967c8e3`): `git grep -c "UseGuards\|@Roles" origin/main -- src/user/person.controller.ts` 가 0 hit 이라 guard 는 아직 없다. `s1-batch.js` 는 `94~101 행` 에서 이미 signup → login → `authCookie` 를 얻고 provider seed 3 왕복 (`106` · `110 행`) · 측정 배치 POST (`175 행`) · teardown DELETE (`186 행`) 에 그 cookie 를 싣지만, **`138 행` 의 persons 표본 조회만 `SEED_PARAMS` (cookie 없음) 로 나간다**. ④ 가 guard 를 붙이면 이 조회가 401 이 되어 `personIds` 가 빈 배열이 되고, 배치 POST 가 빈 `rawBridges` 로 돌아 S1 run 전체가 조용히 무의미한 측정이 된다 (`http_req_failed` `rate<0.01` 위반까지 동반).

s2 (T-2023) 와 달리 **순서 이동이 필요 없다** — `authCookie` 획득 (`101 행`) 이 persons 조회 (`138 행`) 보다 이미 앞선다. 바꿀 것은 params 1 개와 그로 인해 미사용이 되는 `SEED_PARAMS` 선언 정리, 그리고 그 둘을 못 박은 drift 단언뿐이다. 새 개념 · 새 `__ENV` 키 · 새 dependency 는 0 이다.

## Required Reading

- `docs/STATE.json` 의 `humanQuestions` Q-0056 `decision` — 오너 승인 원문 · 조건
- [docs/tasks/T-2023-k6-s2-persons-cookie-preattach.md](T-2023-k6-s2-persons-cookie-preattach.md) `## Follow-ups` ③b — 본 slice 의 범위 지정 (대상 행 · 함께 갱신할 guard 단언)
- [docs/tasks/T-2020-persons-guard-precursor-cookie-preattach.md](T-2020-persons-guard-precursor-cookie-preattach.md) `## Follow-ups` — persons 축 ②~④ 정본 순서
- [test/load/s1-batch.js](../../test/load/s1-batch.js) — `14~21 행` (머리 주석 T-1661 실 dataset 전제 · 규약 승계 문단), `55~59 행` (`JSON_HEADERS` · `SEED_PARAMS` · `AUTH_PARAMS` 선언), `85~101 행` (인증 부트스트랩 → `authCookie`), `102~112 행` (`providerParams` · `providerDeleteParams` — 목표 params 형태의 선례), `133~145 행` (persons 표본 조회 → `personIds` chain), `180~188 행` (teardown)
- [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) — 갱신 대상이 아래 3 좌표에 모여 있다.
  - `1575 행` describe (T-1631 s1 골격) 중 `1639~1650 행` — **`expect(setup).toMatch(/AUTH_PARAMS[\s\S]*authCookie =[\s\S]*SEED_PARAMS/)` 가 본 변경으로 깨지는 첫 단언** (setup 에서 `SEED_PARAMS` 가 사라진다)
  - 같은 describe `1652~1663 행` (T-1632) — **`expect(setup.match(/tags: \{ route: "seed" \}/g)).toHaveLength(2)` 가 깨지는 둘째 단언** (inline params 추가로 3 이 된다) + `expect(setup).toContain("Cookie: authCookie")`
  - `3465 행` describe (T-1661 실 devset 조회 교체) 중 `3467~3480 행` happy-path ①, `3493~3503 행` ③ teardown 부재 단언, `3560~3600 행` negative ①~④ (person 생성 POST 0 · `/api/persons/` 0 · 분기 토큰 0 · 도메인 parity)
  - `1099 행` describe (T-2023 s2 persons cookie) — **본 task 가 따를 describe 구조 · 단언 구성의 선례**
- [docs/architecture/api.md](../architecture/api.md) `79~83 행` — persons 5 route tier (GET 2 = `User+`)
- [src/user/person.controller.ts](../../src/user/person.controller.ts) — guard 가 아직 없음을 재확인 (본 task 에서 **수정 금지**)
- [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) — 부하 job 은 `workflow_dispatch` 수동 발화 전용이라 본 변경은 상시 CI 의 k6 실행을 유발하지 않는다 (workflow 는 **무변경**)

## Acceptance Criteria

- [ ] `test/load/s1-batch.js` `138 행` 의 persons 표본 조회가 cookie 를 싣는다 — `http.get(\`${BASE_URL}/api/persons\`, { headers: { Cookie: authCookie }, tags: { route: "seed" } })` 형태 (같은 파일 `110~112 행` `providerDeleteParams` 와 동형). `route: "seed"` tag 는 유지해 `batch` 임계 표본이 오염되지 않는다.
- [ ] 그 결과 미사용이 되는 `const SEED_PARAMS` 선언 (`57 행`) 을 제거한다. `JSON_HEADERS` 는 `AUTH_PARAMS` 가 계속 쓰므로 남긴다. `git grep -c "SEED_PARAMS" test/load/s1-batch.js` 가 0 이고 `pnpm lint` 가 미사용 변수로 red 가 되지 않는다.
- [ ] `authCookie` 획득이 persons 조회보다 앞선다는 순서 전제는 **기존 코드 그대로** 다 — 블록 이동 · 변수 재배치를 하지 않는다 (s2 와 다른 점).
- [ ] 머리 주석에 본 slice 의 근거 1 단락을 추가한다 — "(T-2024) guard 배선 선행 (Q-0056 ④) — persons 표본 조회에 인증 cookie 를 선탑재한다. 현재 `person.controller.ts` 는 guard 미부착이라 cookie 는 no-op 이고, ④ 가 guard 를 붙이면 401 → `personIds` 빈 배열 → 빈 배치 측정이 된다" 취지. `14~16 행` 의 실 dataset 전제 서술과 모순되지 않게 잇는다.
- [ ] drift-guard 갱신 (1) — T-1631 `1644 행` 부근의 `/AUTH_PARAMS[\s\S]*authCookie =[\s\S]*SEED_PARAMS/` 순서 단언을 **삭제하지 말고 재정의** 한다: `AUTH_PARAMS` → `authCookie =` → persons 조회 (`/api/persons`) 순서를 같은 강도로 못 박는다. 단순히 단언을 지우면 안 된다.
- [ ] drift-guard 갱신 (2) — T-1632 `1660 행` 부근 `expect(setup.match(/tags: \{ route: "seed" \}/g)).toHaveLength(2)` 를 `3` 으로 올리고, 늘어난 1 건이 persons 조회의 cookie params 임을 단언으로 못 박는다 (수치만 올리고 대체 단언을 안 두면 안 된다).
- [ ] happy-path 신규 단언 (public 관찰면 = 스크립트 소스, T-2023 의 `1099 행` describe 구조를 따른다): ① `setup` 의 persons GET 이 `headers: { Cookie: authCookie }` 와 `tags: { route: "seed" }` 를 **같은 호출** 에 담는다. ② `setup` 안에서 login cookie 획득 (`authCookie =`) 이 persons 조회보다 앞선다 (`indexOf` 비교 — 역전 시 TDZ 로 깨진다). ③ `authCookie` 가 setup 안 provider 2 params · persons params · `return` 에서 재사용되고 새 cookie 변수를 만들지 않는다.
- [ ] error path 단언 1+: 새 단언이 쓰는 추출기 (`s1Body` · `s1Script`) 의 블록 부재 → throw, 0-byte / 선언 부재 → `null`, non-string → `TypeError` 계약이 유지됨을 확인한다. 기존 `3505~3530 행` 단언 재사용으로 충족되면 그 사실을 PR body 에 적고 신규 helper 는 도입하지 않는다. 0-byte read 가 조용히 PASS 하지 않아야 한다.
- [ ] 분기 cover: 본 변경은 k6 스크립트에 분기를 추가하지 않는다 — T-1661 negative ③ 의 `["if (", "} else", " ? ", " && ", " || ("]` 잔존 0 과 `script.match(/\|\|/g)` 길이 2 단언이 그대로 green 임을 확인한다. 신규 spec 단언도 분기 없는 문자열 대조뿐이다.
- [ ] negative (예외 분기마다 1+): ① `SEED_PARAMS` 리터럴이 `s1-batch.js` 전체에 잔존 0 (선언 · 사용 모두). ② persons **생성** POST · `/api/persons/` DELETE 잔존 0 유지 (공유 dataset 보존 — T-1661 negative ① ② 그대로). ③ `Authorization` · `Bearer ` · `eyJ` 리터럴 0 유지 (토큰은 run 시점 login 으로만 획득). ④ `__ENV` 키 2 종 · `BATCH_P95_MS` 산식 · `STUB_BASELINE_P95_MS` · `http_req_failed: ["rate<0.01"]` 무변경. ⑤ 합성 mutation 대조군 — persons GET 의 `headers: { Cookie: ... }` 를 제거한 문자열이 새 단언을 fail 시킨다. ⑥ 합성 mutation 대조군 — persons GET 의 `tags: { route: "seed" }` 를 `"batch"` 로 바꾼 문자열이 tag 오염 단언을 fail 시킨다.
- [ ] regression (hqOrigin Q-0056): 위 ⑤ ⑥ mutation 단언이 regression 가드다. 누가 cookie 부착이나 seed tag 를 되돌리면 ④ guard 배선 전에 이 smoke spec 이 먼저 red 가 된다. PR body 에 `s1-batch.js` 의 변경 2 지점 (조회 params · `SEED_PARAMS` 제거) 을 파일 · 행 표로 적는다.
- [ ] `pnpm test:smoke` 통과 — 특히 `load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 전 구간 (s1 · s2 · s3 섹션 모두) green 이고 it 개수는 신규 단언만큼만 늘어난다. 실 k6 실행 · 실 HTTP · 실 GitHub Actions 발화는 0 이다.
- [ ] R-110: `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — production 변경 0 LOC 이라 수치는 불변이어야 한다.
- [ ] 동작 무변경 경계: `git diff --stat origin/main -- src prisma web test/helpers .github package.json` 이 비어 있고, `git diff --stat` 이 `touchesFiles` 2 파일 이내다.

## Out of Scope

- `test/load/s3-concurrent.js` (`96` · `113` · `123` · `127` · `139 행` 5 지점 + 인증 부트스트랩 신설) — ③ 의 마지막 조각 ③c, 별도 slice (Follow-ups).
- `test/load/s2-read.js` — T-2023 이 이미 닫았다. 재-touch 0.
- `src/user/person.controller.ts` guard 실배선 · `person.controller.spec.ts` guard metadata 단언 · `persons.e2e-spec.ts` 401/403 단언 · census `KNOWN_GAP_REQ_043` 축소 · `person-measure-confirm-realdb.perf-spec.ts` 의 cookie-less 200 단언 flip — persons **마지막** slice (④) 몫.
- `s1-batch.js` 의 provider seed · 배치 POST · teardown params — 이미 cookie 를 싣고 있어 무변경.
- `.github/workflows/load-k6.yml` · `package.json` 의 `test:load:s1` · `__ENV` 키 · 임계값 (`BATCH_P95_MS` 산식 · `rate<0.01` · `STUB_BASELINE_P95_MS`) · `vus` · `duration` · `stages` 변경.
- k6 실행 · 부하 job 발화 · baseline 수치 재산정 · 새 route tag 추가 · `SAMPLE_PERSONS` 기본값 변경.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) 와 [test/perf/README.md](../../test/perf/README.md) 의 "cookie 없이 측정" · "인증 노이즈 0" 서술 갱신 — ④ 머지 후 doc-only direct slice 로 한 번에 (T-2022 · T-2023 Follow-ups 와 합침).
- `docs/requirements.md` REQ status 재판정 — arc 머지 후 REQ 당 1 회 (CLAUDE.md §3.1 규칙 6).
- "API localhost 외 차단" — 오너가 철회했다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner, arc 계획 — Q-0056 persons 축 잔여) 본 task 머지 후 ③ 의 마지막 조각 **③c `s3-concurrent.js`** 를 큐잉한다: 인증 부트스트랩이 아예 없어 signup → login → cookie 를 신설하고 persons 5 지점에 싣는다. drift guard `4470 행` `expect(apiRoutesOf(script)).toEqual(["/api/persons"])` 가 `/api/users` · `/api/auth/login` 추가로 깨지므로 그 단언 재정의를 같은 PR 에 담는다 (2 파일, 셋 중 가장 큰 조각 — 추정치를 넉넉히 잡는다). 그 뒤 ④ persons guard 실배선. 정본 순서는 [T-2020](T-2020-persons-guard-precursor-cookie-preattach.md) `## Follow-ups`.
