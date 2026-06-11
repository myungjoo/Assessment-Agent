---
id: T-0343
title: ADR-0036 §Decision 8 (d) — STATE concurrencyIncidents 카운터 schema 자리 박제 (회로 차단기 1/2)
phase: P5
status: PENDING
commitMode: direct
coversReq: [TBD]
estimatedDiff: 60
estimatedFiles: 2
created: 2026-06-11
independentStream: stage5-default-on-safeguards
dependsOn: []
touchesFiles: [docs/STATE.json, docs/architecture/concurrency.md]
plannerNote: "P5 / ADR-0036 §rollout stage5 의 §Decision 8 (d) 회로 차단기 구현 chain 의 첫 dependency-free slice — STATE concurrencyIncidents schema 자리만 박제(강등 분기는 후속 LOOP slice). 토글 OFF 불변."
---

# T-0343 — ADR-0036 §Decision 8 (d): STATE `concurrencyIncidents` 카운터 schema 자리 박제 (회로 차단기 1/2)

## Why

사용자가 2026-06-11 대면 세션에서 ADR-0036 stage 5 진입(토글-ON rollout 시작)을 명시 지시했고, 이는 ADR-0036 §rollout stage 5 의 "stage 5 의사결정" 게이트를 충족한다. §rollout stage 5 는 **"먼저 §Decision 8 (a)~(d) 를 구현 → 그 후 5a→5b→5c 이행"** 으로 정의되어 있으나, T-0341(설계 박제) / T-0342(doc-sync) 는 cross-ref 만 — 실제 구현은 아직 0이다.

본 task 는 그 구현 chain 의 **첫 dependency-free slice** — §Decision 8 (d) 회로 차단기의 **STATE `concurrencyIncidents` 카운터 schema 자리**만 박제한다. ADR-0036 §Decision 8 (d) / concurrency.md §7 (d) 가 정의한 4 유형 슬러그(`double-claim` / `merge-conflict-code` / `reclaim-misfire` / `ci-cost-overrun`)를 STATE schema 에 0 으로 초기화해 둠으로써, 후속 slice(LOOP §1[2] 의 "같은 유형 2회 → 자동 토글 OFF 강등 + notifier" 분기)가 참조할 데이터 자리를 먼저 만든다. 자리 박제는 회로 차단기 강등 분기보다 선행 의존이므로 본 slice 가 chain 의 첫 단계다.

본 slice 는 **schema 자리 + 문서 동기만** — `flags.fineGrainedConcurrency` 토글 값은 `false` 불변이고 driver 동작 변화 0이다(forward-looking spec). 실제 incrementing / 강등 분기는 후속 LOOP slice 책임이다.

## Required Reading

- docs/STATE.json (전체 — 특히 `counters` block 과 `adr0036Rollout` block 의 위치·형식. `concurrencyIncidents` 를 어디에 둘지 결정)
- docs/decisions/ADR-0036-fine-grained-concurrency.md §Decision 8 (d) (회로 차단기 — 4 유형 슬러그·2회 임계·자동 강등·재활성 사람 결정의 권위 정의)
- docs/architecture/concurrency.md §7 (d) (회로 차단기 인지 박제 — 본 task 가 schema 운영 view 를 여기에 추가)

## Acceptance Criteria

- [ ] `docs/STATE.json` 에 `concurrencyIncidents` object 를 신설한다. ADR-0036 §Decision 8 (d) 의 4 유형 슬러그를 **카운터 key 로 0 초기화**한다: `{ "double-claim": 0, "merge-conflict-code": 0, "reclaim-misfire": 0, "ci-cost-overrun": 0 }`. 위치는 `counters` block 인접(또는 `adr0036Rollout` 인접) — 어느 쪽이든 schema 정합·JSON valid 가 유지되면 무방. note/주석 필드로 "토글 OFF 동안 inert — 강등 분기는 후속 LOOP slice" 1줄 박제 권장.
- [ ] `docs/architecture/concurrency.md` §7 (d) 단락(또는 그 직후)에 **`concurrencyIncidents` schema 운영 view** 를 박제한다: 4 유형 슬러그의 의미, 같은 유형 2회 누적 시 lock-하 자동 토글 OFF 강등(§Decision 8 (d) 권위 참조), 본 slice 는 schema 자리만이고 강등 분기·incrementing 은 후속 slice 책임임을 명시. ADR-0036 §Decision 8 (d) 가 단일 권위임을 cross-ref.
- [ ] `python -c "import json; json.load(open('docs/STATE.json'))"` 또는 동등 수단으로 STATE.json 이 valid JSON 임을 확인(또는 driver 의 STATE write 단계가 parse 가능 확인).
- [ ] `flags.fineGrainedConcurrency` 값은 `false` 불변임을 확인(변경 금지).
- [ ] 분기 없음(doc/schema 정합 task) — R-112 4종 test 항목은 commitMode direct doc-only 이므로 생략. 변경이 STATE schema 자리 + 문서 동기뿐이고 코드/동작 변화 0임을 확인.

## Out of Scope

- **회로 차단기 강등 분기 구현** — LOOP §1[2] 에 "같은 유형 2회 누적 → lock-하 `flags.fineGrainedConcurrency = false` 자동 강등 + notifier HQ" 분기 추가는 **후속 slice**(본 task 의 schema 자리에 의존). 본 task 는 자리만 박제한다.
- **incrementing 로직** — driver 가 언제 어느 유형을 +1 하는지(double-claim 탐지 / merge-conflict-code BLOCKED / reclaim-misfire / ci-cost-overrun)는 후속 slice.
- §Decision 8 (a)/(b)(select/pickup 런타임 재검증, pr) · (c)(integrator merge-전 rebase, direct) 구현 — 별도 task.
- `flags.fineGrainedConcurrency` 토글 값 변경(여전히 `false`) · `maxConcurrentClaims` 필드 도입(5a 진입 slice 책임).
- ADR-0036 §Decision 8 권위 본문 수정 — 본 task 는 schema 자리 + 운영 view 동기만, ADR 본문 불변.

## Suggested Sub-agents

`implementer` 단독(direct doc-only — STATE schema 자리 + concurrency.md 운영 view 동기). 코드 변경 0 이라 tester 불요(R-110 direct doc-only 면제), CI 는 doc-only push 라 trivially green.

## Follow-ups

(작성 시점 비어있음 — sub-agent 가 관련 작업 발견 시 append)
