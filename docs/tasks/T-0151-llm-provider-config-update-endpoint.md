---
id: T-0151
title: PATCH /api/llm/providers/:id — LLM provider config 부분 수정 endpoint (optional apiKey 재암호화 / never-read-back 유지)
phase: P4
status: DONE
commitMode: pr
prNumber: 144
mergedAs: 004e705
reviewRounds: 1
completedAt: 2026-06-02T08:57:00+09:00
coversReq: [REQ-051, REQ-052, REQ-053, REQ-054, REQ-055, REQ-043, REQ-096]
estimatedDiff: 170
estimatedFiles: 7
sizeExempt: true
exemptReason: R-112 backbone × 1.5 (DTO+service+controller+repository 4-layer) + colocated spec ordering hint 으로 신규 spec 1 + 기존 spec 2 modify 가 unavoidable. PATCH 는 repository.update 신설 + 부분 갱신 분기 + optional apiKey 재암호화 분기로 POST/DELETE 보다 1 파일 더 touch. ~170 LOC ≤ 300 LOC cap 내 — 파일수만 7 로 초과.
created: 2026-06-02
plannerNote: P4 milestone-2 write CRUD PATCH slice (Q-0013 승인, 마지막 코드 slice). R-112 backbone × 1.5, P2002 미적용(@unique 부재). repository.update 신설 + optional apiKey 재암호화 분기.
---

# T-0151 — PATCH /api/llm/providers/:id (LLM provider config 부분 수정 + optional apiKey 재암호화)

## Why

Q-0013 가 승인한 **milestone-2 (LLM provider config write CRUD)** 의 마지막 코드 slice 인 **PATCH** 다. POST (T-0149) / DELETE (T-0150) 가 merge 됐고, 남은 write 경로는 PATCH 와 api.md doc-sync (chain 4/4, 별도 direct-mode task) 뿐이다. 본 task 는 PATCH 를 신설해 write CRUD 를 완성한다 — Admin+ 가 등록된 LLM provider config 를 id 로 **부분 갱신** (REQ-051~055 각 provider 별 endpoint URL / API key / model 식별자 변경) 하되, ADR-0014 §3 의 **never-read-back invariant** 를 수정 경로에서도 유지한다.

PATCH 의 핵심은 **부분 갱신 시멘틱** + **optional apiKey 재암호화 분기** 다:
- **apiKey 가 request body 에 부재** → 기존 ciphertext 를 그대로 유지 (재암호화 0, 기존 secret 보존). PATCH 응답으로 apiKey 를 읽어 되돌려주지 않으므로 운영자가 apiKey 를 모른 채로도 다른 필드만 수정 가능 — never-read-back 와 정합.
- **apiKey 가 명시** → 평문을 `LlmApiKeyCipher.encrypt` 로 새 AES-256-GCM envelope ciphertext 로 변환해 교체 (POST 의 encrypt 경로 재사용). 기존 ciphertext 는 복호화하지 않는다 (read-back 0).
- **다른 필드 (provider / endpointUrl / modelId)** 도 부재 = 미변경, 명시 = 교체. provider 명시 시 `isLlmProvider` 로 허용 집합 검증 (미지원 → 400) — POST 의 service-layer 검증 mirror.

repository 에 `update(id, data)` 메서드를 신설한다 (현재 create / findById / findMany / delete 만 존재). Prisma `update` 는 부재 id 에 **P2025** 를 던지므로 service 가 이를 404 로 변환한다 (DELETE slice 의 P2025→404 변환 패턴 mirror). 새 외부 dependency 0 (Node 내장 `node:crypto` + 기존 `class-validator`) / 새 외부 credential 0 (`LLM_APIKEY_ENC_KEY` env, T-0147 도입) / DB schema migration 0 (기존 `apiKey TEXT` 컬럼 reuse, `@unique` 부재로 P2002 분기 0) — §5 HITL 게이트 미발화 (Q-0013 승인 scope 내 — POST/PATCH/DELETE 명시 승인).

