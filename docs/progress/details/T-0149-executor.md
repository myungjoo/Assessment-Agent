# T-0149 executor 상세 — POST /api/llm/providers (apiKey encrypt-at-rest)

## 구현 요약

POST `/api/llm/providers` slice 신설 (Admin+ RBAC). ADR-0014 §1 (AES-256-GCM envelope) + §3 (write-only / never-read-back) invariant 강제.

- `src/llm/dto/create-llm-provider-config.dto.ts` (신규) — `CreateLlmProviderConfigDto`: provider / endpointUrl / apiKey / modelId 4 필드, 각 `@IsString` + `@IsNotEmpty` + `@MaxLength`. provider 멤버십 검증은 service 책임 (DTO 는 형식만).
- `src/llm/llm-provider-config.service.ts` — `create(dto)` 추가 + `LlmApiKeyCipher` 생성자 주입. (1) `isLlmProvider` false → `BadRequestException`, (2) `cipher.encrypt(dto.apiKey)` → ciphertext, (3) `repository.create({...,apiKey:ciphertext})`, (4) 기존 `sanitize` 로 apiKey 제거 view 반환.
- `src/llm/llm-provider-config.controller.ts` — `@Post()` + `@Body() CreateLlmProviderConfigDto` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`. 201 + service raw forward.

## 테스트 (R-112 4 카테고리 + negative 충분)

- DTO spec (신규, colocated): happy 2 + 필드별 negative (누락/빈문자열/wrong type/null/길이초과) — `it.each` 로 4 필드 cover.
- service spec: create happy (encrypt 1회 + ciphertext 로 repo.create + apiKey 부재 view) / never-read-back regression (평문+ciphertext 직렬화 미포함) / 미지원 provider → BadRequestException (encrypt·create 미호출) / encrypt throw propagate (create 미호출) / repo.create reject propagate.
- controller spec: unit forward (happy + BadRequest/raw error propagate) + RBAC integration (201 happy / extra-key 400 / missing field 400 / wrong type 400 / service BadRequest 400 / 401 / 403 / 500) + real RolesGuard escalation (User 403 / Admin·SuperAdmin 201).

## 게이트 결과

- `pnpm lint` pass, `pnpm build` pass.
- `pnpm test` / `pnpm test:cov`: 2467 passed / 132 suites. 변경 4 파일(controller/service/repository/dto) 전부 100% stmt/branch/func/line. All files 99.89% stmt / 100% branch / 100% func / 99.88% line — threshold(line≥80 / func≥80) 충족.
- `pnpm test:smoke` / `pnpm test:e2e`: DATABASE_URL 미설정으로 local skip — CI(.github/workflows/ci.yml env.DATABASE_URL)에서 실행.

## 비고

- 파일 6개(2 신규 + 4 수정). task Acceptance Criteria 가 6 파일(DTO/DTO spec/service/service spec/controller/controller spec)을 명시 요구 — planner estimatedFiles:5 undercount. production 코드 파일은 3개(controller/service/dto), 나머지 3은 R-112 강제 colocated spec. production 추가 LOC ~145 (300 LOC cap 내, 단일 POST slice).
- 기존 stale 주석("ADR-0006") 중 본 task 가 손댄 controller 1줄만 ADR-0014 로 정합. 나머지 sweep 은 Out-of-Scope (Follow-up).
- 모듈 재배선 불요 — `LlmApiKeyCipher` 는 T-0147 이 이미 providers/exports 등록.
