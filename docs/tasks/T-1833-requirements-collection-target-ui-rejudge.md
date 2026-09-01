---
id: T-1833
title: 수집 대상 UI arc 머지 후 REQ-070 · REQ-072 · REQ-073 재판정 + PLAN 130 행 갱신
phase: P6
status: DONE
commitMode: direct
coversReq: [REQ-070, REQ-072, REQ-073]
independentStream: collection-target-admin-ui
dependsOn: [T-1832]
touchesFiles:
  - docs/requirements.md
  - docs/PLAN.md
estimatedDiff: 70
estimatedFiles: 2
created: 2026-09-01
completedAt: 2026-09-01T06:44:00Z
commit: 0f051388
plannerNote: "P6 / PLAN 130 행 시스템 축 — T-1832 로 편집 arc 종결, §3.1 규칙 6 상 구현 머지 후 1 회 재판정"
---

# T-1833 — 수집 대상 UI arc 머지 후 REQ-070 · REQ-072 · REQ-073 재판정 + PLAN 130 행 갱신

## Why

[T-1832](T-1832-admin-collection-target-scope-edit.md) 가 머지되면서
[ADR-0059](../decisions/ADR-0059-collection-target-registration.md) `§Follow-ups (e)` 의
AdminView 수집 대상 패널 arc 가 목록 · 등록 · 삭제 · 활성 토글 · endpoint 편집 · 범위 3 축 편집으로
모두 닫혔다. 그런데 [requirements.md](../requirements.md) `89 행` · `91 행` · `92 행` 의
REQ-070 / REQ-072 / REQ-073 세 row 는 여전히 `PLANNED` 이고 `evidence` 열이 비어 있어 **문서가
실제 shipped 상태와 어긋나 있다** — [CLAUDE.md](../../CLAUDE.md) `§3.1` 규칙 6 이 허용(이자 요구)하는
"구현 머지 후 1 회" 재판정 시점이 지금이다.

본 task 는 T-1832 의 `Follow-ups` 에 planner 가 예약해 둔 그 1 회를 집행한다. `docs/architecture/api.md`
수집 대상 5 route 표 동기는 [T-1827](T-1827-api-md-collection-target-routes-doc-sync.md) 이 이미 끝냈으므로
본 task 범위 밖이고, 남은 것은 **REQ 3 row 재판정 + 그 결과를 PLAN `130 행` 잔여 서술에 반영**뿐이라
두 파일 `direct` 로 닫힌다.

issue-still-relevant pre-check (planner, `origin/main` `7bff75b7`): `requirements.md` `89 행` ·
`91 행` · `92 행` 세 row 모두 `status` 열이 `PLANNED` 이고 evidence 열이 `e2e` / `unit + e2e`
계획값 그대로다(REQ-071 만 `DONE` 재판정 완료 — T-1805). PLAN `130 행` 은 `[ ]` 이며 본문이
"본 bullet 의 잔여는 인원 축이 아니라 `89 행` REQ-070 · `91 행` REQ-072 · `92 행` REQ-073 세 row"
라고 명시한다. 즉 본 재판정은 main 에 아직 안착하지 않았다.

## Required Reading