PLAN.md Phase P4 "LLM provider 추상화 (R-99~103)" + "자격증명 관리 (R-20/R-33)" bullet 의 write 경로 완성. api.md doc-sync 는 POST+DELETE+PATCH 종합 반영 별도 direct-mode task.

## Required Reading

- `docs/decisions/ADR-0014-llm-api-key-encryption-at-rest.md` — Decision §1 (AES-256-GCM envelope) / §3 (write-only never-read-back invariant — PATCH 의 apiKey 부재=유지 / 명시=재암호화 시멘틱의 근거). 수정 경로에서도 apiKey read-back 0 보장
- `src/llm/llm-provider-config.service.ts` — 기존 `create` (encrypt 후 영속 + sanitize) + `delete` (P2025→404 변환, `getPrismaErrorCode` duck-typing) + `sanitize` (apiKey 제거 allow-list view) + `LlmProviderConfigView` type. 본 task 가 `update(id, dto)` 추가 — create 의 encrypt 분기 + delete 의 P2025→404 변환 둘 다 재사용
- `src/llm/llm-provider-config.repository.ts` — 현재 create / findById / findMany / delete 만 존재. 본 task 가 `update(id, data)` 신설 — `this.prisma.llmProviderConfig.update({ where: { id }, data })` raw forward (P2025 propagate, service 가 변환). `LlmProviderConfigCreateInput` 인접에 partial update input shape 정의
- `src/llm/llm-provider-config.controller.ts` — 기존 GET/POST/DELETE controller (Admin+ RBAC stack + controller-scope ValidationPipe). 본 task 가 `@Patch(":id")` 추가
- `src/llm/dto/create-llm-provider-config.dto.ts` — `CreateLlmProviderConfigDto` 4 필드 (provider/endpointUrl/apiKey/modelId) + class-validator 패턴. 본 task 의 `UpdateLlmProviderConfigDto` 는 동일 4 필드를 **전부 `@IsOptional`** 로 (부분 갱신). colocated spec 위치: `src/llm/dto/update-llm-provider-config.dto.spec.ts` (create DTO spec 위치 mirror)
- `src/llm/llm-apikey-cipher.service.ts` — `LlmApiKeyCipher.encrypt(plaintext)` signature (단일 base64 envelope 반환). apiKey 명시 시에만 호출 (decrypt 미사용 — never-read-back)
- `src/llm/difficulty-mapping.service.ts` — `getPrismaErrorCode` duck-typing helper + P2025→NotFoundException 변환 패턴 (service 가 service 내 동일 helper 보유 — 본 service 의 기존 `delete` 가 이미 mirror 함, 신규 외화 없음 확인용)
- `test/helpers/prisma-mock.ts` — `buildPrismaError(code, message)` 헬퍼. update service spec 의 P2025 case 가 이를 사용
- `prisma/schema.prisma` (line 321~333) — `LlmProviderConfig` 에 `@unique`/`@@unique` **부재** (P2002 분기 0 확인). `apiKey TEXT` 컬럼 그대로 reuse (migration 0)

## Acceptance Criteria

