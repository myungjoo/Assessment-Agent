---
id: T-0328
title: ADR-0036 fine-grained concurrency stage 2 (slice 2) — orphan claim staleness 회수(60분 server-time 임계) + PR-resume primitive + executable spec
phase: P5
status: PENDING
commitMode: pr
coversReq: [TBD]
estimatedDiff: 250
estimatedFiles: 4
created: 2026-06-10
independentStream: stage2-claim-registry
dependsOn: [T-0327]
touchesFiles: [scripts/reclaim-stale-claim.sh, scripts/reclaim-stale-claim.test.sh, .github/workflows/ci.yml, docs/architecture/concurrency.md]
plannerNote: "ADR-0036 §rollout stage2(pr) slice2 — orphan claim 60분 server-time 회수 + PR-resume primitive + executable spec. buildThrough 승인(escalate 금지). break-even: orphan 회수 정상 동작 검증."
---

# T-0328 — orphan claim staleness 회수(60분 임계) + PR-resume primitive (stage 2 slice 2)

## Why

ADR-0036 fine-grained concurrency 가 ACCEPTED(buildThrough 승인 — `STATE.adr0036Rollout`)이고 stage 2 slice 1(T-0327, PR #273 squash 0e5a817)이 DONE 이다 — `scripts/select-claim.sh`(lock-하 atomic select+claim CAS primitive) + `claims.json` schema(`{ taskId, owner, claimedAt, status, prNumber }`) + 이중-claim-0 executable spec 가 main 에 박제됐다.

ADR-0036 §rollout 2 는 stage 2 가 "claims.json + lock 하 atomic claim + **staleness 회수 + PR-resume**" 를 모두 책임지며 break-even 정확성 게이트가 "이중 claim 0 · **orphan 회수 정상 동작 검증**" 임을 지시한다. slice 1 이 "이중 claim 0" 절반을 닫았으므로 본 slice 2 = **orphan claim 60분 server-time 임계 회수 + PR-resume 우선 적용 primitive + 그 정확성을 박제하는 executable spec** 이 나머지 절반(orphan 회수 정상 동작)을 닫는다. driver loop 통합(§1 loop 재작성)은 stage 3, per-PR concurrency group 은 stage 4 의 책임이라 본 slice 범위 밖이다.

본 slice 도 slice 1 / ADR-0009 ref-CAS lock 의 executable-spec 선례([scripts/select-claim.sh](../../scripts/select-claim.sh) + `.test.sh`, [scripts/verify-ref-cas-lock.sh](../../scripts/verify-ref-cas-lock.sh))를 mirror 한다 — bare-repo + 2 clone self-contained 로 remote/네트워크/credential 불요(CI ubuntu 통과). NestJS `src/` 코드가 아니라 operational tooling 이다. 토글(`flags.fineGrainedConcurrency`)은 stage 5 까지 OFF — 본 slice 는 driver 동작을 바꾸지 않는 forward-looking primitive + spec 만 박제한다. **`dependsOn: [T-0327]` — slice 1 의 claims.json schema · select-claim CAS 패턴 위에 구축**(이미 머지됨, claim 후보로 풀림).

## Required Reading

- docs/decisions/ADR-0036-fine-grained-concurrency.md — 특히 §Decision 1(claim registry · "staleness 회수" 단락: 60분 임계 · PR-resume 우선), §Decision 5(multi-machine clock skew → server-time 기준 `claimedAt` · 회수 임계 보수화 · server-time 확보 불가 시 회수 보류), §rollout 2(break-even = orphan 회수 정상 동작 검증)
- scripts/select-claim.sh — slice 1 primitive. claims.json read(`claimed_task_ids`)·CAS push(`--force-with-lease`)·tombstone 동반 release·CI ubuntu identity self-provide(`git -c user.name=... commit-tree`) 패턴을 본 slice 의 회수 commit 작성이 mirror.
- scripts/verify-ref-cas-lock.sh — ref-CAS lock executable-spec 선례(bare-repo + 2 clone self-contained, `--force-with-lease` CAS, T1/T3 stale-lease 거부 케이스). 본 task 의 `.test.sh` 가 이 패턴을 mirror.
- docs/architecture/concurrency.md — 특히 §5(staleness 회수 / PR-resume — slice 2+ forward-looking 범위로 이미 서술). 본 task 가 이 §5 를 "shipped(reclaim-stale-claim.sh)" reality 로 amend.
- .github/workflows/ci.yml — 특히 86~91행("select-claim CAS 검증" step). 본 task 의 새 `.test.sh` 를 그 바로 뒤 동형 위치에 CI step 으로 추가.

## Acceptance Criteria

- [ ] `scripts/reclaim-stale-claim.sh` 를 추가한다 — lock-하 orphan claim 회수 primitive. 절차: lock CAS 획득 가능 상태에서 `claims.json` 을 읽어 (a) 각 claim 의 `claimedAt` 과 **server-time 기준 now**(인자/env 로 주입, 미주입 시 회수 보류 — §Decision 5 "server-time 확보 불가 시 회수 보류") 의 차가 **60분(임계) 초과**인 orphan claim 을 식별, (b) 식별된 orphan claim 을 `claims.json` 배열에서 제거(회수)한 commit 을 `refs/heads/claude/lock-driver` 에 `--force-with-lease` CAS push(같은 commit 에 lock tombstone 동반 = 즉시 release, select-claim.sh mirror) 한다. 회수 대상 부재 시 변경 없이 정상 종료(exit 0, "no stale claim" 메시지).
- [ ] **PR-resume 우선 (회수 전 적용 — ADR-0036 §Decision 1 staleness 단락)**: orphan claim 에 `prNumber` 가 non-null 이면 reclaim-stale-claim.sh 는 그 claim 을 단순 제거(회수)하지 않고, **회수 driver 에게 "이 PR 을 resume 하라"는 신호를 출력**한다(예: stdout 에 `RESUME prNumber=<n> taskId=<T-NNNN>` 1 줄 박제 + claim 의 owner 를 회수 driver 로 교체하되 prNumber 보존). 중복 PR 방지(ADR-0034 사고 메커니즘 직접 차단)가 목적 — `prNumber` 가 null 인 orphan 만 단순 제거. 두 분기(prNumber null → 제거 / prNumber non-null → resume 신호 + owner 교체)를 script 주석에 명시.
- [ ] **계약·경계 주석**: script 헤더 주석에 (1) server-time now 주입 계약(env `RECLAIM_NOW` 또는 인자, 미주입 시 회수 보류 — clock-skew 오회수 차단), (2) 60분 임계가 lock stale 임계와 동형임(§Decision 5 보수화), (3) driver loop 통합은 stage 3 책임이고 본 primitive 는 forward-looking(토글 OFF) 임을 명시. select-claim.sh 헤더 주석 형식 mirror.
- [ ] **Happy-path spec**: `scripts/reclaim-stale-claim.test.sh` 가 bare-repo + 2 clone self-contained 로(verify-ref-cas-lock.sh / select-claim.test.sh mirror) 검증한다 — `claimedAt` 이 now-60분 초과(임계 넘김)이고 `prNumber=null` 인 orphan claim 1 개가 정상 회수됨(claims.json 에서 제거, CAS push 성공, exit 0).
- [ ] **PR-resume 분기 (정확성 — 중복 PR 차단)**: `.test.sh` 가 `prNumber` non-null 인 orphan claim 에 대해 reclaim-stale-claim.sh 가 (a) 그 claim 을 제거하지 않고(claims.json 에 taskId entry 유지) (b) RESUME 신호를 stdout 에 출력함을 검증한다(단순 회수 시 fail).
- [ ] **Negative / boundary**: `.test.sh` 가 (1) `claimedAt` 이 임계 **미만**(살아있는 claim — now-60분 이내)인 claim 은 회수되지 않음(claims.json 불변, exit 0), (2) server-time now 미주입 시 회수가 **보류**됨(§Decision 5 — 변경 0, 오회수 0), (3) stale lease(틀린 old-sha)로 회수 push 시 CAS 거부됨(verify-ref-cas-lock.sh T3 mirror)을 각각 검증한다 — 예외/경계 분기 각 1+.
- [ ] **Branch cover**: reclaim-stale-claim.sh 의 분기(orphan 존재 → 회수/resume / orphan 부재 → no-op exit 0 / server-time 미주입 → 회수 보류 / prNumber null vs non-null / CAS race lose → 재시도 or 종료)마다 `.test.sh` 의 검증 case 1+ 대응. 분기-검증 매핑을 `.test.sh` 주석에 명시.
- [ ] `.github/workflows/ci.yml` 의 "기본 검사" job 에 `bash scripts/reclaim-stale-claim.test.sh` step 1 개를 추가한다(기존 "select-claim CAS 검증" step 91행 바로 뒤, 동형 위치). self-contained 라 DB/pnpm/네트워크 불요.
- [ ] `docs/architecture/concurrency.md` §5(staleness 회수 / PR-resume)를 amend — 현재 "slice 2+ forward-looking 범위" 서술을 "shipped: `scripts/reclaim-stale-claim.sh`(60분 server-time 회수 + PR-resume 신호)" reality 로 갱신하되, driver loop 통합(stage 3)·per-PR CI group(stage 4)은 여전히 미shipped 로 구분 표기.
- [ ] `bash scripts/reclaim-stale-claim.test.sh` 가 로컬에서 exit 0(전 검증 통과). tester 가 `pnpm lint && pnpm build && pnpm test` sanity(src 변경 0 이라 회귀 0 확인) + `bash scripts/reclaim-stale-claim.test.sh` 통과를 확인한다(R-110).
- [ ] (R-112 coverage threshold 메모) 본 task 는 `src/` 코드 0 — jest `coverageThreshold`(line ≥ 80% / function ≥ 80%)는 기존 src 에 대해 그대로 통과(회귀 0)해야 한다. shell script primitive 의 검증은 jest 가 아니라 `.test.sh` executable spec 이 담당(select-claim.sh / verify-ref-cas-lock.sh 선례 — shell 은 jest coverage 대상 외). PR 본문에 "shell primitive 검증 = `.test.sh` executable spec(jest coverage 대상 외, slice 1 동형)" 명시.
- [ ] PR 본문에 "stage 2 slice 2 only — driver loop 통합(stage 3)·per-PR concurrency group(stage 4)·토글 ON(stage 5)은 후속 Follow-ups, 토글 OFF 유지" 명시.

## Out of Scope

- **driver loop 통합(§1 loop 재작성 — critical-section lock + claim pickup + 회수 호출 분기)** — stage 3(direct, CLAUDE §10 / LOOP §4 동기). 본 slice 는 회수 primitive + spec 만 — loop 가 언제 reclaim-stale-claim.sh 를 호출하는지는 stage 3 책임.
- **`.github` per-PR concurrency group(§Decision 6)** — stage 4(pr).
- **`flags.fineGrainedConcurrency = true` 토글 ON** — stage 5(direct, 1~4 머지 + 30일 dogfood 후). 본 slice 는 토글 OFF 유지 — driver 동작 변경 0.
- **server-time(GitHub API `Date` 헤더 / `gh run` UTC) 실제 fetch 로직** — 본 slice 는 server-time now 를 **주입받는** 계약만(env/인자). 실제 server-time 조회·주입은 호출측(stage 3 loop) 책임 — script 주석에 경계 명시(§Decision 5 "server-time 확보 불가 시 회수 보류" 를 미주입=보류 분기로 실현).
- **실제 PR resume 실행(gh pr checkout 등)** — 본 slice 는 PR-resume **신호**(RESUME 출력 + claim owner 교체·prNumber 보존)만. 실제 PR checkout/이어작업은 stage 3 driver loop 책임.
- **dependsOn 미머지 task 의 런타임 의존성 평가** — slice 1 과 동일, 호출측/stage 3 책임.
- `src/`, `web/`, NestJS 모듈, prisma schema, package.json 변경 일체 금지(본 task 는 scripts/ + ci.yml + architecture doc 만).
- ADR-0036 status 갱신(이미 ACCEPTED) / STATE.json `adr0036Rollout` stage2 slice2 진행 메모는 driver 의 별도 direct closeout commit 책임(본 task 아님).

## Suggested Sub-agents

implementer → tester. (architect 불요 — ADR-0036 §Decision 1·5 가 60분 임계·server-time·PR-resume 우선·저장 위치를 이미 박제했으므로 새 결정 0. implementer 가 select-claim.sh / verify-ref-cas-lock.sh 선례를 mirror 해 reclaim 회수 script + `.test.sh` 작성, tester 가 `.test.sh` + lint/build/test sanity 확인.)

## Follow-ups

- stage 3 (direct): §1 driver loop 재작성(critical-section lock + claim pickup 분기 + reclaim-stale-claim.sh 회수 호출 + server-time now 주입) + CLAUDE §10 / LOOP §4 동기 + ADR-0034 규율 정합. break-even = 두 driver 동시 무장 시 서로 다른 독립 task 진행 실증 + 충돌 없음.
- stage 4 (pr): `.github` per-PR concurrency group(§Decision 6) — `concurrency: group: ci-${{ github.event.pull_request.number || github.ref }}`.
- stage 5 (direct): `flags.fineGrainedConcurrency = true` 토글(1~4 머지 + 30일 dogfood 후).
