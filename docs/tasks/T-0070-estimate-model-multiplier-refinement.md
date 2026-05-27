---
id: T-0070
title: estimate-model.md multiplier refinement — 4 회차 calibration data 박제 + P2002 sub-multiplier 검토
phase: P3
status: PENDING
commitMode: direct
coversReq: [REQ-057, REQ-058]
estimatedDiff: 140
estimatedFiles: 3
created: 2026-05-27T15:35:00+09:00
plannerNote: P3 doc-only direct — session #20 4 회차 calibration data (T-0066~T-0069) 박제 + R-112 backbone multiplier 1.5→1.7 refinement + P2002 sub-multiplier 검토
---

# T-0070 — estimate-model.md multiplier refinement (4 회차 calibration 박제)

## Why

본 task 는 session #20 의 4 회차 estimate vs actual 누적 calibration data (T-0066 +28% under / T-0067 +7% accurate / T-0068 -24% over / T-0069 +45% under) 를 [docs/architecture/estimate-model.md](../architecture/estimate-model.md) 의 §2 case study table 에 박제하고, R-112 backbone multiplier × 1.5 의 systematic under-estimate (4 회차 평균 +14% over base, 단 +45% T-0069 spike 이슈) 를 multiplier × 1.7 refinement 후보로 검토한다. [planner.md](../../.claude/agents/planner.md) §Estimate model 의 multiplier table 도 동기 갱신.

