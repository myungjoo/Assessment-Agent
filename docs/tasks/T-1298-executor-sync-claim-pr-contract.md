---
id: T-1298
title: executor 계약에 PR-open 직후 claim prNumber 동기 의무 + main 복귀 ff-only 박제
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-057, REQ-058]
estimatedDiff: 70
estimatedFiles: 1
created: 2026-07-29
independentStream: agent-contract-doc
dependsOn: []
touchesFiles:
  - .claude/agents/executor.md
plannerNote: "doc-only inline-amend x0.64 = 약 70 LOC / 1 파일. 4 fire 연속 관측된 sync-claim-pr 관례 의존 상태를 계약으로 승격 (dup-PR #645/#646 재발 차단)"
---

# T-1298 — executor 계약에 PR-open 직후 claim prNumber 동기 의무 + main 복귀 ff-only 박제

## Why

[LOOP.md](../LOOP.md) §1[4] 는 PR open 직후 `scripts/sync-claim-pr.sh` 로 claim 의 `prNumber` 를 동기하는 의무를 **driver** 에게 지운다. 그러나 실제 cron fire 에서는 executor 가 PR open → reviewer → merge 를 한 호출 안에서 흡수해 **driver 가 PR 번호를 머지 뒤에야 알게 되므로** 그 step 을 driver 가 수행할 창 자체가 없다. 최근 4 fire 관측: T-1293 · T-1294 는 executor 가 자발적으로 호출해 메웠고, T-1295 · T-1296 는 누락(`prNumber: null` 인 채 머지 후 prune), T-1297 은 driver 가 executor 에게 **말로 지시**해 exit 0 성공했다 — 즉 계약이 문서가 아니라 그때그때의 driver prompt 와 관례에 의존한다.

