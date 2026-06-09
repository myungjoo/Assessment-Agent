---
id: T-0304
title: ADR-0035 batch/aggregate 평가 + Summary 영속화 데이터 모델·설계 (Q-0030 옵션 1 ADR-first 첫 slice)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-010, REQ-064]
estimatedDiff: 210
estimatedFiles: 2
created: 2026-06-09
plannerNote: Q-0030 옵션 (1) 승인(batch/aggregate 평가 + Summary 영속화)의 ADR-first 첫 slice. ADR-0033 이 단위 평가(Assessment/Contribution) 영속화를 닫았으므로 그 위의 일·주·월 요약(Summary) layer 를 ADR 로 박제한다. Summary 집계 규칙(metric deterministic 집계 + LLM 정성 narrative batch prompt 경계 = ADR-0032 §2 deferred) + Summary 영속화 매핑(ADR-0033 §Follow-up deferred slice 닫음) + R-61/README L63 시점 경계 + 재실행/부분 reset semantics 를 결정. 새 외부 dependency 0(내장 Prisma + 기존 LlmHttpGateway mocked-LLM unit) / 외부 credential 0(CI 실 PostgreSQL ADR-0004). ADR 번호는 ADR-0034 가 orphan PR #249(lock-CAS doc, 미머지)에 선점돼 충돌 회피로 ADR-0035 채택. 후속 dependency-free chain(prisma Summary schema → migration → aggregate 평가 service → orchestrator/controller 배선 → doc-sync)의 선행 결정.
---

# T-0304 — ADR-0035 batch/aggregate 평가 + Summary 영속화 데이터 모델·설계

## Why

ADR-0033(T-0298~T-0303)이 **단위 평가 결과 영속화**를 end-to-end 로 닫았다 — `POST /api/assessment-evaluation/evaluate` 가 `Activity[] → EvaluationResult[]` 를 산출하고 `Assessment`/`Contribution` 에 실 DB write(fill/reeval/partial-reset)한다. 다음 backbone 은 그 위의 **일·주·월 요약(Summary) 평가 layer** 다(README L61·L63·L71 / PLAN P5 L97 / ADR-0032 §2 deferred batch prompting / ADR-0033 §Follow-up deferred Summary slice).

사용자가 Q-0030 에서 **옵션 (1) batch/aggregate 평가 + Summary 영속화** 를 승인했다(/loop AskUserQuestion). 승인된 진행 방식은 **ADR-first** — 구현 코드/migration 전에 설계 결정을 ADR 로 먼저 박제한다. 본 task 가 그 첫 slice 다. 이 layer 는 (a) metric 수치의 deterministic 집계와 (b) LLM 정성 narrative 의 batch prompt 경계가 섞여 있어 새 design 결정이 필요했고(그래서 planner 단독 권한 밖 → Q-0030 escalate), ADR 이 확정되어야 후속 chain(prisma Summary schema → migration → aggregate 평가 service → orchestrator/controller 배선 → doc-sync)이 재결정 없이 dependency-free 로 진행된다.

## Required Reading

