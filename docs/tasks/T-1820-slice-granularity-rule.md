---
id: T-1820
title: Forbid consumer-less helper slices in CLAUDE.md task sizing rule
phase: P5
status: DONE
commitMode: direct
coversReq: []
independentStream: driver-process-reform
dependsOn: []
touchesFiles:
  - CLAUDE.md
estimatedDiff: 40
estimatedFiles: 1
created: 2026-08-31
ownerDirective: "2026-08-31 오너 지시 (1) — 배선 slice 병합 규칙"
plannerNote: 과분할(PR 당 제품 코드 63줄) 차단 — 소비처 없는 helper 단독 PR 금지 룰을 §3 에 박제
---

# T-1820 — 소비처 없는 helper 단독 slice 금지 룰 박제

## Why

2026-08-31 오너 지시 (1). 2026-08-29 ~ 08-31 3 일 실측에서 **PR 43 건의 제품 코드 합이
2,725 줄 (PR 당 평균 63 줄)** 이었고, 같은 기간 test 8,269 줄 · 문서 5,358 줄이 붙었다.
가장 극단적 사례가 [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md)
`§Follow-ups (d)` 의 T-1770 ~ T-1777 로, **"AdminView 에 ServiceIdentity 행별 액션 버튼을
마운트한다" 는 하나의 기능에 PR 8 건**(순수 러너 → 플래그 helper → 어댑터 → props factory
→ row slot → slot factory → 편집 진입 helper → 마운트)이 쓰였다.

각 slice 의 **코드 품질 자체는 문제가 아니다** — `buildServiceIdentityRowActionBridge` 의
(a)~(d) 주석은 "늦게 끝난 요청이 남의 진행 표시를 끄는 창" 같은 실제 결함 시나리오를 근거로
분해한 것이다. 문제는 **절단면이 기능이 아니라 diff 크기**라는 것이다. §3 의 cap
(`diff ≤ 300 LOC`, `변경 파일 ≤ 5개`) 이 상한으로만 작동하고 "무엇이 한 slice 인가" 의
하한을 정하지 않아, planner 가 cap 에 닿지 않는 한 계속 더 잘게 자를 유인을 갖는다.

한 slice 당 붙는 고정비는 task 문서 ~100 줄 + spec ~190 줄 + planner/driver bookkeeping
commit 2 건이다. 제품 63 줄을 위해 이 고정비를 8 번 지불한 것이 T-1770~T-1777 이다.

## Required Reading

- [CLAUDE.md](../../CLAUDE.md) `§3 Task / Commit / PR 원칙` 전체 — 특히 "Task 크기 상한"
  bullet 과 그 아래 "Nit-in-PR closure 의무" bullet. **본 task 는 이 § 에만 손댄다.**
- [.claude/agents/planner.md](../../.claude/agents/planner.md) 의 task 분해 정책 § —
  본 task 는 이 파일을 **수정하지 않지만**, 새 룰이 planner 의 기존 분해 지침과 모순되지
  않는지 확인하기 위해 읽는다 (모순이 있으면 Follow-ups 에 적고 별도 task 로 넘긴다).
- [docs/tasks/T-1773-service-identity-row-actions-props.md](T-1773-service-identity-row-actions-props.md) —
  과분할 사례의 대표 1 건. 이 task 가 왜 T-1772 · T-1774 와 한 PR 이어야 했는지가 새 룰의 근거.

## Acceptance Criteria

1. [CLAUDE.md](../../CLAUDE.md) `§3` 의 "Task 크기 상한" bullet **바로 아래**에 새 bullet
   **"소비처 동반 의무 (slice 하한)"** 을 추가한다. 내용은 다음 3 점을 담는다:
   - **원칙** — 순수 helper / factory / 어댑터를 신설하는 slice 는 **그 helper 를 실제로
     호출하는 소비처 배선을 같은 PR 에 포함**한다. 소비처가 없는 helper 단독 PR 은 금지.
   - **예외** — 소비처까지 넣으면 cap (300 LOC / 5 파일) 을 넘기는 것이 **task 파일에
     수치로 제시된** 경우에만 분리를 허용하고, 그때 helper slice 의 `Follow-ups` 에
     소비처 slice 를 명시적으로 박제한다 (지금처럼 "다음 slice 로 미룬다" 서술만으로는 부족).
   - **판정 주체** — planner 가 task 생성 시 판정하고, 위반은 reviewer 가 MINOR finding
     으로 catch 한다 (§12 언어 정책 위반과 같은 등급 — BLOCKER 아님).
2. 새 bullet 이 §3 의 기존 "다른 주제는 즉시 고치지 말고 Follow-ups 에" 룰 및
   "Nit-in-PR closure 의무" 와 **충돌하지 않음**을 본문 한 문장으로 명시한다
   (helper+소비처는 "다른 주제" 가 아니라 **한 주제의 두 조각**이라는 점이 구분선).
3. 근거를 검증 가능하게 남긴다 — 새 bullet 안에 T-1770~T-1777 (8 PR / 제품 63 LOC 평균)
   을 사례로 1 줄 인용한다.
4. `§0.5 Hard rule 인덱스` 의 8 번 항목 ("1 task = 1 commit / 1 fire = 1 task") 한 줄 요약에
   본 하한 룰을 **한 구절로만** 덧붙인다 (인덱스는 navigation 이므로 조문 복제 금지).

## Out of Scope

- `.claude/agents/planner.md` · `.claude/agents/reviewer.md` 수정 — 두 파일은 `direct`
  대상이지만 본 task 는 CLAUDE.md 1 파일만 건드린다. agent 정의서 동기가 필요하면 Follow-ups.
- cap 수치 (300 LOC / 5 파일) 자체의 변경 — 본 task 는 **하한**만 추가하고 상한은 불변.
- 이미 머지된 T-1770~T-1777 의 되돌림 · 통합 리팩터 — 소급 적용 금지.
- [T-1822](T-1822-adminview-split-debt.md) 의 `sizeExempt` 확장 — 별개 task.

## Follow-ups

- planner.md 의 분해 정책 § 에 본 하한 룰 pointer 추가 (본 task 에서 모순 발견 시 필수화).
- reviewer.md 의 check 목록에 "소비처 없는 helper 단독 slice" MINOR 판정 근거 추가.
