---
id: T-1786
title: Re-judge REQ-067 / REQ-068 / REQ-069 against the shipped account-creation UX chain
phase: P6
status: PENDING
commitMode: direct
coversReq: [REQ-067, REQ-068, REQ-069]
independentStream: account-creation-ux
dependsOn: [T-1711, T-1716]
touchesFiles:
  - docs/requirements.md
estimatedDiff: 45
estimatedFiles: 1
created: 2026-08-30
plannerNote: P6 오너 지시(PLAN 129 행 🔴) — T-1710~T-1716 머지됐는데 REQ-067~069 가 PLANNED 로 남은 drift 실측 재판정 (doc-only)
---

# T-1786 — 계정 생성 UX chain shipped 실측으로 REQ-067 · REQ-068 · REQ-069 재판정

## Why

[PLAN](../PLAN.md) `129 행` 의 오너 지시(2026-08-26, R-158~R-160 — 계정 생성 UX)를 분해한 slice chain [T-1710](T-1710-setup-form-credential-policy-hint.md) · [T-1711](T-1711-admin-user-create-credential-hint.md) · [T-1712](T-1712-signup-failure-reason-classifier.md) · [T-1713](T-1713-signup-detailed-failure-contract.md) · [T-1714](T-1714-appshell-signup-failure-wiring.md) · [T-1715](T-1715-adminview-create-user-failure-wiring.md) · [T-1716](T-1716-signup-failure-body-contract-e2e.md) 은 PR #1341~#1347 로 **전부 main 에 머지**됐다. 그런데 [requirements.md](../requirements.md) `86~88 행` 의 REQ-067 · REQ-068 · REQ-069 는 여전히 상태 토큰 `PLANNED` 이고 "구현 위치" 컬럼도 `P6 (PLAN 129 행)` 만 적혀 있어 slice ID 가 하나도 없다 — 머지된 사실과 추적 표가 어긋난 drift 다.

본 slice 는 그 세 행만 **실측 좌표 기반으로 재판정**해 추적 표를 머지 사실에 맞춘다. 세 행은 같은 chain · 같은 PLAN bullet 소관이라 한 slice 로 묶는다. 코드 변경 0 · 기존 문서 3 행의 inline-amend 이므로 [CLAUDE.md §3.1](../../CLAUDE.md) 판정 1 에 따라 `commitMode: direct`.

## Required Reading

