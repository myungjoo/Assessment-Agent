---
id: ADR-0061
title: Frontend 전역 스타일(CSS) 방식 — 순수 CSS 단일 파일 + 진입점 단일 import + 토큰 계약 guard
status: ACCEPTED
date: 2026-09-03
relatedTask: T-1858
supersedes: null
---

# ADR-0061 — Frontend 전역 스타일(CSS) 방식

## Context

[PLAN.md](../PLAN.md) `133 행` 의 오너 지시(UI 기본기, REQ-080~REQ-084)는 ② 로그아웃 · ③ 세션 복원 · ④ R-78 polling · ⑤ 여러 줄 오류가 모두 shipped 돼 **잔여가 ① 전역 CSS 도입 하나**뿐이며, 그 bullet 자신이 "CSS 방식(순수 CSS vs 라이브러리 새 dep)은 architect 판단 — 새 dep 시 [CLAUDE.md](../../CLAUDE.md) `§5` 게이트" 로 본 결정을 위임했다.

실측(T-1858 시점 origin/main): `web/` 전체에 `.css` · `.scss` 파일 **0 건**, `docs/decisions/` 에 스타일 방식 ADR **0 건**. [ADR-0040](ADR-0040-frontend-stack.md)(React + Vite · 정적 SPA · `§5` 새 dependency 는 도입 시점 게이트)와 [ADR-0041](ADR-0041-frontend-composition-wiring.md)(AppShell → 인증 게이트 → 화면 컨테이너 → presentational 위계, Decision 3 의 web `.test.ts` 명명)은 **둘 다 스타일을 결정하지 않았다** — 본 ADR 은 그 전제를 재논증하지 않고 인용만 하며, 위임된 스타일 축만 결정한다.

현 화면은 브라우저 기본 스타일만 적용돼 구획 · 간격 · 대비가 없다. 반면 `AppShell.tsx` 는 이미 `app-shell` · `app-shell-header` · `app-shell-main` · `app-shell-nav` · `app-shell-nav-item` · `app-shell-logout` · `enter-setup` 같은 className anchor 를, `ServiceIdentityRowActions.tsx` 는 `primary-badge` 를 마크업에 갖고 있다 — **스타일이 붙을 자리는 이미 있고 규칙만 없다**.

## Decision

### D1. 순수 CSS 단일 파일 — 새 외부 dependency 0

전역 스타일은 `web/src/styles/global.css` **단일 순수 CSS 파일**로 둔다. CSS 프레임워크(Tailwind · Bootstrap 등) · CSS-in-JS(styled-components · emotion) · 전처리기(Sass · Less) · PostCSS 플러그인을 **도입하지 않는다**. Vite 가 기본 제공하는 CSS 파이프라인(import 시 번들 주입, production build 시 추출)만 사용하므로 `web/package.json` · 루트 `package.json` · lockfile 이 **무변경**이며, 따라서 [CLAUDE.md](../../CLAUDE.md) `§5` 의 새-dep BLOCKED 게이트에 **해당하지 않는다**.

사유: 현 화면 규모(컴포넌트 ~18 개, view 3 종)에서 프레임워크의 이점보다 dependency 표면 · 빌드 복잡도 · `§5` 게이트 비용이 크다. 순수 CSS 는 도입 비용이 0 에 수렴하고, 나중에 필요해지면 그때 별도 ADR + `§5` 게이트로 승격하면 된다(되돌리기 쉬운 결정을 먼저).

### D2. 적용 경로는 진입점 side-effect import 1 곳뿐

`web/src/main.tsx` 에 `import './styles/global.css';` 한 줄만 둔다. **컴포넌트별 CSS import 를 금지**한다 — import 순서가 곧 cascade 순서인데, 컴포넌트마다 import 를 흩뿌리면 번들러의 모듈 그래프 순회 순서가 규칙 우선순위를 좌우해 예측 가능성이 무너진다. 진입점 1 곳이면 cascade 는 파일 안의 위→아래 순서 하나로 고정된다.

### D3. 값은 `:root` 토큰으로만, 규칙은 element selector + **기존** className anchor 만

색 · 간격 · 폰트 · 테두리 반경 같은 값은 `:root` 의 CSS custom property(`--color-*` · `--space-*` · `--font-*` · `--radius-*`)로 선언하고, 규칙은 그 토큰을 `var()` 로 참조한다(리터럴 색값을 규칙에 직접 쓰지 않는다). selector 는 element selector 와 **이미 마크업에 존재하는** className anchor 만 쓴다 — **신규 className 대량 도입은 본 ADR 범위 밖**이다(마크업 변경은 별도 slice 의 책임이며, 그래야 본 slice 의 diff 가 "스타일만" 으로 유지돼 회귀 표면이 작다).

