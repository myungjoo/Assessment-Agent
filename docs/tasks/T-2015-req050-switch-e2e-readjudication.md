---
id: T-2015
title: REQ-050 재판정 — 스위치 ON e2e 축(T-2014) 머지 실측 반영
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-050]
estimatedDiff: 40
estimatedFiles: 1
created: 2026-09-10
independentStream: difficulty-routing-activation
dependsOn: [T-2014]
touchesFiles: [docs/requirements.md]
plannerNote: P5 · REQ-050 유일 잔여(스위치 ON e2e)를 닫은 T-2014 머지 후 1 회 재판정 — direct doc-only 1 파일, arc 종결
---

# T-2015 — REQ-050 재판정 (스위치 ON e2e 축 머지 실측 반영)

## Why

[requirements.md](../requirements.md) `69 행` REQ-050 은 T-2013(main `ed954ca0`)이 재판정하면서 status 를 **IN_PROGRESS 로 유지** 했고, 잔여를 "검증 위치 `policy + unit + e2e` 중 **e2e 축이 스위치 경로에서 미충족**" **하나** 로 특정했다. 그 축을 여는 slice 가 T-2014(PR #1580 → main `4738186d`)이며 머지됐다. 이제 요구표는 shipped 상태와 어긋난다. `requirements.md` 가 실제 shipped 상태와 다르면 그건 결함이므로 정정 대상이다(T-1821 `## Why`).

**once-rule 정합 (CLAUDE.md §3.1 · [PLAN.md](../PLAN.md) `183 행`)** — 규칙은 "그 REQ 를 구현하는 slice 가 머지된 **뒤** REQ 당 1 회" 이고, 금지 대상은 구현 **전** 재판정이다. T-2014 는 `coversReq: [REQ-050]` 인 구현 slice 이고 T-2013 **이후** 에 머지됐다. T-2014 task 파일 `81 행` Out of Scope 도 "본 slice 머지 **후** 별도 direct task 1 회만" 으로 본 재판정을 미리 등록해 두었다. 따라서 본 task 가 T-2014 의 post-merge 재판정 1 회분이다. 추가 왕복을 막으려고 두 가지를 정해 둔다. (1) 본 재판정이 difficulty-routing-activation stream 의 **종결 판정** 이다. (2) IN_PROGRESS 를 유지하게 되면 잔여를 이름 · 좌표로 1 개 특정하고, 그 잔여를 구현하는 slice 가 머지되기 전까지 REQ-050 재판정 task 는 다시 큐잉하지 않는다.

**issue-still-relevant pre-check (origin/main `d94a96fe` 실측, 전부 재현 가능)** — 요구표 쪽 반영은 **0 %** 다.

- `git log origin/main --oneline -1 -- docs/requirements.md` → `ed954ca0`(T-2013). T-2014 머지 `4738186d` **이전** 이라 e2e 축 안착이 요구표에 박제되지 않았다.
- 요구표 `69 행` 은 지금도 status 괄호에서 "잔여는 스위치 ON e2e 검증 축 하나" 라고 적는다. 본문에서는 "`grep -rln "useInputDifficultyRouting" test/` 가 **0 hit**" · "e2e 축이 스위치 경로에서 미충족" · "이 축을 여는 e2e slice 는 별도 `pr` task 라 본 재판정은 관측만 했다" 를 단언한다.
- 실측은 그 반대다. `git grep -c useInputDifficultyRouting origin/main -- test/` 결과는 **2 파일** — [assessment-evaluation-evaluate.e2e-spec.ts](../../test/e2e/assessment-evaluation-evaluate.e2e-spec.ts) 12 hit(`308 행` describe "난이도 routing 스위치 useInputDifficultyRouting (T-2014)") · [unevaluated-fill-run.e2e-spec.ts](../../test/e2e/unevaluated-fill-run.e2e-spec.ts) 3 hit(`302 행` describe "… HTTP 계약 (T-2014)").
- 진행 중인 다른 task 가 REQ-050 행을 건드리지 않는다(`STATE.currentTask` · `nextTask` 모두 null).

status 를 DONE 으로 올릴지는 **미리 정해 두지 않는다** — 아래 AC 의 축별 실측이 결정한다(T-2013 선례).

**cap 근거** — 1 파일 · 기존 셀 section 단위 inline 정정(doc-only enumerated-section × 1.6 × inline-amend × 0.4 = × 0.64, base ~60 LOC → 약 40 LOC). 동형 선례 T-2013 은 +2/-2(단일 행 교체)였다.

## Required Reading

- [docs/requirements.md](../requirements.md) `69 행` — REQ-050 행 전문(수정 대상, 단일 행 약 16,700 자 · 파이프 8 개). 정정 대상은 status 괄호의 "잔여는 스위치 ON e2e 검증 축 하나" 와 본문 "**status 재판정 결과는 `IN_PROGRESS` 유지**" 이하 e2e 미충족 서술 3 문장이다.
- [docs/requirements.md](../requirements.md) `1~10 행` — 표 헤더 · 컬럼 순서(구조 보존 확인용)
- [docs/tasks/T-2014-difficulty-switch-e2e-lock.md](T-2014-difficulty-switch-e2e-lock.md) — `50~73 행` AC(두 축이 잠근 범위) · `75~82 행` Out of Scope(실 `LlmHttpGateway` 경로 e2e 는 범위 밖 · 본 재판정 예약)
- [test/e2e/assessment-evaluation-evaluate.e2e-spec.ts](../../test/e2e/assessment-evaluation-evaluate.e2e-spec.ts) — `308 행` 이하 스위치 describe(stub gateway narrative 로 ON → 주입 → 응답 관측 · 분기 · 비대칭 · negative · RBAC)
- [test/e2e/unevaluated-fill-run.e2e-spec.ts](../../test/e2e/unevaluated-fill-run.e2e-spec.ts) — `302 행` 이하 스위치 HTTP 계약 describe(좌표 0 이라 gateway 미도달이라는 한계 주석 포함)
- [src/assessment-evaluation/evaluation-scoring.difficulty-routing.spec.ts](../../src/assessment-evaluation/evaluation-scoring.difficulty-routing.spec.ts) `1~9 행` — scoring × 실 `LlmHttpGateway` × 실 `DifficultyMappingService` cross-layer unit(T-2005). 실 gateway routing · `resolveModel` fail-fast 를 이미 어느 층이 지는지 판정할 근거.
- [docs/decisions/ADR-0066-input-difficulty-routing-activation.md](../decisions/ADR-0066-input-difficulty-routing-activation.md) — `84~90 행` `§ Decision 3` · `92 행` 이하 `§ Decision 4`(운영자 표면 범위 밖) · `## Follow-ups` (c)(period bridge) · (d)
- [docs/PLAN.md](../PLAN.md) `183 행` · [CLAUDE.md](../../CLAUDE.md) `§3.1` — once-rule · direct 판정 근거

## Acceptance Criteria

- [ ] [docs/requirements.md](../requirements.md) `69 행` REQ-050 행 **하나만** 수정한다. `git diff --stat` 이 **1 파일** 이고, `git diff -U0 docs/requirements.md` 의 hunk 가 REQ-050 행에만 걸림을 확인한다(다른 REQ 행 · 헤더 무접촉).
- [ ] 표 구조 보존 — 수정 후 `grep -c '^| REQ-' docs/requirements.md` = **84**, `sed -n '69p' docs/requirements.md | tr -cd '|' | wc -c` = **8**, `wc -l < docs/requirements.md` = **121**. 셀 본문에 `|` 문자를 새로 넣지 않는다.
- [ ] **e2e 축 정정(핵심)** — "`grep -rln … test/` 가 0 hit" · "e2e 축이 스위치 경로에서 미충족" · "e2e slice 는 별도 `pr` task 라 관측만 했다" 3 문장을 실측으로 대체한다. 실측 내용은 T-2014 머지 commit `4738186d` · PR #1580, 스위치를 켠 요청이 있는 e2e spec 2 파일과 각 describe 시작 행이다. 각 좌표는 `sed -n '<n>p' <file>` 로 1 건씩 재현 확인하고, 재현되지 않는 좌표는 적지 않는다.
- [ ] **잠근 범위와 한계를 구분해 박제** — evaluate 축은 `LOAD_TEST_STUB=1` stub gateway narrative 로 ON → `evaluation-scoring.service.ts` 주입 → 응답까지 관측한다(단위별 routing 2 종 값 · OFF 3 갈래 · 사전/사후 비대칭 · 비-boolean 400 · 401/403). fill-run 축은 좌표 0 이라 gateway 도달은 관측하지 못하고 **HTTP 계약만** 잠근다(200 · 비-boolean 400 · 503 fail-fast 비우회). 이 한계를 spec 주석 좌표와 함께 적는다.
- [ ] **검증 축 재검산** — 두 스위치 describe 안의 it 수를 실행 시점에 행두 `it(` · `it.each` 합산으로 재측정해 적는다. task 파일 · journal · 기존 행의 수치(예: "13 it · 8 it")를 그대로 옮기지 않고 **실측을 적는다**. CI 근거는 PR #1580 head run `34446530996` success 로 적는다. main 머지 run `34447163753` 의 conclusion 은 `gh run view 34447163753 --json conclusion` 으로 확인했을 때만 적는다.
- [ ] **status 재판정** — 위 실측을 근거로 `IN_PROGRESS` 유지 또는 `DONE` 승격 중 하나를 고르고, **선택 사유를 같은 셀에 명시** 한다.
  - 승격 시: policy(ADR-0011 · ADR-0065 · ADR-0066 `status: ACCEPTED`) · unit(기존 행의 spec · it 좌표) · e2e(`difficulty-mappings.e2e-spec.ts` + 위 스위치 describe 2 개) 3 축이 각각 어느 좌표로 충족되는지 적는다.
  - 유지 시: 잔여 축 **1 개** 를 이름과 좌표로 특정한다("일부 미흡" 같은 모호한 표현 금지).
- [ ] **범위 밖 항목 분류** — T-2014 Out of Scope `78 행` 의 "실 `LlmHttpGateway` 경로 ON + 슬롯 미설정 400 fail-fast e2e" 가 REQ-050 잔여인지 범위 밖 hardening 인지 **명시적으로 분류하고 근거 1 문장** 을 단다(판정 근거 후보: T-2005 cross-layer unit 이 실 gateway × 실 mapping service 의 fail-fast 사슬을 이미 잠금). ADR-0066 `§ Decision 4`(운영자 표면) · `## Follow-ups` (c)(period bridge) · ADR-0065 `§ Decision 4`(요약 경로)가 범위 밖이라는 기존 서술은 유지한다.
- [ ] **add-only 정정 원칙** — 기존 행이 담은 ADR 축 · 결정 내용 축 · 슬롯 매핑 구현 축 · 규칙 구현 축 · 주입 배선 축 · 발화 배선 축 · seed 경로 4 축 · `difficulty-mappings.e2e-spec.ts` · perf 좌표 서술은 **삭제하지 않고 보존** 한다. 삭제는 위 e2e 미충족 3 문장과 status 괄호의 "잔여는 … 하나" 표기에 한한다. 이전 회차 once-rule 소진 표기(T-2002 · T-2006 · T-2013)도 보존하고, 본 회차는 "T-2014 머지 후 1 회, difficulty-routing-activation stream 종결 판정" 으로 적는다.
- [ ] R-110 / R-112 — 본 task 는 `direct` **doc-only** 이고 `src/` · `web/` · `test/` · `prisma/` 변경이 0 이라, tester 호출과 R-112 4 축(happy-path / error path / 분기별 / 예외 분기마다 negative)이 **면제** 다. 그 사유를 commit body 에 1 줄 적고, 위 grep · sed 기계 검증으로 대신한다. 신규 helper · 소비처 신설도 0 이라 CLAUDE.md `§3` 소비처 동반 의무에 걸리지 않는다는 점도 함께 적는다.

## Out of Scope

- `src/` · `web/` · `test/` · `prisma/` · `package.json` 은 어떤 변경도 하지 않는다(doc-only `direct`).
- T-2014 reviewer MINOR 2 건은 손대지 않는다 — evaluate 비대칭 it 의 `not.toBe("hard")` 단언이 prompt instruction 형식에 결합된 점, local `RoutedBody` 타입이 `EvaluateBody` 와 일부 겹치는 점. 둘 다 변경 요청이 아니었고 `test/` 수정이라 direct 범위 밖이다.
- 실 `LlmHttpGateway` 경로 e2e 신설 — 위 AC 는 **분류만** 하고 새 spec 은 만들지 않는다. 잔여로 분류하면 별도 `pr` slice 가 필요하며, 그 slice 가 머지된 뒤에만 REQ-050 을 다시 판정한다.
- [ADR-0066](../decisions/ADR-0066-input-difficulty-routing-activation.md) · [ADR-0065](../decisions/ADR-0065-difficulty-routing-activation.md) · [ADR-0011](../decisions/ADR-0011-difficulty-model-assignment.md) 본문 수정 · Follow-ups 완료 마커 부착은 하지 않는다.
- [docs/PLAN.md](../PLAN.md) 체크박스(`86 행` 은 이미 `[x]`) · 다른 REQ 행은 접촉하지 않는다 — REQ-050 **1 행** 만 고친다.

## Suggested Sub-agents

`implementer` (doc 편집 + grep · sed 기계 검증). tester 는 direct doc-only 라 면제.

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가한다.)
