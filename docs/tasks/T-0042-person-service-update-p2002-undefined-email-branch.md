---
id: T-0042
title: P3 — PersonService.update P2002 + patch.email undefined branch unit test (branch coverage 100%)
phase: P3
status: PENDING
commitMode: pr
coversReq: [REQ-112]
estimatedDiff: 25
estimatedFiles: 1
created: 2026-05-26
plannerNote: P3 L63 bullet 1 — person.service.ts update() P2002 + patch.email undefined nullish branch 의 단일 unit test 추가, 96.66% → 100% branch coverage. R-112 negative cover 의무.
dependsOn: [T-0036]
blocks: []
plannerSource: PLAN.md L63 (P3 bullet 1)
humanApprovalGate: false
---

# T-0042 — PersonService.update P2002 + patch.email undefined branch unit test

## Why

[docs/PLAN.md](../PLAN.md) Phase P3 단락 L63 bullet 1 ("[테스트 품질] unit branch coverage 완성 — `person.service.ts` L120 `update()` P2002 발생 시 `patch.email` 이 undefined 인 케이스 unit test 추가, 현재 branch 96.66% → 100% 목표. R-112 negative case 충분 cover 의무 이행") 의 정확한 cover.

T-0036 머지 시점 ([6b84c62](https://github.com/myungjoo/Assessment-Agent/commit/6b84c62)) 의 PersonService [src/user/person.service.ts](../../src/user/person.service.ts) L102~125 `update()` 메서드 안 L120 의 nullish coalescing 분기:

```ts
throw new ConflictException(
  `email already in use: ${patch.email ?? ""}`,
);
```

`patch.email ?? ""` 의 2 분기 중 left-truthy (patch.email defined string) 는 [person.service.spec.ts](../../src/user/person.service.spec.ts) L396 의 기존 test "`P2002 (unique constraint) 를 ConflictException 으로 변환한다 (error)`" 가 cover (호출 `service.update(id, { email: 'dup@x.test' })` 의 patch 가 email 포함). 그러나 right (patch.email === undefined → `""` fallback) 분기는 cover 안 됨 — Jest coverage report 에서 branch 잔여 1 = 96.66%. **본 task 는 patch.email undefined 인 상태에서 P2002 가 throw 되는 (실제로는 fullName 만 patch 했는데 repository 또는 Prisma 가 P2002 reject 한 비정상 시나리오 — defensive coverage) unit test 1 개를 person.service.spec.ts 의 `describe("update", ...)` block 안에 추가한다**. 이로 branch 100% 달성.

본 task 의 정당성:

- **R-112 negative case 충분 cover 의무** ([CLAUDE.md §3.2](../../CLAUDE.md)) — "예외 처리 분기마다 cover". 본 분기 (patch.email undefined + P2002) 는 비정상 시퀀스 (validator 가 통과시킨 patch 에 email 없는데 unique constraint 가 동일 row 의 다른 unique field 로 fail 했거나 race condition 으로 repository.update 가 P2002 변환) 의 defensive 처리 — 단일 test 없이 silently 통과 중. patch.email 없을 때 error message 가 `"email already in use: "` (공백) 가 되는 의도된 fallback 확인.
- **coverage threshold 안정성** — 후속 backbone task (GroupService / PartService / Group/Part controller / AssessmentModule 등) 가 도입되면서 branch coverage 가 자연 감소 할 위험. 현 96.66% gap 을 100% 로 closure 해두면 후속 PR 의 coverage threshold drift 가 명확히 감지됨 — 80% AND 80% 의 minimum 만 강제하는 현 jest config 하에서도 reviewer 의 자체 점검 8-check 에서 coverage trend 가시화.
- **task size minimal** — 단일 spec 파일에 단일 `it(...)` block 추가 + repoMock 설정 1 줄 + assert 2 줄 = 총 ~12 LOC 변경 (1 파일). cap (≤ 300 LOC / ≤ 5 파일) 의 1/25. T-0036 머지 후 즉시 처리 가능 PR-mode round 1 단발 후보.

본 task 의 정확한 산출물 (1 파일 / ~25 LOC max):

1. **[src/user/person.service.spec.ts](../../src/user/person.service.spec.ts)** 수정 — `describe("update", ...)` block 안 (L216~ 후반 — 기존 L396 P2002 test 직후 또는 L360 P2002 동시 patch test 직후) 에 새 `it(...)` 추가:
   - test 이름: "patch.email 이 undefined 인 상태에서 P2002 propagate 시 ConflictException 으로 변환 + message 의 email 부분이 빈 문자열 fallback (branch coverage)"
   - 호출: `service.update(personId, { fullName: "홍길동" })` — patch.email 없음
   - mock 설정: `repoMock.update.mockRejectedValueOnce(buildPrismaError("P2002"))`
   - assert: `await expect(...).rejects.toThrow(ConflictException)` + error.message includes `"email already in use:"` (trailing space 또는 empty 후속)
   - 추가 LOC ≤ 25 (test block 단독, 기존 test/helper 재사용).

## Required Reading

- [docs/PLAN.md](../PLAN.md) Phase P3 단락 L63 bullet 1 — 본 task 의 source bullet
- [CLAUDE.md](../../CLAUDE.md) §3.2 (R-110~R-114 — R-112 negative case 충분 cover 의무)
- [src/user/person.service.ts](../../src/user/person.service.ts) L102~125 `update()` 메서드 — 본 task 의 cover 대상 분기 (L120 의 `patch.email ?? ""`)
- [src/user/person.service.spec.ts](../../src/user/person.service.spec.ts) — 기존 update test 패턴 (L216 `describe("update", ...)` block + L360 의 동시 patch + L396 의 happy P2002) — 본 task 가 동일 패턴으로 1 test 추가
- [docs/tasks/T-0036-person-service-controller-dto.md](T-0036-person-service-controller-dto.md) §F unit test (R-112 4 항목) — 본 task 의 직접적 기원 (T-0036 머지 시점의 branch 96.66% gap)
- [package.json](../../package.json) — `coverageThreshold.global` (line ≥ 80% / function ≥ 80%) + `pnpm test:cov` script

## Acceptance Criteria

본 task 의 모든 항목은 verify command 또는 file inspection 으로 검증 가능. [CLAUDE.md §3.2](../../CLAUDE.md) (R-110~R-114) 강제 항목 포함.

### A. Test 코드

- [ ] [src/user/person.service.spec.ts](../../src/user/person.service.spec.ts) 의 `describe("update", ...)` block 안에 새 `it(...)` test 1 개 추가 — patch 에 `email` 없이 (예: `{ fullName: "홍길동" }` 만) `repository.update` 가 P2002 reject 시 `ConflictException` 으로 변환되고 error.message 가 `"email already in use:"` (trailing fallback `""`) 로 끝남을 검증.
- [ ] test 이름은 한국어로 명확히 — "patch.email 이 undefined 인 상태에서 P2002 propagate 시 ConflictException 으로 변환 + email 부분이 빈 문자열 fallback (branch coverage)" 또는 동등 의미 표현.
- [ ] mock 설정은 기존 `buildPrismaError("P2002")` helper 와 `repoMock.update.mockRejectedValueOnce(...)` 패턴 재사용. 새 helper 신설 안 함.
- [ ] assert 는 (1) `await expect(service.update(personId, { fullName: "홍길동" })).rejects.toThrow(ConflictException)` (2) `await expect(...).rejects.toThrow(/email already in use:/)` 또는 동등 `try-catch` + `expect(error.message).toMatch(/email already in use:\s*$/)` (message 가 colon 뒤 빈 문자열 fallback 인 점 확인). 둘 다 충족.
- [ ] 본 test 1 개 외에 다른 코드 변경 0. PersonService production 코드 / 다른 spec / DTO / controller 변경 안 함.

### B. Coverage

- [ ] `pnpm test:cov` 실행 결과 `person.service.ts` 의 **branch coverage 100%** (현 96.66% → 100%). 다른 파일 coverage 회귀 없음.
- [ ] coverageThreshold.global (line ≥ 80% / function ≥ 80%) 통과 — 기존 그대로 유지, jest exit 0.

### C. R-112 4 항목 (이 task 가 추가하는 단일 test 가 충족하는 항목)

- [ ] **Happy path**: 본 task 는 신규 production 코드 0 — happy-path 추가 불필요 (T-0036 spec 이 cover 완료). 본 항목은 "기존 happy-path 가 regression 없이 통과" 로 cover (`pnpm test` 전체 green).
- [ ] **Error path**: 본 task 가 추가하는 test 자체가 error path test (P2002 의 ConflictException 변환). cover ok.
- [ ] **Branch coverage**: 본 task 의 핵심 — `patch.email ?? ""` 의 right (undefined → `""` fallback) 분기를 cover. 추가 1 test 로 branch 96.66% → 100%.
- [ ] **Negative cases 충분 cover**: 본 분기 자체가 negative case (validator 통과 patch 에 email 없음 + P2002 reject 의 비정상 시퀀스). 추가 1 test 로 cover.

분기 없는 task — R-112 의 "분기마다 1 test" 항목은 본 task 자체의 새 분기 0 이므로 trivially 통과.

### D. Lint / build / unit / smoke / e2e (R-111 / R-113)

- [ ] `pnpm lint` 통과 (새 test block 0 lint error).
- [ ] `pnpm build` 통과 (test 파일은 build 대상 제외, regression 없음).
- [ ] `pnpm test` 통과 (모든 unit test green — 본 task 추가 test 1 개 + 기존 ~171 test).
- [ ] `pnpm test:cov` 통과 (coverage threshold line ≥ 80% AND function ≥ 80% + person.service.ts branch 100%).
- [ ] `pnpm test:smoke` 통과 (기존 smoke regression 없음).
- [ ] `pnpm test:e2e` 통과 (기존 e2e regression 없음).
- [ ] CI GitHub Actions run 의 모든 step (lint / build / test / test:cov / test:smoke / test:e2e / reviewer-approval) green.

### E. Reviewer 합의 (§3.3 4-게이트)

- [ ] reviewer agent round 1/7 VERDICT=APPROVE (단일 test 추가의 trivial PR — round 1 머지 가능성 매우 높음).
- [ ] reviewer review comment 가 PR 에 `gh pr comment` 또는 MCP `add_issue_comment` 로 외부 박제 (4-게이트 (2)).
- [ ] integrator self-check (Acceptance Criteria / CI / Out of Scope / R-112 coverage / 4 항목) 통과.
- [ ] CI green 후 `gh pr merge <PR-NN> --squash --delete-branch` 또는 MCP `merge_pull_request --squash` 머지 + remote feature branch 삭제.

## Out of Scope

본 task 는 **다음을 하지 않는다** — 후속 task 책임 ([CLAUDE.md §3](../../CLAUDE.md) cap discipline):

- **PersonService production 코드 변경 일절 금지** — `person.service.ts` / `person.controller.ts` / DTO / `person.repository.ts` / `user.module.ts` 등 production 파일은 read-only. 본 task 는 spec 1 파일 1 test 추가만.
- **다른 spec 의 branch coverage gap** — `person.controller.spec.ts` / `person.repository.spec.ts` / `group.repository.spec.ts` / `part.repository.spec.ts` / `service-identity.repository.spec.ts` / `user.module.spec.ts` 등 다른 spec 의 분기 cover gap 은 별도 task. 본 task 는 `person.service.ts` L120 의 단일 분기만.
- **smoke test domain endpoint 확장** — PLAN.md L64 의 bullet 2 (smoke `/api/persons` CRUD 추가) 는 별도 task (T-0043 또는 후속). 본 task scope 외.
- **e2e test domain endpoint 확장** — PLAN.md L65 의 bullet 3 (e2e `/api/persons` status code + DTO contract + 4xx error shape) 는 별도 task. 본 task scope 외.
- **coverage threshold 상향 ADR** — `coverageThreshold.branch` 도입 (현 `line` + `function` 만 강제) 은 별도 ADR + task. 본 task 는 branch coverage 100% 달성만 (threshold 강제 아님).
- **patch.email fallback 의미 ADR** — `"email already in use: " + (patch.email ?? "")` 의 빈 문자열 fallback 이 사용자에게 노출되는 의미 (정보 누락) 정정은 별도 task. 본 task 는 현 동작을 test 로 박제만 (의미 변경 안 함).
- **PersonService.update 의 active 묵시 drop / 동시 patch 의 추가 분기 cover** — T-0037 머지로 이미 해소. 본 task 는 P2002 + patch.email undefined 단일 분기만.
- **새 외부 dependency / schema 변경 / migration / ADR 신설** — 0 건. 본 task 는 spec 1 파일 1 test 추가만으로 self-contained.

## Suggested Sub-agents

`implementer → tester` — architect 호출 불필요 (production 변경 0 / ADR 0 / dependency 0). implementer 가 person.service.spec.ts 의 `describe("update", ...)` block 안에 새 `it(...)` 추가 (~15-25 LOC). tester 가 `pnpm test:cov` 실행하여 person.service.ts branch coverage 100% 달성 확인 + 기존 `pnpm lint / build / test / test:smoke / test:e2e` 5 종 regression 없음 확인.

## Follow-ups

(implementer / tester 가 본 task 진행 중 관찰한 후속 작업을 본 절에 append. 본 task 머지 후 planner 가 본 절을 읽고 후속 task 큐잉 판단.)

- **PLAN.md L64 후보 (smoke test domain endpoint 확장)** — `test/smoke.spec.ts` 가 현재 `GET /` 만 cover. `/api/persons` CRUD (POST / GET / PATCH / DELETE) + Group/Part endpoint bootstrap smoke 추가. AppModule mock-DB 방식으로 실 DB 없이 supertest. 별도 T-0043 (또는 후속) 책임.
- **PLAN.md L65 후보 (e2e test domain endpoint 확장)** — `test/e2e/*.e2e-spec.ts` 가 현재 `GET /` HTTP contract 만 검증. `/api/persons` status code + response body shape (DTO contract) + 4xx error shape (NotFound 404 / Conflict 409 / BadRequest 400) e2e-spec 으로 cover. R-113 e2e 의무 이행. 별도 task 책임.
- **coverage threshold 상향 ADR 후보** — `coverageThreshold.branch ≥ 80%` 추가 도입. 현재 branch 의 자연 감소가 jest 강제 없이 진행 중 — threshold 추가로 후속 PR 의 drift 방지. 별도 ADR + 1-line package.json edit task.
- **patch.email fallback 의미 정정 후보** — `"email already in use: " + (patch.email ?? "")` 의 trailing 빈 부분이 사용자 친화 메시지 아닌 경우 (예: API client 가 message regex parsing 시 trailing 처리 실패) 별도 정정 task. message 를 `patch.email` undefined 시 다른 wording (예: `"unique constraint failed during update"`) 로 분기. 별도 task + reviewer 합의 필요.
