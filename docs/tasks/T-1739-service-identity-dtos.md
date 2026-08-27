---
id: T-1739
title: ServiceIdentity 관리 API 의 Create / Update DTO 신설
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-078, REQ-079, REQ-024]
estimatedDiff: 320
estimatedFiles: 4
created: 2026-08-27
completedAt: 2026-08-27T18:00:29Z
prNumber: 1369
mergeCommit: af100fd1
independentStream: service-identity-api
dependsOn: [T-1738]
touchesFiles:
  - src/user/dto/create-service-identity.dto.ts
  - src/user/dto/create-service-identity.dto.spec.ts
  - src/user/dto/update-service-identity.dto.ts
  - src/user/dto/update-service-identity.dto.spec.ts
sizeExempt: true
exemptReason: 초과분 전량이 R-112 강제 colocated spec — production 순증 ≤ 90 LOC. T-1734(455) · T-1735(419) · T-1736(356) · T-1737(330) 선례 승계.
plannerNote: P6 오너 지시 PLAN 132 행 / ADR-0058 Follow-ups (a) 를 DTO 축만으로 자른 첫 코드 slice.
---

# T-1739 — ServiceIdentity 관리 API 의 Create / Update DTO 신설

## Why

오너 지시 [PLAN](../PLAN.md) `132 행`(REQ-078 / REQ-079)의 첫 코드 slice 다. 직전 T-1738 이 [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) 로 route shape · primary invariant · RBAC · 오류 계약을 doc-only 로 닫았고 코드는 1 LOC 도 쓰지 않았다. 그 `Follow-ups (a)` 는 "DTO + service + repository `update` 확장" 을 한 덩어리로 묶어 두었는데, 셋을 한 task 로 하면 파일 6+ 개 · R-112 spec 포함 600 LOC 을 넘겨 §3 cap 을 확실히 초과한다. 그래서 본 slice 는 **payload 검증 계약(DTO 2 종)만** 잘라 박제하고, service invariant · repository `update` · controller 배선은 후속 slice 로 남긴다.

## Required Reading

- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md) — `§Decision 2`(create DTO 는 `isPrimary` 를 받지 않는다) · `§Decision 3`(PATCH 는 `externalId` 단일 축, `null` 400) · `§Decision 5` 표 (d) 행(검증 실패 400) · `§Decision 6`(`service` 형식 검증 4 종)
- [src/user/dto/create-person.dto.ts](../../src/user/dto/create-person.dto.ts) — 헤더 주석 관례 + `ValidationPipe` 결합 서술 mirror 대상
- [src/user/dto/update-person.dto.ts](../../src/user/dto/update-person.dto.ts) — PATCH 부분 갱신 DTO 의 manual `@IsOptional` 관례(`@nestjs/mapped-types` 새 dep 회피)
- [src/user/dto/create-person.dto.spec.ts](../../src/user/dto/create-person.dto.spec.ts) · [src/user/dto/update-person.dto.spec.ts](../../src/user/dto/update-person.dto.spec.ts) — colocated spec 의 `plainToInstance` + `validateSync` 검증 관례
- [src/user/service-identity.repository.ts](../../src/user/service-identity.repository.ts) — `ServiceIdentityCreateInput` 필드명 정합(`service` · `externalId` · `personId`)

## Acceptance Criteria

