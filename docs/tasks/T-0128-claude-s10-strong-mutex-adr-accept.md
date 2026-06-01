---
id: T-0128
title: "CLAUDE.md §10 multi-entry strong-mutex 모델 개정 + ADR-0009 ACCEPTED 전이"
phase: P3
status: PENDING
commitMode: direct
coversReq: []
estimatedDiff: 40
estimatedFiles: 2
created: 2026-06-01
dependsOn: [T-0126, T-0127]
plannerNote: "ADR-0009 operationalization #2 (완결) — CLAUDE.md §10 '동시 실행 정책' 을 약한 mutex 전제 → ref-CAS 강한 mutex(multi-machine 동시 무장 허용) 로 갱신 + ADR-0009 Status PROPOSED→ACCEPTED 한 줄 전이(§3.1 rule 4 — status 갱신은 direct). LOOP.md(T-0127) + 본 CLAUDE §10 + session 필수(LOOP §4 문서화) 로 ACCEPTED gate 충족."
---

# T-0128 — CLAUDE.md §10 strong-mutex 개정 + ADR-0009 ACCEPTED

## Why

[ADR-0009](../decisions/ADR-0009-strong-ref-cas-lock.md) operationalization 의 두 번째이자 마지막 doc task. [T-0127](T-0127-loop-ref-cas-protocol.md) 이 LOOP.md 의 라이브 프로토콜을 ref-CAS 로 교체했으므로, [CLAUDE.md](../../CLAUDE.md) §10 "동시 실행 정책" 의 약한-mutex 전제 서술을 ref-CAS 강한 mutex(multi-machine `/loop` + cron 동시 무장 허용) 모델로 갱신한다. 그리고 ADR-0009 의 ACCEPTED gate(LOOP §1[1]·§4 개정 + CLAUDE §10 개정 + session 필수 문서화)가 모두 충족되므로 **Status PROPOSED→ACCEPTED** 로 전이한다([CLAUDE.md](../../CLAUDE.md) §3.1 rule 4 — ADR status 한 줄 갱신은 direct).

## Required Reading

- `docs/tasks/T-0128-claude-s10-strong-mutex-adr-accept.md` (본 파일)
- `docs/decisions/ADR-0009-strong-ref-cas-lock.md` — Status 전이 대상 + 모델 원본
- `CLAUDE.md` §10 "동시 실행 정책" (lines ~328-338) — 편집 대상
- `docs/LOOP.md` §1[1]·§4 (T-0127 반영본) — 참조 정합

## Acceptance Criteria

- [ ] **CLAUDE.md §10 "동시 실행 정책" 갱신** — (a) intro 의 "약한 mutex" → ADR-0009 ref-CAS 강한 mutex 명시(약한 mutex 역사 note 보존), (b) rule 1 "/loop 동시 1개 세션만" → ref-CAS 하에 multi-entry(여러 기기 /loop + cron) 동시 무장 허용·단 read 전 fetch 의무·활성 driver 는 여전히 1개 명시, (c) 마지막 단락 "single-operator … 강한 mutex(별도 ADR 필요)로 전환" → ADR-0009 가 그 전환을 이미 제공함으로 갱신.
- [ ] **ADR-0009 Status PROPOSED → ACCEPTED** + 본문의 "ACCEPTED 전이는 …후속 task 머지 후" note 를 실제 전이 사실(T-0127 + T-0128)로 갱신.
- [ ] 편집은 `CLAUDE.md` + `docs/decisions/ADR-0009-strong-ref-cas-lock.md` 2 파일. src/ test/ 변경 0.
- [ ] LOOP.md(T-0127)·ADR-0009 와 서술 정합(모순 0).

## Out of Scope

- **STATE.json schema `session` 필드 형식 강제(런타임 검증) / data-model.md 동기** — session 필수는 LOOP.md §4 + ADR-0009 에 문서화됨. 런타임 검증 스크립트는 별도 task 후보(문서상 ACCEPTED gate 는 충족).
- **cron 환경 gh/MCP 복구 ADR** (ADR-0009 결정 4) — 별도 pr-mode ADR. 본 task scope 0.
- **ref-CAS 실제 동작 통합 테스트 / CI 자동화** — 별도 task 후보.

## Suggested Sub-agents

driver inline (doc-only direct). architect/implementer/tester 미호출.

## Follow-ups

- (planner 예약) cron 환경 gh/MCP 복구 ADR (ADR-0009 결정 4) — pr-mode.
- (planner 예약) ref-CAS lock 동작 검증 스크립트/CI (선택).
