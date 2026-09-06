---
id: T-1925
title: 문서 축 notable author 의 contribution 등급 결정적 상향
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-020]
estimatedDiff: 330
estimatedFiles: 2
created: 2026-09-06
independentStream: p5-document-contribution
dependsOn: [T-1924]
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-document-contribution-adjust.ts
  - src/assessment-evaluation/domain/evaluation-document-contribution-adjust.spec.ts
sizeExempt: true
exemptReason: "cap-bend pre-justified: R-112 backbone x 1.5 = 330 LOC. 신규 helper 1 개 + colocated spec 1 개 = 2 파일로 파일 cap(<= 5)은 여유 준수. mirror 원본 evaluation-notable-contribution-adjust.ts 236 행 중 uplift 절반 + 신규 파일 header/import/interface 고정비를 합산한 값이며, 직전 동형 신규-helper slice T-1923 실측 490 LOC(2 파일) 대비 압축 목표치다. T-1923 / T-1921 패턴 정당화"
plannerNote: "P5 · REQ-020 상향 축 · T-1923 Follow-up (b) — 문서 축 notable author 의 contribution 상향 helper (pre-check origin/main 7ec022b5 심볼 0)"
---

# T-1925 — 문서 축 notable author 의 contribution 등급 결정적 상향

## Why

[README.md](../../README.md) `39 행` 은 "조직에 큰 기여를 **문서를 통해** 한 인원에게 **더 높은 점수**와 더 높은 평가 코멘트" 를 요구하고, [docs/requirements.md](../requirements.md) `39 행` REQ-020 은 그래서 아직 `IN_PROGRESS` — 미충족 축 3 개 중 **식별 축** 은 T-1923(신호 신설) + T-1924(detection 본류 배선) 로 채워졌지만 **결정적 점수 상향 축** 과 **문서 기반 코멘트 상향 축** 은 그대로 비어 있다. 본 task 는 그 중 앞의 하나 — 문서 축 `notable === true` author 의 `contribution` 등급을 결정적으로 상향하는 소비 helper — 만 가져간다. 코드 축의 대칭 선례가 T-1921 `applyNotableContributionUplift`(REQ-011 "더 높은 점수" 축) 라 설계 판단은 이미 박제돼 있고, 본 slice 는 소비 신호만 `NotableContributionSignal` → `DocumentContributionSignal` 로 바꾼 동형 mirror 다.

**issue-still-relevant pre-check (origin/main `7ec022b5` 실측)** — 재큐잉이 아니다. ① `git grep -n "applyDocumentContribution|DOCUMENT_CONTRIBUTION_UPLIFT" origin/main -- src` 결과 **0 행**, ② `src/assessment-evaluation/domain/` 의 adjust 파일 목록에 `evaluation-document-contribution-adjust.ts` 가 **없다**(abuse / quality / underperformer / update-count / notable-contribution 5 종뿐), ③ [`evaluation-adjustments-pipeline.ts`](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) `102 행` 주석이 "6 번째 `documentContribution`(T-1924)은 detection 축에서만 채워지는 신호로, 현재 어떤 adjuster 도 소비하지 않는다" 로 미소비를 **스스로 자인**한다. → 부분 안착조차 없음.

**경쟁 축 배제 근거** — PLAN `157 행` R-91(k6 실 scale 부하)은 배포기기 PAT · LLM 자격증명 게이트라 cron 이 자율 집행할 수 없고, PLAN `158 행` R-92 는 오너가 신규 per-route perf baseline slice 큐잉을 금지했다. PLAN `183 행` AdminView god component 부채는 `web/` 축이라 본 P5 arc 와 stream 이 다르며 직전 T-1907~T-1911 로 한 라운드 소진됐다.

## Required Reading

