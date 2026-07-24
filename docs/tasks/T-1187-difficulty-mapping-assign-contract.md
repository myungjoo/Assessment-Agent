---
id: T-1187
title: 난이도-모델 매핑 지정 endpoint web↔backend 계약 drift-guard spec 추가
phase: P6
status: DONE
mergedAs: 1783b33d
prNumber: 1079
reviewRounds: 2
commitMode: pr
coversReq: [REQ-049, REQ-050, REQ-096, REQ-097]
estimatedDiff: 240
estimatedFiles: 1
created: 2026-07-24
independentStream: web-contract-guard
dependsOn: []
touchesFiles: [web/src/views/AdminView.difficulty-mapping-assign-contract.test.ts]
plannerNote: "P6 contract-guard arc 다음 slice — 난이도-모델 매핑 지정(PATCH /api/llm/difficulty-mappings/:difficulty). LLM CRUD arc 완결 후 DifficultyModelSelector mutation 확산 첫 대상."
---

# T-1187 — 난이도-모델 매핑 지정 endpoint web↔backend 계약 drift-guard spec 추가

## Why

T-1184~T-1186 이 LLM provider CRUD (POST/PATCH/DELETE) 계약 drift-guard arc 를 완결했다. 그 직후 자연스러운 확산 대상은 **DifficultyModelSelector 의 난이도-모델 매핑 지정 mutation** 이다 (PLAN P6 ④ Admin 패널에 mount 됨). web `runAssign(difficulty, providerId, deps)` 발사가 backend `DifficultyMappingController.assign` (`@Patch(":difficulty")` + `@HttpCode(200)`, `PATCH /api/llm/difficulty-mappings/:difficulty`, body `{ llmProviderConfigId }`) 계약과 drift 없이 일치함을 test-only 로 고정한다. 본 slice 는 3-세그먼트 base `api/llm/difficulty-mappings` + **`:difficulty` semantic path param** (기존 `:id` 와 다른 축) + **단일 required body 필드 `llmProviderConfigId`** + **200 with-body** (기존 DELETE 의 body-less 204 와 대비) 라는 새 대조 축을 커버한다 (REQ-097 3 난이도 모델 할당 / REQ-049·050 난이도↔model 매핑 / REQ-096 Admin 가시성, ADR-0011 §2).

## Required Reading

- `web/src/views/AdminView.llm-provider-update-contract.test.ts` — **1차 패턴 선례** (T-1185). 3-세그먼트 base (`api/llm/providers`) + `@Patch(":id")` path param 합성 + PATCH body/Content-Type 존재 + 추출기/대조기/negative(a~h) 구조를 그대로 차용. 본 task 는 base 를 `api/llm/difficulty-mappings` 로, path param 을 `:difficulty` 로, body 를 단일 required `llmProviderConfigId` 로 바꾼 mirror.
- `web/src/views/AdminView.person-update-contract.test.ts` — **2차 패턴 선례** (T-1179). required 필드 부분집합 대조 축 참고.
- `web/src/views/AdminView.tsx` — `runAssign` (L795~) + `AssignDeps` interface. 둘 다 파일 하단에서 export 됨 (L4765 `runAssign`, `AssignDeps` export). 발사: `deps.patch(\`${LLM_MAPPINGS_PATH}/${difficulty}\`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ llmProviderConfigId: providerId }) })`. `LLM_MAPPINGS_PATH = '/api/llm/difficulty-mappings'` (L170). 빈/falsy `providerId` 미발사, `assigning` 가드로 이중 PATCH 차단. `Difficulty` 타입은 `'easy' | 'medium' | 'hard'` (web/src/components/DifficultyModelSelector.tsx).
- `src/llm/difficulty-mapping.controller.ts` — 대조 대상 backend. `@Controller("api/llm/difficulty-mappings")` (L58), `@Patch(":difficulty")` + `@HttpCode(200)` + 핸들러 `assign(@Param("difficulty") difficulty: string, @Body() dto: AssignDifficultyMappingDto)` (L92~99). 같은 소스의 `findAll` 핸들러는 `@Get()` + `@Body` 부재 (대조군).
- `src/llm/dto/assign-difficulty-mapping.dto.ts` — `AssignDifficultyMappingDto` — 단일 required 필드 `llmProviderConfigId` (`@IsString @IsNotEmpty @MaxLength(255)`, `@IsOptional` 없음). web body 가 이 required 필드를 정확히 채우는지 대조.

## Acceptance Criteria

신규 파일 `web/src/views/AdminView.difficulty-mapping-assign-contract.test.ts` **1개만** 추가. 실 controller 소스 (`difficulty-mapping.controller.ts`) 를 `readFileSync` 로 라이브 로드하고, `runAssign('easy', 'lp-1', deps)` 를 mock deps 로 직접 호출해 실 발사 인자를 캡처 (ADR-0040 §5 — RTL/jsdom 없음). 아래 R-112 4종 + negative a~h 를 모두 cover.

