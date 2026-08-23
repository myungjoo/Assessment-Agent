---
id: T-1666
title: s1-batch.js setup() 에 devset 표본 인원 수 로그 1 줄 추가 — 회차마다의 간접 추론 제거
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-047]
estimatedDiff: 210
estimatedFiles: 2
created: 2026-08-23
createdAt: 2026-08-23T21:40:00Z
dependsOn: [T-1665]
touchesFiles:
  - test/load/s1-batch.js
  - test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts
independentStream: load-harness-r91
plannerNote: "P5 R-91 chain 48/N — T-1665 Follow-up 1: setup() 표본 수를 로그로 직접 회수해 9 회차부터 간접 추론 0."
---

# T-1666 — `s1-batch.js` `setup()` 표본 인원 수 로그 1 줄

## Why

[T-1665](T-1665-load-k6-devset-seeded-rerun.md) 의 8 회차 실측(run `32665014391`)은 실 devset seed 가 처음으로 성공한 run 이었지만, **k6 가 실제로 몇 명을 표본으로 취했는지는 로그로 직접 회수되지 않았다** — [`s1-batch.js`](../../test/load/s1-batch.js) `setup()` 에 `console.log` 가 하나도 없어서, `133` 이라는 값을 (a) seed step 의 적재 133 건 로그 (b) `person.service.ts` 의 무-페이지네이션 `findMany` (c) batch p95 가 표본 133 대역 안이라는 점, 이렇게 **간접 증거 3 종**으로만 추론해야 했다. 그 사실은 8 회차 소절과 T-1665 `## Follow-ups` 1 번에 그대로 박제돼 있다.

본 slice 는 오너 지시(PLAN `144 행` "R-91 k6 최우선·즉시 착수") chain 48/N 로, `setup()` 이 실제로 취한 표본 수와 요청 표본 수를 **로그 1 줄**로 찍어 9 회차부터 모든 run 이 그 값을 `gh run view --log` 만으로 직접 회수하게 한다. 표본 부족(seed 미적재·도메인 불일치)도 같은 줄에서 즉시 드러나므로, 앞으로의 실측 slice 가 간접 추론에 쓰는 지면을 없앤다.

## Required Reading

- [test/load/s1-batch.js](../../test/load/s1-batch.js) — 특히 `setup()` 의 (c) 단계(`const persons = http.get(... /api/persons ...)` → `const personIds = persons.json().filter(...).slice(0, SAMPLE_PERSONS).map(...)`)와 파일 상단의 `SAMPLE_PERSONS` 정규화 식(`Math.max(1, Math.trunc(Number(__ENV.K6_S1_PERSONS)) || 10)`), `DEVSET_EMAIL_DOMAIN` 상수, 머리 주석의 `// 범위 밖(후속 slice):` 리터럴.
- [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) — 파일 상단 helper(`s1Script()`, `s1Body(<선언>)`, `extractTopLevelBlock`, `devsetDomainOf`, `apiRoutesOf`, `S1_ROUTES`, `S1_BATCH_ROUTE`)와 **`3278 행` 부터의 `describe("s1-batch.js 실 devset dataset 조회 교체 drift smoke (T-1661)")`** 블록 전체. 본 slice 가 새 describe 를 파일 끝에 append 할 자리이자, **깨질 수 있는 기존 단언**(아래 참조)이 사는 곳이다.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3.1` 8 회차 소절 중 "`setup()` 소비 경로(T-1661) 검증" 문단 — 간접 증거 3 종의 정의(본 slice 가 없애려는 대상). **읽기만 하고 편집하지 않는다.**
- [docs/tasks/T-1665-load-k6-devset-seeded-rerun.md](T-1665-load-k6-devset-seeded-rerun.md) `## Follow-ups` 1 번 — 본 slice 가 집행하는 항목.

**기존 단언과의 충돌 주의** — T-1661 describe 의 다음 단언들이 `setup()` 본문 전체를 대상으로 하므로, 새 로그 줄이 이들을 깨지 않아야 한다(깨면 같은 commit 에서 새 계약으로 갱신):

- flow ① — `s1Body("export function setup")` 에 `"if ("`, `"} else"`, `" ? "`, `"Math.min("` 이 **없어야** 한다.
- negative ③ — 스크립트 전체에 `"if ("`, `"} else"`, `" ? "`, `" && "`, `" || ("` 이 없고 `/\|\|/g` 매치가 **정확히 2** 여야 한다.
- negative ⑤ — `apiRoutesOf(s1Script())` 가 `S1_ROUTES + S1_BATCH_ROUTE` 집합과 정확히 같아야 한다(로그 문자열에 `/api/...` 경로 리터럴을 넣으면 깨진다).
- Happy ① — `const personIds = persons.json().filter(...).slice(0, SAMPLE_PERSONS).map(...)` 단일 식 chain 정규식. 이 chain 을 중간 변수로 쪼개면 깨진다.

## Acceptance Criteria

