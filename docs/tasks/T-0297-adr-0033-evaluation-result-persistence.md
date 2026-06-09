---
id: T-0297
title: ADR-0033 평가 결과 영속화 데이터 모델 + Prisma migration 전략 (옵션 1 ADR-first 첫 slice)
phase: P5
status: DONE
completedAt: 2026-06-09T15:00:00+09:00
prNumber: 247
result: ADR-0033 작성 완료. reviewer round1 REQUEST_CHANGES(STATE.json invalid JSON 회귀) → ed5f413 수정 → round2 APPROVE → 사용자 머지(squash 92309d7, PR #247). ADR status PROPOSED→ACCEPTED flip 은 본 closeout turn 에서 동반. 후속 dependency-free chain(prisma Contribution @@unique migration → repository write → orchestrator/controller 영속 반환 → doc-sync)은 planner 가 차순위로 큐잉.
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-010, REQ-064]
estimatedDiff: 180
estimatedFiles: 2
created: 2026-06-09
plannerNote: Q-0029 옵션 (1) 승인(P5 평가 영속화)의 ADR-first 첫 slice. EvaluationResult ↔ Assessment/Contribution/Summary 매핑 + R-59 raw 미저장 정합 + 재실행/부분 reset semantics + Prisma migration 전략을 ADR 로 박제. 새 외부 dependency 0. 후속 dependency-free chain(prisma schema → migration → repository write → orchestrator/controller 영속 반환 전환 → doc-sync)의 선행 결정.
---

# T-0297 — ADR-0033 평가 결과 영속화 데이터 모델 + Prisma migration 전략

## Why

P5 평가 backbone(T-0287~T-0293)은 `POST /api/assessment-evaluation/evaluate` 가 `Activity[] → EvaluationResult[]` 를 **in-memory 로만 반환**하는 상태에서 끊겨 있다. orchestrator/controller 가 DB write 를 0 으로 두고 있어 일·주·월 요약·재실행·부분 reset·저성과자 식별 등 거의 모든 P5 잔여 bullet 이 진입 불가다.

사용자가 Q-0029 에서 **옵션 (1) 평가 결과 영속화** 를 승인했다(§5 DB schema migration 게이트 통과, 외부 credential 불요 — CI 실 PostgreSQL ADR-0004). 승인된 진행 방식은 **ADR-first** — 구현 코드/migration 을 짜기 전에 데이터 모델 결정을 ADR 로 먼저 박제한다. 본 task 가 그 첫 slice 다. ADR 이 확정되어야 후속 chain(prisma schema → migration → repository write 배선 → orchestrator/controller 영속 반환 전환 → doc-sync)이 재결정 없이 dependency-free 로 진행된다.

## Required Reading

- `docs/decisions/ADR-0032-p5-evaluation-contract.md` — 본 ADR 이 빌드업하는 상위 평가 계약(통합 평가 입력 / scoring shape / 산출 / dedup)
- `src/assessment-evaluation/domain/evaluation-result.ts` — 영속화 대상 `EvaluationResult` in-memory shape
- `src/assessment-evaluation/domain/evaluation-volume.ts` — volume aggregate shape
- `src/assessment-evaluation/evaluation-orchestrator.service.ts` — 현재 in-memory 반환 지점(DB write hook 위치)
- `docs/architecture/data-model.md` — 기존 entity(Assessment/Contribution/Summary 등)
- `docs/decisions/ADR-0004-*.md` — Prisma migrate-deploy + CI 실 PostgreSQL 패턴(재사용)
- `prisma/schema.prisma` — `PermissionDeniedRecord`(Q-0019) migration 스타일 정합

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0033-evaluation-result-persistence.md` 신규 작성(status: PROPOSED). 포맷은 ADR-0032 mirror(Status / Context / Decision / Consequences / Alternatives, 한국어 본문 / 영어 식별자 — §12).
- [ ] **결정 1 — entity 매핑**: `EvaluationResult` ↔ `Assessment`/`Contribution`/`Summary` 매핑 방향 명시(어느 기존 entity 가 영속 결과를 보유하는가 / 신규 table 도입 여부 / FK 관계 / 일·주·월 aggregate 영속 방식).
- [ ] **결정 2 — R-59 정합**: raw 수집 원문 미저장 확인 — 영속 모델이 평가 파생 데이터만 저장하고 raw activity payload 는 제외함을 field 단위로 명시.
- [ ] **결정 3 — 재실행/부분 reset semantics**: 동일 person/period 재평가 시 upsert vs append vs versioning, 부분 reset 표현, idempotency key(personId + period + unit 등).
- [ ] **결정 4 — Prisma migration 전략**: ADR-0004 migrate-deploy + CI 실 PostgreSQL 재사용, 외부 credential 불요, migration 명명, `PermissionDeniedRecord`(Q-0019) homolog 패턴 참조.
- [ ] 새 외부 dependency 0(내장 Prisma). 추가 dep 가 필요하면 ADR Consequences 에 risk 로 flag 하고 추가 결정은 하지 않음.
- [ ] reviewer 검토 통과 후 별도 1줄 direct 수정으로 status PROPOSED→ACCEPTED flip(후속 task — 본 task 밖).

## Out of Scope

- 실제 `prisma/schema.prisma` model 추가 / migration SQL 작성 / repository write 코드 / orchestrator·controller 영속 반환 전환 — 전부 후속 chain task(ADR 확정 후).
- live LLM run(옵션 2, §5 credential) / 기간 평가 bridge(옵션 3) — 본 task 밖. 옵션 3 은 ADR-0033 확정 후 동일 chain 에서 동행 가능.
- data-model.md 본격 갱신 — 영속 entity 확정(후속 schema task) 후 doc-sync. 본 ADR 에서는 forward-pointing 최소 메모만 허용.
- 새 외부 dependency 추가(§5) — 금지. 필요 시 BLOCKED.

## Suggested Sub-agents

- `architect` — ADR-0033 작성(단일 ADR / 구현 코드 없음). reviewer 가 pr-mode 검토.

## Follow-ups

- ADR-0033 ACCEPTED flip(1줄 direct, reviewer 통과 후).
- prisma schema model 추가 + migration(dependency-free chain 2번째 slice).
- repository write 배선 → orchestrator/controller 영속 반환 전환.
- data-model.md / modules.md / api.md doc-sync.
- 옵션 3 기간 평가 bridge(R-9, L98) — 영속 결정 확정 후.
