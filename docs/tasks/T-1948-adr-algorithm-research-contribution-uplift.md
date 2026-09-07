---
id: T-1948
title: ADR-0064 신설 — 새 알고리즘·외부 연구 소개 기여의 결정적 상향 정책 (R-38)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-019]
independentStream: req019-high-contribution-uplift
dependsOn: []
touchesFiles:
  - docs/decisions/ADR-0064-algorithm-research-contribution-uplift.md
estimatedDiff: 175
estimatedFiles: 1
created: 2026-09-07
plannerNote: P5 · REQ-019 IN_PROGRESS 의 "상향 식별·부여 축 부재" 를 ADR-first 로 연다 (doc-only enumerated-section ×1.6 = 175 LOC)
---

# T-1948 — ADR-0064 신설: 새 알고리즘·외부 연구 소개 기여의 결정적 상향 정책 (R-38)

## Why

[README.md](../../README.md) `38 행` (R-38) 은 "새로운 알고리즘의 설계 · 새로운 일거리의 구상 · 외부 연구 도입 소개 자료" 를 **높은 contribution** 으로 간주하라고 지시하는데, [docs/requirements.md](../requirements.md) `38 행` 의 REQ-019 는 `IN_PROGRESS` 로 **상향을 결정하는 결정적 식별 축 · 부여 축이 둘 다 부재** 하다고 판정돼 있다. 직전 ADR-0063 지문 dedup arc (T-1943~T-1947) 가 종결됐으므로 P5 의 다음 실질 공백인 본 축을 연다.

**issue-still-relevant pre-check (origin/main `331d0d45` 실측)** — (1) `docs/decisions/` 에 `ADR-0064` 파일 0 개 (`git ls-tree` 매칭 0), (2) `src/assessment-evaluation/domain/*.ts` 전수에서 `algorithm|research|arxiv|paper` 매칭 **0** 이라 상향 detection 구현 0, (3) 하향 전용 축만 실재 — `evaluation-quality-signal.ts` `137 행` 이 `titleLength <= CONTRIBUTION_QUALITY_TITLE_FLOOR`(`52 행` 상수 = 1) 로 zero 후보만 모으고 `evaluation-quality-adjust.ts` `62 행` 은 대입 값이 `"zero"` 하나뿐인 floor 강등 전용이다, (4) `evaluation-detection-signals-pipeline.ts` `116~121 행` 의 신호 6 종 (abuse / updateCount / quality / underPerformer / notableContribution / documentContribution) 중 R-38 상향 신호는 없다, (5) 동일 의도 task 0 — 기존 매칭 4 건은 하향 arc (T-0527~T-0529) 와 재판정 (T-1374) 뿐이다.

**왜 ADR-first 인가** — 평가 layer 가 볼 수 있는 metadata 키는 origin/main 전수에서 `titleLength` · `version` · `contentFingerprint` **3 종뿐** 이라 (REQ-032 raw 미저장 불변) "새 알고리즘 · 외부 연구 소개" 를 판별할 입력 자체가 없다. 즉 결정 대상이 구현 방식이 아니라 **정책** (파생 신호를 어느 경계에서 만들 것인가 · 오탐이 곧 등급 왜곡인 판별 규칙 · 기존 floor 강등과의 우선순위) 이라 코드 선행이 불가하다 — ADR-0063 이 같은 이유로 정책을 먼저 박제한 선례를 따른다.

**게이트 확인** — 새 dependency 0 · Prisma schema 변경 0 · 기존 ADR 충돌 0 (ADR-0032 `25 행` 은 R-37 / R-38 을 scope 로만 나열하고 상향 규칙을 결정하지 않았으므로 본 ADR 은 augment) 이라 CLAUDE.md `§ 5` 게이트 3 종 미해당. 오너 게이트 미침범 — PLAN `157 행` (k6) · `158 행` (`test/perf/`) 은 무변경이고, `183 행` once-rule 대로 **REQ-019 재판정은 본 task 에서 하지 않고** 구현 slice 전량 머지 뒤 doc-sync 1 회로 유예한다.

## Required Reading

