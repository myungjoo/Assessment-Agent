---
id: T-1912
title: 의존성 version mismatch · 단일 lockfile · override 금지 판정 script 신설 + CI step 배선 (REQ-056 CI 축)
phase: P8
status: PENDING
commitMode: pr
coversReq: [REQ-056]
estimatedDiff: 265
estimatedFiles: 3
independentStream: ci-quality-gate
dependsOn: []
touchesFiles:
  - scripts/check-dependency-consistency.sh
  - scripts/check-dependency-consistency.test.sh
  - .github/workflows/ci.yml
created: 2026-09-06
plannerNote: "P8 품질 게이트 · REQ-056 유일 미충족 축(CI 판정 step 부재) — AdminView 부채 arc 목표선 도달로 종료돼 미충족 REQ 로 전환"
---

# T-1912 — 의존성 정합성 판정 script 신설 + CI step 배선 (REQ-056 CI 축)

## Why

[docs/requirements.md](../requirements.md) `75 행` REQ-056 (README `108 행` — well-known library / 중복 import 금지 / version mismatch 방지) 은 4 축 중 **정책 축 · 중복 library 축 · version pin 축 3 개가 이미 충족**이고 **"CI 중복 · mismatch 전용 판정 step 부재" 1 개만 미충족**으로 박제돼 있다. 본 task 는 그 유일한 잔여 축을, 이미 repo 에 자리잡은 `scripts/check-*.sh` + `scripts/check-*.test.sh` + CI step 3 종 세트 관례 (`check-spec-presence` · `check-doc-only-pr`) 를 그대로 승계해 닫는다.

**직전 arc 대신 본 task 를 고른 근거** — [docs/PLAN.md](../PLAN.md) `184 행` AdminView god component 부채 bullet 은 [T-1911](T-1911-plan-adminview-debt-remeasure-marker-promote.md) 로 실측 1,958 줄 · 목표선 `≤ 2,000` 통과 · 마커 `[x]` 승격이 끝났고, 남은 파트 패널은 bullet 자신이 **"목표선 통과 후 선택적 개선"** 으로만 지목한다 (기계적 연장은 한계효용이 낮다). PLAN 의 다른 열린 축은 planner pre-check 에서 다음과 같이 배제했다 — ① R-91 k6 부하검증 (`157 행`) 은 부하계획 `§3` T-1706 판정이 잔여 ①(실 수집 왕복) 을 **㉠ 사람 승인 대기 · ㉡ ㉢ 해소 불요**로 닫아 자율 집행 가능 slice 가 0 건, ② R-92 per-route baseline (`158 행`) 은 오너 지시로 **신규 slice 큐잉 금지**, ③ [docs/requirements.md](../requirements.md) REQ-003 · REQ-004 의 "프런트 렌더 미충족" 서술은 pre-check 실측 결과 `web/src/api/assessmentRow.ts` · `web/src/components/AssessmentResultTable.tsx` 배선으로 **이미 해소된 stale drift** 라 구현 task 대상이 아니다 (Follow-ups (c) 로 이월). 남은 축 중 자율 집행 가능하고 README 지시를 실제로 닫는 것은 REQ-056 의 CI 판정 step 이다.

**현 상태 실측 (본 게이트가 main 에서 green 임을 보증)** — root 와 `web/package.json` 의 공통 의존성은 `typescript` 1 개이며 양쪽 `5.6.2` 로 일치, lockfile 은 root `pnpm-lock.yaml` 단일, 두 manifest 모두 `overrides` · `resolutions` 키 0 개다.

## Required Reading

