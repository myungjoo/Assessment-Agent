---
id: T-0102
title: estimate-model.md 100 task milestone refinement — session #23~#27 누적 박제
phase: P3
status: PENDING
commitMode: direct
coversReq: [REQ-057, REQ-058]
estimatedDiff: 120
estimatedFiles: 1
created: 2026-05-30
dependsOn: []
plannerNote: doc-only inline-amend × 0.64 — 100 task milestone refinement, session #23~#27 누적 박제 (doc-only inline-amend 7 회차 + pr-mode partial-backbone 8 회차 + single-file-create 1 회차 + cleanup-only 1 회차 신규 sub-pattern 2 종)
---

# T-0102 — estimate-model.md 100 task milestone refinement

## Why

`docs/architecture/estimate-model.md` 는 session #22 시점 **15 회차 milestone** 박제 snapshot. session #23~#27 5 세션 동안 16 회차 cap-bend 신규 데이터 누적 — counters.tasksCompleted **100 task milestone 도달** (T-0101 머지 시점). 본 task 는 estimate-model.md §2 case study table 확장 + §3 카테고리 정의 갱신 (single-file-create / cleanup-only 신규 sub-pattern 2 종 박제 후보) + §4 multiplier 재산출 (× 0.4 inline-amend sub-multiplier 의 7 회차 누적 검증) + §6 갱신 정책 다음 milestone marker (20 → 30 회차) 박제다.

신규 박제 데이터 4 카테고리:

1. **doc-only inline-amend (7 회차)** — T-0084 ×0.37 + T-0088 ×0.19 + T-0089 ×0.91 + T-0093 ×0.23 + T-0096 ×0.17 + T-0097 ×0.16. 평균 약 -67% over-estimate (systematic over-estimate 일관성 유지, 기존 T-0070 / T-0073 / T-0076 3 회차 + 본 7 회차 → 총 10 회차로 sub-multiplier × 0.4 calibration band 강화).
2. **pr-mode partial-backbone R-112 (8 회차)** — T-0083 ×1.77 + T-0086 ×2.28 + T-0087 ×2.18 + T-0091 ×1.86 + T-0094 ×2.19 + T-0095 ×2.34 + T-0099 ×2.53 + T-0101 ×1.98. 평균 약 ×2.14 (envelope partial-backbone × 1.3 의 R-112 spec mass underestimate 패턴 박제 — production 약 100 LOC envelope 정합, 나머지 mass 가 spec / e2e). multiplier 재산출 후보 (× 1.3 → × 2.0).
3. **doc-only single-file-create (T-0100 1 회차)** — `.gitattributes` 신설 ×2.07. 기존 inline-amend (× 0.4) 와 NEW-doc creation (× 1.6) 사이 별도 sub-pattern 후보 — 단일 신설 파일이라 NEW-doc enumerated section 보다 무거움 + inline-amend 보다 큼. 1 회차 박제 만으로는 multiplier 분리 보류 (CLAUDE.md §3 ramen-noodle pattern 회피).
4. **cleanup-only (T-0098 1 회차)** — 13 PR close + 13 branch delete = 26 외부 effect ×0.15. 단발 사례, 다음 cleanup-only 2 회차 발생 후 박제 후보.

doc-only direct (CLAUDE.md §3.1 — `docs/architecture/*.md` 기존 파일 inline-amend, 신규 production code / CI workflow / dependency manifest 변경 0) → 1 commit / 1 파일. planner inline-amend sub-multiplier × 0.4 적용: base ~75 LOC × 1.6 × 0.4 = effective × 0.64 ≈ 48 LOC, cap-band variance 고려해 envelope 120 LOC.

## Required Reading

- `C:\Users\myung\Assessment-Agent\docs\architecture\estimate-model.md` — 갱신 대상 (15 회차 milestone snapshot)
- `C:\Users\myung\Assessment-Agent\docs\tasks\T-0083-rbac-roles-decorator-and-guard.md` — pr-mode partial-backbone ×1.77 source (frontmatter `actualDiff` 박제)
- `C:\Users\myung\Assessment-Agent\docs\tasks\T-0086-user-service-change-role.md` — pr-mode partial-backbone ×2.28 source
- `C:\Users\myung\Assessment-Agent\docs\tasks\T-0087-user-controller-patch-role.md` — pr-mode partial-backbone ×2.18 source
- `C:\Users\myung\Assessment-Agent\docs\tasks\T-0091-jwt-auth-guard-and-cookie.md` — pr-mode partial-backbone ×1.86 source
- `C:\Users\myung\Assessment-Agent\docs\tasks\T-0094-auth-controller-signup.md` — pr-mode partial-backbone ×2.19 source
- `C:\Users\myung\Assessment-Agent\docs\tasks\T-0095-user-response-dto.md` — pr-mode partial-backbone ×2.34 source
- `C:\Users\myung\Assessment-Agent\docs\tasks\T-0099-get-users-list-endpoint-admin-tier.md` — pr-mode partial-backbone ×2.53 source
- `C:\Users\myung\Assessment-Agent\docs\tasks\T-0101-get-user-detail-endpoint-self-or-admin.md` — pr-mode partial-backbone ×1.98 source
- `C:\Users\myung\Assessment-Agent\docs\tasks\T-0098-stale-cron-pr-cleanup.md` — cleanup-only ×0.15 source (신규 sub-pattern 후보)
- `C:\Users\myung\Assessment-Agent\docs\tasks\T-0100-gitattributes-eol-lf-permanent-fix.md` — single-file-create ×2.07 source (신규 sub-pattern 후보)

