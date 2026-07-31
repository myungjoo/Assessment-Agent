---
id: T-1359
title: requirements.md 24~26 행 REQ-005~007 GitHub 3 instance 평가 상태를 실측 기반 DONE 으로 재판정
phase: P7
status: DONE
completedAt: 2026-07-31T23:38:42Z
commitMode: direct
coversReq: [REQ-005, REQ-006, REQ-007]
estimatedDiff: 14
estimatedFiles: 2
created: 2026-08-01
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1359-requirements-github-instance-status-rejudge.md
plannerNote: "requirements-status-resync 5 번째 slice — GITHUB_LIVE_HOST_SPECS 3 host 사양 + 단일 GithubAdapter 로 근거가 동형인 3 row 묶음"
---

# T-1359 — requirements.md 24~26 행 REQ-005~007 GitHub 3 instance 평가 상태를 실측 기반 DONE 으로 재판정

## Why

[T-1355](T-1355-requirements-llm-provider-status-rejudge.md) (LLM provider 5 row) → [T-1356](T-1356-requirements-scheduling-status-rejudge.md) (스케줄링 3 row) → [T-1357](T-1357-requirements-backfill-status-rejudge.md) (backfill 1 row) → [T-1358](T-1358-requirements-abusing-status-rejudge.md) (abusing 2 row) 로 이어진 **requirements 상태 컬럼 stale 해소** 축의 다섯 번째 slice 다. T-1358 직후에도 [requirements.md](../requirements.md) 66 row 중 **39 row 가 `PLANNED`** 로 남아, 표만 읽는 planner 가 이미 merge 된 기능을 "미착수" 로 오독해 중복 task 를 신설할 위험이 그대로다.

본 slice 의 대상은 **24 행 REQ-005** (github.com 평가) · **25 행 REQ-006** (github.sec.samsung.net 평가) · **26 행 REQ-007** (github.ecodesamsung.com 평가) 3 row 다. 세 row 를 한 slice 로 묶는 근거는 **판정 근거가 완전히 동형** 이기 때문이다 — 3 host 를 가르는 별도 구현이 없고 **단일 `GithubAdapter` + instance-keyed env config** ([ADR-0017](../decisions/ADR-0017-github-instance-config-source.md)) 하나가 셋을 함께 cover 하며, 3 host 사양 자체가 `GITHUB_LIVE_HOST_SPECS` **한 배열** (public / sec / ecode) 에 나란히 박제돼 있다. [modules.md](../architecture/modules.md) **35 행** GithubModule row 도 이미 REQ-005 · REQ-006 · REQ-007 셋을 한 모듈에 매핑해 두었다 — 즉 아키텍처 문서는 셋을 shipped 로 서술하는데 requirements 표만 `PLANNED` 로 말하는 **문서 자기 모순** 이며, T-1356 이 닫은 것과 같은 유형이다.

단 LLM provider slice (T-1355) 와 동일한 정직성 제약이 붙는다 — **실 host 접속은 credential/env 주입 시에만 발화** 하므로 상태 문자열에 그 한계를 함께 박제한다. 과장 없이 "배선 shipped · live 는 env-gated" 로 적는다.

## Required Reading

- [docs/requirements.md](../requirements.md) **9 행** (상태 enum 정의), **70~74 행** (T-1355 가 만든 `DONE (… live 는 env-gated)` 부기 표기 선례), **24~26 행** (편집 대상 3 row)
- [docs/architecture/modules.md](../architecture/modules.md) **35 행** (GithubModule row — 3 instance 통합 adapter + REQ-005/006/007 매핑)
- [src/github/github-live-test-gating.ts](../../src/github/github-live-test-gating.ts) **55~71 행** (`GITHUB_LIVE_HOST_SPECS` — public `github.com` / sec `github.sec.samsung.net` / ecode `github.ecodesamsung.com` 3 host 고정 사양)
- [src/github/github-adapter.service.ts](../../src/github/github-adapter.service.ts) **237 행** (`export class GithubAdapter` — 단일 dispatch service)
- [src/github/github-instance-config.ts](../../src/github/github-instance-config.ts) **86 행** (`resolveGithubInstances` — `GITHUB_INSTANCES` + per-key `_HOST`/`_ORG`/`_TOKEN_ENC` 를 instance config 로 변환)
- [src/github/github-request.builder.ts](../../src/github/github-request.builder.ts) **27~29 행** (public `github.com` 만 `api.github.com` 으로 라우팅되는 특례 — REQ-005 와 REQ-006/007 의 유일한 실차이)