- [src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.ts](../../src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.ts) — **mirror 정본**. `85~92 행` `NotableContributionAdjustEntry`(entry shape) · `180~186 행` `NOTABLE_CONTRIBUTION_UPLIFT_LEVEL` 상수와 그 "고정 목표 등급 = 멱등" 근거 주석 · `188~236 행` `applyNotableContributionUplift`(guard 2 개 → author Map 색인 → 규칙 3·6 판정 → 새 객체 복제 반환). 본 task 는 이 함수의 소비 신호만 바꾼 동형 mirror 를 쓴다.
- [src/assessment-evaluation/domain/evaluation-document-contribution-signal.ts](../../src/assessment-evaluation/domain/evaluation-document-contribution-signal.ts) `54~78 행` — 소비 대상 타입 `DocumentContributionEntry`(`author` / `documentUnitCount` / `notable`) · `DocumentContributionSignal`(`totalAuthorCount` / `meanDocumentUnitCount` / `byAuthor` / `notableDetected`). **detection layer 는 읽기만** 한다.
- [src/assessment-evaluation/domain/evaluation-result.ts](../../src/assessment-evaluation/domain/evaluation-result.ts) `31 행` `ContributionLevel` union · `37~42 행` `CONTRIBUTION_LEVELS` · `47 행` `isContributionLevel`.
- [src/assessment-evaluation/domain/evaluation-quality-adjust.ts](../../src/assessment-evaluation/domain/evaluation-quality-adjust.ts) `56~62 행` — `CONTRIBUTION_QUALITY_FLOOR_LEVEL = "zero"`(단조 하한). 본 helper 는 이 하한을 **되돌리지 않는다**(zero → 무변경).
- [src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.spec.ts](../../src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.spec.ts) `380 행` 이하 `describe("applyNotableContributionUplift")` — colocated spec 의 describe / it 조직과 케이스 축 구성(happy · error · branch · negative · 결정성) 의 mirror 기준.
- [README.md](../../README.md) `39 행` — 본 helper 가 서빙하는 요구 문장(앞절 "더 높은 점수").

## 설계 (구현 전 확정 — ADR 불요)

- 신규 파일 1 개 `src/assessment-evaluation/domain/evaluation-document-contribution-adjust.ts`, public symbol 정확히 3 개:
  - `DOCUMENT_CONTRIBUTION_UPLIFT_LEVEL: ContributionLevel` — v1 = `"high"`(코드 축 `NOTABLE_CONTRIBUTION_UPLIFT_LEVEL` 과 동일 고정 목표 등급. 한 등급씩 올리는 step 방식은 재적용 시 비멱등이라 채택하지 않는다).
  - `interface DocumentContributionAdjustEntry` — `author: string` / `result: EvaluationResult`(코드 축 entry 와 동형 shape).
  - `function applyDocumentContributionUplift(entries: DocumentContributionAdjustEntry[], signal: DocumentContributionSignal): DocumentContributionAdjustEntry[]`.
- 규칙(결정적 · 단조 비하향 · 멱등 · LLM 무관): (1) author 미매칭 → 무변경 passthrough, (2) `notable === false` → 무변경, (3) `notable === true` 라도 현재 등급이 `CONTRIBUTION_QUALITY_FLOOR_LEVEL`(`"zero"`) 면 **무변경**(하한 우선), (4) `"low"` / `"medium"` → `"high"`, (5) 이미 `"high"` → 값 동일(멱등), (6) 등급이 enum 외(`isContributionLevel` false) → 무변경.
- `narrative` / `difficulty` / `volume` / `unitId` 는 손대지 않는다(필드 직교 — 코멘트 상향은 별도 slice).
- throw 는 `entries` / `signal` 이 `null` 또는 `undefined` 인 경우의 한국어 `TypeError` 2 개뿐. 빈 배열 · 빈 `byAuthor` · 미매칭은 방어적으로 흡수한다.
- 입력 비변형(entry · result 를 항상 새 객체로 복제) · 길이 · 순서 보존.

## Acceptance Criteria

- [ ] 신규 파일 `src/assessment-evaluation/domain/evaluation-document-contribution-adjust.ts` 가 위 "설계" 의 public symbol 3 개를 정확히 export 하며, `DocumentContributionSignal` / `DocumentContributionEntry` / `ContributionLevel` / `EvaluationResult` / `CONTRIBUTION_QUALITY_FLOOR_LEVEL` 은 기존 모듈에서 재사용한다(타입·상수 재정의 0, 신호 계산 재구현 0).
- [ ] **happy-path unit test 1+** — public symbol 3 개 각각에 대해: 상수가 `"high"` 임을 직접 단언, notable author 의 `"low"` / `"medium"` 단위가 `"high"` 로 상향된 새 배열이 반환되고 길이·순서가 입력과 동일함을 단언.
- [ ] **error path unit test 1+** — `applyDocumentContributionUplift(null as never, signal)` 과 `(entries, null as never)` 각각이 한국어 메시지의 `TypeError` 를 던짐을 검증(`undefined` 도 각각 1 케이스).
- [ ] **분기별 test 1+** — 설계 규칙 (1)~(6) 각각에 대응하는 it 1+ : 미매칭 author / `notable=false` / `"zero"` 무변경(하한 우선) / `"low"`·`"medium"` 상향 / 이미 `"high"` 멱등 / enum 외 등급 문자열 무변경.
- [ ] **negative case 를 예외 분기마다 1+** — ① 빈 `entries` → 빈 배열 반환, ② 빈 `signal.byAuthor` → 전 단위 무변경 복제, ③ `narrative` · `difficulty` · `volume` · `unitId` 가 전사(상향이 다른 필드를 오염시키지 않음), ④ 호출 전후 입력 `entries` · 원소 · `result` · `signal` deep-equal 불변(`Object.freeze` 입력 통과), ⑤ 2 회 연속 적용 산출이 1 회 적용과 deep-equal(멱등).
- [ ] colocated spec 위치는 `src/assessment-evaluation/domain/evaluation-document-contribution-adjust.spec.ts` 다(신규 파일 옆, `test/` 아래 아님).
- [ ] 헤더 주석은 30 행 이하로 압축한다 — mirror 원본 [evaluation-notable-contribution-adjust.ts](../../src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.ts) 의 서술을 재진술하지 않고 경로 + 역할 차이만 밝힌다(diff 팽창 억제).
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 통과.
- [ ] `pnpm test:cov` 통과 — line 80% 이상 / function 80% 이상 (`package.json` `coverageThreshold.global`).

