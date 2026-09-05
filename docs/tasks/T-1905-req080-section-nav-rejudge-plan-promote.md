---
id: T-1905
title: REQ-080 탭 내비 축 재판정(IN_PROGRESS → DONE) + PLAN 134 행 승격 + components.md 동기
phase: P6
status: DONE
commitMode: direct
coversReq: [REQ-080]
estimatedDiff: 40
estimatedFiles: 4
independentStream: p6-req080-doc-sync
dependsOn: [T-1904]
touchesFiles:
  - docs/requirements.md
  - docs/PLAN.md
  - docs/architecture/components.md
  - docs/tasks/T-1905-req080-section-nav-rejudge-plan-promote.md
created: 2026-09-06
plannerNote: "P6 · REQ-080 구현 arc(T-1858 · T-1903 · T-1904) 전량 머지 후 §3.1 rule 6 의 REQ 당 1 회 재판정 + PLAN 134 행 승격"
---

# T-1905 — REQ-080 탭 내비 축 재판정(IN_PROGRESS → DONE) + PLAN 134 행 승격 + components.md 동기

## Why

[docs/PLAN.md](../PLAN.md) `134 행` 🔴 오너 지시(2026-08-26 UI 기본기)의 **유일한 잔여**였던 "AdminView 다수 섹션 탭/구획 내비게이션" 이 구현 2 조각으로 전량 main 에 안착했다 — 앞 조각 [T-1903](T-1903-admin-section-nav-component-css.md)(순수 component + 전역 CSS anchor, PR #1496, main `e66078d3`) · 뒤 조각 [T-1904](T-1904-adminview-mount-section-nav.md)(AdminView 마운트 + 섹션 id 5 종, PR #1497, main `77afecfb`). [CLAUDE.md](../../CLAUDE.md) `§3.1` 의 "REQ status 재판정은 그 REQ 를 구현하는 slice 가 머지된 뒤 REQ 당 1 회" 조건이 지금 충족되므로 본 `direct` doc-sync 1 회로 닫는다. T-1904 `§Out of Scope` 마지막 항목이 지목한 후속이 정확히 본 slice 다.

**issue-still-relevant pre-check (origin/main `982e1f2b` 실측)** — 세 지점 모두 **미박제**라 본 task 는 유효하다:

- [docs/requirements.md](../requirements.md) `99 행` REQ-080 의 status 칸이 여전히 `IN_PROGRESS` 이고, 그 괄호 서술이 "뒤 축(관리 화면 다수 섹션의 탭/구획 내비게이션)은 미shipped", "`role="tab"` · `aria-selected` · `role="tabpanel"` 매칭 0 건(head `edfb1a4b` 실측)", "재판정 slice = T-1859" 라고 적어 **현재 main 과 어긋난다**.
- [docs/PLAN.md](../PLAN.md) `134 행` bullet 마커가 `[ ]` 이고 본문이 "뒤 축 … 미shipped", "그 1 건이 아직 미shipped 라 마커는 `[ ]` 로 유지", "진행 pointer — … 소비처 배선은 T-1904(`pr`)가 잇는다" 로 남아 있다.
- [docs/architecture/components.md](../architecture/components.md) `119 행` Web UI row 의 `AdminView` 마운트 목록에 섹션 탭 내비가 없고, `grep -rn "AdminSectionNav" docs/architecture/` 히트 **0 건**이다.

반면 구현 실체는 main 에 있다 — `web/src/components/AdminSectionNav.tsx`(+ colocated spec), `web/src/styles/global.css` `127` · `136` · `142 행` 의 anchor 3 종 규칙, `web/src/views/AdminView.tsx` `122 행` import · `455 행` `runSelectAdminSection` · `1024 행` `<AdminSectionNav …>` 마운트 · `1330 행` 등 섹션 5 곳의 `id=` 부여. 동일 의도의 PENDING task 도 없다(`grep -rln "REQ-080" docs/tasks/` 히트 전량이 DONE 또는 구현 slice).

## Required Reading

- [docs/requirements.md](../requirements.md) `9 행`(status enum 정의) · `99 행`(REQ-080 row 전체 — 관련 task 칸 · 검증 위치 칸 · status 칸) · `100~101 행`(REQ-081 · REQ-082 의 `DONE` 재판정 서술 형식 — 근거 좌표 박제 관례).
- [docs/PLAN.md](../PLAN.md) `134 행` — 오너 지시 bullet 의 ① 서술 후반부 · "본 bullet 의 잔여" · "다음 행동" · "진행 pointer" 문장.
- [docs/tasks/T-1903-admin-section-nav-component-css.md](T-1903-admin-section-nav-component-css.md) frontmatter + `§Acceptance Criteria` — 앞 조각이 고정한 표면(component · className anchor 3 종 · 전역 CSS 규칙).
- [docs/tasks/T-1904-adminview-mount-section-nav.md](T-1904-adminview-mount-section-nav.md) `§Acceptance Criteria` · `§Out of Scope` 마지막 항목 — 뒤 조각의 배선 범위와 본 slice 지목.
- [docs/architecture/components.md](../architecture/components.md) `119 행`(Web UI row) · `133~135 행`(T-1446 실측 각주 — "구별 패널 10 종" · "mutation 러너 26 개" 수치의 출처와 미재측정 사실).
- [CLAUDE.md](../../CLAUDE.md) `§3.1`(재판정 rule 6) · `§12`(행 범위 표기 R1~R7).

## Acceptance Criteria

- [x] `docs/requirements.md` `99 행` REQ-080 의 status 칸을 `IN_PROGRESS` → `DONE` 으로 바꾸고, 괄호 서술을 **현재 main 실측 기준으로 갱신**한다 — 두 축(전역 스타일(CSS) 도입 · 관리 화면 다수 섹션의 탭/구획 내비게이션)이 모두 shipped 임을 각각의 실체 좌표와 함께 적는다. 뒤 축 근거로 최소 다음 좌표를 포함: `web/src/components/AdminSectionNav.tsx`(순수 component · className anchor 3 종 · `selectSection` 순수 함수), `web/src/styles/global.css` `127` · `136` · `142 행`(anchor 규칙), `web/src/views/AdminView.tsx` `122 행`(import) · `455 행`(`runSelectAdminSection`) · `1024 행`(마운트) · 섹션 5 곳의 `id=` 부여, slice pointer `T-1903`(PR #1496) · `T-1904`(PR #1497).
- [x] 같은 row 에서 **거짓이 된 문장을 남기지 않는다** — "뒤 축 … 은 미shipped", "`role="tab"` … 매칭 0 건(head `edfb1a4b` 실측)", "그 1 건이 미shipped 인 것이 본 row 를 `DONE` 으로 올리지 않는 유일한 사유", "재판정 slice = T-1859" 4 문장을 갱신 서술로 대체한다.
- [x] 같은 row 의 **관련 task / ADR 칸**에 `T-1903` · `T-1904` pointer 를 추가한다(기존 `T-1858` · ADR-0061 표기는 유지).
- [x] 같은 row 의 **검증 위치 칸**(현재 `e2e`)을 실측으로 1 회 재판정한다 — 본 REQ 의 검증 실체가 colocated vitest(`web/src/styles/globalCssContract.test.ts` · `web/src/components/AdminSectionNav.test.tsx` · `web/src/views/AdminView.test.tsx` · `web/src/views/adminViewConstants.test.ts`)뿐이고 `test/e2e/` 에 이 REQ 를 덮는 spec 이 0 건이면 `unit` 으로 좁히고(REQ-082 의 `101 행` 선례와 동일 기준), 반대 근거가 나오면 칸을 유지하되 **어느 쪽이든 그 판단 근거를 status 괄호 안에 1 문장으로 박제**한다.
- [x] `docs/PLAN.md` `134 행` bullet 마커를 `[ ]` → `[x]` 로 승격하고, ① 후반부 서술을 "뒤 축도 shipped" 로 갱신한다 — 승격 근거는 `requirements.md` `99 행` REQ-080 이 `DONE` 이라는 사실과 구현 slice 2 개(T-1903 · T-1904)이며, 승격 주체가 본 slice(T-1905)임을 REQ-074 ~ REQ-077 승격 문장(T-1801 형식)과 같은 방식으로 명시한다.
- [x] 같은 bullet 에서 **잔여 · 진행 pointer 문장을 정리**한다 — "본 bullet 의 잔여는 ① 후반부의 AdminView 다수 섹션 탭/구획 내비게이션 1 건뿐", "마커는 `[ ]` 로 유지", "진행 pointer — … T-1904(`pr`)가 잇는다" 3 문장을 제거하거나 완료 서술로 대체해 남은 잔여 0 임을 분명히 한다.
- [x] `docs/architecture/components.md` `119 행` Web UI row 의 `AdminView` 서술에 **섹션 탭 내비 마운트 1 항목**을 추가한다(`AdminSectionNav` 마운트 + slice pointer T-1903 · T-1904). 기존 수치 표기("구별 패널 **10 종**" · "mutation 러너 **26 개**")는 **재측정하지 않고 그대로 두되**, 내비가 패널 종수에 포함되지 않는다는 사실을 한 구절로 명시해 `133~135 행` 각주와 모순되지 않게 한다.
- [x] 위 3 파일 외 다른 문서 · 코드 파일 변경 0 (`git status --porcelain` 이 `docs/requirements.md` · `docs/PLAN.md` · `docs/architecture/components.md` · 본 task 파일만 보여야 한다).
- [x] 신규 · 갱신 문장의 행 범위 표기가 [CLAUDE.md](../../CLAUDE.md) `§12` R1~R7 을 따른다(구분자 `~`, 단일 행은 `99 행`, `L` prefix 0). 기존 표기의 소급 치환은 하지 않는다.
- [x] 문서 링크 무결성 — 새로 추가한 상대 경로 링크(`tasks/T-1903-…` · `tasks/T-1904-…` 등)의 대상 파일이 실재함을 확인한다.
- [x] 분기 없음 · 코드 변경 0 — doc-only `direct` task 이므로 [CLAUDE.md](../../CLAUDE.md) `§3.2` R-112 의 test 항목(happy / error / 분기 / negative / coverage)은 **해당 없음**. R-110 의 tester 면제 대상(direct doc-only commit)이다.

## Out of Scope

- 코드 · spec 변경 일체(`web/` · `src/` · `test/` · 워크플로 · `package.json`) — 본 task 는 `direct` doc-sync 다.
- `docs/architecture/modules.md` `240 행` · `docs/architecture/directory.md` `184 행` 의 `web/src/components/` 개수 표기(문서 `21 종` vs 실측 `31 종`) 재측정 — REQ-080 arc 와 무관한 별도 count drift 이므로 본 slice 에서 건드리지 않고 `§Follow-ups` 로 넘긴다.
- `components.md` `133~135 행` 각주의 "mutation 러너 26 개" 재측정, Web UI 외 7 row 판정.
- 다른 REQ row(REQ-081 ~ REQ-084 등) status 재판정 — 이미 `DONE` 이며 본 arc 소관이 아니다.
- PLAN 의 다른 bullet · 부채 항목 실측 갱신(AdminView 줄 수 재측정 등).
- 탭 전환 시 섹션 언마운트 · URL hash 동기화 같은 기능 확장 제안을 문서에 잔여로 새로 적는 것(요구 문언 밖).

## Suggested Sub-agents

`implementer` (문서 편집만 — `direct` doc-only 라 tester 미호출, [CLAUDE.md](../../CLAUDE.md) `§3.2` R-110 면제)

## Follow-ups

- (planner 후속 후보) `docs/architecture/modules.md` `240 행` · `docs/architecture/directory.md` `184 행` 의 `web/src/components/` 개수 표기 `21 종` → 실측 `31 종`(spec 도 1:1 `31`) 재동기 — REQ-080 arc 와 무관한 count drift 이므로 별도 `direct` slice 1 회.
