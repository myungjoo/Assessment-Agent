---
id: T-1877
title: AdminView 의 난이도 매핑 assign 축(AssignDeps · runAssign + LLM_MAPPINGS_PATH)을 adminLlmProviderMutationRunners 로 순수 추출
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-049, REQ-050]
independentStream: adminview-god-component-refactor
dependsOn: [T-1876]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/adminLlmProviderMutationRunners.ts
  - web/src/views/adminLlmProviderMutationRunners.test.ts
estimatedDiff: 340
estimatedFiles: 3
sizeExempt: true
exemptReason: "pure-extraction — (a) 동작 변경 0 (`792~850 행` 연속 블록의 `AssignDeps` · `runAssign` 과 상수 블록 `408~410 행` 의 `LLM_MAPPINGS_PATH` 를 통째로 옮기고 선언 앞에 `export` 만 붙인 뒤 AdminView 가 기존 단방향 import 블록(`277~289 행`)으로 되돌려 쓰는 것이 전부) · (b) 신규 로직 0 LOC (`AssignDeps` 8 필드 · `runAssign` 본문의 2 가드 · try/catch/finally 전이 · 각 선언 위 주석 블록 무변경) · (c) 기존 spec 은 AdminView 배럴 재수출(`3809 행` `runAssign` · `3880 행` `AssignDeps`) 덕에 `from './AdminView'` 무수정 통과 — `AdminView.difficulty-mapping-assign-contract.test.ts` 와 `AdminView.test.tsx` 는 심볼 import 후 mock deps 로 러너를 직접 호출하는 방식이라 소스 경로에 의존하지 않는다. 삭제 약 62 + 추가 약 78 이 전부 이동량이고 나머지는 목적지 모듈 경계 spec 증분이라 LOC 이 위험도에 비례하지 않는다. 파일 수 3 으로 파일 cap (≤ 5) 은 예외 없이 준수."
plannerNote: "P6 / PLAN 183 행 AdminView 부채 열넷째 실분할 — 난이도 매핑 assign 축 2 심볼 + 상수 1 (792~850 행 연속 블록)"
created: 2026-09-03
---

# T-1877 — AdminView 의 난이도 매핑 assign 축(AssignDeps · runAssign + LLM_MAPPINGS_PATH)을 adminLlmProviderMutationRunners 로 순수 추출

## Why

[docs/PLAN.md](../PLAN.md) `183 행` 의 AdminView god component 부채 bullet 이 **"더 작은 후속 후보"** 로 명시한 것이 본 task 의 **난이도 매핑 assign 축**이다. 직전 [T-1876](T-1876-adminview-membership-derivations-extract.md) 의 `Follow-ups` 도 같은 항목을 planner 사전 박제로 남겼다. 신규 모듈을 만들지 않고 이미 존재하는 [adminLlmProviderMutationRunners.ts](../../web/src/views/adminLlmProviderMutationRunners.ts) 로 합류시키는 열넷째 순수-추출 슬라이스이며, cap 이 append 를 싸게 extract 를 비싸게 만들어 온 구조를 되돌려 목표선 (≤ 2,000 줄) 까지의 잔여를 줄이는 것이 목적이다.

**issue-still-relevant pre-check (origin/main `34cfb2a9` 실측 — 좌표를 전수 재측정했다)**:

- `wc -l web/src/views/AdminView.tsx` = **3,921 줄**, 선언 수 (`grep -cE '^(export )?(async )?(function|const|let|type|interface|class|enum) '`) = **57**. PLAN bullet 의 표기 (`4,072 줄 · 선언 66`) 는 T-1876 머지 (`-151`) 직전 값이라 **stale** — 본 task 는 PLAN 갱신을 하지 않고 (Out of Scope) 아래 실측 좌표로만 작업한다.
- **PLAN 이 적어 둔 좌표는 전부 stale 이다** (T-1876 이 `408 행` 아래에서 128 + 36 줄을 걷어내고 import 블록을 추가한 결과) — `AssignDeps` `951 행` → 실측 **`800 행`**, `runAssign` `969 행` → 실측 **`818 행`**, 블록 `943~1001 행` → 실측 **`792~850 행`**, `buildMappingsPath` `796 행` → 실측 **`645 행`**, `LLM_MAPPINGS_PATH` `395 행` → 실측 **`410 행`**. 이동 대상 자체는 **글자-동일하게 실재**하며 연속 1 블록 59 줄 (`792 행` 선행 주석 ~ `850 행` `runAssign` 닫는 괄호) 이라 경계가 단순하다.
- **목적지 중복 0** — `grep -nE "AssignDeps|runAssign|LLM_MAPPINGS_PATH" web/src/views/adminLlmProviderMutationRunners.ts` 결과 0 건. 그 모듈은 현재 280 줄 · `LLM_PROVIDERS_PATH` 상수 1 + 러너 3 + 타입 5 만 담고 있어 assign 축이 아직 옮겨지지 않았음이 확정이다.
- **상수 동반 이동이 유일하게 성립하는 방향** — `runAssign` (`835 행`) 과 잔류 `buildMappingsPath` (`645~651 행`) 가 같은 `LLM_MAPPINGS_PATH` 를 쓴다. 재선언은 정본 2 개가 되어 금지이고, 새 모듈이 AdminView 를 import 하면 역방향이라 금지 — [T-1857](T-1857-adminview-llm-provider-mutation-runners-extract.md) 이 `LLM_PROVIDERS_PATH` 에 쓴 선례 (`277~282 행` import 블록 주석이 "정본을 1 개로 유지하려 여기서 가져온다" 로 박제) 를 그대로 따른다.
- **소비처 동반 의무 충족** — 유일한 호출부 `handleAssign` (`1936 행` `useCallback`) 이 AdminView 에 잔류하며 본 PR 에서 import 된 `runAssign` 을 그대로 호출한다. helper 단독 slice 가 아니다.
- **파일 cap 산술 확정 — 동반 갱신 0** — AdminView 소스 **텍스트**를 `readFileSync` 로 읽는 drift-guard 를 전수 확인했다. `AdminView.difficulty-mapping-list-contract.test.ts` (`104 행`) 의 유일한 소스 anchor 는 `extractMappingsFireMethod` (`67 행`) 의 `useApiResource<DifficultyMappingRow[]>(...)` 정규식이며 그 call site 는 잔류부다. 같은 spec 이 쓰는 `buildMappingsPath` 도 잔류부이고, 상수 `LLM_MAPPINGS_PATH` 를 참조하는 spec 은 `grep -rn "LLM_MAPPINGS_PATH" web/src` 결과 AdminView.tsx 1 개 파일뿐이라 0 건이다. `AdminView.difficulty-mapping-assign-contract.test.ts` 는 controller · DTO 소스만 읽고 web 측 발사는 `runAssign` 을 mock deps 로 **직접 호출**해 캡처하므로 소스 경로 무관, `AdminView.test.tsx` 의 `readFileSync` 2 곳 (`9188 행` 역할 변경 게이트 · `9605 행` 인스턴스 접근) 도 잔류부다. 따라서 touchesFiles 3 개로 확정.

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — 이동 대상 `792~850 행` (`AssignDeps` · `runAssign`) · 상수 블록 `408~410 행` (`LLM_MAPPINGS_PATH` + 선행 주석 2 줄) · 잔류 소비처 `buildMappingsPath` (`645~651 행`) 와 `handleAssign` (`1936 행`) · 기존 import 블록 (`272~289 행`) · 배럴 재수출 (`3809 행` `runAssign`, `3880 행` `AssignDeps`).
- [web/src/views/adminLlmProviderMutationRunners.ts](../../web/src/views/adminLlmProviderMutationRunners.ts) — 목적지 모듈. 파일 머리 주석 · `LLM_PROVIDERS_PATH` (`28 행`) · 기존 러너 3 의 주석/배치 convention.
- [web/src/views/adminLlmProviderMutationRunners.test.ts](../../web/src/views/adminLlmProviderMutationRunners.test.ts) — 경계 spec. 머리 주석의 (a)(b)(c) 검증 취지 · `모듈 경계(T-1857 순수 추출)` describe · 재수출본 동일 참조 대조 패턴.
- [docs/tasks/T-1857-adminview-llm-provider-mutation-runners-extract.md](T-1857-adminview-llm-provider-mutation-runners-extract.md) — 같은 목적지 모듈을 신설한 선례 (상수 정본 1 개 유지 방향 포함).
- [web/src/views/AdminView.difficulty-mapping-assign-contract.test.ts](../../web/src/views/AdminView.difficulty-mapping-assign-contract.test.ts) — `1~15 행` import 방식만 확인 (무수정 통과 근거).

## Acceptance Criteria

