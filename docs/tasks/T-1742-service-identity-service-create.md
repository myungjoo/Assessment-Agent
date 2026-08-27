---
id: T-1742
title: ServiceIdentityService 에 create 추가 — 첫 row 자동 primary 승격 + P2002 409
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-078, REQ-079]
estimatedDiff: 235
estimatedFiles: 2
created: 2026-08-27
independentStream: service-identity-management-api
dependsOn: [T-1739, T-1740, T-1741]
touchesFiles:
  - src/user/service-identity.service.ts
  - src/user/service-identity.service.spec.ts
plannerNote: "PLAN 132행/REQ-078·079 네 번째 코드 slice — ADR-0058 §Decision 2 자동 primary 승격 + §Decision 5 (a) P2002→409 만 절단"
---

# T-1742 — ServiceIdentityService 에 create 추가 — 첫 row 자동 primary 승격 + P2002 409

## Why

오너 지시 [PLAN.md](../PLAN.md) `132 행` (REQ-078 / REQ-079) 의 ServiceIdentity 관리 API
chain 네 번째 코드 slice 다. [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md)
`Follow-ups (a)` 의 잔여는 `ServiceIdentityService` 의 4 method (create · update · delete ·
setPrimary) 인데, T-1741 이 이미 확인한 대로 넷을 한 slice 에 묶으면 R-112 spec 포함 시
cap (≤ 300 LOC) 을 확실히 넘는다. 본 slice 는 그중 **`create` 하나만** 절단한다 — `create`
는 `§Decision 2` 의 "첫 row 자동 primary 승격" 과 `§Decision 5` (a) 의 `P2002` → 409 를
동시에 짊어져 4 method 중 결정 밀도가 가장 높고, 나머지 3 method 와 데이터 의존이 없어
독립적으로 닫힌다.

## Required Reading

- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md)
  — `§Decision 2` (primary invariant · **첫 row 자동 승격** · create DTO 가 `isPrimary` 를
  받지 않는 근거 · `N = 0` 정상 상태) · `§Decision 5` (a) 행 (`P2002` → `ConflictException`
  409) · (c) 행 (Person 부재 → 404 선검사) · `§Follow-ups (a)`
- [src/user/service-identity.service.ts](../../src/user/service-identity.service.ts)
  — 본 slice 가 확장할 파일 전체 (`findByPersonId` 선검사 패턴 · 헤더 주석의 책임 경계 서술
  — 본 slice 가 닫는 항목을 그 "Out of Scope" 목록에서 제거해야 한다)
- [src/user/service-identity.repository.ts](../../src/user/service-identity.repository.ts)
  `36~50 행` (`ServiceIdentityCreateInput` shape) · `69~74 행` (`create` 의 `P2002`
  propagate 정책) · `94~118 행` (`setPrimary` 의 `$transaction` — **재구현 금지, 호출만**)
- [src/user/dto/create-service-identity.dto.ts](../../src/user/dto/create-service-identity.dto.ts)
  — `service` · `externalId` 2 필드 (T-1739 박제, `isPrimary` 없음)
- [src/user/person.service.ts](../../src/user/person.service.ts) `43~77 행`
  — file-private `getPrismaErrorCode` duck typing helper + `try/catch` 로 `P2002` 를
  `ConflictException` 으로 변환하는 관례 (본 slice 가 mirror 할 패턴)
- [src/user/service-identity.service.spec.ts](../../src/user/service-identity.service.spec.ts)
  — colocated spec 의 기존 mock 구성 (본 slice 는 같은 파일에 describe 를 추가한다)

## Acceptance Criteria

- [ ] `src/user/service-identity.service.ts` 에 public 메서드
      `create(personId: string, dto: CreateServiceIdentityDto): Promise<ServiceIdentity>`
      1 개만 추가 (update · delete · setPrimary 는 추가하지 않는다).
- [ ] 그 메서드는 (1) `PersonRepository.findById` 로 Person 존재를 **선검사** 하고 `null`
      이면 `NotFoundException` (ADR-0058 `§Decision 5` (c) — `findByPersonId` 와 동일한
      선검사 계약 재사용), (2) `ServiceIdentityRepository.create` 에
      `{ personId, service, externalId }` 만 전달 (`isPrimary` 는 **전달하지 않는다** —
      `§Decision 2` 의 "create DTO 는 `isPrimary` 를 받지 않는다"), (3) 생성 직전 시점에
      해당 Person 의 기존 row 가 **0 개였으면** 곧바로
      `ServiceIdentityRepository.setPrimary(personId, created.id)` 를 호출해 그 결과를
      반환하고, 1 개 이상이었으면 생성된 row 를 그대로 반환한다.
- [ ] `P2002` 변환 — repository `create` 가 던진 오류의 code 가 `P2002` 이면
      `ConflictException` 으로 변환 (ADR-0058 `§Decision 5` (a) 행, 409). 그 외 오류는
      **삼키지 않고 그대로 propagate**. code 판별은 `person.service.ts` 와 동형의
      file-private `getPrismaErrorCode` duck typing helper 로 한다 (새 공용 module 신설 ·
      새 dependency 0).
- [ ] `setPrimary` 의 2 op transaction 을 service 에서 **재구현하지 않는다** (ADR-0058
      `§Decision 2` — repository 호출만). service 안에 `$transaction` · `updateMany`
      호출 0.
