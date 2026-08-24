---
id: T-1682
title: S3 동시 부하 leg 에 persons 행 수 로그를 배선하고 drift-guard 단언을 같은 commit 에서 갱신
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-08-25
createdAt: 2026-08-25T00:10:00Z
independentStream: load-harness-r91
dependsOn: []
touchesFiles:
  - test/load/s3-concurrent.js
  - test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts
plannerNote: PLAN 141 행 R-91 chain 62/N — T-1681 Follow-up ②(S3 leg 표본/행 수 로그 배선), 코드+guard spec 2 파일 같은 commit
---

# T-1682 — S3 동시 부하 leg 에 persons 행 수 로그를 배선하고 drift-guard 단언을 같은 commit 에서 갱신

## Why

[T-1681](T-1681-s1-12th-measurement-recovery.md) 이 승계한 Follow-up ② 다. 현재 S3 leg([test/load/s3-concurrent.js](../../test/load/s3-concurrent.js))는 **행 수를 직접 찍는 로그가 하나도 없어**, 계획 문서가 두 군데에서 같은 공백을 명시적으로 이월해 뒀다 — `#### S2 2 회차` 의 "공유 dataset 보존 계약 검증" 은 `data_received` 221 MB 라는 **정황**만으로 133 행 잔존을 추정할 수 있을 뿐 "직접 검증은 S3 leg 에 표본 로그를 심는 별도 slice 소관" 이라 적었고, `#### S3 1 회차` 의 "write leg 자기정리 확인" 도 `http_reqs`(22752) = `iterations`(7584) × 3 이라는 **간접 증거**만 남기고 "잔여 row 수를 직접 세는 로그는 없으므로 '잔여 0' 을 단정하지는 않는다" 로 끝났다. 본 slice 는 S1(T-1666) · S2(T-1672) 가 이미 쓴 **로그 1 줄 배선 선례**를 S3 에 그대로 옮겨, 다음 dispatch 부터 ① S3 시작 시점의 `GET /api/persons` **행 수**(= S2 teardown 뒤 공유 dataset 보존 여부)와 ② S3 종료 시점의 **행 수**(= iteration 자기 정리 후 잔여)를 run log 에서 **직접 회수**할 수 있게 한다. 새 dispatch 는 하지 않는다 — 본 slice 의 산출물은 배선뿐이고 수치 회수는 다음 측정 slice 소관이다.

## Required Reading

- [test/load/s3-concurrent.js](../../test/load/s3-concurrent.js) **전문 58 행** — 편집 대상. 현재 `setup()` · `teardown()` 이 **둘 다 없고** `export default function` 하나뿐이라는 사실, 머리 주석의 규약 ①~⑤(특히 ⑤ **조건 분기 로직 0**), `WRITE_PARAMS` / `DELETE_PARAMS` / `READ_PARAMS` 의 route tag 분리 방식, `options.thresholds` 4 종을 확인한다.
- [test/load/s2-read.js](../../test/load/s2-read.js) `49~56 행`(`SEED_PARAMS` · `TEARDOWN_PARAMS` — 판정 route tag 와 **겹치지 않는 별도 tag** 로 준비 왕복의 지표 오염을 차단하는 방식) 과 `75~98 행`(`setup()` 의 조회 → 필터 → `console.log` 1 줄 배선, 분기 0 규약을 지킨 단일 식 chain). **본 slice 가 그대로 옮겨 쓸 서식의 정본**이며 이 파일은 **편집하지 않는다**.
- [test/load/s1-batch.js](../../test/load/s1-batch.js) `138~144 행` — T-1666 이 심은 로그 1 줄의 주석 톤(무엇을 왜 직접 찍는지, 민감값 미출력, 분기 없이 매 run 1 회). **읽기만 한다.**
- [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) `1082~1306 행` — S3 drift-guard 정본. 특히 `S3_THRESHOLD_KEYS`(4 종 · 선언 순서 그대로 `toEqual`), `s3Body("export default function")`, `stageSeconds()`(`duration: "\d+s"` 전역 매치), negative `(4)` 의 **금지 토큰 목록**(`"/api/users"`, `"Authorization"`, `"if ("`, `"} else"`, `" ? "`, `" && "`, `GUARDED_PREFIXES`), negative `(6)` 의 임계 mutation 대조군. 본 slice 의 추가 코드가 이 단언들을 **하나도 깨지 않아야** 한다.
- [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) 안의 `describe("s1-batch.js 표본 인원 수 로그 배선 drift smoke (T-1666)")` 블록 — 같은 성격의 로그 배선을 어떤 4 종(happy / error / flow / negative) 으로 감쌌는지의 본보기. 새 describe 는 이 구조를 승계한다.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `979~1030 행` `#### S3 1 회차` — 본 배선이 메우려는 공백("잔여 row 수를 직접 세는 로그는 없으므로 … 단정하지는 않는다") 과 `http_reqs` **22752** = `iterations` **7584** × 3 관계식. **문서는 읽기만 하고 이 slice 에서 편집하지 않는다.**

