---
id: T-0149
title: POST /api/llm/providers — LLM provider config 생성 endpoint (apiKey AES-256-GCM encrypt-at-rest)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-052, REQ-053, REQ-054, REQ-055, REQ-051, REQ-043]
estimatedDiff: 170
estimatedFiles: 5
created: 2026-06-02
plannerNote: P4 milestone-2 chain 3/4 — Q-0013 승인 write CRUD 중 POST slice. migration 0(기존 apiKey TEXT 컬럼 reuse). PATCH/DELETE 는 split follow-up.
---

# T-0149 — POST /api/llm/providers (LLM provider config 생성 + apiKey 암호화)

## Why

Q-0013 가 승인한 **milestone-2 (LLM provider config write CRUD)** 의 chain 3/4 (POST slice) 다. chain 2 ("schema/data migration 검토") 는 planner 가 §5 HITL 게이트를 평가한 결과 **migration 불요로 collapse** 했다 — `LlmProviderConfig.apiKey` 는 이미 `TEXT NOT NULL` 컬럼으로 존재 (migration `20260601000000_llm_provider_config`) 하고, T-0147 의 `LlmApiKeyCipher.encrypt` 가 IV+authTag+ciphertext 를 **단일 base64 string envelope** 으로 packing 하므로 기존 `apiKey` 문자열 컬럼을 그대로 reuse 한다 (새 컬럼 0 / 타입 변경 0). 기존 plaintext row 도 0 (seed 0 / write endpoint 부재) 이라 batch re-encrypt migration 도 불요.

본 task 는 그 위에 첫 write 경로를 신설한다 — Admin+ 가 새 LLM provider config 를 등록 (REQ-051~055 각 provider 별 endpoint URL / API key / model 식별자 영속) 하되, 입력 apiKey 를 ADR-0014 §1 AES-256-GCM envelope 으로 **encrypt 후 영속**하고, 응답에는 apiKey 를 **절대 포함하지 않는다** (ADR-0014 §3 write-only / never-read-back invariant — 기존 GET endpoint 의 redact view 와 동일 contract). PATCH / DELETE slice 는 size cap 상 별도 split follow-up 으로 분리한다.

PLAN.md Phase P4 "LLM provider 추상화 (R-99~103)" + "자격증명 관리 (R-20/R-33)" bullet 의 write 경로 구현. 새 외부 dependency 0 (Node 내장 `node:crypto` + 기존 `class-validator`), 새 외부 credential 0 (`LLM_APIKEY_ENC_KEY` 는 ADR-0014 §2 박제 env var, T-0147 가 이미 도입).

## Required Reading

- `docs/decisions/ADR-0014-llm-api-key-encryption-at-rest.md` — Decision §1 (AES-256-GCM envelope) / §3 (write-only never-read-back invariant) / 후속 chain 표
- `src/llm/llm-apikey-cipher.service.ts` — `LlmApiKeyCipher.encrypt(plaintext)` signature (단일 base64 envelope 반환). 본 service 가 inject 해 호출
- `src/llm/llm-provider-config.service.ts` — 기존 read service + `sanitize` / `LlmProviderConfigView` (apiKey omit view). create 가 동일 sanitize 재사용
- `src/llm/llm-provider-config.repository.ts` — `LlmProviderConfigCreateInput` + `create(input)` (raw forward). 본 task 가 apiKey 에 ciphertext 를 넣어 호출
- `src/llm/llm-provider-config.controller.ts` — 기존 GET controller (Admin+ RBAC stack + controller-scope ValidationPipe). 본 task 가 `@Post()` 추가
- `src/llm/dto/assign-difficulty-mapping.dto.ts` — class-validator DTO 패턴 mirror (신규 create DTO 작성 기준)
- `src/llm/llm-gateway.interface.ts` — `isLlmProvider(value)` type guard + `LLM_PROVIDERS` (provider 값 검증 single source)
- `src/llm/llm.module.ts` — `LlmApiKeyCipher` 이미 providers/exports 에 등록됨 (module 재배선 불요 — 확인용)

## Acceptance Criteria

