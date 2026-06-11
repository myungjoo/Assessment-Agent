---
id: T-0344
title: ADR-0036 §Decision 8 (d) — LOOP §1[2] 회로 차단기 강등 분기 박제 (회로 차단기 2/2)
phase: P5
status: PENDING
commitMode: direct
coversReq: [TBD]
estimatedDiff: 50
estimatedFiles: 1
created: 2026-06-11
independentStream: stage5-default-on-safeguards
dependsOn: [T-0343]
touchesFiles: [docs/LOOP.md]
plannerNote: "P5 / ADR-0036 §rollout stage5 §Decision 8 (d) 회로 차단기 2/2 — T-0343 schema 자리 위에 LOOP §1[2] '같은 유형 2회 → lock-하 자동 OFF 강등 + notifier' 판정·강등·notifier 분기 명시(direct doc, 토글 OFF 불변)."
---

# T-0344 — ADR-0036 §Decision 8 (d): LOOP §1[2] 회로 차단기 강등 분기 박제 (회로 차단기 2/2)

## Why

사용자가 2026-06-11 대면 세션에서 ADR-0036 stage 5 진입을 명시 지시했고(adr0036Rollout.stage5 = IN_PROGRESS), §rollout stage 5 는 **"먼저 §Decision 8 (a)~(d) 를 구현 → 5a→5b→5c 이행"** 으로 정의된다. 직전 slice T-0343(DONE)이 §Decision 8 (d) 회로 차단기의 **STATE `concurrencyIncidents` 카운터 schema 자리**(4 유형 슬러그 0 초기화 + concurrency.md §7.1 운영 view)를 박제해 회로 차단기 **1/2** 를 완료했다.

본 task 는 그 **2/2** — T-0343 의 schema 자리에 직접 의존해, [docs/LOOP.md](../LOOP.md) §1[2] 에 회로 차단기의 **강등 분기를 명시적 절차 sub-step 으로 박제**한다: driver 가 `concurrencyIncidents` 의 같은 유형 카운터가 **2회 누적**됨을 판정하면, lock(critical section)-하에서 `flags.fineGrainedConcurrency = false` 로 **자동 OFF 강등**하고 **notifier(HQ)** 로 보고한다(재활성=사람 결정). 현 LOOP §1[2] 본문(stage5 안전장치 의무 단락)은 이 강등을 한 줄 inline 으로만 언급하므로, 본 task 가 그것을 (a) 2회 임계 판정 → (b) lock-하 토글-OFF write → (c) notifier 보고 의 독립 절차 sub-step 으로 승격한다. "CI 3연속 fail → BLOCKED" 와 동형 self-healing 으로, 기본-ON 을 one-way door 로 만들지 않는 보험이다.

본 slice 는 **강등 판정+강등 write+notifier 보고 분기만** — incrementing 로직(언제 어느 유형을 +1 하는가)은 후속 slice 책임이며, `flags.fineGrainedConcurrency` 토글 값은 `false` 불변이라 driver 동작 변화 0(forward-looking spec)이다.

## Required Reading

- docs/LOOP.md §1[2] (현행 본문 — 특히 lines 70~82 "토글 ON 시 driver 의 stage5 안전장치 의무" 단락. 회로 차단기 강등 언급이 현재 한 줄 inline 으로 박혀 있음. 본 task 가 그것을 독립 절차 sub-step 으로 승격)
- docs/decisions/ADR-0036-fine-grained-concurrency.md §Decision 8 (d) (회로 차단기 — 4 유형 슬러그·2회 임계·lock-하 자동 강등·notifier·재활성 사람 결정의 권위 정의)
- docs/architecture/concurrency.md §7 (d) + §7.1 (회로 차단기 인지 박제 + T-0343 의 `concurrencyIncidents` schema 운영 view·강등 계약. 본 task 의 LOOP 분기가 이 계약을 절차로 구현)
- docs/STATE.json 의 `concurrencyIncidents` block (T-0343 박제 — 4 슬러그 0 초기화. 본 분기가 참조할 데이터 자리)

