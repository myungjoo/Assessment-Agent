---
id: T-1902
title: Web UI — 기본 provider 재지정 web↔backend 계약 drift guard spec (쓰기 축 B4)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-049, REQ-051]
independentStream: llm-default-provider
dependsOn: [T-1865, T-1898, T-1901]
touchesFiles:
  - web/src/views/AdminView.llm-provider-set-default-contract.test.ts
estimatedDiff: 280
estimatedFiles: 1
created: 2026-09-05
plannerNote: "PLAN 107 행 chain 5/7 — 쓰기 축 B4(test-only 계약 drift guard). 선례 실측 271~291 LOC 로 1 파일 cap 안."
---

# T-1902 — `AdminView.llm-provider-set-default-contract.test.ts` 계약 drift guard (쓰기 축 B4)

## Why

[PLAN.md](../PLAN.md) `107 행` 오너 지시 chain (2026-09-03) 의 5/7 인 [T-1866](T-1866-web-llm-default-provider-select-ui.md) 은 파일 cap 초과로 SUPERSEDED 됐고, 쓰기 축 B 는 B1 (hook 핸들러, [T-1899](T-1899-web-llm-set-default-provider-hook-handler.md)) · B2 (버튼, [T-1900](T-1900-web-llm-provider-list-set-default-button.md)) · B3 (AdminView 배선, [T-1901](T-1901-adminview-wire-set-default-provider.md)) · **B4 (본 slice)** 로 쪼개졌다. B1~B3 이 모두 머지돼 화면에 지정 진입점이 실제로 마운트됐지만, `PUT /api/llm/providers/default` 의 **web 발사 ↔ backend 라우트 계약** 을 기계적으로 대조하는 guard 가 없다. 기존 LLM provider CRUD 4 종은 모두 contract guard spec 을 갖고 있으므로 (create · update · delete · list), 본 slice 가 다섯 번째 mutation 에 같은 안전망을 붙여 chain 의 web 축을 닫는다.

**issue-still-relevant pre-check (origin/main `99244787` 기준 실측, 2026-09-05)**:

- `git ls-tree origin/main --name-only web/src/views/ | grep contract` → `AdminView.llm-provider-{create,update,delete,list}-contract.test.ts` 4 종은 존재하나 **`AdminView.llm-provider-set-default-contract.test.ts` 는 부재**. 본 task 의 산출물이 main 에 아직 없다.
- `git grep -n "runSetDefaultProvider" origin/main -- web/src` → [adminLlmProviderMutationRunners.ts](../../web/src/views/adminLlmProviderMutationRunners.ts) (러너 정본) · 그 colocated spec · [useAdminLlmProviders.ts](../../web/src/views/useAdminLlmProviders.ts) (+ spec) · [AdminView.test.tsx](../../web/src/views/AdminView.test.tsx) 주석만 히트 — **대조 spec 히트 0**.
- `git grep -n "runSetDefaultProvider\|runDeleteProvider" origin/main -- web/src/views/AdminView.tsx` → `runDeleteProvider` 만 `306 행` · `1912 행` 에서 re-export 되고 **`runSetDefaultProvider` 는 AdminView 배럴에 없다** — 본 spec 은 `./adminLlmProviderMutationRunners` 를 직접 import 한다 (배럴 수정 불요, T-1901 §Follow-ups 판정과 일치).
- backend 쪽은 `git grep -n '@Put("default")' origin/main -- src/llm` → [llm-provider-config.controller.ts](../../src/llm/llm-provider-config.controller.ts) `123 행` 박제 확인. 대조 대상이 실재한다.
- 결론: 부분 안착 (러너 · hook · 컴포넌트 · 배선 = 머지, drift guard = 미박제). 본 task 는 잔여 중 **guard spec 만** 책임진다.

**cap 판정** — 동형 선례 실측은 [llm-provider-delete-contract](../../web/src/views/AdminView.llm-provider-delete-contract.test.ts) 271 행 · [llm-provider-create-contract](../../web/src/views/AdminView.llm-provider-create-contract.test.ts) 291 행 · [difficulty-mapping-assign-contract](../../web/src/views/AdminView.difficulty-mapping-assign-contract.test.ts) 290 행 이다. 본 slice 는 신규 1 파일 · 약 280 LOC 로 §3 cap (≤ 300 LOC · ≤ 5 파일) 안에 들어간다. 기존 소스는 한 줄도 수정하지 않는다 (test-only). production 변경 0 이지만 `commitMode` 는 `pr` — `web/` 아래 파일이므로 §3.1 표 그대로다.

