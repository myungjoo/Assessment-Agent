---
id: T-0719
title: realdata-e2e seed-fixture 결정성·불변식 정합 가드 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-058, REQ-059, REQ-024]
estimatedDiff: 280
estimatedFiles: 2
created: 2026-06-27
plannerNote: "P5 consistency sweep — NO-GUARD seed-side leaf buildRealDataE2eSeed(T-0573)의 결정성+불변식(email distinct·1 primary github.com·externalId=username) 독립 재유도 가드 신설, T-0717 seed-resolve mirror. dependsOn [] 독립"
independentStream: realdata-e2e-seed-fixture-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-seed-fixture-consistency.ts
  - test/helpers/realdata-e2e-seed-fixture-consistency.spec.ts
---

# T-0719 — realdata-e2e seed-fixture 결정성·불변식 정합 가드 신설

## Why

PLAN.md Phase P5(Evaluation pipeline) 109행 step ①(seed 입력 계약 surface) 의 build-time consistency-guard sweep 일환으로, seed-side leaf 컴포저 `buildRealDataE2eSeed()`(`test/helpers/realdata-e2e-seed-fixture.ts`, T-0573)는 **현재 자신의 산출 descriptor 배열을 검증하는 독립 정합 가드가 부재**하다. 다른 seed-side leaf(seed-collect-input·seed-collect-call-args·seed-upsert·seed-resolve-person-id)는 모두 `*-consistency.ts` 가드를 보유·self-wire 했으나, 이 builder 만 남은 마지막 seed-side NO-GUARD leaf 다. seed-upsert/seed-resolve 등 상위 가드가 descriptor 배열을 입력으로 받아 재유도하지만, **그 입력 descriptor 자체가 username-파생 불변식(email = `${username}@e2e.realdata.test`·externalId = username·정확히 1 primary github.com identity·email distinct)을 만족하는지는 어느 가드도 검증하지 않는다** — builder 의 합성 규칙이 잘못 바뀌어도(예: email suffix drift·isPrimary 누락·service 중복·username≠externalId) build-time 에 잡히지 않는 gap 이 남는다.

이 컴포저는 **무인자 결정론적 상수 builder** 라 "외부 입력 → 산출 재유도" 형태의 값-정합 가드는 그대로 적용되지 않는다(T-0718 Follow-up 의 case-by-case 판정 대상). 대신 두 축으로 가드한다: (1) **결정성** — 두 번 호출이 deep-equal 이지만 참조-무공유(매 호출 새 트리)인지, (2) **불변식** — 각 descriptor 의 username-파생 필드를 산출 자신의 `person.fullName`(= username) single-source 로부터 컴포저 재호출 없이 독립 재유도해 대조(email suffix·externalId·service·isPrimary·distinct email·정확히 1 primary). 구조 결손 TypeError ↔ 값/불변식 위반 RangeError 를 분리한다(T-0715/T-0717 seed-side mirror).

issue-still-relevant 확인(origin/main f56aa622): `realdata-e2e-seed-fixture-consistency.ts` 파일·`assertRealDataE2eSeed*Consistent`·`RealDataE2eSeedDeterministic` 등 가드 심볼 origin/main grep **0 부재** 확인 — 본 가드는 아직 main 에 박제되지 않았다.

REQ-058(재수집 중복 방지: idempotent seed 의 distinct compound-unique key 정합) + REQ-059(seed 가 raw 활동 미보유: username 메타데이터만) + REQ-024(1 Person 당 정확히 1 primary identity invariant) 의 build-time 가드층을 닫는다.

## Required Reading

