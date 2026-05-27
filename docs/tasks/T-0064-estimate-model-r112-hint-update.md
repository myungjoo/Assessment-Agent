---
id: T-0064
title: planner estimate model 갱신 + R-112 colocated-spec hint 강화 doc
phase: P3
status: DONE
completedAt: 2026-05-27
commitMode: direct
coversReq: [REQ-057, REQ-058]
estimatedDiff: 110
estimatedFiles: 3
created: 2026-05-27
plannerNote: cap-bend 7 회차 systematic underestimate 박제 + planner.md estimate guidance 신설 — agent prompt enhancement doc-only direct
---

# T-0064 — planner estimate model 갱신 + R-112 colocated-spec hint 강화 doc

## Why

session #15 ~ session #19 turn 5 시점에 **planner estimate 의 systematic underestimate 7 회차 누적** 박제됨. [p3-to-p4-transition.md §2.5](../architecture/p3-to-p4-transition.md) 가 5 회차 시점 (T-0055/T-0056/T-0057/T-0061/T-0062 평균 +58% over) 의 박제만 보유, 본 task 시점에는 추가로 T-0058 (groups.e2e e2e maxWorkers 정합 +194 LOC vs 80 estimate) + T-0063 (P3→P4 전이 doc +241 LOC vs 80 estimate) 의 doc-only direct 영역까지 cap-bend 발견 — **service/controller-with-R-112-spec backbone 만의 패턴이 아님이 박제**. 본 데이터 후 planner 가 estimate 를 산정할 때의 갱신 규칙 부재 — 매번 직관 estimate 가 actual 대비 -37% ~ -200% underestimate 반복.

본 task 는 **doc-only direct** — 코드 변경 0, 다음 3 산출물:

1. `.claude/agents/planner.md` 안 estimate 가이드 단락 신설 — 7 회차 cap-bend pattern 박제 + estimate calibration multiplier (R-112 4-카테고리 cover backbone × 1.5, doc-only enumerated-section × 1.6, ADR-first split stage × 1.3, single-helper test × 1.0) + cap-bend justification frontmatter pattern (estimate > 300 시 planner-pre-justified note 의무).
2. `docs/architecture/estimate-model.md` 신설 (≤ 70 LOC) — 7 회차 case study (T-0055/T-0056/T-0057/T-0058/T-0061/T-0062/T-0063 의 estimate vs actual 박제 + 카테고리 정의 + multiplier 산출).
3. `.claude/agents/planner.md` 안 R-112 colocated-spec hint 단락 신설 — Required Reading 에 colocated-spec 위치 명시 의무 + tester 호출 시 "module 안 colocated spec 우선, fallback test/helpers prisma-mock" 의 ordering 박제.

본 task 머지 후 **다음 planner dispatch 부터 estimate 가 7 회차 데이터 기반 multiplier 적용** + R-112 colocated-spec 위치 명시 의무 → 후속 task 의 estimate 정확도 + colocated-spec discoverability 양쪽 안정화. **본 task 자체는 cap policy (≤ 300 LOC) 변경 0** — multiplier 는 planner 의 estimate 직관 calibration 만, executor cap envelope 정책은 불변.

## Required Reading

