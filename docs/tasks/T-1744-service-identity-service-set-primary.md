---
id: T-1744
title: ServiceIdentityService 에 setPrimary 추가 — 소유 검사 404 + repository transaction 재사용
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-078, REQ-079]
estimatedDiff: 195
estimatedFiles: 2
created: 2026-08-27
independentStream: service-identity-management-api
dependsOn: [T-1739, T-1740, T-1741, T-1742, T-1743]
touchesFiles:
  - src/user/service-identity.service.ts
  - src/user/service-identity.service.spec.ts
plannerNote: "PLAN 132행/REQ-078·079 여섯 번째 코드 slice — ADR-0058 §Decision 2 primary 단일 경로 + §Decision 5 (b)(c)(e) 404 만 절단"
---

# T-1744 — ServiceIdentityService 에 setPrimary 추가 — 소유 검사 404 + repository transaction 재사용

## Why

오너 지시 [PLAN.md](../PLAN.md) `132 행` (REQ-078 / REQ-079) 의 ServiceIdentity 관리 API
chain 여섯 번째 코드 slice 다. [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md)
`§Follow-ups (a)` 의 잔여는 `ServiceIdentityService` 의 2 method (`setPrimary` ·
`delete` 후 재승격) 인데, `delete` 는 "잔여 row 중 `createdAt` 오름차순 (동률이면 `id`
오름차순) 첫 row 자동 재승격" 이라는 별도 정렬 계약을 함께 짊어져 두 method 를 한 slice 로
묶으면 R-112 spec 포함 시 §3 cap (≤ 300 LOC) 을 확실히 넘는다 (직전 T-1743 이 `update`
1 method 만으로 `+290/-10` 이었다). 본 slice 는 그중 **`setPrimary` 하나만** 절단한다 —
`§Decision 1` 의 전용 POST 경로 (`/api/persons/:personId/identities/:identityId/primary`)
backend 이며, `§Decision 2` 의 "primary 전이는 repository `setPrimary` transaction 이 유일
경로" 를 service 에 못 박아 후속 `delete` 재승격 slice 가 그 계약을 그대로 승계하게 한다.

**issue-still-relevant 실측 (`origin/main`)**: [service-identity.service.ts](../../src/user/service-identity.service.ts)
의 public 메서드는 `findByPersonId` (`72 행`) · `create` (`90 행`) · `update` (`139 행`)
3 개뿐이고 `setPrimary` 는 **public 으로 노출돼 있지 않다** — 현재 `setPrimary` 문자열은
`create` 안의 `this.serviceIdentityRepository.setPrimary(...)` 호출 1 건과 헤더 주석의
"후속 slice" 서술뿐이다. `git grep "identities" -- "src/**/*.controller.ts"` 도 여전히
**0 건** 이라 HTTP surface 미안착도 유지된다.

## Required Reading

- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md)
  — `§Decision 1` route 표의 **primary 지정 행** (전용 action POST · 성공 200 · **idempotent**
  — "이미 primary 인 row 에 재요청해도 결과 상태가 같고 200") · `§Decision 2` 전체
  (invariant 정식 서술 · **repository 의 `setPrimary` transaction 을 재구현하지 않고 그대로
  호출** · primary 축은 전용 경로 하나로 단일화) · `§Decision 5` 표의 (b) 행 (`P2025` →
  `NotFoundException` 404, 발생 지점에 `setPrimary` 포함) · (c) 행 (Person 부재 선검사 404) ·
  (e) 행 (타 Person 소유 → 403 아닌 404) · `§Follow-ups (a)`
- [src/user/service-identity.service.ts](../../src/user/service-identity.service.ts)
  — 본 slice 가 확장할 파일 전체. 특히 `update` (`139 행~`) 의 **Person 선검사 → `findByPersonId`
  재사용 소유 검사 → `getPrismaErrorCode` 로 Prisma code 판정** 3 단 패턴 (본 slice 가 그대로
  mirror 한다 — 새 helper · 새 repository 메서드 0) 과 `create` (`90 행~`) 의
  `this.serviceIdentityRepository.setPrimary(personId, created.id)` 호출부 (동일 primitive 를
  본 slice 도 호출한다) · 헤더 주석의 "책임 경계 (Out of Scope)" 목록 (본 slice 가 닫는
  `setPrimary` 를 그 목록에서 제거하고 `delete` 후 재승격만 남겨야 한다)
- [src/user/service-identity.repository.ts](../../src/user/service-identity.repository.ts)
  `91~116 행` (`setPrimary(personId, serviceIdentityId)` — `updateMany` unset + `update` set
  2 op 를 `$transaction` 으로 묶으며 id 부재 시 `P2025` throw · "0→1 / 1→다른 1 transition
  모두 cover" 주석) · `61~66 행` (`findByPersonId` — 소유 검사에 재사용할 primitive.
  repository 에 `findById` 는 **없고 추가하지 않는다**)
- [src/user/service-identity.service.spec.ts](../../src/user/service-identity.service.spec.ts)
  `1~45 행` — colocated spec 헤더 주석 관례 + `buildPersonFixture` (`as` 단언 금지 관례) ·
  `buildServiceIdentityFixture` · repository mock 구성. 본 slice 는 **같은 파일에 describe 를
  추가** 한다 (새 spec 파일 신설 금지).

## Acceptance Criteria

