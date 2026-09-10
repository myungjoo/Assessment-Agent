---
id: T-2013
title: REQ-050 재판정 — 난이도 routing 스위치 발화 경로(evaluate · fill-run) 실측 반영
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-050]
estimatedDiff: 40
estimatedFiles: 1
created: 2026-09-10
independentStream: difficulty-routing-activation
dependsOn: [T-2009, T-2010, T-2011, T-2012]
touchesFiles: [docs/requirements.md]
plannerNote: ADR-0066 Follow-ups (e) 집행 — (a)T-2009 · (b)T-2010~T-2012 전량 머지 후 REQ-050 1 회 재판정(direct doc-only 1 파일)
---

# T-2013 — REQ-050 재판정 (난이도 routing 스위치 발화 경로 실측 반영)

## Why

[ADR-0066](../decisions/ADR-0066-input-difficulty-routing-activation.md) `## Follow-ups` `120~128 행` 의 (a) `POST /evaluate` 스위치 배선 = T-2009(PR #1576 → main `f37a315d`), (b) fill-run 스위치 배선 = T-2010(`ac2e5b8f`) · T-2011(`a491d9fe`) · T-2012(`94d8abef`) 가 **전량 머지** 됐다. 같은 절 `128 행` 의 (e) 는 "(a) · (b) 전량 머지 후 [requirements.md](../requirements.md) `69 행` 재판정을 [PLAN.md](../PLAN.md) `183 행` once-rule 대로 **1 회만**" 이며, CLAUDE.md `§3.1` 의 "구현 slice 머지 후 REQ 당 1 회" 규칙과 정확히 부합한다. 앞선 재판정 회차 T-2002 는 seed 경로 arc(T-1998~T-2001), T-2006 은 규칙 helper · 주입 arc(ADR-0065) 의 것이라 **본 스위치 배선 arc 의 재판정은 0 회** 다.

issue-still-relevant pre-check (origin/main `0cb07ddc` 실측, 전부 재현 가능):

- `git log origin/main --oneline -- docs/requirements.md` 의 최신 commit 은 `e321041f`(T-2006) 로, 본 arc 4 건(`f37a315d` · `ac2e5b8f` · `a491d9fe` · `94d8abef`) **이전** 이다 → 요구표에 본 arc 는 미박제.
- 요구표 `69 행` 은 지금도 "따라서 잔여는 운영 발화 0 축 하나 이고 status 는 IN_PROGRESS 유지", "true 로 켜는 지점은 spec 2 파일뿐이며 … production caller 는 0" 을 단언한다.
- 실측은 그 단언과 어긋난다 — `grep -rn "useInputDifficultyRouting" src test web --include=*.ts` 에서 spec 을 뺀 결과가 **production 7 파일**에 걸쳐 hit 하고, HTTP 요청이 스위치를 켜는 경로가 **2 종** 실재한다: [assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `263 행` `@Post("evaluate")` → `297 행` 전사, `725 행` `@Post("unevaluated-fill-run")` → `786 행` 4 번째 인자 전사.
- 즉 "운영 발화 0" 자인은 뒤집혔다. 본 task 는 그 이동을 실측으로 박제하고 status 를 **재판정** 한다(DONE 승격 여부는 아래 AC 의 축별 실측 결과가 결정한다 — 미리 정해 두지 않는다).

## Required Reading

- [docs/requirements.md](../requirements.md) `69 행` — REQ-050 행 전문(수정 대상, 단일 행 약 12,960 자 · 파이프 8 개). 특히 "잔여는 운영 발화 0 축 하나" · "production caller 는 0" 문장이 정정 대상이다.
- [docs/requirements.md](../requirements.md) `1~10 행` — 표 헤더 · 컬럼 순서(구조 보존 확인용)
- [docs/decisions/ADR-0066-input-difficulty-routing-activation.md](../decisions/ADR-0066-input-difficulty-routing-activation.md) — frontmatter(`status` · `date` · `augments`) · `§ Decision 1`(스위치 필드명 · 위치) · `§ Decision 2`(배선 좌표 표 — 발화 경로 2 종 확정 · bridge 경로 제외) · `§ Decision 3`(미지정 = OFF · HTTP 400 vs 내부 OFF 환원) · `§ Decision 4`(운영자 표면 범위 밖) · `## Follow-ups` `120~128 행`
- [src/assessment-evaluation/assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `263 행`(`@Post("evaluate")`) · `291~298 행`(evaluate 전사) · `725 행`(`@Post("unevaluated-fill-run")`) · `783~789 행`(fill-run 4 번째 인자 전사)
- [src/assessment-evaluation/dto/evaluate-activities.dto.ts](../../src/assessment-evaluation/dto/evaluate-activities.dto.ts) `177~199 행` — `@IsOptional()` + `@IsBoolean()` 선택 필드 선언
- [src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.ts](../../src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.ts) `83~102 행` — fill-run 요청 DTO 의 동일 선택 필드
- [src/assessment-evaluation/dto/build-fill-run-scoring-options.ts](../../src/assessment-evaluation/dto/build-fill-run-scoring-options.ts) `95~98 행`(`=== true` 게이트 · 키 조건부 부착) · `140~153 행`(3 번째 인자 수용 · 두 반환 경로 반영)
- [src/assessment-evaluation/dto/run-unevaluated-fill-run-core.ts](../../src/assessment-evaluation/dto/run-unevaluated-fill-run-core.ts) `126 행` · `133 행` — core 전달 경로
- [src/assessment-evaluation/unevaluated-fill-run-orchestrator.service.ts](../../src/assessment-evaluation/unevaluated-fill-run-orchestrator.service.ts) `116 행` · `150 행` — orchestrator 시그니처 · 전달
- [src/assessment-evaluation/evaluation-scoring.service.ts](../../src/assessment-evaluation/evaluation-scoring.service.ts) `54 행`(`ScoringOptions` opt-in 필드) · `107~114 행`(주입 분기 · `generate` × 1) — 요구표가 이미 인용 중인 좌표, 변동 없음 확인용
- [docs/PLAN.md](../PLAN.md) `183 행` — REQ 재판정 once-rule(횟수 근거)
- [CLAUDE.md](../../CLAUDE.md) `§3.1` — direct commitMode 판정 근거

## Acceptance Criteria

- [ ] [docs/requirements.md](../requirements.md) `69 행` REQ-050 행 **하나만** 수정한다. `git diff --stat` 이 **1 파일** 이고 `git diff -U0 docs/requirements.md` 의 hunk 가 REQ-050 행에 국한됨을 확인(다른 REQ 행 · 헤더 무접촉).
- [ ] 표 구조 보존: 수정 후 `grep -c '^| REQ-' docs/requirements.md` = **84**, `sed -n '69p' docs/requirements.md | tr -cd '|' | wc -c` = **8**, `wc -l < docs/requirements.md` = **121**. 셀 본문에 `|` 문자를 새로 넣지 않는다.
- [ ] **발화 축 정정(핵심)**: "잔여는 운영 발화 0 축 하나" · "production caller 는 0" 두 문장을 실측으로 대체한다 — HTTP 요청이 스위치를 켜는 경로가 2 종 실재함을 endpoint 좌표와 함께 적는다(`263 행` `@Post("evaluate")` → `297 행`, `725 행` `@Post("unevaluated-fill-run")` → `786 행`).
- [ ] **경로별 배선 사슬 박제**: fill-run 은 요청 DTO(`unevaluated-fill-run-request.dto.ts` `102 행`) → controller(`786 행`) → orchestrator(`116 행` · `150 행`) → core(`run-unevaluated-fill-run-core.ts` `126 행` · `133 행`) → helper(`build-fill-run-scoring-options.ts` `95~98 행` 의 `=== true` 게이트) 순서로, evaluate 는 DTO(`evaluate-activities.dto.ts` `199 행`) → controller(`297 행`) → `ScoringOptions`(`evaluation-scoring.service.ts` `54 행`) 로 적는다. 각 좌표는 `sed -n '<n>p' <file>` 로 1 건씩 재현 확인하고, 재현되지 않는 좌표는 적지 않는다.
- [ ] **기본 OFF 불변 명시**: 미지정 요청은 `undefined` 가 실려 `=== true` 게이트에서 false 로 남아 종전과 문자 단위 동일한 `{ modelId }` 경로를 타며(ADR-0066 `§ Decision 3`), 비-boolean 은 controller-scope `ValidationPipe` 가 **400** 으로 거부하고 내부 호출은 OFF 로 환원됨을 적는다. 회귀 0 근거로 쓴다.
- [ ] **status 재판정**: 위 실측을 근거로 `IN_PROGRESS` 유지 / `DONE` 승격 중 하나를 선택하고 **선택 사유를 같은 셀에 명시** 한다. 승격 시에는 policy · unit · e2e 3 검증 축이 각각 어느 좌표로 충족되는지 적고, 유지 시에는 잔여 축 1 개를 이름과 좌표로 특정한다(모호한 "일부 미흡" 금지). ADR-0066 `§ Decision 4`(운영자 표면) · `## Follow-ups` (c)(period bridge 경로) 는 **범위 밖** 임을 함께 적어 잔여와 구분한다.
- [ ] **검증 축 재검산**: 본 arc 가 더한 spec 의 it 수를 실행 시점에 행두 `it(` · `it.each` 합산으로 재측정해 적는다(대상: `dto/evaluate-activities.dto.spec.ts` · `dto/unevaluated-fill-run-request.dto.spec.ts` · `dto/build-fill-run-scoring-options.spec.ts` · `dto/run-unevaluated-fill-run-core.spec.ts` · `unevaluated-fill-run-orchestrator.service.spec.ts` · `assessment-evaluation.controller.spec.ts`). task 파일 · 기존 행의 수치를 그대로 옮겨 적지 않고 **실측을 적는다**.
- [ ] 기존 행이 이미 담고 있는 seed 경로 4 축(T-1998~T-2001) · 규칙 helper 및 주입 축(T-2003~T-2006) · e2e 좌표(`test/e2e/difficulty-mappings.e2e-spec.ts`) · perf 좌표 서술은 **삭제하지 않고 보존** 한다(add-only 정정 원칙). 삭제는 위 발화 축 정정 대상 문장에 한한다.
- [ ] R-110 / R-112: 본 task 는 `direct` **doc-only** 이며 `src/` · `web/` · `test/` · `prisma/` 변경 0 이라 tester 호출과 R-112 4 축(happy-path / error path / 분기별 / 예외 분기마다 negative)이 **면제** 다. 그 사유를 commit body 에 1 줄 박제하고 위 grep · sed 기계 검증으로 대체한다. 신규 helper · 소비처 신설 0 이라 CLAUDE.md `§3` 소비처 동반 의무도 무저촉임을 함께 적는다.

## Out of Scope

- `src/` · `web/` · `test/` · `prisma/` · `package.json` 의 어떤 변경도 하지 않는다(본 task 는 doc-only `direct`).
- 스위치의 e2e spec 신설(`test/e2e/` 에서 스위치를 켜는 요청 추가) — 별도 `pr` slice 이며 본 재판정은 **관측만** 한다.
- period bridge 경로(`545 행` · `616 행`) 배선 — ADR-0066 `## Follow-ups` (c) 로 별도 slice.
- 운영자 표면(ON + 슬롯 미설정 안내) — ADR-0066 `§ Decision 4` 로 범위 밖, (d) 확장 지점.
- [ADR-0066](../decisions/ADR-0066-input-difficulty-routing-activation.md) · [ADR-0065](../decisions/ADR-0065-difficulty-routing-activation.md) · [ADR-0011](../decisions/ADR-0011-difficulty-model-assignment.md) 본문 수정(결정 내용 변경은 `pr` mode 대상). ADR-0066 `## Follow-ups` (e) 완료 마커 부착도 하지 않는다.
- [docs/PLAN.md](../PLAN.md) 체크박스 · 다른 REQ 행 재판정 — REQ-050 **1 행** 외 접촉 금지. 본 arc 재판정은 이 1 회로 소진된다.

## Suggested Sub-agents

`implementer` (doc 편집 + grep · sed 기계 검증). tester 는 direct doc-only 라 면제.

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가한다.)
