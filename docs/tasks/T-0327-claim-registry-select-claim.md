---
id: T-0327
title: ADR-0036 fine-grained concurrency stage 2 (slice 1) — claim registry schema + lock-하 atomic select+claim CAS primitive + executable spec
phase: P5
status: PENDING
commitMode: pr
coversReq: [TBD]
estimatedDiff: 250
estimatedFiles: 4
created: 2026-06-10
independentStream: stage2-claim-registry
dependsOn: []
touchesFiles: [scripts/select-claim.sh, scripts/select-claim.test.sh, .github/workflows/ci.yml, docs/architecture/concurrency.md]
plannerNote: "ADR-0036 §rollout stage2(pr) slice1 — claims.json schema + lock-하 atomic claim CAS primitive + executable spec. buildThrough 승인(escalate 금지). 정확성 게이트: 이중 claim 0."
---

# T-0327 — claim registry schema + lock-하 atomic select+claim CAS primitive (stage 2 slice 1)

## Why

ADR-0036 fine-grained concurrency 가 ACCEPTED(buildThrough 승인 — `STATE.adr0036Rollout`)이고 stage 1(T-0326, flags 자리 + planner 독립-stream 분해 정책)이 DONE 이다. ADR-0036 §rollout 2 는 "(pr) claim registry schema + select+claim critical-section 구현 — claims.json + lock 하 atomic claim + staleness 회수 + PR-resume" 를 지시하며 break-even 정확성 게이트는 "이중 claim 0 · orphan 회수 정상 동작 검증" 이다. stage 2 전체(schema + atomic claim + staleness 회수 + PR-resume + 검증)는 cap(≤300 LOC/≤5 파일) 초과 위험이라 **slice 1 = claims.json schema 박제 + lock-하 atomic select+claim CAS primitive + 이중 claim 0 을 박제하는 executable spec** 만 본 task 가 책임진다. staleness 회수(60분 임계)·PR-resume·driver loop 통합은 slice 2+(Follow-ups)로 분리한다.

본 slice 는 ADR-0009 ref-CAS lock 의 executable-spec 선례([scripts/verify-ref-cas-lock.sh](../../scripts/verify-ref-cas-lock.sh) + `.test.sh` 동형, [scripts/check-doc-only-pr.sh](../../scripts/check-doc-only-pr.sh) + `.test.sh` 동형)를 mirror 한다 — bare-repo + 2 clone self-contained 로 remote/네트워크/credential 불요(CI ubuntu 통과). NestJS `src/` 코드가 아니라 operational tooling 이다(lock 자체가 git ref-CAS script 이지 src 모듈이 아님). 토글(`flags.fineGrainedConcurrency`)은 stage 5 까지 OFF — 본 slice 는 driver 동작을 바꾸지 않는 forward-looking primitive + spec 만 박제한다.

## Required Reading

- docs/decisions/ADR-0036-fine-grained-concurrency.md — 특히 §Decision 1(claim registry schema · 원자성 · 저장 위치 = `refs/heads/claude/lock-driver` tip tree 의 `claims.json`), §Decision 0(동시 claimable 조건), §rollout 2(break-even = 이중 claim 0)
- scripts/verify-ref-cas-lock.sh — ref-CAS lock executable-spec 선례(bare-repo + 2 clone self-contained 패턴, `--force-with-lease` CAS push). 본 task 의 select+claim primitive 는 이 패턴을 mirror.
- scripts/check-doc-only-pr.sh + scripts/check-doc-only-pr.test.sh — script + `.test.sh` 동반 spec 패턴(R-112 자동 layer 대응). 본 task 의 `.test.sh` 가 이 패턴을 mirror.
- .github/workflows/ci.yml — 특히 67~84행("spec-presence 자체 test" / "doc-only 판정 script 자체 test" / "ref-CAS lock 검증" step). 본 task 의 새 `.test.sh` 를 동형 CI step 으로 추가.
- docs/architecture/ 디렉토리 목록(있으면 concurrency 관련 doc 존재 여부 확인 — 없으면 `docs/architecture/concurrency.md` 신설)

## Acceptance Criteria