- [.claude/agents/planner.md](../../.claude/agents/planner.md) — 현재 planner agent 정의 전체. 본 task 가 estimate 가이드 단락 + R-112 colocated-spec hint 단락 2 개 신설.
- [docs/architecture/p3-to-p4-transition.md](../architecture/p3-to-p4-transition.md) §2.5 cap-bend pattern observation — 5 회차 박제 source (T-0055/T-0056/T-0057/T-0061/T-0062), 본 task 가 7 회차로 확장 (+ T-0058 + T-0063).
- [docs/tasks/T-0055-group-controller-dto-crud.md](T-0055-group-controller-dto-crud.md) — frontmatter estimatedDiff=300 / actual 413 LOC (+37%) 박제 source.
- [docs/tasks/T-0056-group-service-membership-ops.md](T-0056-group-service-membership-ops.md) — frontmatter estimatedDiff=240 / actual 545 LOC (+127%) 박제 source.
- [docs/tasks/T-0057-group-controller-membership-endpoints.md](T-0057-group-controller-membership-endpoints.md) — frontmatter estimatedDiff=280 / actual 496 LOC (+77%) 박제 source.
- [docs/tasks/T-0058-jest-e2e-max-workers-1-policy.md](T-0058-jest-e2e-max-workers-1-policy.md) — frontmatter estimatedDiff=80 / actual ~274 LOC (+243%) 박제 source (doc + config).
- [docs/tasks/T-0061-smoke-groups-real-postgres.md](T-0061-smoke-groups-real-postgres.md) — frontmatter estimatedDiff=260 / actual 342 LOC (+32%) 박제 source.
- [docs/tasks/T-0062-e2e-groups-real-postgres.md](T-0062-e2e-groups-real-postgres.md) — frontmatter estimatedDiff=300 / actual 406 LOC (+35%) 박제 source.
- [docs/tasks/T-0063-p3-to-p4-transition-evaluation.md](T-0063-p3-to-p4-transition-evaluation.md) — frontmatter estimatedDiff=80 / actual 241 LOC (+201%) 박제 source.
- [CLAUDE.md](../../CLAUDE.md) §3 (task size cap 300 LOC / 5 files) + §3.2 R-112 — 본 task 가 cap policy 자체는 변경 0, multiplier 는 planner 직관 calibration 만.
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — 본 task 가 신규 doc `estimate-model.md` 추가 시 INDEX row 1 줄 추가.

본 task 는 결정 신설 0 (planner agent 정의 의 estimate calibration 단락 + colocated-spec hint 단락 추가만, ADR 미동반) → doc-only direct.

## Acceptance Criteria

### §A — docs/architecture/estimate-model.md 신설

- [ ] `docs/architecture/estimate-model.md` 파일 신설 — 다음 7 단락 포함:
  - **§1 개요** — 본 doc 의 박제 범위 (7 회차 estimate vs actual 박제 + 카테고리 정의 + multiplier 산출 + planner 적용 절차).
  - **§2 7 회차 case study** — T-0055 / T-0056 / T-0057 / T-0058 / T-0061 / T-0062 / T-0063 의 (a) frontmatter estimatedDiff / (b) actual LOC / (c) overrun % / (d) cause classification (R-112 4-카테고리 / doc-only enumerated / ADR-first split / single-helper) 표 박제.
  - **§3 카테고리 정의** — 4 카테고리의 정의 (R-112 4-카테고리 cover backbone / doc-only enumerated-section / ADR-first split stage / single-helper test) + 각 카테고리의 발생 trigger pattern.
  - **§4 multiplier 산출** — 카테고리 별 multiplier (R-112 backbone × 1.5 / doc-only enumerated × 1.6 / ADR-first split × 1.3 / single-helper × 1.0) + 7 회차 case study 기반 산출 과정 박제.
  - **§5 planner 적용 절차** — task 생성 시 estimate 산정 절차 (a) base estimate 직관 / (b) 카테고리 classification / (c) multiplier 적용 / (d) > 300 시 planner-pre-justified note frontmatter 또는 split 결정.
  - **§6 관측 누적 + 갱신 정책** — multiplier 는 향후 회차 누적 시 재산출 (10 회차 / 15 회차 등 milestone), 본 doc 갱신은 planner 의 자체 follow-up task 책임.
  - **§7 References** — 7 task 파일 link + planner.md link + p3-to-p4-transition.md §2.5 link + CLAUDE.md §3 link.

### §B — .claude/agents/planner.md estimate 가이드 단락 신설

