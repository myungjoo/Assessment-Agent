---
id: T-0760
title: realdata-e2e step① seed upsert↔collect 두 leg(buildRealDataUpsertArgs·buildRealDataCollectCallArgs) single-source seeds identity convergence 조립 체인 non-gated build-time smoke 신설
phase: P5
status: DONE
commitMode: pr
completedAt: 2026-06-28T13:56Z
result: "DONE — PR #675 squash 6bf32e3c, reviewer round1 APPROVE(0 finding), 4-게이트 PASS, PR CI green. test-only +424/-0 1파일 smoke 15 it."
coversReq: [REQ-009, REQ-023, REQ-024]
estimatedDiff: 280
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 step① seed→수집 — DB-write upsert leg 와 collect-call leg 가 동일 seeds 단일 source 로 identity(service·externalId·email) 수렴함을 묶는 smoke 0 gap; git grep 두 leg 동시-호출 cross convergence 부재 확인"
independentStream: realdata-e2e-seed-upsert-collect-identity-convergence-smoke
dependsOn: []
sizeExempt: true
exemptReason: "cap-bend pre-justified: single-helper smoke spec × convergence-sweep 패턴(R-112 happy·cross-leg·partial-thread·negative 분기 다수 + no-mutation/credential/결정론) = ~280 LOC 1파일, T-0759/T-0758/T-0752 sibling smoke 패턴 정당화(test-only, src 0, sweep 일관). 300 미만이나 sweep sibling 이 일관히 cap 근접/초과(T-0758 459 LOC)라 exempt 선박제."
touchesFiles:
  - test/smoke/realdata-e2e-seed-upsert-collect-identity-convergence-assembly.smoke-spec.ts
---

# T-0760 — realdata-e2e step① seed upsert↔collect 두 leg single-source seeds identity convergence non-gated build-time smoke 신설

## Why

PLAN.md §109(🟢 실 평가 e2e, P5) step ①(시드 수집)은 단일 `seeds: RealDataSeedDescriptor[]`(= `buildRealDataE2eSeed()`) source 로부터 **두 개의 독립 leg** 로 갈린다 — (1) **upsert leg**: `buildRealDataUpsertArgs(seeds)` 가 각 seed descriptor 를 Prisma `person.upsert`(`where.email`) + `serviceIdentity.upsert`(`where.personId_service.{personId, service}`, `create.{service, externalId, isPrimary}`) args 로 매핑해 **DB 에 어떤 person/identity 를 박제할지** 결정하고, (2) **collect leg**: `buildRealDataCollectCallArgs(seeds)` 가 같은 seed 를 `collectForPerson(person, since, assessmentId)` 의 호출-args 로 매핑해 `person.serviceIdentities = {service, externalId}` 로 **어떤 identity 로 활동을 수집할지** 결정한다. step① 의 핵심 불변식은 **두 leg 가 동일 단일 `seeds` source 로 수렴**한다는 것 — 즉 upsert leg 가 DB 에 박제하는 `(service, externalId)` identity 쌍과 collect leg 가 author 귀속 수집에 쓰는 `(service, externalId)` 쌍이 byte-identical 로 일치해야 하고, person 단위로 descriptor 개수·email 정렬도 동형이어야 한다. 두 leg 가 같은 `seeds` 를 공유하지 않으면(예: 한 leg 가 identity 를 drop/재정렬하거나 다른 externalId 를 끌어쓰면) **박제한 identity X 로 수집하지 않고 identity Y 로 수집**해 step①→② 핸드오프가 깨진다(R-58 재수집 중복 방지·author 귀속 필터가 무력화).

