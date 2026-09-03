---
id: T-1859
title: REQ-080 전역 스타일 축 재판정 + PLAN 133 행 ① 갱신 + 183 행 부채 3 차 실측
phase: P6
status: PENDING
commitMode: direct
coversReq: [REQ-080]
independentStream: req-080-global-style-rejudge
dependsOn: [T-1858]
touchesFiles:
  - docs/requirements.md
  - docs/PLAN.md
estimatedDiff: 10
estimatedFiles: 2
estimatedFilesNote: requirements.md 1 row + PLAN.md 2 bullet(133 행 · 183 행) = 2 파일. 두 문서 모두 bullet 1 개 = 물리 1 행이라 git LOC 은 작고 문자량은 크다 — LOC 수치로 크기를 오판하지 말 것.
created: 2026-09-03
plannerNote: "P6 REQ-080 구현 후 1 회 재판정(§3.1 rule 6). pre-check: main 374cc047 에 REQ-080=PLANNED · ADR-0061 참조 0 · PLAN 183 행 5,569 줄 표기 vs 실측 5,044 줄 → 3 건 모두 미안착"
---

# T-1859 — REQ-080 전역 스타일 축 재판정 + PLAN 133 행 ① 갱신 + 183 행 부채 3 차 실측

## Why

[T-1858](T-1858-web-global-stylesheet-adr-wire.md) (PR #1459, main `5ae7e13d`) 이 [ADR-0061](../decisions/ADR-0061-frontend-global-stylesheet.md) 과 `web/src/styles/global.css` · `web/src/main.tsx` 진입점 배선을 머지해 [PLAN.md](../PLAN.md) `133 행` 오너 지시(UI 기본기)의 잔여 ① **전역 스타일 도입 축이 shipped** 됐다. [CLAUDE.md](../../CLAUDE.md) `§3.1` 판정 규칙 6 대로 **구현 slice 머지 후 1 회만** REQ status 를 재판정하는 시점이 지금이며, 그 재판정과 같은 문서군의 좌표 drift 정정을 한 `direct` slice 로 묶는다 — 오너 지시 [PLAN.md](../PLAN.md) `182 행`(재판정 왕복 제거) · `181 행`(슬라이스 과분할 차단) 이 doc-sync churn 을 줄이라고 지시하므로 같은 fire 안에서 처리한다.

**issue-still-relevant pre-check (origin/main `374cc047` 실측 — 3 건 모두 미안착 확인)**:

- [requirements.md](../requirements.md) `99 행` REQ-080 status = `PLANNED` (재판정 미안착).
- `git grep "ADR-0061" origin/main -- docs/requirements.md docs/PLAN.md` 결과 **0 건** — 전역 CSS shipped 사실이 두 문서 어디에도 박제되지 않았다.
- [PLAN.md](../PLAN.md) `133 행` 말미가 아직 "잔여는 ① 전역 CSS 도입 하나뿐 … 그 하나가 여전히 미shipped" 로 적혀 있어 **사실과 어긋난다**.
- [PLAN.md](../PLAN.md) `183 행` 부채 bullet 은 `5,569 줄 · 선언 150 개 (2026-09-03 head 실측)` 과 **순수 추출 4 슬라이스**를 적고 "다음 대상 = 인원(person) mutation 러너 군" 을 지목하는데, 그 뒤로 [T-1856](T-1856-adminview-person-mutation-runners-extract.md)(`adminPersonMutationRunners.ts`) · [T-1857](T-1857-adminview-llm-provider-mutation-runners-extract.md)(`adminLlmProviderMutationRunners.ts`) 2 슬라이스가 머지됐다. head 실측은 **5,044 줄 · 선언 129 개**(`-525 줄`)이고 지목된 "다음 대상" 은 이미 추출 완료라 **수치·지목 양쪽이 stale** 이다.

본 slice 는 판단을 새로 만들지 않고 **이미 main 에 있는 사실을 문서 좌표에 반영**하는 정정이다.

## Required Reading

- [docs/requirements.md](../requirements.md) `9 행`(상태 enum 정의) · `99 행`(REQ-080 row) · `102 행`(REQ-083 row — 다축 REQ 의 근거 서술 서식 참고)
- [docs/PLAN.md](../PLAN.md) `133 행`(UI 기본기 bullet) · `183 행`(AdminView god component 부채 bullet)
- [docs/tasks/T-1858-web-global-stylesheet-adr-wire.md](T-1858-web-global-stylesheet-adr-wire.md) `## 결과` 와 `## Follow-ups`
- [docs/decisions/ADR-0061-frontend-global-stylesheet.md](../decisions/ADR-0061-frontend-global-stylesheet.md) (D1~D4 — 인용만, 재논증 금지)
- [CLAUDE.md](../../CLAUDE.md) `§3.1` 판정 규칙 5·6, `§12` 범위 좌표 표기(`~` 구분자 · `L` prefix 금지)

## Acceptance Criteria

### REQ-080 재판정 (requirements.md `99 행`)

- [ ] REQ-080 row 의 status 를 `PLANNED` → **`IN_PROGRESS`** 로 바꾼다. 근거: 문언이 두 축("전역 스타일(CSS) 도입" + "관리 화면 다수 섹션의 탭/구획 내비게이션")이고 **앞 축만 shipped** 이므로 `DONE` 이 아니다(`9 행` 상태 enum 정의 준수).
- [ ] 같은 row 의 근거 칸에 shipped 축의 **검증 가능한 좌표**를 박제한다 — [ADR-0061](../decisions/ADR-0061-frontend-global-stylesheet.md)(D1 순수 CSS 단일 파일 · 새 dependency 0 / D2 진입점 side-effect import 1 곳 / D3 `:root` 토큰 전용 / D4 계약 guard CI 게이트) · `web/src/styles/global.css` · `web/src/main.tsx` 의 import 1 줄 · 계약 guard `web/src/styles/globalCssContract.ts` + colocated `globalCssContract.test.ts` · slice `T-1858`(PR #1459, main `5ae7e13d`).
- [ ] 같은 근거 칸에 **잔여 축 1 건**(관리 화면 다수 섹션 탭/구획 내비게이션 — 미shipped)을 명시하고, 그것이 `IN_PROGRESS` 판정의 사유임을 한 구절로 적는다.
- [ ] 행 좌표 표기는 `§12` 규약을 따른다(구분자 `~` 하나 · 단일 행은 `99 행` · `L` prefix 금지).

### PLAN `133 행` ① 조각 갱신

- [ ] 잔여 ① 서술을 **shipped 서술로 교체**한다 — 다른 조각(② 로그아웃 · ③ 세션 복원 · ④ R-78 polling · ⑤ 여러 줄 오류)의 기존 shipped 서술 서식(날짜 + slice 링크 + 좌표 + 근거 REQ row 참조)을 그대로 따른다.
- [ ] bullet 말미의 "본 bullet 의 잔여는 ① 전역 CSS 도입 하나뿐 … 여전히 미shipped" 문장을 **사실에 맞게 고친다** — 잔여는 이제 REQ-080 후반부의 **탭/구획 내비게이션 1 건**이며, 그 1 건이 미shipped 이므로 마커는 `[ ]` **유지**(승격 금지).
- [ ] 이미 이행된 지시 "CSS 방식(순수 CSS vs 라이브러리 새 dep)은 architect 판단 — 새 dep 시 §5 게이트" 와 "planner: R-187~R-191 REQ row 동기 후 task 분해" 는 **완료 사실과 함께 다음 행동으로 대체**한다 — 다음 행동 = AdminView 섹션 탭/구획 내비게이션 slice(마크업 anchor 추가 + 그 className 의 전역 CSS 규칙, `pr`). ADR-0061 D3(신규 className 대량 도입은 ADR 범위 밖)과의 관계를 한 구절로 적는다.

### PLAN `183 행` 부채 3 차 실측

- [ ] `web/src/views/AdminView.tsx` 를 bullet 이 박제한 **측정 방법 그대로** 재측정해 수치를 갱신한다 — LOC 은 `wc -l`, 선언 수는 `grep -cE '^(export )?(async )?(function|const|let|type|interface|class|enum) '`. (planner 가 origin/main `374cc047` 에서 실측한 값은 **5,044 줄 · 선언 129 개** 이며, executor 는 작업 시점 head 에서 **다시 측정해** 그 값과 측정 commit sha 를 적는다.)
- [ ] 최초 기록(2026-08-31 · 6,087 줄) 대비 누적 증감과 **목표선 ≤ 2,000 줄 까지의 잔여**를 갱신한다. 기존 bullet 의 "동일 방법 비교가 성립하는 지표는 LOC 뿐(선언 수는 indicative)" 단서는 **유지**한다.
- [ ] 순수 추출 슬라이스 목록을 **6 건으로** 갱신한다 — 기존 4 건(`adminServiceIdentityRowActions.tsx` · [T-1830](T-1830-adminview-collection-target-runners-extract.md) · [T-1852](T-1852-adminview-service-identity-runners-extract.md) · [T-1854](T-1854-adminview-group-part-mutation-runners-extract.md))에 [T-1856](T-1856-adminview-person-mutation-runners-extract.md)(`web/src/views/adminPersonMutationRunners.ts`) · [T-1857](T-1857-adminview-llm-provider-mutation-runners-extract.md)(`web/src/views/adminLlmProviderMutationRunners.ts`) 을 추가하고 각 슬라이스의 순 감소량을 적는다.
- [ ] **stale 해진 "다음 대상" 지목을 교체**한다 — 기존 지목(인원 mutation 러너 군 11 심볼, 좌표 `1788~1893 행` · `2222~2416 행`)은 T-1856 이 이미 추출 완료했다. 새 지목은 **import/export 러너 군**(`DownloadDeps` ~ `clearImportConfirm` 연속 1 블록 — `browserDownloadDeps` · `buildExportInput` · `RunAdminExportJobDeps` · `runAdminExportJob` · `ImportDeps` · `runImport` · `ImportPreviewDeps` · `runImportPreview` · `ConfirmImportDeps` · `runConfirmedImport` · `clearImportConfirm`)이며, **좌표는 executor 가 head 에서 직접 측정해** `NNNN~NNNN 행` 과 측정 commit sha 를 함께 적는다(planner 실측 참고값: `374cc047` 기준 `1117~1366 행`).
- [ ] 새 지목의 **경계 밖 심볼**을 명시해 다음 slice 가 범위를 오판하지 않게 한다 — 위쪽 `AssignDeps` / `runAssign`(난이도 매핑 축) · 아래쪽 `ScheduleMutationDeps` 이후(스케줄·재평가 축)는 포함하지 않는다.
- [ ] 마커는 `[ ]` **유지**(목표선 ≤ 2,000 줄 미달).

### 공통 검증

- [ ] `git diff --stat` 이 `docs/requirements.md` · `docs/PLAN.md` **2 파일만** 보여준다(코드 · 다른 문서 변경 0 → `commitMode: direct` 판정 유지).
- [ ] 세 갱신 지점에 적힌 모든 파일 경로 · 심볼명 · 행 좌표가 **작업 시점 head 에서 실제로 존재**함을 확인한다(존재하지 않는 좌표 박제 금지 — 예: `grep -n "runConfirmedImport" web/src/views/AdminView.tsx`).
- [ ] 본문은 한국어, 식별자 · 경로 · status enum(`IN_PROGRESS` 등)은 영어(`§12`).

## Out of Scope

- **코드 변경 일체** — `web/` · `src/` · `test/` 무변경. 탭/구획 내비게이션 배선은 후속 `pr` slice.
- REQ-080 을 `DONE` 으로 승격하는 것(잔여 축 1 건이 미shipped — 문언 두 축 중 하나만 shipped).
- PLAN `133 행` · `183 행` 의 `[ ]` 마커 승격.
- 다른 REQ row 재판정 · 다른 PLAN bullet 갱신(§3.1 rule 6 — arc 무관 drift 라도 본 slice 범위 밖. 발견 시 Follow-ups 에만 적는다).
- ADR-0061 본문 수정 · 새 ADR 신설.
- `docs/STATE.json` · journal 갱신(driver 의 bookkeeping commit 소관).

## Suggested Sub-agents

`implementer` (doc-only — architect · tester 불요. `commitMode: direct` 라 R-110 test 의무 미해당이나, 좌표 실측 명령은 반드시 실행해 확인한다.)

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가)
