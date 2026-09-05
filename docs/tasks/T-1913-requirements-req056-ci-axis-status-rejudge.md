---
id: T-1913
title: requirements.md 75 행 REQ-056 상태를 T-1912 CI 판정 step 머지 반영해 재판정
phase: P8
status: DONE
commitMode: direct
coversReq: [REQ-056]
estimatedDiff: 30
estimatedFiles: 2
independentStream: requirements-status-resync
dependsOn: [T-1912]
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1913-requirements-req056-ci-axis-status-rejudge.md
created: 2026-09-06
plannerNote: "T-1912 Follow-up (a) — REQ-056 유일 미충족 축(CI 판정 step)이 PR #1502 로 머지됨, §3.1 규정상 REQ 당 1 회 재판정"
---

# T-1913 — requirements.md 75 행 REQ-056 상태를 T-1912 CI 판정 step 머지 반영해 재판정

## Why

[docs/requirements.md](../requirements.md) `75 행` REQ-056 (README `108 행` — well-known library 사용 / 중복 import 금지 / version mismatch 방지) 은 [T-1387](T-1387-requirements-library-duplication-version-mismatch-status-rejudge.md) 재판정 이래 상태가 `IN_PROGRESS` 이고, 그 문자열이 미충족 사유로 지목한 축은 **"CI 중복 · mismatch 전용 판정 step 부재"** 딱 하나다 (정책 축 · 중복 library 축 · version pin 축 3 개는 같은 문자열이 충족으로 박제). 그 유일한 잔여 축을 닫는 구현 slice [T-1912](T-1912-dependency-consistency-ci-gate.md) 가 PR #1502 → main `6e1f207f` 로 머지됐다. CLAUDE.md `§3.1` 은 "`docs/requirements.md` 의 REQ status 재판정 task 는 그 REQ 를 구현하는 slice 가 머지된 뒤 REQ 당 1 회만 생성한다" 고 규정하므로, 지금이 REQ-056 재판정을 큐잉할 수 있는 시점이다. T-1912 Follow-ups (a) 가 지목한 항목이기도 하다.

**issue-still-relevant pre-check (planner 실측)** — ① `git log origin/main` 기준 현재 main 의 `docs/requirements.md` `75 행` 은 여전히 `IN_PROGRESS (... / CI 중복·mismatch 전용 판정 step 부재: ...)` 로 남아 있어 재판정이 이미 안착한 상태가 **아니다**. ② 반면 구현 쪽은 안착했다 — `scripts/check-dependency-consistency.sh` · `scripts/check-dependency-consistency.test.sh` 가 main 에 실재하고 `.github/workflows/ci.yml` `197 행` `201 행` (`의존성 정합성 검증` → `run: bash scripts/check-dependency-consistency.sh`) 과 `203 행` `205 행` (`의존성 정합성 script 자체 test`) 2 step 이 `Node.js 설치` 직후 · `의존성 설치` (`207 행`) 직전에 배선돼 있다. 따라서 본 task 는 **문서만 뒤처진 drift** 를 닫는 doc-only slice 다.

## Required Reading

