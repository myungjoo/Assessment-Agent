---
id: T-1436
title: directory.md `Frontend (web/) 의 위치` 단락 (183 ~ 195 행) 의 구조 claim ↔ 실 `src/web/` · `web/src/` 대조 + T-1435 유보 (serve-static · SPA fallback) closure + audit §12.34
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-004]
estimatedDiff: 190
estimatedFiles: 3
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1435]
touchesFiles:
  - docs/architecture/directory.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1436-directory-md-web-frontend-section-vs-src-audit.md
plannerNote: "uc-doc-audit-resync 48 번째 slice — T-1435 Follow-up 1 (web 축 유보) closure + directory.md 마지막 미대조 산문 단락. doc-only 1.6x"
---

# T-1436 — `Frontend (web/)` 단락 구조 claim ↔ 실 `web/src/` 대조 + T-1435 web 축 유보 closure

## Why

[T-1435](T-1435-directory-md-mapping-table-columns-vs-src-audit.md) 는 [directory.md](../architecture/directory.md) mapping 표의 두 컬럼을 닫으면서 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.33`, 각주 111 ~ 113 행), `WebModule` row 의 **serve-static mount · 비-`/api/*` SPA fallback · ADR-0040 옵션 1 shipped** 서술만은 "본 slice 실측 예산 밖" 이라며 명시적으로 **유보** 로 남겼다 (Follow-up 1). 그 유보가 본 slice 의 첫 번째 대상이다.

두 번째 대상은 같은 문서의 **마지막 미대조 산문 단락** 인 `## Frontend (web/) 의 위치` (183 ~ 195 행) 다. 이 단락은 지금까지 어느 slice 도 실측하지 않은 채, `web/src/` 하위를 **디렉토리 단위로 카운트까지 붙여** 열거한다 (`components/` **15** · `views/` **2** · `api/` 3 모듈 열거 · `AppShell.tsx` · `AuthGate.tsx` · `main.tsx`). directory.md 의 다른 구간은 T-1430 (표 경로 축) · T-1432 (ASCII 트리) · T-1433 (sub-structure 이름 축) · T-1434 (`용도` 컬럼) · T-1435 (mapping 표 2 컬럼) 이 모두 대조를 마쳤으므로, 본 단락이 닫히면 **directory.md 의 구조 claim 전 구간이 1 회 이상 실측 대조** 를 거친 상태가 된다.

planner 사전 확인 (executor 가 AC 1 에서 전부 재측정) — 최소 3 건의 검증 가능한 불일치가 확인된다. ① `web/src/components/` "**15** presentational 컴포넌트" vs 실 non-test `*.tsx` **21**, ② `web/src/api/` "thin fetch hook (`apiClient` · `useApiResource` · `auth`)" vs 실 non-test 모듈 **6** (`exportJob` · `exportJobDownload` · `exportJobFlow` 3 개 미기재), ③ 단락이 열거한 진입 파일 3 개 (`AppShell.tsx` · `AuthGate.tsx` · `main.tsx`) 외에 **`web/src/App.tsx` 가 실재하나 미기재**. 반면 `web/src/views/` "**2** view 컨테이너 (`DashboardView` · `AdminView`)" 는 실측 **2** 로 참이고, `src/web/` 의 serve-static · `/api/*` 제외 claim 도 `web.module.ts` 의 `ServeStaticModule` + `API_EXCLUDE_PATTERN` 으로 **참** 이다. 다만 mount 는 **무조건이 아니라 `web/dist/index.html` 존재 시에만** 등록되는 조건부라 (`resolveServeStaticOptions` 가 부재 시 빈 배열 반환), 표 · 단락의 무조건 서술은 **부분참** 후보다. 즉 본 축도 선행 5 slice 와 같이 `참 / 부분참 / 거짓` 으로 갈린다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/directory.md` — **199 행**. 다음 구간만 읽는다.
  - **183 ~ 195 행** (`## Frontend (web/) 의 위치` heading + 도입 산문 + `repo-root web/` · `src/web/` 2 항목 + `web/src/` 5 항목 열거 + 마무리 문단) — 본 slice 의 **주 편집 후보 구간**.
  - **106 행** (mapping 표 `WebModule` row) · **111 ~ 113 행** (T-1435 각주 3 blockquote — 마지막 행이 본 slice 의 위임 원문 "`WebModule` 의 serve-static · SPA fallback 서술은 … **유보**") — **무편집 원칙**, 반드시 인용해 승계한다.
  - **52 · 77 · 81 ~ 82 · 108 행** (T-1430 ~ T-1434 각주 4 종) — **무편집**, 각주 화법 · attribution 규약 template 확인용.
  - **3 · 19 · 55 행** (시점 blueprint 선언 3 지점) — **무편집**, 판정의 최강 제약. 단 `Frontend (web/)` 단락은 [T-0397](T-0397-directory-md-web-frontend-doc-sync.md) 이 **P6 시점에 갱신한 현재형 서술** 이라 T-0021 blueprint 성격과 다르다 — 이 성격 차이가 (A) in-place 채택 가능성을 여는 핵심 논점이다.
  - **196 ~ 199 행** (`## References` + `Refs:` 말미) — **무편집** 경계 확인용 (ADR-0040 · ADR-0041 · T-0397 pointer 3 개가 본 단락의 source 로 이미 등재됨을 확인만).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **3288 행**. **`### 12.15`** (시점 기록 append-only 처리 방침 정본) · **`### 12.33`** (**3160** 행 — T-1435 판정표 화법 template + 유보 원문) · **`## 11. References` (3275 행)** — `§ 12.34` 삽입 위치 경계.
- `src/web/web.module.ts` — **무편집, 읽기만**. `ServeStaticModule` import · `WEB_DIST_PATH` · `API_EXCLUDE_PATTERN` · `resolveServeStaticOptions` 의 dist 부재 분기.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.34` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 편집을 중단** 하고 불성립 사실을 `§ 12.34` 에 기록한다.
  - (i) **단락 원문 전수**: `sed -n '183,195p' docs/architecture/directory.md` 로 원문을 인용하고, **실측으로 참·거짓을 가릴 수 있는 claim** (디렉토리 존재 · 파일명 · 개수 · 기술 스택 · shipped 여부) 만 뽑아 열거한다. 순수 설계 의도 · 역할 서술 (예: "backend `src/` 와 빌드 분리") 은 **검증 불가 claim** 으로 분류해 판정 대상에서 제외하고, 이 이분 자체를 남긴다.
  - (ii) **`web/src/` 하위 카운트 축 (1 회 실측)**: `ls web/src/components/*.tsx | grep -v '\.test\.' | wc -l` · `ls web/src/views/*.tsx | grep -v '\.test\.' | wc -l` · `ls web/src/api/*.ts | grep -v -e '\.test\.' -e contract | wc -l` · `ls web/src/*.tsx` 4 개 출력을 인용해 단락이 주장한 **15 / 2 / 3 모듈 / 진입 파일 3** 과 대조한다. 기대 — components **21** · views **2** · api **6** · 최상위 `*.tsx` 에 **`App.tsx` 포함**. test 파일 제외 기준 (`.test.` suffix) 을 1 구로 명시해 카운트 재현성을 남긴다.
  - (iii) **`src/web/` serve 축 (T-1435 유보 closure)**: `ls src/web/` 와 `grep -n "ServeStaticModule\|API_EXCLUDE_PATTERN\|WEB_DIST_PATH\|existsSync" src/web/web.module.ts` 출력을 인용해 — `@nestjs/serve-static` 사용 **참**, `web/dist/` mount 대상 **참**, 비-`/api/*` fallback 의 실체가 `exclude` 패턴 (`/api/(.*)`) **참**, 그리고 mount 가 **`web/dist/index.html` 존재 시에만 등록되는 조건부** 인지 여부를 판정한다. 조건부가 확인되면 106 행 표 · 190 행 산문의 **무조건 서술을 `부분참`** 으로 분류하고, 그 근거 1 구를 `§ 12.34` 에 남긴다.
  - (iv) **`web/dist/` 실재 축**: `ls -d web/dist 2>&1` 1 회로 확인한다. **부재 (`No such file`) 가 기대값** 이며 (build 산출물 · gitignore 대상), 이 사실이 (iii) 조건부 판정의 운영 의미 — "현 저장소 상태에서 SPA serve 등록 수는 **0**" — 를 1 구로 기록한다. `pnpm build` 등 **빌드 실행 금지** (측정만).
  - (v) **shipped 근거 pointer 축**: `ls docs/decisions/ADR-0040-frontend-stack.md docs/decisions/ADR-0041-frontend-composition-wiring.md` 로 두 ADR 실재를 확인하고, ADR **본문 재판정은 하지 않는다** (파일 존재 = pointer 유효까지만). 단락이 인용한 `T-0354 shipped` · `T-0353~T-0394` 범위는 **task 파일 존재 여부만** `ls docs/tasks/T-0354-*.md 2>&1` 1 회로 확인한다.
  - (vi) baseline — `wc -l` directory.md **199** · audit **3288** · modules.md **259**, `grep -c '^## '` directory.md **10** · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **33**.
- [ ] **AC 2 — 지점 판정표**: AC 1 이 뽑은 **검증 가능 claim** 각각에 대해 `in-place 수정` / `원문 보존 + 각주 부기` / `무편집` / `상위 slice 판정 승계` 중 하나를 판정한 표를 만든다. 각 row 는 **지점 (행) · claim 1 구 · 실측 결과 · 판정 (참 / 부분참 / 거짓) · 처리 · 근거 1 구** 6 컬럼.
  - 판정 기준 **3 축** 명시 — ① **문서 성격** (본 단락은 T-0021 blueprint 가 아니라 [T-0397](T-0397-directory-md-web-frontend-doc-sync.md) 의 **현재형 doc-sync 산물** 이라 `§ 12.15` append-only 제약이 같은 강도로 걸리는지), ② `§ 12.15` **정합**, ③ **선례** (같은 문서에서 5 회 채택된 "원문 보존 + 실측 각주" 화법 vs [T-1429](T-1429-api-md-module-vocab-and-uc-range-resync.md) 가 **시점 marker 부재** 를 근거로 채택한 "정본값 in-place 1:1 치환").
  - **카운트 축 (15 → 21 · 3 → 6) 과 서술 축 (조건부 mount) 의 처리를 분리 판정** 한다 — 전자는 T-1429 형 in-place 치환이 성립할 수 있는 순수 수치이고, 후자는 서술 재작성이라 각주가 안전하다. 한 슬라이스 안에서 두 처리가 갈려도 무방하나 그 이유를 반드시 1 구로 적는다.
  - **중복 각주 회피 판정** 을 포함 — 106 행 `WebModule` row 의 `(controller only)` **거짓** 판정은 **113 행 T-1435 각주에 이미 박제** 됐으므로 본 slice 는 반복하지 않고 참조만 한다.
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) **카운트·열거 in-place 동기** (15 → 21 · api 3 모듈 → 6 · `App.tsx` 추가), (B) **단락 원문 무편집 + 단락 말미 각주 blockquote 1 개 신설** (같은 문서 6 번째 각주), (C) **(A) + (B) 혼합** (수치는 in-place, 조건부 mount 서술만 각주), (D) **전 지점 무편집 + audit 기록만**.
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` 정합 (본 단락에 시점 marker 가 있는가 — `sed -n '183,195p' | grep -n "시점\|T-0"` 로 확인해 근거를 실측에 둔다), ② 독자 오도 risk (P6 implementer 가 "15 컴포넌트" 를 완전 목록으로 신뢰하는가), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 자동 기각 + split 제안 기록), ④ 선례 일관성 (T-1429 in-place vs T-1430 ~ T-1435 각주 5 연속 중 본 단락 성격에 맞는 쪽).
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다. 각 지점은 AC 2 판정 결과를 따른다.
  - **directory.md 편집은 각주 blockquote 1 개 (≤ 3 행) + in-place 치환 (≤ 4 지점) 이내** — `wc -l` 증가 **+4 이내** (199 → ≤ 203).
  - **수치·파일명은 AC 1 실측 출력과 1:1 일치** 해야 하며, 실측되지 않은 컴포넌트 이름 · 역할 서술을 **새로 창작하지 않는다** (21 개 컴포넌트 전수 열거 금지 — 카운트만).
  - **106 행 mapping 표 row 와 111 ~ 113 행 T-1435 각주는 무편집** (유보 closure 는 본 단락 쪽 각주 · audit 에서 선언하고 표 row 는 손대지 않는다).
  - **`## References` (196 ~ 198 행) 와 `Refs:` 말미 (199 행) 무편집** — 새 pointer 를 추가하지 않는다 (ADR-0040 · ADR-0041 · T-0397 이 이미 등재됨).
- [ ] **AC 5 — audit `§ 12.34` 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 `## 11. References` (3275 행) **직전** 에 `### 12.34 …` 절을 **순수 append** 한다 (기존 절 수정 0). 구성 — 본 절의 위치 · 계보 1 문단 / AC 1 실측 (명령 + 출력) / AC 2 지점 판정표 / AC 3 처리 판정표 / AC 4 반영 결과 + 무편집 경계 / **T-1435 유보 (web 축) closure 선언** / **directory.md 전 구간 대조 완료 선언** (T-1430 표 경로 · T-1432 트리 · T-1433 sub-dir 이름 · T-1434 `용도` · T-1435 mapping 2 컬럼 · 본 slice 산문 단락 — 6 축 열거) / 파생 영향 (목록만) / 불변 검산 / 한계. **절 전체 ≤ 115 행** (cap 준수 — 초과 시 실측 인용을 요약형으로 압축).
  - `###` 레벨이라 `grep -c '^## '` **12 불변** · `grep -c '^| REQ-'` **66 불변** · `grep -c '^### 12\.'` **33 → 34**.
- [ ] **AC 6 — 불변 검산**: 다음을 실행해 출력을 `§ 12.34` 에 인용한다. `wc -l` directory.md (199 → ≤ 203) · audit (3288 → +115 이내) · modules.md (**259 불변**), `git diff -U0 -- docs/architecture/directory.md | grep '^@@'` 로 **hunk 개수 · 위치** 를 보이고 AC 4 허용 구간 밖 hunk **0** 을 실증, `git diff --numstat` 으로 **순수 삭제 0** (삭제 행이 있으면 in-place 치환의 짝임을 1 구로 설명), `git status --porcelain src/ test/ prisma/ web/` **빈 출력** (코드 무변경), `git status --porcelain` 이 **3 파일** 임을 확인.
- [ ] **AC 7 — 파생 영향 기록 (목록만, 본 slice 편집 금지)**: `§ 12.34` 말미에 후속 slice 대상을 목록으로 남긴다. 최소 포함 — (1) UC-09 `§ 5` sequence participant 병기 (18 회째 이월), (2) 정본 modules.md 표 row 신설 축 (ADR 게이트 선행), (3) 행 번호 → anchor 좌표계 이행 (12 회째), (4) 산문 tally ↔ 실측 CI drift-guard spec, (5) [modules.md](../architecture/modules.md) "WebModule 의 frontend 분리" 단락의 동종 카운트 claim (본 slice 가 directory.md 만 닫았으므로 정본 쪽은 미대조 — 단 정본 편집은 ADR 게이트), (6) `§ 12.33` 파생 영향 중 미소진 항목.
- [ ] **AC 8 — R-110 / R-112 면제 근거 명시**: 본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 **N/A** 임을 `§ 12.34` 에 1 구로 명시한다.
- [ ] **AC 9 — 언어 · 링크 규약**: 추가 문장은 모두 한국어 (§12), 문서 간 참조는 상대경로 markdown 링크, 수치는 실측 출력과 1:1 일치.

## Out of Scope

- **코드 변경 절대 금지** — `src/` · `test/` · `prisma/` · `web/` · `scripts/` · `package.json` 은 diff 에 등장하면 안 된다. 특히 `web/dist/` 빌드 실행 (`pnpm build` · `pnpm --filter web build`), `src/web/` controller 신설, `web/src/App.tsx` ↔ `AppShell.tsx` 정리는 **어떤 경우에도 하지 않는다** (문서를 코드에 맞출 뿐, 코드를 문서에 맞추지 않는다).
- **정본 [modules.md](../architecture/modules.md) 편집 금지** — "WebModule 의 frontend 분리" 단락의 동종 카운트 claim 은 파생 영향 목록에만 남긴다 (ADR 게이트 소관).
- **mapping 표 (96 ~ 106 행) 재편집 금지** — `WebModule` row 포함 무편집. T-1435 각주 (111 ~ 113 행) 도 손대지 않고 **참조만** 한다.
- **21 개 컴포넌트 · 6 개 api 모듈의 전수 열거 금지** — 카운트와 미기재 사실만 기록한다 (열거는 cap 초과 + 유지보수 부채).
- **ADR-0040 · ADR-0041 본문 재판정 금지** — 파일 존재 확인까지만.
- **다른 문서로의 cascade 금지** — [components.md](../architecture/components.md) · [api.md](../architecture/api.md) · [data-model.md](../architecture/data-model.md) · `docs/architecture/INDEX.md` · [INDEX.md](../use-cases/INDEX.md) · `UC-01` ~ `UC-09` · ADR · [PLAN.md](../PLAN.md) · [requirements.md](../requirements.md) 는 무편집.
- **행 번호 → anchor 좌표계 이행 금지** — 파생 영향 목록에만 남긴다 (12 회째 이월).
- **CI drift-guard spec 작성 금지** — `pr` mode 소관이라 본 direct task 에서 진행하면 §3.1 위반.
- **audit 기존 절 (`§ 12.1` ~ `§ 12.33`) 수정 금지** — `§ 12.34` 순수 append 만.

## Suggested Sub-agents

`implementer` 단독 (doc-only, 코드 0 LOC — architect · tester 불요. §3.2 direct-mode 면제).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가)
