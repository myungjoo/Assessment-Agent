---
id: T-0826
title: P8 부하·내성 테스트 계획 문서 신설 (REQ-047/048 시나리오·임계·접근)
phase: P8
status: DONE
commitMode: direct
coversReq: [REQ-047, REQ-048]
estimatedDiff: 170
estimatedFiles: 3
created: 2026-07-08
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
  - docs/ops/runbook.md
dependsOn: []
independentStream: p8-load-resilience
plannerNote: "P8 line148 부하·내성 테스트 — 유일한 unstarted P8 bullet. 계획 문서 doc-first(T-0821 runbook 패턴 mirror), 신규 dep 판정은 follow-up ADR/BLOCKED. direct doc-only."
---

# T-0826 — P8 부하·내성 테스트 계획 문서 신설

## Why

PLAN.md P8 (line 148) 의 유일한 미착수 bullet `[ ] 부하·내성 테스트` 를 실질 전진시킨다. 본 bullet 은 README 성능 특성(88~92행) 및 requirements.md 의 REQ-047(100~200명 / 50~100 repo / ~1000 confluence / 1h 이내)·REQ-048(조회·시각화 3초 이내, NFR / `perf test`, 둘 다 PLANNED) 을 back 한다. P8 의 다른 3 bullet(145 E2E / 146 보안 / 147 운영 문서) 은 이미 doc-first(T-0821/0824/0825) 로 완결됐다 — 본 task 는 그 패턴을 mirror 해, **부하·내성 테스트의 시나리오·측정 임계·접근 방식·필요 도구를 문서로 먼저 확정**한다.

부하 테스트 harness 실제 구현은 신규 외부 dependency(k6 / artillery / autocannon 등) 를 요구할 가능성이 크다 — CLAUDE.md §5 상 새 dependency 추가는 BLOCKED(사람 승인 → ADR). 따라서 본 task 는 **코드/CI 를 건드리지 않고**, 계획 문서만 신설해 도구 선택 결정을 follow-up 으로 넘긴다(doc-first, file-disjoint, direct).

## Required Reading

- `docs/PLAN.md` (line 143~148 — P8 Hardening & launch 섹션, 특히 line 148 bullet 과 인접 145~147 의 implemented-on-main 서술 형식)
- `docs/requirements.md` (REQ-047 / REQ-048 행 — 91/92 근거, NFR / perf test / PLANNED)
- `README.md` (88~92행 — 성능 특성: 1h 이내 평가 / 조회·시각화 3초 이내)
- `docs/ops/runbook.md` (기존 P8 운영 문서 구조 — cross-link 대상, 서술 형식 참고)
- `docs/ops/daily-deploy-test.md` (기존 ops 문서 형식 참고 — 복제 금지, cross-link 만)

## Acceptance Criteria

- [ ] `docs/ops/load-resilience-test-plan.md` 신설. 다음 섹션을 포함:
  - [ ] §1 **목표·범위** — REQ-047(1h 이내 평가 배치) / REQ-048(조회 3초 이내) 를 인용하며 부하 테스트가 검증할 NFR 을 명시. `perf` 검증 위치(requirements.md enum) 와 연계.
  - [ ] §2 **부하 시나리오** — 최소 3 시나리오를 정량 임계와 함께 정의: (a) 평가 배치 부하(100~200 인원 × 50~100 repo × ~1000 confluence page 규모, 목표 1h 이내), (b) 조회 API 응답 지연(목표 p95 < 3s, REQ-048), (c) 동시 요청 내성(concurrent read/write 하 오류율·지연 저하 관찰).
  - [ ] §3 **측정 지표·임계** — 각 시나리오의 pass/fail 판정 지표(throughput / p50·p95 latency / error rate / 완료 시간)를 표로 명시.
  - [ ] §4 **접근 방식·도구 후보** — 기존 dependency 로 가능한 범위(예: supertest 기반 반복 호출 measure)와 신규 도구 필요 범위(k6 / artillery / autocannon 등)를 구분. **신규 dependency 추가는 CLAUDE.md §5 상 BLOCKED → 별도 ADR/사람 승인 필요**임을 명시하고, 도구 결정 자체는 본 문서 범위 밖(follow-up)으로 둔다.
  - [ ] §5 **follow-up 인덱스** — 실제 harness 구현·CI 통합·도구 도입 ADR 을 후속 task 후보로 나열(본 문서는 계획만).
- [ ] 문서 내 모든 파일/심볼 인용은 origin/main 에 실재하는 경로만 사용(false-positive 링크 0). secret 실값 0.
- [ ] `docs/ops/runbook.md` 에 본 계획 문서로의 cross-link 1줄 추가(기존 §4 운영 전제 또는 §개요 말미 — 인접 섹션 무손상). 복제 서술 금지, 링크만.
- [ ] `docs/PLAN.md` line 148 bullet `[ ] 부하·내성 테스트` 를 **계획 문서 신설 반영 서술로만 확장**(예: `[ ] 부하·내성 테스트 (계획: docs/ops/load-resilience-test-plan.md — harness 구현은 신규 도구 ADR 후 follow-up)`). checkbox 는 **`[ ]` 유지**(실제 harness 미구현이므로 완료 flip 금지 — false-positive 방지). 인접 bullet(145~147) 무손상.
- [ ] 변경 파일 ≤ 3, diff ≤ 300 LOC 확인.

## Out of Scope

- 실제 부하 테스트 harness / 스크립트 작성(신규 dependency 요구 → BLOCKED, 별도 pr-mode task).
- `package.json` / lockfile / `.github/workflows/` 변경(CI 통합은 follow-up).
- 새 ADR 작성(도구 선택 ADR 은 follow-up — 본 task 는 계획 문서만).
- PLAN.md line 148 checkbox 의 `[x]` flip(harness 미구현이므로 금지).
- 성능 최적화 / 코드 변경 일체.

## Suggested Sub-agents

`implementer` (doc-only 이므로 architect 불요, tester 불요 — direct doc-only commit)

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append)