## Acceptance Criteria

- [x] 편집은 [docs/requirements.md](../requirements.md) **24 · 25 · 26 행 세 줄뿐** 이며, 각 줄에서 바뀌는 것은 **마지막 `상태` 컬럼 1 개** 다. `REQ` / `README 행` / `요약` / `kind` / `구현 위치` / `검증 위치` 6 컬럼은 **글자 무수정** (특히 `구현 위치` 의 `P4` 와 `검증 위치` 의 `unit (provider) + e2e` / `unit + e2e` 는 그대로 둔다).
- [x] 세 행 상태를 `PLANNED` → 다음 문자열로 재판정 (`|` 문자를 넣지 않는다):
  - 24 행 REQ-005: `DONE (단일 GithubAdapter + instance-keyed env config 배선, public 은 api.github.com 라우팅 특례 — live 호출은 env-gated)`
  - 25 행 REQ-006: `DONE (같은 GithubAdapter 의 sec instance 경로, GITHUB_LIVE_HOST_SPECS 사양 박제 — live 호출은 env-gated)`
  - 26 행 REQ-007: `DONE (같은 GithubAdapter 의 ecode instance 경로, GITHUB_LIVE_HOST_SPECS 사양 박제 — live 호출은 env-gated)`
- [x] **실측 선행** (편집 전 executor 가 직접 수행, 결과를 commit trail 에 박제). 아래 6 개가 모두 기대치와 일치할 때만 flip 하고, 하나라도 어긋나면 flip 하지 않고 Follow-ups 에 실제 출력값과 함께 남긴다:
  - `grep -c "^| REQ-" docs/requirements.md` → **66**, `wc -l < docs/requirements.md` → **97** (편집 전후 동일)
  - `grep -n "export class GithubAdapter" src/github/github-adapter.service.ts` → **1 hit (237 행)**
  - `grep -n "export function resolveGithubInstances" src/github/github-instance-config.ts` → **1 hit (86 행)**
  - `grep -n "github.com\"\|github.sec.samsung.net\"\|github.ecodesamsung.com\"" src/github/github-live-test-gating.ts` → **3 hit (59 · 64 · 69 행)** — 3 host 사양이 한 배열에 박제됐다는 동형성 근거. 3 미만이면 부족한 host 의 row 는 flip 하지 않는다.
  - `ls src/github/*.spec.ts | wc -l` → **7** (`검증 위치` 컬럼의 `unit` 충족 근거)
  - `ls test/e2e/assessment-collection-trigger.e2e-spec.ts test/smoke/github-live.smoke-spec.ts test/smoke/github-adapter-roundtrip.smoke-spec.ts` → **3 파일 모두 존재** (e2e 는 host 무관 mocked 경로 1 건 + live smoke 는 env-gated 라는 사실 확인용. 부재 시 상태 문자열에서 해당 근거 표현을 빼고 그 사실을 Follow-ups 에 남긴다)
- [x] **구조 무손상**: 편집 후 `wc -l docs/requirements.md` = **97**, `grep -c "^| REQ-" docs/requirements.md` = **66**, 편집한 24 · 25 · 26 행의 `|` 개수 = **각 8**.
- [x] **잔여 stale 정직 보고**: 편집 후 `grep -c "PLANNED" docs/requirements.md` = **36** (39 − 3). 이 수치를 commit trail 에 적어 남은 stale 규모를 다음 planner 가 그대로 이어받게 한다. 날조 금지 — 실제 출력값을 적는다.
- [x] 변경 파일은 **2 개뿐** ([docs/requirements.md](../requirements.md) + 본 task 파일). `src/` · `web/` · `test/` · [PLAN.md](../PLAN.md) · [modules.md](../architecture/modules.md) · `STATE.json` 무수정.
- [x] doc-only direct commit 이라 R-110 tester 면제 — 그 사유를 commit trail `TESTER.coverage` 에 한 줄 명시하고, 위 grep 검증 결과로 대체한다.

## Out of Scope

