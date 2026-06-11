---
id: T-0347
title: ADR-0036 §Decision 8 (d) — concurrencyIncidents incrementing 시점 LOOP 박제 (회로 차단기 incrementing)
phase: P5
status: PENDING
commitMode: direct
coversReq: [TBD]
estimatedDiff: 60
estimatedFiles: 1
created: 2026-06-11
independentStream: stage5-default-on-safeguards
dependsOn: []
touchesFiles: [docs/LOOP.md]
plannerNote: "P5 / ADR-0036 §rollout stage5 §Decision 8 (d) — 회로 차단기가 읽는 concurrencyIncidents 4유형을 driver 가 언제 +1 하는지 LOOP 의 각 탐지 시점에 박제(direct doc, 토글 OFF 불변)."
---

# T-0347 — ADR-0036 §Decision 8 (d): concurrencyIncidents incrementing 시점 LOOP 박제

## Why

사용자가 2026-06-11 대면 세션에서 ADR-0036 stage 5 진입을 명시 지시했고, §rollout stage 5 는 **"먼저 §Decision 8 (a)~(d) 를 구현 → 5a→5b→5c 이행"** 으로 정의된다. §Decision 8 (a)~(d) 안전장치는 ALL 완결됐다 — (d) 회로 차단기의 schema 자리(T-0343)와 강등 분기(T-0344: "같은 유형 2회 누적 → lock-하 자동 OFF + notifier"), (c) integrator merge-전 rebase(T-0345), (a)(b) claim 후보 런타임 재검증(T-0346)이 모두 머지됐다.

그러나 회로 차단기 강등 분기(T-0344)는 `concurrencyIncidents` 카운터가 **2회 누적됐는지 판정**할 뿐, **언제 어느 유형을 +1 하는지**(incrementing)는 명시적으로 후속 slice 로 유보됐다(T-0344 Out of Scope, concurrency.md §7.1 "incrementing 은 후속 slice"). incrementing 절차가 박제되지 않으면 4 유형 카운터가 영영 0 으로 고정되어 **회로 차단기가 결코 trigger 되지 않는다** — 안전장치 (d) 가 무력화된 상태다.

본 task 는 그 incrementing 을 채운다 — [docs/LOOP.md](../LOOP.md) 의 **각 탐지 시점**에 "해당 유형 발생 시 driver 가 lock(critical section)-하에서 `concurrencyIncidents.<type> += 1` 을 STATE 에 write(§9 single-writer — driver write)" 절차를 박제한다. 4 유형의 탐지 시점은:

- **`double-claim`** — §1[2] (b) 의 select+claim 직후 driver 가 claims.json 을 재확인했을 때 같은 taskId 가 2개 이상 claim 으로 박혀 있는 정황을 탐지한 시점(이론상 lock-하 atomic select+claim 으로 0 이어야 하지만, 만약 관측되면 incrementing).
- **`merge-conflict-code`** — §4 (iii) 의 코드 영역(src/, web/, test/) rebase 충돌로 `BLOCKED, reason=merge-conflict-code` 분기에 진입한 시점(파일-disjoint 인코딩이 틀렸거나 semantic conflict).
- **`reclaim-misfire`** — §1[2] (a) 의 reclaim 호출로 회수한 orphan claim 이 사후에 실제로는 살아있었다고 판명된 시점(clock-skew 등 — server-time fail-closed 가 1차 방어인데 그것을 뚫고 오회수가 관측된 경우).
- **`ci-cost-overrun`** — §1[2]/§5 의 동시 PR CI 관측에서 동시에 도는 PR CI run 수가 N 선형 비용 상한을 초과함을 관측한 시점(§Decision 6 per-PR concurrency group 이 1차 방어).

`flags.fineGrainedConcurrency` 토글 값은 `false` 불변이라 driver 동작 변화 0(forward-looking spec) — incrementing 도 토글 ON 일 때만 의미를 가진다.

## Required Reading

- docs/LOOP.md §1[2] (현행 본문 — 특히 claim-pickup 분기 (a) reclaim 호출 / (b) select+claim / 회로 차단기 강등 분기 lines 77~97. 본 task 가 (a)(b) 와 회로 차단기 분기에 incrementing 시점을 끼워넣음)
- docs/LOOP.md §4 (충돌-안전 push 절차 — 특히 (iii) "코드 영역 conflict → BLOCKED, reason=merge-conflict-code" 분기 line 154. 본 task 가 이 분기에 `merge-conflict-code += 1` 박제)
- docs/decisions/ADR-0036-fine-grained-concurrency.md §Decision 8 (d) (회로 차단기 — 4 유형 슬러그·2회 임계·lock-하 자동 강등의 권위 정의. incrementing 시점은 본 task 가 LOOP 절차로 구현)
- docs/architecture/concurrency.md §7.1 (`concurrencyIncidents` schema 운영 view + 4 유형 "언제 driver 가 +1 하는가" 표 lines 183~188. 본 task 가 그 "언제" 를 LOOP 절차로 박제 — concurrency.md 표가 의미 정의, LOOP 가 절차 구현)
- docs/STATE.json 의 `concurrencyIncidents` block (T-0343 박제 — 4 슬러그 0 초기화. 본 incrementing 이 write 할 데이터 자리)

