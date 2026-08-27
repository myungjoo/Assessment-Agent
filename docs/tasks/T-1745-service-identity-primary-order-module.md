---
id: T-1745
title: DELETE 후 primary 재승격 대상 선택 순수 모듈 신설 — createdAt 오름차순 · 동률 시 id 오름차순
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-078, REQ-079, REQ-024]
estimatedDiff: 195
estimatedFiles: 2
created: 2026-08-28
independentStream: service-identity-management-api
dependsOn: [T-1739, T-1740, T-1741, T-1742, T-1743, T-1744]
touchesFiles:
  - src/user/service-identity-primary-order.ts
  - src/user/service-identity-primary-order.spec.ts
plannerNote: "PLAN 132행/REQ-078·079 일곱 번째 코드 slice — ADR-0058 §Decision 2 재승격 정렬 계약만 순수 모듈로 절단 (delete 배선은 후속)"
---

# T-1745 — DELETE 후 primary 재승격 대상 선택 순수 모듈 신설

## Why

오너 지시 [PLAN.md](../PLAN.md) `132 행` (REQ-078 / REQ-079) 의 ServiceIdentity 관리 API
chain 일곱 번째 코드 slice 다. [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md)
`§Follow-ups (a)` 의 잔여는 `ServiceIdentityService.delete` 하나인데, 그 method 는
(i) Person 선검사 404 · 소유 검사 404 · `P2025` 404 변환이라는 직전 slice 들과 같은 3 단
패턴과 (ii) **"잔여 row 중 `createdAt` 오름차순 (동률이면 `id` 오름차순) 첫 row 자동 재승격"**
(`§Decision 2` 마지막 항) 이라는 **새 정렬 계약**을 동시에 짊어진다. 직전 `update` (T-1743)
가 3 단 패턴만으로 `+290/-10` 이었으므로 둘을 한 slice 로 묶으면 R-112 spec 포함 시
[CLAUDE.md §3](../../CLAUDE.md) cap (≤ 300 LOC) 을 확실히 넘는다.

그래서 본 slice 는 **정렬 계약만** 의존성 0 의 순수 모듈로 잘라낸다 — `Injectable` · Prisma ·
repository 를 전혀 모르는 함수 1 개라 재승격 규칙의 모든 분기 (빈 배열 · 단일 row · 시각
동률 · 역순 입력) 를 값 수준에서 값싸게 고정할 수 있고, 후속 `delete` slice 는 그 함수를
호출만 하므로 3 단 패턴 spec 에 집중할 수 있다. 저장소가 반복해 쓴
presentational/pure-module-first 패턴 (T-1733 → T-1735, T-1734 → T-1737) 의 승계다.

**issue-still-relevant 실측 (`origin/main` `f910914f`)**: `git grep -rn "NextPrimary\|primary-order" -- src`
**0 건**, `src/user/` 에 `service-identity-primary-order.ts` **부재**.
[service-identity.service.ts](../../src/user/service-identity.service.ts) 의 public 메서드는
`findByPersonId` · `create` · `update` · `setPrimary` (`189 행`) 4 개이고 `delete` 는 **없다**.
`git grep -n "identities" -- "src/**/*.controller.ts"` 도 여전히 0 건이라 HTTP surface 미안착
상태가 유지된다.

## Required Reading

- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md)
  `§Decision 2` 의 마지막 두 항 — "**마지막 primary 삭제 시 동작**" (잔여 row 중 `createdAt`
  오름차순, 동률이면 `id` 오름차순 첫 row 를 자동 primary 승격 / 잔여 0 이면 승격하지 않고
  `N = 0` 으로 끝남 / 대상이 primary 가 아니면 승격 동작 없음) 과 "invariant 정식 서술"
  (`N ≥ 1` 이면 정확히 1 row `isPrimary=true`, `N = 0` 은 정상 상태)
