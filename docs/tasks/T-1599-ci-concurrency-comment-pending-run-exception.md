---
id: T-1599
title: ci.yml concurrency 주석의 "연속 run 을 cancel 하지 않는다" 서술에 pending-run 예외를 명시
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-059, REQ-062]
estimatedDiff: 12
estimatedFiles: 1
created: 2026-08-18
createdAt: 2026-08-18T10:20:00Z
independentStream: ci-workflow-doc-sync
dependsOn: [T-1598]
touchesFiles: [.github/workflows/ci.yml]
plannerNote: P5 CI doc-sync — T-1598 이 명시 이월한 최우선 후보. 주석이 pending main-push run 취소를 부정해 benign-red 를 CI fail 로 오판하게 함.
---

# T-1599 — ci.yml concurrency 주석의 "연속 run 을 cancel 하지 않는다" 서술에 pending-run 예외를 명시

## Why

[.github/workflows/ci.yml](../../.github/workflows/ci.yml) `30~32 행` 주석은 `cancel-in-progress` 가
`pull_request` event 일 때만 true 라는 사실로부터 "**main push · issue_comment · pull_request_review 의
연속 run 은 cancel 하지 않아** main-push CI green 게이트(CLAUDE.md §11 / R-114)와 approval-gate
rerun(§3.3 gate-2) 무결성을 보호한다" 를 **무조건 단언** 한다. 그러나 2026-08-18 09:05 관측
([docs/progress/journal-2026-08-18.md](../progress/journal-2026-08-18.md) 의 `09:05 driver` 항목) 은
반례를 남겼다 — 머지 commit `4d29e574` 의 main push run `32118738010` 이 job 0 개인 **대기(queued/pending)**
상태에서 같은 `ci-refs/heads/main` 그룹의 후속 push `13a8ef8c` 가 도착하자 `conclusion=cancelled` 로 종료됐다.
`cancel-in-progress: false` 가 보호하는 대상은 **실행 중(in_progress)** run 이고, 그룹당 **대기 run 은 1 개만
유지**하는 GitHub 동작은 그와 별개이기 때문이다.

drift 방향이 위험한 쪽이다. 주석대로 읽으면 판독자(및 다음 fire 의 driver)는 main push 의 `cancelled` 를
"있을 수 없는 일 = CI fail" 로 해석해 `ci.consecutiveFails` 를 올리거나 불필요한 BLOCKED 로 갈 수 있다.
실제로는 후속 run 의 tree 가 앞선 commit 을 포함하므로 R-114 정산은 후속 run 의 conclusion 으로 갈음되는
**benign-red** 다. 본 task 는 그 예외 한 갈래와 판독 지침을 주석에 박제한다 — **yaml 동작은 한 글자도 바꾸지
않는다**. 직전 fire(T-1598)가 Out of Scope 로 "차순위 후보 — 별도 slice" 라 명시 이월한 항목이며,
09:05 관측 박제가 그 근거다.

## Required Reading

- [.github/workflows/ci.yml](../../.github/workflows/ci.yml) `24~35 행` (ADR-0036 concurrency 주석 블록 + `concurrency:` 본체)
- [docs/tasks/T-1598-perf-readme-threshold-bullet-slice29.md](T-1598-perf-readme-threshold-bullet-slice29.md) 의 `## Out of Scope` 첫 항목 (본 task 로 이월된 문장)
- [docs/progress/journal-2026-08-18.md](../progress/journal-2026-08-18.md) 의 `09:05 driver` 항목 (관측 사실 — run 번호 · commit · 원인)
- [docs/decisions/ADR-0036-fine-grained-concurrency.md](../decisions/ADR-0036-fine-grained-concurrency.md) `§Decision 6` (per-PR concurrency group 결정 — 주석이 근거로 인용하는 조문. 본 task 는 ADR 본문을 **수정하지 않는다**)

## Acceptance Criteria

- [ ] `.github/workflows/ci.yml` 의 `concurrency` 주석 블록에 **pending-run 예외** 가 명시된다. 최소 다음 3 요소를 포함할 것:
      (a) `cancel-in-progress: false` 가 보호하는 대상은 **실행 중(in_progress)** run 이라는 한정,
      (b) 같은 그룹의 **대기(queued/pending)** run 은 그룹당 1 개만 유지되어 후속 push 에 밀려 `cancelled` 로 남을 수 있다는 예외,
      (c) 그렇게 남은 main-push `cancelled` 는 **benign-red** 로 판독한다는 지침 — `ci.consecutiveFails` 를 올리지 않고 후속 run 의 conclusion 으로 R-114 정산을 갈음.
