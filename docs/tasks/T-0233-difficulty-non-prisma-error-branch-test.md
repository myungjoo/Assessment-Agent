---
id: T-0233
title: difficulty-mapping.service non-Prisma error 분기 negative test 추가
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-049]
estimatedDiff: 25
estimatedFiles: 1
created: 2026-06-04
plannerNote: P4 audit backlog P2 — difficulty-mapping.service.ts:50 getPrismaErrorCode return undefined 분기 미커버, test-only negative case 추가
---

# T-0233 — difficulty-mapping.service non-Prisma error 분기 negative test 추가

## Why

T-0231 test-quality 감사 (`docs/progress/test-quality-coverage-audit-2026-06.md` §4 P2) 가 식별한 두 번째 우선순위 gap 이다. `src/llm/difficulty-mapping.service.ts:50` 의 `getPrismaErrorCode()` helper 가 `return undefined` 하는 분기 (error 가 객체가 아니거나 `code` 필드가 없거나 string 이 아닐 때) 가 어떤 negative test 로도 실행되지 않아 line 96.87% 로 남아있다. 이 분기는 `assignProviderConfig` 의 catch (L179~186) 에서 P2002/P2025 같은 known Prisma error 가 **아닌** error 가 throw 됐을 때 raw propagate 로 가는 방어 경로다. R-112 의 "type mismatch / 비정상 throw" negative case 에 해당하며, 미검증 시 DB error 구분 (Prisma known vs 그 외) 회귀를 자동 적발하지 못한다. P1 (T-0232, encrypt-cli 비-Error throw) 와 동형의 test-only 강화다.

## Required Reading

- `docs/progress/test-quality-coverage-audit-2026-06.md` (§4 P2 entry — gap 의 authoritative 정의)
- `src/llm/difficulty-mapping.service.ts` (L41~51 `getPrismaErrorCode`, L179~186 `assignProviderConfig` 의 catch — 유일한 호출부)
- `src/llm/difficulty-mapping.service.spec.ts` (기존 spec — 특히 L300~323 의 P2025/P9999 test 가 모두 `code` 필드를 가진 error 만 throw 해 L48 만 cover, L50 미커버임을 확인)
- `test/helpers/prisma-mock.ts` (`buildPrismaError` helper — code 필드를 부여하는 기존 유틸. 본 task 는 code 없는 plain error 가 필요하므로 그대로 쓰거나 plain `new Error(...)` 사용)

## Acceptance Criteria

- [ ] `difficulty-mapping.service.spec.ts` 의 `assignProviderConfig()` describe 에 negative test 1+ 추가: `mappingRepo.updateProviderConfig` 가 **`code` 필드 없는 plain `Error`** (예: `new Error("db-down")`) 를 reject 하도록 mock → `getPrismaErrorCode` 가 `undefined` 를 반환하는 분기 (L50) 로 진입하고, P2025 변환이 일어나지 않아 **원본 error 가 그대로 propagate** 됨을 검증. assertion 은 단순 reject 가 아니라 의미 있게: `.rejects.toThrow("db-down")` + 그 error 가 `NotFoundException` 으로 변환되지 **않았음** (`.rejects.not.toBeInstanceOf(NotFoundException)` 또는 throw message 가 "difficulty mapping not found" 가 아님) 을 함께 단언.
- [ ] (negative 충분 cover) 추가로 **비-객체 throw** (예: 문자열 `"db-down"` 또는 `{}` 처럼 `code` 가 string 아닌 값) 가 throw 됐을 때도 `getPrismaErrorCode` 가 `undefined` 를 반환하고 raw propagate 됨을 검증하는 test 1+. 이로써 L41~50 의 `typeof error === "object"` / `error !== null` / `"code" in error` / `typeof code === "string"` 네 조건 중 최소 둘 이상의 false 경로를 cover (단일 negative 금지 — R-112).
- [ ] (branch cover) 위 test 추가 후 `getPrismaErrorCode` 의 `return undefined` (L50) 와 기존 `return code` (L48) 양 분기가 모두 실행됨 — 기존 P9999 test (L313) 가 L48 을 유지 cover, 신규 test 가 L50 을 cover.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 추가로 `src/llm/difficulty-mapping.service.ts` 의 **line 96.87% → 100%** 달성을 PR 본문에 명시 (jest text summary 인용).
- [ ] production 코드 (`src/llm/difficulty-mapping.service.ts`) 무변경 — test-only 변경임을 diff 로 확인. 변경 파일 1개 (spec) 만.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.

## Out of Scope

- production 코드 (`difficulty-mapping.service.ts`) 의 어떤 변경도 하지 않는다 — 분기는 이미 testable, mock 으로 충분히 도달 가능 (P3 auth.module 과 달리 helper 분리 불요).
- `getPrismaErrorCode` 의 service 중복 외화 (GroupService §Follow-ups phase 2 candidate) — 본 task 범위 밖. 손대지 않는다.
- coverage threshold (`package.json` branch/statement floor 상향) 변경 — audit P4, 별도 task/ADR.
- P3 (auth.module JWT secret fallback helper 분리) — 별도 task (Follow-ups 참조).
- 다른 spec 파일 / 다른 production 파일 변경.

## Suggested Sub-agents

`tester` (test-only 변경이라 implementer 불요 — tester 가 spec 추가 + 실행 검증). production 변경 0 이므로 architect 불요.

## Follow-ups

- (audit backlog P3) `auth.module.ts` JWT secret `?? ""` fallback 분기를 `resolveJwtSecret(env)` helper 로 분리해 coverage 측정 대상화 + 반환값 assertion 강화. **prod 소량 변경 동반 — pr-mode**. (`docs/progress/test-quality-coverage-audit-2026-06.md` §4 P3, ~3 파일.)
- (audit backlog P4, 정책 권고) `coverageThreshold` branch/statement floor 50 → 90 상향 검토 — pr-mode + 기존 통과 영향 검토 동반, 별도 task/ADR.
- (audit backlog P5, 후보 언급만) mutation testing (Stryker) 도입 검토 — 새 dependency = §5 BLOCKED + 별도 ADR.
