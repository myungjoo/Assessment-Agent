---
id: T-1858
title: 전역 스타일(CSS) 방식 ADR 박제 + web 진입점 배선
phase: P6
status: DONE
commitMode: pr
prNumber: 1459
coversReq: [REQ-080]
estimatedDiff: 400
estimatedFiles: 5
estimatedFilesNote: ADR 1 + global.css 1 + 계약 helper 1 + colocated spec 1 + main.tsx 배선 1 = 5 (cap 준수)
sizeExempt: true
exemptReason: adr-plus-consumer-wiring
independentStream: web-global-style
dependsOn: []
touchesFiles:
  - docs/decisions/ADR-0061-frontend-global-stylesheet.md
  - web/src/styles/global.css
  - web/src/styles/globalCssContract.ts
  - web/src/styles/globalCssContract.test.ts
  - web/src/main.tsx
created: 2026-09-02
plannerNote: "P6 PLAN 133 행 UI 기본기의 유일 잔여 ① 전역 CSS 착수. cap-bend pre-justified: ADR 신설(doc-only enumerated-section) × 1.6 = 400 LOC, T-0061 ADR-first + PLAN 181 소비처 동반 의무 정당화"
---

# T-1858 — 전역 스타일(CSS) 방식 ADR 박제 + web 진입점 배선

## Why

[PLAN.md](../PLAN.md) `133 행` 의 🔴 오너 지시(UI 기본기, REQ-080~REQ-084)는 ② 로그아웃 · ③ 세션 복원 · ④ R-78 polling · ⑤ 여러 줄 오류가 모두 shipped 돼 **잔여가 ① 전역 CSS 도입 하나**뿐이며, 그 bullet 자신이 "CSS 방식(순수 CSS vs 라이브러리 새 dep)은 architect 판단 — 새 dep 시 §5 게이트" 라고 다음 행동을 지정한다. 최근 5 fire(T-1853~T-1857)가 모두 AdminView 순수 추출 slice 였으므로, 같은 패턴 반복 대신 오너 지시 bullet 의 마지막 잔여를 연다.

**issue-still-relevant pre-check (origin/main `f682e32e` 실측)**: `web/` 전체에 `.css`/`.scss` 파일 **0 건**(`git ls-tree -r origin/main web/` — 미안착 확정) · `docs/decisions/` 에 스타일 방식 ADR **0 건**(ADR-0040 frontend stack · ADR-0041 composition 만 존재, 둘 다 스타일 미결정) · [requirements.md](../requirements.md) `99 행` REQ-080 은 `PLANNED` · `web/src/main.tsx` 는 scaffold 이후 무변경. 즉 본 task 의 의도는 어느 축으로도 main 에 박제돼 있지 않다.

본 slice 는 **결정(ADR) + 그 결정의 첫 소비처 배선**을 한 PR 로 묶는다 — [CLAUDE.md](../../CLAUDE.md) `§3` 소비처 동반 의무(순수 asset/helper 단독 slice 금지)에 따라 stylesheet 파일만 두고 import 를 다음 slice 로 미루지 않는다(그러면 화면 변화가 0 이라 reviewer 도 CI 도 아무것도 검증하지 못한다).

## Required Reading

- [docs/PLAN.md](../PLAN.md) `133 행` (UI 기본기 bullet — 잔여 ① 서술)
- [docs/requirements.md](../requirements.md) `99 행` (REQ-080 row)
- [docs/decisions/ADR-0040-frontend-stack.md](../decisions/ADR-0040-frontend-stack.md) (React + Vite · 정적 SPA 전제 — 재논증 금지, 인용만)
- [docs/decisions/ADR-0041-frontend-composition-wiring.md](../decisions/ADR-0041-frontend-composition-wiring.md) (`.test.ts` 명명 관행 = Decision 3)
- [web/src/main.tsx](../../web/src/main.tsx) (진입점 — import 를 붙일 유일 지점)
- [web/src/AppShell.tsx](../../web/src/AppShell.tsx) `484 행` · `487 행` · `493 행` · `533 행` · `538 행` · `574 행` (기존 className anchor: `app-shell` / `app-shell-header` / `app-shell-main` / `app-shell-nav` / `app-shell-nav-item` / `enter-setup`)
- [web/src/AppShell.test.tsx](../../web/src/AppShell.test.tsx) `1~20 행` (vitest 관행 — node 환경 + `readFileSync` + `renderToStaticMarkup`)
- [web/vite.config.mts](../../web/vite.config.mts), [web/package.json](../../web/package.json) (빌드/테스트 스크립트 — 변경 대상 아님)