- [README.md](../../README.md) `37~39 행` — R-37 (zero) / R-38 (high) / R-39 원문.
- [docs/requirements.md](../requirements.md) `38 행` — REQ-019 IN_PROGRESS 판정문 (식별 축 · 부여 축 부재 근거 좌표).
- [docs/decisions/ADR-0063-commit-content-fingerprint-dedup.md](../decisions/ADR-0063-commit-content-fingerprint-dedup.md) — mapper 경계 파생 scalar + 오탐 하한 + 2-pass 순서 결정을 담은 직전 선례 (문서 구조 mirror 대상).
- [docs/decisions/ADR-0032-p5-evaluation-contract.md](../decisions/ADR-0032-p5-evaluation-contract.md) `25 행` — R-37 / R-38 scope 서술 (충돌 여부 확인용).
- [src/assessment-evaluation/domain/evaluation-quality-signal.ts](../../src/assessment-evaluation/domain/evaluation-quality-signal.ts) `52 행` · `115 행` · `137 행` — 하향 전용 판정식.
- [src/assessment-evaluation/domain/evaluation-quality-adjust.ts](../../src/assessment-evaluation/domain/evaluation-quality-adjust.ts) `62 행` · `144 행` — floor 강등 값과 대입 지점.
- [src/assessment-evaluation/domain/evaluation-document-contribution-signal.ts](../../src/assessment-evaluation/domain/evaluation-document-contribution-signal.ts) `1~45 행` — detection → consume → orchestrator 3-slice 패턴의 최근 선례.
- [src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) `24~55 행` — 현행 adjuster 8 단 고정 순서.
- [src/assessment-collection/domain/github-activity.mapper.ts](../../src/assessment-collection/domain/github-activity.mapper.ts) `130 행` 부근 `buildMetadata` — 파생 scalar 를 얹을 후보 경계.
- [src/assessment-collection/domain/activity.ts](../../src/assessment-collection/domain/activity.ts) `38~43 행` — `ActivityMetadata` scalar-only 계약.

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0064-algorithm-research-contribution-uplift.md` 1 개를 신설하고 frontmatter 에 `id: ADR-0064` · `status: PROPOSED` · `date: 2026-09-07` · `relatedTask: T-1948` 를 둔다 (파일 존재 + frontmatter 값 확인).
- [ ] `## Decision` 에 아래 5 항을 **각각 채택안 + 기각한 대안 1+ 와 그 기각 사유** 형태로 적는다.
  - [ ] (1) **신호 산출 경계** — 평가 layer 가 보는 metadata 키가 `titleLength` · `version` · `contentFingerprint` 3 종뿐이라는 실측을 근거로, 파생 신호를 수집 mapper 경계에서 만들지 / 평가 domain 에서 만들지 확정하고 노출 형태 (scalar 1 개, 키 이름, 타입) 를 정한다.
  - [ ] (2) **판별 규칙** — 대상 활동 kind 범위 · 판별 입력 · 임계 (오탐 차단 하한 포함) 를 결정하고, 오탐이 곧 **부당한 등급 상향** 이라는 비용 비대칭을 근거로 보수 임계를 택한 이유를 적는다.
  - [ ] (3) **부여 축** — `contribution` 을 `"high"` 로 올리는 adjuster 의 **단조 상향 전용** (하향 금지) 계약, `applyContributionQualityFloor` 의 `"zero"` 하한과의 우선순위, `evaluation-adjustments-pipeline.ts` 현행 8 단 중 삽입 위치와 그 순서를 택한 근거를 확정한다.
  - [ ] (4) **LLM 산출과의 관계** — `classifyNarrative` 의 `DEFAULT_CONTRIBUTION = "low"` 환원을 결정적 상향이 어떻게 보완하는지, LLM 이 이미 `"high"` 를 낸 경우의 멱등성을 명시한다.
  - [ ] (5) **영속 · 불변 영향** — REQ-032 raw 미저장 불변 유지 (raw 본문 필드 신설 0), Prisma 컬럼 신설 0, `contributionScore` 등간격 매핑 재사용을 명시한다.
- [ ] `## Consequences` 에 오탐 (부당 상향) · 미탐 (실 high 기여 누락) 양방향 위험과 각각의 완화책을 적는다.
- [ ] `## Follow-ups` 에 구현 chain 을 **파일 · 심볼 단위** 로 (a) mapper 파생 신호 slice, (b) detection helper + `evaluation-detection-signals-pipeline.ts` 배선, (c) uplift adjuster + `evaluation-adjustments-pipeline.ts` 배선, (d) doc-sync (ADR ACCEPTED 승격 + REQ-019 재판정 1 회 + PLAN 서술) 로 분해하고, 각 slice 가 cap (≤ 300 LOC / ≤ 5 파일) 안임을 예상 수치로 적는다.
- [ ] ADR 이 인용하는 모든 파일 경로 · 행 좌표를 origin/main 에서 실측 확인 (본문에 적은 좌표와 실제 파일이 일치).
- [ ] 새 외부 dependency 0 · Prisma schema 변경 0 · 기존 ADR 과의 충돌 0 을 ADR 본문에 명시한다. 셋 중 하나라도 필요하다고 판단되면 문서를 강행하지 말고 CLAUDE.md `§ 5` 대로 BLOCKED 로 종료한다.
- [ ] production 코드 변경 0 LOC — `src/` · `web/` · `test/` · `prisma/` · `package.json` · `.github/workflows/` diff 0 (`git diff --stat` 으로 확인).
- [ ] R-110 대로 tester 를 호출해 `pnpm lint && pnpm build && pnpm test` green 확인. 코드 0 LOC 이라 신규 spec 0 이 정당하며, R-112 4 축 (happy / error path / 분기별 / 예외 분기마다 negative) 은 Follow-ups (b)(c) 구현 slice 가 진다 — 그 사실을 ADR `## Follow-ups` 에 선박제한다.
- [ ] `pnpm test:cov` 통과 — line ≥ 80% AND function ≥ 80% 유지 (코드 무변경이므로 회귀 0 확인).

## Out of Scope

- 코드 구현 일체 — mapper 파생 신호 · detection helper · uplift adjuster · pipeline 배선은 전부 Follow-ups slice 다 (본 task 는 정책만).
- `docs/requirements.md` REQ-019 재판정 · `docs/PLAN.md` 품질 분류 bullet 서술 갱신 — CLAUDE.md `§ 3.1` once-rule 대로 구현 slice 전량 머지 뒤 (d) doc-sync 에서 1 회만.
- 기존 하향 축 (`evaluation-quality-signal.ts` / `evaluation-quality-adjust.ts`) 의 판정식 · 상수 변경.
- 두 quality 파일 주석의 `REQ-037 / REQ-038` 오기 정정 (REQ-019 판정문이 지적한 별건 drift — Follow-ups 로만).
- Prisma schema · migration · 새 외부 dependency · LLM prompt 문구 변경.
- `test/perf/` 및 k6 관련 일체 (PLAN `157 행` · `158 행` 오너 게이트).

## Suggested Sub-agents

`architect → tester`

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
