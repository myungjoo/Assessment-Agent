---
id: T-1664
title: devset seed 결함 fix — ServiceIdentity upsert create 에 person 관계(personId) 배선
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-047]
estimatedDiff: 160
estimatedFiles: 5
created: 2026-08-23
createdAt: 2026-08-23T17:45:00Z
dependsOn: [T-1663]
touchesFiles:
  - test/helpers/realdata-e2e-seed-upsert.ts
  - test/helpers/realdata-e2e-seed-resolve-person-id.ts
  - test/helpers/realdata-e2e-seed-resolve-person-id-consistency.ts
  - test/helpers/realdata-e2e-seed-resolve-person-id.spec.ts
  - test/helpers/realdata-e2e-seed-resolve-person-id-consistency.spec.ts
independentStream: load-harness-r91
hqOrigin: T-1663-followup-1
plannerNote: "P5 R-91 chain 46/N — T-1663 실 run 이 잡은 `Argument person is missing` seed fail 을 resolve 단계 personId 배선으로 수정."
---

# T-1664 — devset seed 결함 fix: ServiceIdentity upsert `create` 에 `personId` 배선

## Why

[T-1663](T-1663-load-k6-devset-seeded-run.md) 이 seed 배선 후 **첫 실 dataset run** (`load-k6.yml` run `32652307813`, `s1_persons=133`) 을 돌렸고, `133 로그인 실 dataset seed 적재` step 이 Prisma 에러 ``Argument `person` is missing.`` 로 exit 1 하며 죽었다. 그 뒤 k6 S1 step 이 전부 skipped 되어 **적재 인원 수 · `setup()` 소비 경로 · THRESHOLDS 실측 3 축이 회수 실패** 로 남았고, [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§5` item 5 의 잔여 ① 이 여전히 미해소다.

원인은 T-1663 Follow-ups 가 지목한 대로 — ServiceIdentity upsert args 의 `create` 가 `service` · `externalId` · `isPrimary` 만 담고 **Person 관계를 비워둔 채** 실 Prisma client 로 넘어가는 것이다. placeholder → 실 `person.id` 치환은 `where.personId_service.personId` 에만 적용되므로, 신규 row 를 만드는 `create` 경로에는 personId 가 아예 없다 ([`prisma/schema.prisma`](../../prisma/schema.prisma) `257~274 행` 의 `ServiceIdentity.person` 은 required relation).

본 slice 는 오너 지시 (PLAN `144 행` "R-91 k6 최우선·즉시 착수") chain 46/N 으로, **실 person.id 를 이미 알고 있는 유일한 단계인 `resolveRealDataPersonId` 에서 `create.personId` 를 함께 채워** 결함을 end-to-end 로 닫는다. 재 dispatch 실측은 본 slice 가 아니라 후속 slice 다.

## Required Reading

- [test/helpers/realdata-e2e-seed-upsert.ts](../../test/helpers/realdata-e2e-seed-upsert.ts) — `40~44 행` (`PERSON_ID_PLACEHOLDER` 의 의도: build 단계는 person.id 를 모른다), `55~64 행` (`ServiceIdentityUpsertArgs` 의 `create` 타입 — 본 slice 가 `personId` 를 더할 자리), `127~141 행` (`buildServiceIdentityUpsert` — **본 slice 에서 런타임 산출값 무변경**).
- [test/helpers/realdata-e2e-seed-resolve-person-id.ts](../../test/helpers/realdata-e2e-seed-resolve-person-id.ts) `65~125 행` — `resolveRealDataPersonId` 의 반환 트리 조립부. `104~120 행` 의 identity map 이 지금 `create: { ...identity.create }` 로 personId 를 빠뜨린다 (`112 행`).
- [test/helpers/realdata-e2e-seed-resolve-person-id-consistency.ts](../../test/helpers/realdata-e2e-seed-resolve-person-id-consistency.ts) `100~130 행` — `composeExpectedResolvedArgs` 독립 재유도. `125 행` 이 컴포저 미러이므로 **같은 commit 에서 함께 갱신하지 않으면 self-guard 가 `RangeError` 로 전 seed 경로를 죽인다**.
- [test/helpers/realdata-e2e-seed-resolve-person-id.spec.ts](../../test/helpers/realdata-e2e-seed-resolve-person-id.spec.ts) `255~278 행` — `(e) R-59` 의 `Object.keys(identity.create)` 키 집합 단언 (`externalId`/`isPrimary`/`service`). 본 변경으로 **반드시 깨지므로 새 계약으로 갱신** 대상.
- [test/helpers/realdata-e2e-seed-resolve-person-id-consistency.spec.ts](../../test/helpers/realdata-e2e-seed-resolve-person-id-consistency.spec.ts) `745~776 행` (guard happy 케이스의 자립 재유도 `expected` — `770 행` 이 `create: { ...identity.create }`) + `655~675 행` (identity 개수 drift fixture 의 `create` 리터럴).
- [test/helpers/realdata-devset-seed-run.ts](../../test/helpers/realdata-devset-seed-run.ts) `40~60 행` — 실 seed 진입점의 ③ resolve → ④ `upsertDevsetSeedServiceIdentities` 순서 (본 fix 가 실제 실패 경로에 닿는지 확인용, **읽기만**).
- [prisma/schema.prisma](../../prisma/schema.prisma) `257~274 행` — `ServiceIdentity` 의 `personId` scalar + `person` required relation + `@@unique([personId, service])`.

## Acceptance Criteria

- [ ] [test/helpers/realdata-e2e-seed-upsert.ts](../../test/helpers/realdata-e2e-seed-upsert.ts) 의 `ServiceIdentityUpsertArgs.create` 타입에 `personId?: string` 를 추가하고, "build 단계는 person.id 를 모르므로 미설정 — `resolveRealDataPersonId` 가 실 person.id 로 채운다" 를 한국어 주석으로 명시한다. **`buildServiceIdentityUpsert` 의 런타임 산출값은 무변경** (`create` 키 집합 3 개 유지) — 그래야 `realdata-e2e-seed-upsert-consistency` 가드와 그 spec 이 회귀 0.
- [ ] [test/helpers/realdata-e2e-seed-resolve-person-id.ts](../../test/helpers/realdata-e2e-seed-resolve-person-id.ts) 의 identity 조립을 `create: { ...identity.create, personId }` 로 바꿔 **치환된 실 person.id 가 `where` 와 `create` 양쪽에 동일 값으로** 들어가게 한다. `where` 치환 규칙 · `personUpsert` 보존 · 입력 mutate 0 · 순서 보존은 무변경.
- [ ] [test/helpers/realdata-e2e-seed-resolve-person-id-consistency.ts](../../test/helpers/realdata-e2e-seed-resolve-person-id-consistency.ts) 의 `composeExpectedResolvedArgs` 를 같은 규칙으로 갱신하고, 헤더 주석의 "치환 규칙(컴포저 미러링)" 서술도 `create.personId` 포함으로 고친다. 가드는 여전히 컴포저를 재호출하지 않고 입력만으로 독립 재유도한다.
- [ ] **happy-path test 1+** — `resolveRealDataPersonId` 산출 identity 의 `create.personId` 가 같은 identity 의 `where.personId_service.personId` 및 map 의 실 person.id 와 **세 값 모두 동일** 함을 단언 (devset fixture 기준 전 identity 순회).
- [ ] **error path test 1+** — email 매핑 누락 · map 값이 빈 문자열/공백인 입력에서 기존 throw 계약이 그대로 유지되고 (부분 치환 트리 반환 0), `create.personId` 배선 때문에 새 에러 유형이 생기지 않음을 단언.
- [ ] **분기 cover** — `PersonIdMap` 의 두 arm (`ReadonlyMap` · `Record`) 각각에서 `create.personId` 가 채워지는지 각 1+ test. identity 0 개 Person · 빈 입력 배열 경계도 throw 0 으로 통과.
- [ ] **negative cases 충분 cover** (각 1+) — ① `create.personId` 에 `PERSON_ID_PLACEHOLDER` 문자열이 잔존하지 않음, ② 입력 args 의 `create` 객체가 mutate 되지 않음 (호출 후 원본 키 집합 3 개 유지 · 무공유), ③ 서로 다른 Person 의 identity 가 서로의 personId 를 받지 않음 (2 인 이상 fixture 로 cross-contamination 0), ④ 반환 트리를 caller 가 mutate 해도 입력에 전파되지 않음, ⑤ 가드 관점 negative — `create.personId` 만 다른 값으로 drift 시킨 `resolved` 를 `assertRealDataResolvePersonIdConsistentWithInputs` 에 넘기면 `RangeError`.
- [ ] **regression test 1+** (본 task 는 T-1663 결함 fix patch) — `create` 가 Prisma 의 required Person 관계를 만족하는 shape 인지, 즉 `create.personId` 가 **비지 않은 문자열로 반드시 존재** 함을 devset 전 identity 에 대해 단언하는 test 를 둔다. 이 단언이 깨지면 run `32652307813` 의 ``Argument `person` is missing.`` 이 재발한다는 의도를 test 이름/주석에 한국어로 명시.
- [ ] 기존에 깨지는 단언은 삭제하지 말고 **새 계약으로 갱신** 한다 — `realdata-e2e-seed-resolve-person-id.spec.ts` `255~278 행` 의 `create` 키 집합 (`externalId`/`isPrimary`/`personId`/`service` 4 개), consistency spec `745~776 행` 의 자립 재유도 `expected`, `655~675 행` drift fixture.
- [ ] `pnpm lint && pnpm build && pnpm test` green — 특히 `realdata-e2e-seed-upsert*` · `realdata-devset-seed-*` · `test/smoke/realdata-e2e-seed-upsert-resolve-assembly.smoke-spec.ts` · `test/smoke/realdata-e2e-seed-upsert-collect-identity-convergence-assembly.smoke-spec.ts` 회귀 0.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `src/` 무변경이라 전역 coverage 수치는 불변이어야 한다.
- [ ] 변경 파일 **5 개 이내** 유지. 6 번째 파일 수정이 불가피하다고 판단되면 그 파일과 이유를 PR 본문에 적고 Follow-ups 로 넘긴다 (cap 초과 강행 금지).

## Out of Scope

- **`load-k6.yml` 재 dispatch · 실측 금지** — 재측정과 `§3.1` 8 회차 박제는 별도 후속 slice (T-1663 Follow-ups 3 번).
- `buildServiceIdentityUpsert` 가 `create` 에 placeholder 를 넣도록 바꾸는 것 — `realdata-e2e-seed-upsert-consistency.ts` 와 그 spec · 2 종 smoke 까지 동반 수정이라 5 파일 cap 초과. 필요하면 별도 slice.
- `realdata-devset-seed-identity-upsert-runner.ts` 의 `flattenPlan` 에 `create.personId` placeholder/결손 검출 가드를 추가하는 것 — 별도 slice (Follow-ups).
- `.github/workflows/load-k6.yml` · `test/load/*.js` · `scripts/seed-devset-logins.ts` 변경.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) · [docs/PLAN.md](../PLAN.md) · [docs/ops/realdata-scale-devset.md](../ops/realdata-scale-devset.md) doc-sync — `commitMode` 가 갈리므로 (§3.1) 별도 direct slice.
- `s2-read.js` / `s3-concurrent.js` 의 devset dataset 교체.
- `deploy/daily-test.sh` leg 추가 — drift-guard smoke 3 종 동반으로 cap 초과 (T-1122 / Q-0054 선례).
- `prisma/schema.prisma` 변경 · migration — DB schema 변경은 §5 BLOCKED 대상이며 본 결함은 args shape 문제라 schema 변경 불요.

## Suggested Sub-agents

`implementer` → `tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## 완료 기록

- Status: DONE (2026-08-23T18:56Z, PR [#1330](https://github.com/myungjoo/Assessment-Agent/pull/1330) squash merge `61f616a1`, round 1)
- 결과: `ServiceIdentityUpsertArgs.create` 에 optional `personId` 추가 (build 산출 키 3 개 무변경) + `resolveRealDataPersonId` 가 `create: { ...identity.create, personId }` 로 `where` 와 **같은 실값** 을 배선. consistency 컴포저 미러도 같은 commit 에서 갱신 — 미갱신 시 self-guard 가 `RangeError` 로 전 seed 경로를 죽인다.
- test: 기존 2 spec 에 T-1664 케이스 14 종 추가 (happy 3 값 동일 · error throw 계약 불변 · 분기 Map/Record/identity 0/빈 입력 · negative 5 종 · devset 133 identity 전량 regression). 전역 unit 453 suite / 12994 test green, `test:cov` threshold(line·function 80%) 통과.
- diff +280/-20, 5 파일 (cap 이내). reviewer APPROVE round 1 — MINOR(주석 줄바꿈) 는 같은 PR `632c74d6` 에서 closure (§3 Nit-in-PR).
- 잔여: 재 dispatch 실측(`§3.1` 8 회차) · doc-sync · `flattenPlan` placeholder 가드는 Out of Scope 대로 후속 slice.