- [ ] `src/user/service-identity.service.ts` 에 public 메서드
      `setPrimary(personId: string, identityId: string): Promise<ServiceIdentity>`
      **1 개만** 추가 (`delete` · 삭제 후 재승격은 추가하지 않는다).
- [ ] 그 메서드는 다음 순서를 지킨다:
      (1) `PersonRepository.findById` 로 Person 존재 **선검사** — `null` 이면
      `NotFoundException` (ADR §Decision 5 c) 이고 이때 `ServiceIdentityRepository` 는
      **한 번도 호출되지 않는다**.
      (2) `ServiceIdentityRepository.findByPersonId(personId)` 결과에 `identityId` 와
      일치하는 row 가 없으면 `NotFoundException` (ADR §Decision 5 e — 403 아님, 메시지에
      타 Person row 의 존재 사실 · 소유자 personId 를 담지 않는다). repository 에
      `findById` 를 새로 추가하지 않는다.
      (3) `ServiceIdentityRepository.setPrimary(personId, identityId)` 를 호출하고 그
      반환값을 **가공 없이** 반환한다.
- [ ] **transaction 재구현 0** — 본 메서드 안에서 `$transaction` · `updateMany` ·
      `repository.update` 를 호출하지 않는다 (ADR §Decision 2: repository `setPrimary` 가
      유일 경로). `git grep -n "\$transaction\|updateMany" src/user/service-identity.service.ts`
      결과 0 건 유지.
- [ ] **idempotent 경로에 early return 을 넣지 않는다** — 대상 row 가 이미
      `isPrimary === true` 여도 `repository.setPrimary` 를 그대로 호출한다 (`N ≥ 1` 인데
      다른 row 가 잘못 primary 인 상태의 복구 경로를 막지 않기 위함). 그 근거를 코드 주석
      1~2 줄로 남긴다.
- [ ] `repository.setPrimary` 가 던진 `P2025` 는 `NotFoundException` (404) 으로 변환 (ADR
      §Decision 5 b). 변환에는 기존 file-private `getPrismaErrorCode` 를 재사용하고 **새
      helper 를 만들지 않는다**. `P2025` 외의 오류는 삼키지 않고 원형 그대로 propagate.
- [ ] 파일 헤더 주석의 "책임 경계 (Out of Scope)" 목록에서 `setPrimary` 를 제거하고 잔여
      (`delete` 후 재승격 · controller 배선) 만 남긴다.
- [ ] **happy-path unit test 1+** — Person 존재 + 본인 소유 identity → `repository.setPrimary`
      가 `(personId, identityId)` 정확한 인자로 **1 회** 호출되고 그 반환 row 가 가공 없이
      그대로 반환된다.
- [ ] **error path unit test 1+** — (a) Person 부재 → `NotFoundException` 이고
      `ServiceIdentityRepository` 미호출, (b) `repository.setPrimary` 의 `P2025` →
      `NotFoundException` 으로 변환.
- [ ] **분기 test** — 4 분기 각 1+ : ① Person 부재 ② 소유 불일치 (해당 Person 목록에
      `identityId` 없음) ③ 대상이 이미 `isPrimary=true` (그래도 `setPrimary` 호출 1 회 —
      idempotent) ④ 대상이 `isPrimary=false` 인 정상 승격.
- [ ] **negative cases 충분 cover** — 각 1+ test:
      ① 타 Person 소유 id → `NotFoundException` 이며 메시지에 그 row 의 존재 사실 · 소유자
      personId 가 드러나지 않는다 (ADR §Decision 5 e) 이고 `repository.setPrimary` 미호출,
      ② 해당 Person 의 identity 목록이 빈 배열 → 404 이고 `repository.setPrimary` 미호출,
      ③ `repository.setPrimary` 가 `P2025` 아닌 오류 (예: `P2002` · 일반 `Error`) 를 던지면
      **변환 없이** 그대로 propagate,
      ④ `PersonRepository.findById` 자체의 throw propagate,
      ⑤ `findByPersonId` 자체의 throw propagate,
      ⑥ soft-deleted Person (`active: false`) 도 row 가 존재하면 404 가 아니다 (선검사 기준이
      `isActive` 가 아니라 **row 존재** 임을 고정 — T-1741 이 박제한 계약 승계),
      ⑦ `$transaction` · `updateMany` 재구현 0 drift guard — 본 경로에서 `repository.update`
      가 호출되지 않는다.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- `delete` (+ 잔여 row `createdAt`/`id` 오름차순 primary 재승격) — 후속 slice.
- controller · route · guard (`@UseGuards` / `@Roles`) · `@HttpCode(200)` · `ValidationPipe`
  배선 (ADR-0058 `§Follow-ups (b)`) — 본 slice 는 service layer 만.
- `ServiceIdentityRepository` 변경 (`findById` 추가 · `setPrimary` 시그니처 변경 포함) ·
  `prisma/schema.prisma` · DTO 파일 · `user.module.ts` — diff 0 파일.
- e2e / smoke 스위트 신설, `web/` AdminView 패널, `docs/architecture/api.md` 갱신,
  PLAN `132 행` `[x]` 승격 · REQ-078 / REQ-079 status 변경 — 전부 후속 (`§Follow-ups (c)~(e)`).
- `getPrismaErrorCode` 의 공용 module 추출 (person.service.ts 와의 중복 정리) — 별도 판단.
- 새 외부 dependency 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 append)
