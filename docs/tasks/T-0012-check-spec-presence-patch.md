---
id: T-0012
title: scripts/check-spec-presence.sh 결함 patch (smoke suffix + test/* glob)
phase: P0.5
status: PENDING
commitMode: pr
coversReq: [REQ-060]
estimatedDiff: 5
estimatedFiles: 1
created: 2026-05-24
hqOrigin: T-0009-fallout
plannerNote: T-0007 산출물 결함 2건 patch — `.smoke-spec.ts` suffix 미포함 + `*/test/*` glob 이 leading-slash 없는 `test/*` 미매칭. T-0009 PR-10 CI fail 원인.
dependsOn: []
blocks: [T-0009]
---

# T-0012 — `scripts/check-spec-presence.sh` 결함 patch

## Why

2026-05-24 [T-0009](T-0009-smoke-test-infra.md) (smoke test 인프라) PR-10 의 CI 가 `spec-presence-check` step 에서 fail. 원인은 [T-0007](T-0007-ci-spec-presence-check.md) 산출물 [scripts/check-spec-presence.sh](../../scripts/check-spec-presence.sh) 의 2 결함:

1. **line 24 suffix 화이트리스트 누락**: `*.spec.ts|*.test.ts|*.e2e-spec.ts` 만 spec 으로 간주하고 `*.smoke-spec.ts` 가 빠짐. T-0009 가 도입하는 smoke 패턴 (`test/smoke/app.smoke-spec.ts`) 이 production 으로 오분류된다.
2. **line 25 `*/test/*` glob 결함**: bash case 의 `*/test/*` 는 leading slash 가 있는 path 만 매칭한다. `test/smoke/app.smoke-spec.ts` 처럼 leading 토큰이 `test/` 인 path 는 매칭되지 않아 production 으로 오분류된다.

본 결함은 [T-0007](T-0007-ci-spec-presence-check.md) 의 자체 test (R-112 negative) 가 다양한 path 조합을 cover 하지 못한 결과다. T-0007 이 [HQ-0003](../STATE.json) driver-misroute 사고로 CI 검증 누락 상태로 main 에 박혔던 부작용이 본 결함의 검출을 늦췄다.

본 task 는 hqOrigin frontmatter 를 `T-0009-fallout` 으로 두되 humanQuestion 없이 (planner 자체 판단) patch task 로 진행한다. `blocks: [T-0009]` 로 표기 — 본 task merge 후 driver 가 T-0009 PR 의 CI 재시도를 trigger 하면 통과한다.

## Required Reading

- [scripts/check-spec-presence.sh](../../scripts/check-spec-presence.sh) — 현 결함 source (line 23~26 case 절).
- [docs/tasks/T-0007-ci-spec-presence-check.md](T-0007-ci-spec-presence-check.md) — 원 task 정의 (Acceptance Criteria 중 "제외 패턴" 단락 참조).
- [docs/tasks/T-0009-smoke-test-infra.md](T-0009-smoke-test-infra.md) — 본 결함을 노출시킨 task. smoke 의 path 패턴 (`test/smoke/app.smoke-spec.ts`) 확인.
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml) — 본 script 가 호출되는 위치 (`spec-presence-check` step).
- [CLAUDE.md](../../CLAUDE.md) §3.2 R-112 (patch 의 regression test 의무 단락).

## Acceptance Criteria

### 코드 patch

- [ ] [scripts/check-spec-presence.sh](../../scripts/check-spec-presence.sh) 의 line 24 case 패턴을 다음으로 갱신:
  - 기존: `*.spec.ts|*.test.ts|*.e2e-spec.ts) continue ;;`
  - 신규: `*.spec.ts|*.test.ts|*.e2e-spec.ts|*.smoke-spec.ts) continue ;;`
- [ ] 같은 파일 line 25 case 패턴을 다음으로 갱신:
  - 기존: `*/test/*|*/__tests__/*) continue ;;`
  - 신규: `test/*|*/test/*|*/__tests__/*) continue ;;`
- [ ] 두 변경 외 다른 라인 수정 금지 (Out of Scope 참조).

### R-112 자체 test (5 항목 — patch 이므로 regression 의무 포함)

본 script 는 T-0007 의 자체 test 단락이 산재한 환경 setup 을 요구한다 (git diff 의존). 본 patch 의 test 는 다음 중 한 방식을 implementer/tester 가 선택:

- (선호) `scripts/check-spec-presence.test.sh` 신설 — 임시 디렉토리 + git init 으로 가짜 PR diff 환경 구성 후 본 script 의 exit code 와 stderr 를 검증하는 shell test. CI 의 별도 step 또는 본 step 의 self-test 로 호출.
- (대안) jest 의 `child_process.execFileSync` 로 bash script 를 spawn 해 검증하는 `scripts/check-spec-presence.spec.ts`.

어느 방식이든 다음 5 항목을 cover:

- [ ] **happy-path**: 기존 `src/app.service.spec.ts` 같은 정상 spec path 가 spec 으로 인식되어 production count 에 포함되지 않음. script exit 0 확인.
- [ ] **error-path**: 임시로 가짜 production 파일 (`src/__dummy__.ts`) 을 git diff 에 노출시킨 후 대응 spec 부재 시 script exit 1 + stderr 메시지 ("신규 production .ts 에 대응 spec 이 없습니다") 확인. test 종료 시 임시 파일 정리.
- [ ] **flow / branch**: case 절의 분기 각각에 대해 별도 입력으로 매칭 검증 — (a) `*.smoke-spec.ts` suffix 분기, (b) `test/*` (leading) 분기, (c) `*/test/*` (mid-path) 분기, (d) `*/__tests__/*` 분기, (e) `src/main.ts` 분기, (f) index re-export 분기. 최소 (a)·(b) 는 필수, 나머지는 가능한 범위에서.
- [ ] **negative**: 잘못된 suffix (예: `*.notspec.ts`, `*.spec.txt`) 가 spec 으로 잘못 통과되지 않음 확인. 즉 그런 파일이 추가되면 본 script 가 missing 으로 잡아 exit 1.
- [ ] **regression (R-112 patch 의무)**: `test/smoke/app.smoke-spec.ts` 와 동일한 path shape 가 spec 으로 정상 인식되어 production count 에 들어가지 않음. 본 항목이 fail 하면 본 결함이 재발한 것 — CI 에서 즉시 감지된다.

### R-110 / R-111 / R-114

- [ ] tester 가 본 task 의 모든 변경 후 로컬에서 `pnpm lint && pnpm build && pnpm test` + 본 script 의 self-test 실행해 전부 pass 함을 확인.
- [ ] PR push 후 CI workflow run conclusion 이 `success` 임을 driver 가 확인 (R-114). 특히 `spec-presence-check` step 이 본 patch 적용 후 green.
- [ ] CI step 중 어느 하나라도 fail 이면 PR red → integrator 가 ANOTHER_ROUND 또는 BLOCKED (R-111).

### Size

- [ ] 단일 commit, ≤300 LOC / ≤5 파일. 예상: script patch +2 LOC / 1 파일 + self-test 신설 ~30~80 LOC / 1 파일 = 합 2 파일 / ≤100 LOC.

## Out of Scope

- `scripts/check-spec-presence.sh` 전체 재작성. 본 task 는 명시된 2 line 만 patch.
- 다른 CI script / workflow 결함 fix — 본 task 한정.
- 새 npm dependency 추가 — 본 script 는 bash 만 사용. shell test 도 bash 표준 toolchain 으로 작성.
- [T-0009](T-0009-smoke-test-infra.md) 의 CI 재시도 작업 — 본 task merge 후 다음 driver turn 이 별도 step / 별도 commit 으로 처리.
- T-0007 의 사후 추가 검증 (예: `*/e2e/*` glob 누락 같은 다른 잠재 결함 발굴) — 발견 시 본 task 의 Follow-ups 에만 적고 별도 task 로 분리.
- check-spec-presence.sh 의 i18n / 메시지 한국어 정련 — 본 task 한정.

## Suggested Sub-agents

`implementer` (script 2 line patch + self-test 작성) → `tester` (R-112 5 항목 실행 + 로컬 `pnpm lint/build/test` + self-test 출력 PR body 첨부)

## Follow-ups

(빈 칸 — sub-agent 가 진행 중 채움)