- **나머지 36 개 `PLANNED` row 의 일괄 flip 금지.** 근거가 row 마다 달라 한 commit 에 묶을 수 없다 — 다음 slice 로 남긴다.
- **REQ-008 (27 행, 접근 권한 부족 인식·통지) 동시 처리 금지.** 근거 파일이 `src/permission-denied/` 계열로 달라 본 slice 의 동형성 조건을 깨뜨린다 — 별도 slice 후보로만 Follow-ups 에 남긴다.
- **REQ-014 (33 행, Issue 평가) 동시 처리 금지.** GithubModule 이 함께 매핑돼 있으나 판정 근거가 issue 평가 도메인 (`assessment-evaluation`) 쪽이라 다른 축이다.
- **REQ-030 (49 행, Export/backup + Restore) 처리 금지.** [T-1339](T-1339-api-doc-backup-restore-placeholder.md) 의 placeholder 표기 + Q-0055 의 복원 엔진 미완결 판정이 유지되는 한 flip 은 과장이다.
- **`docs/architecture/modules.md` · [PLAN.md](../PLAN.md) 동기 편집 금지.** 본 slice 는 requirements 표 한 축만 닫는다.
- **`src/` 리팩터 · live e2e 신설 · credential 주입 금지.** 상태 재판정은 실측 서술일 뿐 구현 변경이 아니다 (credential 실값 취급은 §9 · Q-0053 전제).

## Suggested Sub-agents

`implementer` (doc-only 실측 + 편집). tester 는 doc-only 라 면제 — grep self-check 로 대체.

## 결과 (2026-07-31T23:38:42Z, DONE)

**실측 선행 6 종 전부 기대치 일치** — flip 조건 충족 확인 후에만 편집했다 (실제 출력값):

| 검증 | 기대 | 실측 |
| --- | --- | --- |
| `grep -c "^\| REQ-" docs/requirements.md` | 66 | **66** |
| `wc -l < docs/requirements.md` | 97 | **97** |
| `grep -n "export class GithubAdapter" src/github/github-adapter.service.ts` | 1 hit (237 행) | **1 hit — 237 행** |
| `grep -n "export function resolveGithubInstances" src/github/github-instance-config.ts` | 1 hit (86 행) | **1 hit — 86 행** |
| 3 host 사양 (`github-live-test-gating.ts`) | 3 hit (59 · 64 · 69 행) | **3 hit — 59 `github.com` / 64 `github.sec.samsung.net` / 69 `github.ecodesamsung.com`** |
| `ls src/github/*.spec.ts \| wc -l` | 7 | **7** |
| e2e 1 + live smoke 2 파일 존재 | 3 파일 | **3 파일 모두 존재** |

3 host 사양이 `GITHUB_LIVE_HOST_SPECS` 한 배열에 나란히 박제돼 있어 **동형성 조건 (3 hit) 이 충족** — 세 row 를 모두 flip 했다.

**편집 결과**: [docs/requirements.md](../requirements.md) 24 · 25 · 26 행의 `상태` 컬럼 1 개씩만 `PLANNED` → `DONE (…)` 로 재판정. 나머지 6 컬럼 (`REQ` / `README 행` / `요약` / `kind` / `구현 위치` / `검증 위치`) 은 글자 무수정 — `P4`, `unit (provider) + e2e`, `unit + e2e` 그대로. 과장을 피해 세 문자열 모두 `live 호출은 env-gated` 한계를 함께 박제했다 (T-1355 의 부기 표기 선례 계승).

**구조 무손상 (편집 후 실측)**: `wc -l` = **97**, `grep -c "^| REQ-"` = **66**, 24 · 25 · 26 행 `|` 개수 = **각 8**.

**잔여 stale 정직 보고**: 편집 후 `grep -c "PLANNED" docs/requirements.md` = **36** (39 − 3, 기대치 일치). requirements 표 66 row 중 아직 36 row 가 `PLANNED` 로 남아 있어 다음 slice 가 이어받는다.

**변경 파일 2 개**: [docs/requirements.md](../requirements.md) + 본 task 파일. `src/` · `web/` · `test/` · [PLAN.md](../PLAN.md) · [modules.md](../architecture/modules.md) · `STATE.json` 무수정 (`git status` 로 확인).

## Follow-ups

- **REQ-008 (27 행, 접근 권한 부족 인식·통지) 별도 slice 후보** — 본 slice 의 Out of Scope 대로 미처리. 근거 파일이 `src/permission-denied/` 계열이라 동형성 축이 다르며, GithubModule 인접 row 중 남은 가장 가까운 후보다.
- **REQ-003 (22 행) · REQ-004 (23 행) 는 여전히 `PLANNED`** — GithubModule 수집 축과 평가·표시 축이 섞여 근거 파일이 다수라 별도 판정이 필요하다.
- 잔여 `PLANNED` **36 row** 의 일괄 flip 은 여전히 금지 — row 마다 근거가 달라 slice 단위로만 닫는다.
