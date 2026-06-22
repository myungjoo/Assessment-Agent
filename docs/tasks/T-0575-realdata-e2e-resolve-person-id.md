---
id: T-0575
title: 실 평가 e2e upsert-args 의 personId placeholder → 실 person.id 치환 순수 매퍼
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-024, REQ-037]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-06-22
plannerNote: P5 bullet109 step①→② 경계 — T-0574 upsert-args 의 personId placeholder 를 email→person.id map 으로 치환하는 순수 함수(build-time, LAN 무관)
independentStream: realdata-e2e-buildtime
dependsOn: []
touchesFiles: [test/helpers/realdata-e2e-seed-resolve-person-id.ts, test/helpers/realdata-e2e-seed-resolve-person-id.spec.ts]
---

# T-0575 — 실 평가 e2e upsert-args 의 personId placeholder → 실 person.id 치환 순수 매퍼

## Why

PLAN.md 109행(🟢 실 평가 e2e 테스트 데이터 = github.com `myungjoo` + `leemgs`)의 step ①→② 경계를 한 조각 더 메운다. T-0574 의 `buildRealDataUpsertArgs()` 가 산출하는 `ServiceIdentityUpsertArgs` 는 `where.personId_service.personId` 자리에 `PERSON_ID_PLACEHOLDER`(런타임 미상) 를 박아둔다 — Person.id 는 DB write 시점에 생성되기 때문이다. step ②(실 수집 runner)는 person.upsert 를 먼저 수행해 `email → person.id` 매핑을 얻은 뒤, ServiceIdentity upsert args 의 placeholder 를 실 person.id 로 치환해야 한다. 본 task 는 그 **치환 단계를 순수 함수로 분리**해 build-time 에 검증 가능하게 만든다. DB·네트워크·live-LLM·credential 접근 0 이라 cloud cron 자율 실행 가능하다.

## Required Reading

- `test/helpers/realdata-e2e-seed-upsert.ts` — T-0574 매퍼. `PERSON_ID_PLACEHOLDER`(line 44), `ServiceIdentityUpsertArgs`(compound-unique where shape), `RealDataUpsertArgs`(`personUpsert.where.email` + `identityUpsertsByEmail`) 정의. 본 매퍼가 소비/생산하는 타입.
- `test/helpers/realdata-e2e-seed-upsert.spec.ts` — colocated spec 의 describe/it 한국어 표현 및 negative-case 구성 패턴 참조(동형으로 작성).
- `prisma/schema.prisma` 의 `model ServiceIdentity` 의 `@@unique([personId, service])` — 치환 후 where 절이 만족해야 할 compound-unique invariant 근거(읽기만, 변경 금지).

## Acceptance Criteria

- [ ] 신규 파일 `test/helpers/realdata-e2e-seed-resolve-person-id.ts` 에 순수 함수 `resolveRealDataPersonId(upsertArgsList: RealDataUpsertArgs[], emailToPersonId: ReadonlyMap<string, string> | Record<string, string>)` 를 추가. 각 `RealDataUpsertArgs` 의 `personUpsert.where.email` 로 map 에서 실 person.id 를 찾아 그 Person 의 `identityUpsertsByEmail[*].where.personId_service.personId`(placeholder) 를 실 person.id 로 치환한 **새 객체 트리**를 반환(입력 mutate 금지).
- [ ] 치환 결과의 `where.personId_service.personId` 는 더 이상 `PERSON_ID_PLACEHOLDER` 가 아니어야 하고, 동일 Person 의 모든 identity 가 같은 person.id 를 받아야 한다(compound-unique 정합).
- [ ] happy-path unit test 1+: `buildRealDataE2eSeed()` → `buildRealDataUpsertArgs()` → `resolveRealDataPersonId()` 파이프라인에 정상 email→id map 을 넣어 placeholder 가 전부 치환됨을 검증.
- [ ] error path unit test 1+: map 에 email 키가 없는 경우(누락) — 명시적 throw(에러 메시지에 누락 email 포함) 또는 명세된 sentinel 동작 중 택1 을 구현하고 그 동작을 검증. placeholder 가 치환 안 된 채 조용히 통과하지 않을 것.
- [ ] flow/branch test: identity 가 0 개인 Person(빈 `identityUpsertsByEmail`) 분기 + identity 가 2+ 개인 Person 분기 각 1+ test. 빈 입력 배열 → 빈 배열 반환(throw 0).
- [ ] negative cases 충분 cover — 각 1+ test: (a) email 키 누락, (b) person.id 가 빈 문자열/공백인 map 값(거부 또는 명세 동작 검증), (c) 입력 배열 mutation 격리(반환값 mutate 가 원본에 영향 0 + 원본 placeholder 보존), (d) `ReadonlyMap` 과 `Record` 두 입력 형태 모두 동작, (e) R-59 — 반환 args 에 raw 활동 데이터(commit/PR/issue 본문) 미포함 확인.
- [ ] colocated spec `test/helpers/realdata-e2e-seed-resolve-person-id.spec.ts` 작성(같은 디렉토리). describe/it 문자열 한국어.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 매퍼는 분기 전부 cover 목표.

## Out of Scope

- 실제 DB upsert 를 수행하는 runner/script (step ②, LAN/credential gate). 본 task 는 args 변환 순수 함수만.
- 실 github.com API 호출 / 수집 (step ②).
- 로컬 Ollama 실 LLM 평가 (step ③, ADR-0045 LAN gate).
- `deploy/daily-test.sh` 의 `step_eval` 배선 (step ④).
- T-0574 의 `realdata-e2e-seed-upsert.ts` / T-0573 의 `realdata-e2e-seed-fixture.ts` 변경. 기존 export 타입을 **import 만** 한다(재정의 금지). 단 새 함수가 필요로 하는 타입이 export 안 돼 있으면 그 타입의 `export` 키워드 추가만 허용(동작 변경 0).
- `prisma/schema.prisma` / Person·ServiceIdentity service·repository 변경 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — sub-agent 가 발견 시 추가)