기존 sweep 은 두 leg 를 **각각 따로** 닫았다: upsert leg 는 `realdata-e2e-seed-upsert.spec.ts`/`...-consistency.spec.ts`(T-0574/T-0716, `buildRealDataUpsertArgs` 단독 단언), collect leg 는 `realdata-e2e-seed-collect-call-args.spec.ts`/`...-consistency.spec.ts`(T-0577/T-0688, `buildRealDataCollectCallArgs` 단독) + collect-input leaf(`...-seed-collect-input.spec.ts` T-0576/T-0690). 그러나 **upsert leg 와 collect leg 를 동일 `seeds` 로 동시 호출해, upsert 가 박제하는 identity 의 `(service, externalId)` 와 collect 가 수집에 쓰는 `(service, externalId)` 가 byte-identical 단일 source(`seeds`)로 수렴**함을 박제한 smoke 는 NONE 이다(git grep `buildRealDataUpsertArgs` AND `buildRealDataCollectCallArgs|buildRealDataCollectInput` 동시-호출 smoke 파일 0 확인 — origin/main). 이 cross-leg identity 수렴이야말로 step① seed→수집 핸드오프 정합의 핵심인데 public CI 그물에 외화돼 있지 않다. 직전 머지된 T-0759 가 step④(publish↔outcome step-args)의 pre/post-실행 run source 수렴을 닫았다면, 본 task 는 step①(seed→수집)의 DB-write↔collect-call identity source 수렴을 닫는 sweep 의 seed-side 대칭이다. live leg(실 prisma.upsert·실 collectForPerson·실 github.com fetch·실 LLM·DB·LAN gate) 복제 0·non-gated 항상 실행.

gap 확인(git grep, origin/main): `for f in test/smoke/realdata-e2e*.smoke-spec.ts; do (buildRealDataUpsertArgs AND (buildRealDataCollectCallArgs OR buildRealDataCollectInput) 둘 다 실제 호출) 여부; done` — **두 leg 를 동일 seeds 로 동시 호출해 identity source 수렴을 단언한 smoke 파일 0** 확인. seed upsert↔collect cross-leg identity-convergence 전용 smoke 부재.

## Required Reading

- `test/helpers/realdata-e2e-seed-upsert.ts` — upsert leg. L80 `export function buildRealDataUpsertArgs(descriptors)` → `RealDataUpsertArgs[] {personUpsert, identityUpsertsByEmail}`. `personUpsert.where.email`(email-unique 정합)·`identityUpsertsByEmail[].create.{service, externalId, isPrimary}`·`...where.personId_service.{personId(=PERSON_ID_PLACEHOLDER), service}`. L44 `export const PERSON_ID_PLACEHOLDER`. 빈 배열→빈 배열(throw 0).
- `test/helpers/realdata-e2e-seed-collect-call-args.ts` — collect leg. L79 `export function buildRealDataCollectCallArgs(seeds)` → `RealDataCollectCallArgs[] {person, since(=undefined), assessmentId(=ASSESSMENT_ID_PLACEHOLDER)}`. `person.serviceIdentities = {service, externalId}`(collect-input 위임). L50 `export const ASSESSMENT_ID_PLACEHOLDER`. externalId 빈/공백 → 위임 `buildRealDataCollectInput` throw 전파.
- `test/helpers/realdata-e2e-seed-collect-input.ts` — collect leg 의 identity 투영 위임 매퍼. `buildRealDataCollectInput(seeds)` → `CollectForPersonInput[] {serviceIdentities: {service, externalId}[]}`. externalId 빈/공백 → 명시적 throw(수집 author 귀속 key 빈값 차단). collect leg 의 `person.serviceIdentities` 가 본 매퍼 산출과 동일함 참고(중복 매핑 0).
- `test/helpers/realdata-e2e-seed-fixture.ts` — L37 `interface RealDataServiceIdentitySeed {service, externalId, isPrimary, ...}`, L58 `interface RealDataSeedDescriptor {person:{fullName,email,active}, serviceIdentities:[]}`, L78 `buildRealDataE2eSeed(): RealDataSeedDescriptor[]`. 두 leg 공유 단일 source `seeds` 확보 + synthetic descriptor literal 합성용 shape 참조.
- `test/smoke/realdata-e2e-publish-outcome-step-args-run-convergence-assembly.smoke-spec.ts` (T-0759) — 직전 머지된 sibling cross-leg convergence smoke. 두 leg 동시-호출·single-source 수렴 단언·partial-thread 격리·negative throw 전파·결정론/무공유/no-mutation/credential 누출 0 패턴 참고(구조 sibling-consistent — 본 task 는 seed-side identity 수렴 대칭).
- `test/smoke/realdata-e2e-step-args-dual-leg-convergence-assembly.smoke-spec.ts` (T-0752) — pre-실행 dual-leg aggregator convergence smoke. dual-leg 동시-호출 수렴 단언 골격 참고(중복 회피 — 본 task 는 seed-side upsert↔collect 만, evaluation/publish aggregator 재단언 금지).