## Acceptance Criteria

- [ ] [test/load/s3-concurrent.js](../../test/load/s3-concurrent.js) 에 `export function setup()` 과 `export function teardown(...)` 를 각각 **1 개씩** 추가한다. 각 함수는 `GET /api/persons` 를 **정확히 1 회**씩 호출해 응답 배열 길이를 세고, `console.log` 를 **각 1 회**씩 남긴다. 로그 문자열은 grep 가능한 고정 prefix(예: `[s3-concurrent] persons 행 수`)로 시작하고 **수치만** 싣는다 — teardown 줄은 **종료 행 수와 시작 행 수 두 값**을 함께 담아 한 줄로 잔여 판정이 되게 한다(시작값은 `setup()` 반환값으로 넘긴다). email 원문 · cookie · 자격증명 · `/api/` 경로 리터럴은 **출력 금지**.
- [ ] 두 왕복의 route tag 는 판정 tag `read` / `write` 와 **겹치지 않는 별도 이름**(s2-read 의 `seed` / `teardown` 동형)을 쓴다. 이로써 `http_req_duration{route:read}` · `{route:write}` p95 는 준비/정리 왕복에 오염되지 않는다. `options.thresholds` 는 **4 종 · 선언 순서 · 값(`p(95)<3000` 3 회 · `rate<0.01` 1 회) 모두 무변경** — 새 tag 용 임계를 **추가하지 않는다**.
- [ ] **규약 ⑤ 분기 0 유지** — 추가 코드에 `if (` · `} else` · ` ? ` · ` && ` · `Authorization` · guarded prefix 가 **0** 이다(단일 식 chain 으로만 작성). `pnpm test` 로 기존 negative `(4)` 케이스가 그대로 green 임을 확인한다.
- [ ] `export default function` 본문 · `stages` 3 단 · `options` · 머리 주석의 규약 ①~⑤ 문장은 **무변경**(setup 반환값을 받는 파라미터 추가는 허용). 총 stage 지속시간 40s 이내 단언도 그대로 green.
- [ ] 본 배선이 `http_reqs` 항등식을 **`3 × iterations` → `3 × iterations + 2`** 로 바꾼다는 사실을 스크립트 주석 **1~2 줄**(한국어)로 박제한다 — `#### S3 1 회차` 가 자기정리 판정 근거로 쓴 배수 관계를 다음 회차 분석자가 그대로 적용하다 오판하는 것을 막는다.
- [ ] [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) **끝에** `describe("s3-concurrent.js persons 행 수 로그 배선 drift smoke (T-1682)")` 를 **최대 12 케이스**로 append 하고 아래 4 종을 모두 cover 한다:
  - **happy-path (1+)** — `setup()` · `teardown()` 이 각각 실재하고, 각 본문에 `http.get(` 1 회 + `console.log` 1 회가 있으며, 두 로그 문자열이 고정 prefix 로 시작하고 teardown 줄이 **두 수치**(종료 · 시작)를 참조한다. 준비/정리 route tag 리터럴이 `read` / `write` 와 다른 이름임도 단언.
  - **error path (1+)** — 정본 경로 오탈자 read 는 throw, 없는 블록 추출(`s3Body("export function nonexistent")`)이 **조용히 PASS 하지 않고** throw, 빈 문자열 입력은 `null` 또는 `[]`, non-string 입력은 `TypeError`(0-byte false-PASS 차단 — 기존 helper 계약 승계).
  - **flow / 분기 cover (1+)** — 행 수 산출 식을 **스크립트와 같은 식**으로 합성 배열에 적용해 ① 행 133 개 ② 행 1 개 ③ **빈 배열(0 건)** 세 경우의 로그 수치가 각각 133 / 1 / 0 이 됨을 실 k6 실행 0 으로 동치 검증한다(빈 DB 위 false-PASS 가 로그에서 드러남을 증명).
  - **negative cases 충분 cover (각 1+)** — ① `console.log` 총 등장 수가 정확히 2 이고 `export default function` 본문으로 **새지 않는다**(iteration 마다 찍혀 로그가 폭증하는 회귀 차단) ② 로그 문자열에 `password` · `cookie` · `authCookie` · `apiKey` · `credentials` · `@` 도메인 원문 토큰 유입 0 ③ 로그 문자열에 `/api/` 경로 리터럴 유입 0 ④ 분기 토큰 0 규약 회귀 0 ⑤ `thresholdKeys(script)` 가 여전히 4 종 · 순서 그대로여서 새 tag 용 임계가 몰래 추가되지 않았다 ⑥ 준비/정리 tag 가 `read` 또는 `write` 로 합쳐지는 **합성 mutation** 에서 단언이 실제로 깨진다.