## Acceptance Criteria

### 결정 박제

- [ ] `docs/decisions/ADR-0061-frontend-global-stylesheet.md` 를 status `ACCEPTED` 로 신설하고 다음 4 결정을 박제한다 — **D1** 순수 CSS 단일 파일(`web/src/styles/global.css`), CSS 프레임워크 · CSS-in-JS · 전처리기 등 **새 외부 dependency 0**(Vite 기본 CSS 파이프라인만 사용 → [CLAUDE.md](../../CLAUDE.md) `§5` 새-dep 게이트 미해당) · **D2** 적용 경로는 진입점 `web/src/main.tsx` 의 side-effect import **1 곳뿐**(컴포넌트별 CSS import 금지 — cascade 예측 가능성 보존) · **D3** 값은 `:root` custom property 토큰으로만 정의하고 규칙은 element selector + **기존** className anchor 만 사용(신규 className 대량 도입은 본 ADR 범위 밖) · **D4** 토큰 선언과 진입점 import 는 계약 guard spec 이 CI 게이트로 고정.
- [ ] 같은 ADR 에 Alternatives(UI 라이브러리 · CSS Modules · 인라인 style)와 각 기각 사유, Consequences(탭/구획 내비게이션은 후속 slice · AdminView god component 부채와 무관)를 적는다. ADR 본문 ≤ 110 줄 — ADR-0040/0041 의 전제는 **재논증하지 말고 링크로 인용**한다.

### 구현

- [ ] `web/src/styles/global.css` 신설 — ① `:root` 토큰(색 · 간격 · 폰트 · 테두리 반경) ② 최소 reset(`box-sizing` · `margin` 초기화) ③ 기본 element 스타일(`body` · 제목 · `table`/`th`/`td` · `button` · `input`/`select` · `[role="alert"]`) ④ 기존 anchor(`.app-shell` · `.app-shell-header` · `.app-shell-main` · `.app-shell-nav` · `.app-shell-nav-item` · `.enter-setup` · `.primary-badge`) 의 구획 · 간격 스타일. 파일 ≤ 130 줄, `@import` 로 외부 URL 을 가져오지 않는다.
- [ ] `web/src/main.tsx` 에 `import './styles/global.css';` 를 추가한다(다른 변경 없음).
- [ ] `web/src/styles/globalCssContract.ts` 신설 — 순수 함수 2 개: `findMissingTokens(css: string): string[]`(필수 토큰 상수 `REQUIRED_CSS_TOKENS` 중 **선언**(`--x:`)이 없는 것을 반환 — `var(--x)` 참조만으로는 선언으로 치지 않는다), `hasGlobalStylesheetImport(entrySource: string): boolean`(진입점 소스가 stylesheet 를 side-effect import 하는지 — 주석 처리된 줄은 false). DOM · fs 접근 금지(순수).

### 테스트 (R-112)

- [ ] **happy-path**: `findMissingTokens` 가 전 토큰이 선언된 CSS 에 대해 `[]` 를 반환 + `hasGlobalStylesheetImport` 가 실제 import 줄에 대해 `true` 를 반환하는 test 각 1+.
- [ ] **error path**: 빈 문자열 · 토큰 0 개 CSS 에 대해 `findMissingTokens` 가 전 토큰을 반환하고, `hasGlobalStylesheetImport` 가 빈 소스에 대해 `false` 를 반환하는 test 각 1+.
- [ ] **분기 cover**: `findMissingTokens` 의 "선언 있음 / 일부만 선언 / 참조만 존재" 3 분기, `hasGlobalStylesheetImport` 의 "정상 import / 주석 처리된 import / 다른 경로 import" 3 분기를 각각 별도 test 로 나눈다.
- [ ] **negative cases 충분 cover**: (a) `var(--color-bg)` 참조만 있고 선언이 없는 CSS → 그 토큰이 missing 으로 잡힌다 (b) `// import './styles/global.css';` 주석 줄만 있는 소스 → `false` (c) `import './styles/other.css';` → `false` (d) 유사 접두 토큰(`--color-bg-alt` 만 선언) 이 `--color-bg` 선언으로 오인되지 않는다 — 각 1+ test.
- [ ] **실파일 계약 guard**: 같은 spec 이 `readFileSync` 로 `web/src/styles/global.css` 와 `web/src/main.tsx` 를 읽어 `findMissingTokens(...)` 가 `[]` 이고 `hasGlobalStylesheetImport(...)` 가 `true` 임을 단언한다([AppShell.test.tsx](../../web/src/AppShell.test.tsx) 의 `readFileSync` 관행 준수).
- [ ] spec 은 colocated `web/src/styles/globalCssContract.test.ts` 에 둔다(ADR-0041 Decision 3 의 web `.test.ts` 명명 — `check-spec-presence` 게이트 통과 조건).