## Acceptance Criteria

신규 파일 `test/smoke/realdata-e2e-seed-upsert-collect-identity-convergence-assembly.smoke-spec.ts` 1개를 추가한다(test-only, src 변경 0, gating/describe.skip 배선 0 — 순수 build-time in-memory 검증만). 다음을 모두 만족한다:

- [ ] **Happy-path**: `seeds = buildRealDataE2eSeed()`(또는 synthetic `RealDataSeedDescriptor[]` literal) 단일 source 확보 후 동일 `seeds` 로 두 leg 호출 — `upsertArgs = buildRealDataUpsertArgs(seeds)` 와 `collectArgs = buildRealDataCollectCallArgs(seeds)` 가 모두 정상 산출(upsertArgs: `{personUpsert, identityUpsertsByEmail}[]`, collectArgs: `{person, since, assessmentId}[]`)하고 두 배열 length 가 seeds.length 와 동형(person 단위 1:1) happy test 1+.
- [ ] **cross-leg identity single-source 수렴(branch — 핵심 불변식)**: 두 leg 가 동일 `seeds` 의 identity 로 수렴함을 단언 1+ test — descriptor 단위로 upsert leg 의 `upsertArgs[i].identityUpsertsByEmail[].{create.service, create.externalId}` 쌍 집합과 collect leg 의 `collectArgs[i].person.serviceIdentities[].{service, externalId}` 쌍 집합이 순서·값 byte-identical(`toEqual`)로 일치 AND upsert leg 의 `personUpsert.where.email`(= seed person email)이 동일 seed descriptor 에서 도출됨을 묶어, DB 에 박제하는 identity 와 수집에 쓰는 identity 가 **같은 단일 `seeds`** 임을 단언. (isPrimary 는 collect-input 이 투영하지 않으므로 비교 대상에서 제외 — service/externalId 쌍만 수렴 비교.)
- [ ] **multi-identity person 분기에서도 identity 수렴(branch)**: 한 person 이 2+ serviceIdentities 를 갖는 descriptor 로 두 leg 호출 → upsert leg 의 `identityUpsertsByEmail` 다중 entry 의 `(service, externalId)` 순서·값이 collect leg 의 `person.serviceIdentities` 다중 entry 와 동형 일치 1+ test — 다중 identity 매핑에서 drop/재정렬 drift 0.
- [ ] **partial-thread 격리(branch)**: 서로 다른 seeds(identity externalId/service 변) 으로 두 leg 를 함께 호출 → upsert leg 의 박제 identity 와 collect leg 의 수집 identity 가 **함께** 동형 변화(두 leg 가 같은 source 따라 동시 이동, drift 0) 1+ test — 한 leg 만 stale seed 를 쓰면 박제≠수집 핸드오프 깨짐을 회귀 그물로 박제. 또한 빈 serviceIdentities descriptor 면 두 leg 모두 빈 identity(upsert `identityUpsertsByEmail=[]` AND collect `person.serviceIdentities=[]`)로 동형 수렴 단언 1+.
- [ ] **Error path / negative cases 충분 cover** — 다음 예외 분기마다 각 1+ test(collect leg 는 빈/공백 externalId 거부, upsert leg 는 throw 0 — 두 leg 의 비대칭 분기도 박제):
  - 어떤 descriptor 의 한 identity `externalId` 가 빈 문자열 `""` → collect leg(`buildRealDataCollectCallArgs`) throw 전파(수집 author 귀속 key 빈값 차단).
  - 어떤 descriptor 의 한 identity `externalId` 가 공백-only(`"   "`) → collect leg throw 전파.
  - **동일 빈/공백 externalId seeds 로 upsert leg(`buildRealDataUpsertArgs`) 는 throw 0**(upsert 는 externalId 빈값 가드 없음 — collect leg 만 막음) 단언 1+ test — 두 leg 의 가드 비대칭을 명시 박제(한 leg throw·다른 leg 통과).
  - 빈 `seeds` 배열(`[]`) → 두 leg 모두 빈 배열 반환(throw 0) 단언 1+(경계값).
