---
id: T-1387
title: requirements.md 75 행 REQ-056 well-known library·중복 import 금지·version mismatch 방지 상태를 실측 기반 재판정
phase: P7
status: PENDING
commitMode: direct
coversReq: [REQ-056]
estimatedDiff: 30
estimatedFiles: 2
created: 2026-08-02
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1387-requirements-library-duplication-version-mismatch-status-rejudge.md
plannerNote: "requirements-status-resync 33 번째 slice — T-1386 Out of Scope 가 남긴 REQ-056, 정책·중복·version pin·CI 4 축 정적 실측, doc-only direct"
---

# T-1387 — requirements.md 75 행 REQ-056 well-known library·중복 import 금지·version mismatch 방지 상태를 실측 기반 재판정

## Why

[docs/requirements.md](../requirements.md) 75 행 REQ-056 (README 108 행 — well-known & well-maintained library 사용 허용, 단 중복 사용 금지 · 이미 import 한 library 가 제공하는 기능을 위해 다른 library / 다른 version 을 다시 import 하지 않을 것) 은 kind = `Constraint`, 구현 위치 = `P0 + 모든 phase`, 검증 위치 = `policy + CI` 인데 상태 컬럼이 아직 `PLANNED` 다. 그 사이 main 에는 `pnpm-workspace.yaml` + 단일 root `pnpm-lock.yaml` 구조, `package.json` 의 `packageManager` pin, CI 의 `pnpm install --frozen-lockfile` step 이 실재하고 CLAUDE.md §5 가 새 dependency 추가를 BLOCKED 사유로 박제해, 표가 저장소 사실보다 뒤처졌는지 확인이 필요하다. 직전 slice [T-1386](T-1386-requirements-batch-scale-status-rejudge.md) 는 Out of Scope 에 "REQ-001 (20 행) · REQ-056 (75 행) 등 남은 `PLANNED` row 재판정 — 각각 별도 slice" 를 명시해 본 slice 를 남겨뒀다. `requirements-status-resync` stream 의 33 번째 slice 로 **정책 축 · 중복 library 축 · version pin 축 · CI 자동 검증 축** 을 각각 직접 실측해 표를 저장소 사실에 되돌린다.

## Required Reading

- `docs/requirements.md` — 75 행 (REQ-056) 및 표 헤더 (18~19 행) 의 컬럼 순서, 상태 enum (9 행). 인접 REQ-055 (74 행, `DONE`) · REQ-057 (76 행, `DONE`) 은 `|` 필드 수 비교용으로만 쓴다.
- `docs/tasks/T-1386-requirements-batch-scale-status-rejudge.md` — 직전 slice 의 상태 문자열 서술 포맷 (`DONE (implemented-on-main — <근거>)` / `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)` / `PLANNED` 유지 + 사유 부기) 과 완료 기록 포맷을 그대로 따른다. **단 그 안의 실측값 (perf-spec 건수 · 3600s 임계 등) 을 본 task 근거로 복사하지 않는다** — 그것은 배치 scale 축 (REQ-047) 의 근거이고 본 task 는 dependency 규율 축이다. 처음부터 직접 실측한다.
- `README.md` 106~108 행 — REQ-056 원문. 축 분해 = (a) **정책 축**: 새 library 도입을 통제하는 운영 규칙이 문서로 박제됐는지, (b) **중복 library 축**: 실제 manifest 에 동일 기능을 제공하는 library 가 2 개 이상 들어와 있는지, (c) **version pin / mismatch 방지 축**: package manager · lockfile · workspace 구조가 동일 library 의 복수 version 유입을 막고 있는지, (d) **CI 자동 검증 축**: 위 (b)(c) 를 CI step 이 자동으로 강제하는지.
- `CLAUDE.md` §1 (기술 스택 확정 표) · §5 (BLOCKED 처리 — "새 외부 dependency 추가") · §9 (안전장치 — "새 dependency 추가는 BLOCKED. 사용자 승인 후 ADR 작성 → 추가") — 정책 축의 1 차 근거. 해당 행을 § 번호와 함께 인용한다. **문서 서술은 그 자체로 CI 강제 근거가 아니다** — (d) 축과 분리해 판정한다.
- `.claude/agents/reviewer.md` 82 행 부근 (`library 추가` 를 새 ADR 필요 신호로 나열하는 check 항목) — 정책 축의 2 차 근거. 실제 행 번호를 확인해 인용한다.
- `package.json` — 7 행 `packageManager` 값, `dependencies` (25 행 부근) · `devDependencies` (46 행 부근) 블록. 중복 축 판정을 위해 **동일 기능군** (HTTP client · 테스트 러너 · 날짜 처리 · validation · ORM 등) 에 2 개 이상 들어온 항목이 있는지 확인하고, 없으면 "중복 0 건" 으로 적는다. `overrides` / `resolutions` 필드 존재 여부도 한 줄로 적는다.
- `pnpm-workspace.yaml` · `pnpm-lock.yaml` · `web/package.json` — version pin 축. root 단일 lockfile 인지 (`ls web/pnpm-lock.yaml` 부재 확인 포함), workspace 로 backend / web manifest 가 한 lockfile 아래 묶이는지를 실측해 적는다.
- `.github/workflows/ci.yml` 179~193 행 — CI 축. `pnpm 설치` / `Node.js 설치` / `의존성 설치` step 과 191 행 `pnpm install --frozen-lockfile` 을 행 번호와 함께 인용한다.
- 중복 / version 검사 step 실 근거용 — `grep -rn "dedupe\|depcheck\|npm ls\|why\|licenses" .github/workflows/ci.yml | head` 및 `grep -n "\"scripts\"" -A 30 package.json` 로 **중복 library 또는 version mismatch 를 판정(fail)하는 전용 step / script** 이 실재하는지 확인한다. 0 건이면 0 으로 적고 (d) 축을 충족으로 판정하지 않는다 (`--frozen-lockfile` 은 lockfile 정합 강제이지 중복 판정이 아니라는 점을 구분해 적는다).
- `docs/decisions/ADR-0001-stack.md` · `docs/decisions/ADR-0040-frontend-stack.md` — 정책 축 보강. 두 ADR 의 `status` 값만 인용하고 본문 재서술은 하지 않는다.