- [ ] 새 케이스는 **합성 mutation 대조군을 1+ 포함**한다 — 원본은 통과하고 mutate 한 문자열에서는 단언이 깨지는 것을 같은 test 안에서 보여 tautology 가 아님을 증명한다(T-1661 / T-1666 선례).
- [ ] 기존 S3 describe(T-1625) 의 단언이 본 변경으로 깨지면 **삭제하지 말고** 새 계약으로 갱신한다(무엇이 왜 바뀌었는지 한국어 주석 1 줄 동반). 깨지지 않으면 무변경.
- [ ] `pnpm lint && pnpm build` green.
- [ ] `pnpm test` green — 대상 smoke spec 의 기존 케이스 회귀 0(기존 개수 + 신규 개수 전부 pass), 전체 suite 회귀 0.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). `src/` 무변경이라 전역 coverage 수치는 불변이어야 하며, 달라지면 그 사유를 PR 본문에 적는다.
- [ ] 변경 파일 **2 개**(`test/load/s3-concurrent.js` · `test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts`), diff ≤ 300 LOC 유지. 3 번째 파일이 필요하다고 판단되면 Follow-ups 로 넘긴다.

## Out of Scope

- **워크플로 dispatch 일체** — `gh workflow run` · rerun 0. 본 slice 는 배선만 하고 수치 회수는 다음 측정 slice 소관이다.
- `.github/workflows/load-k6.yml` · `package.json` 의 `test:load:s3` 변경(경로 · step 순서 · env 무변경).
- `docs/ops/load-resilience-test-plan.md` 편집 — `§2` S3 설계 · `§3.1` 회차 소절 · `http_reqs` 배수 관계 서술의 doc 동기화는 **별도 direct slice**(Follow-ups ①).
- `test/load/s1-batch.js` · `test/load/s2-read.js` · `test/load/smoke.js` 변경(읽기만).
- `§3` 임계 표 값 · S3 thresholds 4 종 · stages 프로파일 재산정(표본 1 회로는 근거 0 — T-1668 2 단계 규칙 승계).
- `K6_SEED_PERSONS` 30 → 133 상향 판단(Follow-ups ②), 단계별 percentile export step(Follow-ups ③).

## Suggested Sub-agents

`implementer` → `tester`

## Follow-ups

- ① `docs/ops/load-resilience-test-plan.md` doc 동기 — `#### S3 1 회차` 의 `http_reqs = 3 × iterations` 판정 근거에 "T-1682 배선 후로는 `+2`" pointer 1 줄 + `§2` S3 설계에 행 수 로그 계약 박제(direct, 이력 소급 치환 0).
- ② `K6_SEED_PERSONS` 30 → 133 상향 판단 (T-1681 Follow-up ① 승계) — S2 2 회차가 설계 ③ 을 실증했으므로(`상한 30` 은 iteration 이 쓰지 않는 배열 길이만 자름) 상향의 실익 유무를 판단해 문서/워크플로 동기.
- ③ 단계별 percentile export step (T-1681 Follow-up ③ 승계) — 현 k6 기본 요약으로는 latency cliff 단계 분해도 `p99` 회수도 불가.