- `docs/decisions/ADR-0032-p5-evaluation-contract.md` — 상위 평가 계약. 특히 §2 의 "batch prompting = 상위 layer 후속 slice" deferred 결정(본 ADR 이 그 경계를 확정)
- `docs/decisions/ADR-0033-evaluation-result-persistence.md` — 단위 평가 영속화 ADR. §Follow-up 의 deferred "Summary 영속화 slice"(본 ADR 이 닫음) + 재실행/부분 reset semantics(Summary 와 정합 필요)
- `src/assessment-evaluation/domain/evaluation-result.ts` — Summary 가 집계하는 단위 `EvaluationResult` shape
- `src/assessment-evaluation/domain/evaluation-volume.ts` — volume aggregate shape(집계 참고)
- `src/assessment-evaluation/evaluation-result.persist.mapper.ts` 및 `evaluation-result-persist.service.ts` — Summary layer 가 빌드업하는 단위 영속화 매퍼/write service(집계 입력원)
- `docs/architecture/data-model.md` — 기존 entity(Assessment/Contribution/Summary 등) — `Summary` entity 현 정의 확인
- `prisma/schema.prisma` — 기존 model + `Summary`(존재 시) + migration 스타일(`PermissionDeniedRecord` Q-0019 homolog)
- `docs/decisions/ADR-0004-*.md` — Prisma migrate-deploy + CI 실 PostgreSQL 패턴(재사용)
- `README.md` L61(당일 활동 자정까지 미평가 / 종료된 날짜 요약 평가문 저장) · L63(주간/월간 요약 = LLM 정성 + Metric 수치 함께 보유) · L71(일/주/월 지표 변화 조회) — 본 layer 의 요구 출처
- `docs/PLAN.md` P5 섹션(L96~106) — 일·주·월 평가 실행 bullet

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0035-aggregate-summary-evaluation.md` 신규 작성(status: PROPOSED). 포맷은 ADR-0032/0033 mirror(Status / Context / Decision / Consequences / Alternatives, 한국어 본문 / 영어 식별자 — §12).
- [ ] **결정 1 — Summary 집계 규칙**: 단위 `EvaluationResult`/`Contribution[]` → 일·주·월 `Summary` 집계 방식. 어떤 metric 이 **deterministic 집계**(합/평균/분포 등 — LLM 불요)이고 어떤 산출이 **LLM 정성 narrative batch 평가**인지 field 단위로 분리 명시(README L63 "정성 평가 + Metric 수치 함께 보유" 정합).
- [ ] **결정 2 — Summary 영속화 매핑**: `Summary` entity ↔ `Assessment`/`Contribution` 관계, 신규 table/컬럼 여부, FK, 일·주·월 granularity 구분(enum), period 표현. ADR-0033 §Follow-up deferred "Summary 영속화 slice" 를 명시적으로 닫음. R-59 raw 미저장 정합(평가 파생만 저장) 재확인.
- [ ] **결정 3 — 시점 경계(R-61 / README L63)**: 당일 활동은 자정까지 미평가 / 주간은 다음 주 / 월간은 다음 달 — 평가 시점 trigger **규칙**(시점 판정 함수 경계)을 정의. timezone 보정(Q-0026 deferred SinceDerivation)과의 관계 명시. **실제 scheduler 자동화(@nestjs/schedule)는 본 ADR 밖**(새 dep, P7) — 본 ADR 은 "언제 평가 가능한가" 판정 규칙만.
- [ ] **결정 4 — 재실행/부분 reset semantics**: 동일 person/period/granularity 재집계 시 upsert vs versioning, idempotency key(personId + period + granularity), 부분 reset 표현. ADR-0033 의 단위 reset-and-recreate 와 정합.
- [ ] **결정 5 — batch prompt 경계(ADR-0032 §2)**: LLM 1회 호출에 묶는 단위 범위(한 person 의 period 내 Contribution[] vs cross-person), mocked-LLM unit test 로 검증 가능한 경계, live 검증은 후속 §5 credential 로 분리 명시.
- [ ] 새 외부 dependency 0(내장 Prisma + 기존 `LlmHttpGateway`). 추가 dep 가 필요하면 ADR Consequences 에 risk 로 flag 하고 추가 결정은 하지 않음(BLOCKED 대상).
- [ ] reviewer 검토 통과(pr-mode). status PROPOSED→ACCEPTED flip 은 후속 1줄 direct task(본 task 밖).

## Out of Scope

- 실제 `prisma/schema.prisma` `Summary` model 추가 / migration SQL / aggregate 평가 service 코드 / orchestrator·controller batch 평가 endpoint 배선 — 전부 후속 chain task(ADR 확정 후).
- live LLM batch run(옵션 3, §5 credential) — 본 task 밖.
- **scheduler 자동화(@nestjs/schedule 새 dep)** — OUT. 시점 경계는 trigger 판정 규칙만 정의, 실제 cron 구동은 P7/별도 ADR.
- period→collection→evaluate bridge(Q-0030 옵션 2) — 별도 task. ADR-0035 확정 후 동행 가능.
- data-model.md 본격 갱신 — 영속 entity 확정(후속 schema task) 후 doc-sync. 본 ADR 에서는 forward-pointing 최소 메모만.
- 새 외부 dependency 추가(§5) — 금지. 필요 시 BLOCKED.

## Suggested Sub-agents

- `architect` — ADR-0035 작성(단일 ADR / 구현 코드 없음). reviewer 가 pr-mode 검토.

## Follow-ups

- ADR-0035 ACCEPTED flip(1줄 direct, reviewer 통과 후).
- prisma `Summary` model 추가 + migration(dependency-free chain 2번째 slice).
- aggregate 평가 service(deterministic metric 집계 + batch LLM 정성 narrative).
- orchestrator/controller batch 평가 endpoint 배선.
- data-model.md / modules.md / api.md doc-sync.
- 옵션 2 period→collection→evaluate bridge(R-9, README L98 상당) — ADR-0035 확정 후 동행.
- (장기) 시점 경계 scheduler 자동화(@nestjs/schedule, P7, §5 새 dep).