- [ ] **flow / branch — DB-write leg vs collect-call leg 분리(branch)**: upsert leg(DB-write, `personUpsert`/`identityUpsertsByEmail` shape) / collect leg(collect-call, `person`/`since`/`assessmentId` shape) 두 leg 를 각각 분리 단언(분기마다 별 it) 1+ test each — 두 leg 가 독립 출력 shape(upsert-args vs call-args)를 산출하되 identity source 만 공유함을 박제. upsert leg 의 placeholder(`PERSON_ID_PLACEHOLDER`)·collect leg 의 placeholder(`ASSESSMENT_ID_PLACEHOLDER`, `since=undefined`)가 각 leg 에 박제됨도 단언.
- [ ] **credential 누출 0(branch)**: 두 leg 어느 출력(`upsertArgs`·`collectArgs`)에도 token/secret/PAT 어휘(`token`·`secret`·`ghp_`·`--auth` 등) 미포함 단언(§9 정합) + raw 외부 활동 데이터(commit/PR/issue 본문) 미포함(R-59 정합 — person 메타+identity 식별자만) 1+ test.
- [ ] **결정론·무공유·no-mutation**: 동일 `seeds` 로 두 leg 각각 두 번 호출 → deep-equal 산출(`toEqual`) + 새 객체(upsertArgs·collectArgs 참조 각각 `not.toBe`) + 입력 `seeds`(중첩 person/serviceIdentities 포함) mutate 0(호출 전후 deep-equal snapshot) 단언.
- [ ] `pnpm lint && pnpm build` green (tester 가 확인).
- [ ] tester 가 신규 smoke spec 를 격리 실행해 전부 PASS 확인(`pnpm test:smoke` 또는 해당 spec 단독). non-gated build-time smoke 라 DB/credential/네트워크 불요 — CI 위임 명시.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — test-only 추가라 글로벌 coverage 하락 없음 확인.

분기 cover 주: 본 task 는 어떤 컴포저/가드도 수정하지 않고 두 기존 seed-side leg(DB-write upsert·collect-call)를 동일 `seeds` 단일 source 로 묶은 cross-leg identity 수렴 불변식(identity `(service,externalId)` 쌍 단일 source 일치·multi-identity 분기·partial-thread 격리·두 leg 가드 비대칭 throw 전파)을 외부 non-gated smoke 로 박제하므로, 위 identity-convergence/multi-identity/partial-thread/negative 분기 단언이 R-112 4 항목(happy·error·branch·negative 충분)을 충족한다.

## Out of Scope

- `test/helpers/realdata-e2e-seed-upsert.ts`·`...-seed-collect-call-args.ts`·`...-seed-collect-input.ts`·`...-seed-fixture.ts` 또는 어떤 컴포저/가드 helper 의 로직 변경(컴포저 재구현·guard 메시지 수정 0 — smoke 는 외부 관측만).
- production `src/` 코드 변경(test-only).
- upsert leg 자체의 args shape(`personUpsert.where/create/update`·`serviceIdentity` compound-unique where·net-0 update) 전수 재단언(T-0574/T-0716 이미 cover — 본 task 는 cross-leg identity 수렴만).
- collect leg 자체의 call-args shape(`person`/`since=undefined`/`assessmentId` placeholder) + collect-input identity 투영 전수 재단언(T-0577/T-0688/T-0576/T-0690 이미 cover — 본 task 는 두 leg identity source 수렴만).
- pre-실행 dual-leg aggregator(`buildRealDataE2eStepArgs` → {evaluation, publish}) 또는 step④ publish↔outcome run 수렴 재단언(T-0752/T-0759 이미 cover).
- 실 github.com 네트워크 fetch / 실 활동 수집(`collectForPerson`) / 실 `prisma.person.upsert`·`prisma.serviceIdentity.upsert` 호출 / 실 assessment.id·person.id placeholder 치환 runner / 실 LLM round-trip(live leg 복제 0).
- gated(DB·credential·LAN) smoke leg 추가 — 본 task 는 non-gated build-time pure-composer smoke 단독.
- 새 dependency 도입(zod/execa/prisma client 등 0).
- 기존 seed-upsert/seed-collect-call-args/seed-collect-input unit·consistency spec 의 단언 수정·중복 it 이관(별도 sweep 금지 — 본 task 는 신규 smoke 파일만).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)
