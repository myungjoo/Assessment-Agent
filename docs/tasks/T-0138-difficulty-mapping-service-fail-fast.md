---
id: T-0138
title: DifficultyMappingService — 난이도 resolve + fail-fast 거부 (ADR-0011 §3 service-level 강제)
phase: P4
status: DONE
commitMode: pr
prNumber: 134
mergedAs: 9fc6570
reviewRounds: 1
completedAt: 2026-06-01T20:57:51+09:00
coversReq: [REQ-049, REQ-050, REQ-051, REQ-097]
estimatedDiff: 240
estimatedFiles: 3
created: 2026-06-01
plannerNote: P4 — ADR-0011 후속 chain T-0138 candidate(service slice). repo 위 resolve+fail-fast service(외부 dep 0, HITL 미발화). R-112 backbone ×1.5 ×P2002 1.2.
---

# T-0138 — DifficultyMappingService — 난이도 resolve + fail-fast 거부 (ADR-0011 §3 service-level 강제)

## Why

[ADR-0011](../decisions/ADR-0011-difficulty-model-assignment.md) §"후속 task chain 박제" 의 **T-0138+ candidate** 의 service slice 를 구현한다 — 직전 머지된 [T-0137](T-0137-difficulty-mapping-entity-repository.md) 이 박제한 `DifficultyMappingRepository` (raw CRUD) 위에 도메인 의미를 부여하는 `DifficultyMappingService` 를 신설한다. 본 service 가 ADR-0011 §3 (미설정 / 누락 슬롯 fail-fast 거부) 과 §2 (난이도 → `LlmProviderConfig.modelId` resolve) 를 **application-layer 에서 강제**한다. [PLAN.md L86](../PLAN.md) "3 난이도 모델 할당 (R-97)" 의 routing 정책 backbone 이며, repository 의 raw `P2002`/`P2025`/`null` 분기를 NestJS `HttpException` (4xx) 으로 변환하는 `GroupService`/`PartService` 패턴 (T-0050/T-0046) 의 1:1 mirror 다.

본 task 는 **외부 dependency 0** — provider HTTP client / `pnpm add` / 외부 자격증명 0. [ADR-0011](../decisions/ADR-0011-difficulty-model-assignment.md) §3 의 fail-fast 는 "어느 난이도가 미설정인지 4xx 로 표면화" 의 service-level 로직만이며, 실제 provider 호출 (resolve 된 `modelId` 로 LLM API call) 은 [CLAUDE.md §5](../../CLAUDE.md) HITL 게이트가 발화하는 후속 routing task (provider SDK 추가) 책임이다 ([p4-implementation-plan.md §4](../architecture/p4-implementation-plan.md) inventory). 따라서 본 task 는 **dependency-free clean next step** — HITL 게이트 **미발화**.

## Required Reading

- [docs/decisions/ADR-0011-difficulty-model-assignment.md](../decisions/ADR-0011-difficulty-model-assignment.md) — §2 (FK 참조 resolve 의미: `difficulty` → `llmProviderConfigId` → `LlmProviderConfig.modelId`) + §3 (fail-fast: row 부재 OR 가리킨 LlmProviderConfig 부재 → 4xx) + §Consequences (양/음) 가 본 service 의 contract source.
- [src/llm/difficulty-mapping.repository.ts](../../src/llm/difficulty-mapping.repository.ts) — 본 service 가 wrapping 할 repository (`findByDifficulty` null-safe / `findMany` / `create` P2002 propagate / `delete` P2025 propagate / `updateProviderConfig` P2025 propagate). 책임 경계 주석에 "fail-fast 변환은 후속 service 책임" 명시 — 본 task 가 그 후속 service.
- [src/llm/llm-provider-config.repository.ts](../../src/llm/llm-provider-config.repository.ts) — resolve 의 두 번째 hop. `findById(id)` null-safe 가 "가리킨 LlmProviderConfig 부재" 분기 (ADR-0011 §3) 의 source. `LlmProviderConfig.provider`/`modelId` 가 resolve 결과 payload.
- [src/llm/difficulty.ts](../../src/llm/difficulty.ts) — `Difficulty` union / `DIFFICULTIES` / `isDifficulty` type guard. 본 service 의 난이도 값 runtime 검증 (허용 집합 밖 → `BadRequestException`) source.
- [src/user/group.service.ts](../../src/user/group.service.ts) — mirror 할 service 패턴 (repository null 분기 → `NotFoundException`, Prisma `P2025`/`P2002` known code → `NotFoundException`/`ConflictException` 변환, `@Injectable`, collaborator repository inject). 본 service 의 exception 변환 정책 template.
- [src/llm/llm.module.ts](../../src/llm/llm.module.ts) — `DifficultyMappingService` 를 providers/exports 에 등록할 대상 module (이미 `DifficultyMappingRepository`/`LlmProviderConfigRepository` 등록됨 — service 가 둘 다 inject).
- [src/llm/difficulty-mapping.repository.spec.ts](../../src/llm/difficulty-mapping.repository.spec.ts) — colocated spec + Jest mock 패턴 (본 task 의 `difficulty-mapping.service.spec.ts` 가 mirror — repository 2 개를 mock provider 로 주입).

## Acceptance Criteria

