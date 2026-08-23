---
id: T-1661
title: s1-batch.js setup() 의 person 확보를 실 devset dataset 조회로 교체한다
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-047]
estimatedDiff: 275
estimatedFiles: 2
created: 2026-08-23
createdAt: 2026-08-23T11:30:00Z
independentStream: load-r91
dependsOn: [T-1660]
touchesFiles:
  - test/load/s1-batch.js
  - test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts
plannerNote: "R-91 chain 43/N — 워크플로가 적재한 133 인원을 k6 가 실제로 겨냥하게 setup/teardown 교체 + drift smoke."
---

# T-1661 — s1-batch.js setup() 의 person 확보를 실 devset dataset 조회로 교체

## Why

오너 지시 ([PLAN.md](../PLAN.md) `144 행` "R-91 k6 최우선·즉시 착수") chain 의 43 번째 slice 다. 직전 slice T-1660 (main `73100c77`) 이 [`load-k6.yml`](../../.github/workflows/load-k6.yml) `113~122 행` 에 `pnpm seed:devset-logins` step 을 배선해 **부하 대상 DB 에 실 devset 133 인원이 적재되도록** 만들었다. 그런데 정작 k6 스크립트는 그 인원을 **한 명도 쓰지 않는다** — [`s1-batch.js`](../../test/load/s1-batch.js) 의 `setup()` 이 여전히 `POST /api/persons` 로 `배치 부하 대상 <stamp>-<i>` 라는 합성 인원을 직접 만들고, `teardown()` 이 그걸 지운다. 지금 상태로는 seed step 이 채운 133 row 가 부하 판정에 전혀 관여하지 않는, 값비싼 no-op 다.