- [docs/requirements.md](../requirements.md) `75 행` (REQ-056 행 전체) + 표 헤더 `18 행` ~ `19 행` (컬럼 순서) + `9 행` (상태 enum). 인접 `74 행` REQ-055 · `76 행` REQ-057 은 `|` 필드 수 대조용으로만 읽는다.
- [docs/tasks/T-1387-requirements-library-duplication-version-mismatch-status-rejudge.md](T-1387-requirements-library-duplication-version-mismatch-status-rejudge.md) — 직전 REQ-056 재판정의 4 축 분해 (정책 / 중복 library / version pin / CI 자동 검증) 와 상태 문자열 포맷 (`DONE (implemented-on-main — <근거>)` · `한계 —` 부기) 의 정본. **그 안의 실측값을 그대로 복사하지 말고** 아래 항목을 직접 재확인한다.
- [docs/tasks/T-1912-dependency-consistency-ci-gate.md](T-1912-dependency-consistency-ci-gate.md) — 본 재판정이 반영할 구현 slice 의 판정 범위 (J1 공통 의존성 version mismatch / J2 lockfile 단일성 / J3 `overrides` · `resolutions` 금지) 와 그 **Out of Scope** (transitive dependency 는 판정 대상 아님).
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml) `196 행` ~ `208 행` — 신규 step 2 개의 `name` · `run` 과 삽입 위치 (`Node.js 설치` 직후 · `의존성 설치` 직전). 인용 시 실제 행 번호를 파일에서 재확인해 적는다.
- [scripts/check-dependency-consistency.sh](../../scripts/check-dependency-consistency.sh) — J1 ~ J3 판정 3 종의 실재 확인용 (출력 문구 · exit code 규약만 확인, 수정 금지).
- [README.md](../../README.md) `108 행` — REQ-056 원문. 상태 문자열이 원문 3 요소 (well-known library / 중복 금지 / version mismatch 방지) 를 모두 다루는지 대조용.

## Acceptance Criteria

- [x] **CI 자동 검증 축 재실측** — `.github/workflows/ci.yml` 에서 `의존성 정합성 검증` · `의존성 정합성 script 자체 test` 2 step 의 실제 행 번호와 `run:` 값을 확인해 상태 문자열에 인용한다. `grep -c "check-dependency-consistency" .github/workflows/ci.yml` 결과 (2) 도 근거로 적는다.
- [x] **판정 범위 명시** — 새 CI 축이 닫는 것이 J1 (root ↔ `web` 공통 의존성 version spec 불일치) · J2 (lockfile 단일성, ADR-0040 `§4`) · J3 (`overrides` · `resolutions` 금지) 3 종임을 상태 문자열에 적는다. `bash scripts/check-dependency-consistency.sh` 를 1 회 실행해 exit 0 과 요약 3 줄 출력을 확인하고 그 사실을 근거로 적는다 (script 는 정적 판정만 하므로 lockfile 재작성 없음).
- [x] **나머지 3 축 유지 확인** — 정책 축 (CLAUDE.md `§5` · `§9` 새 dependency BLOCKED + `§1` 스택 표) · 중복 library 축 (`overrides` · `resolutions` 부재) · version pin 축 (`packageManager` pin + root 단일 `pnpm-lock.yaml`) 이 여전히 성립함을 최소 1 개 명령 또는 파일 인용으로 각각 재확인한다 (전면 재서술은 하지 말고 기존 문장을 보존한다).
- [x] **상태 컬럼 갱신** — `75 행` 상태를 `DONE (implemented-on-main — ...)` 로 전이하되, 근거에 **실재 파일 경로 3 개 이상** (`.github/workflows/ci.yml` · `scripts/check-dependency-consistency.sh` · `scripts/check-dependency-consistency.test.sh` 등) 이 포함돼야 한다. 4 축 중 어느 하나라도 실측에서 미충족으로 나오면 `DONE` 으로 올리지 말고 `IN_PROGRESS (<충족 축> / <미충족 축>)` 를 유지하고 사유를 갱신한다.
- [x] **한계 부기 유지** — `한계 —` 절에 (a) top-level manifest 정적 판정이라 `pnpm-lock.yaml` transitive dependency 의 복수 version 유입은 여전히 판정 불가, (b) README `108 행` 의 "well-maintained" 유지보수 활성도는 외부 조회 없이는 정적 판정 불가 2 가지를 남긴다 (기존 문장 재사용 가능).
- [x] **표 무결성 검증** — 편집 후 `awk 'NR==75' docs/requirements.md | grep -o "|" | wc -l` 이 `8` 로 인접 `74 행` · `76 행` 과 동일하고, 상태 문자열 안에 리터럴 `|` 문자가 없으며 (T-1370 · T-1375 사고 재발 방지), `wc -l docs/requirements.md` = `121` 과 `grep -c "^| REQ-" docs/requirements.md` = `84` 가 편집 전후 불변임을 확인한다.
- [x] 본 task 파일의 frontmatter `status` 를 `DONE` 으로 바꾸고 본문 끝에 완료 시각 · 실측 요약 (인용한 행 번호 포함) 을 1~3 줄로 추가한다.

