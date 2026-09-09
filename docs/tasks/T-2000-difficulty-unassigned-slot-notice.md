---
id: T-2000
title: Surface unassigned difficulty slots in DifficultyModelSelector (ADR-0011 §3 fail-fast notice)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-050, REQ-049]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-09-09
independentStream: llm-difficulty
dependsOn: [T-1999]
touchesFiles:
  - web/src/components/DifficultyModelSelector.tsx
  - web/src/components/DifficultyModelSelector.test.tsx
  - web/src/views/AdminView.test.tsx
plannerNote: P6 · T-1999 Follow-up (b) — seed 직후 남는 미지정 슬롯을 패널이 안내(ADR-0011 §3 fail-fast 표면화)
---

# T-2000 — 난이도 미지정 슬롯 안내 문구

## Why

직전 [T-1999](T-1999-adminview-difficulty-slot-seed-wiring.md) (PR #1568 · main `862664dc`) 이 붙인 seed 버튼은 슬롯 row 3 개를 만들되 `llmProviderConfigId` 를 **항상 null** 로 남긴다 ([difficulty-mapping.service.ts](../../src/llm/difficulty-mapping.service.ts) `195~202 행` 주석 계약 (null 단언은 `198 행`)). 그리고 [ADR-0011](../decisions/ADR-0011-difficulty-model-assignment.md) `§3` 은 미설정 슬롯을 임의 기본 provider 로 채우지 않고 **평가를 거부(4xx)** 한다. 즉 Admin 이 seed 를 누른 직후 화면은 "정상"으로 보이지만 그 난이도의 평가는 전부 실패하며, 현재 UI 에는 이 사실을 알리는 표시가 **0** 이다 — placeholder `선택 안 함` 은 "선택 안 해도 된다" 로 읽히는 반대 신호다. 본 slice 는 그 fail-fast 계약을 사람이 읽을 수 있게 패널 표면에 올린다 (T-1999 `Follow-ups (b)`, REQ-050 IN_PROGRESS 축).

**issue-still-relevant pre-check (origin/main `b606afff`, 실측)**:

- `git grep -n "미지정|지정되지|unassigned|role=\"note\"" -- web/src` → `DifficultyModelSelector` 계열 히트 **0** (다른 히트는 `AdminSectionNav` · `EvaluationDetailPanel` 등 무관 컴포넌트의 자체 문구). 미해소 확인.
- 컴포넌트 현행 분기는 [DifficultyModelSelector.tsx](../../web/src/components/DifficultyModelSelector.tsx) `59 행`(loading) · `65 행`(빈 provider) · `83 행`(error) 3 개뿐 — 미지정 슬롯 분기 없음.
- 소비처는 이미 존재한다 — [AdminView.tsx](../../web/src/views/AdminView.tsx) `1083 행` 이 `mapping={difficultyMapping}` 로 마운트하고, [useAdminLlmProviders.ts](../../web/src/views/useAdminLlmProviders.ts) `327 행` 의 `difficultyMapping` 이 `Record<Difficulty, string | null>` 이라 **null 이 그대로 내려온다**. 따라서 §3 소비처 동반 의무는 신규 배선 없이 충족되며 본 slice 는 순수 presentational 변경이다.
- `git log --oneline -3 -- web/src/components/DifficultyModelSelector.tsx` → 최근 commit 은 배선 arc 뿐, 안내 문구 도입 이력 없음.

**오너 지시 대조 (직접 확인)**: `157 행` R-91 최우선 chain 의 잔여 ② 실 scale 부하는 credential · 사람 승인 게이트라 자율 집행분 0 (T-1706 판정 승계), `158 행` 신규 per-route perf baseline slice 금지는 본 task 가 `test/perf/` 를 무접촉이라 무저촉, `182 행` 소비처 동반 의무는 위와 같이 기존 마운트로 충족, `183 행` REQ 재판정 왕복 금지는 본 task 가 `docs/requirements.md` 를 건드리지 않아 무저촉, `184 행` AdminView 목표선 `≤ 2,000` 은 현재 **1,979 줄** 이고 본 slice 가 `AdminView.tsx` 를 **수정하지 않으므로** 증분 0 이다.

estimate: base 100 × 1.5 (R-112 4-카테고리 cover — 분기 추가 + 상수 + colocated spec 확장) = **150 LOC / 2~3 파일** 로 §3 cap 안 (`sizeExempt` 불요).

## Required Reading

- [web/src/components/DifficultyModelSelector.tsx](../../web/src/components/DifficultyModelSelector.tsx) `29~34 행` (문구 상수 convention) · `59~67 행` (loading / 빈 provider 조기 반환 순서) · `80~104 행` (error `role="alert"` + 슬롯 map 렌더 지점).
- [web/src/components/DifficultyModelSelector.test.tsx](../../web/src/components/DifficultyModelSelector.test.tsx) `6~19 행` (renderToStaticMarkup 문자열 assert 규약 + 문구 토큰 상수) · `60 행` · `146 행` (**`role="status"` 부재 단언** — 아래 AC 의 role 선택 제약 근거) · `151 행` (error 분기 케이스 형태).
- [docs/decisions/ADR-0011-difficulty-model-assignment.md](../decisions/ADR-0011-difficulty-model-assignment.md) `§1` (3 슬롯 고정) · `§3` (미설정 슬롯 평가 거부 = fail-fast).
- [src/llm/difficulty-mapping.service.ts](../../src/llm/difficulty-mapping.service.ts) `83~124 행` (`resolveModel` fail-fast chain) · `195~202 행` (seed 가 null FK 로 생성한다는 계약) — 문구의 사실성 대조용, **수정 금지**.
- [web/src/views/useAdminLlmProviders.ts](../../web/src/views/useAdminLlmProviders.ts) `322~331 행` — null 이 props 로 내려오는 경로 확인용, **수정 금지**.
- [docs/PLAN.md](../PLAN.md) `182 행` (소비처 동반 의무) · `184 행` (AdminView 목표선).

## Acceptance Criteria

- [ ] [DifficultyModelSelector.tsx](../../web/src/components/DifficultyModelSelector.tsx) 에 미지정 슬롯 안내를 추가한다 — `mapping` 값이 `null` 인 슬롯이 1 개 이상이면 해당 슬롯의 한국어 라벨을 **`DIFFICULTY_SLOTS` 렌더 순서 그대로** 나열하는 안내 영역 1 개를 슬롯 폼 위에 렌더한다. 문구는 파일 상단 상수(예: `UNASSIGNED_NOTICE_TEXT`)로 두고 ADR-0011 `§3` 의 사실(미지정 슬롯은 평가가 거부됨)을 담는다.
- [ ] 안내 영역의 role 은 **`role="note"`** 로 한다 — 기존 spec `60 행` · `146 행` 이 정상 렌더에서 `role="status"` 부재를, `110 행` 이 `role="alert"` 부재를 단언하므로 두 role 재사용은 기존 단언과 충돌한다 (회귀 0 을 위한 제약).
- [ ] happy-path unit test 1+ — 일부 슬롯만 null 인 `mapping` 에서 `role="note"` 안내가 렌더되고 **null 인 슬롯 라벨만** 나열된다 (할당된 슬롯 라벨은 안내 문장 안에 없음).
- [ ] error path unit test 1+ — `error` props 가 truthy 이면서 미지정 슬롯도 있는 경우 `role="alert"` 와 `role="note"` 가 **둘 다** 렌더되고 서로를 지우지 않는다.
- [ ] 분기별 test 1+ — (a) 전 슬롯 할당 → 안내 미렌더 (b) 일부 미지정 → 미지정 슬롯만 나열 (c) 전 슬롯 미지정 → 3 라벨 모두 나열 (d) `loading=true` → 조기 반환이 우선이라 안내 미렌더 (e) `providers` 빈 배열 → 빈 상태 조기 반환이 우선이라 안내 미렌더.
- [ ] negative case 를 예외 분기마다 1+ — ① 전 슬롯 할당 시 `role="note"` 문자열 **부재** ② `loading=true` 시 안내 문구 토큰 부재 ③ `providers: []` 시 안내 문구 토큰 부재 ④ `mapping` 값이 **provider 목록에 없는 미지의 id** 인 슬롯은 (null 이 아니므로) 미지정으로 세지 않는다 ⑤ 안내 추가가 `<select>` 3 개 · 슬롯당 option 수(`providers.length + 1`) 구조를 바꾸지 않는다.
- [ ] 기존 [DifficultyModelSelector.test.tsx](../../web/src/components/DifficultyModelSelector.test.tsx) 케이스를 **의미 변경 없이** 전량 유지 (기존 단언 삭제·완화 금지 — 충돌이 나면 새 role 로 회피).
- [ ] `cd web && pnpm test` 전량 green (회귀 0). `AdminView.test.tsx` 가 패널 markup 단언 때문에 깨지면 그 파일의 **최소 조정만** 허용하고 총 파일 수는 3 이하로 유지한다.
- [ ] `cd web && pnpm build` (`tsc --noEmit` + `vite build`) 통과 — 타입 오류 0.
- [ ] repo root `pnpm lint && pnpm build && pnpm test` 통과 (backend `src/` diff **0** 이라 무영향) 이며 `pnpm test:cov` 가 line ≥ 80% · function ≥ 80% 게이트를 유지한다.
- [ ] `wc -l web/src/views/AdminView.tsx` 결과가 **≤ 2,000** (PLAN `184 행` — 본 slice 는 `AdminView.tsx` 무수정이라 1,979 유지).
- [ ] `git diff --stat` 상 변경 파일 ≤ 3 개, 합계 diff ≤ 300 LOC (§3 cap).

## Out of Scope

- `src/` · `test/` 변경 **금지** — 신규 HTTP route 0, backend 계약 변경 0, e2e 추가 0 (route census smoke guard 와 무관).
- `AdminView.tsx` · `useAdminLlmProviders.ts` 수정 금지 — 소비처는 이미 null 을 내려주므로 배선 변경이 필요 없다 (§3 소비처 동반 의무 기충족).
- `onAssign` 계약 · placeholder(`선택 안 함`) 동작 · `DifficultyModelSelectorProps` 필드 추가 금지 (ADR-0041 Decision 1 presentational 경계 — 안내는 기존 `mapping` props 만으로 파생한다).
- seed 버튼 문구 · 배치 변경 금지 (T-1999 범위 종료).
- `AdminView.difficulty-mapping-seed-contract.test.ts` 신설 금지 — T-1999 `Follow-ups (a)` 로 남긴 별건.
- [docs/requirements.md](../requirements.md) REQ-050 / REQ-049 재판정 금지 (PLAN `183 행` — 구현 후 1 회만, 별 task).
- `test/perf/` · `web/src/perf/` 무접촉 (오너 `158 행`).
- AdminView 순수 추출 리팩터 금지 (부채 축은 별건).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (a) `AdminView.difficulty-mapping-seed-contract.test.ts` — GET (T-1188) · PATCH (T-1877) 선례와 동형의 web↔backend seed route 계약 drift guard (T-1999 승계).
- (b) seed 응답의 `created` / `existing` 카운트를 버튼 옆에 요약 표시 (현재는 성공 여부만 알 수 있음).
