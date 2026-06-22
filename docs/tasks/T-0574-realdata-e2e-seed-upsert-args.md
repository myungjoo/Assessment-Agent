---
id: T-0574
title: 실 평가 e2e seed descriptor → Prisma upsert-args 순수 매퍼 추가
phase: P5
status: DONE
completedAt: 2026-06-22T13:53:00Z
mergedAs: 80c1715
prNumber: 487
reviewRounds: 1
commitMode: pr
coversReq: [REQ-023, REQ-024, REQ-047, REQ-059]
estimatedDiff: 120
estimatedFiles: 2
created: 2026-06-22
independentStream: p5-realdata-e2e
dependsOn: [T-0573]
touchesFiles:
  - test/helpers/realdata-e2e-seed-upsert.ts
  - test/helpers/realdata-e2e-seed-upsert.spec.ts
plannerNote: P5 bullet109 step①→② 경계 — seed descriptor 를 idempotent Prisma upsert-args 로 변환하는 순수 매퍼. dependency-free·cloud-safe.
---

# T-0574 — 실 평가 e2e seed descriptor → Prisma upsert-args 순수 매퍼 추가

## Why

PLAN.md 109행(실 평가 e2e = github.com `myungjoo`+`leemgs` 공개 활동)의 step ① 은 T-0573 이 `buildRealDataE2eSeed()` 순수 descriptor 빌더로 박제했다. 그러나 그 descriptor 는 아직 **소비처가 없다** (grep 0회). 본 task 는 step ① → ② 경계를 메우는 **순수 매퍼** 를 추가한다 — `RealDataSeedDescriptor` 를 Prisma `person.upsert` / `serviceIdentity.upsert` 의 **argument 객체** 로 변환하되, 실제 DB 호출은 하지 않는다.

실 DB upsert 배선(runner/script)은 step ②(실 수집, LAN/credential gate)의 책임이라 cloud cron 에서 실행 불가다. 본 task 는 그 직전의 **결정론적 build-time 변환 계약** 만 고정한다 — 네트워크 0, DB 접근 0, live-LLM 0, credential 0 으로 cloud cron 자율 실행이 가능하고 dependency 도 없다. idempotent upsert 의 `where` 절을 schema 의 unique constraint(`Person.email @unique`, `ServiceIdentity @@unique([personId, service])`)와 정합시켜, step ② 가 이 args 를 그대로 `prisma.person.upsert(args)` 에 넘기면 재수집 시 중복 row 가 생기지 않도록(R-58 재수집 중복 방지 정합) 보장한다.

## Required Reading

- `test/helpers/realdata-e2e-seed-fixture.ts` — T-0573 의 `buildRealDataE2eSeed()` + `RealDataSeedDescriptor` / `RealDataPersonSeed` / `RealDataServiceIdentitySeed` 타입(본 매퍼의 입력 계약).
- `prisma/schema.prisma` 의 `model Person`(L55~, `email @unique` L58) + `model ServiceIdentity`(L247~, `@@unique([personId, service])` L263) — upsert `where` 절 정합 근거.
- `test/e2e/contributions.e2e-spec.ts` L117~143 — 기존 `prisma.person.create` seed 패턴(필드 모양 참고용. 본 task 는 create 아닌 upsert-args 만 생성).
- `docs/decisions/ADR-0045-llm-provider-deployment-config.md`(요지만) — cloud cron 이 LAN/live-LLM 무경로라 step ②③④ 가 deferred 인 이유.

## Acceptance Criteria

- [ ] 신규 `test/helpers/realdata-e2e-seed-upsert.ts` 에 순수 함수 `buildRealDataUpsertArgs(descriptors: RealDataSeedDescriptor[])` 추가. 반환은 각 descriptor 에 대해 `{ personUpsert, identityUpsertsByEmail }` 형태(person upsert args + 그 Person 의 ServiceIdentity upsert args 들)를 담은 배열. ServiceIdentity 의 `where`/`create` 는 `personId` 가 런타임 결정값이므로, externalId+service 만 담은 **부분 args(connect-by-email 또는 nested)** 또는 명세에 적힌 결정론적 shape 로 산출한다(본 매퍼는 DB 호출 0 — args 객체만 반환).
- [ ] `personUpsert.where` 는 `{ email: <descriptor.person.email> }` (Person.email @unique 정합). `personUpsert.create` 는 fullName/email/active 전부 포함. `personUpsert.update` 는 net-0 보존을 위해 fullName/active 만(또는 빈 객체 — 명세에 결정 박제).
- [ ] ServiceIdentity upsert args 의 `where` 는 compound unique `{ personId_service: { personId: <런타임>, service: "github.com" } }` 모양과 정합하도록 service/externalId/isPrimary 를 박제(personId 는 매퍼가 모르므로 placeholder 또는 nested-create 방식 — 명세 § 에 택1 박제).
- [ ] 매퍼는 **순수 함수** — 네트워크/DB/env/live-LLM 접근 0, 입력 외 상태 의존 0, 호출마다 새 객체 트리 반환(공유 mutable 노출 0).
- [ ] raw 활동 데이터(commit 본문/PR/issue 본문) 미포함(R-59) — Person 메타 + ServiceIdentity 식별자만.
- [ ] **happy-path unit test 1+**: `buildRealDataUpsertArgs(buildRealDataE2eSeed())` 호출 시 2 개 항목 반환 + 각 personUpsert.where.email 이 distinct + serviceIdentity args 의 externalId=username·service="github.com"·isPrimary=true 검증.
- [ ] **error path / negative unit test 1+**: 빈 배열 입력 시 빈 배열 반환(throw 0), descriptor 의 serviceIdentities 가 빈 배열인 경우 해당 항목의 identity args 도 빈 배열(throw 0) 등 경계 입력 cover. 잘못된 입력(예: person.email 빈 문자열 descriptor)에 대한 동작도 명세대로 검증.
- [ ] **flow / branch test**: 매퍼 안에 분기(예: serviceIdentities 개수에 따른 map, update 객체 포함 여부)가 있으면 각 분기 1+ test. 분기가 전무하면 본문에 "분기 없음 — 항목 생략" 명시.
- [ ] **negative cases 충분 cover**: 빈 배열·빈 serviceIdentities·다중 descriptor 순서 보존·반환 객체 격리(호출 측 mutate 가 다음 호출에 영향 0) 각 1+ test.
- [ ] colocated spec `test/helpers/realdata-e2e-seed-upsert.spec.ts` 에 위 test 박제(NestJS convention + T-0573 의 `realdata-e2e-seed-fixture.spec.ts` colocated 패턴 동일).
- [ ] `pnpm lint && pnpm build && pnpm test` green.
- [ ] `pnpm test:cov` 통과 — 신규 파일 line ≥ 80% / function ≥ 80%(순수 함수라 100% 목표).

## Out of Scope

- 실제 DB upsert 를 수행하는 runner/script (step ②, LAN/credential gate — cloud cron 무경로).
- 실 github.com API 호출·수집 (step ②).
- 로컬 Ollama 실 LLM 평가 (step ③, ADR-0045 LAN gate).
- `deploy/daily-test.sh` step_eval wiring (step ④).
- `src/` 의 service/repository/controller 변경, `prisma/schema.prisma` 변경(0).
- `package.json` / 새 dependency(0 — 내장 타입만).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 append.)