## Required Reading

- [web/src/views/AdminView.llm-provider-delete-contract.test.ts](../../web/src/views/AdminView.llm-provider-delete-contract.test.ts) `1 행 ~ 14 행` (파일 상단 import 규약 — `readFileSync` 로 backend 소스를 읽고 공용 추출기 중 **글자-동일한 것만** 선별 import 하는 T-1224 이관 판정), `150 행 ~ 271 행` (describe 골격 — 추출 실패 방어 → base 3-세그먼트 정규화 → path 합성 → `@Body` 판정 → happy 발사 대조 → negative `it.each` path/method/body drift 표). **본 slice 가 1:1 mirror 할 형식 원본**.
- [web/src/views/AdminView.llm-provider-create-contract.test.ts](../../web/src/views/AdminView.llm-provider-create-contract.test.ts) — bare 세그먼트 + `@Body` **존재** 축 선례 (delete 는 `:id` param + body 부재 축이라, 본 slice 의 "정적 세그먼트 + body 존재" 조합은 이 파일 쪽이 가깝다).
- [web/src/views/__contract-guard__/contract-extractors.ts](../../web/src/views/__contract-guard__/contract-extractors.ts) `10 행 ~ 85 행` (공용 추출기 8 종의 export 표면 — `stripComments` · `extractControllerRoute` · `extractHandlerMethods` · `extractHandlerParams` · `normalizeRoute` · `composeRoute` · `pathSegments` · `stripQuery`. 공용과 의미가 다른 richer 추출기만 파일 안 inline 유지).
- [src/llm/llm-provider-config.controller.ts](../../src/llm/llm-provider-config.controller.ts) `77 행 ~ 84 행` (`@Controller("api/llm/providers")` 3-세그먼트 base + controller-scope `ValidationPipe` 의 `whitelist` / `forbidNonWhitelisted` / `transform`), `108 행 ~ 131 행` (`@Put("default")` + `@HttpCode(200)` + `@Body() SetDefaultLlmProviderDto` + 라우트 순서 고정 주석), `95 행` · `141 행` · `159 행` · `180 행` · `199 행` (`@Get()` · `@Get(":id")` · `@Post()` · `@Patch(":id")` · `@Delete(":id")` 선언 위치 — **순서 대조의 기준 좌표**).
- [src/llm/dto/set-default-llm-provider.dto.ts](../../src/llm/dto/set-default-llm-provider.dto.ts) `14 행 ~ 25 행` (단일 필드 `llmProviderConfigId` + `@IsString` / `@IsNotEmpty` / `@MaxLength(255)` — body 키가 정확히 1 개여야 하는 근거).
- [web/src/views/adminLlmProviderMutationRunners.ts](../../web/src/views/adminLlmProviderMutationRunners.ts) `39 행` (`LLM_PROVIDERS_PATH` 상수), `303 행 ~ 318 행` (`SetDefaultProviderDeps` 6 키 — 주입할 mock 표면), `334 행 ~ 375 행` (`runSetDefaultProvider(id, deps)` 의 실 발사 — 정적 path · `PUT` · `Content-Type: application/json` · 단일 키 JSON body · path param 0).
- [docs/tasks/T-1901-adminview-wire-set-default-provider.md](T-1901-adminview-wire-set-default-provider.md) §Follow-ups 의 **B4** 항목 (본 slice 의 원본 범위 · 특화 축 4 종 정의).

## Acceptance Criteria

