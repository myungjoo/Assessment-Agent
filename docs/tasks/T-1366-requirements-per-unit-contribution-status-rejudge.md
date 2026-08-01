---
id: T-1366
title: requirements.md 52 행 REQ-033 건별 기여도·난이도·양 보유 상태를 실측 기반 재판정
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-033]
estimatedDiff: 16
estimatedFiles: 2
created: 2026-08-01
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1366-requirements-per-unit-contribution-status-rejudge.md
plannerNote: "requirements-status-resync 12 번째 slice — T-1365 Follow-ups 가 지목한 REQ-033 (Contribution 3 축 컬럼 실재로 PLANNED stale 의심)"
---

# T-1366 — requirements.md 52 행 REQ-033 건별 기여도·난이도·양 보유 상태를 실측 기반 재판정

## Why

[docs/requirements.md](../requirements.md) 52 행 REQ-033 (README 60 행 — "각 code commit, create/update 된 문서 건 별 기여도·난이도·양을 모두 평가하여 가지고 있으면 된다") 은 아직 상태 컬럼이 `PLANNED` 이지만, `prisma/schema.prisma` 329 행 `Contribution` model 에 `difficulty` · `contributionScore` · `volume` 3 축 컬럼이 `sourceRef` 단위로 실재하고 `src/assessment-evaluation/` 에 산정·영속 경로가 존재해 표가 실제 코드베이스와 어긋난다. T-1365 Follow-ups 가 다음 slice 후보로 명시적으로 지목한 row 이며, `requirements-status-resync` stream 의 12 번째 slice 로 표를 requirements 추적의 신뢰 가능한 single source of truth 로 되돌린다.

## Required Reading

- `docs/requirements.md` — 52 행 (REQ-033) 및 9 행의 상태 enum 정의
- `docs/tasks/T-1365-requirements-recollection-dedup-status-rejudge.md` — 직전 slice 의 상태 문자열 서술 포맷 (`DONE (implemented-on-main — <근거>)` + `한계 — ...`) 을 그대로 따른다
- `README.md` 60 행 — REQ-033 의 원문 지시 (평가 단위 = code commit + create/update 된 문서 건, 보유 축 = 기여도 · 난이도 · 양)
- `prisma/schema.prisma` 329~349 행 `Contribution` model — `sourceType` · `sourceRef` · `difficulty` · `contributionScore` · `volume` 컬럼과 `@@unique([assessmentId, sourceRef])` 실측
- `src/assessment-evaluation/evaluation-scoring.service.ts` · `src/assessment-evaluation/evaluation-result-persist.service.ts` — 3 축 값을 산정하고 건별 record 로 영속하는 경로 실측
- `src/assessment-evaluation/domain/evaluation-result.ts` · `src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts` — 평가 결과 → Contribution row 매핑에서 건별 단위 (unit / sourceRef) 가 보존되는지 확인

## Result (2026-08-01 완료)

REQ-033 (52 행) 상태 컬럼을 `PLANNED` → `DONE (implemented-on-main — ...)` 로 재판정했다. 실측 근거:

- **schema 축** — `prisma/schema.prisma` 329 행 `model Contribution` 의 `difficulty String` · `contributionScore Decimal` · `volume Int` 3 컬럼 + 건별 단위 키 `sourceRef String` 과 348 행 `@@unique([assessmentId, sourceRef])`.
- **산정 축 (3 축 모두 확인)** — `src/assessment-evaluation/evaluation-scoring.service.ts` 90 행 `EvaluationScoringService.scoreUnit()` 이 `classifyNarrative()` (`domain/evaluation-prompt.ts` 155 행) 로 난이도·기여도를, `calculateEvaluationVolume()` (`domain/evaluation-volume.ts` 30 행) 로 양을 산출해 `domain/evaluation-result.ts` 54 행 `EvaluationResult` 로 조립.
- **영속 배선** — `domain/evaluation-result.persist.mapper.ts` 136 행 `mapEvaluationResultToContribution()` (1:1, `sourceRef = unitId`, `contributionScore = contributionLevelToScore()` 104 행) → `evaluation-result-persist.service.ts` 213 행 `tx.assessment.create` + 216~217 행 `contributions: { create: mapped.contributions }` nested create.
- **평가 단위 두 종** — persist.mapper 86 행 `KNOWN_SOURCE_TYPES = ["commit", "pr", "issue", "document"]` 로 code commit · 문서 건 모두 정의.
- **검증 위치 `unit` 근거** — 5 spec 107 it: `evaluation-scoring.service.spec.ts` 29 · `domain/evaluation-result.persist.mapper.spec.ts` 21 · `domain/evaluation-volume.spec.ts` 21 · `evaluation-result-persist.service.spec.ts` 18 · `domain/evaluation-result.spec.ts` 18.
- **한계 (상태 문자열에 부기)** — `sourceType` 은 실 파이프라인에서 `""` placeholder: 유일한 unitId 합성 지점 `domain/evaluation-input.mapper.ts` 46 행 `buildUnitId()` 의 prefix 가 `ActivitySourceType` (`github` / `confluence`) 이라 `resolveSourceType()` (persist.mapper 117 행) 인정 집합과 미일치 → `""` (persist.mapper.spec 288 행이 고정). `sourceUrl` 도 빈 문자열. REQ-050 난이도 3 종 모델 정합과 문서 건 수집→평가 end-to-end 는 미확인.
- **표 무결성** — 편집 전후 `wc -l docs/requirements.md` = 97, `grep -c "^| REQ-"` = 66 불변, 52 행의 `|` 8 개가 인접 REQ-032 · REQ-034 행과 동일.