- [ ] 신규 `src/llm/dto/update-llm-provider-config.dto.ts` 작성 — `provider` / `endpointUrl` / `apiKey` / `modelId` 4 필드를 **전부 optional** (`@IsOptional` + 기존 create DTO 와 동일한 `@IsString` / `@IsNotEmpty` / `@MaxLength` 조합 — 단 부재는 허용하되 명시 시 빈 string 거부). `CreateLlmProviderConfigDto` 패턴 mirror. 모든 필드 부재 (빈 body) 도 형식상 valid (service 가 no-op 또는 그대로 처리 — 아래 분기 참조).
- [ ] `LlmProviderConfigRepository` 에 `update(id, data)` 메서드 추가 — `this.prisma.llmProviderConfig.update({ where: { id }, data })` raw forward. 부재 id 의 Prisma `P2025` 는 catch 하지 않고 그대로 propagate (service 변환 책임 — `delete` 의 P2025 propagate 정책 정합). `data` 는 변경할 필드만 담는 partial shape (provider/endpointUrl/apiKey/modelId 부분 집합). repository 는 값 검증 0 (raw forward).
- [ ] `LlmProviderConfigService` 에 `update(id, dto)` 메서드 추가 — 처리 순서: (1) `dto.provider` 가 명시됐고 `isLlmProvider(dto.provider)` 가 false 면 `BadRequestException` (400, create 의 검증 mirror), (2) update 할 partial data 객체를 구성 — provider/endpointUrl/modelId 는 **명시된 것만** 포함 (부재 필드는 data 에서 omit → 미변경), (3) **apiKey 분기**: `dto.apiKey` 가 명시되면 `cipher.encrypt(dto.apiKey)` 로 새 ciphertext 를 만들어 data.apiKey 에 포함, 부재면 data 에 apiKey 키 자체를 넣지 않음 (기존 ciphertext 유지 — 재암호화 0 / read-back 0), (4) `repository.update(id, data)` 호출을 `try/catch` 로 감싸 Prisma `P2025` (부재 id) catch 시 `NotFoundException` (404) 변환 — 그 외 error 는 swallow 없이 propagate, encrypt throw (env 키 부재 등) 도 propagate, (5) 반환 row 를 기존 `sanitize` 로 redact 한 `LlmProviderConfigView` (apiKey 제외) 반환. `getPrismaErrorCode` duck-typing 패턴 재사용 (instanceof 회피).
- [ ] `LlmProviderConfigController` 에 `@Patch(":id")` 핸들러 추가 — `@Param("id") id: string` + `@Body() dto: UpdateLlmProviderConfigDto`, `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` (기존 GET/POST/DELETE 와 동일 tier). 200 OK + sanitize view 반환. service raw forward (controller 자체 분기 0 — service 가 4xx 변환).
- [ ] **Happy-path unit test**: (a) apiKey **부재** PATCH (endpointUrl 만 변경) → `service.update` 가 `encrypt` 를 **호출하지 않고** `repository.update` 의 data 에 apiKey 키가 **부재**함 + 반환 view 에 apiKey 없음 검증, (b) apiKey **명시** PATCH → `encrypt` 1회 호출 + `repository.update` data.apiKey 가 ciphertext (평문과 다른 값) + 반환 view 에 apiKey 없음 검증, (c) controller `@Patch(":id")` 가 `service.update` 로 id+dto forward + 200 검증.
- [ ] **Error path unit test**: (a) `repository.update` 가 P2025 reject (id 부재) → service 가 `NotFoundException` (404) 변환 검증, (b) `repository.update` 가 P2025 아닌 raw error (DB 장애) reject → service 가 변환 없이 그대로 propagate (404 로 잘못 변환 안 함) 검증, (c) `dto.provider` 명시했으나 `isLlmProvider` false → `BadRequestException` (400) 검증, (d) `encrypt` 가 throw (env 키 부재) → service 가 propagate 검증.
- [ ] **Flow / branch coverage**: service.update 의 분기 — apiKey 명시 (encrypt 경로) vs 부재 (기존 유지 경로) 각 1+ test, provider 명시-유효 / 명시-무효(400) / 부재(검증 skip) 각 1+ test, repository.update 성공 / P2025(404) / 그 외(raw propagate) 각 1+ test. partial data 구성 분기 — 각 필드 명시 vs 부재 조합 (최소 endpointUrl-only / apiKey-only / 빈 body) cover.
- [ ] **Negative cases 충분 cover**: 명시된 빈 apiKey / 빈 endpointUrl (`@IsNotEmpty` 400) / non-string 타입 (`@IsString` 400) / 정의되지 않은 extra body 키 (forbidNonWhitelisted 400) / 미지원 provider literal (service 400) / 부재 id (404) / 무관 Prisma code (예: P2003 → raw propagate, 404 변환 안 함) / code 필드 부재 plain Error (raw propagate) — 각 1+ test. RBAC negative (User actor 403 / 인증 부재 401) 는 기존 guard stack 이 cover 하므로 controller test 에서 guard 적용 사실만 확인 (기존 GET/POST/DELETE test 패턴 mirror).
- [ ] **never-read-back invariant regression**: (a) apiKey 부재 PATCH 경로에서 `cipher.decrypt` / `cipher.encrypt` 둘 다 호출되지 않음 (기존 ciphertext 를 read-back 하지 않음) 검증 1+, (b) 반환 `LlmProviderConfigView` 에 `apiKey` 필드가 없음 (타입 + 런타임) + 응답 직렬화 객체에 평문 apiKey 절대 부재 검증 1+ (ADR-0014 §3). patch task 가 아닌 신규 feature 이나 never-read-back 는 회귀 위험이 큰 invariant 라 명시 보호.
- [ ] 신규 DTO 의 colocated spec `src/llm/dto/update-llm-provider-config.dto.spec.ts` 작성 (`create-llm-provider-config.dto.spec.ts` 위치 mirror — optional 필드의 부재 허용 / 명시 시 빈값·wrong type 거부 case). service / controller / repository test 는 기존 colocated `src/llm/llm-provider-config.service.spec.ts` / `llm-provider-config.controller.spec.ts` / `llm-provider-config.repository.spec.ts` 에 case 추가 (신규 spec 파일은 DTO 1 개만).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- **api.md doc-sync** — chain 4/4 별도 **direct-mode** task (POST + DELETE + PATCH 종합 반영). 본 task 는 코드만 — `docs/architecture/api.md` 수정 금지.
- **apiKey 회전 / 일괄 재암호화 batch** — 본 task 는 단건 PATCH 의 apiKey 교체만 (명시 시 1 row 재암호화). key rotation 정책은 ADR-0014 §2 후속 KMS 전환 ADR.
- **LlmGateway 복호화 wire** (LLM 호출 직전 in-memory decrypt) — provider HTTP client (미승인 milestone-1) 의존. 본 task 는 encrypt 방향만 (decrypt 호출 0 — never-read-back).
- **DB schema migration** — 불요 (기존 `apiKey TEXT` 컬럼 reuse, `@unique` 부재로 P2002 분기 0). 새 컬럼 / 타입 변경 / batch re-encrypt 0. `prisma/migrations/*` 추가 금지.
- **PUT (전체 교체) semantics** — 본 task 는 PATCH (부분 갱신) 만. 모든 필드 필수의 전체 교체 endpoint 신설 금지.
- **provider 변경 시 endpoint/model 정합 재검증** (예: provider=custom 전환 시 3 슬롯 정책) — 본 task 는 각 필드 독립 갱신만, cross-field 일관성 검증 없음 (필요 시 별도 ADR/task).
- **DifficultyMapping 슬롯 영향** — PATCH 는 config 자체만 수정. 슬롯 재지정 / FK 영향 0 (DELETE 의 onDelete:Restrict 와 달리 update 는 FK 무관).
- 새 RBAC / auth-flow 정책 변경 0 — 기존 `JwtAuthGuard` / `RolesGuard` / `@Roles("Admin")` stack 적용만.
- `getPrismaErrorCode` helper 의 service 간 중복 외화 (shared util 추출) — 본 task 는 기존 service 내 helper mirror 우선, 신규 외화 금지 (Follow-ups 에 기록).
- 기존 stale 주석 ("ADR-0006 follow-up" 등) 의 대량 정정 — 본 task 가 직접 손대는 파일 내 1~2 줄만 정합, 별도 sweep 금지 (Follow-ups 에 기록).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(빈 상태로 생성 — sub-agent 가 관련 작업 발견 시 추가)