### D4. 토큰 선언과 진입점 import 는 계약 guard spec 이 CI 게이트로 고정

CSS 는 타입 검사도 lint 도 받지 않아 조용히 깨진다(토큰 선언이 지워져도 `var()` 참조는 fallback 없이 무시될 뿐 빌드가 실패하지 않고, 진입점 import 가 빠져도 빌드는 통과한다). 그래서 순수 함수 2 개(`findMissingTokens` · `hasGlobalStylesheetImport`)를 `web/src/styles/globalCssContract.ts` 에 두고, colocated spec `globalCssContract.test.ts`([ADR-0041](ADR-0041-frontend-composition-wiring.md) Decision 3 의 web `.test.ts` 명명)가 **실파일을 `readFileSync` 로 읽어**(`AppShell.test.tsx` 관행) ① 필수 토큰 전부 선언 ② 진입점 import 존재를 단언한다. 두 함수는 DOM · fs 접근이 없는 순수 함수라 단위 검증이 쉽고, 실파일 읽기는 spec 쪽 책임으로 분리한다.

## Consequences

### 긍정

- 새 dependency 0 — `§5` 게이트 · 공급망 표면 · 빌드 복잡도 증가가 없다.
- 스타일 진입점이 1 곳이라 "이 규칙이 어디서 왔나" 추적이 파일 1 개 검색으로 끝난다.
- 토큰 계약이 CI 게이트라, 후속 slice 가 토큰을 지우거나 진입점 import 를 잃으면 즉시 red 로 드러난다.

### 부정

- 전역 CSS 는 스코프가 없어 규칙이 늘수록 충돌 위험이 자란다. D3 의 "기존 anchor 만" 제약과 파일 길이 상한(≤ 130 줄)이 1 차 억제책이고, 한계에 닿으면 CSS Modules 승격을 별도 ADR 로 재검토한다.
- 디자인 시스템 · 컴포넌트 라이브러리가 주는 기성 컴포넌트(모달 · 드롭다운 등)를 얻지 못한다 — 필요 시점에 `§5` 게이트로 도입 판단.

### 중립

- 본 결정은 REQ-080 후반부의 **AdminView 다수 섹션 탭/구획 내비게이션**을 포함하지 않는다(후속 slice). 마찬가지로 AdminView god component 부채와도 **무관** — 본 ADR 은 `.tsx` 를 진입점 import 1 줄 외에 건드리지 않으므로 그 부채를 늘리지도 줄이지도 않는다.
- 다크 모드 · 반응형 breakpoint · 애니메이션은 범위 밖. 단 D3 의 토큰화가 다크 모드의 사전 준비가 된다(`:root` 값 교체만으로 확장 가능).

## Alternatives considered

### UI 라이브러리 / CSS 프레임워크 (대안 1) — 기각

Tailwind · MUI · Bootstrap 등은 완성도 높은 기본기를 즉시 준다. 그러나 **새 외부 dependency** 라 `§5` BLOCKED 게이트(사람 승인) 대상이며, Tailwind 계열은 마크업의 className 을 전면 재작성해야 해 본 slice 의 "마크업 무변경" 경계와 정면 충돌한다. 기본기 한 줄을 켜기 위해 지불하기엔 비용이 크다.

### CSS Modules (대안 2) — 기각(현 시점)

Vite 는 `*.module.css` 를 새 dep 없이 지원하므로 dependency 비용은 0 이다. 그러나 스코프 격리는 **컴포넌트별 import** 를 전제하는데, 이는 D2 의 "진입점 1 곳" 과 충돌하고 컴포넌트마다 `.module.css` 를 신설해야 해 이번 slice 의 파일 수 cap 을 즉시 초과한다. 전역 reset · 토큰은 어차피 전역 CSS 가 필요하다 — 전역 층을 먼저 세우고, 스코프가 실제로 아쉬워지는 시점에 층을 추가하는 편이 순서상 옳다.

### 인라인 style 객체 (대안 3) — 기각

`style={{...}}` 는 dependency 0 이지만 `:hover` · 미디어 쿼리 · pseudo-element 를 표현하지 못하고, 값이 컴포넌트마다 흩어져 토큰화(D3)가 불가능하며, 모든 `.tsx` 를 수정해야 한다.

## References

- [PLAN.md](../PLAN.md) `133 행` — UI 기본기 오너 지시(잔여 ① 전역 CSS)
- [requirements.md](../requirements.md) `99 행` — REQ-080
- [ADR-0040](ADR-0040-frontend-stack.md) — React + Vite · 정적 SPA · `§5` 새-dep 절차
- [ADR-0041](ADR-0041-frontend-composition-wiring.md) — 컴포지션 위계 · Decision 3 web `.test.ts` 명명
- [T-1858](../tasks/T-1858-web-global-stylesheet-adr-wire.md)