- [x] `src/user/dto/create-service-identity.dto.ts` 에 `CreateServiceIdentityDto` 신설 — 필드는 `service` · `externalId` **두 개뿐**. `personId` 는 path param 이므로 미포함하고, `isPrimary` 는 ADR `§Decision 2` 에 따라 **받지 않는다**(헤더 주석에 근거 명시).
- [x] `service` 필드에 ADR `§Decision 6` 의 4 검증 그대로 — `@IsString` · `@IsNotEmpty` · `@MaxLength(64)` · `@Matches(/^[A-Za-z0-9._-]+$/)`. 서버 상수 allowlist(`@IsIn`) 는 ADR 이 비채택했으므로 쓰지 않는다.
- [x] `externalId` 필드는 `@IsString` · `@IsNotEmpty` · `@MaxLength(255)`(형식 정규식 없음 — 서비스별 ID 표기가 자유롭다는 근거를 주석에 1 줄).
- [x] `src/user/dto/update-service-identity.dto.ts` 에 `UpdateServiceIdentityDto` 신설 — `externalId?` **단일 축**(`@IsOptional` + create 와 동일 제약). `service` · `isPrimary` 필드는 정의하지 않으며(ADR `§Decision 3` 금지 축), 그 두 축이 body 로 오면 `forbidNonWhitelisted` 가 400 을 내는 구조임을 헤더 주석에 명시.
- [x] 두 DTO 파일 모두 헤더 주석에 책임 경계(Out of Scope: service invariant 강제 · repository `update` · controller 배선은 후속 slice) 를 §12 한국어로 박제.
- [x] happy-path unit test 1+ — 유효 payload 가 `validateSync` 결과 0 error 임을 두 DTO 각각 검증.
- [x] error path unit test 1+ — 필수 필드 누락(`service` 누락 · `externalId` 누락)이 error 를 내는 것을 각각 검증.
- [x] 분기 cover — decorator 별 분기 각 1+ test: `@IsNotEmpty`(빈 문자열) · `@MaxLength`(경계 초과) · `@Matches`(허용 문자 밖) · `@IsOptional`(미전달 시 0 error) 를 개별 케이스로 분리.
- [x] negative cases 충분 cover — 최소 6 종: ① `service` 공백만(`"   "`) ② `service` 에 `@` · 공백 등 금지 문자 ③ `service` 65 자 초과 ④ `externalId` 256 자 초과 ⑤ 타입 불일치(`service: 123` · `externalId: null`) ⑥ `UpdateServiceIdentityDto` 의 `externalId: null` 이 error(ADR `§Decision 3` 의 "`null` 전달 시 400") . 경계값 정상 통과(`service` 정확히 64 자 · `externalId` 정확히 255 자)도 각 1 케이스.
- [x] 계약 drift guard 1+ — `Object.keys(plainToInstance(...))` 또는 `validateSync` 결과로 `isPrimary` · `service` 가 `UpdateServiceIdentityDto` 의 허용 축이 아님을 test 가 드러내도록 한다(금지 축이 나중에 조용히 추가되면 fail).
- [x] `pnpm lint` · `pnpm build` 통과.
- [x] `pnpm test:cov` 통과 — line ≥ 80% AND function ≥ 80%(신규 DTO 2 파일 포함 전역 threshold).
- [x] production 순증 ≤ 90 LOC(두 DTO 파일 합). 초과분은 전부 colocated spec 이어야 한다.

## Out of Scope

- `ServiceIdentityService` 신설 · primary 자동 승격 / 재승격 로직 — ADR `Follow-ups (a)` 의 service 축, 후속 slice.
- `ServiceIdentityRepository.update` 추가 — 후속 slice(본 task 는 repository 파일 diff 0).
- controller · route · guard 배선 — ADR `Follow-ups (b)`.
- e2e 스위트 · `test/` diff 0 — ADR `Follow-ups (c)`.
- `web/` · `prisma/schema.prisma` · `package.json` · `.github/workflows/` diff 0. 새 외부 dependency 0(`@nestjs/mapped-types` 도입 금지 — manual decorate).
- `docs/architecture/api.md` · `docs/requirements.md` · `docs/PLAN.md` 갱신 0(ADR `Follow-ups (e)` 의 doc-sync 책임). 어떤 완료 표기도 하지 않는다.

## Suggested Sub-agents

`implementer → tester`


## 결과 요약

PR [#1369](https://github.com/myungjoo/Assessment-Agent/pull/1369) → main `af100fd1` (squash, branch 삭제). reviewer round 2/7 APPROVE 후 §3.3 4-게이트 충족.

- `CreateServiceIdentityDto`(`service` · `externalId` 2 필드) · `UpdateServiceIdentityDto`(`externalId` 단일 축) 신설. production 순증 **72 LOC**(사전 고지 ≤ 90 준수), 나머지는 전부 colocated spec 31 케이스.
- `@nestjs/mapped-types` 미도입 — manual decorate 로 새 dependency 0.
- `UpdateServiceIdentityDto` 는 `@IsOptional` 이 아니라 `@ValidateIf((_o, value) => value !== undefined)` 를 쓴다 — `@IsOptional` 은 `null` 도 skip 해 [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Decision 3` 의 "`null` 전달 시 400" 계약이 조용히 깨진다(실측 확인).
- 신규 DTO 2 파일 stmt/branch/func/line 100%, 전체 455 suite / 13040 test green.

## Follow-ups

- ADR-0058 `Follow-ups (a)` 의 잔여 축: `ServiceIdentityService` 신설(primary 자동 승격 / 재승격) · `ServiceIdentityRepository.update` 추가.
- ADR-0058 `Follow-ups (b)` controller · route · guard 배선, `(c)` e2e, `(e)` doc-sync.
- 후속 slice 는 `@ValidateIf` 계약(위 3 번째 항목)을 service/controller 층에서 깨지 않도록 승계할 것.