- [ ] **happy-path**: `runAssign('easy', 'lp-1', deps)` 발사가 `/api/llm/difficulty-mappings/easy` + PATCH method 로 backend `assign` 계약과 완전 일치 (`diffContract` 가 `[]`).
- [ ] **happy-path (body/헤더 정합)**: PATCH 발사 init 이 `Content-Type: application/json` 헤더 + body `{ llmProviderConfigId: 'lp-1' }` 를 담고, 그 body 의 키 집합이 backend `AssignDifficultyMappingDto` 의 required 집합(`llmProviderConfigId` 정확히 1개)과 일치.
- [ ] **error path (추출기 무력화 방어)**: `ROUTE`/`method`/`subPath` 추출이 하나도 비어있지 않음 검증. 추출 실패 시 통과가 아니라 `'backend 계약 추출 실패'` 사유 1건 반환 (빈 소스 입력 시 대조가 통과하지 않음).
- [ ] **분기 — base 파싱**: `@Controller("api/llm/difficulty-mappings")` 를 `/api/llm/difficulty-mappings` 로 정규화.
- [ ] **분기 — :difficulty 합성**: `@Patch(":difficulty")` 세그먼트를 base 와 합성해 `/api/llm/difficulty-mappings/:difficulty` template, path param 정확히 1개(`:difficulty`) 검증. `expectedPath` 가 `/api/llm/difficulty-mappings/easy`.
- [ ] **분기 — @Body 존재 + required subset**: `assign` 핸들러가 body 를 가짐(`hasBody === true`) + DTO required 필드 집합 추출이 `{ llmProviderConfigId }`. web body 키 ⊆ backend allow-set 이고 required 를 빠짐없이 채움.
- [ ] **분기 — @Body 부재 대조군**: 같은 소스의 `findAll` 핸들러는 body-less (`hasBody === false`) — 추출기가 실제로 body 유무를 구분함 입증.
- [ ] **분기 — difficulty 인코딩**: 비정상 문자 difficulty 값 (예: `'ea sy/x?a'`) 이 `encodeURIComponent` 로 안전 인코딩돼 path 가 안 깨짐 (runAssign 이 `${difficulty}` 를 그대로 삽입하므로 인코딩 정합 확인 — 미인코딩 시 negative g 로 catch).
- [ ] **negative (a) base 오타**: backend base 를 `api/llm/difficulty-mapping`(단수 오타) / `api/llm/difficulty-mappings-x` 로 바꾸면 path 불일치로 잡힘 (404 예방).
- [ ] **negative (b) 세그먼트 추가**: `@Patch(":difficulty/reset")` (param 2) 로 drift 시 path 불일치.
- [ ] **negative (c) bare 세그먼트 0**: `@Patch()` (세그먼트 0) 로 drift 시 path 불일치.
- [ ] **negative (d) method drift**: backend 가 `@Put`/`@Post` 로 바뀌었는데 web 은 PATCH 발사 → method 불일치.
- [ ] **negative (e) required 필드 drift**: backend DTO 가 `llmProviderConfigId` → `providerConfigId` 로 rename 됐는데 web 은 `llmProviderConfigId` 발사 → required subset 위반으로 잡힘.
- [ ] **negative (f) 초과/누락 body 필드**: web 이 required `llmProviderConfigId` 를 누락하거나 allow-set 밖 키를 붙이면 subset 대조 fail (400/whitelist reject 예방).
- [ ] **negative (g) encode 누락**: web 이 difficulty 를 `encodeURIComponent` 없이 raw 삽입하면 비정상 문자 케이스에서 path 불일치.
- [ ] **negative (h) 주석 false-positive**: 주석 줄의 `@Patch(":difficulty")`/`@Controller(...)` 를 실 decorator 로 오인하지 않음 (`stripComments` 방어).
- [ ] **negative (소스 유실)**: 빈 소스 입력 시 추출기가 null/`{}` 반환하고 대조가 통과하지 않음.
- [ ] `pnpm --dir web test` (또는 web workspace vitest) 실측 통과 확인 — 위 모든 케이스 green. base/decorator 변조 → fail → revert 로 guard 유효성 실증.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). test-only 파일이라 커버리지 회귀 없음 확인.
- [ ] size gate: diff ≤ 300 LOC, 변경 파일 정확히 1개.

## Out of Scope

- production 코드 (`AdminView.tsx`, `difficulty-mapping.controller.ts`, `assign-difficulty-mapping.dto.ts`) 및 기존 guard 파일 수정 **금지** — 신규 test 파일 1개만 추가.
- 신규 devDependency 추가 금지 (정규식 추출기만 — 기존 vitest 사용).
- 난이도-모델 매핑 **조회(GET)** 계약 guard 는 본 task 범위 아님 (별도 slice — 필요 시 Follow-up).
- export/import (`runExport`/`runImport`) · schedule (`runTrigger`) · reevaluate (`runReEvaluate`) 계약 guard 는 본 task 범위 아님. 특히 SchedulePanel/ReEvaluationTriggerPanel 은 PLAN P6 상 backend-contract 미shipped 로 defer 상태 — 계약 guard 대상 아님.
- **shared-helper 추출 refactor 는 여전히 Out of Scope** — `stripComments`/`extractControllerRoute`/`extractHandlerMethods`/`composeRoute`/`diffContract` 등이 18+ contract-guard test 파일에 중복됐지만, 공용 helper 추출은 별도 refactor slice (아래 Follow-up 후보 유지).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (carry-forward) contract-guard test 18+ 파일이 공유하는 정규식 추출기/대조기 (`stripComments`, `extractControllerRoute`, `extractHandlerMethods`, `composeRoute`, `diffContract`, `toFire`) 를 `web/src/views/__contract-guard__/` 공용 helper 로 추출하는 refactor slice — 중복 제거 + 단일 유지보수 지점. AdminView 주요 mutation 계약 guard 가 거의 완결된 시점이라 추출 ROI 재평가 적기. helper 추출 자체가 다수 파일을 건드려 5-파일 cap 을 넘으므로 planner 가 split 필요.
