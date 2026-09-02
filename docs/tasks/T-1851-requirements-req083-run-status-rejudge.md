---
id: T-1851
title: REQ-083 실행 상태 조회 + 배너 polling 재판정 + PLAN 133 행 ④ 조각 갱신
phase: P6
status: DONE
commitMode: direct
coversReq: [REQ-083]
independentStream: req-083-run-status-rejudge
dependsOn: [T-1846, T-1847, T-1848, T-1849, T-1850]
touchesFiles:
  - docs/requirements.md
  - docs/PLAN.md
estimatedDiff: 90
estimatedFiles: 2
created: 2026-09-02
completedAt: 2026-09-02T10:48:00Z
resultCommit: 73f763ae
plannerNote: "P6 / PLAN 133 행 ④ — ADR-0060 (a)~(e) 코드 chain + (f) 앞 절반 머지 완료, §3.1 규칙 6 상 구현 후 1 회 재판정"
---

# T-1851 — REQ-083 실행 상태 조회 + 배너 polling 재판정 + PLAN 133 행 ④ 조각 갱신

## Why

[ADR-0060](../decisions/ADR-0060-evaluation-run-status-endpoint.md) `§Follow-ups (f)` 의 **나머지 절반**이다. 앞 절반(architecture doc 동기)은 [T-1850](T-1850-run-status-architecture-doc-sync.md) 이 main `ebc4f545` 로 닫았고, 그 앞의 코드 chain (a) ~ (e) 는 T-1843 ~ T-1849 로 전부 머지됐다. 그런데 [requirements.md](../requirements.md) `102 행` REQ-083 은 여전히 `PLANNED` 이고 [PLAN.md](../PLAN.md) `133 행` 은 잔여를 "① 전역 CSS · ④ R-78 polling **둘**" 로 적고 있어, 문서가 이미 shipped 인 기능을 미착수라고 말하는 drift 가 남아 있다.

[CLAUDE.md](../../CLAUDE.md) `§3.1` 규칙 6 이 요구하는 "구현 slice 머지 **후** 1 회" 재판정 시점이 본 slice 에서 충족된다 — 같은 구현 arc 안의 구현 **전** 재판정은 만들지 않았다. 선례는 동형 배치인 [T-1839](T-1839-requirements-req081-req082-session-rejudge.md)(REQ-081 · REQ-082 재판정 + PLAN `133 행` ② · ③ 조각 갱신) 다.

**planner pre-check (issue-still-relevant, origin/main `9de21ac6` 실측)**: `docs/requirements.md` `102 행` 은 `| REQ-083 | 190 | ... | unit + e2e | PLANNED |` 그대로이고, `docs/PLAN.md` `133 행` 의 ④ 조각은 "R-78 평가 진행 배너 자동 polling(실행 상태 조회 endpoint 신설 포함 — 기존 P6 deferred 잔여 해소)" 라는 **미해소 서술** 그대로다. 두 지점 모두 미안착 — 본 task 는 중복이 아니다.

## Required Reading

- [docs/requirements.md](../requirements.md) `99~103 행` — REQ-080 ~ REQ-084 행. 특히 `102 행` (재판정 대상) 과 `101 행` REQ-082 · `103 행` REQ-084 (동형 `DONE` 서술의 문체·근거 밀도 참고).
- [docs/PLAN.md](../PLAN.md) `133 행` — "UI 기본기 — CSS·로그아웃·세션 복원·R-78 polling (R-187~R-191)" bullet. ④ 조각과 말미의 "본 bullet 의 잔여는 ① 전역 CSS 도입 · ④ R-78 polling 둘뿐" 문장.
- [docs/tasks/T-1839-requirements-req081-req082-session-rejudge.md](T-1839-requirements-req081-req082-session-rejudge.md) — 동형 선례(같은 2 파일 · `direct`).
- [docs/decisions/ADR-0060-evaluation-run-status-endpoint.md](../decisions/ADR-0060-evaluation-run-status-endpoint.md) `§Decision 2` · `§Decision 4` · `§Decision 5` · `§Follow-ups` — 재판정 근거로 인용할 계약(응답 shape 불변식 · `begin`/`finally end` 전이 · 5 초 주기 + 탭 비가시 중단).
- 실측 근거 파일 (근거 인용을 위해 필요한 행만 확인, 전면 정독 금지):
  - `src/run-status/run-status.service.ts` · `src/run-status/run-status.controller.ts` · `src/run-status/run-status.module.ts`
  - `test/e2e/run-status.e2e-spec.ts`
  - `web/src/api/runStatus.ts`
  - `web/src/AppShell.tsx` `184 행` (`RUN_STATUS_POLL_INTERVAL_MS = 5000`) · `388~421 행` (polling effect · `visibilitychange` · cleanup)

