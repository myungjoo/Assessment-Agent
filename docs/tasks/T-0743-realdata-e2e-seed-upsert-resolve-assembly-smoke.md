---
id: T-0743
title: realdata-e2e seed-upsert-resolve 조립 체인 non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 220
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 실 평가 e2e step①→② seed-side 조립 buildRealDataE2eSeed→buildRealDataUpsertArgs→resolveRealDataPersonId smoke. issue-still-relevant: git grep buildRealDataUpsertArgs/resolveRealDataPersonId origin/main test/smoke/ = NONE 확인(seed-side assembly smoke 부재). test-only pr, dependsOn [] file-disjoint stage5b 병렬."
independentStream: realdata-e2e-seed-upsert-resolve-assembly-smoke
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-seed-upsert-resolve-assembly.smoke-spec.ts]
---

# T-0743 — realdata-e2e seed-upsert-resolve 조립 체인 non-gated build-time smoke 신설

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) 의 **step① → step②** 경계(seed descriptor → Prisma upsert-args → 실 person.id 치환)의 build-time 순수 layer 는 두 컴포저가 직렬로 닫는다 — (1) `buildRealDataUpsertArgs(descriptors)` (T-0574) 가 `buildRealDataE2eSeed()` (T-0573) 산출 `RealDataSeedDescriptor[]` 를 `RealDataUpsertArgs[]`(person.upsert + identityUpsertsByEmail, ServiceIdentity where.personId 는 `PERSON_ID_PLACEHOLDER`) 로 변환하고, (2) `resolveRealDataPersonId(upsertArgsList, emailToPersonId)` (T-0575) 가 그 placeholder 를 email→실 person.id map 으로 치환한 새 트리를 반환한다. 이 두 컴포저는 각각 unit (`realdata-e2e-seed-upsert.spec.ts` / `realdata-e2e-seed-resolve-person-id.spec.ts`) + consistency (`...-consistency.spec.ts`) spec 으로 닫혀 있으나, **seed→upsert-args→resolve 를 묶은 조립 체인 단위의 non-gated build-time smoke 는 부재**다 (`git grep buildRealDataUpsertArgs / resolveRealDataPersonId origin/main test/smoke/` = NONE, seed-side assembly smoke 파일 부재 확인). 즉 placeholder→실 person.id 치환 누락·email→id join drift·compound-unique where(`personId_service`) shape drift·net-0 update 보존(email/service/externalId 가 update 에서 제외) 회귀·email 매핑 누락/빈값 throw 전파·빈/단일/다수 descriptor 분기는 public CI 에서 한 번도 발화되지 않고 DB-gated step② runner set-up 시에만 잡힌다. 본 task 는 그 gap 을 메운다 — step④ search-side 조립 smoke 쌍(T-0741/T-0742) 과 step②③ step-args 조립 smoke(T-0737~T-0739) 의 **seed-side(step①②) 대칭 sibling** 으로, seed→upsert→resolve 종단 조립 surface 회귀를 public CI 그물로 박제한다.

## Required Reading

- `test/helpers/realdata-e2e-seed-upsert.ts` — 위임 (1) `buildRealDataUpsertArgs(descriptors)` → `RealDataUpsertArgs[]`. `PersonUpsertArgs`(`{where:{email}, create:{fullName,email,active}, update:{fullName,active}}`)·`ServiceIdentityUpsertArgs`(`{where:{personId_service:{personId,service}}, create:{service,externalId,isPrimary}, update:{isPrimary}}`)·`RealDataUpsertArgs`(`{personUpsert, identityUpsertsByEmail}`) interface + `PERSON_ID_PLACEHOLDER`(`"__REALDATA_PERSON_ID__"`) 상수 + net-0 update 보존 규칙
- `test/helpers/realdata-e2e-seed-resolve-person-id.ts` — 위임 (2) `resolveRealDataPersonId(upsertArgsList, emailToPersonId)` → `RealDataUpsertArgs[]`. `PersonIdMap`(`ReadonlyMap<string,string> | Record<string,string>`) type + email 키 누락 throw·빈/공백 person.id throw·personUpsert 보존·identity where personId 치환 규칙(email→id join, 같은 Person 의 모든 identity 동일 person.id)
- `test/helpers/realdata-e2e-seed-fixture.ts` — `buildRealDataE2eSeed()` → `RealDataSeedDescriptor[]` + `RealDataSeedDescriptor`(`{person:{fullName,email,active}, serviceIdentities}`)·`RealDataServiceIdentitySeed`(`{service,externalId,isPrimary}`) interface — fixture descriptor 구성 / email→personId map 구성에 필요
- `test/smoke/realdata-e2e-result-issue-gh-command-plan-assembly.smoke-spec.ts` — 구조·문서주석·non-gated describe·Out of Scope·deep-equal 단일 source 대조·throw 전파·결정론·무공유·no-mutation 패턴의 mirror 템플릿 (T-0742, 최근 step④ 조립 smoke)
- `test/jest-smoke.json` — smoke jest config (testRegex 가 본 신규 `*.smoke-spec.ts` 파일을 잡는지 확인용)

## Acceptance Criteria

