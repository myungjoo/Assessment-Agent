---
id: T-2007
title: Surface difficulty slot seed response summary (created / existing) in AdminView
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-050, REQ-049]
estimatedDiff: 210
estimatedFiles: 5
created: 2026-09-10
independentStream: llm-difficulty
dependsOn: [T-1999, T-2000, T-2001]
touchesFiles:
  - web/src/views/adminLlmProviderMutationRunners.ts
  - web/src/views/adminLlmProviderMutationRunners.test.ts
  - web/src/views/useAdminLlmProviders.ts
  - web/src/views/useAdminLlmProviders.test.ts
  - web/src/views/AdminView.tsx
plannerNote: P6 web · T-2000 Follow-up (b) — seed 응답 {created, existing} 미소비를 요약 표면화로 닫는다 (5 파일 cap 안)
---

# T-2007 — 난이도 슬롯 seed 응답 요약(생성 / 기존) 표면화

## Why

[T-2000](T-2000-difficulty-unassigned-slot-notice.md) `## Follow-ups` (b) 가 남긴 유일한 미집행 항목이다 — 지금 Admin 이 "난이도 슬롯 초기화" 버튼을 눌러도 **무엇이 새로 생겼고 무엇이 이미 있었는지** 화면에서 알 수 없다. backend 는 [api.md](../architecture/api.md) `139 행` 계약대로 200 + `{ created, existing }`(둘 다 `DIFFICULTIES` 순서 `Difficulty[]`, 합집합 항상 3 슬롯)을 돌려주는데 web 러너가 그 body 를 버리고 있어, 멱등 재실행과 첫 실행이 사람 눈에 구분되지 않는다. 이 slice 는 그 응답을 방어 파싱해 사람-친화 요약 1 줄로 표면화한다 (REQ-050 슬롯 운영 진입점의 관측성).

**issue-still-relevant pre-check (origin/main `ecef4f61` 실측)** — 미해소 확인:

- `git grep -c "seedSummary\|SeedSummary" origin/main -- web/ src/` 히트 **0** (요약 state · 파서 · 렌더 어디에도 없음).
- `git grep -n "await deps.post" origin/main -- web/src/views/adminLlmProviderMutationRunners.ts` = `475 행` 단 1 곳이고 **반환값을 받지 않는다**. 같은 파일 `461 행` 주석이 "응답 body(`{ created, existing }`)는 소비하지 않는다" 로 그 사실을 자인한다.
- `git grep -n "seedError ?" origin/main -- web/src/views/AdminView.tsx` = `1101 행` 1 줄뿐 — seed 축에서 화면에 나오는 것은 **실패 문구뿐**이고 성공 요약은 0.
- backend 는 실재 — [difficulty-mapping.service.ts](../../src/llm/difficulty-mapping.service.ts) `203~233 행` `seedDifficultySlots` 가 `created` / `existing` 두 배열을 채워 반환하고 controller `115~121 행` 이 raw forward 한다. 즉 **표면화만 없는 상태**다.
- 해당 러너 파일 최근 touch 는 `862664dc`(T-1999) 이고 그 뒤 이 축을 건드린 commit 0.

## Required Reading

- [web/src/views/adminLlmProviderMutationRunners.ts](../../web/src/views/adminLlmProviderMutationRunners.ts) `436~487 행` — `SeedSlotsDeps` 선언 + `runSeedSlots` 본문(발사 가드 · finally 계약 · 미소비 자인 주석).
- [web/src/views/adminLlmProviderMutationRunners.test.ts](../../web/src/views/adminLlmProviderMutationRunners.test.ts) — `runSeedSlots` describe (본 task 의 colocated spec 위치, 새 파일 만들지 말 것).
- [web/src/views/useAdminLlmProviders.ts](../../web/src/views/useAdminLlmProviders.ts) `368~400 행`(seed state 3 + 러너 호출) · `430~450 행`(반환 표면).
- [web/src/views/useAdminLlmProviders.test.ts](../../web/src/views/useAdminLlmProviders.test.ts) `760~800 행` — 공개 표면 심볼 수 **42** 고정 guard(`toHaveLength(42)` `797 행`).
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `855~860 행`(hook 반환 구조 분해) · `1088~1102 행`(seed 버튼 + `seedError` 렌더 지점).
- [src/llm/difficulty-mapping.service.ts](../../src/llm/difficulty-mapping.service.ts) `203~233 행` — `created` / `existing` 이 **카운트가 아니라 `Difficulty[]`** 임을 확인할 것.
- [docs/architecture/api.md](../architecture/api.md) `139 행` — 응답 계약 정본(200 · body 없음 · 두 배열 · 합집합 3).
- [web/src/views/AdminView.difficulty-mapping-seed-contract.test.ts](../../web/src/views/AdminView.difficulty-mapping-seed-contract.test.ts) `90~110 행` — `SeedSlotsDeps` **리터럴**을 직접 만든다. 본 task 는 이 파일을 수정하지 않으므로 새 dep 는 optional 이어야 한다(아래 AC 3).

## Acceptance Criteria

