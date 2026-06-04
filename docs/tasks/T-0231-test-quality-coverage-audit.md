---
id: T-0231
title: CI 테스트 스위트 품질·coverage 감사 + 강화 backlog 박제 (audit-only entry task)
phase: P4
status: DONE
completedAt: 2026-06-04T18:56:00+09:00
result: "pnpm test:cov 1회 — 165 suite / 3276 test pass. All files stmt 99.94 / branch 99.83 / func 100 / line 99.94 (threshold 50/80 압도, 80% 턱걸이 0건). gap 3건(encrypt-cli 비-Error throw P1 / difficulty non-Prisma error 분기 P2 / auth.module ?? fallback blind-spot P3) + P4 branch floor 상향·P5 mutation testing backlog. 보고서: docs/progress/test-quality-coverage-audit-2026-06.md. 실제 강화는 pr-mode follow-up."
commitMode: direct
coversReq: []
estimatedDiff: 220
estimatedFiles: 1
created: 2026-06-04
plannerNote: 사용자 지시 — CI 가 돌리는 test case 의 품질·coverage 를 감사하고, 충분한 품질·coverage 를 갖도록 강화하는 업무. 본 task 는 그 **entry(감사)** — coverage % 너머의 품질(meaningful assertion·error path·negative case R-112 4종·경계값)까지 점검해 우선순위화된 강화 backlog 를 docs/progress/ 보고서로 박제. 실제 강화(test 파일 수정)는 보고서가 낳는 pr-mode follow-up task 들. doc-only direct. 픽업 시 중복 task 선검색(planner issue-still-relevant pre-check) 의무.
---

# T-0231 — CI 테스트 스위트 품질·coverage 감사 + 강화 backlog 박제

## Why

사용자 지시: **"자동화된 CI 를 통해 수행되는 test case 의 품질과 coverage 를 감사하고, 충분한 품질과 coverage 를 가지도록 test case 를 강화"**.

현 CI 는 R-110~R-114([CLAUDE.md](../../CLAUDE.md) §3.2) 다층 강제로 `coverageThreshold.global` line ≥ 80% / function ≥ 80% + spec-presence + smoke + e2e 를 자동 게이트한다. 그러나 **threshold 충족 ≠ 고품질**이다:

- coverage % 는 "실행됐다"만 보장하고 **assertion 의 의미(meaningful)** 는 보장하지 않는다 (실행만 하고 검증 빈약한 test).
- **branch coverage** 는 global threshold 에 미포함(line/function 만) → 분기 누락이 % 뒤에 숨을 수 있다.
- R-112 의 **negative case 충분 cover**(예외·권한·경계·type mismatch·의존성 실패 각 분기) 가 파일별로 균일하지 않을 수 있다.
- 80% floor 에 턱걸이한 파일/모듈은 잠재 risk.

본 task 는 **감사(audit) 전용 entry** 다 — 스위트 전체를 점검해 **우선순위화된 강화 backlog 보고서**를 박제한다. 실제 test 강화(코드 수정)는 본 보고서가 낳는 **pr-mode follow-up task** 들이 수행한다(본 task 는 코드/test 미변경).

## Required Reading

- `CLAUDE.md` §3.2 (R-110~R-114) — 테스트·CI 절대 규칙. 특히 R-112 의 (기능+예외처리+flow) 3종 + negative case 충분 cover 의무 + coverage 최소치(line/function ≥ 80%) + entrypoint 예외 정책. 감사 기준선.
- `package.json` — `scripts`(`test:cov`/`test:smoke`/`test:e2e`) + `coverageThreshold.global` + `coveragePathIgnorePatterns`(entrypoint 제외 목록). 현 게이트 설정 파악.
- `.github/workflows/ci.yml` — CI step 순서(spec-presence / ref-CAS / lint / build / migrate deploy / test:cov / smoke / e2e / reviewer approval). 어느 test 가 CI 에서 실제 강제되는지.
- `scripts/check-spec-presence.sh` — spec 동반 강제 로직(어떤 src 파일이 spec 의무 대상/제외인지). 감사 범위 산정에 사용.
- `test/` 디렉토리 구조(`test/smoke/`, `test/e2e/`, `test/helpers/`) + 대표 colocated `src/**/*.spec.ts` 몇 개 — 현 test 작성 패턴·assertion 밀도 표본 파악(전수 read 금지, 표본만).

## Acceptance Criteria