- [ ] `claims.json` schema 를 박제한다 — `refs/heads/claude/lock-driver` tip commit tree 의 추가 파일 `claims.json`(배열), 각 원소 `{ taskId, owner, claimedAt, status: "CLAIMED|IN_PROGRESS|PR_OPEN|DONE", prNumber }`(ADR-0036 §Decision 1 schema 그대로). schema 는 (a) `scripts/select-claim.sh` 헤더 주석 + (b) `docs/architecture/concurrency.md` 의 claim registry § 두 곳에 박제한다.
- [ ] `scripts/select-claim.sh` 를 추가한다 — lock-하 atomic select+claim CAS primitive. 입력으로 후보 task id 목록 + owner session id 를 받아, `claims.json` 을 읽어 (a) 이미 claim 된 task(또는 `dependsOn` 미머지 — 본 slice 는 claimed-set 제외만, 의존성 평가는 호출측 책임으로 주석 명시) 를 제외한 첫 claimable task 1 개를 선택, (b) 자기 claim 을 박제한 commit 을 `refs/heads/claude/lock-driver` 에 `--force-with-lease` CAS push(같은 commit 에 lock tombstone 동반 = 즉시 release) 하는 절차를 구현한다. ADR-0036 §Decision 1 "원자성"(claim 박제가 release 이전 → 이중 claim 불가) 을 코드로 실현. claimable task 부재 시 non-zero exit + "no claimable task" 메시지.
- [ ] **Happy-path spec**: `scripts/select-claim.test.sh` 가 bare-repo + 2 clone self-contained 로(verify-ref-cas-lock.sh mirror) 다음을 검증한다 — 단일 driver 가 claimable task 1 개를 정상 claim(claims.json 에 entry 1 개 박제, CAS push 성공, exit 0).
- [ ] **이중 claim 0 (정확성 게이트 — ADR-0036 §rollout 2 break-even)**: `.test.sh` 가 두 driver(2 clone)가 **같은 task 를 동시에 select+claim** 시도할 때 정확히 1 개만 성공(CAS 직렬화로 한쪽 claim 박제 · 다른쪽 lease-stale 거부 후 재시도 시 그 task 가 claimed-set 에 들어가 제외됨)함을 검증한다. 이중 claim(같은 taskId 2 entry 또는 두 driver 모두 성공)이 발생하면 spec fail.
- [ ] **Error / negative path**: `.test.sh` 가 (1) claimable task 부재(후보 전부 이미 claimed) 시 select-claim.sh 가 non-zero exit + 빈 claim(새 entry 0) 임을, (2) stale lease(틀린 old-sha)로 claim push 시 CAS 거부됨을 각각 검증한다(verify-ref-cas-lock.sh T1/T3 mirror — 예외 분기 각 1+).
- [ ] **Branch cover**: select-claim.sh 의 분기(claimable 존재 → claim push / claimable 부재 → non-zero exit / CAS race lose → 재시도 or 종료)마다 `.test.sh` 의 검증 case 1+ 대응. 분기-검증 매핑을 `.test.sh` 주석에 명시.
- [ ] `.github/workflows/ci.yml` 의 "기본 검사" job 에 `bash scripts/select-claim.test.sh` step 1 개를 추가한다(기존 "ref-CAS lock 검증" step 84행 바로 뒤, 동형 위치). self-contained 라 DB/pnpm/네트워크 불요 — 기존 self-test step 들과 같은 위치.
- [ ] `bash scripts/select-claim.test.sh` 가 로컬에서 exit 0(전 검증 통과). tester 가 `pnpm lint && pnpm build && pnpm test` sanity(src 변경 0 이라 회귀 0 확인) + `bash scripts/select-claim.test.sh` 통과를 확인한다(R-110).
- [ ] (R-112 coverage threshold 메모) 본 task 는 `src/` 코드 0 — jest `coverageThreshold`(line ≥ 80% / function ≥ 80%)는 기존 src 에 대해 그대로 통과(회귀 0)해야 한다. shell script primitive 의 검증은 jest 가 아니라 `.test.sh` executable spec 이 담당(verify-ref-cas-lock.sh 선례 — shell 은 jest coverage 대상 외). PR 본문에 "shell primitive 검증 = `.test.sh` executable spec(jest coverage 대상 외, ref-CAS 선례 동형)" 명시.
- [ ] PR 본문에 "stage 2 slice 1 only — staleness 회수(60분)·PR-resume·driver loop 통합은 slice 2+ Follow-ups, 토글 OFF 유지" 명시.

## Out of Scope

- **staleness 회수(orphan claim 60분 임계 회수, server-time 기준 §Decision 5)** — slice 2(pr). 본 slice 는 claim 박제 + 이중 claim 0 만.
- **PR-resume(claim 의 prNumber 있으면 새 PR 안 만들고 resume — §Decision 1 staleness 회수 단락)** — slice 2(pr, staleness 회수와 동반).
- **driver loop 통합(§1 loop 재작성 — critical-section lock + claim pickup 분기)** — stage 3(direct, CLAUDE §10 / LOOP §4 동기).
- **`.github` per-PR concurrency group(§Decision 6)** — stage 4(pr).
- **`flags.fineGrainedConcurrency = true` 토글 ON** — stage 5(direct, 1~4 머지 + 30일 dogfood 후). 본 slice 는 토글 OFF 유지 — driver 동작 변경 0.
- **dependsOn 미머지 task 의 런타임 의존성 평가** — 본 slice 는 claimed-set 제외만 구현(의존성 평가는 호출측/slice 2+ 책임). select-claim.sh 주석에 경계 명시.
- `src/`, `web/`, NestJS 모듈, prisma schema, package.json 변경 일체 금지(본 task 는 scripts/ + ci.yml + architecture doc 만).
- ADR-0036 status 갱신(이미 ACCEPTED) / STATE.json `adr0036Rollout` stage2 진행 메모는 driver 의 별도 direct closeout commit 책임(본 task 아님).

## Suggested Sub-agents

implementer → tester. (architect 불요 — ADR-0036 §Decision 1 이 schema·원자성·저장 위치를 이미 박제했으므로 새 결정 0. implementer 가 verify-ref-cas-lock.sh / check-doc-only-pr.sh 선례를 mirror 해 script + `.test.sh` 작성, tester 가 `.test.sh` + lint/build/test sanity 확인.)

## Follow-ups

- stage 2 slice 2 (pr): staleness 회수(orphan claim 60분 server-time 임계) + PR-resume(claim.prNumber 있으면 resume) — 본 slice 의 select-claim primitive 위에 구축, break-even = orphan 회수 정상 동작 검증(ADR-0036 §rollout 2).
- stage 3 (direct): §1 driver loop 재작성(critical-section lock + claim pickup 분기) + CLAUDE §10 / LOOP §4 동기 + ADR-0034 규율 흡수/정합.
- stage 4 (pr): `.github` per-PR concurrency group(§Decision 6).
- stage 5 (direct): `flags.fineGrainedConcurrency = true` 토글(1~4 머지 + 30일 dogfood 후).