- `test/helpers/realdata-e2e-seed-fixture.ts` — 가드 대상 leaf 컴포저 `buildRealDataE2eSeed(): RealDataSeedDescriptor[]`(line 76, 무인자 결정론 builder). 합성 규칙(line 76–95): `REAL_DATA_GITHUB_USERNAMES`(module-private 상수 `["myungjoo","leemgs"]`, line 63) 의 각 username 을 `{ person: { fullName: username, email: \`${username}@e2e.realdata.test\`, active: true }, serviceIdentities: [{ service: "github.com", externalId: username, isPrimary: true }] }` 로 map. **주의: `REAL_DATA_GITHUB_USERNAMES` 는 export 되지 않는다(module-private)** — 가드는 이 상수를 import 할 수 없으므로, 산출 descriptor 의 `person.fullName`(= username) 을 single-source 로 재유도한다(email suffix·externalId·service 토큰을 fullName 으로부터 재합성해 대조). 문서화된 descriptor 불변식은 line 71–75. 타입(`RealDataSeedDescriptor`/`RealDataPersonSeed`/`RealDataServiceIdentitySeed`)은 본 파일에서 `import type` 으로 가져온다.
- `test/helpers/realdata-e2e-seed-resolve-person-id-consistency.ts`(T-0717) — seed-side 정합 가드의 **직전 mirror**. 구조 결손 TypeError ↔ 값-정합 위반 RangeError 분리 패턴·한국어 명세형 에러 메시지·`import type` only(value import 0 으로 순환 의존 회피) 형태를 그대로 따른다. 본 가드도 컴포저로부터 **타입만** import 한다.
- `test/helpers/realdata-e2e-seed-upsert-consistency.ts`(T-0715) — seed-side 재유도 가드 본문 구조(독립 재유도 → deep-equal/필드별 대조 → 위반 시 RangeError) 참고.
- `test/helpers/realdata-e2e-seed-fixture.spec.ts` — 기존 컴포저 spec(무회귀 대상). 본 가드 단위 test 는 새 colocated `*-consistency.spec.ts` 에 작성(가드 자체 단위 test 는 consistency.spec, R-112 colocated 정합).

## Acceptance Criteria

`test/helpers/realdata-e2e-seed-fixture-consistency.ts` 에 순수 가드를 신설한다 — 산출 descriptor 배열을 받아 (1) 결정성, (2) username-파생 불변식을 컴포저 재호출 없이 독립 검증하고, 위반 시 한국어 명세형 에러(구조 결손 TypeError / 값·불변식 위반 RangeError)를 throw. 정상이면 void 반환. `src/` 변경 0(test-only), `schema.prisma` 변경 0.

- [ ] 가드 함수(예: `assertRealDataE2eSeedConsistentWithUsernames(seed)`) 를 신설 — 입력 `seed: RealDataSeedDescriptor[]` 각 원소에 대해 username(`person.fullName`) single-source 로 다음을 독립 재유도·대조: `person.email === \`${fullName}@e2e.realdata.test\``, `person.active === true`, `serviceIdentities` 길이 정확히 1, 그 원소의 `service === "github.com"` · `externalId === fullName` · `isPrimary === true`. 추가로 배열 전체에서 email distinct(중복 0) + 각 person 당 isPrimary=true 인 github.com identity 정확히 1(REQ-024) 검증.
- [ ] **결정성 가드** — 별도 함수(또는 동일 함수의 한 검사축)로 `buildRealDataE2eSeed()` 두 호출 산출이 deep-equal 이지만 top-level 배열·각 descriptor·serviceIdentities 배열이 **참조-무공유**(mutate 격리)임을 검증할 수 있어야 한다. 가드는 컴포저를 value import 하지 않으므로(순환 의존 회피), 결정성·무공유 검증은 spec 에서 컴포저를 직접 호출해 가드에 두 산출을 넘기는 방식 또는 가드가 비교 헬퍼를 export 하는 방식 중 하나로 구현(implementer 판정, trail notes 에 선택 사유 1 줄).
- [ ] 구조 결손(seed 비-배열·원소 null/비객체·`person` 누락·`serviceIdentities` 비-배열 등)은 **TypeError**, 값·불변식 위반(email suffix drift·externalId≠username·isPrimary≠true·service≠"github.com"·길이≠1·email 중복·primary 개수≠1)은 **RangeError** 로 분리해 throw(T-0715/T-0717 mirror). 에러 메시지는 한국어 명세형 + 어긋난 필드·index 명시.
- [ ] **Happy-path test 1+**(`realdata-e2e-seed-fixture-consistency.spec.ts`) — 실제 `buildRealDataE2eSeed()` 산출을 가드에 넘기면 throw 0(void 반환). 두 호출 산출의 결정성·참조-무공유도 검증.
- [ ] **Error path / negative cases 충분 cover** — 각 위반 분기마다 1+ test(단일 negative 금지):
  - ① 구조 결손 → TypeError: seed 비-배열(null/undefined/객체/원시), 원소 null/비객체, `person` 누락, `serviceIdentities` 비-배열 — 각 1+.
  - ② 값·불변식 위반 → RangeError: email suffix drift, externalId≠username, isPrimary=false, service≠"github.com", serviceIdentities 길이 0·2, email 중복(두 person 동일 email), primary 개수 0·2 — 각 1+.
  (TypeError 분기와 RangeError 분기를 명확히 구분하는 negative test 각 1+.)
