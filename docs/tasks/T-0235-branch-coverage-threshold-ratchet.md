---
id: T-0235
title: coverageThreshold.global branch/statement floor ratchet 상향 — ADR-0026 정책 박제 + package.json floor 측정-후-설정
phase: P4
status: DONE
commitMode: pr
coversReq: [TBD]
estimatedDiff: 60
estimatedFiles: 3
created: 2026-06-04
completedAt: 2026-06-04T20:15:13+09:00
prNumber: 203
mergedAs: 5f81e29
reviewRounds: 1
plannerNote: P4 audit backlog P4 (test-quality-coverage-audit-2026-06 §4 P4) — branch/statement floor 50→측정값 margin 아래로 ratchet 상향. ADR-first dependency-free pr-mode, ≤3 파일.
---

# T-0235 — `coverageThreshold.global` branch/statement floor ratchet 상향 (ADR-0026)

## Why

T-0231 audit 보고서([test-quality-coverage-audit-2026-06.md](../progress/test-quality-coverage-audit-2026-06.md)) §1(사실 정정) + §4 P4 가 박제한 **CI 정책 gap** 해소다. 현재 `package.json` 의 `coverageThreshold.global` 은 `branches: 50 / statements: 50` 으로, line/function floor(80)보다 **낮게** 설정돼 있다. 실측 coverage 는 `% Branch 99.83 / % Statements 99.94`(audit §1) 로 floor 를 압도하지만, **floor 가 50 으로 너무 낮아 미래 회귀를 조기에 못 막는다** — 예컨대 branch coverage 가 99.83 → 70 으로 떨어져도 floor 50 을 통과해 CI 가 green 으로 남는다. floor 를 실측값 바로 아래로 끌어올리는 **ratchet** 으로 이 조기 적발 기능을 복원한다(audit 가 "long-horizon 회귀 방어 가치" 로 권고).

본 task 는 audit P1~P3(T-0232~T-0234, 모두 merged) 에 이은 **마지막 audit backlog 의 dependency-free 항목**이다. CI 정책 변경 = ADR-first(reviewer 선행 점검) + `package.json` floor 상향이라 commitMode `pr`. 새 외부 dependency 0 (jest 내장 `coverageThreshold`). audit P5(mutation testing) 는 새 dependency = §5 게이트라 본 task 범위 밖.

## ratchet 규율 (CI green 보장의 핵심)

**floor 는 반드시 실측값 이하로 설정한다.** audit §1 의 99.83/99.94 는 2026-06-04 스냅샷이라 그동안 spec 추가/변경으로 미세 drift 했을 수 있다. 따라서 implementer 는 **floor 결정 전 반드시 `pnpm test:cov` 를 1 회 실행해 현재 All-files `% Branch` / `% Statements` 실측을 직접 읽고**, 그 값보다 **margin 아래(예: 정수 내림 후 추가 안전 margin, 권장 90)** 로 설정한다. 측정값보다 높게 설정하면 jest exit 1 → CI `test:cov` step fail → PR red 가 되므로 절대 금지. line/function floor(80) 는 현행 유지(이미 적정 — 본 task 는 branch/statement 만 상향).

## Required Reading

