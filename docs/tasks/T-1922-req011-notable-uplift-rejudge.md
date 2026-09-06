---
id: T-1922
title: REQ-011 재판정 1 회 — 중요기여 "더 높은 점수" 축 안착 반영 + PLAN 104 행 bullet 정정
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-011]
estimatedDiff: 60
estimatedFiles: 3
created: 2026-09-06
independentStream: req-011-notable-contribution-uplift
dependsOn: [T-1921]
touchesFiles:
  - docs/requirements.md
  - docs/PLAN.md
  - docs/tasks/T-1922-req011-notable-uplift-rejudge.md
plannerNote: "T-1921 머지 후 REQ-011 재판정 1 회 — CLAUDE.md §3.1 REQ 당 1 회 · PLAN 183 행 왕복 제거 준수 (doc-only direct)"
---

# T-1922 — REQ-011 재판정 1 회 (중요기여 "더 높은 점수" 축 안착 반영 + PLAN 104 행 bullet 정정)

## Why

[T-1921](T-1921-notable-contribution-score-uplift.md) 이 README `25 행` 뒷절 "더 높은 점수" 축을 구현해 머지(PR #1508 → main `65694f5b`)되면서 REQ-011 의 유일한 미충족 축이 닫혔다. [CLAUDE.md](../../CLAUDE.md) `§3.1` 은 REQ status 재판정 task 를 "그 REQ 를 구현하는 slice 가 머지된 뒤 REQ 당 1 회만" 생성하라고 못박고, [docs/PLAN.md](../PLAN.md) `183 행` 오너 지시(REQ 재판정 왕복 제거 — 구현 후 1 회만)도 같은 것을 요구한다. 식별 축 · annotation 축(T-0534)이 머지될 때는 재판정하지 않았고 마지막 구현 slice 가 이제 닫혔으므로 **지금이 REQ-011 의 유일한 판정 시점**이다.

**issue-still-relevant pre-check (planner 실측, origin/main `b21ba12f`).** ① **문서 쪽은 아직 미정정**이다 — `docs/requirements.md` `30 행` REQ-011 이 여전히 `IN_PROGRESS (중요·어려운 기여 식별 축 · pipeline wiring 축 실재 / README 25 행 뒷절의 "더 높은 점수" 부여 축 부재: ...)` 로 시작하고, 같은 행이 "'더 높은 점수' 는 미구현이고 현재는 중요기여 **사실의 외화** 까지만 도달했다", "파일 30~32 행 주석이 ... 점수 반영은 별도 task", "5-adjuster ... 중 **5 번째** 이자 flatten 직전" 이라고 단언한다 — 세 문장 모두 T-1921 머지로 무효가 됐다. ② **구현 쪽은 안착 완료**다 — `git grep -n "applyNotableContributionUplift\|NOTABLE_CONTRIBUTION_UPLIFT_LEVEL" origin/main -- 'src/**'` 가 비-spec 파일에서 `evaluation-notable-contribution-adjust.ts` `185 행`(상수) · `202 행`(함수) 와 `evaluation-adjustments-pipeline.ts` `77 행`(import) · `243 행`(호출) 을 hit 하고, pipeline 은 이제 (5) annotation → (6) uplift → (7) flatten 구조다. 영속 축도 실재 — `evaluation-result.persist.mapper.ts` `104 행` `contributionLevelToScore`(zero=0/low=1/medium=2/high=3)를 `147 행` 이 `contributionScore` 로 쓰고 `190~191 행` 이 Assessment 수준 평균으로 집계하므로 상향된 `"high"` 는 실제 저장 점수를 올린다. 즉 재큐잉이 아니라 **문서만 뒤처진 상태**다.

**cap · 소비처 판정.** `docs/` 만 건드리는 doc-only 라 [CLAUDE.md](../../CLAUDE.md) `§3.1` 판정은 `direct` 이고, 소비처 동반 의무(§3)는 helper 신설 0 이라 해당 없다. estimate 는 planner estimate model 의 doc-only enumerated-section(× 1.6) × inline-amend sub(× 0.4) = effective × 0.64 로 ~60 LOC(선례 T-1913 · T-1914 · T-1919 동형). 경쟁 축은 자율 집행 불가 — PLAN `157 행` R-91 은 배포기기 자격증명 게이트(§5), `158 행` R-92 는 오너의 신규 per-route slice 큐잉 금지, [T-1920](T-1920-reset-contribution-cascade-e2e.md) `Follow-ups (a)`(응답 `deletedContributions` 노출)는 그 자체가 계약 변경이라 ADR 선행 대상이다.

## Required Reading

- [docs/tasks/T-1921-notable-contribution-score-uplift.md](T-1921-notable-contribution-score-uplift.md) — 구현 slice 의 설계 규칙(고정 목표 등급 · `"zero"` 하한 우선 · 멱등 · 단조 비하향)과 `Follow-ups`. 본 task 가 이행하는 지정 후속이다.
- [docs/requirements.md](../requirements.md) `30 행`(REQ-011 단일 행 전체 — 약 4,000 자) + 표 헤더 `18~19 행`(컬럼 순서) + `9 행`(상태 enum 정의). 인접 `29 행` · `31 행` 은 `|` 필드 수 대조용으로만 읽는다.
- [docs/PLAN.md](../PLAN.md) `104 행`(R-25 bullet 전체 — checkbox 는 이미 `- [x]` 이고 본문이 annotation 까지만 서술한다) 과 `183 행`(오너 지시 — 재판정 왕복 제거 원칙 확인용).
- `src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.ts` `181~185 행`(`NOTABLE_CONTRIBUTION_UPLIFT_LEVEL`) · `187~201 행`(계약 주석 — 규칙 1~6) · `202~236 행`(`applyNotableContributionUplift` 본문) 과 `28~34 행`(옛 "점수 반영은 별도 task" 주석의 현재 상태). **인용할 행 번호는 파일에서 직접 재확인**한다.
- `src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts` `36~48 행`(파일 머리 step 목록 — 5 notable annotation / 6 notable uplift / 7 flatten) 과 `231~248 행`(실제 (5) → (6) → flatten 배선). 옛 "5-adjuster · 5 번째 이자 flatten 직전" 서술을 대체할 실측 좌표다.
- `src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts` `100~104 행`(`contributionLevelToScore`) · `147 행`(`contributionScore` 매핑) · `171~191 행`(Assessment 수준 평균 집계) — "상향이 실제 저장 점수에 도달한다" 는 영속 축 근거.
- `src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.spec.ts` 및 `src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts` — uplift 를 덮는 describe / `it` 좌표. **개수는 실측**으로 세어 인용한다(옛 행의 "adjust.spec 19 it" 은 T-1921 이후 stale 이다).
- [docs/tasks/T-1919-req037-reset-endpoint-rejudge-plan-checkbox.md](T-1919-req037-reset-endpoint-rejudge-plan-checkbox.md) `Acceptance Criteria` — 상태 문자열 포맷(`DONE (implemented-on-main — <근거>)` + `한계 —` 부기)과 표 무결성 검증 절차의 선례. **실측값은 복사하지 말고 직접 재확인**한다.

## Acceptance Criteria

- [ ] **REQ-011 상태 문자열 재작성 (`docs/requirements.md` `30 행`)** — T-1921 로 무효가 된 문장을 실측 기반으로 교체한다: (1) 상태 prefix 의 `IN_PROGRESS (... "더 높은 점수" 부여 축 부재: ...)`, (2) 본문의 "'더 높은 점수' 는 미구현이고 현재는 중요기여 사실의 외화 까지만 도달했다" 및 "점수 반영은 별도 task" 인용, (3) wiring 축의 "5-adjuster ... 5 번째 이자 flatten 직전" 서술 → 현행 (5) annotation → **(6) uplift** → (7) flatten 구조와 실제 행 번호. 인용하는 행 번호 · `it` 개수는 **본 task 실행 시점에 파일에서 재확인한 값**이어야 한다.
- [ ] **상태 enum 판정** — 식별 축 · pipeline wiring 축 · **등급 상향 축** · **점수 영속 축** 4 축이 모두 실측 충족이면 `DONE (implemented-on-main — ...)` 로 전이한다. 어느 한 축이라도 미충족이면 승격하지 말고 `IN_PROGRESS (<충족 축> / <미충족 축>)` 를 유지하되 사유를 실측으로 갱신한다(근거 없는 승격 금지 · 과장 금지).
- [ ] **상향 계약 서술 추가** — 새 문단에 실측 좌표와 함께 적는다: 고정 목표 등급 `"high"` single-source(한 등급씩 올리는 step 방식은 재적용 시 비멱등이라 고정 등급 채택), `"zero"` 는 quality floor 하한 우선으로 무변경, `"low"`/`"medium"` → `"high"` 상향, 이미 `"high"` 면 멱등, enum 외 값은 무변경, author-level 판정이라 notable author 의 **모든** 단위가 대상, annotation 과 필드 직교(`narrative` 무접촉). pipeline 배치가 step (3) quality floor **뒤**여야 하한 우선이 성립한다는 순서 제약도 1 문장으로 남긴다.
- [ ] **한계 부기 유지 · 갱신** — 여전히 유효한 항목만 `한계 —` 절에 보존한다: (a) 검증 위치 `manual` 축의 문서화된 수동 검증 절차가 `docs/` 에 부재하고 본 축을 직접 덮는 e2e / smoke 가 0, (b) `NOTABLE_RELATIVE_CEILING = 1.5` 의 dogfood calibration 부재, (c) "어렵고 남이 못할 일" 을 코드 단위 **개수** 로만 근사(변경 라인 수 · 난이도 메타 미사용), (d) 상대 비교 모집단이 batch 구성에 따라 흔들림, (e) 오탐 해제(사람 개입) 경로 부재, (f) `prisma/schema.prisma` 에 notable 전용 컬럼 0 — 중요기여 **사실** 자체는 여전히 narrative marker 로만 남는다. **이미 해소된 항목**("더 높은 점수" 미구현 · 정량 필드 무접촉)은 남기지 않는다.
- [ ] **표 무결성 검증** — 편집 후 `awk 'NR==30' docs/requirements.md | grep -o "|" | wc -l` 이 `8` 로 인접 `29 행` · `31 행` 과 동일하고, 상태 문자열 안에 리터럴 `|` 문자가 없으며(T-1370 · T-1375 사고 재발 방지), `wc -l docs/requirements.md` = `121` 과 `grep -c "^| REQ-" docs/requirements.md` = `84` 가 편집 전후 불변임을 확인한다.
- [ ] **PLAN `104 행` bullet 정정** — checkbox 는 이미 `- [x]` 이므로 **체크 상태는 건드리지 않고**, `implemented-on-main` 서술이 annotation 까지만 열거하는 것을 `applyNotableContributionUplift`(T-1921, PR #1508) 추가와 pipeline (6) 단계 배선으로 보강한다. 옛 "v1 순서 마지막 notable adjuster 로 배선" 표현이 현행 순서와 어긋나면 실측 순서로 정정한다.
- [ ] **행 수 불변** — 편집 후 `wc -l docs/PLAN.md` 가 `196`, `wc -l docs/requirements.md` 가 `121` 로 유지된다(행 추가 · 삭제 없이 기존 두 행의 in-place 수정만).
- [ ] `docs/` 밖 파일 변경 0 — `git status --short` 에 `src/` · `test/` · `web/` 경로가 나타나지 않는다. direct doc-only 라 [CLAUDE.md](../../CLAUDE.md) `§3.2` R-110 tester 호출은 면제이고, R-112 test 기준도 코드 변경 0 이라 해당 없다.
- [ ] 본 task 파일의 frontmatter `status` 를 `DONE` 으로 바꾸고 본문 끝에 완료 시각 · 실측 요약(인용한 행 번호 · `it` 개수 · 최종 상태 enum)을 1~3 줄로 추가한다.

## Out of Scope

- `src/` · `test/` · `web/` **코드 수정 일체** — 본 task 는 `commitMode: direct` doc-only 다. `NOTABLE_RELATIVE_CEILING` 재튜닝 · notable 전용 컬럼 신설 · uplift e2e 추가는 전부 `Follow-ups` 에만 적는다.
- **다른 REQ 행 재판정** — 특히 REQ-019(`38 행`) · REQ-020(`39 행`) 은 문서 · 조직 기여 축이라 코드 단위 기반 notable 신호의 uplift 로 자동 충족되지 않는다. 두 행을 같은 commit 에 넣으면 실측 부담이 겹쳐 판정이 흐려진다(선례 T-1914 · T-1919 Out of Scope 동형).
- **PLAN `104 행` 의 checkbox 상태 변경** 및 다른 bullet 수정 — `157 행` R-91 · `158 행` R-92 · `183 행` 오너 지시 bullet 은 손대지 않는다.
- **새 ADR 작성 · 기존 ADR 결정 변경** — 목표 등급 `"high"` 를 다른 값으로 바꾸거나 상향 정책을 확장하는 것은 새 결정이라 별도 범위다.
- **README.md 수정** — REQ 의 source 는 README 이고 본 task 는 추적 문서만 정정한다.

## Suggested Sub-agents

`implementer` (문서 편집 + 실측 검증). direct doc-only 라 tester 면제(§3.2 R-110).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 추가한다.)