## Acceptance Criteria

- [ ] `docs/requirements.md` `102 행` REQ-083 의 status 가 `PLANNED` → `DONE` 으로 바뀌고, 재판정 근거가 **실측 좌표(파일 경로 + 행)** 로 박제된다. 최소 4 축을 각각 1 개 이상의 좌표로 인용:
  - (a) **상태 service 축** — `src/run-status/run-status.service.ts` 의 `begin(axis)` / `end(axis)` / `snapshot()` 과 소비처 3 + 1 배선(평가 축 3 handler · 수집 축 1 handler, `unevaluated-fill-plan` 제외는 [ADR-0060](../decisions/ADR-0060-evaluation-run-status-endpoint.md) `§Decision 4` 대로).
  - (b) **조회 endpoint 축** — `src/run-status/run-status.controller.ts` 의 `@Controller("api/run-status")` + `@Get()` + guard/`@Roles` 조합과 `src/app.module.ts` 등록.
  - (c) **web polling 축** — `web/src/api/runStatus.ts` 의 조회 helper(실패를 `active: false` 로 흡수) + `web/src/AppShell.tsx` `184 행` `RUN_STATUS_POLL_INTERVAL_MS = 5000` · `388~421 행` interval + `visibilitychange` + unmount cleanup, 그리고 그 결과가 기존 배너 컴포넌트의 `active` prop 으로 전달된다는 사실.
  - (d) **검증 위치 축** — colocated spec 들과 `test/e2e/run-status.e2e-spec.ts` 의 계약 고정(미인증 401 · 인증 200 + 필드 shape · 비실행 시 `active: false`).
- [ ] 같은 행의 "근거/구현" 컬럼에 shipped task 사슬(T-1841 ~ T-1849 중 실제 해당분)과 [ADR-0060](../decisions/ADR-0060-evaluation-run-status-endpoint.md) 참조가 들어간다. `102 행` 외의 다른 REQ 행은 **수정 0**.
- [ ] `docs/PLAN.md` `133 행` 의 ④ 조각이 shipped 서술로 갱신된다 — 옛 미해소 서술("실행 상태 조회 endpoint 신설 포함 — 기존 P6 deferred 잔여 해소")이 더 이상 사실이 아님을 명시하고, backend(endpoint · 축별 카운터) → e2e → web(helper · polling) 순서의 근거를 압축해 박는다. ② · ③ · ⑤ 기존 shipped 서술은 **삭제 0**.
- [ ] 같은 `133 행` 말미의 잔여 문장이 "잔여는 ① 전역 CSS 도입 **하나뿐**" 으로 갱신되고, bullet 의 checkbox 마커는 `[ ]` 로 **유지**된다(① 전역 CSS 가 아직 미shipped 이므로). 마커를 `[x]` 로 바꾸면 위반.
- [ ] 검증 명령:
  - `grep -n "REQ-083" docs/requirements.md` 결과에 `PLANNED` **0 hit**, `DONE` 1 hit.
  - `grep -c "R-78 평가 진행 배너 자동 polling(실행 상태 조회 endpoint 신설 포함" docs/PLAN.md` 결과 **0**.
  - `grep -c "① 전역 CSS 도입 · ④ R-78 polling 둘뿐" docs/PLAN.md` 결과 **0**.
  - `git diff --name-only` 결과가 정확히 `docs/PLAN.md` + `docs/requirements.md` **2 개**.
- [ ] 코드 변경 0 — `src/` · `web/` · `test/` 에 어떤 diff 도 없음(`git diff --name-only` 로 확인). doc-only `direct` commit 이라 [CLAUDE.md](../../CLAUDE.md) `§3.2` R-110 의 tester 의무는 면제되며, test 코드 추가 대신 위 grep 4 종이 검증을 대체한다.

## Out of Scope

- REQ-080(전역 CSS) 재판정 — 미shipped 이므로 본 slice 에서 건드리지 않는다.
- `docs/architecture/modules.md` 의 module 목록 drift 동기(문서 12 종 vs `src/` 실측 15 종) — 의존성 그래프 · Components 매핑 동반이라 별도 slice.
- 코드 · 테스트 변경 일체. 발견된 결함은 고치지 말고 Follow-ups 에만 적는다.
- `docs/architecture/api.md` · `frontend-api-contract.md` 재수정 — [T-1850](T-1850-run-status-architecture-doc-sync.md) 이 이미 닫았다.
- 다른 REQ 행의 status 일괄 감사 · 표기 정규화.

## Suggested Sub-agents

`implementer` 단독 (doc-only, `direct`).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가)
