---
id: T-2001
title: Add web↔backend contract drift guard spec for POST /api/llm/difficulty-mappings/seed
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-050, REQ-049]
estimatedDiff: 285
estimatedFiles: 1
created: 2026-09-09
independentStream: llm-difficulty
dependsOn: [T-1998, T-1999]
touchesFiles:
  - web/src/views/AdminView.difficulty-mapping-seed-contract.test.ts
plannerNote: "P6 · T-1999/T-2000 Follow-ups (a) 승계 — seed route 계약 drift guard. 선례 T-1902 실측 289 LOC 로 1 파일 cap 안."
---

# T-2001 — `AdminView.difficulty-mapping-seed-contract.test.ts` 계약 drift guard

## Why

T-1998 이 `POST /api/llm/difficulty-mappings/seed` 를 backend 에 박제하고 T-1999 가 그 web 소비처 (`runSeedSlots`) 를 배선했지만, 두 축을 **기계적으로 대조하는 guard 가 없다**. 이 route 는 같은 controller 의 `PATCH /:difficulty` 와 달리 **body 를 받지 않고** 정적 subPath `seed` 를 쓰므로, 한쪽만 바뀌면 (backend 가 `@Body` 를 도입하거나 web 이 `Content-Type` 을 붙이거나 path 가 `/:difficulty` 로 밀리면) unit test 는 전부 green 인 채 런타임 400/404 로만 드러난다. 같은 화면의 GET (T-1188) · PATCH (T-1877) · 기본 provider 재지정 (T-1902) 이 이미 동형 guard 를 갖고 있어 seed 만 빈칸이다. [PLAN.md](../PLAN.md) `182 행` 소비처 동반 의무 chain 의 마감 slice 이며, T-1999 · T-2000 두 task 의 `Follow-ups (a)` 를 승계한다.

**issue-still-relevant pre-check (origin/main `5275ed0f`)**: `git grep -l "difficulty-mappings/seed\|difficulty-mapping-seed" -- web/src test` 히트는 [test/e2e/difficulty-mappings.e2e-spec.ts](../../test/e2e/difficulty-mappings.e2e-spec.ts) · [AdminView.tsx](../../web/src/views/AdminView.tsx) · [adminLlmProviderMutationRunners.ts](../../web/src/views/adminLlmProviderMutationRunners.ts) 와 그 러너 spec **4 건뿐**이고, `web/src/views/AdminView.*contract*.test.ts` 22 개 중 `*seed*` 이름은 **0** — guard 미존재 확인. backend 축은 controller `116 행` `@Post("seed")` + `@HttpCode(200)`, web 축은 러너 `463 행` `runSeedSlots` 로 실재하므로 대조 대상 양쪽이 이미 머지돼 있다.

## Required Reading

- [web/src/views/AdminView.llm-provider-set-default-contract.test.ts](../../web/src/views/AdminView.llm-provider-set-default-contract.test.ts) — **최근접 선례 (T-1902, 289 LOC)**. 파일 구조 · 정적 추출 · `it.each` negative 표 밀도를 그대로 따른다.
- [web/src/views/AdminView.difficulty-mapping-assign-contract.test.ts](../../web/src/views/AdminView.difficulty-mapping-assign-contract.test.ts) `1~20 행` — 같은 controller (`api/llm/difficulty-mappings`) 축의 선례. 공용 추출기 import 목록과 inline 유지 대상의 경계가 여기 박제돼 있다.
- [web/src/views/__contract-guard__/contract-extractors.ts](../../web/src/views/__contract-guard__/contract-extractors.ts) — 공용 추출기 (`stripComments` / `extractControllerRoute` / `extractHandlerMethods` / `extractHandlerParams` / `normalizeRoute` / `composeRoute` / `pathSegments` / `stripQuery`).
- [web/src/views/adminLlmProviderMutationRunners.ts](../../web/src/views/adminLlmProviderMutationRunners.ts) `437~487 행` — `SeedSlotsDeps` (`437 행`) 와 `runSeedSlots` (`463 행`). 발사는 `post(\`${LLM_MAPPINGS_PATH}/seed\`, { method: 'POST' })` 한 줄이고 **body · 헤더가 없다**.
- [src/llm/difficulty-mapping.controller.ts](../../src/llm/difficulty-mapping.controller.ts) `63 행` (`@Controller("api/llm/difficulty-mappings")`) · `99~123 행` (`@Patch(":difficulty")` 와 `@Post("seed")` + `@HttpCode(200)`) — 대조 대상 backend 계약.
- [docs/architecture/api.md](../architecture/api.md) `139 행` — seed route 계약 정본 (body 없음 · 200 · `{ created, existing }` · Admin+).
- [web/src/views/adminLlmProviderMutationRunners.test.ts](../../web/src/views/adminLlmProviderMutationRunners.test.ts) `556 행` 이하 — T-1999 러너 블록. 기대값을 **한 줄도 바꾸지 않는다** (중복 검증이 아니라 축이 다르다: 저기는 state 전이, 여기는 계약 정합).

## Acceptance Criteria

