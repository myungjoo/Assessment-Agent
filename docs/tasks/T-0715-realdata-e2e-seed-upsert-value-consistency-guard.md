---
id: T-0715
title: realdata-e2e seed-upsert args ↔ seed descriptor single-source 재유도 정합 가드 신설
phase: P5
status: DONE
mergedAs: ddcb794fa5cbaf457e6aa69383aa83cd46c3f2a0
prNumber: 631
reviewRounds: 1
commitMode: pr
coversReq: [REQ-058, REQ-059, REQ-024]
estimatedDiff: 300
estimatedFiles: 2
created: 2026-06-27
plannerNote: "P5 build-time consistency sweep — buildRealDataUpsertArgs 의 prisma upsert-args 트리를 descriptor 필드만으로 독립 재유도하는 값-정합 가드 신설(NO-GUARD leaf 신규 stream, T-0711 mirror)"
independentStream: realdata-e2e-seed-upsert-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-seed-upsert-consistency.ts
  - test/helpers/realdata-e2e-seed-upsert-consistency.spec.ts
sizeExempt: true
exemptReason: "cap-bend pre-justified: 가드 본체 + colocated spec(personUpsert where/create/update 3 슬롯 · identityUpsertsByEmail compound-unique where/create/update 3 슬롯 + placeholder + 빈 배열 · 빈 identities · 다중 descriptor · TypeError·RangeError 분기 각 1+ negative) 합산 ~300 LOC. test-only · src 무변경, 직전 sibling T-0711(+421)/T-0713(+480)/T-0705(+586) 머지 선례 일관. R-112 negative-cases 충분 cover 가 spec 비중을 키움."
---

# T-0715 — realdata-e2e seed-upsert args ↔ seed descriptor single-source 재유도 정합 가드 신설

## Why

PLAN.md Phase P5(Evaluation pipeline) 109행 step ① seed 입력 계약 surface 의 build-time consistency-guard sweep 의 일환이다. NO-GUARD leaf 컴포저 `buildRealDataUpsertArgs`(T-0574, `test/helpers/realdata-e2e-seed-upsert.ts`)는 `RealDataSeedDescriptor[]` (Person 메타 + ServiceIdentity 배열)를 Prisma `person.upsert` / `serviceIdentity.upsert` 의 args 트리(`RealDataUpsertArgs[]`)로 변환하는 leaf 매퍼다. issue-still-relevant 확인: origin/main(2236171) 의 `*-seed-upsert-consistency.ts` 파일·`assertRealDataUpsertArgsConsistent` 심볼은 **grep 0 부재** — descriptor 의 실제 필드 값(fullName/email/active · service/externalId/isPrimary)이 args 트리의 올바른 슬롯(where/create/update · compound-unique where/create/update)에 단조 매핑됐는지를 검증하는 값-정합 가드층이 전혀 없다.

T-0711(result-summary-line) / T-0713(result-summary-markdown) 의 seed-side mirror 로, descriptor 필드만으로 expected upsert args 트리를 **컴포저 재호출 없이** 독립 재유도해 deep-equal 대조하는 가드를 신설해 값/슬롯/compound-unique key 매핑 drift 를 build-time fail-fast 로 차단한다(매퍼 내부 매핑이 잘못 바뀌어도 재호출 산출도 같은 잘못된 값을 내어 상쇄 통과하는 gap 을 닫는다). REQ-058(재수집 중복 방지) + REQ-059(raw 미보유 정합) + REQ-024(1 Person 당 1 primary identity invariant) 의 build-time 가드층을 보강한다. 또한 T-0714 Follow-up 이 seed-side 를 "별도 stream" 으로 식별한 직후 첫 stream-opening task 다.

## Required Reading