- [ ] [test/load/s1-batch.js](../../test/load/s1-batch.js) `setup()` 의 `personIds` 산출 **직후**에 `console.log` **정확히 1 회**를 추가한다. 로그 문자열은 최소 **취한 표본 수(`personIds.length`)** 와 **요청 표본 수(`SAMPLE_PERSONS`)** 두 수치를 포함하고, 다음 사람이 값을 grep 할 수 있도록 고정 prefix(예: `[s1-batch] devset 표본`)로 시작한다. 자격증명·cookie·email 원문 등 민감값은 **출력 금지**.
- [ ] 위 로그 줄은 기존 단언 4 종(Required Reading 말미)을 **깨지 않는다** — 분기 토큰(`if (`, `} else`, ` ? `, ` && `, ` || (`, `Math.min(`) 0, `||` 총 매치 수 불변(2), 문자열 안에 `/api/` 경로 리터럴 0, `personIds` 단일 식 chain 무변경. `setup()` 의 http 왕복 수·순서·`return` 키 집합도 무변경.
- [ ] `teardown()` · `export default function` · `options` · 머리 주석의 `// 범위 밖(후속 slice):` 리터럴은 **무변경**.
- [ ] [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) 끝에 `describe("s1-batch.js 표본 인원 수 로그 배선 drift smoke (T-1666)")` 를 **최대 12 케이스**로 append 하고, 아래 4 종을 모두 cover 한다:
  - **happy-path** — `setup()` 에 `console.log` 가 정확히 1 회 존재하고, 그 인자 문자열이 `personIds.length` 와 `SAMPLE_PERSONS` 를 둘 다 참조하며, 위치가 `personIds` 산출 이후·`return` 이전이다. 고정 prefix 리터럴도 단언한다.
  - **error path** — 정본 파일 부재/오탈자 경로 read 는 throw, 없는 블록 추출(`s1Body("export function nonexistent")`)은 조용히 PASS 하지 않고 throw, 빈 문자열 입력은 `null`, non-string 입력은 `TypeError`.
  - **flow / 분기 cover** — 표본이 조회 결과보다 많을 때·적을 때·조회 결과가 0 일 때 로그가 찍을 수 (`personIds.length`) 가 각각 어떻게 되는지 스크립트와 **같은 식**을 합성 배열에 적용해 동치 검증(실 k6 실행 0). `SAMPLE_PERSONS` 정규화 식(기본값 10)과 workflow 주입 parity 회귀 0 도 함께.
  - **negative cases 충분 cover(각 1+ test)** — ① `console.log` 가 2 회 이상으로 늘거나 `setup()` 밖(`teardown`/`default`)으로 새지 않는다 ② 로그 문자열에 자격증명·cookie·`authCookie`·`credentials`·`apiKey`·`password` 토큰 유입 0 ③ 로그 문자열에 `/api/` 경로 리터럴 유입 0(`apiRoutesOf` 집합 불변으로 확인) ④ 분기 0 규약 회귀 0(분기 토큰 부재 + `||` 매치 수 2) ⑤ `personIds` 단일 식 chain 이 중간 변수로 쪼개지지 않았다(합성 mutation 으로 단언이 실제로 깨지는지 대조 — false-PASS 차단).
- [ ] 새 케이스는 **합성 mutation 대조군**을 1+ 포함한다 — 원본은 통과하고 mutate 한 문자열은 단언이 깨지는 것을 같은 test 안에서 보여, 단언이 항상 참인 tautology 가 아님을 증명한다(T-1661 negative ④ 선례).
- [ ] 기존 T-1661 describe 의 단언이 본 변경으로 깨진다면 **삭제하지 말고** 새 계약으로 갱신한다(무엇이 왜 바뀌었는지 한국어 주석 1 줄 동반). 깨지지 않았다면 무변경.
- [ ] `pnpm lint && pnpm build` green.
- [ ] `pnpm test` green — 대상 smoke spec 의 기존 케이스 회귀 0(기존 개수 + 신규 개수가 모두 pass), 전체 suite 회귀 0.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). `src/` 무변경이라 전역 coverage 수치는 불변이어야 한다 — 달라지면 그 사유를 PR 본문에 적는다.
- [ ] 변경 파일 **2 개**(`test/load/s1-batch.js` · `test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts`), diff ≤ 300 LOC 유지. 3 번째 파일이 필요하다고 판단되면 Follow-ups 로 넘긴다.

## Out of Scope

- **`load-k6.yml` dispatch·실측 금지** — 본 slice 는 배선만이다. 로그가 실제로 찍히는지의 실 run 확인은 다음 실측 slice(`§3.1` 9 회차)의 몫이다.
- **문서 doc-sync 금지** — `load-resilience-test-plan.md` · `realdata-scale-devset.md` · `PLAN.md` 편집 0(`commitMode` 가 갈리므로 §3.1). 9 회차 실측 slice 가 함께 반영한다.
- `s2-read.js` / `s3-concurrent.js` 의 devset dataset 교체 · S2/S3 실측.
- `setup()` 의 표본 부족 시 **동작 변경**(throw · 조기 종료 · 재시도 등) — 분기 0 규약을 지키는 로그 1 줄만이다. 부족 대응 정책은 별도 slice.
- `§3` 임계 표 숫자 변경 · 900ms 게이트 재확정.
- `realdata-devset-seed-identity-upsert-runner.ts` 의 `flattenPlan` placeholder 결손 가드 추가(T-1664/T-1665 Out of Scope 승계).
- **실 수집 왕복 축**(GitHub/Confluence 자격증명 주입) — CLAUDE.md §5 BLOCKED 사유(외부 자격증명)라 오너 결정 선행. 별도 planner slice 에서 판정.
- `deploy/daily-test.sh` leg 추가 — drift-guard smoke 3 종 동반으로 cap 초과(T-1122 / Q-0054 선례).

## Suggested Sub-agents

`implementer` (로그 1 줄 배선) → `tester` (신규 describe 12 케이스 + 기존 회귀 확인)

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 적는다.)