## Acceptance Criteria

- [ ] A. `docs/architecture/estimate-model.md` §1 개요 갱신 — "15 회차" → "31 회차" milestone marker + 100 task milestone 도달 cross-ref + session #22 → session #27 시점 박제 source 확장.
- [ ] B. §2 case study table 확장 — §2.4 다음에 §2.5 "session #23~#27 16 회차 추가 박제 (T-0083 / T-0086 / T-0087 / T-0091 / T-0094 / T-0095 / T-0098 / T-0099 / T-0100 / T-0101 + doc-only inline-amend 6 회차)" sub-section 박제. table 16 row (task / category / estimatedDiff / actual LOC / overrun %) + 평균 overrun 누적 결과.
- [ ] C. §3.2.2 inline-amend sub-pattern 박제 갱신 — 기존 "3 회차" → "10 회차" 누적 (기존 T-0070 / T-0073 / T-0076 + 신규 T-0084 / T-0088 / T-0089 / T-0093 / T-0096 / T-0097 / T-0088 sequence). systematic over-estimate 일관성 박제 강화 (× 0.4 sub-multiplier value 변경 0 — 10 회차 모두 under-estimate 0 회차 유지).
- [ ] D. §3 신규 sub-pattern 후보 박제 — "§3.5 single-file-create (T-0100 1 회차)" + "§3.6 cleanup-only (T-0098 1 회차)" sub-section 박제 (각 1 회차 데이터만으로 multiplier 분리 보류 → 다음 2 회차 발생 후 박제). 정의 + trigger pattern + precedent + 향후 박제 marker.
- [ ] E. §3.1 R-112 4-카테고리 cover backbone 부분-backbone sub-pattern 갱신 — "partial-backbone" 정의 추가 (DTO / repository 재활용 + service / controller 신규 만 박제) + 8 회차 precedent + 평균 ×2.14 박제. **multiplier 재산출 후보** — 현 × 1.3 → × 2.0 calibration 검토 marker (실 8 회차 데이터로 × 2.0 권고 + multiplier value 변경은 별도 follow-up task 결정 — 본 task scope 0).
- [ ] F. §4 multiplier 표 footnote 갱신 — "partial-backbone ×2.0 재산출 후보" + "single-file-create / cleanup-only 1 회차 누적, multiplier 분리 보류" marker.
- [ ] G. §6 갱신 정책 milestone marker 갱신 — "20 회차 milestone" → "30 회차 milestone" + 100 task counters milestone 박제 marker. 본 task (T-0102) 가 31 회차 milestone marker.
- [ ] H. §7 References table 16 신규 task entry 추가 — T-0083 / T-0084 / T-0086 / T-0087 / T-0088 / T-0089 / T-0091 / T-0093 / T-0094 / T-0095 / T-0096 / T-0097 / T-0098 / T-0099 / T-0100 / T-0101 (각 task 파일 link + actualDiff / 카테고리 한 줄).
- [ ] I. STATE / journal bookkeeping — STATE.json `lastActivity` 갱신 + journal `## <time> driver` 항목 append. counters.tasksCompleted 100→101, mostRecentTasks prepend T-0102 (cap 5).

분기 없음 — doc-only direct inline-amend 단일 파일 갱신. R-112 4 카테고리 (happy/error/branch/negative test) 는 doc-only direct mode 라 면제 (CLAUDE.md §3.2 R-110 면제 분기). 단 갱신 후 estimate-model.md 의 §2 table sum + §4 multiplier 표의 cross-ref 정합 grep 검증이 본 task 의 "test 수행" 역할.

## Out of Scope

- partial-backbone multiplier × 1.3 → × 2.0 실제 변경 — 본 task 는 calibration marker 박제 only, multiplier value 변경은 별도 follow-up task (검증 8 회차 → 10 회차 누적 + reviewer 합의 후).
- single-file-create / cleanup-only sub-pattern 의 별도 multiplier 분리 — 각 1 회차 박제 만으로는 정책 변경 금지 (CLAUDE.md §3 ramen-noodle pattern 회피), 다음 2 회차 발생 후 박제.
- planner.md 의 multiplier table 동기 갱신 — estimate-model.md 갱신 후 planner.md 의 multiplier table 도 동기 갱신 필요하나 별도 task (doc-only inline-amend × 0.4 1 회차 추가).
- p3-to-p4-transition.md 의 cap-bend section 동기 갱신 — 동일하게 별도 task.
- 누적 평균 overrun 재산출 (15 회차 +30% → 31 회차 평균) 의 정확성 검증 — 본 task 는 박제 marker only, 정확한 계산은 다음 calibration cycle.
- ADR 신설 — estimate-model.md 갱신 자체는 ADR 불요 (장기 정책 변경 0).
- 후속 single-file-create / cleanup-only 카테고리 분리 결정 — 본 task scope 0.

## Suggested Sub-agents

driver inline 경로 권장 (sub-agent dispatch 0). doc-only direct inline-amend 단일 파일 갱신 + grep 검증 + bookkeeping 1 commit. T-0084 / T-0088 / T-0089 / T-0093 / T-0096 / T-0097 driver inline 패턴 1:1 mirror (7 회차 누적).

## Follow-ups

(empty — driver 가 작업 중 발견 시 append)