코드 변경 0 (Out of Scope 준수), 변경 파일 2 개 (`docs/requirements.md`, 본 task 파일).

## Acceptance Criteria

- [x] `prisma/schema.prisma` 의 `Contribution` model 을 실측해 3 축 (기여도 · 난이도 · 양) 에 대응하는 실제 컬럼명과 타입 (예: `difficulty String` · `contributionScore Decimal` · `volume Int`) 및 건별 단위 키 (`sourceRef` + `@@unique([assessmentId, sourceRef])`) 를 상태 문자열에 근거로 인용한다 (추측한 컬럼명을 적지 않는다).
- [x] 3 축 값이 산정되는 지점을 실측한다 — `evaluation-scoring.service.ts` 및 `domain/evaluation-result.ts` 에서 각 축이 어떤 export 심볼·필드로 계산·표현되는지 확인하고 파일 경로 + 심볼명을 상태 문자열에 인용한다. 세 축 중 산정 경로가 확인되지 않는 축이 있으면 그 사실을 그대로 적는다.
- [x] 산정 결과가 건별 `Contribution` row 로 영속되는 배선을 grep 으로 확인한다 (예: `grep -n "contribution" src/assessment-evaluation/evaluation-result-persist.service.ts`). `createMany` / `create` 호출 위치와 행 번호를 확인해 상태 문자열에 명시한다. 배선이 확인되지 않으면 DONE 근거로 쓰지 않는다.
- [x] README 원문의 평가 단위 두 종 (code commit · create/update 된 문서 건) 이 모두 cover 되는지 `sourceType` 이 취하는 값으로 확인한다 (예: `grep -rn "sourceType" src/assessment-evaluation --include=*.ts | grep -v spec`). 한쪽 단위만 확인되면 그 사실을 한계로 적는다.
- [x] 관련 spec 파일 목록과 각 파일의 `it(` 개수를 실측해 (예: `grep -c "it(" src/assessment-evaluation/evaluation-scoring.service.spec.ts`), 검증 위치 컬럼 `unit` 이 실제 근거를 갖는지 확인한 뒤 spec 경로와 개수를 상태 문자열에 인용한다.
- [x] REQ-033 (52 행) 의 상태 컬럼을 실측 결과에 따라 `PLANNED` → `DONE (implemented-on-main — <근거>)` 또는 근거 부족 시 `PLANNED` 유지 + 유지 사유 부기 중 하나로 갱신한다. 근거에는 실재하는 소스 파일 경로 2 개 이상 + spec 파일 경로 1 개 이상이 포함돼야 한다.
- [x] 실측으로 확인되지 않은 부분 (예: 난이도 3 종 모델 REQ-050 과의 정합, 문서 건 단위의 실 수집→평가 end-to-end 연결, LLM 정성 축과 수치 축의 분리 여부) 은 상태 문자열 안에 "한계 —" 로 1~2 절 부기한다. 확인되지 않은 사실을 DONE 근거로 쓰지 않는다.
- [x] `grep -n "REQ-033" docs/requirements.md` 결과에서 해당 행의 상태 컬럼이 갱신됐고, 표의 컬럼 수 (`|` 구분 8 개) 가 인접 행 (REQ-032 · REQ-034) 과 동일하게 유지됨을 확인한다. `wc -l docs/requirements.md` 와 `grep -c "^| REQ-" docs/requirements.md` 값이 편집 전후 불변임도 확인한다.
- [x] 본 task 파일의 `status` 를 `DONE` 으로 바꾸고 완료 시각·결과 요약 (실측값 포함) 을 추가한다.

## Out of Scope

- 상태 컬럼 외 다른 컬럼 (README 행 번호 · 분류 · phase · 구현 위치 · 검증 위치) 수정 — 검증 위치 컬럼 재판정은 별도 slice 다.
- `src/` · `test/` · `prisma/` 등 코드 · schema 변경 일체 (본 task 는 `commitMode: direct` doc-only). 산정/영속 로직 결함이 보여도 고치지 않는다.
- 난이도 3 종 모델 (REQ-050) 이나 상대 비교 (REQ-036) row 의 재판정 — 각각 별도 slice.
- 새 ADR 작성 또는 기존 ADR status 변경.
- REQ-033 외 다른 `PLANNED` row 재판정 (다음 slice 로 미룬다). 특히 인접한 REQ-036 · REQ-037 은 건드리지 않는다.

## Suggested Sub-agents

`implementer` (doc-only 실측 + 표 갱신). 코드 변경이 0 이므로 tester 는 생략한다 (CLAUDE.md §3.2 R-110 의 direct-mode doc-only 면제).

## Follow-ups

- `requirements-status-resync` 다음 slice 후보: 52 행 바로 아래의 `PLANNED` row 인 REQ-036 (63 행, 상대 비교 + LLM 정성 + Metric 수치) 과 REQ-037 (64 행, 평가 없는 부분 일괄 평가 + Reset & Reeval). 후자는 `src/assessment-evaluation/evaluation-unevaluated-fill-*` 계열과 `unevaluated-fill-run-orchestrator.service.ts` 가 실재해 stale 의심이 크다.
- 별건 (본 task 는 doc-only 라 미수정): 평가 파이프라인에서 `Contribution.sourceType` 이 항상 `""` 로 떨어지는 prefix 불일치 (`buildUnitId()` 는 `github`/`confluence`, `resolveSourceType()` 은 `commit`/`pr`/`issue`/`document` 인정). README 60 행의 "commit 별 / 문서 건 별" 구분을 컬럼 수준에서 살리려면 별도 code task 필요.