- [docs/requirements.md](../requirements.md) `5~13 행` (운영 룰 — 상태 enum 5 값 · 검증 위치 enum 7 값 · "구현 위치 컬럼에 task 목록을 comma 로" 룰) 와 `86~88 행` (REQ-067 · REQ-068 · REQ-069 세 행 — 유일한 수정 대상)
- **REQ-067 축 ① (셋업 폼)**: [web/src/components/SuperAdminSetupForm.tsx](../../web/src/components/SuperAdminSetupForm.tsx) `11 행` (backend 상수 동기 주석) · `45 행` (REQ-067 안내 계약) · `88 행` · `102 행` (입력 전에도 무조건 렌더되는 아이디 · 비밀번호 조건) + colocated spec [SuperAdminSetupForm.test.tsx](../../web/src/components/SuperAdminSetupForm.test.tsx) `209 행` 이하 REQ-067 블록
- **REQ-067 축 ② (Admin 사용자 추가 폼)**: [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `113 행` (T-1711 안내 문구 상수) · `163 행` (안내 `<p>` 의 DOM id — `aria-describedby` 연결) · `5426 행` (조건 안내 2 축 렌더)
- **REQ-068 · REQ-069 분류·계약 축**: [web/src/api/signupError.ts](../../web/src/api/signupError.ts) `2 행` (helper 목적) · `11 행` (409 중복 / 400 입력 위반 대분류) · `72 행` · `79 행` (두 축 혼입 금지) · `113 행` (포괄 문구 병합 금지) 와 [web/src/api/auth.ts](../../web/src/api/auth.ts) `70 행` (`signupDetailed` 사유 보존 계약, T-1713)
- **REQ-068 · REQ-069 화면 배선 축**: [web/src/AppShell.tsx](../../web/src/AppShell.tsx) `116 행` · `230 행` (T-1714 셋업 실패 표시) 와 [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `2143 행` (T-1715 실패 표면 → 화면 문구 순수 함수) · `4727 행` (400 만 축별 구체 사유로 교체)
- **REQ-068 · REQ-069 e2e 축**: [test/e2e/signup-failure-contract.e2e-spec.ts](../../test/e2e/signup-failure-contract.e2e-spec.ts) `97 행` describe 제목 · `98 행` (두 축 동시 위반 시 사유가 각각 별도 문자열) · `118 행` (409 중복 축에 형식/길이 어휘 불혼입)
- [docs/tasks/T-1784-requirements-req079-continuation-e2e-rejudge.md](T-1784-requirements-req079-continuation-e2e-rejudge.md) `## Acceptance Criteria` — 직전 재판정 slice 의 서술 수위 · 좌표 인용 형식 선례 (본 slice 도 같은 형식을 따른다)

## Acceptance Criteria

- [ ] `docs/requirements.md` 의 **REQ-067 · REQ-068 · REQ-069 세 행만** 갱신된다. 세 행 각각의 상태 토큰이 실측 근거와 함께 재판정된다 — 충족이면 `PLANNED` → `DONE`, 실측에서 미충족 축이 남으면 `IN_PROGRESS` 로 두고 **그 잔여를 한 줄로 명시**한다. **근거 없이 토큰만 바꾸지 않는다** (판정 문장이 어느 파일 몇 행이 그 REQ 문언을 충족하는지 적어야 한다).
- [ ] 판정 근거로 인용하는 모든 좌표가 실재한다 — 인용 전에 `grep -n "<인용 문자열>" <파일>` 로 확인하고, 확인되지 않은 케이스 · 파일 · 행 번호를 지어내 적지 않는다. 최소한 REQ-067 은 `web/src/components/SuperAdminSetupForm.tsx` 와 `web/src/views/AdminView.tsx` 두 축, REQ-068 · REQ-069 는 `web/src/api/signupError.ts` (분류) · 화면 배선 (`AppShell.tsx` · `AdminView.tsx`) · `test/e2e/signup-failure-contract.e2e-spec.ts` (e2e) 를 각각 인용한다.
- [ ] **REQ 문언 경계를 지킨다** — "여러 줄 안내를 줄 단위로 구분해 표시(한 줄 합침 금지)" 는 [requirements.md](../requirements.md) `103 행` **REQ-084 소관**이다. `AdminView.tsx` `2135 행` 의 사유 구분자로 여러 줄이 한 문자열로 이어지는 점을 REQ-068 의 미충족 근거로 쓰지 않는다 — 필요하면 "표시 형식 축은 REQ-084 소관" 한 구절로 귀속만 밝힌다.
- [ ] **검증 위치 컬럼을 실측에 맞춘다** — REQ-067 행은 현재 `e2e` 로 적혀 있으나 실제 검증 실체가 web colocated vitest spec 이면 `unit` 으로 정정하고 **정정 이유를 판정 문장에 한 구절로 남긴다**(브라우저 e2e harness 부재). REQ-068 · REQ-069 의 `unit + e2e` 는 두 축이 실재하면 유지한다. 어느 경우에도 `docs/requirements.md` `11 행` 의 검증 위치 enum 밖 토큰을 새로 만들지 않는다.
- [ ] 세 행의 "구현 위치" 컬럼에 대응 slice ID 가 comma 로 추가된다 — REQ-067 은 `T-1710` · `T-1711`, REQ-068 · REQ-069 는 `T-1712` · `T-1713` · `T-1714` · `T-1715` · `T-1716`. 기존에 적힌 `P6 (PLAN 129 행)` 표기는 삭제하지 않는다.
- [ ] 7 컬럼 schema 가 깨지지 않는다 — 수정 후 세 행의 `|` 구분자 개수가 표의 다른 행과 같고, 행 안에 개행이 들어가지 않는다 (`awk -F'|' 'NR>=86 && NR<=88 {print NF}' docs/requirements.md` 가 다른 REQ 행과 같은 값).
- [ ] 변경 파일은 `docs/requirements.md` **1 개뿐** — `git status --short` 에 다른 production 파일이 나타나지 않는다 (task 파일 · STATE · journal 은 driver bookkeeping 소관이라 예외).
- [ ] doc-only direct 이므로 코드 0 LOC — [CLAUDE.md §3.2](../../CLAUDE.md) R-110 tester 의무와 R-112 4 항목(happy / error path / 분기 / negative) 은 **적용 대상 없음**. 대신 위 좌표 grep 검증으로 대체한다.

## Out of Scope

- **PLAN.md `129 행` 마커 변경 금지** — 세 REQ 가 모두 `DONE` 이 되더라도 bullet `- [ ]` → `- [x]` 승격 판정은 별도 direct doc slice 소관이다 (선례: [T-1785](T-1785-adr0058-plan-closure.md)).
- **다른 REQ 행 수정 금지** — REQ-080~REQ-084 (PLAN 133 행 UI 기본기) · REQ-070~REQ-077 등 어떤 행도 문체 통일 목적으로도 손대지 않는다. 특히 REQ-084 는 미shipped 이므로 이번에 판정하지 않는다.
- **코드 · spec 변경 0** — `web/` · `src/` · `test/` 어느 파일도 수정하지 않는다. 부족한 test 나 개선점이 보이면 아래 Follow-ups 에만 적는다.
- **표 schema · enum 변경 금지** — 7 컬럼 구조 · 상태 enum 5 값 · 검증 위치 enum 7 값 자체를 늘리거나 줄이지 않는다.
- **README 수정 금지** — README `158~160 행` 원문은 그대로 두고 본 표만 동기화한다.

## Suggested Sub-agents

`implementer` (doc-only 3 행 inline-amend — architect · tester 불요)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가)