- [ ] `pnpm install` 후 `pnpm test:cov` 를 실행해 **per-file coverage(statement/branch/function/line)** 를 수집한다(jest --coverage 의 텍스트/json summary). 실행 결과 원본 수치는 보고서에 표/요약으로 외화.
- [ ] `docs/progress/test-quality-coverage-audit-2026-06.md` 보고서를 신설한다. 최소 다음을 포함:
  1. **요약**: 전체 statement/branch/function/line coverage + threshold(line/function 80%) 대비 여유/위험.
  2. **coverage 취약 목록**: (a) branch coverage 가 line 대비 현저히 낮은 파일, (b) 80% floor 에 턱걸이(예: 80~85%)한 파일/모듈, (c) `coveragePathIgnorePatterns` 로 제외됐으나 분기 로직을 품은 파일(R-112 entrypoint 예외 규칙 위반 후보) — 각 파일·수치 명시.
  3. **품질(% 너머) 점검**: 표본 spec 들에서 (i) assertion 빈약(실행만 하고 expect 부실), (ii) error path 미검증, (iii) R-112 negative case 부족(권한·빈입력·경계·type mismatch·의존성 실패 분기 누락), (iv) 경계값/edge 누락 사례를 근거(파일:라인)와 함께 열거.
  4. **우선순위화된 강화 backlog**: 위 gap 을 risk(도메인 중요도 × 결함 노출 가능성) 기준으로 정렬하고, 각각을 **강화 follow-up task 후보**(commitMode: pr, 각 ≤ 300 LOC / 5 파일 cap 내로 split, 대상 파일·추가할 test 종류 명시)로 박제. 최소 상위 3~5개는 즉시 task 화 가능한 수준으로 구체화.
- [ ] 보고서는 **사실 기반**: 추정·날조 금지. 수치는 실제 `test:cov` 실행 결과, gap 은 실제 파일 인용. 표본 한계(전수 점검 아님)는 보고서에 명시.
- [ ] 본 task 는 **audit-only** — `src/`·`test/` 의 production·test 코드를 **수정하지 않는다**(보고서 1개만 신설). 강화는 follow-up.
- [ ] 픽업 시 **중복 선검색**: 동일 취지의 audit/강화 task 가 이미 큐잉/완료됐는지 `docs/tasks/` + journal 확인(planner issue-still-relevant pre-check). 중복이면 본 task 를 SUPERSEDED 처리하고 기존 것으로 합류.

## Out of Scope

- **실제 test case 강화(코드 수정)** — 본 보고서가 낳는 pr-mode follow-up task 들의 책임. 본 task 는 보고서만.
- `coverageThreshold` 상향(예: branch threshold 신설, 80→90) — 정책 변경이므로 보고서가 권고만 하고, 실제 상향은 별도 task/ADR(CI 변경 = pr-mode, false-positive·기존 통과 영향 검토 동반).
- smoke/e2e 인프라 구조 변경(real DB mode 등 — ADR-0004 영역). 본 task 는 기존 인프라 위 test 의 품질·coverage 만 감사.
- mutation testing 등 새 도구 도입 — 새 dependency(§5 BLOCKED). 보고서가 후보로 언급은 가능하나 도입은 별도 ADR.
- entrypoint(`src/main.ts` 등) 자체의 unit test 강제 — R-112 entrypoint 예외 유지. 단 entrypoint 안 분기 helper 누락은 gap 으로 보고.

## Suggested Sub-agents

`tester`

- tester: `pnpm test:cov` 실행 + per-file coverage 수집 + 표본 spec 품질 점검 + 보고서 작성. (production 코드 미변경이라 implementer 불요. 보고서는 doc 이라 architect 불요.)
- 주의: tester 는 STATE/journal write 금지(§9) — 보고서(docs/progress/) 작성은 가하나 STATE 갱신은 driver 책임.

## Follow-ups

- (pr-mode, 보고서가 낳음) 우선순위 backlog 상위 항목별 **test 강화 task** — 대상 파일의 negative/error/branch/edge case 보강. 각 ≤ 300 LOC / 5 파일.
- (선택, pr-mode + ADR) `coverageThreshold` 에 **branch 최소치 신설** 권고 시 — CI 정책 강화 task(기존 통과 영향·false-positive 검토 동반).
- (선택) mutation testing 도입 검토 — 새 dependency 라 §5 게이트 + ADR.