- [prisma/schema.prisma](../../prisma/schema.prisma) `257~265 행` — `ServiceIdentity` model 의
  필드 집합 (`id` `@default(cuid())` · `createdAt DateTime @default(now())` · `isPrimary` ·
  `updatedAt`). 본 모듈의 입력 타입이 이 model 을 그대로 쓴다.
- [src/user/service-identity.service.ts](../../src/user/service-identity.service.ts)
  `1~30 행` (헤더 주석의 "책임 경계 (Out of Scope)" 목록 — 잔여가 `delete` 후 재승격임을
  확인용으로만 읽는다. **본 slice 는 이 파일을 수정하지 않는다**) 와 `189 행~` `setPrimary`
  (후속 slice 가 본 모듈의 결과를 이 메서드에 넘긴다는 소비 방향 확인용)
- [src/user/service-identity.service.spec.ts](../../src/user/service-identity.service.spec.ts)
  `1~45 행` — colocated spec 헤더 주석 관례 + `buildServiceIdentityFixture` 의 fixture 조립
  방식 (`as` 단언 금지 관례). 본 slice 의 새 spec 도 같은 관례로 fixture 를 만든다.

## Acceptance Criteria

- [ ] 새 파일 `src/user/service-identity-primary-order.ts` 를 만들고 함수
      `selectNextPrimaryIdentity(rows: readonly ServiceIdentity[]): ServiceIdentity | null`
      **1 개만** export 한다 (`@prisma/client` 의 `ServiceIdentity` 는 `import type` 으로만
      가져온다).
- [ ] **의존성 0** — 파일 안에 `@nestjs/common` · `PrismaService` · repository · service
      import 가 없다 (`@Injectable` 미사용). `git grep -n "nestjs\|Prisma\(Service\)\?\b" src/user/service-identity-primary-order.ts`
      결과가 `import type { ServiceIdentity } from "@prisma/client";` 한 줄 외 0 건.
- [ ] 선택 규칙은 ADR `§Decision 2` 그대로 — `createdAt` **오름차순**, 동률이면 `id`
      **오름차순 (문자열 비교)** 의 첫 row 를 반환. 빈 배열이면 `null`.
- [ ] **입력 배열을 변형하지 않는다** — `Array.prototype.sort` 를 원본에 직접 걸지 않고 복사본
      (또는 단일 순회 최소값 선택) 으로 처리한다. 호출 후 원본 배열의 순서 · 길이가 불변임을
      spec 이 단언한다.
- [ ] `isPrimary` 값은 선택에 **영향을 주지 않는다** — 이미 `isPrimary=true` 인 row 가 섞여
      있어도 규칙은 동일하게 `createdAt`/`id` 로만 고른다. 그 근거 (호출 시점은 primary 가
      0 인 삭제 직후이며, 잘못 primary 인 row 가 남은 복구 상황에서도 결정적이어야 함) 를
      코드 주석 1~2 줄로 남긴다.
- [ ] 파일 헤더 주석에 (a) 본 모듈이 ADR-0058 `§Decision 2` 의 재승격 정렬 계약만 담당하고
      **삭제 · 승격 실행 · 404 판정은 후속 `ServiceIdentityService.delete` slice 책임** 이라는
      경계, (b) 소비처가 아직 0 이며 다음 slice 가 배선한다는 사실을 명시한다.
- [ ] **happy-path unit test 1+** — `createdAt` 이 서로 다른 3 row 를 무작위 순서로 넣으면
      가장 이른 `createdAt` row 가 반환된다 (동일 객체 참조).
- [ ] **error path unit test 1+** — (a) 빈 배열 → `null` (throw 하지 않는다), (b) `createdAt`
      이 **완전 동률** 인 2 row → `id` 오름차순 첫 row 반환 (throw 하지 않고 결정적).
- [ ] **분기 test** — 각 1+ : ① 빈 배열 (`null`) ② 단일 row (그 row) ③ `createdAt` 비교로
      결정 (비동률) ④ `createdAt` 동률 → `id` tie-break ⑤ 이미 정렬된 입력과 역순 입력이
      **같은 결과** (comparator 의 `<` · `>` 두 방향 모두 통과).