- [ ] 파일 헤더 주석 갱신 — 본 slice 가 닫은 항목 (create · 자동 승격 · `P2002` → 409) 을
      기존 "Out of Scope" 서술에서 제거하고, 잔여 (update · delete 후 재승격 · setPrimary ·
      `P2025` → 404) 만 남긴다. 승격 판정 기준이 "생성 직전 기존 row 0 개" 임을 ADR 근거와
      함께 명시.
- [ ] colocated spec `src/user/service-identity.service.spec.ts` 에 `create` describe 추가
      — **happy-path test 1+**: 기존 row 2 개인 Person 에 추가 시 repository `create` 가
      `{ personId, service, externalId }` 로 정확히 1 회 호출되고 (인자에 `isPrimary` 키
      부재), `setPrimary` 는 **호출되지 않으며**, 생성된 row 가 그대로 반환됨.
- [ ] **error path test 1+**: Person 부재 (`findById` 가 `null`) 시 `NotFoundException` 이
      던져지고 그때 `create` · `setPrimary` 가 **둘 다 호출되지 않음** (선검사 선행 고정).
- [ ] **분기 cover** — (a) 기존 row 0 개 → `setPrimary` 1 회 호출 + 그 반환값이 최종 반환값,
      (b) 기존 row 1+ 개 → `setPrimary` 미호출 + `create` 반환값이 최종 반환값, (c) `create`
      가 `P2002` throw → `ConflictException`, (d) `create` 가 그 외 code throw → 원 오류
      propagate. 4 분기 각 1+ test.
- [ ] **negative cases 충분 cover** — 최소 5 종 각 1+ test: (i) Person 부재 404,
      (ii) `P2002` → `ConflictException` (`NotFoundException` 아님), (iii) code 가 `P2025`
      또는 code 필드 자체가 없는 오류 (예: plain `Error`) 는 변환 없이 원형 그대로
      propagate — `getPrismaErrorCode` 의 duck typing 이 non-object · code 비-string 입력을
      안전하게 넘김을 고정, (iv) `setPrimary` 가 throw 하면 그 오류가 삼켜지지 않고
      propagate (승격 실패를 조용히 성공으로 만들지 않음), (v) `PersonRepository.findById`
      가 throw 시 propagate. 추가로 (vi) `active=false` 인 soft-deleted Person 도 404 가
      아니라 정상 create 경로를 탐 (`findByPersonId` 와 동일 기준 — drift guard).
- [ ] `pnpm lint` · `pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — `service-identity.service.ts` 는
      statement · branch · function · line 100% 유지.

## Out of Scope

- `update` · `delete` · `setPrimary` service 메서드 — `P2025` → 404 변환 · 소유 검증
  (`§Decision 5` (e)) · 삭제 후 `createdAt` 오름차순 재승격은 **후속 slice**. 본 slice 에서
  구현하지 않는다 (`setPrimary` 는 create 경로 안에서 **호출만** 하고 public 메서드로
  노출하지 않는다).
- controller · route · guard 배선 (`ADR-0058 §Follow-ups (b)`) — `src/user/*.controller.ts`
  및 `src/user/user.module.ts` diff 0 (`ServiceIdentityService` 는 T-1741 이 이미 등록).
- e2e spec (`§Follow-ups (c)`) · AdminView UI (`(d)`) · api.md · requirements.md doc-sync
  (`(e)`) — 전부 후속. `web/` · `test/e2e/` · `docs/architecture/` diff 0.
- `prisma/schema.prisma` · migration · `package.json` 변경 0 (새 dependency 0).
- `ServiceIdentityRepository` 의 5 primitive · DTO 2 종 수정 0 (본 slice 는 호출만 한다).
- `getPrismaErrorCode` 를 공용 helper module 로 추출하는 리팩터 금지 — 기존 관례대로
  file-private 로 두고, 중복 정리는 별도 판단이므로 Follow-ups 로.
- 완료 선언 금지 — PLAN `132 행` 마커 · REQ-078 / REQ-079 status 는 불변.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 append)

## 완료 기록

- **완료 시각**: 2026-08-27T20:57:36Z (squash merge)
- **결과**: `commitMode: pr` — PR [#1372](https://github.com/myungjoo/Assessment-Agent/pull/1372) → main `d9e9e4ce`.
  `ServiceIdentityService.create` 1 메서드만 추가 (`update` · `delete` 재승격 · `setPrimary` 미노출).
  Person 존재 선검사 후 부재면 404, 존재하면 `repository.create` 호출하고
  `isPrimary` 미전달 + 기존 row 0 개일 때만 [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md)
  `§Decision 2` 대로 첫 row 를 자동 primary 로 승격한다 (`setPrimary` 재사용 —
  `$transaction` · `updateMany` 재구현 0). `P2002` 는 `§Decision 5` (a) 대로
  `ConflictException`(409) 로 변환하고 그 외 Prisma 오류는 원형 propagate.
  2 파일 `+286/-13`, colocated spec 11 케이스 추가로 R-112 4 종 cover
  (happy 1 · 분기 4 · negative 6). 대상 service stmt/branch/func/line 100%,
  전체 456 suite / 13070 test green. reviewer round 1/7 APPROVE 후 4-게이트 충족
  → squash 머지 + branch delete.
- **reviewer 관찰 2 건 (finding 아님, 후속 slice 판단 대상)**: ① 승격 판정을 `count`
  대신 전체 row fetch 로 수행 ② 선검사~create 사이 race. 둘 다 PR 코멘트에만 기록.