본 refinement 의 가장 큰 단일 ROI: **next session (#21) 의 T-0070 PartService.update + T-0071 PartController @Patch + Person 도메인 후속 task estimate 정확도 직접 향상**. P2002 분기 추가 (Part.name @unique 존재) 가 +60-100 LOC mass 의 systematic source 임을 박제하면 sub-multiplier (예: P2002 분기 추가 backbone × 1.7) 로 calibration 정밀화.

CLAUDE.md §3 cap policy (≤ 300 LOC / ≤ 5 파일) 자체 변경 0 — multiplier 는 planner 의 estimate 직관 calibration 만, executor cap envelope 정책은 불변. estimate-model.md §1 의 정책 박제 그대로 유지.

## Required Reading

- [docs/architecture/estimate-model.md](../architecture/estimate-model.md) — 본 task 의 갱신 대상. §2 case study table (7 회차) + §3 카테고리 정의 + §4 multiplier 산출 + §5 planner 적용 절차 + §6 관측 누적 정책.
- [.claude/agents/planner.md](../../.claude/agents/planner.md) — §Estimate model (L99-121) multiplier table 동기 갱신 대상.
- [docs/tasks/T-0066-group-update-dto-and-repository.md](T-0066-group-update-dto-and-repository.md) — frontmatter estimatedDiff=220 / 본문 actual LOC 검증.
- [docs/tasks/T-0067-group-service-update.md](T-0067-group-service-update.md) — frontmatter estimatedDiff=200 / actual 214 (+7% accurate).
- [docs/tasks/T-0068-group-controller-update.md](T-0068-group-controller-update.md) — frontmatter estimatedDiff=322 / actual 244 (-24% over).
- [docs/tasks/T-0069-part-update-dto-and-repository.md](T-0069-part-update-dto-and-repository.md) — frontmatter estimatedDiff=230 / actual 334 (+45% under, P2002 분기 추가 자연 +60-100 LOC mass).
- [CLAUDE.md](../../CLAUDE.md) §3 — cap policy 불변 source (참조용 only, 본 task 의 변경 대상 아님).

## Acceptance Criteria

본 task 는 `commitMode: direct` (doc-only) 이므로 R-112 unit/error/branch/negative test 대상 코드 변경 0. 검증은 doc 박제 정확성으로 수행.

- [ ] **estimate-model.md §2 case study table 갱신** — 기존 7 회차 (T-0055/T-0056/T-0057/T-0058/T-0061/T-0062/T-0063) 표 아래에 4 회차 추가 row 박제 (T-0066 estimatedDiff=220 / actual=281 / +28% under, T-0067 200/214/+7%, T-0068 322/244/-24% over, T-0069 230/334/+45% under). category 컬럼 — T-0066/T-0067/T-0069 = "R-112 4-카테고리 cover backbone", T-0068 = "R-112 4-카테고리 cover backbone" (controller 분기 박제).
- [ ] **estimate-model.md §2 평균 overrun 갱신** — 7 회차 기존 평균 +79% → 11 회차 누적 평균 재계산 박제. session #20 4 회차 단독 평균도 별도 명시 (분리 박제 — base 누적 vs session 단독 비교 가능).
- [ ] **estimate-model.md §3.1 R-112 4-카테고리 cover backbone 의 sub-pattern 추가 박제** — 본 카테고리 안에서 **P2002 분기 추가 (unique constraint 존재 entity)** 가 systematic +60-100 LOC mass source 임을 박제 (T-0069 vs T-0066 비교 — Part.name @unique 존재 vs Group.name 미정의 차이로 spec test +3~4 it / JSDoc 명시 +20 LOC / repo 분기 명시 +10 LOC). 단락 추가 예상 +15 LOC.
- [ ] **estimate-model.md §4 multiplier 산출 표 갱신** — R-112 4-카테고리 cover backbone × 1.5 의 11 회차 평균 overrun + 본 산출 근거 column 갱신. multiplier × 1.5 → × 1.7 refinement 권장 여부 명시 (예: "11 회차 평균 +X% over → multiplier 1.7 권장, 단 sizeExempt:true 일관성 considering 시 1.5 유지 + sub-multiplier 분리" 또는 "1.7 채택"). **planner 의 명시 결정** 박제 의무 — 본 task 의 결정 = "×1.5 유지 + P2002 분기 sub-multiplier × 1.2 추가 (P2002 unique entity 박제 시 base × 1.5 × 1.2 = × 1.8 effective)" 권장 (T-0066/T-0069 데이터로 정당화).
- [ ] **estimate-model.md §4 P2002 sub-multiplier 추가 row** — § 표 아래 sub-multiplier subsection 추가: "P2002 분기 추가 (unique constraint entity) × 1.2 — T-0069 Part.name @unique 존재 케이스 박제, base R-112 backbone × 1.5 × 1.2 = effective × 1.8". 본문 +10 LOC.
- [ ] **estimate-model.md §5 planner 적용 절차 갱신** — step (2) "카테고리 classification" 에 "P2002 분기 추가 entity 인지 확인 (schema.prisma 의 `@unique` 또는 `@@unique` 박제 entity 면 sub-multiplier × 1.2 추가 적용)" hint 추가. step (3) `estimated = base × multiplier × p2002_sub_multiplier?` 적용 식 갱신.
- [ ] **estimate-model.md §7 References 갱신** — T-0066/T-0067/T-0068/T-0069 task 4 row 추가 박제, Refs footer 도 11 task 누적으로 갱신.
- [ ] **planner.md §Estimate model multiplier table 동기 갱신** — L107 의 R-112 backbone × 1.5 row 의 precedent 컬럼 "T-0055 / T-0056 / T-0057" → "T-0055 / T-0056 / T-0057 / T-0066 / T-0067 / T-0068 / T-0069" 누적 박제. multiplier 자체는 × 1.5 유지 (sub-multiplier 분리 정책) + P2002 sub-multiplier × 1.2 row 추가. estimate-model.md §4 의 sub-multiplier 박제와 정합.
- [ ] **planner.md §Estimate model 적용 절차 동기 갱신** — step (2) 의 카테고리 classification 에 P2002 분기 sub-multiplier 적용 hint 추가. estimate-model.md §5 와 정합.
- [ ] **doc-only direct 검증** — production code 변경 0 / src/ 미접근 / package.json 미접근 확인. doc 변경만으로 main 의 CI step (lint/build/test/smoke/e2e) 영향 0 — direct push to main 후 CI green 유지.
- [ ] **lint 무관 검증** — 본 task 는 doc-only 라 `pnpm lint` / `pnpm test` 실행 의무 없음 (CLAUDE.md §3.1 direct mode 의 doc-only commit 면제). 다만 main push 후 GitHub Actions 가 CI workflow trigger 안 함 (doc-only paths 변경) 확인 — `gh run list --limit 1` 의 latest run 이 본 commit 직전 run 으로 유지.
- [ ] **분기 없음 — R-112 4 카테고리 항목 생략** — doc-only direct commit 은 R-112 의무 면제 (CLAUDE.md §3.2 의 "direct-mode doc-only commit 만 본 규칙 면제").

## Out of Scope

- estimate-model.md 의 §1 정책 박제 (cap policy 불변) 변경. cap policy 자체는 ADR 박제 대상이지 본 doc 의 단순 갱신 task 아님.
- multiplier × 1.5 → × 1.7 의 일괄 raw 갱신. session #20 4 회차 + 기존 3 회차 (T-0055/T-0056/T-0057) 7 회차 누적이라 1 회차 spike (T-0069 +45%) 만으로 raw multiplier 갱신은 ramen-noodle pattern. **sub-multiplier 분리 정책** 채택 (× 1.5 base 유지 + P2002 × 1.2 sub).
- 새 카테고리 신설 (예: P2002-specific category). T-0069 의 P2002 분기 박제는 R-112 4-카테고리 cover backbone 의 sub-pattern 으로 충분.
- planner.md 본문 (Estimate model 섹션 외) 의 다른 단락 갱신. R-112 colocated-spec ordering hint 등 다른 hint 는 본 task scope 외.
- 새 ADR 박제 (예: ADR-NNNN P2002 sub-multiplier 박제). 본 refinement 는 architectural decision 이 아닌 calibration data 박제 라 ADR 의무 0.
- CLAUDE.md §3 의 cap policy 자체 변경. 본 task 는 multiplier 갱신만, cap envelope (≤ 300 LOC / ≤ 5 파일) 불변.
- Part 도메인 후속 task (T-0071 PartService.update / T-0072 PartController @Patch) 작성. 후속 session 의 planner 책임.
- Person 도메인 service/controller spec migration 또는 phase 2 작업.
- HQ-0009 영구 fix ADR (install-gh-cli-in-cron-env 또는 adapt-agents-to-mcp) 박제. 별도 backbone task.

## Suggested Sub-agents

`planner → driver direct commit` (executor 호출 불요 — doc-only direct, sub-agent dispatch 없이 driver 가 직접 doc 편집 후 main 에 commit + push).

## Follow-ups

(빈 상태 — sub-agent 가 추가 박제 시 append)