- [ ] **negative cases 충분 cover** — 각 1+ test:
      ① 원본 배열 비변형 (호출 전후 `rows.map((r) => r.id)` 가 동일),
      ② 입력에 `isPrimary=true` row 가 이미 있어도 그 row 가 아니라 규칙상 첫 row 가 선택,
      ③ 서로 다른 `Date` 인스턴스지만 **같은 시각** 이면 동률로 취급 (참조 비교 아님),
      ④ `id` tie-break 가 문자열 사전순임을 대문자/소문자 · 숫자 섞인 cuid 유사 값으로 고정
      (locale 의존 비교 금지 — `localeCompare` 사용 금지),
      ⑤ row 4+ 중 최소가 배열 **마지막** 에 있어도 정확히 선택 (조기 반환 버그 방지),
      ⑥ 반환값이 입력 원소와 **동일 참조** (복사본 · spread 로 새 객체를 만들지 않는다),
      ⑦ 모든 row 의 `createdAt` 과 `id` 가 각각 동률일 수 없으므로 (`id` 는 PK) `id` 동률
      입력은 만들지 않되, `createdAt` 동률 3 row 에서도 `id` 최소가 선택됨을 확인.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- `ServiceIdentityService.delete` 메서드 추가 · 본 모듈 배선 — **후속 slice** (본 slice 는
  소비처 0 인 순수 모듈만 만든다). `src/user/service-identity.service.ts` 는 diff 0 파일.
- controller · route · guard · `@HttpCode(204)` · DTO · `user.module.ts` provider 등록
  (ADR-0058 `§Follow-ups (b)`) — 순수 함수라 DI provider 로 등록하지 않는다.
- `ServiceIdentityRepository` 변경 (`findByPersonId` 정렬 옵션 추가 · `delete` 시그니처 변경
  포함) · `prisma/schema.prisma` — diff 0 파일.
- primary invariant 자체의 런타임 검증 (2+ primary 상태 탐지 · 자동 복구) — ADR `§Decision 2`
  는 강제 지점만 service layer 로 정했을 뿐 감사 기능은 범위 밖.
- e2e / smoke 스위트, `web/` AdminView 패널, `docs/architecture/api.md` 갱신, PLAN `132 행`
  `[x]` 승격 · REQ-078 / REQ-079 status 변경 — 전부 후속 (`§Follow-ups (c)~(e)`).
- 새 외부 dependency 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 append)

## 결과 (DONE — 2026-08-27T23:55:37Z)

- PR [#1375](https://github.com/myungjoo/Assessment-Agent/pull/1375) squash 머지 → main `b7d94c55`, feature branch 삭제 완료.
- `src/user/service-identity-primary-order.ts` 에 `selectNextPrimaryIdentity` 하나만 export — `createdAt` 오름차순 · 동률 시 `id` 오름차순 · 빈 배열 `null`. 단일 순회 최소값 선택이라 입력 배열 비변형(`sort` 미사용), `Date` 는 `getTime()` epoch 비교, `isPrimary` 는 선택에 무영향(삭제 직후 primary 0 · 복구 상황 결정성 — 근거 주석 박제).
- 의존성 0 — `@nestjs/*` · `PrismaService` · repository import 0 건, 소비처 0 (`delete` 배선은 후속 slice).
- 2 파일 `+239/-0`. colocated spec 15 케이스로 R-112 4 종 cover (happy 1 · error 2 · branch 5 · negative 7). 신규 모듈 line 92.85% / function 100% / branch 100% (미커버는 `id` 동률 시에만 닿는 `return 0` — `id` 는 PK 라 입력 불가). 전체 457 suite 13116 test green.
- reviewer round 1/7 APPROVE (PR 코멘트로 외화) 후 4-게이트 PASS.