## Acceptance Criteria

- [ ] docs/LOOP.md 의 **4 탐지 시점 각각에 incrementing 절차를 박제**한다 — 각 시점에서 driver 가 lock(critical section)-하에서 `concurrencyIncidents.<type> += 1` 을 STATE 에 write(§9 single-writer — driver write, counters read-modify-write 방식: origin 최신값 +1)한다는 것을 명시:
  - (1) **`double-claim`** — §1[2] (b) select+claim 직후 claims.json 재확인 시 같은 taskId 가 2개 이상 claim 으로 박힌 정황 탐지 → `concurrencyIncidents.double-claim += 1`.
  - (2) **`merge-conflict-code`** — §4 (iii) 코드 영역(src/, web/, test/) rebase 충돌로 `BLOCKED, reason=merge-conflict-code` 분기 진입 시 → `concurrencyIncidents.merge-conflict-code += 1`.
  - (3) **`reclaim-misfire`** — §1[2] (a) reclaim 으로 회수한 claim 이 사후 실제로 살아있었다고 판명된 시점 → `concurrencyIncidents.reclaim-misfire += 1`.
  - (4) **`ci-cost-overrun`** — §1[2]/§5 동시 PR CI 관측에서 동시 PR CI run 수가 N 선형 비용 상한 초과 관측 시 → `concurrencyIncidents.ci-cost-overrun += 1`.
- [ ] 각 incrementing 이 **lock(critical section)-하 driver write** 임을 명시한다(STATE single-writer §9 정합 — counters origin+1 read-modify-write, 절대값 덮어쓰기 금지). incrementing 자체는 절차 박제일 뿐 실제 STATE write 코드가 아니라 driver 가 절차를 따라 STATE 에 write 함을 분명히 한다(§9 driver 책임).
- [ ] 본 incrementing 이 **회로 차단기 강등 분기(T-0344, §1[2] 회로 차단기 분기)의 "2회 임계 판정"이 읽는 카운터를 채운다**는 cross-ref 를 박제한다 — incrementing 없으면 카운터 0 고정 → 회로 차단기 영영 inert 임을 1줄 명시.
- [ ] 본 incrementing 절차가 토글 OFF(현 기본값, `flags.fineGrainedConcurrency=false`) 동안 **inert/forward-looking** 임을 명시한다 — 토글 ON 일 때만 의미를 가지며 현 stage 에서 driver 동작 변화 0. 단일 권위 = ADR-0036 §Decision 8 (d) / concurrency.md §7.1 cross-ref.
- [ ] `flags.fineGrainedConcurrency` 값 · STATE `concurrencyIncidents` schema · ADR-0036 §Decision 8 권위 본문 · concurrency.md §7.1 은 **변경하지 않는다**(본 task 는 LOOP 절차 박제만). docs/LOOP.md 외 파일 변경 0.
- [ ] 분기 없음(direct doc-only LOOP 절차 박제) — R-112 4종 test 항목은 commitMode direct doc-only 이므로 생략. 변경이 LOOP 절차 문서뿐이고 코드/동작 변화 0임을 확인.

## Out of Scope

- **실제 STATE write 코드/자동화** — incrementing 의 실 write 는 driver 가 절차를 따라 STATE.json 에 직접 수행(§9 driver 책임). 본 task 는 LOOP 에 "언제 +1 하는지" 절차만 박제하며, write 를 자동화하는 스크립트/코드는 도입하지 않는다.
- **incrementing 자동화 테스트** — incrementing 절차의 정확성 테스트는 별도 slice(토글 ON 후 dogfood 관측 또는 별도 검증 task).
- **5a 진입** (`maxConcurrentClaims=1` 필드 + `flags.fineGrainedConcurrency` 토글 ON 첫 단계) — §Decision 8 (a)~(d) 구현(본 incrementing 포함) 완료 후 별도 direct slice. 토글 ON(런타임 활성)이라 신중히 별도 turn/세션.
- §Decision 8 회로 차단기 **강등 분기 자체**(2회 판정 → 자동 OFF + notifier) — T-0344 에서 이미 완결. 본 task 는 그 분기가 읽는 카운터를 채우는 incrementing 만.
- `flags.fineGrainedConcurrency` 토글 값 변경(여전히 `false`) · STATE `concurrencyIncidents` schema 수정(T-0343 자리 그대로 사용).
- ADR-0036 §Decision 8 권위 본문 · concurrency.md §7/§7.1 수정 — 본 task 는 LOOP 절차 박제만, 권위 doc 불변(cross-ref 만).

## Suggested Sub-agents

`implementer` 단독(direct doc-only — docs/LOOP.md 의 4 탐지 시점에 incrementing 절차 박제). 코드 변경 0 이라 tester 불요(R-110 direct doc-only 면제), CI 는 doc-only push 라 trivially green.

## Follow-ups

(작성 시점 비어있음 — sub-agent 가 관련 작업 발견 시 append)