- [ ] `src/llm/difficulty-mapping.service.ts` 신설 — `DifficultyMappingService` (`@Injectable`), `DifficultyMappingRepository` + `LlmProviderConfigRepository` 2 collaborator 를 constructor inject. `GroupService` 패턴 mirror (repository raw 분기 → NestJS `HttpException` 변환).
- [ ] `resolveModel(difficulty: string)` 메서드 — ADR-0011 §2/§3 의 fail-fast resolve 구현:
  1. `isDifficulty(difficulty)` false → `BadRequestException` ("미지원 난이도" — 허용 집합 밖).
  2. `findByDifficulty` null (슬롯 row 부재) → `ConflictException` 또는 `BadRequestException` ("해당 난이도 model 미설정" — 어느 난이도인지 메시지 명시, ADR-0011 §3 운영 가시성).
  3. mapping 의 `llmProviderConfigId` null (슬롯 미설정 — nullable 시작) → 동일 fail-fast 4xx.
  4. `LlmProviderConfigRepository.findById(llmProviderConfigId)` null (가리킨 config 부재 — race window) → fail-fast 4xx.
  5. happy-path: resolve 된 `LlmProviderConfig` 의 `provider` + `modelId` (+ `id`) 를 담은 결과 반환 (반환 shape 은 `LlmGenerateOptions.modelId` 소비처 정합 — 단순 `LlmProviderConfig` 반환 또는 `{ provider, modelId, configId }` payload 택일, 구현자 판단).
- [ ] `findAllMappings()` 메서드 — `DifficultyMappingRepository.findMany()` forward (3 row 고정 슬롯 전체 조회, T-0139 Admin endpoint 의 backbone). raw forward + null/빈배열 분기만 (도메인 변환 최소).
- [ ] `assignProviderConfig(difficulty: string, llmProviderConfigId: string)` 메서드 — 슬롯별 FK 재지정 (ADR-0011 §2, T-0139 backbone): `isDifficulty` 검증 → 지정할 `LlmProviderConfig` 사전 존재 검증 (`findById` null → `NotFoundException`) → `repository.updateProviderConfig` 호출. `updateProviderConfig` 의 `P2025` (슬롯 difficulty 부재) → `NotFoundException` 변환.
- [ ] `src/llm/llm.module.ts` 의 `providers`/`exports` 에 `DifficultyMappingService` 추가.
- [ ] **Happy-path unit test** (colocated `src/llm/difficulty-mapping.service.spec.ts`, 2 repository 를 Jest mock provider 로 주입): `resolveModel` 정상 resolve (슬롯 존재 + FK 존재 + config 존재 → provider/modelId 반환), `findAllMappings` 3 row 반환, `assignProviderConfig` 정상 재지정 각 1+.
- [ ] **Error path unit test**: `resolveModel` 의 5 분기 중 4 거부 분기 각각 (미지원 난이도 / 슬롯 부재 / FK null / config 부재) 4xx throw 검증, `assignProviderConfig` 의 config 부재 → `NotFoundException` / 슬롯 difficulty 부재 P2025 → `NotFoundException` 검증, repository reject (DB 장애) propagate 검증.
- [ ] **Flow / branch 분기 cover**: `resolveModel` 의 각 fail-fast 분기 (isDifficulty false / findByDifficulty null / llmProviderConfigId null / config findById null / 성공) 각 1+ test 로 분리. `assignProviderConfig` 의 config 존재/부재 + P2025/성공 분기 각 1+.
- [ ] **Negative cases 충분 cover**: `resolveModel` 에 빈 문자열 / 대문자 'Easy' / 'trivial' (미정의) 각 `BadRequestException`, null FK 슬롯, 존재하지만 config 가 삭제된 슬롯 (race), `assignProviderConfig` 에 존재하지 않는 config id / 존재하지 않는 난이도 슬롯 등 예외 분기마다 1+ test (단일 negative 금지).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm lint && pnpm build && pnpm test` green. tester 가 R-110 검증 수행.

## Out of Scope

- **provider HTTP client 구현 / 실제 LLM API call** — resolve 된 `modelId` 로 외부 provider 를 호출하는 `LlmGateway` 구현 + `pnpm add` (provider SDK) 는 후속 routing task 책임. **그 task 가 [CLAUDE.md §5](../../CLAUDE.md) HITL BLOCKED 게이트 발화** (외부 dependency + API key 자격증명). 본 task 는 service-level resolve/fail-fast 로직만, 외부 호출 0.
- **Admin LLM 지정 endpoint / DTO / RBAC** — PATCH `/api/llm/difficulty-mappings` controller + DTO + Admin+ guard 는 T-0139 책임. 본 service 의 `findAllMappings`/`assignProviderConfig` 가 그 endpoint 의 backbone 이나, HTTP-layer 는 본 task 에서 추가하지 않는다.
- **3 row seed 스크립트 도입** — `prisma/seed.ts` 자동 3 row (easy/medium/hard) 삽입은 T-0137 Out of Scope 가 외화한 별도 Follow-up. 본 task 의 fail-fast 가 미설정 슬롯을 4xx 로 거부하므로 seed 부재 상태에서도 service 동작은 정의됨 (거부).
- **`LlmGenerateOptions.difficulty` → service 연결 wiring** — interface placeholder 와 본 service resolve 의 호출 연결 (gateway 가 difficulty 받아 service.resolveModel 호출) 은 routing task. 본 task 는 service API 만 노출.
- **schema.prisma / migration 변경** — entity 는 T-0137 에서 박제 완료. 본 task 는 schema 변경 0 (service + module 등록 + spec 만).
- **LlmProviderConfigService 신설** — LlmProviderConfig 자체의 도메인 service (provider 값 검증 등) 는 별도 task. 본 task 는 `LlmProviderConfigRepository.findById` 만 read 용으로 inject.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0011 이 §2 resolve 의미 + §3 fail-fast 정책을 이미 확정, 신규 architecture 결정 0. `GroupService` 의 exception 변환 패턴이 구현 template).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 append)
