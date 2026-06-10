---
id: T-0315
title: period→collection→evaluate bridge 입력 DTO 추가 (ADR-0037 slice 1)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-040, REQ-045]
estimatedDiff: 90
estimatedFiles: 2
created: 2026-06-10
plannerNote: "P5 ADR-0037 slice 1 — bridge 입력 DTO. §Decision1(personId)/§Decision4(좌표) FIRM 만 cover, §Decision2/3 PROPOSE 미의존. R-112 backbone ×1.5 + DTO mirror."
---

# T-0315 — period→collection→evaluate bridge 입력 DTO 추가 (ADR-0037 slice 1)

## Why

[ADR-0037](../decisions/ADR-0037-period-collection-evaluate-bridge.md) §Follow-ups 의 dependency chain 첫 slice 다. Q-0031 이 승인한 period→collection→evaluate bridge(R-9 / PLAN P5 L98 "Admin·User 가 임의 기간의 평가문을 요청")의 **입력 계약 DTO** 만 추가한다 — `period`/`personId`(+ scope/periodStart) 를 형식 검증으로 받는 request body. 본 slice 는 ADR-0037 의 **FIRM 결정만**(§Decision1 의 personId 입력 축 · §Decision4 의 좌표 source-of · §Decision5 의 dep/credential 0) cover 하며, **PROPOSE 상태인 §Decision2(double-write 경계)·§Decision3(동시 호출 idempotency)에는 의존하지 않는다** — 그 두 결정은 orchestration service(slice 2)·e2e(slice 5)의 영속화 분기에서 비로소 구현되고, 본 DTO 는 단지 입력 형식만 박제하므로 사용자의 ADR PR 검토 결과와 독립이다.

## Required Reading

- `docs/decisions/ADR-0037-period-collection-evaluate-bridge.md` — §Decision1(RBAC Admin/User-ephemeral, personId 입력 축) · §Decision4(fresh collect 좌표 source-of) · §Follow-ups slice 1 정의. (§Decision2/§Decision3 은 본 slice 가 구현하지 않음 — 읽되 baking 금지.)
- `src/assessment-collection/dto/collect-trigger.dto.ts` — mirror 대상 1 (personId/period/scope/periodStart 형식 검증 패턴, @IsIn 미적용 관행).
- `src/assessment-evaluation/dto/evaluate-activities.dto.ts` — mirror 대상 2 (context 4-tuple `@IsISO8601 periodStart` boundary 강제 패턴).
- `src/assessment-collection/dto/collect-trigger.dto.spec.ts` — colocated spec 작성 패턴 reference.

## Acceptance Criteria

- [ ] `src/assessment-evaluation/dto/period-bridge.dto.ts` 신설 — bridge endpoint request body DTO. 최소 필드: `personId`(@IsString @IsNotEmpty), `period`(@IsString @IsNotEmpty — 허용 literal 검증은 service 책임, @IsIn 미적용, collect-trigger 관행 정합), `scope`(@IsString @IsNotEmpty), `periodStart`(@IsISO8601 + @IsString @IsNotEmpty — malformed date 의 opaque 500 차단). 필요 시 `mode`(@IsOptional @IsIn(["fill","reeval"])) 는 evaluate-activities.dto 패턴 mirror.
- [ ] DTO 는 **형식 검증만** — 허용 literal 값(period/scope) · personId 존재 검증 · RBAC self-only 동등성 · 영속화 분기는 본 DTO 밖(주석으로 책임 경계 명시: orchestration slice 2 / RBAC guard slice 4).
- [ ] DTO 주석에 "§Decision2/§Decision3 PROPOSE 미의존 — 본 DTO 는 입력 형식만, double-write/idempotency 는 slice 2/5 책임" 1 줄 박제.
- [ ] colocated spec `src/assessment-evaluation/dto/period-bridge.dto.spec.ts` 추가 — happy-path: 유효 payload 가 `validate()` 0 error 통과. (R-112 항목 1)
- [ ] error path test: 필수 필드(personId/period/scope/periodStart) 누락 시 각 validation error 발생. (R-112 항목 2)
- [ ] flow/branch test: `periodStart` 비-ISO 문자열(예: "2026-13-99") → @IsISO8601 error / `mode` 정의 외 literal(예: "reevaluate") → @IsIn error / `mode` 미지정 → 통과. (R-112 항목 3)
- [ ] negative cases 충분 cover: wrong-type(personId 에 number) · 빈 string · whitelist 위반(정의 외 필드 forbidNonWhitelisted) 각 1+ test. 단일 negative 금지 — 예외 분기마다 cover. (R-112 항목 4)
- [ ] `pnpm lint && pnpm build && pnpm test` 통과 + `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). (R-112 항목 5)

## Out of Scope

- orchestration bridge service(collect→evaluate→persist/ephemeral 분기) — slice 2.
- controller endpoint 배선(POST /api/assessment-evaluation/period 등) — slice 3.
- RBAC guard(Admin full / User self-only personId 동등성 강제) — slice 4.
- e2e(Admin persist round-trip / User ephemeral DB-write-0 / 동시 호출 idempotency) — slice 5.
- §Decision2(double-write 경계 일원화)·§Decision3(idempotency 직렬화) 의 **구현** — 두 결정은 PROPOSE 상태이며 사용자 ADR PR 검토 후 slice 2/5 가 구현. 본 DTO 는 입력 형식만이라 두 결정과 독립 — DTO 에 어떤 영속화/동시성 semantics 도 baking 금지.
- 새 외부 dependency / DB schema 변경 / live LLM credential — 전부 본 slice 밖(§Decision5).

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0037 §Decision1/4 가 입력 계약을 박제, 새 design 결정 0).

## Follow-ups

(생성 시 비어있음. sub-agent 가 관련 작업 발견 시 append.)