## Acceptance Criteria

- [ ] docs/LOOP.md §1[2] 에 **회로 차단기 강등 분기를 명시적 sub-step 으로 박제**한다 — 현 inline 언급을 다음 3 단계가 분명히 드러나는 절차로 승격: (1) **2회 임계 판정** — driver 가 [1] 의 lock(critical section) 보유 상태에서 STATE `concurrencyIncidents` 의 같은 유형(`double-claim` / `merge-conflict-code` / `reclaim-misfire` / `ci-cost-overrun`) 카운터가 **2 이상**인지 검사, (2) **lock-하 자동 OFF 강등** — 충족 시 lock 보유 상태에서 `flags.fineGrainedConcurrency = false` 로 write(STATE single-writer §9 정합 — driver write), (3) **notifier 보고** — 강등 사유(어느 유형이 2회 누적인지)를 담은 humanQuestion(HQ) 항목을 notifier 로 생성하고 **재활성(토글 재-ON)은 사람 결정**임을 명시.
- [ ] 본 분기가 토글 OFF(현 기본값) 동안 **inert** 임을 명시한다 — `flags.fineGrainedConcurrency == true` 일 때만 incrementing/판정이 의미를 가지며, 현 stage 에서는 driver 동작 변화 0(forward-looking spec). ADR-0036 §Decision 8 (d) 가 단일 권위임을 cross-ref.
- [ ] **incrementing 로직은 본 task 범위 밖**임을 LOOP 본문에 1줄 명시한다(언제 어느 유형을 +1 하는가 = 후속 slice). 본 분기는 "2회 도달 시 강등" 판정·강등·notifier 만 담당.
- [ ] `flags.fineGrainedConcurrency` 값·STATE schema·ADR-0036 §Decision 8 권위 본문은 **변경하지 않는다**(본 task 는 LOOP 절차 박제만). docs/LOOP.md 외 파일 변경 0.
- [ ] 분기 없음(direct doc-only LOOP 절차 박제) — R-112 4종 test 항목은 commitMode direct doc-only 이므로 생략. 변경이 LOOP §1[2] 절차 문서뿐이고 코드/동작 변화 0임을 확인.

## Out of Scope

- **incrementing 로직 구현** — driver 가 언제 어느 유형(`double-claim` 탐지 / `merge-conflict-code` BLOCKED / `reclaim-misfire` / `ci-cost-overrun`)을 +1 하는지는 **후속 slice**. 본 task 는 "2회 누적 판정 → 강등 → notifier" 분기만.
- §Decision 8 (a)/(b) (select/pickup 런타임 재검증 — `touchesFiles` 교집합 0 · `dependsOn` 머지 재검증, commitMode pr scripts) · (c) (integrator.md merge-전 rebase + CI green 재확인, commitMode direct) 구현 — 별도 task.
- **5a 진입** (`maxConcurrentClaims=1` 필드 + 토글 ON 첫 단계) — §Decision 8 (a)~(d) 구현 완료 후 별도 direct slice.
- `flags.fineGrainedConcurrency` 토글 값 변경(여전히 `false`) · STATE `concurrencyIncidents` schema 수정(T-0343 자리 그대로 사용).
- ADR-0036 §Decision 8 권위 본문 · concurrency.md §7/§7.1 수정 — 본 task 는 LOOP §1[2] 절차 박제만, 권위 doc 불변(cross-ref 만).

## Suggested Sub-agents

`implementer` 단독(direct doc-only — docs/LOOP.md §1[2] 회로 차단기 강등 분기 절차 박제). 코드 변경 0 이라 tester 불요(R-110 direct doc-only 면제), CI 는 doc-only push 라 trivially green.

## Follow-ups

(작성 시점 비어있음 — sub-agent 가 관련 작업 발견 시 append)