### 검증 명령

- [ ] `pnpm --filter web test` 통과.
- [ ] `pnpm --filter web build` 통과(`tsc --noEmit` + `vite build` — CSS 가 번들에 포함되는지까지 확인).
- [ ] 루트 `pnpm lint && pnpm build && pnpm test` 통과(회귀 0 — 루트 jest 는 `web/` 를 대상으로 하지 않으므로 coverage threshold 영향 없음).
- [ ] 새 외부 dependency 0 — `web/package.json` · 루트 `package.json` · lockfile 무변경(diff 에 나타나면 §5 위반).

## Out of Scope

- CSS 프레임워크 · UI 라이브러리 · CSS Modules · 전처리기 도입(= 새 dependency → §5 BLOCKED 대상). 본 slice 는 순수 CSS 만.
- REQ-080 후반부의 **AdminView 다수 섹션 탭/구획 내비게이션** — 별도 후속 slice.
- 기존 컴포넌트의 마크업 · className 추가/변경(`main.tsx` 의 import 1 줄 외 `.tsx` 수정 금지). AdminView 는 손대지 않는다.
- `docs/requirements.md` REQ-080 status 재판정 · `docs/PLAN.md` `133 행` 마커 갱신 — [CLAUDE.md](../../CLAUDE.md) `§3.1` 5·6 에 따라 **머지 후 1 회** direct task 로.
- 다크 모드 · 반응형 breakpoint · 애니메이션 — 기본기 slice 범위 밖.
- `web/vite.config.mts` · `web/package.json` · CI workflow 변경.

## Suggested Sub-agents

`architect → implementer → tester`

## 결과 (2026-09-03T00:53Z DONE)

- [ADR-0061](../decisions/ADR-0061-frontend-global-stylesheet.md) 신설 (ACCEPTED, 78 줄) — 전역 스타일 방식을 **순수 CSS 단일 파일 · 새 dependency 0** 으로 확정하고 D1~D4 (단일 파일 · 진입점 side-effect import 1 곳 · `:root` 토큰 전용 · 계약 guard CI 게이트) 를 박제했다. 새 dep 이 없어 [CLAUDE.md](../../CLAUDE.md) `§5` 새-dep 게이트 미해당.
- `web/src/styles/global.css` (123 줄) — 토큰 15 종 + reset + element 기본 + 기존 마크업이 이미 쓰던 anchor 8 종. 외부 `@import` 0. `web/src/main.tsx` 에는 side-effect import 1 줄만 추가해 마크업 · className 은 무변경 (화면 변화는 스타일 적용으로만 발생).
- `web/src/styles/globalCssContract.ts` 순수 함수 2 개 (`findMissingTokens` · `hasGlobalStylesheetImport`, DOM · fs 미접근) + colocated `globalCssContract.test.ts` 가 토큰 선언과 진입점 import 를 CI 게이트로 고정 — R-112 4 종 (happy · error · 분기 · negative (a)~(d) 유사 접두 토큰 오인 포함) cover.
- 검증: web vitest 122 파일 3,646 test · 루트 466 suite 13,495 test · `pnpm --filter web build` 산출물 CSS 2.03 kB 확인. 새 외부 dependency 0 (`package.json` · lockfile 무변경).
- diff 381 LOC / 5 파일 — frontmatter `sizeExempt: true` (`adr-plus-consumer-wiring`, `estimatedDiff: 400`) 로 planner 가 사전 정당화한 cap-bend (ADR 78 줄 + spec 109 줄 제외 시 제품 코드 191 줄).
- reviewer VERDICT=APPROVE (round 1), CI green → [PR #1459](https://github.com/myungjoo/Assessment-Agent/pull/1459) squash 머지 [`5ae7e13d`](https://github.com/myungjoo/Assessment-Agent/commit/5ae7e13d).

## Follow-ups

- (머지 후, direct) `docs/requirements.md` `99 행` REQ-080 status 재판정 + `docs/PLAN.md` `133 행` 잔여 ① 서술 갱신.
- (후속 pr) REQ-080 후반부 — AdminView 섹션 탭/구획 내비게이션 배선 + 그 className 의 전역 CSS 규칙.