## Acceptance Criteria

- [ ] **정책 축** 을 실측한다 — `CLAUDE.md` §5 · §9 의 새 dependency BLOCKED 문장과 §1 스택 표, `.claude/agents/reviewer.md` 의 library 추가 check 항목을 각각 행 번호 (또는 § 번호) 와 함께 인용한다.
- [ ] **중복 library 축** 을 실측한다 — `package.json` 의 `dependencies` · `devDependencies` 항목 수를 각각 세고, 동일 기능군에 2 개 이상 들어온 사례가 있는지 판정해 "중복 N 건 (구체 항목 또는 0)" 으로 적는다. `overrides` / `resolutions` 필드 유무도 한 줄로 적는다.
- [ ] **version pin / mismatch 방지 축** 을 실측한다 — `packageManager` 값 (7 행), root `pnpm-lock.yaml` 단일성 (`ls web/pnpm-lock.yaml` 결과 포함), `pnpm-workspace.yaml` 의 workspace 목록을 인용해 backend / web 이 한 lockfile 아래 해석되는지를 적는다.
- [ ] **CI 자동 검증 축** 을 실측한다 — `.github/workflows/ci.yml` 191 행 `pnpm install --frozen-lockfile` 을 인용하고, 그와 별개로 **중복 library / version mismatch 를 직접 판정(fail)하는 전용 step 건수** 를 grep 결과로 적는다. 0 이면 0 으로 적고 축을 부분 충족 이상으로 판정하지 않는다.
- [ ] **검증 위치 컬럼 (`policy + CI`) 의 실 근거** 를 확인한다 — `policy` 축은 위 정책 축 인용으로, `CI` 축은 위 CI 축 실측으로 각각 충족 / 부분 충족 / 부재를 명시한다.
- [ ] REQ-056 (75 행) 의 상태 컬럼을 실측 결과에 따라 `DONE (implemented-on-main — <근거>)`, 일부 축만 충족 시 `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)`, 근거 부족 시 `PLANNED` 유지 + 유지 사유 부기 중 하나로 갱신한다. **어느 판정이든 근거에 실재하는 파일 경로 3 개 이상** 이 포함돼야 한다.
- [ ] 실측으로 확인되지 않은 부분 (예: transitive dependency 중복은 lockfile 전수 분석 없이는 판정 불가 · `--frozen-lockfile` 은 중복 탐지가 아님 · well-maintained 여부는 정적 판정 불가 등) 은 상태 문자열 안에 "한계 —" 로 1~2 절 부기한다.
- [ ] `grep -n "REQ-056" docs/requirements.md` 결과에서 해당 행의 상태 컬럼이 갱신 (또는 사유 부기) 됐고, 표의 컬럼 수 (`|` 필드 수) 가 인접 행 (REQ-055 · REQ-057) 과 동일하게 유지됨을 확인한다. 상태 문자열 안에 리터럴 `|` 문자를 넣지 않는다 (T-1370 · T-1375 사고 재발 방지). `wc -l docs/requirements.md` = 97 과 `grep -c "^| REQ-" docs/requirements.md` = 66 이 편집 전후 불변임도 확인한다.
- [ ] 본 task 파일의 `status` 를 `DONE` 으로 바꾸고 완료 시각 · 결과 요약 (실측값 포함) 을 추가한다.

## Out of Scope

- **package.json / pnpm-lock.yaml / pnpm-workspace.yaml / CI workflow 수정** — 중복 검사 step 부재 등 공백을 발견해도 manifest · lockfile · workflow 를 고치지 않는다 (새 dependency 도입은 CLAUDE.md §5 상 BLOCKED 사유이기도 하다). 발견 사항은 Follow-ups 에만 적는다.
- **`pnpm install` · `pnpm dedupe` · `pnpm why` 등 실행으로 lockfile 을 건드리는 행위** — 정적 실측 (파일 · 행 · 개수 · grep) 만 한다. 읽기 전용 조회조차 lockfile 재작성 위험이 있으면 하지 않는다.
- **transitive dependency 전수 감사** — `pnpm-lock.yaml` 전체를 훑어 중복 version 을 열거하지 않는다. top-level manifest 기준으로만 판정하고 한계로 부기한다.
- **CLAUDE.md · reviewer.md · ADR 수정** — 정책 서술 drift 를 발견해도 인용 · 부기만 한다.
- 상태 컬럼 외 다른 컬럼 (README 행 번호 · 요약 · kind · 구현 위치 · 검증 위치) 수정 — 검증 위치 재판정은 별도 slice.
- REQ-001 (20 행) 등 남은 `PLANNED` row 재판정 — 별도 slice.
- `src/` · `web/` · `test/` · `scripts/` 등 코드 · **코드 주석** 변경 일체 (본 task 는 `commitMode: direct` doc-only).
- T-1386 Follow-ups (S1 배치 harness 도입 · 1h 임계 assertion · scale seed · manual 절차) 의 구현 또는 재서술.

## Suggested Sub-agents

`implementer` (doc-only 실측 + 표 갱신). 코드 변경이 0 이므로 tester 는 생략한다 (CLAUDE.md §3.2 R-110 의 direct-mode doc-only 면제).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견 사항을 여기에 append 한다.)