- [docs/requirements.md](../requirements.md) `89 행` (REQ-070) · `91 행` (REQ-072) · `92 행` (REQ-073) — 재판정 대상 3 row. 바로 위 `90 행` REQ-071 이 **이미 재판정된 row 의 서술·evidence 표기 양식 선례**다(근거 slice 를 `T-NNNN` 링크로 나열 + `status` 를 `DONE` 으로). 본 task 는 그 양식을 그대로 따른다.
- [docs/PLAN.md](../PLAN.md) `130 행` — 오너 지시 bullet. 인원 축 5/5 shipped 서술은 이미 있고, 마지막 문장이 "본 bullet 의 잔여는 … 세 row 이며(그래서 마커는 `[ ]` 유지), 시스템 축은 수집 대상 등록 모델·API·UI 가 부재하면 신설" 이다 — 시스템 축이 닫힌 사실을 이 서술에 반영한다.
- [docs/tasks/T-1832-admin-collection-target-scope-edit.md](T-1832-admin-collection-target-scope-edit.md) `## Result` — 편집 arc 마지막 조각의 실측 결과(무엇이 발사되고 무엇이 의도적으로 빠졌는지). `## Follow-ups` 의 planner 예약 항목이 본 task 의 발주서다.
- [docs/decisions/ADR-0059-collection-target-registration.md](../decisions/ADR-0059-collection-target-registration.md) `§Decision 5` — 정체성 축(`type` · `instanceKey`) 은 편집이 아니라 **DELETE + POST** 로 바꾸는 것이 설계 결정이다. 재판정 서술이 이를 "미구현 잔여" 로 오기하지 않도록 반드시 확인.
- [src/assessment-collection/collection-target.controller.ts](../../src/assessment-collection/collection-target.controller.ts) `89~91 행` · `102~104 행` (조회 2 route `@Roles("User")`) 와 `124~126 행` · `155~157 행` · `183~186 행` (편집 3 route `@Roles("Admin")`) — REQ-073 재판정의 backend 근거.
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `4496 행` `collectionTargets` memo · `5987 행` 이하 `CollectionTargetList` 마운트와 `isAdmin` gating — REQ-072 / REQ-073 의 web 근거.
- [web/src/views/DashboardView.tsx](../../web/src/views/DashboardView.tsx) `97 행` `NO_PERSON_TEXT` — REQ-070 의 "로그인 직후 빈 상태에서 막히지 않는다" 를 판정할 때 **그 빈 상태에서 대상 추가 인터페이스로 가는 진입점이 실제로 있는지** 를 실측할 지점.

## 재판정 지침 (판정은 실측으로, 낙관 금지)

- **REQ-072 (시스템 등록·편집)** — backend 5 route([T-1814](T-1814-collection-target-controller-get-routes.md) ~ [T-1817](T-1817-collection-target-controller-delete-route.md)) 와 web 6 slice([T-1825](T-1825-admin-collection-target-list-panel.md) 목록 · [T-1826](T-1826-admin-collection-target-create-form.md) 등록 · [T-1828](T-1828-admin-collection-target-delete.md) 삭제 · [T-1829](T-1829-admin-collection-target-active-toggle.md) 활성 토글 · [T-1831](T-1831-admin-collection-target-endpoint-edit.md) endpoint 편집 · [T-1832](T-1832-admin-collection-target-scope-edit.md) 범위 3 축) 가 shipped 인지 확인하고 근거 링크를 나열한다. 정체성 축은 ADR-0059 `§Decision 5` 의 설계 결정(DELETE + POST)이므로 잔여가 아니라 **의도된 계약**으로 적는다.
- **REQ-073 (Admin 편집 · User 조회)** — backend `@Roles` tier 분리와 web `isAdmin` gating(편집·삭제·토글 콜백 미전달 시 컨트롤 미노출) 두 층을 모두 근거로 적는다. e2e 축이 이미 있는지([T-1823](T-1823-collection-targets-error-contract-e2e.md) 오류 계약 e2e) 확인해 evidence 열을 실측대로 채운다.
- **REQ-070 (빈 상태에서 막히지 않음)** — 이 row 는 인원 축 · 시스템 축을 덮는 **우산 REQ** 다. 두 축의 추가·편집 인터페이스가 AdminView 에 모두 존재하는 것은 사실이지만, "로그인 직후 빈 상태" 에서 그 인터페이스로 **가는 길이 화면에 있는지** 를 `DashboardView.tsx` `97 행` 주변에서 실측해 판정한다. 길이 있으면 `DONE`, 없으면 `PARTIAL` 로 두고 **잔여를 한 문장으로 못박아** 적는다(예: "빈 상태 안내문에서 대상 등록 화면으로 가는 진입점 부재"). 근거 없는 `DONE` 승격 금지 — 문서가 실제와 어긋나는 것이 본 task 가 고치려는 결함이다.
- **PLAN `130 행`** — 위 3 row 판정 결과를 잔여 서술에 반영한다. 세 row 가 모두 `DONE` 이면 마커를 `[x]` 로 바꾸고 인원 축 서술과 같은 밀도로 시스템 축 `implemented-on-main` 근거를 덧붙인다. 하나라도 `PARTIAL` 이면 마커는 `[ ]` 를 유지하되 **잔여를 그 한 가지로 좁혀** 다시 적는다(현재 문장의 "시스템 축은 … 부재하면 신설" 은 이미 거짓이므로 반드시 갱신).