- [ ] 신규 파일 `web/src/views/AdminView.llm-provider-set-default-contract.test.ts` 1 개만 추가한다. **기존 파일은 한 줄도 수정하지 않는다** (production 변경 0, 배럴 수정 0).
- [ ] backend 계약은 `readFileSync` 로 [src/llm/llm-provider-config.controller.ts](../../src/llm/llm-provider-config.controller.ts) 소스를 읽어 추출한다 (선례와 동일한 정적 대조 — 새 devDependency 0, backend 런타임 import 0).
- [ ] web 발사는 `./adminLlmProviderMutationRunners` 의 `runSetDefaultProvider(id, deps)` 를 **직접 import** 해 mock `update` 로 1 회 발사하고, 그 path · method · body 키 집합 · `Content-Type` 유무를 backend 계약과 대조한다 (`./AdminView` 배럴 경로 금지 — 해당 심볼은 re-export 되지 않는다).
- [ ] **happy-path** — 발사 결과가 `/api/llm/providers/default` · `PUT` · body 키 `{ llmProviderConfigId }` · `Content-Type: application/json` 으로 backend 계약과 완전 일치 (drift 0) 함을 단언한다.
- [ ] **error path** — 추출기 무력화 방어: `ROUTE` · method 추출이 `null` / 빈 문자열이 아님을 단언하고, 빈 소스 입력 시 추출기가 `null` / `{}` 를 돌려줘 대조가 "계약 추출 실패" 로 떨어짐을 단언한다.
- [ ] **분기 cover** — 최소 다음 4 축 각각 1+ 케이스: (1) `api/llm/providers` 3-세그먼트 base 정규화, (2) `@Put("default")` 의 정적 subPath 합성 결과가 `/api/llm/providers/default` 이고 **path param 이 정확히 0 개** (encodeURIComponent 대상 없음), (3) backend `setDefault` 핸들러의 `@Body` decorator **존재** 판정 (대조군 — 같은 소스의 `delete` 핸들러는 `@Body` 부재), (4) **라우트 선언 순서** — 소스에서 `@Put("default")` 의 위치가 `@Get(":id")` · `@Patch(":id")` · `@Delete(":id")` 어느 것보다도 **앞** 임을 단언 (뒤로 밀리면 `:id = "default"` 오매칭 회귀).
- [ ] **negative case 를 예외 분기마다 1+** — 최소 다음을 `it.each` 표로 압축해 cover: (a) backend base 오타 (`api/llm/provider`) → path 불일치, (b) `@Put("default")` 를 `@Put(":id")` 로 드리프트 → path 불일치, (c) bare `@Put()` (세그먼트 0) → path 불일치, (d) method 를 `@Patch` / `@Post` 로 드리프트 → method 불일치, (e) backend 가 `@Body` 를 제거했는데 web 은 body 발사 → body 정합 위반, (f) web 이 body 에 초과 키를 실음 (`forbidNonWhitelisted` 400 예방) → 키 집합 불일치, (g) web 이 `Content-Type` 헤더를 빠뜨림 → 헤더 부재 위반, (h) 주석 줄의 `@Put("default")` / `@Controller(...)` 를 실 decorator 로 오인하지 않음 (false-positive 방어).
- [ ] 각 단언 블록의 목적을 한국어 주석 한 줄로 남긴다 (선례 파일과 같은 밀도 — 왜 이 축이 회귀를 잡는지).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과 (root). `web` workspace test (`vitest`) 도 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] 기존 spec 무수정 green — 특히 [adminLlmProviderMutationRunners.test.ts](../../web/src/views/adminLlmProviderMutationRunners.test.ts) `324 행` 이하 T-1898 블록과 [AdminView.test.tsx](../../web/src/views/AdminView.test.tsx) 의 T-1901 배선 블록 기대값을 한 줄도 바꾸지 않는다.
- [ ] 최종 diff 가 §3 cap (≤ 300 LOC · ≤ 5 파일) 안에 든다 — 초과가 예상되면 negative 축을 `it.each` 표로 더 압축하고 (케이스 삭제 금지) 그래도 넘치면 진행을 멈추고 `task-too-large` 로 escalate 한다.

## Out of Scope

- production 코드 변경 일체 — `web/src/views/AdminView.tsx` · `useAdminLlmProviders.ts` · `adminLlmProviderMutationRunners.ts` · `LlmProviderConfigList.tsx` · `src/llm/**` 는 read-only 대조 대상이다.
- 공용 추출기 [contract-extractors.ts](../../web/src/views/__contract-guard__/contract-extractors.ts) 에 새 helper 추가 · 기존 helper 시그니처 변경 (필요한 richer 추출기는 본 spec 파일 안 inline 으로 둔다 — 선례 규약).
- `AdminView` 배럴에 `runSetDefaultProvider` re-export 추가.
- jsdom 기반 클릭 → PUT 발사 검증 (컴포넌트 · 러너 단위 spec 이 이미 cover).
- e2e (`test/e2e/**`) · `docs/api.md` 갱신.
- seed no-override ([T-1867](T-1867-seed-llm-config-default-no-override.md)) · doc-sync ([T-1868](T-1868-llm-default-provider-doc-sync-req-plan-adr.md)).
- AdminView god component 추출 리팩터 (PLAN `183 행` 부채).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- chain 잔여: [T-1867](T-1867-seed-llm-config-default-no-override.md) (seed no-override — T-1863 뒤 병렬 가능) → [T-1868](T-1868-llm-default-provider-doc-sync-req-plan-adr.md) (direct doc-sync, PLAN `107 행` bullet 닫기 + T-1865 reviewer MINOR `modules.md` LlmModule 행 문구 흡수).