- [ ] 신규 파일 `test/smoke/realdata-e2e-seed-upsert-resolve-assembly.smoke-spec.ts` 1개만 추가 (test-only, production `src/`·기존 컴포저·helper 수정 0).
- [ ] **Happy-path test** — `buildRealDataE2eSeed()`(또는 synthetic descriptor literal) → `buildRealDataUpsertArgs(descriptors)` → `resolveRealDataPersonId(upsertArgsList, emailToPersonId)` 종단 체인을 한 번에 실행. (a) 산출 `resolved` 가 배열·길이 = descriptor 수·각 원소 `personUpsert`/`identityUpsertsByEmail` 필드 보유 1+ test. (b) 각 identity 의 `where.personId_service.personId` 가 `PERSON_ID_PLACEHOLDER` 가 **아니라** map 의 실 person.id 로 치환됨 1+ test. (c) `personUpsert.where.email`/`create`/`update` 가 원본 descriptor 와 정합(보존) 1+ test.
- [ ] **단일 source 조립 단언** — 동일 (descriptors, emailToPersonId) 을 `resolveRealDataPersonId(buildRealDataUpsertArgs(descriptors), emailToPersonId)` 2-위임 직접 재유도한 결과와 종단 산출이 deep-equal 1+ test. 같은 Person(같은 email) 의 모든 `identityUpsertsByEmail[*]` 가 동일 person.id 를 받음(compound-unique 정합) 1+ test. net-0 update 보존 — `personUpsert.update` 에 email 부재(`fullName`/`active` 만)·`identityUpsertsByEmail[*].update` 에 service/externalId 부재(`isPrimary` 만) 1+ test.
- [ ] **Error/negative path test** — (a) `emailToPersonId` 에 descriptor 의 email 키 누락 → `resolveRealDataPersonId` 가 누락 email 포함 throw 를 자체 try/catch 없이 전파 (`expect(() => ...).toThrow`) 1+ test. (b) map 의 person.id 값이 빈 문자열 → throw 전파 1+ test. (c) map 의 person.id 값이 공백만 → throw 전파 1+ test. (d) `Record` map 형태와 `Map` map 형태 둘 다에서 happy-path 동작(union arm 양쪽 cover) 각 1+ test.
- [ ] **Flow / branch coverage** — 빈 `descriptors` → `buildRealDataUpsertArgs([])` = `[]` → `resolveRealDataPersonId([], map)` = `[]`(throw 0) 1+ test. `serviceIdentities` 0개 descriptor → `identityUpsertsByEmail` 빈 배열로 통과(throw 0) 1+ test. 단일·다수 descriptor 각 1+ test. 분기마다 test 분리.
- [ ] **Negative cases 충분 cover** — (a) email 키 누락 → throw, (b) 빈 person.id → throw, (c) 공백 person.id → throw, (d) **결정론·무공유**: 동일 (descriptors, map) 두 번 호출 시 deep-equal 산출 + 매 호출 새 객체 트리(참조 비동일 — 종단 산출·중첩 personUpsert/identityUpsertsByEmail 배열 모두 참조 비동일), (e) **no-mutation**: 입력 `descriptors`·`upsertArgsList`(중간 산출)·`emailToPersonId` 객체가 호출 전후 deep-equal(mutate 0) — 각 1+ test.
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe` (env-gated `describe.skip` 금지 — public CI always green, R-113). `process.env` 읽기 0 (fixture 객체·map literal 직접 주입).
- [ ] live leg (실 DB / prisma.upsert 실 호출 / 실 person.id 생성 / 실 수집 / 실 LLM / Ollama / 네트워크 / 실 jest spawn) 복제 0 — seed→upsert-args→resolve 조립 surface 만 검증 (synthetic descriptor + email→personId map literal 직접 주입).
- [ ] 새 외부 dependency 0 — 기존 `buildRealDataE2eSeed`/`buildRealDataUpsertArgs`/`resolveRealDataPersonId` 컴포저 + `PERSON_ID_PLACEHOLDER` import 재사용만 (consistency-guard 신설 금지 — sweep 종결 T-0726).
- [ ] `pnpm lint && pnpm build && pnpm test:smoke` 통과 (신규 smoke 격리 실행 green).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 task 는 test-only 라 컴포저 cov 는 기존 unit spec 이 보장 — coverage threshold 회귀 0 확인.

## Out of Scope

- T-0728~T-0742 의 기존 조립 smoke 파일 — 절대 건드리지 않음 (file-disjoint 병렬).
- 기존 `realdata-e2e-assembly.smoke-spec.ts` (T-0728, seed→run-plan→step-args, pre-실행 step-args 진입) — 본 task 는 seed-side 의 별개 절단면(seed→upsert-args→resolve, step①② DB-prep 경로) 만 책임. 중복·재검증 0 (그건 step-args aggregator 책임).
- 컴포저 소스 (`realdata-e2e-seed-upsert.ts` / `realdata-e2e-seed-resolve-person-id.ts` / `realdata-e2e-seed-fixture.ts`) / 위임 helper / consistency 가드 수정 — test-only.
- 새 컴포저 / 가드 / helper / consistency-guard 신설 — 기존 import 재사용만 (sweep 종결 준수).
- 실 prisma.person.upsert / serviceIdentity.upsert 실 DB 호출 / 실 person.id 생성·조회 / step② runner / `prisma/schema.prisma` 변경 / 실 live smoke 실행.
- production `src/` 코드 변경 / `package.json` / `test/jest-smoke.json` 변경.
- 실 수집 결과(descriptor) 의 실 도출 / 실 email→person.id map 의 실 도출 — synthetic literal 만 인자로 주입.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음)
