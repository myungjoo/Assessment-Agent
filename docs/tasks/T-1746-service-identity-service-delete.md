---
id: T-1746
title: Add ServiceIdentityService.delete with three-stage 404 (no re-promotion yet)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-078, REQ-079]
independentStream: service-identity-backend
dependsOn: [T-1741, T-1744]
touchesFiles:
  - src/user/service-identity.service.ts
  - src/user/service-identity.service.spec.ts
estimatedDiff: 230
estimatedFiles: 2
created: 2026-08-28
plannerNote: PLAN 132 행 / ADR-0058 Follow-ups (a) 잔여 delete 를 3 단 404 경로만으로 절단 — 재승격 배선은 T-1747
---

# T-1746 — ServiceIdentityService 에 delete 추가 (3 단 404, 재승격은 후속)

## Why

[PLAN.md](../PLAN.md) `132 행` 오너 지시(ServiceIdentity 관리 API·UI, REQ-078 / REQ-079) chain 의 여덟 번째 코드 slice 다. [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (a)` 의 service 잔여는 `delete` 하나뿐인데, 그 method 는 (i) Person 선검사 404 · 소유 검사 404 · `P2025` 404 의 **3 단 404 패턴** 과 (ii) `§Decision 2` 의 **삭제 후 잔여 row 재승격** 을 동시에 진다. 직전 `update` slice 가 단독으로 `+290/-10`, `setPrimary` slice 가 `+291/-8` 이었으므로 둘을 한 commit 에 담으면 [CLAUDE.md §3](../../CLAUDE.md) 의 300 LOC 상한을 확실히 넘는다.

그래서 본 slice 는 **3 단 404 + hard delete 경로만** 가져간다. 재승격에 필요한 정렬 계약은 이미 T-1745 가 `selectNextPrimaryIdentity` 순수 모듈로 선행 박제했고, 그 소비(재승격 배선)는 후속 T-1747 로 남긴다. 현재 controller · route 배선이 0 이라 본 method 는 소비처가 없고, 따라서 중간 상태(마지막 primary 삭제 시 primary 0)가 **외부로 노출되지 않는다** — T-1745 가 소비처 0 순수 모듈을 먼저 머지한 것과 같은 선례다.

## Required Reading

- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md) — `§Decision 2`(재승격 계약 — 본 slice 는 아직 구현 안 함) · `§Decision 5 (b)`(`P2025` → 404) · `§Decision 5 (c)`(Person 선검사 404) · `§Decision 5 (e)`(타 Person 소유 → 403 아닌 404) · `§Follow-ups (a)`
- [src/user/service-identity.service.ts](../../src/user/service-identity.service.ts) — 특히 헤더 주석의 책임/경계 서술과 `setPrimary`(3 단 404 의 정본 패턴, file-private `getPrismaErrorCode` 재사용 지점)
- [src/user/service-identity.service.spec.ts](../../src/user/service-identity.service.spec.ts) — 기존 mock 조립 방식과 `setPrimary` describe 의 케이스 구성(같은 관례를 따를 것)
- [src/user/service-identity.repository.ts](../../src/user/service-identity.repository.ts) `118~124 행` — `delete(id)` 는 hard delete 이며 `P2025` 를 catch 하지 않고 그대로 throw 한다
- [src/user/person.repository.ts](../../src/user/person.repository.ts) — `findById` 시그니처(선검사용)

## Acceptance Criteria

- [ ] `ServiceIdentityService` 에 `async delete(personId: string, identityId: string): Promise<ServiceIdentity>` 1 개만 추가한다. 다른 public 메서드 신설 0, 기존 메서드 시그니처 변경 0.
- [ ] 3 단 404 를 `setPrimary` 와 **동일한 순서** 로 구현: (1) `personRepository.findById(personId)` 가 `null` 이면 `NotFoundException`, (2) `serviceIdentityRepository.findByPersonId(personId)` 결과에 `identityId` 가 없으면 `NotFoundException`(타 Person 소유도 여기서 404 — 403 금지), (3) `serviceIdentityRepository.delete(identityId)` 가 `P2025` 를 throw 하면 `NotFoundException` 으로 변환. 그 외 오류는 삼키지 않고 그대로 propagate.
- [ ] `P2025` 판정은 기존 file-private `getPrismaErrorCode` 를 재사용한다 — 새 helper · 새 module · 새 dependency 0.
- [ ] 삭제된 row 를 그대로 반환(가공 0). `$transaction` · `updateMany` 등 repository 의 op 를 service 에서 재구현하지 않는다.
- [ ] 파일 헤더 주석의 "책임 경계" 단락을 갱신해 **본 slice 가 재승격을 구현하지 않으며 T-1747 이 이어받는다** 는 사실과 그 근거(controller 미배선 → 소비처 0)를 한국어로 박제한다.
- [ ] happy-path unit test 1+ — 존재하는 Person 의 소유 identity 를 삭제하면 repository `delete` 가 `identityId` 로 정확히 1 회 호출되고 그 반환값이 그대로 나온다.
- [ ] error path unit test 1+ — repository `delete` 가 `P2025` 를 throw 하면 `NotFoundException`, `P2025` 가 아닌 오류(예: `P2003` · 일반 `Error`)는 원형 그대로 propagate 됨을 각각 검증.
- [ ] 분기별 test — (a) Person 부재 404, (b) 소유 목록에 없는 identityId 404, (c) 타 Person 소유 identity 404, (d) 정상 삭제, (e) `isPrimary=true` 인 row 삭제 시에도 **재승격 호출이 일어나지 않음**(`setPrimary` mock 호출 0 회 — 본 slice 의 경계를 test 로 고정) 각 1+.
- [ ] negative cases 충분 cover — 빈 문자열 `personId` / 빈 문자열 `identityId` / 빈 목록(identity 0 개인 Person) / `getPrismaErrorCode` 가 code 를 못 뽑는 오류 객체(문자열 throw · `code` 가 숫자) / Person 부재 시 `serviceIdentityRepository` 가 아예 호출되지 않음 / 소유 검사 실패 시 `delete` 가 호출되지 않음 — 각 1+ test.
- [ ] `pnpm lint && pnpm build && pnpm test` 전량 green, `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 대상 파일의 신규 분기는 100% cover 를 목표로 하고, 미커버 라인이 남으면 그 이유를 spec 주석에 한 줄 남긴다.

## Out of Scope

- **삭제 후 재승격 배선** — `selectNextPrimaryIdentity`(T-1745) 소비 · `repository.setPrimary` 재호출은 본 slice 에서 하지 않는다(후속 T-1747). import 도 추가하지 않는다.
- controller · route · guard · module provider 배선 (ADR-0058 `§Follow-ups (b)`).
- `ServiceIdentityRepository` · DTO · `prisma/schema.prisma` 변경.
- `web/` · `test/`(e2e · smoke) · `package.json` · `.github/workflows/` 변경.
- 완료 선언 금지 — [PLAN.md](../PLAN.md) `132 행` 체크박스와 REQ-078 / REQ-079 status 는 그대로 둔다.
- 다른 service 의 `getPrismaErrorCode` 중복 정리(공용 module 추출) — 별도 판단 사안.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (생성 시점 비어 있음)