## Acceptance Criteria

- [ ] `docs/requirements.md` `89 행` · `91 행` · `92 행` 세 row 의 `status` 열이 위 지침대로 실측 재판정되고(`DONE` 또는 근거를 동반한 `PARTIAL`), 각 row 의 근거 열에 backend / web slice 를 `T-NNNN` 링크로 나열한다 — 표기 양식은 `90 행` REQ-071 선례를 따른다.
- [ ] REQ-072 서술에 정체성 축(`type` · `instanceKey`)이 **미구현 잔여가 아니라 ADR-0059 `§Decision 5` 의 DELETE + POST 계약** 이라는 사실이 한 구절로 들어간다.
- [ ] REQ-073 서술에 backend `@Roles` tier 분리(조회 `User` / 편집 `Admin`)와 web `isAdmin` gating 두 층이 모두 근거로 적힌다.
- [ ] REQ-070 이 `DONE` 으로 승격됐다면 빈 상태 → 등록 인터페이스 진입 경로를 실측 근거(파일 · 심볼)로 적고, `PARTIAL` 이면 잔여가 **한 문장으로 특정**된다(모호한 "일부 미완" 금지).
- [ ] `docs/PLAN.md` `130 행` 의 "시스템 축은 수집 대상 등록 모델·API·UI 가 부재하면 신설" 문장이 실제 shipped 상태로 갱신되고, 마커(`[ ]` / `[x]`)가 위 3 row 판정과 **모순 없이** 일치한다.
- [ ] 변경 파일이 `docs/requirements.md` · `docs/PLAN.md` 2 개뿐이다 (`git diff --name-only` 로 확인) — 코드 · spec · ADR 변경 0 이므로 `commitMode: direct` 판정이 유지된다.
- [ ] `docs/requirements.md` 표의 컬럼 수(7 열)와 구분자가 깨지지 않는다 — 편집 후 해당 3 행의 `|` 개수가 인접 정상 행과 같은지 확인.
- [ ] 행 범위 표기가 [CLAUDE.md](../../CLAUDE.md) `§12` 범위 좌표 규약을 따른다(물결 `~` 하나, 단일 행은 `89 행`, `L` prefix 금지).

## Out of Scope

- **코드 · spec 변경 일체** (`src/` · `web/` · `test/`) — 본 task 는 문서 재판정뿐이다. 재판정 중 REQ-070 잔여(빈 상태 진입점 등)를 발견해도 **고치지 않고** `Follow-ups` 에만 적는다 (`§3.1` 규칙 3 — direct 와 pr 혼합 금지).
- `docs/architecture/api.md` 수집 대상 route 표 동기 — [T-1827](T-1827-api-md-collection-target-routes-doc-sync.md) 이 이미 끝냈다. 중복 편집 금지.
- REQ-070 / REQ-072 / REQ-073 **외** 의 다른 REQ row 재판정 · 신규 REQ 채번 — 한 task 는 이 3 row 만 다룬다.
- 새 ADR 작성 · ADR-0059 본문 수정 · `§Follow-ups` 체크 — ADR 결정 내용 변경은 `pr` 이라 본 task 와 혼합 금지.
- PLAN `183 행` AdminView god component 부채 bullet 갱신 · PLAN 의 다른 bullet 손질.
- 재판정 결과에 따른 후속 slice 의 task 파일 생성 — task 생성은 planner 몫이다. 본 task 는 `Follow-ups` 에 남기기만 한다.

## Result

