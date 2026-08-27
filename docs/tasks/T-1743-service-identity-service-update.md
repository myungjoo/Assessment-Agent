---
id: T-1743
title: ServiceIdentityService 에 update 추가 — 소유 검사 404 + merge patch 미전달 보존
phase: P6
status: DONE
prNumber: 1373
completedAt: 2026-08-27T21:55:07Z
commitMode: pr
coversReq: [REQ-078, REQ-079]
estimatedDiff: 215
estimatedFiles: 2
created: 2026-08-27
independentStream: service-identity-management-api
dependsOn: [T-1739, T-1740, T-1741, T-1742]
touchesFiles:
  - src/user/service-identity.service.ts
  - src/user/service-identity.service.spec.ts
plannerNote: "PLAN 132행/REQ-078·079 다섯 번째 코드 slice — ADR-0058 §Decision 3 externalId 단일 축 + §Decision 5 (b)(e) 404 만 절단"
---

# T-1743 — ServiceIdentityService 에 update 추가 — 소유 검사 404 + merge patch 미전달 보존

## Why

오너 지시 [PLAN.md](../PLAN.md) `132 행` (REQ-078 / REQ-079) 의 ServiceIdentity 관리 API
chain 다섯 번째 코드 slice 다. [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md)
`§Follow-ups (a)` 의 잔여는 `ServiceIdentityService` 의 3 method (`update` · `delete` 후
재승격 · `setPrimary`) 인데, T-1741 · T-1742 가 확인한 대로 이들을 한 slice 로 묶으면 R-112
spec 포함 시 cap (≤ 300 LOC) 을 확실히 넘는다. 본 slice 는 그중 **`update` 하나만** 절단한다
— `update` 는 `§Decision 3` 의 "PATCH 는 `externalId` 단일 축 + 미전달 보존" 과 `§Decision 5`
(b) `P2025` → 404 · (e) **타 Person 소유 → 404 (403 아님)** 를 짊어지며, primary 재승격
로직 (delete · setPrimary slice 소관) 과 데이터 의존이 없어 독립적으로 닫힌다.

## Required Reading

- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md)
  — `§Decision 3` 전체 (`externalId` 만 허용 · `isPrimary` · `service` 금지 근거 · RFC-7396
  merge patch semantic · `null` 전달 시 400 은 DTO 책임) · `§Decision 5` 표의 (b) 행
  (`P2025` → `NotFoundException` 404) · (c) 행 (Person 부재 선검사 404) · **(e) 행**
  (`:identityId` 가 다른 Person 소유면 403 이 아니라 404 — 타 Person row 의 존재 여부를
  노출하지 않는다) · `§Follow-ups (a)`
- [src/user/service-identity.service.ts](../../src/user/service-identity.service.ts)
  — 본 slice 가 확장할 파일 전체 (`findByPersonId` · `create` 의 Person 선검사 패턴 ·
  file-private `getPrismaErrorCode` duck typing helper — **재작성 금지, 재사용** · 헤더 주석의
  책임 경계 서술: 본 slice 가 닫는 `update` 를 그 "Out of Scope" 목록에서 제거해야 한다)
- [src/user/service-identity.repository.ts](../../src/user/service-identity.repository.ts)
  `46~55 행` (`ServiceIdentityUpdateInput` — `externalId` 단일 required 필드) · `74~89 행`
  (`update` 의 `P2025` propagate 정책 · "소유 검증 (personId 일치) 은 하지 않는다 — service
  책임" 명시) · `61~66 행` (`findByPersonId` — 본 slice 의 소유 검사에 재사용할 primitive.
  repository 에 `findById` 는 **없다**)
- [src/user/dto/update-service-identity.dto.ts](../../src/user/dto/update-service-identity.dto.ts)
  — `externalId?: string` 단일 optional 필드 (T-1739 박제). `@ValidateIf` 로 미전달만 skip.
- [src/user/service-identity.service.spec.ts](../../src/user/service-identity.service.spec.ts)
  `1~45 행` — colocated spec 의 헤더 주석 관례 + `buildPersonFixture` ·
  `buildServiceIdentityFixture` fixture 와 mock 구성 (본 slice 는 **같은 파일에 describe 를
  추가** 한다. 새 spec 파일을 만들지 않는다.)

## Acceptance Criteria

- [ ] `src/user/service-identity.service.ts` 에 public 메서드
      `update(personId: string, identityId: string, dto: UpdateServiceIdentityDto): Promise<ServiceIdentity>`
      **1 개만** 추가 (`delete` · 재승격 · `setPrimary` 는 추가하지 않는다).
