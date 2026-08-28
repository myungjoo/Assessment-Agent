---
id: T-1747
title: Wire primary re-promotion into ServiceIdentityService.delete
phase: P5
status: DONE
completedAt: 2026-08-28T01:56:03Z
prNumber: 1377
mergeCommit: b9ddecd9
commitMode: pr
coversReq: [REQ-024, REQ-078, REQ-079]
independentStream: service-identity-backend
dependsOn: [T-1745, T-1746]
touchesFiles:
  - src/user/service-identity.service.ts
  - src/user/service-identity.service.spec.ts
estimatedDiff: 240
estimatedFiles: 2
created: 2026-08-28
plannerNote: P5 / PLAN 132 행 오너 지시 ServiceIdentity chain — T-1745 순수 모듈을 T-1746 delete 에 배선하는 잔여 slice
---

# T-1747 — ServiceIdentityService.delete 에 primary 재승격 배선

## Why

[PLAN.md](../PLAN.md) `132 행` 오너 지시(ServiceIdentity 관리 API·UI, R-182~R-183) chain 의 backend 잔여
slice 다. [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Decision 2` 마지막 항은
"DELETE 는 어떤 경우에도 `N ≥ 1` 인데 primary 0 인 상태를 남기지 않는다" 를 못 박았는데, 현재 코드는
그 계약을 **의도적으로 미구현** 상태다 — [T-1745](T-1745-service-identity-primary-order-module.md) 가 선택
규칙(`selectNextPrimaryIdentity`)만 소비처 0 순수 모듈로 박제했고,
[T-1746](T-1746-service-identity-service-delete.md) 은 3 단 404 + hard delete 까지만 담으며 재승격을
`§Out of Scope` 로 명시 이월했다. 본 slice 가 그 둘을 잇는다 — 순수 모듈을 `delete` 안에서 호출해
REQ-024 의 "1 인원 1 primary" invariant 를 삭제 경로에서도 성립시킨다.

## Required Reading

- [src/user/service-identity.service.ts](../../src/user/service-identity.service.ts) — 특히 헤더 주석의
  "책임 경계" 단락(재승격 이월 문구, 본 slice 가 갱신 대상)과 파일 끝의 `delete` · 그 위 `setPrimary`.
- [src/user/service-identity-primary-order.ts](../../src/user/service-identity-primary-order.ts) —
  `selectNextPrimaryIdentity(rows): ServiceIdentity | null` 시그니처와 "잔여 0 이면 `null`, throw 0,
  입력 배열 비변형" 계약.
- [src/user/service-identity.service.spec.ts](../../src/user/service-identity.service.spec.ts) —
  `buildHarness` / `buildPersonFixture` / `buildServiceIdentityFixture` 와
  `describe("delete — 분기 cover")` 의 `(e) isPrimary=true 인 row 를 지워도 재승격을 호출하지 않는다`
  케이스(본 slice 가 **반대 계약으로 교체**할 대상). spec 최상단 주석의 검증 포인트 목록도 갱신 대상.
- [src/user/service-identity.repository.ts](../../src/user/service-identity.repository.ts) —
  `setPrimary(personId, serviceIdentityId)` 의 2 op `$transaction` 계약(재구현 금지 근거)과
  `findByPersonId` 시그니처.
- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md)
  `§Decision 2` (재승격 규칙 · `N = 0` 정상 상태) 와 `§Decision 5` (b)(e) (오류 변환 · 404 정책).

## 구현 방향 (범위 절단 포함)

`delete` 의 기존 3 단(선검사 404 → 소유 검사 404 → `P2025` 404)은 **그대로 두고**, `repository.delete`
성공 직후에만 재승격 단계를 덧붙인다.

1. 재승격 발동 조건은 **삭제 대상이 primary 였을 때만** 이다. 판정은 이미 확보한 `owned` 목록에서 찾은
   대상 row 의 `isPrimary` 로 한다(`repository.delete` 반환값의 `isPrimary` 를 써도 되나, 둘 중 하나로
   일관되게 고르고 근거를 주석 1 줄로 남길 것). 대상이 primary 가 아니면 승격 동작 0.
2. 잔여 row 는 **2 차 `findByPersonId` 호출 없이** 이미 가진 `owned` 에서 삭제된 `identityId` 를 제외해
   만든다(추가 DB 왕복 0). 그 배열을 `selectNextPrimaryIdentity` 에 넘기고, `null` 이면 승격 없이 종료
   (`N = 0` 정상 상태), 아니면 `repository.setPrimary(personId, next.id)` 를 **1 회** 호출한다.
3. 정렬 규칙(`createdAt` 오름차순 · 동률 시 `id` 오름차순)은 순수 모듈에 위임하며 service 안에서
   재구현하지 않는다. `setPrimary` 의 2 op transaction 도 재구현하지 않는다(repository 가 유일 경로).
4. 반환값 계약은 불변 — `delete` 는 **삭제된 row** 를 그대로 돌려준다. 승격된 row 로 바꾸지 않는다.
5. 재승격 단계에서 발생한 오류는 **변환 없이 그대로 propagate** 한다. `P2025` 를 404 로 바꾸지 않는다 —
   삭제는 이미 성공했으므로 404 는 "DELETE 가 실패했다" 는 거짓 신호가 된다. 이 판단을 주석 1~2 줄로
   남긴다.
6. 파일 헤더 주석의 "책임 경계" 중 재승격 이월 문구를 본 slice 반영으로 갱신한다(장문 재작성 금지 —
   해당 bullet 만 교체).

## Acceptance Criteria

- [ ] `ServiceIdentityService.delete` 가 대상이 primary 였고 잔여 row 가 1+ 일 때
      `repository.setPrimary(personId, <selectNextPrimaryIdentity 가 고른 id>)` 를 정확히 1 회 호출한다.
- [ ] `delete` 의 반환값이 여전히 **삭제된 row** 이며 승격 결과로 대체되지 않는다.
- [ ] happy-path unit test 1+ — primary row 삭제 후 잔여 2 row 중 규칙상 첫 row 가 승격되고,
      반환값·`setPrimary` 인자 정합성을 함께 검증.
- [ ] error path unit test 1+ — 재승격 단계의 `repository.setPrimary` 가 throw 하면(`P2025` 포함)
      **변환 없이 그대로 propagate** 됨을 검증(404 로 바뀌지 않음을 명시적으로 고정).
- [ ] 분기 cover — (a) 대상이 primary 이고 잔여 1+ → 승격 1 회, (b) 대상이 primary 인데 잔여 0 →
      `setPrimary` 호출 0 회, (c) 대상이 primary 가 아님 → 잔여가 있어도 `setPrimary` 호출 0 회,
      (d) 기존 3 단 404 각 분기에서는 `setPrimary` 가 호출되지 않음(단락 보장) — 각 1+ test.
- [ ] negative cases 충분 cover — 예외 상황 분기마다 1+: Person 부재 404 시 `setPrimary` 0 회 ·
      소유 목록에 없어 404 일 때 `setPrimary` 0 회 · `repository.delete` 가 `P2025`/일반 Error 로 실패하면
      승격 시도 0 회 · 잔여 row 가 이미 다른 primary 를 갖고 있어도 규칙대로 결정적으로 고름 ·
      `createdAt` 동률 시 `id` 오름차순 위임 확인(정렬 케이스 총망라 금지 — 위임 확인 1~2 케이스).
- [ ] 기존 `describe("delete — 분기 cover")` 의 `(e) isPrimary=true 인 row 를 지워도 재승격을 호출하지
      않는다` 케이스가 **반대 계약(승격 1 회)으로 교체**되고, 이월을 가리키는 `T-1747` 문구가 spec·service
      주석에서 사라진다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 변경 대상 2 파일 coverage 미하락.
- [ ] diff ≤ 300 LOC / 변경 파일 ≤ 5 개 ([CLAUDE.md](../../CLAUDE.md) §3) — 실제 목표는 2 파일 / ≤ 260 LOC.

## Out of Scope

- **controller · route · guard 배선 0** — DELETE endpoint 노출은 ADR-0058 `§Follow-ups (b)` 의 별도 slice.
- **repository 변경 0** — `findByPersonId` / `setPrimary` / `delete` 어느 시그니처도 건드리지 않는다.
  새 primitive(`findById` 등) 추가 금지.
- **순수 모듈(`service-identity-primary-order.ts`) 변경 0** — 정렬 규칙 수정·확장 금지, spec 도 손대지
  않는다. 본 slice 는 소비처만 만든다.
- **`$transaction` 재구현 0** — 삭제 + 승격을 하나의 transaction 으로 묶는 원자성 강화는 본 slice 밖
  (필요하면 Follow-ups 로만 기록).
- **e2e / smoke spec 추가 0**, ADR 본문 개정 0, `docs/architecture/*` 갱신 0.
- **다른 메서드(`create` / `update` / `setPrimary`) 리팩터 0** — 중복 `getPrismaErrorCode` 정리 등은
  보이더라도 Follow-ups 에만 적는다.
- spec 의 기존 케이스 대량 재작성 금지 — 위 (e) 케이스 교체 + 신규 케이스 추가로 한정.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- `src/user/service-identity-primary-order.ts` 헤더 주석의 "**소비처는 현재 0 이다.** 다음 slice 가 ...
  배선한다" 단락이 본 slice 머지로 사실과 어긋난다 — 주석 1 단락 교체용 후속 slice 권고
  (reviewer 가 PR #1377 에 MINOR 로 외화). 순수 모듈 변경 0 이라는 본 task `§Out of Scope` 때문에
  본 PR 에서 손대지 않았다.

## 결과 (2026-08-28)

`Status: DONE` — PR [#1377](https://github.com/myungjoo/Assessment-Agent/pull/1377) 머지(squash `b9ddecd9`).
`ServiceIdentityService.delete` 성공 직후에만 재승격 단계를 붙였다 — 삭제 대상이 primary 였을 때
2 차 조회 없이 기존 `owned` 스냅샷에서 삭제 id 를 뺀 잔여를 `selectNextPrimaryIdentity`(T-1745) 에
넘기고, 결과가 `null` 이 아니면 `repository.setPrimary` 를 정확히 1 회 호출한다. 반환값은 삭제된 row 로
불변이고 승격 단계의 오류는 404 로 변환하지 않고 그대로 전파한다. 2 파일 `+262/-24`, 대상 service
line/branch/function 100%, 전체 457 suite / 13145 test green. reviewer APPROVE(round 1/7) →
PR comment 외부 post + CI 2/2 pass 로 4-게이트 충족 후 squash merge + branch delete.
