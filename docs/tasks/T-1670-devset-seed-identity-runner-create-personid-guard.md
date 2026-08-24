---
id: T-1670
title: devset seed identity runner flattenPlan 에 create.personId 결손·불일치 fail-fast 가드 추가
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-047]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-08-24
createdAt: 2026-08-24T06:10:00Z
dependsOn: [T-1664]
touchesFiles:
  - test/helpers/realdata-devset-seed-identity-upsert-runner.ts
  - test/helpers/realdata-devset-seed-identity-upsert-runner.spec.ts
independentStream: load-harness-r91
plannerNote: PLAN 144 행 R-91 chain 51/N — T-1664 결함 클래스(create.personId 결손)를 첫 upsert 이전 가드로 고정
---

# T-1670 — devset seed identity runner flattenPlan 에 create.personId 결손·불일치 fail-fast 가드 추가

## Why

PLAN.md `144 행` 오너 지시("R-91 k6 최우선·즉시 착수") chain 의 잔여 후보 중 하나인 **`realdata-devset-seed-identity-upsert-runner.ts` `flattenPlan` 의 `create.personId` 결손 가드**(STATE `backlogNote` 명시, T-1664 이 "별도 slice" 로 남긴 항목)를 집행한다. T-1664 는 실 run `32652307813` 을 죽인 ``Argument `person` is missing.`` 결함을 `resolveRealDataPersonId` 가 `create.personId` 를 채우도록 배선해 닫았지만, **그 배선이 다시 빠지면 identity leg 는 지금도 여전히 CI 의 실 Prisma 호출 시점(seed step)에서야 죽는다** — `flattenPlan` 이 `where.personId_service` 만 검증하고 `create` 는 들여다보지 않기 때문이다. 본 slice 는 같은 결함 클래스를 **첫 upsert 이전 · unit test 층** 에서 즉시 실패시켜, R-91 dataset seed 의 부분 적재 0 원칙(`flattenPlan` 이 이미 placeholder 미치환 · 키 중복에 대해 지키는 것과 동형)을 `create` 축으로 확장한다. 실측 · 워크플로 dispatch · 임계 변경은 0 이다.

## Required Reading

- `test/helpers/realdata-devset-seed-identity-upsert-runner.ts` — 특히 `flattenPlan`(54~95 행 부근)의 기존 검증 4 종(배열 아님 / 구조 결손 / placeholder 잔존 / 키 중복)과 에러 정책(구조 결손 `TypeError` · 값 정합 위반 `RangeError`).
- `test/helpers/realdata-devset-seed-identity-upsert-runner.spec.ts` — colocated spec. 34 행 부근의 identity args fixture 빌더(현재 `create` 에 `personId` 없음)와 56 행의 키 순서 단언.
- `test/helpers/realdata-e2e-seed-upsert.ts` — `ServiceIdentityUpsertArgs` 인터페이스(`create.personId?: string` 가 optional 인 이유와 T-1664 주석 60~65 행), `PERSON_ID_PLACEHOLDER`.
- `docs/ops/realdata-scale-devset.md` `## seed 실행 경로` 절 — identity leg 가 전체 seed chain 어디에 놓이는지.

## Acceptance Criteria

- [ ] `flattenPlan` 이 각 identity 원소의 `create` 슬롯을 첫 upsert **이전에** 검증한다 — `create` 가 객체 아님/null 이면 `TypeError`(기존 `obj()` 헬퍼 재사용, 메시지에 `upsertArgsList[i].identityUpsertsByEmail[j].create` 좌표 포함).
- [ ] `create.personId` 가 결손(`undefined`)·빈 문자열·공백·비-문자열이면 `RangeError` 를 던지고, 메시지에 "T-1664" 와 해당 좌표·service 가 들어가 원인(resolve 배선 누락)을 즉시 지목한다.
- [ ] `create.personId` 가 존재하지만 같은 원소의 `where.personId_service.personId` 와 **다르면** `RangeError` 를 던진다(두 값이 같은 실 person.id 여야 한다는 T-1664 계약).
- [ ] `create.personId` 가 `PERSON_ID_PLACEHOLDER` 그대로면 `RangeError`(where 축의 기존 placeholder 가드와 동형 메시지 체계).
- [ ] 검증은 **어떤 upsert 호출보다 먼저** 완결된다 — 결손 원소가 배열 뒤쪽에 있어도 `client.serviceIdentity.upsert` 호출 횟수 0 (부분 적재 0).
- [ ] happy-path unit test 1+ — `create.personId` 가 `where` 와 같은 실값인 정상 입력에서 기존 동작(순차 upsert · 반환 Map · args 무변형)이 **무변경** 임을 검증.
- [ ] error path unit test 1+ — 위 4 종 throw(`create` 비-객체 / `personId` 결손 / 불일치 / placeholder 잔존) 각각 1+ case, 에러 타입(`TypeError` vs `RangeError`)과 메시지 정규식까지 단언.
- [ ] 분기 cover — 새로 추가한 각 조건 분기마다 통과 case 와 throw case 를 짝으로 둔다.
- [ ] negative cases 충분 cover — 빈 문자열 `""` · 공백만 `"   "` · 숫자/`null` 등 type mismatch · placeholder 잔존 · where 와의 대소문자 다른 값(불일치) · 결손 원소가 2 번째 이후일 때 선행 원소도 upsert 되지 않음(비정상 시퀀스) 각 1+ test.
- [ ] 기존 spec 의 identity args fixture 빌더를 `create.personId` 포함으로 갱신해 기존 case 전량이 그대로 통과한다(기존 단언 의미 변경 0 — 특히 `Object.keys(calls[0])` 키 순서 단언 유지).
- [ ] `pnpm lint && pnpm build && pnpm test` green, `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%).

## Out of Scope

- `test/helpers/realdata-e2e-seed-upsert.ts` 의 `ServiceIdentityUpsertArgs` 타입 변경(`personId` 를 required 로 승격하는 등) — build 단계 매퍼 계약(산출 키 3 개)이 바뀌므로 별도 slice.
- `resolveRealDataPersonId` · consistency 컴포저 · person leg runner 수정 — T-1664 가 이미 배선했고 본 slice 는 소비 측 가드만.
- `load-k6.yml` dispatch · 실측 회차 추가 · `§3` 임계(`p(95)<900`) 재확정 — T-1668 규칙상 별도 slice.
- `test/load/s2-read.js` · `s3-concurrent.js` 의 devset dataset 교체 — 별도 slice(backlogNote 잔여).
- `deploy/daily-test.sh` leg 추가 — drift-guard smoke spec 3 종 동반으로 cap 초과(T-1122 / Q-0054).
- 문서(`load-resilience-test-plan.md` · `realdata-scale-devset.md` · `PLAN.md`) 갱신 — 필요 시 direct doc slice 로 분리(§3.1 mixed 금지).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 없음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
