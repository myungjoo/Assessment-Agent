---
id: T-1741
title: ServiceIdentityService 신설 — Person 존재 선검사 + 목록 조회
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-078, REQ-079]
estimatedDiff: 260
estimatedFiles: 3
created: 2026-08-27
independentStream: service-identity-management-api
dependsOn: [T-1739, T-1740]
touchesFiles:
  - src/user/service-identity.service.ts
  - src/user/service-identity.service.spec.ts
  - src/user/user.module.ts
plannerNote: "PLAN 132행/REQ-078·079 세 번째 코드 slice — ADR-0058 (a) 잔여 service 를 골격+list 로 절단 (자동 승격·삭제 재승격은 후속)"
---

# T-1741 — ServiceIdentityService 신설 — Person 존재 선검사 + 목록 조회

## Why

오너 지시 [PLAN.md](../PLAN.md) `132 행` (REQ-078 / REQ-079) 의 ServiceIdentity 관리 API chain
세 번째 코드 slice 다. [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md)
`Follow-ups (a)` 는 DTO + service + repository `update` 를 한 덩어리로 묶어 두었고, T-1739 가
DTO 2 종을, T-1740 이 repository `update` primitive 를 잘라 닫았다. 잔여는
`ServiceIdentityService` 하나인데, 이를 통째로 만들면 5 route 분(list · create 자동 승격 ·
update · delete 재승격 · setPrimary) + `§Decision 5` 오류 변환표 5 행이 한 slice 에 몰려
R-112 spec 포함 시 400 LOC 을 확실히 넘는다. 그래서 본 slice 는 **service 골격 + 조회
경로 1 개** 만 절단한다 — 후속 method 들이 전부 재사용할 **Person 존재 선검사**
(`§Decision 5` (c) — GET 도 "부재한 상위 resource 가 200 을 주면 경로 의미가 깨진다" 는
근거로 선검사 후 404) 계약을 여기서 못 박아 두는 것이 본 slice 의 실질이다.

## Required Reading

- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md)
  — `§Decision 1` (GET route · User+ 권한) · `§Decision 2` (primary invariant 서술, `N = 0`
  정상 상태) · `§Decision 5` (c) 행 (Person 부재 → 404, GET 에도 적용) · `§Follow-ups (a)`
- [src/user/service-identity.repository.ts](../../src/user/service-identity.repository.ts)
  — `findByPersonId` 시그니처 + "정렬은 Prisma default 유지" 주석 + Prisma error 정책
- [src/user/person.repository.ts](../../src/user/person.repository.ts) `59~80 행`
  — `findById(id): Promise<Person | null>` (선검사에 사용할 primitive)
- [src/user/person.service.ts](../../src/user/person.service.ts) `1~80 행`
  — 헤더 주석 관례 · `getPrismaErrorCode` duck typing 패턴 · `NotFoundException` 사용례
- [src/user/user.module.ts](../../src/user/user.module.ts) `100~170 행`
  — `providers` / `exports` 배열 (신규 service 등록 위치)
- [src/user/service-identity.repository.spec.ts](../../src/user/service-identity.repository.spec.ts)
  `1~60 행` — colocated spec 의 Prisma mock 구성 관례
- [test/helpers/prisma-mock.ts](../../test/helpers/prisma-mock.ts) — 공용 mock helper (재사용 가능 시)

## Acceptance Criteria

- [ ] `src/user/service-identity.service.ts` 신설 — `@Injectable()` `ServiceIdentityService`
      가 `PersonRepository` + `ServiceIdentityRepository` 2 collaborator 를 생성자 주입받고,
      public 메서드는 **`findByPersonId(personId): Promise<ServiceIdentity[]>` 1 개만** 노출.
- [ ] 그 메서드는 (1) `PersonRepository.findById` 로 Person 존재를 **선검사** 하고 `null`
      이면 `NotFoundException` 을 던지며, (2) 존재하면
      `ServiceIdentityRepository.findByPersonId` 결과를 **가공 없이 그대로** 반환한다
      (정렬 · 필터 · 매핑 0 — repository 주석의 "Prisma default 순서 유지" 승계).
- [ ] 선검사 기준이 **row 존재 여부** 이며 `active` 값과 무관함을 코드 주석에 근거
      (ADR-0058 `§Decision 5` (c) 는 "미존재 personId" 만을 404 사유로 규정) 와 함께 명시.
- [ ] `src/user/user.module.ts` 의 `providers` · `exports` 배열에 `ServiceIdentityService`
      등록 (기존 배열 원소 · 다른 module 설정 변경 0).
- [ ] colocated spec `src/user/service-identity.service.spec.ts` 신설 — **happy-path test
      1+**: Person 이 존재하고 identity N row 일 때 repository 결과 배열이 그대로 반환되고
      `findByPersonId` 가 인자 `personId` 로 정확히 1 회 호출됨.
- [ ] **error path test 1+**: Person 부재(`findById` 가 `null`) 시 `NotFoundException` 이
      던져지고, 그때 `ServiceIdentityRepository.findByPersonId` 는 **호출되지 않음**
      (선검사가 실제로 선행함을 고정).
- [ ] **분기 cover** — (a) Person 존재 + identity 0 row → 빈 배열 200 경로 (ADR-0058
      `§Decision 2` 의 `N = 0` 정상 상태), (b) Person 존재 + identity 2+ row, (c) Person 부재
      → 404 세 분기 각 1+ test.
- [ ] **negative cases 충분 cover** — 최소 4 종 각 1+ test: (i) Person 부재 404,
      (ii) `PersonRepository.findById` 가 throw 시 그 오류를 삼키지 않고 propagate,
      (iii) `ServiceIdentityRepository.findByPersonId` 가 throw 시 propagate (변환 0),
      (iv) 반환 배열을 service 가 정렬 · 필터 · 복제 변형하지 않음 (repository 반환값과
      원소 순서 · 내용 동일 — drift guard), (v) `active=false` 인 soft-deleted Person 도
      404 가 아니라 정상 목록 경로를 탐 (위 주석 근거의 test 고정).
- [ ] `pnpm lint` · `pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 파일은 statement · branch ·
      function · line 100% 목표.

## Out of Scope

- `create` · `update` · `delete` · `setPrimary` service 메서드 — 자동 primary 승격 ·
  삭제 후 재승격 · `P2002` → 409 · `P2025` → 404 변환은 **후속 slice**. 본 slice 에서
  구현하지 않는다.
- controller · route · guard 배선 (`ADR-0058 §Follow-ups (b)`) — `src/user/*.controller.ts`
  diff 0.
- e2e spec (`§Follow-ups (c)`) · AdminView UI (`(d)`) · api.md · requirements.md doc-sync
  (`(e)`) — 전부 후속. `web/` · `test/e2e/` · `docs/architecture/` diff 0.
- `prisma/schema.prisma` · migration · `package.json` 변경 0 (새 dependency 0).
- `ServiceIdentityRepository` 의 기존 5 primitive 수정 0 (본 slice 는 호출만 한다).
- 목록 정렬 규칙 도입 금지 — 정렬이 필요하다면 별도 결정이므로 Follow-ups 로.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 append)