- `test/helpers/realdata-e2e-seed-upsert.ts` — 가드 대상 leaf 매퍼 `buildRealDataUpsertArgs(descriptors)`. 산출 구조: `descriptors.map(descriptor => ({ personUpsert: { where: { email }, create: { fullName, email, active }, update: { fullName, active } }, identityUpsertsByEmail: serviceIdentities.map(identity => ({ where: { personId_service: { personId: PERSON_ID_PLACEHOLDER, service } }, create: { service, externalId, isPrimary }, update: { isPrimary } })) }))` — 결정론·순서 보존. `PERSON_ID_PLACEHOLDER` 상수는 본 가드도 single-source import 재사용한다.
- `test/helpers/realdata-e2e-seed-fixture.ts` — `RealDataSeedDescriptor` / `RealDataPersonSeed` / `RealDataServiceIdentitySeed` 타입 single source 참조. github.com 만 허용하는 `service: "github.com"` literal 타입.
- `test/helpers/realdata-e2e-result-summary-line-consistency.ts` 와 그 colocated spec — **mirror 선례**(T-0711). 컴포저 재호출 없이 입력 필드만으로 독립 재유도 → 대조, 구조결손 TypeError↔값정합 RangeError 분리 패턴을 그대로 따른다(라인 byte-identical 대신 deep-equal 사용).
- `test/helpers/realdata-e2e-result-summary-markdown-consistency.ts` — **mirror 선례 2**(T-0713). 슬롯/순서 매핑이 풍부한 트리에서의 negative 분기 분류 참고.
- `prisma/schema.prisma` (Person·ServiceIdentity 모델 정의) — `email @unique`(person.upsert.where 정합) + `@@unique([personId, service])`(serviceIdentity.upsert.where compound-unique 정합) 근거. 본 가드는 schema 를 직접 읽지 않고 매퍼 산출 구조를 그대로 미러링한다.

## Acceptance Criteria

신규 파일 `test/helpers/realdata-e2e-seed-upsert-consistency.ts` 에 순수 함수 가드 `assertRealDataUpsertArgsConsistentWithDescriptors(upsertArgsList: RealDataUpsertArgs[], descriptors: RealDataSeedDescriptor[]): void` (또는 동등한 명명) 를 신설하고, colocated spec `test/helpers/realdata-e2e-seed-upsert-consistency.spec.ts` 를 작성한다.

- [ ] 가드는 `buildRealDataUpsertArgs` 를 **재호출하지 않고** descriptors 필드(person.fullName/email/active · serviceIdentities[*].service/externalId/isPrimary)만으로 expected upsert args 트리를 독립 재유도(`PERSON_ID_PLACEHOLDER` 상수만 single-source import 재사용, where/create/update 슬롯 구조·키 순서는 가드 안에 미러링)한 뒤, 실제 `upsertArgsList` 와 **deep-equal** 대조한다. 정합이면 void(무회귀·입력 비변형), 불일치면 `RangeError`(값 정합 위반).
- [ ] 구조 결손(`upsertArgsList` 가 배열 아님·null/undefined, `descriptors` 가 배열 아님·null/undefined, 두 배열 길이 불일치, 각 원소가 객체 아님·null, personUpsert/identityUpsertsByEmail 누락, 하위 where/create/update 누락 또는 슬롯 키 부재, descriptor.person 또는 serviceIdentities 누락)은 `TypeError` 로 분리해 던진다(값정합 `RangeError` 와 구분).
- [ ] **Happy-path test 1+** — `buildRealDataE2eSeed()` 출력 + `buildRealDataUpsertArgs(buildRealDataE2eSeed())` 출력 쌍(2 항목 myungjoo/leemgs)에 대해 가드가 throw 0 으로 통과. 추가로 (a) 빈 배열 쌍(`[], []`), (b) serviceIdentities 가 0 개 / 1 개 / N 개 인 합성 descriptor 케이스 각 1+(분기 cover).
- [ ] **호출 격리 검증 test 1+** — 가드가 `buildRealDataUpsertArgs` 를 내부에서 재호출하지 않음을 jest spy/mock 으로 증명(컴포저 모듈을 mock 한 뒤 가드 호출 → 컴포저 mock 이 0 회 호출됐음을 단언). re-호출 의존 시 양방향 drift 상쇄 gap 이 다시 열리므로 본 분리 검증이 가드 가치의 핵심.
- [ ] **Error path / negative cases 충분 cover** — 각 예외 분기마다 1+ test:
  - ① personUpsert.where.email drift(args 의 email 이 descriptor.person.email 과 불일치) → RangeError,
  - ② personUpsert.create 슬롯 값 drift(fullName/email/active 중 하나가 descriptor 와 불일치) → RangeError,
  - ③ personUpsert.update 슬롯 값 drift(fullName/active 중 하나가 descriptor 와 불일치) → RangeError,
  - ④ personUpsert.update 가 net-0 보존 위반(예: email 이 update 슬롯에 추가됨) → RangeError(슬롯 키 set 불일치),
  - ⑤ identityUpsertsByEmail[*].where.personId_service.personId 가 `PERSON_ID_PLACEHOLDER` 아님 → RangeError(placeholder drift),
  - ⑥ identityUpsertsByEmail[*].where.personId_service.service 가 descriptor 의 service 와 불일치 → RangeError,
  - ⑦ identityUpsertsByEmail[*].create 슬롯 값 drift(service/externalId/isPrimary 중 하나) → RangeError,
  - ⑧ identityUpsertsByEmail[*].update 슬롯 값 drift(isPrimary) → RangeError,
  - ⑨ identityUpsertsByEmail 순서 drift(descriptor.serviceIdentities 순서와 args 순서가 어긋남) → RangeError,
  - ⑩ upsertArgsList 길이 ↔ descriptors 길이 불일치 → TypeError,
  - ⑪ upsertArgsList/descriptors 가 null/undefined/비배열 → TypeError,
  - ⑫ 각 원소가 객체 아님 / personUpsert · identityUpsertsByEmail 슬롯 누락 / 하위 where/create/update 슬롯 키 부재 → TypeError,
  - ⑬ descriptor.person 또는 descriptor.serviceIdentities 누락 → TypeError.
  (단일 negative 금지 — 예외 분기마다 각 1+. 슬롯 drift 와 구조 결손은 RangeError↔TypeError 로 분리.)