- [ ] `.claude/agents/planner.md` 안 `# Decision algorithm` 단락 또는 그 직후에 **`# Estimate model (T-0064 + estimate-model.md 박제 기반)`** 단락 신설 — 다음 항목 포함:
  - estimate-model.md 참조 link + 7 회차 cap-bend 박제 1 줄 요약.
  - 4 카테고리 multiplier table inline (R-112 backbone × 1.5 / doc-only enumerated × 1.6 / ADR-first split × 1.3 / single-helper × 1.0).
  - planner-pre-justified note 의무 — 적용된 multiplier 후 estimate > 300 LOC 인 task 의 frontmatter `plannerNote` 에 "cap-bend pre-justified: <category> × <multiplier> = <est> LOC, <precedent task ID> 패턴 정당화" 명시 의무.
  - cap policy (≤ 300 LOC / ≤ 5 파일) 자체 변경 0 — multiplier 는 planner 직관 calibration 만, executor cap envelope 정책은 불변 명시.

### §C — .claude/agents/planner.md R-112 colocated-spec hint 단락 신설

- [ ] `.claude/agents/planner.md` 안 `# Mandatory Acceptance Criteria (CLAUDE.md §3.2 R-112)` 단락 끝에 **R-112 colocated-spec ordering hint** 추가:
  - task Required Reading 에 colocated spec 위치 (예: `src/user/<module>/<file>.spec.ts`) 명시 의무 — 신규 spec 추가 시 `src/<module>/<file>.spec.ts` (colocated) 우선, helper 공유 시 `test/helpers/<helper>.ts` fallback.
  - tester sub-agent 호출 시 spec 위치 가이드 — colocated 우선, helper 위치 박제 시 explicit.

### §D — docs/architecture/INDEX.md row 추가

- [ ] `docs/architecture/INDEX.md` 에 `estimate-model.md` row 1 줄 추가 — 다른 architecture doc row pattern mirror.

### §E — 본 task 의 cap-bend pre-justified note (self-application)

- [ ] 본 task 의 frontmatter `estimatedDiff: 110` 박제 — doc-only enumerated × 1.6 = base 70 × 1.6 ≈ 112 LOC 의 multiplier 적용. self-validation 으로 본 task 가 본 multiplier 패턴의 첫 dogfood.

### §F — 검증

- [ ] estimate-model.md + planner.md + INDEX.md 의 3 파일 staged 후 `git diff --stat` 으로 net +110 LOC ± 30 LOC 확인 (cap envelope 안).
- [ ] doc 본문 어디에도 새 외부 dependency 추가 0 / 새 코드 0 / 새 ADR 신설 0 — doc-only direct 정합.
- [ ] R-110 면제 (doc-only direct, production code 변경 0, tester sub-agent dispatch 불요).

## Out of Scope

- **cap policy (≤ 300 LOC / ≤ 5 files) 자체 변경 0** — 본 task 는 planner estimate 직관 calibration multiplier 만, executor cap envelope 정책은 불변. cap 변경 결정은 별도 ADR 책임.
- **executor cap-bend bypass 정책 변경 0** — `sizeExempt: true` frontmatter pattern 변경 0.
- **본 task 머지 후 retroactive 의 7 task estimate frontmatter 갱신 0** — 박제된 estimate 는 historical record 로 보존, 본 task multiplier 는 미래 task 에만 적용.
- **planner.md 안 다른 단락 변경 0** — Pre-check / Auto-unblock / Phase entry / coversReq / Decision algorithm / Mandatory Acceptance Criteria 단락 본문 변경 0, **새 단락 2 개 (Estimate model + R-112 colocated-spec hint) 추가만**.
- **estimate-model.md 의 추가 case study 박제 0** — 본 task 는 7 회차만 박제, 후속 회차 누적 시 별도 task 의 책임.
- **agent prompt 의 다른 agent 정의 변경 0** — implementer / tester / reviewer / integrator 정의 변경 0, planner agent 단독.

## Suggested Sub-agents

- `implementer` 단독 (doc-only direct, 3 파일 multi-file edit: estimate-model.md NEW + planner.md 2 단락 추가 + INDEX.md row 추가).
- `architect` 호출 0 (결정 신설 0, 박제만).
- `tester` 호출 0 (R-110 면제, doc-only direct).
- `reviewer` / `integrator` 호출 0 (commitMode=direct, PR 없음).

## Follow-ups

(empty at creation)