- [docs/requirements.md](../requirements.md) `75 행` — REQ-056 행. 특히 "**미충족은 CI 자동 검증 축**" 문단 (부재 근거: ci.yml 에 dedupe · depcheck · npm ls · why · licenses 매치 0, package.json scripts 에도 0).
- [scripts/check-doc-only-pr.sh](../../scripts/check-doc-only-pr.sh) + [scripts/check-doc-only-pr.test.sh](../../scripts/check-doc-only-pr.test.sh) — 신설 script · self-test 의 **형식 정본** (shebang · `set -euo pipefail` · 한국어 사유 출력 · exit code 규약 · fixture 임시 디렉터리 정리 관례).
- [scripts/check-spec-presence.sh](../../scripts/check-spec-presence.sh) `1 행` ~ `18 행` — env 로 판정 대상을 주입하는 관례 (`BASE_REF`). 본 script 는 같은 형으로 `TARGET_ROOT` 를 주입받아 fixture 검사 가능해야 한다.
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml) `87 행` ~ `99 행` (검사 step + 자체 test step 쌍의 서식) 과 `186 행` ~ `198 행` (pnpm 설치 → Node.js 설치 → 의존성 설치 순서 — 신규 step 삽입 지점).
- [test/smoke/ci-workflow-verification-chain-contract-scripts-parity-drift.smoke-spec.ts](../../test/smoke/ci-workflow-verification-chain-contract-scripts-parity-drift.smoke-spec.ts) `156 행` ~ `170 행` — ci.yml 의 `bash <path>` 를 추출해 파일 실존을 강제하는 drift guard (신규 step 이 이 계약을 만족해야 한다. 하드코딩 목록이 아니므로 **spec 수정은 불필요**).
- [package.json](../../package.json) `7 행` ~ `9 행` (`packageManager` · `engines`) 과 [web/package.json](../../web/package.json) 전체 — 판정 입력 2 개.

## Acceptance Criteria

- [ ] `scripts/check-dependency-consistency.sh` 신설 — 인자 0 개, `TARGET_ROOT`(미지정 시 repo root) 아래를 판정하고 **판정 3 종만** 수행한다. 위반 0 이면 판정별 요약 1 줄씩 출력 후 exit 0, 위반 1+ 이면 한국어 사유 + 위반 항목을 출력하고 exit 1.
  - J1 **공통 의존성 version mismatch** — root `package.json` 과 `web/package.json` 의 `dependencies` + `devDependencies` 를 각각 병합해 공통 이름의 version spec 문자열이 다르면 위반.
  - J2 **lockfile 단일성** — `pnpm-lock.yaml` 은 root 1 개만 허용. `web/pnpm-lock.yaml` · `package-lock.json` · `yarn.lock` (root · web) 중 하나라도 존재하면 위반 (ADR-0040 `§4` 단일 lockfile workspace).
  - J3 **version 재작성 필드 금지** — 두 manifest 중 어느 쪽이든 최상위 `overrides` · `resolutions` 키가 있으면 위반.