- [ ] `AssignDeps` · `runAssign` 이 [adminLlmProviderMutationRunners.ts](../../web/src/views/adminLlmProviderMutationRunners.ts) 로 이동하고 `export` 가 붙는다. **본문 · 주석은 byte-identical** — `git show` diff 에서 이동 블록 내부에 hunk 가 0 이어야 한다 (필요한 변경은 `export` 키워드 · `Difficulty` 타입 import 추가뿐).
- [ ] `LLM_MAPPINGS_PATH` 가 선행 주석 2 줄과 함께 같은 모듈로 이동해 `export const` 가 되고, AdminView 에는 **재선언이 남지 않는다** (`grep -c "const LLM_MAPPINGS_PATH" web/src/views/AdminView.tsx` == 0).
- [ ] AdminView 가 기존 `from './adminLlmProviderMutationRunners'` import 블록 (`277~289 행`) 에 `LLM_MAPPINGS_PATH` · `runAssign` (값) 과 `AssignDeps` (타입) 를 추가해 되돌려 쓰고, 잔류 `buildMappingsPath` 와 `handleAssign` 이 그대로 동작한다. **역방향 import 0** — 새 모듈은 AdminView 를 import 하지 않는다 (`grep -c "from './AdminView'" web/src/views/adminLlmProviderMutationRunners.ts` == 0).
- [ ] 배럴 재수출 (`runAssign` · `AssignDeps`) 이 유지돼 기존 spec 2 개 (`AdminView.difficulty-mapping-assign-contract.test.ts` · `AdminView.test.tsx`) 가 **무수정**으로 통과한다.
- [ ] **happy-path unit test** — [adminLlmProviderMutationRunners.test.ts](../../web/src/views/adminLlmProviderMutationRunners.test.ts) 에 직접 import 경로의 `runAssign` 정상 흐름 test 1+ 추가: PATCH 1 회가 `${LLM_MAPPINGS_PATH}/${difficulty}` 에 `llmProviderConfigId` body · `Content-Type: application/json` 으로 발사되고 낙관 반영 → `bumpRefresh` 1 회 → override 비움 → 진행 플래그 `[[true],[false]]` 전이.
- [ ] **error path unit test** — 주입한 `patch` primitive 가 reject 할 때 throw 없이 `setAssignError(describeError(e))` 로 문구가 표면화되고, 낙관 override 가 롤백되며 `bumpRefresh` 가 **호출되지 않는** test 1+.
- [ ] **분기 cover** — `runAssign` 의 분기 2 개를 각각 1+ test 로 나눈다: (1) `!providerId` 빈/falsy → PATCH 미발사, (2) `deps.assigning === true` (이전 mutation 미완) → PATCH 미발사. 두 미발사 경로에서 `setAssigning` 조차 호출되지 않음도 단언.
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+ test: (a) `providerId` 가 빈 문자열, (b) in-flight 재호출, (c) primitive 가 `ApiError` 아닌 임의 값을 throw (문구 파생이 여전히 안전), (d) 실패 후에도 `finally` 로 진행 플래그가 반드시 `false` 로 복귀, (e) 상수 `LLM_MAPPINGS_PATH` 가 `'/api/llm/difficulty-mappings'` 정본 값 그대로임 (경로 drift 방지).
- [ ] **재수출본 동일 참조** — `from './AdminView'` 로 가져온 `runAssign` 이 새 모듈에서 직접 import 한 함수와 `toBe` 로 동일 참조임을 단언하는 test 1+ (기존 계약 spec 의 위임 검증이 이동 후에도 유효함의 근거 — T-1857 선례 패턴).
- [ ] `cd web && pnpm lint && pnpm build && pnpm test` 통과 (web vitest 전량 green).
- [ ] backend 회귀 없음 확인 — `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 task 는 backend 0 LOC 변경이다.
- [ ] `wc -l web/src/views/AdminView.tsx` 가 **`3,921 → 3,860 줄` 안팎** (기대 순 감소 `-60` 안팎) 으로 줄어든 것을 실측해 완료 기록에 적는다.

## Out of Scope

- `buildMappingsPath` (`645 행`) · `deriveDifficultyMapping` · `DIFFICULTY_KEYS` · `mergeMapping` 등 **난이도 파생 helper 군 이동** — 본 task 는 assign **mutation 축 2 심볼 + 상수 1** 만 옮긴다.
- `handleAssign` (`1936 행`) 컨테이너 배선의 구조 변경 — import 출처만 바뀌고 호출 형태는 무변경.
- [docs/PLAN.md](../PLAN.md) `183 행` bullet 의 실측 LOC 갱신 — `direct` 라 별도 task 다 (§3.1 판정 규칙 3, 아래 Follow-ups).
- 기존 spec 2 개 (`AdminView.difficulty-mapping-assign-contract.test.ts` · `AdminView.test.tsx`) 의 **본문 수정** — 배럴 재수출로 무수정 통과해야 하며, 수정이 필요해졌다면 추출 방향이 틀린 것이다.
- `runAssign` 본문의 로직 개선 · 주석 재작성 · 네이밍 변경 — 순수 추출 조건 (b) 위반.
- backend (`src/llm/*`) 변경 일체.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

- (planner 사전 박제) [docs/PLAN.md](../PLAN.md) `183 행` bullet 갱신 (`direct`) — T-1876 (`-151`) 과 본 task 분을 **묶어 1 회로** 실측 LOC · 선언 수 · 진척 목록 (열셋째 · 열넷째 슬라이스) 을 갱신하고 다음 추출 대상을 재지목한다. 현 bullet 표기 (`4,072 줄 · 선언 66`) 는 이미 stale 이며 지목 좌표 (`943~1001 행` 등) 도 전부 무효다.
- (planner 사전 박제) `src/run-status/run-status.service.spec.ts:134` 가 backend full-suite 병렬 실행에서 flaky fail 하는 사례가 T-1876 실행 중 관측됐다 (단독 재실행 · CI 는 green). backend 0 LOC 변경과 무관한 **기존 flake** 이므로 본 task 에서 고치지 않는다 — 재발 시 별도 `pr` task 로 격리 (원인 후보: 시간 의존 단언 또는 공유 mock 상태).
