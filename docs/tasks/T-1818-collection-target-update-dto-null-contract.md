---
id: T-1818
title: Reject explicit null in UpdateCollectionTargetDto via @ValidateIf
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-070, REQ-072, REQ-073]
independentStream: collection-target-backend
dependsOn: [T-1813]
touchesFiles:
  - src/assessment-collection/dto/update-collection-target.dto.ts
  - src/assessment-collection/dto/update-collection-target.dto.spec.ts
estimatedDiff: 180
estimatedFiles: 2
created: 2026-08-31
plannerNote: ADR-0059 (c) 잔여 결함 — @IsOptional 이 null 을 skip 해 §Decision 5 오류 표 e 행(400) 이 새는 축을 e2e (d) 이전에 확정
completedAt: 2026-08-31T04:49:19Z
prNumber: 1430
mergeCommit: 78efa42d
---

# T-1818 — UpdateCollectionTargetDto 의 명시적 `null` 을 `@ValidateIf` 로 400 화

## Why

[ADR-0059](../decisions/ADR-0059-collection-target-registration.md) `§Follow-ups (c)` 의 **잔여
결함 조각**이다. `§Decision 5` route 표 5 route 는 T-1814 ~ T-1817 로 전량 배선됐지만, T-1813
reviewer MINOR M2 로 외화된 `{ "endpoint": null }` 오류 계약은 세 slice 연속 이월되어 아직
미확정이다 — `origin/main` 의
[update-collection-target.dto.ts](../../src/assessment-collection/dto/update-collection-target.dto.ts)
5 필드가 모두 `@IsOptional()` 이고, class-validator 의 `@IsOptional` 은 `undefined` 뿐 아니라
**`null` 도 검증에서 skip** 하므로 `{ "endpoint": null }` · `{ "active": null }` 이 DTO 를 그대로
통과해 repository / Prisma 층까지 내려간다. 이는 `§Decision 5` 오류 표 `e` 행(형식 검증 실패 =
**400**)이 조용히 새는 축이다.

본 조각을 `§Follow-ups (d)` e2e **보다 먼저** 처리하는 이유는 순서 의존이다 — (d) 는 오류 표
5 행을 실 HTTP 로 못박는 slice 라, 계약이 미확정인 채 e2e 를 쓰면 확정 직후 그 스위트를 다시
고쳐야 한다. 해법은 이미 저장소 안에 선례가 있다:
[UpdateServiceIdentityDto](../../src/user/dto/update-service-identity.dto.ts) 가
`@ValidateIf((_o, value) => value !== undefined)` 로 "키가 없을 때만 skip" 을 표현해 `null` 을
400 으로 떨어뜨린다. 본 task 는 그 선례를 승계해 decorator 축만 바꾼다.

## Required Reading

- [src/assessment-collection/dto/update-collection-target.dto.ts](../../src/assessment-collection/dto/update-collection-target.dto.ts) — 변경 대상. 5 필드(`endpoint` · `orgs` · `repos` · `spaces` · `active`)의 `@IsOptional` 배치와 헤더 주석의 "@IsOptional 을 직접 박아" 문단.
- [src/assessment-collection/dto/update-collection-target.dto.spec.ts](../../src/assessment-collection/dto/update-collection-target.dto.spec.ts) — **colocated spec**(본 task 가 확장할 파일). 특히 `violations` / `strictViolations` helper 와 `⑥ spaces 가 null 이면 @IsOptional 이 검증을 skip 한다` test(뒤집을 대상), 헤더 주석의 검증 축 목록.
- [src/user/dto/update-service-identity.dto.ts](../../src/user/dto/update-service-identity.dto.ts) `26 행` 이하 — `@ValidateIf((_o, value) => value !== undefined)` 선례와 그 이유를 적은 주석.
- [src/user/dto/update-service-identity.dto.spec.ts](../../src/user/dto/update-service-identity.dto.spec.ts) — 같은 선례의 spec 축(`undefined` skip 분기 / `null` 거절 분기) 작성 형태.
- [docs/decisions/ADR-0059-collection-target-registration.md](../decisions/ADR-0059-collection-target-registration.md) `§Decision 5` — PATCH 행(RFC-7396 merge patch · 정체성 축 제외)과 오류 표 `e` 행(형식 검증 실패 → 400).

## Acceptance Criteria

