---
id: T-0707
title: realdata-e2e live-gating 결정 ↔ env 완전성 single-source 재유도 정합 가드 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-059, REQ-032]
estimatedDiff: 300
estimatedFiles: 2
created: 2026-06-27
plannerNote: P5 L109 실 평가 e2e — NO-GUARD leaf resolveRealDataE2eLiveGating(T-0610) 가드 신설, T-0705 result-summary 가드 mirror, dependsOn [] 독립
independentStream: realdata-e2e-live-gating-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-live-gating-consistency.ts
  - test/helpers/realdata-e2e-live-gating-consistency.spec.ts
---

# T-0707 — realdata-e2e live-gating 결정 ↔ env 완전성 single-source 재유도 정합 가드 신설

## Why

PLAN.md P5 L109 (실 github.com 공개 활동 = 실 평가 e2e 입력) 사슬의 build-time 정합 가드 사슬을 한 칸 더 닫는다. `resolveRealDataE2eLiveGating(env)` (`test/helpers/realdata-e2e-live-gating.ts`, T-0610 박제) 은 enable flag + Ollama 5 종 + github read PAT 의 **7-env 완전성 규칙**으로 `enabled` 를 판정하고, 활성 시 `ollama` credential 묶음 + `githubPat` + `reason` 을 합성하는 **NO-GUARD leaf 컴포저** 다. 그 판정 불변식 — ① `enabled === true` ⟺ 7 env 전부 non-blank / ② 활성 시에만 credential 묶음·`githubPat` present (비활성 시 둘 다 undefined) / ③ credential 값이 `reason` 문자열에 절대 노출되지 않음 (§9) / ④ `missing` 나열 순서 = `REALDATA_E2E_REQUIRED_ENV` 순서 — 는 컴포저 본문 주석과 colocated spec happy-path 단언으로만 박제돼 있고, **런타임에서 강제되는 독립 재유도 가드가 부재** 하다. 손상된 gating 결정 (예: `enabled=true` 인데 credential 누락, 혹은 `reason` 에 credential 값 누출) 이 live smoke 분기로 새기 전 fail-fast throw 로 차단한다.

issue-still-relevant pre-check (origin/main grep):

- `git grep -l -i "live-gating-consistency\|LiveGatingConsistent\|assertRealDataE2eLiveGating" origin/main -- "test/helpers/*.ts"` → **exit 1 (매칭 0)**. `realdata-e2e-live-gating-consistency.ts` 파일·`assertRealDataE2eLiveGating*` 심볼 모두 origin/main 부재 확인 — NO-GUARD leaf 확정, make-work 아님.
- `realdata-e2e-live-gating.ts` / `.spec.ts` 만 존재 (컴포저 본체 + 기존 spec). consistency 가드 helper·spec 미존재.

본 task 는 backlogNote 가 명명한 잔여 NO-GUARD leaf 2 종 (live-gating / result-issue-descriptor) 중 live-gating 측을 닫는다. T-0705 result-summary 가드 신설의 mirror (가드 신설 → 후속 self-wire 짝 분리 패턴).

## Required Reading

