---
id: T-1999
title: Wire difficulty slot seed endpoint into AdminView (POST /api/llm/difficulty-mappings/seed consumer)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-050, REQ-049]
estimatedDiff: 285
estimatedFiles: 4
estimatedLoc: 285
created: 2026-09-09
independentStream: llm-difficulty
dependsOn: [T-1998]
touchesFiles:
  - web/src/views/adminLlmProviderMutationRunners.ts
  - web/src/views/adminLlmProviderMutationRunners.test.ts
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
plannerNote: P6 · PLAN 182 행 소비처 동반 의무 — T-1998 seed route 의 web 소비처 0 을 AdminView 버튼으로 메움
---

# T-1999 — 난이도 슬롯 seed endpoint 의 AdminView 소비처 배선

## Why

직전 fire 의 [T-1998](T-1998-difficulty-slot-seed-endpoint.md) (PR #1567 · main `c8c7c5cc`) 이 Admin 전용 멱등 route `POST /api/llm/difficulty-mappings/seed` 를 backend 에 박제했지만 **이를 호출하는 UI 경로가 0** 이라, 운영 DB 에서 Admin 이 난이도별 model 을 지정하려면 여전히 손으로 curl 을 쏘아야 한다 (`PATCH /:difficulty` 는 upsert 가 아니라 슬롯 row 부재 시 404). 오너 지시 [PLAN.md](../PLAN.md) `182 행` 의 **소비처 동반 의무** 가 겨냥하는 바로 그 상태 — backend slice 만 서 있고 기능이 사용자에게 닿지 않는다 — 를 한 slice 로 닫는다.

**issue-still-relevant pre-check (origin/main `84598e28`, 실측)**:

- `git grep -n "difficulty-mappings/seed\|runSeed\|seedSlots\|SeedDeps" origin/main -- web/src` → 히트 **0**. web 쪽에는 seed 를 발사하는 코드도, deps 타입도, 경로 문자열도 없다 (미해소 확인).
- backend 축은 실재한다 — [difficulty-mapping.controller.ts](../../src/llm/difficulty-mapping.controller.ts) `116 행` `@Post("seed")` · `120 행` `async seed()`, [difficulty-mapping.service.ts](../../src/llm/difficulty-mapping.service.ts) `203 행` `seedDifficultySlots()`, 계약 정본 [api.md](../architecture/api.md) `139 행`, e2e 왕복 [test/e2e/difficulty-mappings.e2e-spec.ts](../../test/e2e/difficulty-mappings.e2e-spec.ts).
- 따라서 잔여는 **web 소비처 하나뿐** 이고, 본 task 는 신규 HTTP route 를 **0 개** 추가한다 → [route-e2e-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts) 의 allowlist `[]` 단언에 저촉되지 않는다 (T-1998 이 BLOCKED 를 한 번 먹은 함정이라 명시 박제 — 본 slice 는 `src/` diff 0).

**오너 지시 대조 (직접 확인)**: `157 행` R-91 최우선 chain 의 잔여 ② 실 scale 부하는 credential · 사람 승인 게이트라 자율 집행분 0 (T-1706 판정 승계), `158 행` 신규 per-route perf baseline slice 금지는 본 task 가 `test/perf/` 를 전혀 건드리지 않아 무저촉, `184 행` AdminView god component 목표선 `≤ 2,000 줄` 은 현재 `1,958 줄` 이라 본 slice 의 AdminView 증분을 **≤ 40 줄** 로 묶어 목표선을 지킨다 (아래 AC 에 검증 명령 박제).

estimate: base 190 × 1.5 (R-112 4-카테고리 cover backbone — 러너 + deps 타입 + 소비처 배선 + spec 동시) = **285 LOC / 4 파일** 로 §3 cap 안 (`sizeExempt` 불요).

## Required Reading

- [web/src/views/adminLlmProviderMutationRunners.ts](../../web/src/views/adminLlmProviderMutationRunners.ts) — `LLM_MAPPINGS_PATH` 상수 정의부와 `AssignDeps` / `runAssign` (파일 하단) 이 본 slice 가 1:1 mirror 할 러너 shape (in-flight 가드 → setError(undefined) → 발사 → 성공 시 `bumpRefresh()` → 실패 시 `describeError` → `finally` 해제).
- [web/src/views/adminLlmProviderMutationRunners.test.ts](../../web/src/views/adminLlmProviderMutationRunners.test.ts) — 기존 551 줄, deps mock 조립 convention (발사 primitive · `describeError` · setter 를 전부 주입).
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `300~325 행` (러너 모듈 import 블록) · `854 행` 부근 (`handleAssign` 조립) · `1073~1080 행` (`<DifficultyModelSelector ... onAssign={handleAssign} />` 마운트 지점, Admin+ gating `isAdmin ?` 블록 안) · `1822~1847 행` (파일 끝 배럴 re-export 목록).
- [web/src/views/AdminView.test.tsx](../../web/src/views/AdminView.test.tsx) `14~20 행` (path 첫 인자 기준 fetch mock 규약) · `235 행` (`const MAPPINGS = '/api/llm/difficulty-mappings'`) · `2730 행` 부근 (PATCH 배선 happy-path 케이스 — 본 slice 의 mirror 대상).
- [docs/architecture/api.md](../architecture/api.md) `139 행` — seed route 계약 정본 (body 없음, 200, `{ created, existing }`, 멱등, Admin+).
- [src/llm/difficulty-mapping.controller.ts](../../src/llm/difficulty-mapping.controller.ts) `111~121 행` — 실제 route · `@HttpCode(200)` · Admin guard (계약 대조용, 수정 금지).
- [docs/PLAN.md](../PLAN.md) `182 행` (소비처 동반 의무) · `184 행` (AdminView 목표선 `≤ 2,000` 과 측정 명령).

## Acceptance Criteria

- [ ] [adminLlmProviderMutationRunners.ts](../../web/src/views/adminLlmProviderMutationRunners.ts) 에 `SeedSlotsDeps` (발사 primitive `post` · `describeError` · in-flight `seeding`/`setSeeding` · `setSeedError` · `bumpRefresh`) 와 `export async function runSeedSlots(deps)` 를 추가한다 — 발사 경로는 `` `${LLM_MAPPINGS_PATH}/seed` `` 이고 method 는 `POST`, **body 없음** (api.md `139 행` 계약). `LLM_MAPPINGS_PATH` 재선언 금지 (정본 1 개 유지).
- [ ] [AdminView.tsx](../../web/src/views/AdminView.tsx) 가 `runSeedSlots` 를 import 해 `handleSeedSlots` 로 조립하고, Admin+ gating 블록 (`isAdmin ?`) 안 `DifficultyModelSelector` 인접 위치에 seed 버튼 1 개를 렌더한다 — in-flight 중 `disabled`, 실패 시 문구를 `role="alert"` 로 표면화 (throw 없음). 파일 끝 배럴에 `runSeedSlots` (+ 타입) 를 re-export 해 공개 표면 convention 을 유지한다.
- [ ] `runSeedSlots` happy-path unit test 1+ — `post` 가 `/api/llm/difficulty-mappings/seed` 로 정확히 1 회 발사되고 성공 시 `bumpRefresh()` 1 회 · `setSeedError(undefined)` · `setSeeding(false)` 로 끝난다.
- [ ] error path unit test 1+ — `post` 가 reject 하면 throw 없이 `describeError` 결과가 `setSeedError` 로 들어가고 `bumpRefresh` 는 **미호출**, `setSeeding(false)` 는 여전히 호출된다.
- [ ] 분기별 test 1+ — (a) `deps.seeding === true` 인 재호출은 미발사 (이중 POST 가드), (b) 정상 발사 분기, (c) 실패 분기 각각 독립 케이스.
- [ ] negative case 를 예외 분기마다 1+ — ① in-flight 재호출 미발사 ② 발사 실패 시 `bumpRefresh` 미호출 ③ body 를 싣지 않음 (`options.body` `undefined` 단언, 계약 drift 방지) ④ 경로 접미 drift 방지 (발사 path 가 `/api/llm/difficulty-mappings` 도 `/api/llm/difficulty-mappings/easy` 도 아닌 `.../seed` 정확 일치) ⑤ 성공 후 `setSeeding(false)` 가 `finally` 로 반드시 해제.
- [ ] [AdminView.test.tsx](../../web/src/views/AdminView.test.tsx) 에 배선 케이스 2+ — 버튼 클릭 시 `POST /api/llm/difficulty-mappings/seed` 가 발사되고 성공 후 매핑 재조회가 트리거되는 happy-path 1 개, 실패 시 오류 문구가 표면화되고 화면이 죽지 않는 negative 1 개.
- [ ] `cd web && pnpm test` 전량 green (회귀 0).
- [ ] `cd web && pnpm build` (`tsc --noEmit` + `vite build`) 통과 — 타입 오류 0.
- [ ] repo root `pnpm lint && pnpm build && pnpm test` 통과 (backend `src/` diff **0** 이라 무영향) 이며 `pnpm test:cov` 가 line ≥ 80% · function ≥ 80% 게이트를 유지한다.
- [ ] `wc -l web/src/views/AdminView.tsx` 결과가 **≤ 2,000** (PLAN `184 행` 목표선 — 현재 1,958, 증분 ≤ 40 줄).
- [ ] `git diff --stat` 상 변경 파일이 위 4 개뿐이고 합계 diff ≤ 300 LOC (§3 cap).

## Out of Scope

- `src/` · `test/` 변경 **금지** — 신규 HTTP route 0, e2e 추가 0 (T-1998 이 이미 왕복 박제). route census smoke guard 는 본 slice 와 무관하다.
- [DifficultyModelSelector.tsx](../../web/src/components/DifficultyModelSelector.tsx) props 계약 수정 금지 (ADR-0041 Decision 1 — 패널은 fetch/POST 를 모른다). 버튼은 AdminView 쪽에 둔다.
- `AdminView.difficulty-mapping-seed-contract.test.ts` (readFileSync 기반 web↔backend 계약 drift guard) 신설 금지 — 파일 수 cap 초과라 Follow-ups.
- [docs/requirements.md](../requirements.md) REQ-050 / REQ-049 재판정 금지 (§3.1 once-rule — T-1962 · T-1971 이 이미 소진).
- `test/perf/` · `web/src/perf/` 무접촉 (오너 `158 행` 신규 per-route baseline slice 금지).
- AdminView 추가 순수 추출 리팩터 금지 (부채 축은 별건 — 본 slice 는 목표선 유지만 책임).
- api.md · PLAN.md 문서 갱신 금지 (route 표는 T-1998 이 이미 정확).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (a) `AdminView.difficulty-mapping-seed-contract.test.ts` — GET (T-1188) · PATCH (T-1877 축) 선례와 동형의 web↔backend 계약 drift guard 를 seed route 에도 붙이는 slice.
- (b) seed 후 슬롯 3 개가 비어 있을 때 (`llmProviderConfigId: null`) 의 UI 안내 문구 — 현재 `DifficultyModelSelector` 는 미지정 슬롯을 구분해 알리지 않는다.