실 피해는 아직 0 이지만(각 fire 가 60 분 stale 임계 이내라 reclaim 개입 창이 열리지 않았다), 이 동기가 빠진 claim 은 reclaim 의 `prNumber != null → RESUME` 분기를 잃어 **다음 driver 가 같은 task 로 중복 PR 을 여는** 사고(T-0730 forensic, PR #645 vs #646)로 직결된다. `flags.fineGrainedConcurrency` 가 ON(stage 5b, `maxConcurrentClaims=2`)인 현재는 그 창이 실재한다.

본 task 는 그 의무를 **executor 자신의 계약**으로 승격한다 — driver 가 PR 전 구간을 위임한 dispatch 형태에서 PR 을 연 주체가 executor 라면, 동기 호출도 executor 책임이다. 같은 파일에서 [CLAUDE.md](../../CLAUDE.md) §9 위반 1 건(executor 가 main 복귀 시 `git reset --hard origin/main` 사용 — T-1295 fire 자진 기록)도 함께 닫는다. 두 항목 모두 같은 1 파일의 계약 결함이라 한 commit 한 주제로 묶인다.

**estimate 근거** — 신규 절 ~40 줄 + Hard rules 2 항목 + 기존 문장 정합 수정 ~10 줄 = base ~110, doc-only enumerated-section × 1.6 × inline-amend × 0.4 → **~70 LOC / 1 파일**.

## Required Reading

- [.claude/agents/executor.md](../../.claude/agents/executor.md) 전문 (99 행) — **유일한 변경 대상**. 특히 `# Workflow` 3~4 (sub-agent dispatch 순서, pr-mode 는 "stage everything but do not commit yet"), 7 (driver 반환 shape `SUMMARY` / `TRAIL` / `STATUS`), `# Hard rules` 첫 줄 ("You never commit, push, or open PRs. The driver does.").
- [docs/LOOP.md](../LOOP.md) 209~224 행 — driver 측 claim prNumber 동기 계약 정본. 호출 시점(PR number 확보 **직후**) · 인자 형태 · 토글 OFF 시 inert · **fail-safe 흡수(non-zero 여도 BLOCKED 아님, journal 경고만)** 근거가 여기 있다. **본 task 는 이 파일을 수정하지 않는다** — executor 쪽 문구가 이 절과 모순되지 않는지 대조 용도로만 읽는다.
- [scripts/sync-claim-pr.sh](../../scripts/sync-claim-pr.sh) 1~35 행 (헤더 주석의 계약 명세) — 인자 순서 `$1=task id / $2=pr number / $3=owner session id`, exit 0 = 성공 또는 idempotent no-op, non-zero = 인자 오류 / 대상 부재 / owner 불일치 / CAS 소진. 인용할 명령 형태의 정본. **0 수정**.
- [CLAUDE.md](../../CLAUDE.md) §9 안전장치 (`git push --force` / `git reset --hard origin/...` 절대 금지) 와 §4 sub-agent 표의 executor 행 — 추가할 Hard rule 의 근거.

## Acceptance Criteria

- [ ] **변경 파일 1 개** — `.claude/agents/executor.md` **만**. `docs/LOOP.md` · `CLAUDE.md` · `scripts/**` · `docs/STATE.json` · `src/**` **0 수정** (STATE / journal 은 driver 가 같은 bookkeeping commit 에서 갱신).
- [ ] **"PR 흐름 흡수 시" 절 신설** — `# Workflow` 안 또는 그 직후에 새 절을 두고, driver 가 PR open → reviewer → merge 를 executor 에게 위임한 dispatch 형태(cron 환경에서 nested sub-agent 가 불가해 실제로 관측되는 형태)에서 **PR number 를 확보한 직후, reviewer 를 호출하기 전** `bash scripts/sync-claim-pr.sh <T-NNNN> <PR번호> <owner>` 를 executor 가 **자체 호출하는 것이 의무** 임을 명시.
- [ ] **owner 인자 도출 규칙 명시** — (a) driver 가 session id 를 넘겼으면 그 값을 그대로 쓰고, (b) 없으면 lock ref 의 claims.json 에서 `taskId == <본 task>` 인 entry 의 `owner` 를 읽어 쓴다. (b) 의 실행 가능한 명령 형태를 1~2 줄로 박제(`git fetch origin refs/heads/claude/lock-driver` → `git show FETCH_HEAD:claims.json`). owner 를 추측·날조하지 말 것을 명시.
- [ ] **inert 조건 명시** — `flags.fineGrainedConcurrency` 가 OFF 이거나 claims.json 에 대상 entry 가 없으면 본 step 은 inert 이며, driver 가 자기 손으로 push · PR open 을 수행하는 기존 형태에서는 executor 호출이 불요(그 경우 LOOP §1[4] 의 driver 책임 그대로)임을 1 줄로 구분.
- [ ] **fail-safe 문구** — sync-claim-pr 가 non-zero 로 끝나도 **BLOCKED 로 가지 않고** 파이프라인을 계속하며 경고 1 줄만 남긴다는 것을 [LOOP.md](../LOOP.md) 219~224 행과 **같은 근거**(idempotent exit 0 재호출 가능 · 다음 turn reclaim 이 흡수)로 명시. 실패를 이유로 PR 을 닫거나 branch 를 지우는 행위 금지도 함께.
- [ ] **반환 계약 보강** — executor 가 PR 을 연 경우 driver 가 머지 전에 PR 번호를 알 수 있도록 `SUMMARY` 에 `pr=<N>` 토큰을 포함하고, 동기 결과를 `sync=ok` 또는 `sync=warn(<사유 축약>)` 로 TRAIL 의 `INTEGRATOR:` 줄(§11 포맷)에 1 토큰 박제한다는 규칙을 Workflow 7 의 반환 shape 설명에 반영. 200 char SUMMARY 상한은 불변.
- [ ] **기존 Hard rule 과의 모순 제거** — `# Hard rules` 의 "You never commit, push, or open PRs. The driver does." 문장을 **삭제하지 말고**, driver 가 명시적으로 위임한 경우에 한한 예외임을 같은 항목 안에서 잇는다(위임이 없으면 종전 그대로 stage 만). 문서 어디에도 "executor 가 PR 을 열 수도, 못 열 수도 있다" 는 해석 여지가 남지 않아야 한다.
- [ ] **§9 정합 Hard rule 1 항목 추가** — `git reset --hard` / `git push --force` 사용 금지, main 복귀는 `git switch main && git pull --ff-only` 로 한다는 항목을 `# Hard rules` 에 추가. 금지 근거로 CLAUDE.md §9 를 참조하고, T-1295 fire 에서 실제로 `git reset --hard origin/main` 이 쓰였다는 사실을 1 줄 근거로 남긴다.
- [ ] **인용 정확성 대조** — 새로 박제한 명령의 인자 순서 · exit 의미가 [scripts/sync-claim-pr.sh](../../scripts/sync-claim-pr.sh) 헤더(1~35 행)와 **문자 그대로 일치** 하는지 확인 후 반영. 불일치하면 script 를 고치지 말고 문서를 script 에 맞춘다.
- [ ] **grep 검증** — `grep -n "sync-claim-pr" .claude/agents/executor.md` 가 1+ hit, `grep -n "ff-only" .claude/agents/executor.md` 가 1+ hit, `grep -n "reset --hard" .claude/agents/executor.md` 의 모든 hit 이 **금지 문맥** 안에 있음(권장 용법으로 등장 0).
- [ ] **R-112 미적용 근거 명시** — 본 task 는 `commitMode: direct` doc-only 이며 production code · 분기 · 신규 symbol 이 0 이므로 §3.2 R-110/R-112 의 tester 호출 · unit test 의무가 적용되지 않는다(면제 대상). 대신 위 grep 검증 + 인용 정확성 대조가 검증 수단이다. 이 사실을 commit trail `notes:` 에 1 줄 박제.
- [ ] **언어 §12** — 추가 문장의 본문은 한국어, 경로 · 명령어 · flag · enum(`PR_OPEN` / `BLOCKED` / `SUMMARY` / `TRAIL`) 은 영어 유지.
- [ ] **diff 규율** — 총 diff ≤ 300 LOC / 1 파일. 문서가 길어지면 근거 서술을 줄이고 규칙 문장을 남긴다(규칙 자체를 덜어내지 말 것).

## Out of Scope

- **[docs/LOOP.md](../LOOP.md) 수정 0** — driver 측 계약(§1[4] 209~224 행)은 이미 정확하다. 같은 규칙을 두 문서에 사본으로 두면 다음 개정에서 갈라진다. executor 문서는 LOOP 절을 **참조** 만 한다.
- **[CLAUDE.md](../../CLAUDE.md) 수정 0** — §4 sub-agent 표 · §9 는 그대로. 본 task 는 그 규칙을 executor 계약으로 내리는 것일 뿐 상위 규칙을 바꾸지 않는다.
- **`scripts/sync-claim-pr.sh` 및 다른 `scripts/*.sh` 수정 0** — primitive 는 이미 동작한다(T-1297 fire 에서 exit 0 실증). wiring 문서만 고친다.
- **claims.json schema 변경 0 · `flags.fineGrainedConcurrency` / `maxConcurrentClaims` 토글 변경 0 · stage 5c 진입 판단 0.**
- **다른 agent 정의 파일(`integrator.md` / `reviewer.md` / `driver` 계열) 수정 0** — 관측된 이탈은 executor 것이다. 다른 agent 로 번지면 1 commit 1 주제(§3)가 깨진다.
- **T-1297 후속(3c-5b endpoint 배선 / 3c-5c e2e) 착수 0** — 별건 slice, Follow-ups 로 이월.
- **과거 fire 의 소급 정정 0** — 이미 머지된 claim / journal 을 다시 쓰지 않는다.

## Suggested Sub-agents

`implementer`

(doc-only direct task — §3.2 R-110 의 tester 호출 의무는 `commitMode: direct` doc-only 에 면제.)

## Follow-ups

- (T-1297 이월, 3c-5b) `POST /api/admin/import/preview` endpoint 배선 — Admin+ RBAC · FileInterceptor 크기 상한 재사용 · DB write 0 응답으로 `ImportRestoreService.previewFromDump` 에 첫 production 호출처를 만든다.
- (T-1297 이월, 3c-5c) preview ↔ 실행 왕복 e2e — 같은 dump 에서 preview 수치와 실행 후 `restoreSummary` 가 일치하는지 실 HTTP 로 박제.
- (본 task 가 낳는 가능성) executor 가 `sync=warn` 을 반환한 fire 가 누적 관측되면, driver 가 머지 직후 claim prune 전에 `sync-claim-pr` 를 한 번 더 시도하는 보정 step 을 LOOP §1[4] 에 추가할지 판단.
- (유지, T-1293~T-1297) 부분 dump + REPLACE 의 비선별 entity 삭제 — 차단/경고 여부는 제품 결정(사람 판단 대상).
- (유지, 3c-3d3) 크기 상한 413 e2e — supertest 의 multer mid-stream abort 표면화 확인 선행.
- (미해결 정책, 이월) `LlmProviderConfig` 왕복 불가(`apiKey` not-null vs ADR-0047 secret deny) — §5 secret 결정 대상.

## 결과 (2026-07-29T03:44Z DONE)

`.claude/agents/executor.md` **1 파일 +31/-4** 로 완결. Workflow 3/7 정합 수정 + "PR 흐름 흡수 시" 절 신설(reviewer 호출 전 `scripts/sync-claim-pr.sh <T-NNNN> <PR> <owner>` 자체 호출 의무 · owner 도출 규칙(driver 전달값 우선 → 없으면 claims.json 조회, 날조 금지) · inert 조건(토글 OFF / 대상 entry 부재 / driver 자체 PR open) · fail-safe(non-zero 는 BLOCKED 아님, PR close·branch 삭제 금지)) + 반환 계약 보강(SUMMARY `pr=<N>`, INTEGRATOR trail `sync=ok|warn`) + §9 정합 Hard rule 추가(`git reset --hard` 금지 → `git pull --ff-only` 복귀, T-1295 fire 근거). LOOP.md / CLAUDE.md / `scripts/*` 수정 0(참조·인용만, 인자 순서·exit 의미를 script 헤더와 대조 검증). doc-only direct commit 이라 §3.2 R-110/R-112 면제 — grep 검증(`sync-claim-pr` 3 hit · `ff-only` 1 hit · `reset --hard` 는 금지 문맥 1 hit)으로 갈음. direct commit `9d0107b5`, main CI conclusion=success.