- `test/helpers/realdata-e2e-live-gating.ts` — `resolveRealDataE2eLiveGating` 컴포저 본체 (반환 타입 `RealDataE2eLiveGating`, `RealDataE2eLiveOllamaCredential`, env 이름 상수 7 종, `REALDATA_E2E_REQUIRED_ENV` 순서, `isPresent` non-blank 규칙).
- `test/helpers/realdata-e2e-result-summary-consistency.ts` — 직전 sibling 가드 (T-0705). 에러 정책 (구조 결손 TypeError ↔ 값 정합 위반 RangeError 분리) · `describe(value)` 라벨 helper · single-source 재유도 비교 · 한국어 JSDoc·책임 경계 주석 톤을 **mirror**.
- `test/helpers/realdata-e2e-result-summary-consistency.spec.ts` — colocated spec 구조 (happy-path / 구조 결손 negative / 값 정합 negative / 비변형·결정론) 패턴 참고.
- (colocated spec 위치) 신규 spec 은 `test/helpers/realdata-e2e-live-gating-consistency.spec.ts` 에 둔다 — NestJS·discoverability convention, sibling 가드와 동일 위치.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-live-gating-consistency.ts` 신설 — 순수 함수 `assertRealDataE2eLiveGatingConsistentWithEnv(gating, env)` export. 부수효과 0 / 외부 의존 0 / `@Injectable` 0 / Prisma 0 / LLM·실 네트워크 호출 0 / 입력 비변형 (gating·env 읽기·비교만) / 동일 입력 → 동일 동작.
- [ ] 가드는 env 로부터 expected gating 을 **컴포저 재호출 없이 독립 재유도** 한다 — `isPresent` non-blank 규칙을 자체 재구현 (`realdata-e2e-live-gating.ts` 의 env 이름 상수·`REALDATA_E2E_REQUIRED_ENV` 는 import 재사용, 판정 로직은 독립 재유도) 해 `enabled` / `missing` 순서 / 활성 시 credential 묶음·`githubPat` present 여부를 재계산한 뒤, 인자로 받은 `gating` 과 deep-equal 대조.
- [ ] **에러 정책 분리** — `gating` 객체·필드의 구조/타입 결손 (null/array/비-boolean `enabled`/비-string `reason` 등) 은 **TypeError**, 재유도 값 정합 위반 (`enabled` mismatch / credential present-coupling 위반 / `missing` 순서·집합 불일치) 은 **RangeError** 로 구분. 한국어 메시지.
- [ ] **§9 credential 비노출 단언** — 가드는 `reason` 문자열에 credential 값 (baseUrl/apiKey/model/provider/apiVersion/githubPat 실값) 이 **포함돼 있지 않은지** 검사하는 불변식을 포함하되, 가드 자신도 그 값을 throw message·log·reason 에 절대 echo 하지 않는다 (env 이름 상수만 메시지에 사용).
- [ ] Happy-path unit test 1+ — `assertRealDataE2eLiveGatingConsistentWithEnv` 에 (a) 7 env 전부 set → `enabled=true` + credential 묶음 정합 gating, (b) enable flag 부재 → `enabled=false` gating 각 정상 통과 (void 반환).
- [ ] Error path unit test 1+ — gating 이 null/undefined·비객체·필드 타입 결손일 때 TypeError throw (구조 결손 분기 각 1+).
- [ ] Flow / branch coverage — env 완전성 분기 (7 env 중 enable flag / Ollama 5 종 중 하나 / github PAT 부재 각각)·활성 vs 비활성 credential present-coupling 분기마다 test 1+.
- [ ] Negative cases 충분 cover — 각 1+ test: (1) `enabled=true` 인데 ollama/githubPat 누락 (present-coupling 위반 → RangeError), (2) `enabled=false` 인데 credential present (역 coupling 위반 → RangeError), (3) `missing` 배열 순서가 `REALDATA_E2E_REQUIRED_ENV` 와 불일치 → RangeError, (4) 빈 문자열/공백-only env 가 부재로 처리되는 경계 (non-blank 규칙) → 재유도 `enabled=false` 와 일치 검증, (5) `reason` 에 credential 값이 누출된 손상 gating → RangeError, (6) 입력 객체 비변형 (가드 호출 후 gating·env 동일성 유지).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 가드 파일 cov 충족.
- [ ] `pnpm lint && pnpm build && pnpm test` green. tester 가 결과 확인.

## Out of Scope

- `resolveRealDataE2eLiveGating` 컴포저 본문 수정 / self-wire 배선 (가드를 컴포저 return 직전 호출) — **후속 별도 task** (T-0705→T-0706 self-wire 분리 패턴 mirror). 본 task 는 순수 가드 helper + colocated spec 까지.
- env 이름 상수 집합·완전성 규칙·`isPresent` 정책 변경 0 (가드는 컴포저의 규칙을 mirror 재유도만, 재정의 0).
- 실 credential 값을 코드·spec·journal 에 적기 0 (§9). env 이름 상수·합성 더미 (예: `"x"`) 만 사용.
- result-issue-descriptor leaf 가드 (잔여 NO-GUARD 다른 한 종) — 별도 follow-up task.
- production `src/` 변경 / DB write·migration / live LLM 호출 / zod·ajv 등 외부 validation 라이브러리 도입 — 전부 0.
- 자동 복구 / gating 재합성 / 정규화 / 기본값 채움 0 — 손상 gating 은 fail-fast throw (복구는 호출처 책임).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