- **DONE (direct, main `0f051388`) — REQ-070 · REQ-072 · REQ-073 3 row 를 실측 재판정해 모두 `PLANNED` → `DONE`, PLAN `130 행` 의 거짓 서술 갱신 + 마커 `[x]`.** 변경 파일 2 개(`docs/requirements.md` · `docs/PLAN.md`), `+4/-4`.
- **REQ-072 (시스템 등록·편집) = DONE** — backend 5 route(`src/assessment-collection/collection-target.controller.ts` 의 `@Get()` · `@Get(":id")` · `@Post()` · `@Patch(":id")` · `@Delete(":id")`, [T-1814](T-1814-collection-target-controller-get-routes.md) ~ [T-1817](T-1817-collection-target-controller-delete-route.md)) 와 web 6 slice([T-1825](T-1825-admin-collection-target-list-panel.md) 목록 · [T-1826](T-1826-admin-collection-target-create-form.md) 등록 · [T-1828](T-1828-admin-collection-target-delete.md) 삭제 · [T-1829](T-1829-admin-collection-target-active-toggle.md) 활성 토글 · [T-1831](T-1831-admin-collection-target-endpoint-edit.md) endpoint · [T-1832](T-1832-admin-collection-target-scope-edit.md) 범위 3 축) 가 모두 shipped 임을 파일 · 심볼로 확인했다. 정체성 축(`type` · `instanceKey`) 은 미구현 잔여가 아니라 [ADR-0059](../decisions/ADR-0059-collection-target-registration.md) `§Decision 5` 의 **DELETE + POST 계약** 으로 적어 오기를 막았다.
- **REQ-073 (Admin 편집 · User 조회) = DONE** — 층 ① backend `@Roles` tier 분리(조회 2 route `@Roles("User")` / 편집 3 route `@Roles("Admin")`), 층 ② web `isAdmin` gating(편집·삭제·토글 콜백을 `isAdmin ? handler : undefined` 로 내려 non-Admin 에게는 컨트롤 미렌더, 등록 폼은 통째 gating) 두 층을 모두 근거로 기재했다. 오류 계약 e2e 는 [T-1823](T-1823-collection-targets-error-contract-e2e.md).
- **REQ-070 (빈 상태에서 막히지 않음) = DONE** — 우산 REQ 라 "빈 상태에서 나가는 길" 을 실측으로 두 갈래 확인했다: ① `web/src/views/DashboardView.tsx` `802 행` `if (!selectedPersonId)` 분기가 안내문(`97 행` `NO_PERSON_TEXT`)만이 아니라 `809 행` `{personSelector}` 를 **같은 분기 안에** 함께 렌더한다([T-1723](T-1723-dashboard-person-selector-wiring.md)), ② `web/src/AppShell.tsx` `65 행` `AUTHED_NAV_ITEMS` 의 `관리` 항목이 `298 행` `<nav aria-label="화면 이동">` 으로 DashboardView 와 같은 화면에 렌더돼 추가·편집 인터페이스로 가는 진입점이 존재한다. 근거가 실제로 있었으므로 `PARTIAL` 이 아니라 `DONE` 이다.
- **PLAN `130 행`** — "시스템 축은 수집 대상 등록 모델·API·UI 가 부재하면 신설" 이라는 이미 거짓이 된 문장을 shipped 서술로 갈아끼우고, 3 row 가 모두 `DONE` 이므로 마커를 `[ ]` → `[x]` 로 승격했다(판정과 마커 무모순).
- 표 무결성 확인 — 편집한 3 행의 `|` 개수(8 개 = 7 열)가 인접 정상 행과 일치한다. 행 범위 표기는 [CLAUDE.md](../../CLAUDE.md) `§12` 규약(물결 하나 · 단일 행 `89 행` · `L` prefix 금지) 준수. 코드 · spec · ADR 변경 0 이라 `commitMode: direct` 판정 유지.

## Suggested Sub-agents

`implementer`

## Follow-ups
- (driver bookkeeping) 본 task 파일의 frontmatter `status: DONE` · `## Result` 은 executor commit `0f051388` 이 AC "변경 파일 2 개" 를 지키기 위해 제외했고, driver bookkeeping commit 에서 처리했다.
- [ADR-0059](../decisions/ADR-0059-collection-target-registration.md) `§Follow-ups (g)` env 병합 배선(`§Decision 3` union + env 우선)이 아직 미shipped 이고, `§Consequences (a)` 출처 표시(env 유래 vs DB row) · `(b)` `instanceKey` 후보 제시 UX 도 미구현 — planner 가 후속 arc 로 판단한다.
- PLAN P6 에 남은 미완 bullet 은 `133 행` UI 기본기(R-187 ~ R-191) 하나뿐 — 다음 arc 후보.