- `docs/progress/test-quality-coverage-audit-2026-06.md` — §1(L10~23, 실측 99.83/99.94 + threshold 사실 정정) + §4 P4(L107~111, branch/statement floor 상향 권고 + CI 정책 변경 = pr-mode + false-positive 검토 동반 명시). 본 task 의 source.
- `package.json` — `jest.coverageThreshold.global`(L94~101): 현재 `branches: 50 / functions: 80 / lines: 80 / statements: 50`. 본 task 가 branch/statement floor 만 상향. 그 외 jest config(`coveragePathIgnorePatterns` 등) 변경 0.
- `docs/decisions/ADR-0023-permission-denied-audit-query-rbac-contract.md` — ADR frontmatter + 본문 구조(Context / Decision / Consequences / Alternatives) reference 포맷. 본 task 의 ADR-0026 이 같은 구조를 따른다.
- `docs/decisions/` 디렉토리 — 신규 ADR 은 ADR-0026 (ADR-0025 까지 존재). INDEX/목록 파일이 있으면 1 row append.

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0026-coverage-threshold-branch-ratchet.md` 신규 ADR 작성 (status `ACCEPTED (2026-06-04)`):
  - **Context**: 현재 floor(branch/statement 50)가 line/function 80 보다 낮아 회귀 조기 적발 기능을 상실한 상태 + audit §1/§4 P4 인용. 실측 99.83/99.94.
  - **Decision**: branch/statement floor 를 **ratchet** 으로 상향 — 정확한 수치는 "측정-후-설정"(implementer 가 `pnpm test:cov` 실측 후 그 값보다 margin 아래, 권장 90)으로 결정함을 명문. ratchet = 한번에 100 으로 올리지 않고 측정값 아래 안전 floor 로 설정해 미세 drift 에도 false-positive 가 안 나게 한다는 원칙 박제. 향후 추가 상향은 별도 ADR/task.
  - **Consequences**: 미래 branch/statement 회귀가 floor 미만으로 떨어지면 CI `test:cov` step 이 fail → PR red 로 조기 적발. line/function 80 floor 는 현행 유지. 새 dependency 0.
  - **Alternatives**: (a) floor 100 즉시 설정 — 미세 drift 에도 false-positive 위험으로 기각. (b) mutation testing(audit P5) — 새 dependency = §5 게이트라 본 ADR 범위 밖, 후속 별도. (c) 현행 50 유지 — 회귀 방어 무력화로 기각.
- [ ] `package.json` 의 `jest.coverageThreshold.global.branches` 와 `statements` 를 **`pnpm test:cov` 실측값 이하**(ratchet, 권장 90 — 단 실측 < 90 이면 실측 내림값 이하)로 상향. `functions`/`lines`(80)는 변경 0. JSON 문법/들여쓰기 정합 유지.
- [ ] `docs/decisions/` 에 INDEX/목록 파일이 존재하면 ADR-0026 1 row append (없으면 생략).
- [ ] **측정-후-설정 검증**: implementer/tester 가 `pnpm test:cov` 를 실행해 현재 All-files `% Branch`/`% Statements` 실측을 TESTER trail 에 박제하고, 설정한 floor 가 그 실측 이하임을 명시.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 — 상향한 floor 로도 jest exit 0 (CI green 유지). 동시에 기존 **line ≥ 80% AND function ≥ 80%** 도 계속 충족.
- [ ] tester 가 `pnpm lint && pnpm build && pnpm test:cov` 실행 결과를 TESTER trail 에 박제 (R-110). production 코드 변경 0 이라 신규 unit test 불요(분기 없는 config/ADR 변경 — R-112 4종은 "분기 없음 — 해당 항목 생략" 처리). 단 floor 상향이 기존 suite 를 깨지 않음을 `pnpm test:cov` green 으로 확인하는 것이 본 task 의 검증.

## Out of Scope

- `coveragePathIgnorePatterns` 자체 수정 — 별개 정책(audit §2(c)/P3 는 T-0234 helper 분리로 해소됨). 본 task 무관.
- line/function floor(80) 변경 — 현행 적정. 본 task 는 branch/statement 만 상향.
- floor 를 100 으로 즉시 설정 — 미세 coverage drift 에 false-positive 위험. ratchet 원칙상 측정값 아래 margin 으로만.
- production/test 코드 동작 변경 — 본 task 는 CI 정책(ADR + threshold 수치)만. 새 spec 추가/기존 spec 수정 0(coverage 를 끌어올릴 필요 없음 — 이미 99%대).
- mutation testing(audit P5) 도입 — 새 dependency = §5 BLOCKED 게이트. 별도 ADR/사용자 승인.
- 새 외부 dependency 추가 — 없음(jest 내장 기능).

## Suggested Sub-agents

`architect → tester`

- architect: ADR-0026 작성(CI 정책 결정 = 아키텍처 결정) + `package.json` floor 수치 상향. floor 결정 전 `pnpm test:cov` 실측 확인 의무(ratchet 규율).
- tester: `pnpm lint && pnpm build && pnpm test:cov` 실행 + 상향한 floor 로도 CI green 확인 + 실측 `% Branch`/`% Statements` 를 TESTER trail 박제. 신규 spec 불요(분기 없는 config/doc 변경).
- implementer 별도 불요(architect 가 ADR + package.json 한 줄대 수치 변경 모두 처리 — 코드 로직 변경 0).

## Follow-ups

(없음 — 본 task 로 audit backlog dependency-free 항목 P1~P4 가 전부 소진. 잔여 audit P5 mutation testing 은 새 외부 dependency = CLAUDE.md §5 HITL 게이트라 사용자 승인 + 별도 ADR 필요 — auto-queue 불가.)