- [ ] 신규 파일 `web/src/views/AdminView.difficulty-mapping-seed-contract.test.ts` **1 개만** 추가한다. 기존 파일은 한 줄도 수정하지 않는다 (production 변경 0, 공용 추출기 무수정, 배럴 무수정).
- [ ] backend 계약은 `readFileSync` 로 [src/llm/difficulty-mapping.controller.ts](../../src/llm/difficulty-mapping.controller.ts) 소스를 읽어 정적 추출한다 (선례와 동일 — 새 devDependency 0, backend 런타임 import 0).
- [ ] web 발사는 `./adminLlmProviderMutationRunners` 의 `runSeedSlots(deps)` 를 **직접 import** 해 mock `post` 로 1 회 발사하고, 그 path · method · body 유무 · 헤더 유무를 backend 계약과 대조한다.
- [ ] **happy-path** — 발사 결과가 `/api/llm/difficulty-mappings/seed` · `POST` · **body 부재** · **`Content-Type` 헤더 부재** 로 backend 계약과 완전 일치 (drift 0) 함을 단언한다 (happy 케이스 2+: 발사 인자 정합 1, 추출된 backend 계약 자체의 형태 1).
- [ ] **error path** — 추출기 무력화 방어: 추출된 controller base · `seed` handler method 가 `null` / 빈 문자열이 아님을 단언하고, 빈 소스 입력 시 추출기가 `null` / `{}` 를 돌려줘 대조가 "계약 추출 실패" 로 떨어짐을 단언한다 (guard 가 조용히 통과하지 않음).
- [ ] **분기 cover** — 최소 다음 4 축 각각 1+ 케이스: (1) `api/llm/difficulty-mappings` 3-세그먼트 base 정규화, (2) `@Post("seed")` 의 정적 subPath 합성 결과가 `/api/llm/difficulty-mappings/seed` 이고 **path param 이 정확히 0 개** (`encodeURIComponent` 대상 없음 — `assign` 축과의 결정적 차이), (3) `seed` 핸들러의 `@Body` decorator **부재** 판정 (대조군 — 같은 소스의 `assign` 핸들러는 `@Body` **존재**), (4) POST subPath 유일성 — 소스의 POST 핸들러가 `seed` 하나뿐이고 **path param POST (`@Post(":difficulty")` 류) 가 0 개** 임을 단언한다 (생기면 `seed` 가 `:difficulty = "seed"` 로 오매칭될 회귀).
- [ ] **negative case 를 예외 분기마다 1+** — 최소 다음을 `it.each` 표로 압축해 cover: (a) backend base 오타 (`api/llm/difficulty-mapping`) → path 불일치, (b) `@Post("seed")` 를 `@Post(":difficulty")` 로 드리프트 → path 불일치, (c) bare `@Post()` (세그먼트 0) → path 불일치, (d) method 를 `@Patch` / `@Put` 으로 드리프트 → method 불일치, (e) backend 가 `@Body` 를 도입했는데 web 은 body 미발사 → body 정합 위반, (f) web 이 body 를 실음 (`forbidNonWhitelisted` 400 예방) → body 부재 계약 위반, (g) web 이 `Content-Type` 헤더를 붙임 → 헤더 부재 계약 위반, (h) 주석 줄의 `@Post("seed")` / `@Controller(...)` 를 실 decorator 로 오인하지 않음 (false-positive 방어 — 본 controller 는 `1~60 행` 이 전부 주석이라 이 축이 특히 중요하다).
- [ ] 각 단언 블록의 목적을 한국어 주석 한 줄로 남긴다 (선례 파일과 같은 밀도 — 왜 이 축이 회귀를 잡는지).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과 (root). `web` workspace test (`pnpm --dir web test`, vitest) 도 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] 기존 spec 무수정 green — 특히 [adminLlmProviderMutationRunners.test.ts](../../web/src/views/adminLlmProviderMutationRunners.test.ts) `556 행` 이하 T-1999 블록과 [DifficultyModelSelector.test.tsx](../../web/src/components/DifficultyModelSelector.test.tsx) 의 T-2000 안내 문구 블록 기대값을 한 줄도 바꾸지 않는다.
- [ ] 최종 diff 가 §3 cap (≤ 300 LOC · ≤ 5 파일) 안에 든다 — 초과가 예상되면 negative 축을 `it.each` 표로 더 압축하고 (케이스 삭제 금지) 그래도 넘치면 진행을 멈추고 `task-too-large` 로 escalate 한다.

## Out of Scope

- production 코드 변경 일체 — `web/src/views/AdminView.tsx` · `adminLlmProviderMutationRunners.ts` · `useAdminLlmProviders.ts` · `web/src/components/DifficultyModelSelector.tsx` · `src/llm/**` 는 **read-only 대조 대상**이다.
- 공용 추출기 [contract-extractors.ts](../../web/src/views/__contract-guard__/contract-extractors.ts) 에 새 helper 추가 · 기존 helper 시그니처 변경 (필요한 richer 추출기는 본 spec 파일 안 inline — 선례 규약).
- `src/` 신규 route 추가 0 — 따라서 [route-e2e-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts) allowlist 와 e2e 동반 의무는 비발생 (T-1998 을 BLOCKED 시킨 축).
- jsdom 기반 버튼 클릭 → POST 발사 검증 (T-1999 러너 · 배선 spec 이 이미 cover).
- seed 응답 `{ created, existing }` 카운트의 UI 표시 (T-2000 `Follow-ups (b)`).
- T-2000 안내 문구의 렌더 위치 (폼 위/아래) 재조정 — 기존 순서 단언과 함께 다루는 별도 slice.
- `docs/api.md` · `docs/requirements.md` REQ-049/050 재판정 (PLAN `183 행` — 구현 후 1 회 규칙, T-1962 · T-1971 이 소진).
- AdminView god component 추출 리팩터 (PLAN `184 행` 부채).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — 작업 중 발견한 인접 작업을 여기 적는다.)
