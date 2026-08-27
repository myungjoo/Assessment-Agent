---
id: T-1740
title: ServiceIdentityRepository 에 update primitive 추가
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-078, REQ-079]
estimatedDiff: 160
estimatedFiles: 2
created: 2026-08-27
completedAt: 2026-08-27T18:55:12Z
independentStream: service-identity-api
dependsOn: [T-1739]
touchesFiles:
  - src/user/service-identity.repository.ts
  - src/user/service-identity.repository.spec.ts
prNumber: 1370
plannerNote: P5 오너 지시 PLAN 132 행 / ADR-0058 Follow-ups (a) 잔여 축 분해 — service 이전에 필요한 repository update primitive 만 절단
---

# T-1740 — ServiceIdentityRepository 에 update primitive 추가

## Why

오너 지시([PLAN.md](../PLAN.md) `132 행`, REQ-078 / REQ-079)의 ServiceIdentity 관리 API chain 에서
[ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Decision 3` 은 PATCH 의 갱신 축을
`externalId` 단일 축으로 확정하면서 "**repository 확장이 필요하다 — 현재 repository 에는 `update` 메서드가
없어 `externalId` 갱신을 수행할 primitive 가 없다**" 를 명시했다. 직전 slice T-1739 가 같은 `Follow-ups (a)`
에서 DTO 2 종만 잘라 닫았으므로, 본 slice 는 그 다음 선행 의존인 **repository primitive 1 개**만 가져간다.
`ServiceIdentityService`(자동 승격 · 재승격 · Prisma → HttpException 변환)는 production + R-112 spec 을 합치면
cap 을 확실히 초과하므로 본 task 에서 제외하고 후속 slice 로 남긴다.

## Required Reading

- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md) — `§Decision 3`(PATCH 축 = `externalId` 단일, repository `update` 확장 요구 + `P2025` propagate 정책 유지) · `§Decision 5` b 행(`P2025` → 404 변환은 **service layer 책임**) · `§Follow-ups (a)`
- [src/user/service-identity.repository.ts](../../src/user/service-identity.repository.ts) — 기존 4 primitive(`findByPersonId` / `create` / `setPrimary` / `delete`), 헤더 주석의 책임 경계 · Prisma error 정책, `ServiceIdentityCreateInput` interface 스타일
- [src/user/service-identity.repository.spec.ts](../../src/user/service-identity.repository.spec.ts) — colocated spec. `buildServiceIdentityFixture` · `buildPrismaMock`(이미 `update: jest.Mock` 을 delegate mock 에 보유) 재사용 대상, `describe("delete()")` 블록의 서술 스타일
- [src/user/dto/update-service-identity.dto.ts](../../src/user/dto/update-service-identity.dto.ts) — T-1739 가 박제한 PATCH payload 계약(`externalId` 단일 축, `null` 400). 본 primitive 의 input 타입이 이 계약과 정합해야 한다
- [prisma/schema.prisma](../../prisma/schema.prisma) `249~275 행` — `ServiceIdentity` model 컬럼 집합(스키마 변경 금지 확인용)

## Acceptance Criteria

- [ ] `src/user/service-identity.repository.ts` 에 `async update(id: string, input: ServiceIdentityUpdateInput): Promise<ServiceIdentity>` 를 추가한다. 구현은 `this.prisma.serviceIdentity.update({ where: { id }, data: input })` 1:1 forwarding 뿐이며 `$transaction` · 추가 조회 · 재시도 로직을 넣지 않는다.
- [ ] `ServiceIdentityUpdateInput` interface 를 export 한다 — 필드는 `externalId` **하나뿐**이며 ADR `§Decision 3` 의 금지 축(`service` · `isPrimary` · `personId`)을 타입 수준에서 수용하지 않는다.
- [ ] 새 메서드 위 주석에 (a) `P2025`(row 부재)를 catch 하지 않고 propagate 한다는 점, (b) HTTP 404 변환은 service layer 책임(ADR `§Decision 5` b 행)이라는 점, (c) 갱신 축이 `externalId` 단일인 근거(ADR `§Decision 3`)를 한국어로 명시한다.
- [ ] happy-path unit test 1+ — `update()` 가 Prisma delegate 를 `{ where: { id }, data: { externalId } }` 정확한 인자로 1 회 호출하고 delegate 의 return 값을 그대로 propagate 한다.
- [ ] error path unit test 1+ — delegate 가 `P2025` 를 throw 하면 repository 가 **catch 없이 그대로** reject 한다(에러 객체 동일성 검증). Prisma 가 던지는 다른 오류(예: 연결 실패)도 그대로 propagate 하는 test 1+.
- [ ] 분기 cover — 본 메서드는 조건 분기가 없다. 대신 호출 형태 분기를 cover 한다: `externalId` 가 정상 문자열인 경우와 빈 문자열(`""`)인 경우 모두 **repository 가 검증 없이 raw pass-through** 함을 각각 검증(값 검증은 DTO / service 책임이라는 경계 고정).
- [ ] negative cases 충분 cover — 각 1+ test: (1) 존재하지 않는 `id`(`P2025`) propagate, (2) 빈 문자열 `externalId` 를 repository 가 거부하지 않음, (3) 다른 Person 소유 row 여도 repository 는 소유 검증을 하지 않음(호출 인자에 `personId` 조건이 들어가지 않음을 검증), (4) `update()` 가 `$transaction` 을 호출하지 않음(기존 `setPrimary` 경로 오염 0), (5) `update()` 호출이 다른 delegate(`create` · `delete` · `updateMany`)를 호출하지 않음.
- [ ] drift guard test 1+ — `ServiceIdentityUpdateInput` 으로 조립한 payload 를 `update()` 에 넘겼을 때 delegate 의 `data` 가 `externalId` 키 **하나만** 갖는다(금지 축이 조용히 흘러들어가면 fail).
- [ ] 기존 4 primitive 의 spec 블록(`findByPersonId` / `create` / `setPrimary` / `delete`)은 무수정 — 회귀 0.
- [ ] `pnpm lint` · `pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%), `src/user/service-identity.repository.ts` 는 function coverage 100% 유지.
- [ ] production 순증 ≤ 40 LOC (interface + 메서드 + 주석). 초과 시 주석을 줄여 맞춘다.

## Out of Scope

- `ServiceIdentityService` 신설 — 자동 primary 승격 · 삭제 후 재승격 · Prisma → `HttpException` 변환은 **후속 slice**. 본 task 에서 service 파일을 만들지 않는다.
- controller / route 배선 (`/api/persons/:personId/identities`) — ADR `§Follow-ups (b)`.
- `src/user/user.module.ts` provider 목록 변경 — repository 는 이미 등록돼 있으므로 diff 0.
- `findById` 등 ADR 이 요구하지 않은 새 primitive 추가 — 소유 검증은 후속 service slice 가 `findByPersonId` 로 처리한다.
- `prisma/schema.prisma` · migration · `package.json` · `.github/workflows/` · `web/` · `test/` 변경 — 전부 diff 0.
- `docs/architecture/api.md` · `docs/requirements.md` · `docs/PLAN.md` 완료 표기 — ADR `§Follow-ups (e)` 소관, 본 task 는 어떤 완료 선언도 하지 않는다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 발견 시 추가)
