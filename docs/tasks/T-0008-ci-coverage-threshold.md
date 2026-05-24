---
id: T-0008
title: CI 에 pnpm test:cov 통합 + 최소 coverage threshold
phase: P0.5
status: PENDING
commitMode: pr
coversReq: [REQ-060, REQ-059]
estimatedDiff: 60
estimatedFiles: 3
created: 2026-05-23
requeuedAt: 2026-05-24T02:05:00+09:00
plannerNote: P0.5 두 번째 task. spec 존재(T-0007)에 더해 spec 내용의 충실도를 coverage threshold 로 CI 게이트화 — R-112 강제층의 2단.
dependsOn: [T-0007]
blocks: []
---

# T-0008 — Coverage threshold 를 CI 게이트로

## Why

[T-0007](T-0007-ci-spec-presence-check.md) 가 spec 파일의 *존재* 를 강제하지만 *내용* 은 검증 안 한다. 빈 `describe.skip()` 으로도 통과한다.

본 task 는 jest 의 coverageThreshold 를 도입해 line / branch coverage 의 최소 비율을 CI 게이트로 둔다. coverage 가 threshold 미만이면 jest exit code non-zero → CI fail → merge 차단.

처음엔 낮게 시작 (50%) — 도메인 코드가 아직 거의 없는 상태에서 너무 높게 잡으면 false positive. 안정화되면 별도 ADR / task 로 상향.

## Required Reading

- `package.json` 의 jest 설정 (T-0006 patch 후)
- `.github/workflows/ci.yml` (T-0005 / T-0007 갱신 후)
- [CLAUDE.md](../../CLAUDE.md) §3.2 R-110 / R-111 / R-112
- [README.md](../../README.md) 의 "로컬 빌드 / 테스트" 단락 (T-0005 가 추가)
- [docs/requirements.md](../requirements.md) REQ-060 / REQ-059

## Acceptance Criteria

### 본 task 가 제공하는 변경

- [ ] `package.json` 의 jest 블록에 `coverageThreshold` 추가:
  - `global: { branches: 50, functions: 50, lines: 50, statements: 50 }` (시작값).
  - 향후 단계적 상향은 별도 ADR/task.
- [ ] `package.json` 의 `test:cov` script 는 이미 `jest --coverage` — 그대로 사용 (변경 없음).
- [ ] `.github/workflows/ci.yml` 의 기존 "Test 실행" step 을 `pnpm test:cov` 로 교체 (단일 step). step name 한국어 (예: `name: 테스트 + 커버리지 검사`). step 1개 추가가 아니라 기존 step 의 명령 교체로 처리 — CI 시간 절약.
- [ ] coverage 결과 업로드 (선택): 부담되면 skip 하고 Follow-ups 에 적는다.
- [ ] [README.md](../../README.md) 의 "로컬 빌드 / 테스트" 단락에 `pnpm test:cov` 사용법 한 줄 + threshold 미달 시 exit 1 인 점 한 줄 추가.
- [ ] 단일 commit, ≤300 LOC / ≤3 파일.

### Test 의무 (CLAUDE.md §3.2 R-112 — 4종)

본 task 는 jest 설정 (`coverageThreshold` JSON 객체) + CI yml step 명령어 변경이 주된 산출물이며, 새 public 함수/클래스/엔드포인트가 없다. 따라서 R-112 의 4종은 **"설정 검증 형태"** 로 적용한다:

- [ ] **happy-path test**: 현재 src/ 의 sanity test 가 threshold (50%) 를 충족함을 검증 — `pnpm test:cov` 가 로컬에서 exit 0 + Coverage 표가 모든 metric 50% 이상으로 출력되는지 확인. task body 에 한 단락 (실행 결과 발췌, 4 metric 수치 명시).
- [ ] **error-path test**: 의도적으로 threshold 미달 상황을 한 번 재현 — 예: 임시로 coverage threshold 를 99% 로 올리거나 `src/app.controller.ts` 의 spec test 한 줄을 주석 처리한 뒤 `pnpm test:cov` 가 exit 1 + "Jest: coverage threshold for ... not met" 메시지 출력 확인. 임시 변경은 commit 전 복구. task body 에 한 단락.
- [ ] **flow / branch test**: 본 task 는 분기 없는 "JSON 객체 1개 추가" — **분기 없음. 이 항목은 생략** (`tester` 가 trail 의 TESTER.notes 에 "branch 항목 N/A — 설정 객체 추가, 코드 분기 무" 명시).
- [ ] **negative test**: jest 가 본 threshold 객체를 인식하는지 — `pnpm test:cov --listTests` 또는 `pnpm test:cov` 출력에 coverage 표가 *실제로* 나오는지 확인. 만약 jest 설정 오타로 threshold 가 무시되면 (예: `coverageThresholds` 복수형 오타) 커버리지 표는 나오나 threshold 검사가 silent skip — 이 시나리오를 의도적 reproduction 후 정확한 키 (`coverageThreshold` 단수) 사용을 검증. task body 에 한 단락.

위 4 항목 (분기 항목 제외 3 항목) 의 실행 결과는 **PR 본문 또는 task body** 에 발췌하여 evidence 로 첨부. tester agent 가 자체 확인 후 TESTER trail section 에 결과 요약.

### CI 통과 의무 (R-111 / R-114)

- [ ] PR push 직후 GitHub Actions 의 "기본 검사" job 이 통과 (lint + build + test:cov 모두 green, threshold 충족).
- [ ] integrator 의 3중 게이트 (reviewer APPROVE + integrator self-check + CI green) 충족 시 squash merge.

## Out of Scope

- 50% 초과의 threshold 상향 — 별도 ADR + task. 도메인 코드가 충분히 쌓인 후 (예: P2 끝나는 시점).
- per-file threshold (전역만, 처음엔).
- Codecov / Coveralls 등 외부 서비스 연동 — 별도 ADR.
- Mutation testing (stryker 등) — 장기 ADR.

## Suggested Sub-agents

`implementer` (package.json + ci.yml) → `tester` (R-112 자체 test + threshold 미달 시 fail 검증)

## Follow-ups

(빈 칸)