- [ ] 관측 근거를 검증 가능한 좌표로 1 곳 인용한다 (`2026-08-18` · run `32118738010` · commit `4d29e574` → 후속 `13a8ef8c` 중 최소 run 번호와 날짜).
- [ ] **yaml 동작 불변** — `concurrency.group` 표현식 `ci-${{ github.event.pull_request.number || github.ref }}` 과 `cancel-in-progress: ${{ github.event_name == 'pull_request' }}` 는 **한 글자도 바뀌지 않는다** (`git diff` 로 두 줄이 diff 에 없음을 확인).
- [ ] 기존 주석의 나머지 단언(그룹 식별자 3 갈래 · `issue_comment` 의 `github.ref` 폴백 · 서로 다른 PR 과 main push 는 별개 그룹 · 비용이 동시 driver 수 N 선형 · approval-gate rerun 무결성)은 **과잉 정정 금지** — 표현 다듬기 없이 그대로 둔다.
- [ ] `.github/workflows/ci.yml` 외 파일 변경 0 (`git diff --name-only` 가 정확히 1 개).
- [ ] **R-112 (happy)** — 신규 production 코드 0 LOC · 신규 public symbol 0 이므로 신규 spec 대상이 없다. 대신 ci.yml 텍스트를 앵커하는 기존 smoke 2 종
      (`test/smoke/ci-workflow-perf-checkin-baseline-toggle-parity-drift.smoke-spec.ts`,
      `test/smoke/ci-workflow-verification-chain-contract-scripts-parity-drift.smoke-spec.ts`) 이 **갱신 후 ci.yml 에 대해 그대로 pass** 함을 확인한다 (주석 편집이 앵커를 깨지 않았다는 무회귀 근거).
- [ ] **R-112 (error / 분기 / negative)** — 갱신한 서술 (a)(b)(c) 를 위 앵커 spec 및 `pnpm test` 전량 결과와 **항목별 대조** 하고 그 대조표를 PR 본문에 기재한다 (코드 변경 0 doc-sync 의 선례 T-1597 · T-1598 과 동일 방식). 새로 추가되는 분기 없음 — 분기 항목은 "해당 없음" 으로 명시.
- [ ] `pnpm lint && pnpm build && pnpm test` 전량 통과 (R-110 — 코드 0 LOC 여도 tester 가 실행).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `src/` 무변경이라 직전 수치 유지가 기대값.
- [ ] PR 의 GitHub Actions 가 green — workflow 파일 자체를 수정하므로 **PR CI 가 발화한다는 사실 자체** 가 yaml 파싱 무결성의 증거다 (run 번호를 PR 본문에 기재).

## Out of Scope

- `concurrency.group` / `cancel-in-progress` 표현식 변경, `on:` trigger 변경, job / step 추가·삭제 — **동작 변경 일절 금지**. 본 task 는 주석 전용.
- `docs/STATE.json` 의 `ci.note` · `benignRedNote` 계열 필드 갱신 (direct-mode · driver 소관 — CLAUDE.md §3.1 rule 3 에 따라 본 pr task 와 섞지 않는다).
- `CLAUDE.md` · [docs/LOOP.md](../LOOP.md) · [docs/architecture/concurrency.md](../architecture/concurrency.md) · ADR-0036 본문에 같은 예외를 전파하는 doc-sync (필요하면 별도 slice — 본 task 는 ci.yml 1 파일).
- pending-run 예외를 강제하는 **신규 smoke spec 신설** (주석 산문을 앵커하는 spec 은 취약 — 별도 판단 필요).
- `test/perf/README.md` 접촉 (T-1597 · T-1598 이 이미 현행화 — 재정정 금지).
- ADR-0056 `§Follow-ups (c)` 임계 승격 — 동일 `env.label` 20 run 축적 부족으로 **착수 불가**.
- `*-realdb` / `*-read` 계열 perf-spec 의 factory 배선 확산.
- `deploy/daily-test.sh` leg · drift-guard smoke spec 접촉 (T-1122 파일 cap 전례 회피).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