- [ ] JSON 파싱은 `node -e` 로 한다 (`jq` 의존 0 — cloud runner 에 jq 부재). 네트워크 호출 · `pnpm install` · `pnpm dedupe` · lockfile 재작성 **0**, 새 dependency **0**.
- [ ] happy path 1+ — `bash scripts/check-dependency-consistency.sh` 가 현 repo 상태에서 exit 0 이고 J1 ~ J3 요약 3 줄을 출력한다.
- [ ] error path 1+ (판정별) — J1 위반 fixture · J2 위반 fixture · J3 위반 fixture 각각에서 exit 1 이고 어떤 판정이 왜 실패했는지 한국어 사유가 출력된다.
- [ ] 분기별 1+ — J1 은 (공통 이름 0 개 / 공통 있고 전부 일치 / 공통 있고 1+ 불일치) 3 분기, J2 는 (`web/pnpm-lock.yaml` / `package-lock.json` / `yarn.lock`) 3 분기, J3 은 (`overrides` / `resolutions` / 둘 다 부재) 3 분기를 각각 케이스로 갖는다.
- [ ] negative case 를 예외 분기마다 1+ — ① 파싱 불가 JSON (exit 1 + 파싱 실패 사유, stack trace 노출 금지) ② `web/package.json` 부재 (J1 을 skip 하고 나머지 판정만 수행, 오탐 0) ③ `dependencies` · `devDependencies` 키 자체가 없는 manifest ④ 두 키가 빈 객체 ⑤ version spec 이 문자열 아닌 값 — 각 1+ 케이스.
- [ ] `scripts/check-dependency-consistency.test.sh` 신설 — 위 케이스를 임시 디렉터리 fixture 로 돌리는 self-test. **케이스 ≥ 8**, 전부 통과 시 exit 0, 실패 시 어떤 케이스가 왜 깨졌는지 출력 후 exit 1. 임시 디렉터리는 종료 시 정리하고 repo 파일을 쓰지 않는다.
- [ ] `bash scripts/check-dependency-consistency.test.sh` 가 exit 0.
- [ ] `.github/workflows/ci.yml` 의 **기본 검사** job 에 step 2 개가 "Node.js 설치" 직후 · "의존성 설치" 직전에 삽입됨 — `의존성 정합성 검증`(`run: bash scripts/check-dependency-consistency.sh`) 과 `의존성 정합성 script 자체 test`(`run: bash scripts/check-dependency-consistency.test.sh`). 파일 확인으로 검증.
- [ ] `pnpm lint && pnpm build && pnpm test` green (R-110 — production TS 변경 0 LOC 여도 필수).
- [ ] `pnpm test:cov` 임계 통과 (line ≥ 80% / function ≥ 80%) — 신규 `.ts` 파일 0 이라 전역 coverage 는 불변이어야 한다.
- [ ] `pnpm test:smoke` green — 특히 `ci-workflow-verification-chain-contract-scripts-parity-drift.smoke-spec.ts` 가 신규 `bash scripts/...` 2 경로의 실존을 통과 (해당 spec 무수정).

## Out of Scope

- `pnpm-lock.yaml` 전수 파싱 · transitive dependency 의 복수 version 유입 판정 (본 slice 는 top-level manifest 정적 판정만).
- `pnpm dedupe` · `depcheck` · `npm audit` · license 검사 등 **새 도구 도입** — 새 dependency 는 CLAUDE.md `§5` BLOCKED 사유다.
- `package.json` 의 `scripts` 키 추가 (CI 가 `bash` 로 직접 호출하므로 불필요) 및 lockfile · manifest 내용 변경.
- `.github/workflows/ci.yml` 외 다른 workflow (`load-k6.yml` · deploy 계열) 수정.
- [docs/requirements.md](../requirements.md) REQ-056 status 재판정 — CLAUDE.md `§3.1` 규칙대로 **본 slice 머지 후 1 회** 별도 task 로 한다.
- `.claude/` · CLAUDE.md · PLAN.md 등 문서 갱신 (direct 대상이라 본 pr task 에 섞지 않는다).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (a) 본 PR 머지 후 [docs/requirements.md](../requirements.md) REQ-056 status 재판정 1 회 (`direct`) — CI 축 충족 반영.
- (b) transitive dependency 복수 version 판정 (lockfile 분석) 의 필요성 · 도구 유무 검토. 새 도구가 필요하면 ADR + 사람 승인 선행.
- (c) [docs/requirements.md](../requirements.md) REQ-003 `22 행` · REQ-004 `23 행` 의 "프런트 렌더 미충족" 서술 stale drift 정정 (`direct`, 구현 arc 무관 drift 정정 예외) — 본 task planner pre-check 실측: `web/src/views/DashboardView.tsx` `31 행` ~ `34 행` 이 `deriveAssessmentDisplayRows` · `AssessmentDisplayRow` · `assessmentRowOps` 를 소비하고 `861 행` 이 `AssessmentResultTable` 로 렌더해 필드명 불일치 (`subjectName` / `metricLabel` / `score`) 는 이미 해소돼 있다.