본 slice 는 그 마지막 연결을 닫는다: `setup()` 이 인원을 **만들지 않고 조회** 해 (`GET /api/persons` → email 이 `@load.devset.test` 로 끝나는 row 만) 표본 인원 수만큼 취하고, `teardown()` 은 그 인원을 **삭제하지 않는다** (워크플로가 적재한 공유 dataset 이라 지우면 다음 run 이 빈 DB 위에서 돈다). 이로써 [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§5` item 5 잔여 ① (실 dataset 축) 의 **소비 경로까지 닫히고**, 남은 것은 실 workflow dispatch 실측 (`§3.1`) 과 진척 doc-sync 뿐이다.

## Required Reading

- [`test/load/s1-batch.js`](../../test/load/s1-batch.js) 전체 (177 행) — 특히 `43~50 행` (tag params 3 종 · `SEED_DELETE_PARAMS`), `118~131 행` (`(c) 표본 인원만큼 평가 대상 person seed` 반복문), `161~170 행` (`teardown` 의 person 회수 반복문). **본 slice 가 바꾸는 지점은 이 셋뿐** — 인증 부트스트랩 (a) · provider 단일-row 왕복 (b) · `options` 임계 · `default()` 는 문자 하나도 건드리지 않는다.
- [`test/helpers/realdata-devset-seed-descriptors.ts`](../../test/helpers/realdata-devset-seed-descriptors.ts) `20~24 행` — `DEVSET_EMAIL_DOMAIN = "load.devset.test"` 와 `toDevsetEmail`. seed 가 만드는 email 형식의 정본이며, k6 쪽 리터럴은 **이 값과 문자 그대로 같아야** 한다 (한쪽만 바뀌면 조회가 0 건이 되어 부하가 조용히 빈 run 이 된다).
- [`src/user/person.controller.ts`](../../src/user/person.controller.ts) `52~56 행` — `GET /api/persons` 는 active 인원 **전량** 을 `Person[]` 로 반환하고 guard 가 없다 (`src/user/person.service.ts` `79~82 행` `findActive`). 즉 cookie 없이도 조회 가능하며 응답 원소에 `id` · `email` 이 들어 있다.
- [`test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts`](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) `1288~1320 행` — 공용 상수·helper (`S1_SCRIPT_REL` · `S1_ROUTES` · `s1Script` · `s1Body`). **helper 재사용이 원칙 — 신설은 최대 1 개**.
- 같은 파일 `1463~1471 행` — T-1631 기존 케이스 "setup 이 seed / auth tag 로 준비하고 teardown 이 seed person 을 전량 회수한다". `http.post` 4 회 단언과 teardown 의 `personIds.length` · `SEED_DELETE_PARAMS` 단언이 **본 slice 로 반드시 깨지는 계약** 이라 같은 commit 에서 새 계약으로 갱신해야 한다 (케이스 삭제 금지 — 단언 방향만 교체).
- 같은 파일 `1682~1699 행` — 기존 negative (5) "조건 분기 로직이 0 이다" (`if (` · `} else` · ` ? ` · ` && ` · ` || (` 부재 + `||` 정확히 2 회) 와 (6) "seed 왕복이 default() 로 새지 않는다". 본 slice 의 새 표현은 **이 두 계약을 회귀시키면 안 된다** (`filter` 콜백 · `slice` · `map` 은 식이라 분기 0 규약 유지).
- 같은 파일 `1473~1496 행` — T-1632 provider 왕복 케이스 (`tags: { route: "seed" }` 2 회 단언 포함). person 조회에 어떤 params 를 쓰느냐가 이 카운트에 영향을 주므로 값을 확인하고 필요한 만큼만 갱신한다.

## Acceptance Criteria

- [ ] `test/load/s1-batch.js` 의 `setup()` (c) 단계가 **person 생성 0** 으로 바뀐다 — `GET ${BASE_URL}/api/persons` 1 회 응답에서 `email` 이 devset 도메인 접미사로 끝나는 원소만 골라 표본 인원 수만큼 취해 `personIds` 를 만든다. 도메인 리터럴은 상수로 선언하고 (`load.devset.test`), 그 옆 주석에 정본 (`test/helpers/realdata-devset-seed-descriptors.ts`) 을 적는다.
- [ ] `setup()` 의 `http.post` 호출이 3 회 (signup · login · provider) 로 줄고, 인증 (a) → provider (b) → person 조회 (c) 순서와 tag 분리 (`seed` / `auth`) 는 그대로 유지된다. `default()` 와 `options` 는 무변경.
- [ ] `teardown()` 이 **person 을 삭제하지 않는다** — 공유 dataset 보존. provider row 회수 1 회만 남기고, 그 결과 쓰이지 않게 된 상수 (`SEED_DELETE_PARAMS`) 는 함께 제거한다 (미사용 선언 잔존 0).
- [ ] 스크립트 머리 주석에 실 dataset 전제 (workflow 의 `pnpm seed:devset-logins` step 이 선행돼야 한다) 를 1~3 줄로 적는다. 단 `// 범위 밖(후속 slice):` 문단의 **리터럴은 무변경** — 기존 T-1631 케이스 (`2017 행`) 회귀 0.
- [ ] drift smoke 에 T-1661 describe 를 T-1660 describe **뒤에 append** 하고, **happy-path** 3+ 케이스: ① `setup()` 이 devset 도메인 접미사로 필터한 `GET /api/persons` 조회를 정확히 1 회 돌고 `personIds` 로 흐른다, ② 도메인 리터럴이 `realdata-devset-seed-descriptors.ts` 의 `DEVSET_EMAIL_DOMAIN` 과 **parity**, ③ `teardown()` 이 provider 회수만 남긴다.
- [ ] **error path** 2+ 케이스: 조회 대상 파일 부재 · 0-byte read 상황에서 신규/기존 helper 가 조용히 PASS 하지 않고 throw 또는 명시적 실패로 드러난다 (기존 helper 의 fail-fast 계약 재사용).
- [ ] **flow / 분기 cover** 2+ 케이스: 표본 인원이 조회 결과보다 많을 때 · 적을 때의 표현이 **같은 식 하나** 로 처리됨 (분기문 0) 을 정규식으로 못 박고, `SAMPLE_PERSONS` 정규화 표현 · 기본값 10 · workflow 주입값 parity 가 회귀 0 임을 확인한다.
- [ ] **negative cases 충분 cover** 4+ 케이스: ① `setup()`·`teardown()` 어디에도 `POST ${BASE_URL}/api/persons` 생성이 남아 있지 않다, ② person `DELETE` (`/api/persons/${`) 가 스크립트 전체에 0 회 — 공유 dataset 삭제 차단, ③ 분기 0 규약 회귀 0 (`if (` · `} else` · ` ? ` 부재 + `||` 카운트 불변), ④ email 도메인이 실 평가 e2e seed 도메인 (`e2e.realdata.test`) 이나 임의 리터럴로 바뀌어 있지 않다, ⑤ `S1_ROUTES` 밖의 임의 route 유입 0.
- [ ] 기존 T-1631 케이스 (`1463~1471 행`) 를 **삭제하지 않고** 새 계약으로 갱신한다 — `http.post` 3 회 · teardown 의 person 회수 부재를 단언하도록 바꾸고, 케이스 제목도 실제 계약과 맞게 다듬는다.
- [ ] `pnpm test -- load-workflow-k6-harness-wiring-drift` 로 해당 spec 전량 green (기존 190 케이스 회귀 0), `pnpm lint` · `pnpm build` · `pnpm test` · `pnpm test:cov` (line ≥ 80% / function ≥ 80%) 전량 통과. `src/` 무변경이라 전역 coverage 수치는 불변이어야 한다.
- [ ] 최종 diff **≤ 300 LOC · 2 파일**. 신규 describe 는 **최대 12 케이스** 로 묶고, 케이스당 단언을 합쳐 라인을 아낀다 (T-1659 298 · T-1660 294 선례가 cap 에 근접했다).

## Out of Scope

- `.github/workflows/load-k6.yml` 변경 일체 — seed step · 툴체인 step · `K6_S1_PERSONS` 주입값은 T-1659/T-1660 이 박은 그대로 둔다 (파일을 늘리면 cap 초과).
- `test/load/s2-read.js` · `test/load/s3-concurrent.js` 의 dataset 교체 — 별도 slice.
- 실 workflow dispatch 실행 및 [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3.1` 실측 기록 · `§5` item 5 진척 doc-sync — 각각 별도 slice (doc 은 direct-mode).
- `scripts/daily-test.sh` 의 leg 추가 — drift-guard smoke 3 종 (T-0791/T-0944/T-0947) 동반 수정이 강제돼 6 파일이 되어 5 파일 cap 을 넘는다 (T-1122 BLOCKED / Q-0054 선례). 계속 Out of Scope.
- `src/` · `package.json` · `prisma/` 변경, 새 dependency 추가, 새 helper 파일 신설.
- `options` 임계 재산정 (외삽 산식 · stub baseline 900ms) 과 `default()` 본문 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## 완료 기록

- **Status: DONE** — 2026-08-23T12:52:47Z (PR **#1329** squash merge → main `499df531`, branch 삭제).
- 결과: [`s1-batch.js`](../../test/load/s1-batch.js) `setup()` (c) 단계를 person 생성 반복문에서 **`GET /api/persons` 1 회 조회 + devset 도메인 접미사 필터 · 표본 수만큼 취하기** 로 교체했다 (`filter` / `slice` / `map` 단일 식 — 분기 0 규약 유지). 도메인 리터럴은 상수로 선언하고 정본 (`test/helpers/realdata-devset-seed-descriptors.ts`) 을 주석에 적었다. `teardown()` 은 provider row 회수 1 회만 남기고 person 삭제를 제거해 **공유 dataset 을 보존** 하며, 쓰이지 않게 된 `SEED_DELETE_PARAMS` 도 함께 지웠다. 머리 주석에 워크플로 `pnpm seed:devset-logins` step 선행 전제 3 줄을 추가했고 `// 범위 밖(후속 slice):` 문단 리터럴 · `options` · `default()` 는 무변경이다.
- 검증: drift-guard smoke 에 T-1661 describe 12 케이스 (happy 3 · error 2 · 분기 2 · negative 5) 를 T-1660 describe 뒤에 append 하고, 본 변경으로 깨지는 기존 T-1631 케이스는 삭제 없이 새 계약 (`http.post` 3 회 · teardown person 회수 부재) 으로 갱신했다. 대상 spec 202 케이스 green (기존 190 회귀 0), 전체 12980 test pass, lint · build · `test:cov` 통과 (line 99.95% / function 100% — `src/` 무변경이라 수치 불변). 최종 diff **+209/-29 · 2 파일** (cap 300 LOC / 2 파일 이내). reviewer round 1 `APPROVE` 를 PR 코멘트로 외화 — §3.3 4-게이트 충족.
- 남은 일 (본 slice Out of Scope 그대로): ① [`s2-read.js`](../../test/load/s2-read.js) · [`s3-concurrent.js`](../../test/load/s3-concurrent.js) 의 dataset 교체, ② 실 workflow dispatch 후 [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3.1` 실측 기록, ③ 같은 문서 `§5` item 5 진척 doc-sync (direct-mode).