- [ ] 그 메서드는 다음 순서를 지킨다:
      (1) `PersonRepository.findById` 로 Person 존재 **선검사** — `null` 이면
      `NotFoundException` (ADR §Decision 5 c) 이고 이때 `ServiceIdentityRepository` 는
      **한 번도 호출되지 않는다**.
      (2) `ServiceIdentityRepository.findByPersonId(personId)` 결과에서 `identityId` 와
      일치하는 row 를 찾아 **소유 검사** — 없으면 `NotFoundException` (ADR §Decision 5 e —
      403 아님). repository 에 `findById` 를 새로 추가하지 않는다.
      (3) `dto.externalId` 가 `undefined` 면 **`repository.update` 를 호출하지 않고**
      (2) 에서 찾은 현재 row 를 그대로 반환 (RFC-7396 미전달 보존 — 빈 `data` 로 no-op
      update 를 Prisma 에 흘리지 않는다).
      (4) 전달됐으면 `repository.update(identityId, { externalId })` 호출 결과 반환.
- [ ] `repository.update` 가 던진 `P2025` 는 `NotFoundException` (404) 으로 변환 (ADR
      §Decision 5 b). 변환에는 기존 file-private `getPrismaErrorCode` 를 재사용하고
      **새 helper 를 만들지 않는다**. `P2025` 외의 오류는 삼키지 않고 원형 그대로 propagate.
- [ ] 본 메서드 안에서 `setPrimary` · `delete` · `$transaction` 을 호출하지 않는다
      (`git grep -n "setPrimary\|\$transaction" src/user/service-identity.service.ts` 결과가
      기존 `create` 경로의 `setPrimary` 1 건 외에 늘지 않는다).
- [ ] 파일 헤더 주석의 "책임 경계 (Out of Scope)" 목록에서 `update` 를 제거하고, 잔여
      (delete 후 재승격 · setPrimary · controller 배선) 만 남긴다.
- [ ] **happy-path unit test 1+** — Person 존재 + 본인 소유 identity + `externalId` 전달 →
      `repository.update` 가 `(identityId, { externalId })` 정확한 인자로 1 회 호출되고 그
      반환값이 가공 없이 그대로 나온다.
- [ ] **error path unit test 1+** — (a) Person 부재 → `NotFoundException` 이고
      `ServiceIdentityRepository` 미호출, (b) `repository.update` 의 `P2025` →
      `NotFoundException` 으로 변환.
- [ ] **분기 test** — 4 분기 각 1+ : ① Person 부재 ② 소유 불일치 (해당 Person 의 목록에
      `identityId` 없음) ③ `externalId` 미전달 (update 미호출 + 현재 row 반환) ④ 정상 갱신.
- [ ] **negative cases 충분 cover** — 각 1+ test:
      ① 타 Person 소유 id → `NotFoundException` 이며 메시지에 그 row 의 존재 사실 · 소유자
      personId 가 드러나지 않는다 (ADR §Decision 5 e), ② `identityId` 로 빈 문자열 등
      미존재 값 → 404 이고 `repository.update` 미호출, ③ 해당 Person 의 identity 목록이 빈
      배열 → 404, ④ `repository.update` 가 `P2025` 아닌 오류 (예: `P2002` · 일반 `Error`)
      를 던지면 **변환 없이** 그대로 propagate, ⑤ `PersonRepository.findById` 자체의 throw
      propagate, ⑥ `dto` 가 `{}` (미전달) 일 때 `repository.update` 호출 0 회 drift guard.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- `delete` (+ 잔여 row primary 재승격) · `setPrimary` public 메서드 — 후속 slice.
- controller · route · guard (`@UseGuards` / `@Roles`) · `ValidationPipe` 배선 (ADR-0058
  `§Follow-ups (b)`) — 본 slice 는 service layer 만.
- `ServiceIdentityRepository` 변경 (`findById` 추가 포함) · `prisma/schema.prisma` ·
  DTO 파일 수정 — diff 0 파일.
- e2e / smoke 스위트 신설, `web/` AdminView 패널, `docs/architecture/api.md` 갱신,
  PLAN 132 행 `[x]` 승격 · REQ status 변경 — 전부 후속.
- `getPrismaErrorCode` 의 공용 module 추출 (person.service.ts 와의 중복 정리) — 별도 판단.
- 새 외부 dependency 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 append)

## 결과 (2026-08-27)

`pr` mode 로 PR [#1373](https://github.com/myungjoo/Assessment-Agent/pull/1373) → main `89ef41b2` squash 머지.
`ServiceIdentityService.update` 단일 public 메서드만 추가 — Person 존재 선검사 404 → `findByPersonId`
재사용 소유 검사 404(403 아님) → `externalId` 미전달 시 `repository.update` 미호출 + 현재 row 반환
(RFC-7396 merge patch) → `P2025` 만 404 변환(기존 `getPrismaErrorCode` 재사용, 그 외 propagate).
2 파일 `+290/-10`, colocated spec 에 `update` describe 3 개 추가로 R-112 4 종 cover
(happy 2 · 분기 4 · error 2 · negative 6). 대상 service stmt/branch/func/line 100%,
루트 `lint` · `build` · `test:cov` 456 suite / 13085 test green. reviewer round 1/7 APPROVE
(PR 코멘트로 외화) → 4-게이트 충족 → squash 머지 + branch delete.