- [ ] `UpdateCollectionTargetDto` 5 필드(`endpoint` · `orgs` · `repos` · `spaces` · `active`)의 `@IsOptional()` 을 각각 `@ValidateIf((_o, value) => value !== undefined)` 로 교체한다. import 목록에서 더 이상 쓰이지 않는 `IsOptional` 을 제거하고 `ValidateIf` 를 추가한다(lint 의 unused import 축).
- [ ] 교체 후에도 **merge patch 의 미전달 = 미변경 계약은 불변** — 키 자체가 없거나 값이 `undefined` 면 나머지 decorator 평가를 skip 한다. 빈 객체 `{}` 는 여전히 0 error 다.
- [ ] 헤더 주석의 "각 필드에 @IsOptional 을 직접 박아" 문단을 `@ValidateIf` 사실과 그 선택 이유(`@IsOptional` 은 `null` 도 skip 하므로 `§Decision 5` 오류 표 `e` 행이 샌다)로 갱신한다(§12 — 주석 한국어).
- [ ] `create-collection-target.dto.ts` · service · repository · controller · module · prisma schema 는 **1 LOC 도 바뀌지 않는다** (`git diff --stat` 이 DTO + colocated spec 2 파일만 보여야 한다).
- [ ] **happy-path unit test 1+** — 빈 객체 `{}` · 단일 필드 · 5 필드 전량 payload 가 여전히 0 error 임을 고정(기존 happy test 가 그대로 green 이면 충족, 단 5 필드 전량 케이스가 없으면 추가).
- [ ] **error path unit test 1+** — 전달된 필드가 계약을 위반할 때(빈 `endpoint` · 문자열 `active` · 과길이 `endpoint`) 기존과 동일하게 위반 constraint 가 나옴을 고정(교체가 기존 검증을 약화시키지 않았음을 증명).
- [ ] **분기 cover** — `@ValidateIf` 의 두 분기를 각각 1+ test 로 나눈다: (1) 값이 `undefined` 인 키가 존재해도 skip 되어 0 error(예: `{ endpoint: undefined }`), (2) 값이 `null` 이면 skip 되지 않아 후속 decorator 가 평가되어 위반이 난다.
- [ ] **negative cases 충분 cover** — 최소 다음 각 1+ test: (1) `{ endpoint: null }` → `isString` 계열 위반(더 이상 0 error 아님), (2) `{ orgs: null }` → `isArray` 위반, (3) `{ repos: null }` → `isArray` 위반, (4) `{ spaces: null }` → `isArray` 위반(기존 `⑥` test 의 `toEqual([])` 단언을 **뒤집고** 그 주석의 "판단은 controller slice 몫" 문단을 본 task 가 확정했다는 사실로 정정), (5) `{ active: null }` → `isBoolean` 위반, (6) 배열 원소 `null`(`{ spaces: ["ENG", null] }`)은 종전대로 `isString` 위반으로 남음(원소 축 회귀 guard), (7) `strictViolations` 로 정체성 축(`type` · `instanceKey`)과 credential 계열(`token` · `password` · `apiKey`)이 여전히 `whitelistValidation` 위반임을 고정(drift guard 회귀).
- [ ] spec 헤더 주석의 검증 축 목록에서 `@IsOptional` 표기를 `@ValidateIf` 로 갱신하고, `null` 축이 이제 **거절** 계약임을 명시한다.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `update-collection-target.dto.ts` 는 종전대로 line · branch · function coverage 100% 를 유지한다.

## Out of Scope

- `CreateCollectionTargetDto` 의 `@IsOptional`(`orgs` · `repos` · `spaces` · `active` 4 필드) — 같은 `null` skip 축이 있으나 create 는 오류 계약 성격(미전달 = 기본값)이 달라 **별도 slice** 로 판단한다. Follow-ups 에 적는다.
- service · repository 의 `null` 방어 코드 추가 — DTO 층에서 400 으로 막히므로 하위 층 중복 방어는 만들지 않는다.
- 실 HTTP 400 을 supertest 로 고정하는 e2e — `ADR-0059 §Follow-ups (d)` 소관.
- [api.md](../architecture/api.md) 의 CollectionTarget route 표 doc-sync — `§Follow-ups (f)` 소관(direct doc slice).
- 다른 module 의 `@IsOptional` 일괄 감사 — 본 slice 는 `UpdateCollectionTargetDto` 1 개만 다룬다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- `CreateCollectionTargetDto` 의 `@IsOptional` 4 필드(`orgs` · `repos` · `spaces` · `active`) 도 같은 `null` skip 축을 갖는다. 다만 create 는 "미전달 = 기본값" 성격이라 `null` 거절이 자명하지 않아 별도 slice 로 판단을 분리한다.
- 실 HTTP 400 을 supertest 로 고정하는 e2e — `ADR-0059 §Follow-ups (d)` 소관으로 그대로 이월.

## Result

**DONE** (2026-08-31T04:49:19Z, [PR #1430](https://github.com/myungjoo/Assessment-Agent/pull/1430) → main `78efa42d`, reviewer round 1 APPROVE).

`UpdateCollectionTargetDto` 5 필드의 `@IsOptional()` 을 `@ValidateIf((_o, value) => value !== undefined)` 로 교체해, class-validator 가 `undefined` 만 skip 하고 **명시적 `null` 은 검증에 태우도록** 계약을 정정했다(`+19/-8`). 이로써 `{ "endpoint": null }` · `{ "active": null }` 이 DTO 를 통과해 repository / Prisma 층까지 내려가던 `ADR-0059 §Decision 5` 오류 표 `e` 행 누수가 막히고, merge patch 미전달 = 미변경 불변(빈 객체 0 error)은 그대로 보존된다. `src/user/dto/update-service-identity.dto.ts` 선례를 승계했다. spec 을 `+79/-13` 확장해 5 필드 `null` 각 1+ · 원소 `null` 회귀 · drift guard 를 더해 DTO line · branch · function coverage 100% 를 유지했다(전체 463 suite / 13399 test green).