- [ ] **파서 helper 신설** — `adminLlmProviderMutationRunners.ts` 에 순수 함수(예: `summarizeSeedSlots(raw: unknown): string | undefined`)를 export 한다. `{ created, existing }` 두 필드가 **문자열 배열일 때만** 사람-친화 요약 문자열(생성 수 · 기존 수 + 난이도 이름, 한국어)을 만들고, 그 외 모든 형태(undefined · null · 비객체 · 배열 아님 · 원소가 문자열 아님)에는 `undefined` 를 돌려준다 — 근거 없는 요약을 지어내지 않는다.
- [ ] **러너 배선** — `runSeedSlots` 가 `await deps.post(...)` 의 반환값을 위 helper 에 넘겨 `deps.setSeedSummary?.(...)` 로 전달한다. 발사 시작 시 직전 요약을 비우고(`undefined`), 실패 경로에서는 요약을 설정하지 않는다(직전 성공 요약이 실패 후에 남지 않는다). 기존 계약은 **문자 단위 무변경** — POST path `.../seed` · method `POST` · body 없음 · `Content-Type` 헤더 없음 · `seeding` 가드 · `bumpRefresh` 조건 · `finally` 의 `setSeeding(false)`.
- [ ] **새 dep 는 optional** — `SeedSlotsDeps.setSeedSummary?: (next: string | undefined) => void` 로 선언하고 호출은 optional chaining 으로 한다. 사유(기존 `AdminView.difficulty-mapping-seed-contract.test.ts` 의 deps 리터럴을 수정하지 않고 5 파일 cap 을 지키기 위함)를 코드 주석 1~2 줄로 남긴다.
- [ ] **hook 배선** — `useAdminLlmProviders.ts` 에 `seedSummary` state 를 추가해 러너 deps 로 setter 를 넘기고 반환 표면에 포함한다. `useAdminLlmProviders.test.ts` 의 심볼 수 guard 를 `42` → `43` 으로 갱신하고 그 주석에 증가 사유(T-2007 seed 요약 1)를 적는다.
- [ ] **UI 소비처 동반** (CLAUDE.md §3) — `AdminView.tsx` 가 `seedSummary` 를 구조 분해해 `1101 행` `seedError` 렌더 직후에 `{seedSummary ? <p role="status">{seedSummary}</p> : null}` 형태로 렌더한다. `wc -l web/src/views/AdminView.tsx` 결과가 **2000 미만**을 유지한다(현재 1979).
- [ ] **happy-path unit test 1+** — 세 슬롯 전량 생성 · 일부 생성 + 일부 기존 · 전량 기존 각각에 대해 요약 문자열이 기대대로 만들어지고 setter 로 전달된다.
- [ ] **error path unit test 1+** — `post` 가 throw 하면 `setSeedError` 가 호출되고 요약은 설정되지 않으며(직전 요약은 비워진 상태), `bumpRefresh` 는 호출되지 않는다.
- [ ] **분기별 test 1+** — helper 의 각 분기(정상 shape / 두 필드 중 하나 누락 / 배열 아님 / 원소가 문자열 아님 / `undefined` 응답)와 러너의 `seeding` 가드 분기, `setSeedSummary` **미주입** 분기(optional dep 없이도 throw 없이 정상 종료)를 각각 1+ 케이스로 덮는다.
- [ ] **negative case 를 예외 분기마다 1+** — (a) `post` 가 `undefined` 를 resolve (기존 mock 관행) → 요약 `undefined` · 화면 문구 0, (b) 응답이 문자열/숫자 등 비객체, (c) `created` 만 있고 `existing` 없음, (d) 배열 원소에 숫자 혼입, (e) `seeding: true` 재호출 시 `post` 미발사 · 요약 미변경.
- [ ] **coverage** — `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] **회귀 0** — `pnpm --filter web test` 전량 green(특히 `AdminView.difficulty-mapping-seed-contract.test.ts` 는 **diff 0 인 채로** 통과) + root `pnpm lint && pnpm build && pnpm test` green (R-110).
- [ ] **변경 파일 5 개 · diff ≤ 300 LOC** — `git diff --name-only origin/main` 이 frontmatter `touchesFiles` 5 개와 정확히 일치한다(`src/` · `test/` · `docs/` diff 0).

## Out of Scope

- backend 변경 일체 — `difficulty-mapping.service.ts` · controller · DTO · e2e · [api.md](../architecture/api.md) `139 행` 계약은 **무접촉**(응답 shape 을 바꾸지 않고 그대로 소비만 한다).
- `DifficultyModelSelector` 컴포넌트 수정 (T-2000 의 미지정 슬롯 안내 축) · 슬롯 재지정 PATCH 경로 · 기본 provider 축.
- seed 버튼 문구 · disabled 조건 · `seedError` 렌더 형태 변경.
- `AdminView.difficulty-mapping-seed-contract.test.ts` 수정 (계약 guard 는 이번 변경으로 깨지지 않아야 한다 — 깨진다면 설계가 틀린 것이다).
- [docs/requirements.md](../requirements.md) REQ-050 재판정 — PLAN `183 행` once-rule 상 본 arc 의 1 회를 [T-2006](T-2006-req050-difficulty-routing-readjudication.md) 이 이미 소진했다.
- AdminView god component 리팩터 · 추출 (PLAN `184 행` 축, 본 slice 는 렌더 1 줄만 추가).
- 새 외부 dependency 도입 (§5).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 발견한 인접 작업을 여기에 적는다.)