## Out of Scope

- **소비처 배선 금지** — [`evaluation-adjustments-pipeline.ts`](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) 의 step (7) 추가 · `102 행` 미소비 주석 갱신 · 그 colocated spec 및 `evaluation-orchestrator.service.spec.ts` 기대값 갱신은 전부 본 task 밖이다. 근거(CLAUDE.md §3 소비처 동반 의무의 cap 예외, 수치 제시): 같은 PR 에 넣으면 파일 5 개(adjust.ts / adjust.spec.ts / pipeline.ts / pipeline.spec.ts / orchestrator.service.spec.ts) 에 총 diff 약 470 LOC(본 slice 330 + 배선 약 140 — 배선 실측 선례 T-1921 은 pipeline `+33` · pipeline.spec `+62` · orchestrator.spec `+6`)로 300 LOC cap 을 크게 초과한다. 잔여 배선은 아래 Follow-ups 에 파일 · 배선 단위로 명시한다.
- **코멘트 상향 축 금지** — `narrative` 에 문서 축 marker 를 접두하는 `applyDocumentContributionAnnotation` 류는 별도 slice 다. 본 task 는 `contribution` 필드만 손댄다.
- detection layer(`evaluation-document-contribution-signal.ts`) 및 `DOCUMENT_CONTRIBUTION_RELATIVE_CEILING`(1.5) 값 변경 금지 — 식별 기준은 그대로 둔다.
- 기존 5 adjuster 파일(`evaluation-abuse-adjust.ts` / `evaluation-update-count-adjust.ts` / `evaluation-quality-adjust.ts` / `evaluation-underperformer-adjust.ts` / `evaluation-notable-contribution-adjust.ts`) 및 그 spec 수정 금지.
- `docs/requirements.md` REQ-020 재판정 · `docs/PLAN.md` checkbox 승격 금지 — CLAUDE.md §3.1 에 따라 구현 chain 머지 **후** REQ 당 1 회 별도 direct task.
- `prisma/schema.prisma` · 응답 계약 · `deploy/daily-test.sh` · 워크플로 · `package.json` 변경 금지(daily-test.sh 는 drift-guard smoke 3 종을 같은 commit 으로 끌어들여 파일 cap 을 깨뜨린다 — 본 task 와 무관).
- 새 외부 dependency · 새 ADR 신설 금지. 기존 adjuster 패턴(T-1921 uplift) 범위 안의 mirror 라 새 ADR 불요이며, 설계 판단이 그 범위를 벗어난다고 보이면 즉시 BLOCKED 로 escalate 한다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (a) 소비처 배선 slice — `evaluation-adjustments-pipeline.ts` 에 step (7) `applyDocumentContributionUplift(notableUplifted, signals.documentContribution)` 를 flatten 직전에 삽입(quality floor step (3) 뒤여야 하한 우선이 성립) + `102 행` "어떤 adjuster 도 소비하지 않는다" 주석 갱신 + `evaluation-adjustments-pipeline.spec.ts` · `evaluation-orchestrator.service.spec.ts` 기대값 갱신.
- (b) 코멘트 상향 slice — 문서 축 notable author 의 `narrative` marker 접두(`applyNotableContributionAnnotation` 패턴 mirror, README `39 행` 뒷절 "더 높은 평가 코멘트").
- (c) (a)·(b) 전량 머지 후 REQ-020 재판정 1 회(direct) — `docs/requirements.md` `39 행` + PLAN 해당 bullet.
