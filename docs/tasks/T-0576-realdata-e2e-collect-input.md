---
id: T-0576
title: 실 평가 e2e seed descriptor → CollectForPersonInput 순수 매퍼
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-047]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-06-23
independentStream: realdata-e2e
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-seed-collect-input.ts
  - test/helpers/realdata-e2e-seed-collect-input.spec.ts
hqOrigin:
plannerNote: "P5 PLAN 109행 실 평가 e2e step②(수집) 경계 — seed descriptor→CollectForPersonInput 순수 매퍼. cloud-safe·dependency-free·LAN/credential 무관."
---

# T-0576 — 실 평가 e2e seed descriptor → CollectForPersonInput 순수 매퍼

## Why

PLAN.md 109행(P5 "🟢 실 평가 e2e 테스트 데이터 = github.com `myungjoo` + `leemgs` 공개 활동", 사용자 지정 2026-06-22)의 **step ②(수집) 경계**를 순수 함수로 분해하는 chain 의 다음 slice 다. 직전 chain(T-0573 `buildRealDataE2eSeed` → T-0574 `buildRealDataUpsertArgs` → T-0575 `resolveRealDataPersonId`)은 seed descriptor → DB upsert args(영속 경계)를 닫았다. 본 task 는 같은 seed descriptor 를 **수집 경계** 쪽으로 변환한다 — `src/assessment-collection/collection-entry.service.ts` 의 `CollectForPersonInput`(`serviceIdentities: {service, externalId}[]`) shape 로 매핑하는 순수 함수 `buildRealDataCollectInput()` 를 추가해, 실 수집 단계(`CollectionEntryService.collectForPerson`)가 받을 입력을 **build-time 결정론적으로** 산출한다. 실 github.com fetch·Ollama 실 LLM·credential 은 전부 deferred(LAN/credential gate, ADR-0045) 그대로 — 본 slice 는 네트워크/DB/LLM/env 접근 0 의 순수 매퍼라 cloud cron 에서 자율 실행 가능하다.

## Required Reading

- `docs/tasks/T-0575-realdata-e2e-resolve-person-id.md` — 직전 chain slice 의 패턴·범위 경계.
- `test/helpers/realdata-e2e-seed-fixture.ts` — `RealDataSeedDescriptor` / `RealDataServiceIdentitySeed` 입력 shape(`service: "github.com"`, `externalId`=username, `isPrimary`).
- `src/assessment-collection/collection-entry.service.ts` (L24~L52) — 목표 출력 `CollectForPersonInput` interface(`serviceIdentities: Pick<ServiceIdentity, "service" | "externalId">[]`)와 `collectForPerson` 시그니처.
- `test/helpers/realdata-e2e-seed-resolve-person-id.spec.ts` — colocated spec 의 구조·네이밍 컨벤션 참고(본 신규 spec 도 동일 위치/스타일).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-seed-collect-input.ts` 에 순수 함수 `buildRealDataCollectInput(seeds: RealDataSeedDescriptor[]): CollectForPersonInput[]` 추가. 각 seed descriptor 의 `serviceIdentities` 를 `{ service, externalId }` 만 추려 `CollectForPersonInput.serviceIdentities` 로 매핑(`isPrimary` 등 수집 입력에 불필요한 필드는 제외). 출력 `CollectForPersonInput` shape 은 `collection-entry.service.ts` 의 interface 와 구조 정합(import 하여 타입 재사용 권장 — 중복 정의 금지).
- [ ] **입력 mutate 0 / 무공유 보장** — 매 호출이 새 객체 트리를 반환하고, 입력 seed 배열·중첩 객체를 변형하지 않는다(호출 측이 반환값을 mutate 해도 입력에 영향 없음). spec 으로 검증.
- [ ] **Happy-path unit test 1+** — `buildRealDataCollectInput`(또는 `buildRealDataE2eSeed()` 결과를 입력으로) 에 대해 정상 매핑(2 Person × github.com 1 identity → service/externalId 정확 추출, 순서 보존) 검증.
- [ ] **Error/negative path test 1+** — 빈 입력 배열(`[]` → `[]` 반환), `serviceIdentities` 가 빈 배열인 descriptor(→ 빈 `serviceIdentities` 보존), `externalId` 가 빈/공백 문자열이면 명시적 throw(조용한 통과 차단) 등 예외 상황 각 1+ test. 단일 negative 만으로 부족 — 분기마다 cover.
- [ ] **Flow / branch coverage** — 함수 내 분기(빈 입력·빈 identity·throw 가드 등) 각 분기 1+ test.
- [ ] **무공유 회귀 test** — 반환값 mutate 후 동일 입력으로 재호출 시 결과 불변(공유 mutable 상수 노출 0) 검증.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(production `src/` 변경 0 — test helper + colocated spec 만).
- [ ] `pnpm test:cov` 통과 — 신규 helper line ≥ 80% AND function ≥ 80%(jest `coverageThreshold` 강제). 순수 매퍼이므로 100% 지향.

## Out of Scope

- 실 github.com 네트워크 fetch / `assessment-collection` 의 실 활동 수집 호출(step ② 의 live 부분 — LAN/credential gate).
- Ollama 실 LLM round-trip(step ③, ADR-0045 LAN=AKIHA 192.168.0.5, cloud cron 무경로).
- `deploy/daily-test.sh` 의 `step_eval` wiring(step ④).
- `CollectionEntryService` / production `src/` 코드 변경 — 본 task 는 test helper 단독(`CollectForPersonInput` 은 import 재사용만).
- DB upsert runner 실행(T-0574/T-0575 의 upsert-args 를 실 prisma 로 write 하는 runner — 별도 deferred).
- 새 외부 dependency / schema migration / env·secret 접근.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