- [ ] **Flow / branch coverage** — TypeError 분기와 RangeError 분기, 재유도 순회(descriptors.map + serviceIdentities.map) 각 분기를 test 로 cover. 빈 배열 (외층/내층 각각) 경계도 1+ cover.
- [ ] 가드가 입력 `upsertArgsList`·`descriptors`(하위 person/serviceIdentities · where/create/update 객체 포함)를 비변형(읽기 전용)함을 검증하는 test 1+(호출 전후 deep-equal + 참조 동등성 검증).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 — 신규 가드 파일 line ≥ 80% / function ≥ 80%(jest `coverageThreshold.global`), 가능하면 100%.
- [ ] 전체 unit suite green(기존 test·`realdata-e2e-seed-upsert.spec.ts` 무회귀).

## Out of Scope

- 컴포저 `realdata-e2e-seed-upsert.ts` 의 self-wire 배선(반환 직전 본 신규 가드 self-assert 삽입)은 **본 task 에서 하지 않는다** — 후속 짝 task(T-0711→T-0712 / T-0713→T-0714 패턴)로 분리. 본 task 는 가드 신설만.
- `buildRealDataUpsertArgs` 매퍼 본문·args 트리 출력 구조 변경 금지(가드는 읽기만).
- `buildRealDataE2eSeed` / `RealDataSeedDescriptor` 타입 / `PERSON_ID_PLACEHOLDER` 상수 수정·재정의 금지(import 재사용만).
- 다른 seed-side NO-GUARD leaf(`resolveRealDataPersonId` / `buildRealDataE2eSeed`)·result-issue parse-shape 류는 별도 task.
- `src/` 변경 0(test-only). prisma `schema.prisma` 변경 0(가드는 schema 를 직접 읽지 않음 — 매퍼 산출 구조 미러링만).

## Suggested Sub-agents

`implementer → tester` (test-only 가드 신설 — 아키텍처 결정 없음, T-0711/T-0713 mirror 라 architect 불요).

## Follow-ups

- (예정) seed-upsert 컴포저 self-wire 짝 — `buildRealDataUpsertArgs` 반환 직전 본 신규 가드 self-assert + import(T-0712/T-0714 self-wire mirror; 가드의 컴포저 import 그래프 — 가드는 `RealDataUpsertArgs`/`PERSON_ID_PLACEHOLDER` 를 컴포저에서 import 하므로 컴포저 → 가드 self-wire 는 순환 의존 발생 → lazy require 또는 가드가 컴포저에서 import 하는 type/const 를 별도 모듈로 추출하는 분리 결정이 self-wire task 에서 필요).
- 잔여 seed-side NO-GUARD leaf 후보: `resolveRealDataPersonId`(T-0575, `realdata-e2e-seed-resolve-person-id.ts` — placeholder → 실 person.id 치환 매퍼) 가드 신설, `buildRealDataE2eSeed`(T-0573 — 무인자 결정론 상수 빌더, 값-정합 가드보다는 결정성·shape 가드가 적합한지 case-by-case).
- result-issue parse-shape 류(`result-issue-output-parse`·`result-issue-search-parse`·`result-issue-outcome-parse-shape`)는 이미 set-equality shape 가드 self-wire 완료(T-0660/T-0662) — 값-정합 가드 필요 여부 재survey 결과 추가 가드 불요로 판정.