- [ ] **Flow / branch coverage** — 정상(void) 경로, 구조 결손 TypeError 경로, 불변식 위반 RangeError 경로 각 분기를 test 로 cover. distinct-email 검사·primary-count 검사 각 분기 cover.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 — 신규 가드 파일 line ≥ 80% / function ≥ 80%(jest `coverageThreshold.global`), 가능하면 100%.
- [ ] 전체 unit suite green(기존 seed-fixture spec 무회귀).

## Out of Scope

- 컴포저 `buildRealDataE2eSeed` self-wire(단일 return 직전 self-assert 배선)는 **별도 task**(T-0717→T-0718 패턴의 self-wire 짝 — 본 task 는 가드 신설만). 컴포저 `realdata-e2e-seed-fixture.ts` 본문 변경 0.
- `REAL_DATA_GITHUB_USERNAMES` 상수·`buildRealDataE2eSeed` 합성 규칙·descriptor 타입(`RealDataSeedDescriptor` 등) 수정 금지(read 만).
- 다른 NO-GUARD leaf(parse-shape 류 `result-issue-output-parse`·`result-issue-search-parse`·`result-issue-outcome-parse-shape`) 가드 신설은 별도 task.
- `src/` 변경 0(test-only). prisma `schema.prisma` 변경 0. 실 DB seed/upsert 배선 0.

## Suggested Sub-agents

`implementer → tester` (test-only 순수 가드 신설 — 아키텍처 결정 없음, 가드는 컴포저로부터 `import type` only 라 순환 의존 0, T-0715/T-0717 mirror 라 architect 불요).

## Follow-ups

- 컴포저 `buildRealDataE2eSeed` self-wire 짝(별도 task) — 단일 return 직전 본 가드 self-assert 배선, T-0717→T-0718 mirror. seed-fixture 는 가드가 컴포저를 type-only import 라 top-level import 채택 예상(순환 0).
- 잔여 NO-GUARD parse-shape 류 leaf(`result-issue-output-parse`·`result-issue-search-parse`·`result-issue-outcome-parse-shape`) — 형태 검증 위주는 값-정합 가드 적용 여부 case-by-case 판정 후 별도 task.

## Result (DONE — 2026-06-27)

PR #635 squash merge `5ac01daf`. test-only +699/-0 2 파일(`test/helpers/realdata-e2e-seed-fixture-consistency.ts` +309 가드 2함수 + `.spec.ts` +390). `src/`·`schema.prisma` 무변경.

- 불변식 가드 `assertRealDataE2eSeedConsistentWithUsernames(seed)` — 각 descriptor 의 `person.fullName`(=username) single-source 로 `email`·`active`·`serviceIdentities` 길이 1·`service`·`externalId`·`isPrimary` 독립 재유도·대조 + 배열 전체 email distinct·person 당 primary github.com identity 정확히 1(REQ-024).
- 결정성 가드 `assertRealDataE2eSeedDeterministic(first, second)` — 두 산출 deep-equal + 참조-무공유. 2-출력 인자 형태라 컴포저 self-wire 대상이 아니며 spec 이 컴포저를 직접 호출해 전달(type-only import 유지, 순환 0).
- 구조 결손 TypeError ↔ 값·불변식 위반 RangeError 분리, 한국어 명세형 메시지.
- 신규 가드 stmt/branch/func/line 100%, 전체 351 suite 8784 test green. reviewer round1 APPROVE finding 0, 4-게이트 PASS(첫 CI run Docker apt mirror 일시 장애 → rerun → green).

Follow-up `T-0720` 큐잉(불변식 가드 컴포저 self-wire — Deterministic 은 spec 잔류).