- [ ] 신규 `src/llm/dto/create-llm-provider-config.dto.ts` 작성 — `provider` / `endpointUrl` / `apiKey` / `modelId` 4 필드. 각 필드에 class-validator decorator (`@IsString` / `@IsNotEmpty` + 적절한 `@MaxLength`). `AssignDifficultyMappingDto` 패턴 mirror. **provider 값 자체의 허용 집합 검증** (5 provider 중 하나) 은 service 가 `isLlmProvider` 로 수행하되, DTO 는 형식 (비어있지 않은 string) 만 검증.
- [ ] `LlmProviderConfigService` 에 `create(dto)` 메서드 추가 — (1) `isLlmProvider(dto.provider)` 가 false 면 `BadRequestException` throw, (2) `LlmApiKeyCipher.encrypt(dto.apiKey)` 로 apiKey 를 ciphertext envelope 으로 변환, (3) `repository.create({ ...endpointUrl/modelId/provider, apiKey: ciphertext })` 호출, (4) 반환 row 를 기존 `sanitize` 로 redact 한 `LlmProviderConfigView` (apiKey 제외) 반환. `LlmApiKeyCipher` 를 생성자 주입.
- [ ] `LlmProviderConfigController` 에 `@Post()` 핸들러 추가 — `@Body() dto: CreateLlmProviderConfigDto`, `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` (기존 GET 과 동일 tier). 201 (NestJS POST 기본) + sanitize view 반환. service raw forward (controller 자체 분기 0).
- [ ] **Happy-path unit test**: create DTO 유효 입력 → service.create 가 `encrypt` 1회 호출 + repository.create 가 ciphertext (평문 apiKey 와 다른 값) 로 호출됨 + 반환 view 에 apiKey 키가 **부재**함을 검증. controller `@Post()` 가 service.create 로 forward 함도 검증.
- [ ] **Error path unit test**: (a) `isLlmProvider` false (미지원 provider 문자열) → `BadRequestException` 검증, (b) `repository.create` reject (DB 장애) → service 가 swallow 없이 propagate 검증, (c) `encrypt` 가 throw (env 키 부재 등) → service 가 propagate 검증.
- [ ] **Flow / branch coverage**: service.create 의 분기 — provider 유효(통과) vs 무효(`BadRequestException`) 각 1+ test. DTO validation 분기 — 누락 / 빈 string / wrong type 각 negative test 1+.
- [ ] **Negative cases 충분 cover**: 빈 apiKey / 빈 endpointUrl / 누락 필드 / non-string 타입 / 미지원 provider / 정의되지 않은 extra body 키 (forbidNonWhitelisted 400) — 각 1+ test. RBAC negative (User actor 403 / 인증 부재 401) 는 기존 guard stack 이 cover 하므로 controller test 에서 guard 적용 사실만 확인 (기존 GET test 패턴 mirror).
- [ ] **never-read-back invariant regression**: 반환 `LlmProviderConfigView` 에 `apiKey` 필드가 없고 (타입 + 런타임 둘 다), 응답으로 직렬화되는 객체에 평문 apiKey 가 절대 포함되지 않음을 검증하는 test 1+ (ADR-0014 §3).
- [ ] 신규 DTO 의 colocated spec `src/llm/dto/create-llm-provider-config.dto.spec.ts` 작성 (`assign-difficulty-mapping.dto.spec.ts` 위치 mirror). service / controller test 는 기존 colocated `llm-provider-config.service.spec.ts` / `llm-provider-config.controller.spec.ts` 에 case 추가.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- **PATCH /api/llm/providers/:id (수정) — split follow-up** (별도 task). ADR-0014 §3 부분 갱신 시멘틱 (apiKey 부재 = 기존 유지 / 명시 = 재암호화 교체) 은 그 task 책임.
- **DELETE /api/llm/providers/:id (삭제) — split follow-up** (별도 task). DifficultyMapping `onDelete: Restrict` (P2003 in-use 차단) 처리 포함.
- **DB schema migration** — 불요로 확인됨 (기존 `apiKey TEXT` 컬럼 reuse). 새 컬럼 / 타입 변경 / batch re-encrypt 0. `prisma/migrations/*` 추가 금지.
- **LlmGateway 복호화 wire** (LLM 호출 직전 in-memory decrypt) — provider HTTP client (미승인 milestone-1) 의존. 본 task 는 encrypt 방향만.
- **api.md doc-sync** — chain 4/4 별도 direct-mode task.
- 새 RBAC / auth-flow 정책 변경 0 — 기존 `JwtAuthGuard` / `RolesGuard` / `@Roles("Admin")` stack 적용만.
- 기존 stale 주석 ("ADR-0006 follow-up" 등) 의 대량 정정 — 본 task 가 직접 손대는 파일 내 1~2 줄만 정합, 별도 sweep 금지 (Follow-ups 에 기록).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(빈 상태로 생성 — sub-agent 가 관련 작업 발견 시 추가)