## Out of Scope

- `.github/workflows/ci.yml` · `scripts/check-dependency-consistency*.sh` · `package.json` · `web/package.json` · lockfile **수정 일체** — 본 task 는 `commitMode: direct` doc-only 다. 결함을 발견하면 Follow-ups 에만 적는다.
- `pnpm install` · `pnpm dedupe` · `pnpm why` 등 **lockfile 을 건드릴 수 있는 명령 실행** — 허용 실행은 읽기 전용인 `bash scripts/check-dependency-consistency.sh` (와 필요 시 `.test.sh`) 뿐이다.
- transitive dependency 전수 감사 · `pnpm-lock.yaml` 파싱.
- REQ-056 행의 **상태 외 컬럼** (README 행 번호 · 요약 · kind · 구현 위치 · 검증 위치) 수정. 검증 위치 컬럼은 이미 `policy + CI` 라 전이 불요다.
- [docs/use-cases/REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `429 행` 등에 인용된 과거 audit snapshot 의 `IN_PROGRESS` 문자열 **소급 치환** — 그것은 당시 실측의 기록이다 (CLAUDE.md `§12` 소급 치환 금지 동형).
- 다른 REQ row 재판정 (REQ-003 `22 행` · REQ-004 `23 행` 의 프런트 렌더 drift 등) — T-1912 Follow-ups (c) 로 별도 slice.
- PLAN.md · CLAUDE.md · ADR 갱신.

## Suggested Sub-agents

`implementer` (doc-only — architect · tester 불요, R-110 은 direct doc-only commit 면제)

## Follow-ups

- (a) [docs/requirements.md](../requirements.md) REQ-003 `22 행` · REQ-004 `23 행` 의 "프런트 렌더 미충족" stale drift 정정 (`direct`) — T-1912 Follow-ups (c) 승계.
- (b) transitive dependency 복수 version 판정 (lockfile 분석) 의 필요성 · 도구 유무 검토 — 새 도구가 필요하면 ADR + 사람 승인 선행 (T-1912 Follow-ups (b) 승계).

## 완료 기록

2026-09-06 완료 (`direct` doc-only, 1 commit). 실측 — `.github/workflows/ci.yml` 197 행 · 201 행 (`의존성 정합성 검증` → `run: bash scripts/check-dependency-consistency.sh`) 과 203 행 · 205 행 (`의존성 정합성 script 자체 test`) 2 step 이 `Node.js 설치` 직후 · 207 행 `의존성 설치` 직전에 배선, `grep -c "check-dependency-consistency" .github/workflows/ci.yml` = 2, `bash scripts/check-dependency-consistency.sh` exit 0 + 요약 3 줄 (J1 · J2 · J3 위반 0).
나머지 3 축도 재실측 유지 — 정책 축 `CLAUDE.md` 85 행 · 111 행 · 11 행 (T-1387 이 인용한 246 행 · 310 행 · 31 행 에서 이동, 상태 문자열에 재실측값으로 갱신), 중복 library 축 `overrides` · `resolutions` 매치 0 건 (root deps 19 개 31~49 행 · devDeps 25 개 52~76 행), version pin 축 `package.json` 7 행 `packageManager` pin + root 단일 `pnpm-lock.yaml`.
표 무결성 — 75 행 `|` 8 개 (74 · 76 행과 동일), 상태 문자열 내 리터럴 `|` 0, `wc -l` = 121 · `grep -c "^| REQ-"` = 84 불변. `docs/requirements.md` 75 행 상태를 `IN_PROGRESS` → `DONE (implemented-on-main — ...)` 로 전이했다.
