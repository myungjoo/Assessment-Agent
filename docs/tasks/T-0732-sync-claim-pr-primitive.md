---
id: T-0732
title: claim record PR-open sync primitive (sync-claim-pr.sh) 신설 — dup-PR 근본 차단
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-057, REQ-058]
estimatedDiff: 230
estimatedFiles: 2
created: 2026-06-28
independentStream: concurrency-claim-pr-sync
dependsOn: []
touchesFiles: [scripts/sync-claim-pr.sh, scripts/sync-claim-pr.test.sh]
plannerNote: "P5 동시성 정확성 — T-0730 dup-PR forensic(double-claim 0→1) 근본 fix: PR open 직후 claim prNumber/status 동기 primitive 신설(reclaim prNumber=null bare-prune 회귀 차단)"
---

# T-0732 — claim record PR-open sync primitive (sync-claim-pr.sh) 신설

## Why

T-0730 dup-PR 사후 forensic (journal 2026-06-28 21:24, `concurrencyIncidents.double-claim` 0→1, 회로 차단기 임계 2 미달)이 박제한 근본 원인을 구조적으로 차단한다. driver 가 PR 을 open 한 직후 자기 claim entry 의 `prNumber` 를 갱신하지 않은 채 사망하면, `scripts/reclaim-stale-claim.sh` 가 그 orphan 을 `prNumber == null → 단순 제거`(L179~182) 분기로 bare-prune 해 PR-resume 신호를 잃고, 다음 driver 가 **중복 PR** 을 연다 (PR #645 vs #646 패턴). 현재 claim lifecycle 에는 `select-claim.sh` 가 `prNumber:null, status:CLAIMED` 로 생성한 뒤 PR open 시점에 `prNumber`/`status` 를 갱신하는 primitive 가 **부재**다 (origin/main grep 0 확인). 본 task 는 그 빠진 단계를 채우는 `sync-claim-pr.sh` primitive 를 신설해, reclaim 의 기존 `prNumber != null → RESUME` 분기가 정상 작동하도록 한다. ADR-0036 §Decision 8 (a) fail-safe / 안전장치 backbone 의 직접 보강이며 PLAN §109 (P5 실 평가 e2e) 운영 fire 의 동시성 정확성을 지킨다.

## Required Reading

- `scripts/select-claim.sh` — claim entry 생성 구조 (claims.json read → entry mutate → `lock_tree_cas_push`). 본 primitive 가 mirror 할 패턴.
- `scripts/reclaim-stale-claim.sh` (특히 L178~191 prNumber 분기) — 본 fix 가 정상화하려는 소비측 분기.
- `scripts/lib-lock-tree.sh` (L61~ `lock_tree_cas_push` 계약 — 인자/return code 20/30, preserve_except_regex) — 본 primitive 가 위임할 공통 CAS 헬퍼.
- `scripts/select-claim.test.sh` (test harness 구조 — bare-repo + 2 clone self-contained, NOW 주입, identity self-provide) — 본 test 가 mirror 할 패턴.
- `scripts/reclaim-stale-claim.test.sh` (L13~28 분기-검증 매핑 주석 스타일) — 본 test 의 매핑 주석 스타일 참고.

## Acceptance Criteria

`sync-claim-pr.sh` 는 lock(critical section) 하에서 호출되는 것을 전제로 하며, 자기 owner session 의 claim entry 1개의 `prNumber`(null → 정수) + `status`(`CLAIMED`/`IN_PROGRESS` → `PR_OPEN`) 를 `lock_tree_cas_push` 로 원자 갱신한다. 네트워크/credential 불요 (claims.json read + CAS push 만).

- [ ] **계약**: `scripts/sync-claim-pr.sh <task-id> <pr-number> <owner-session>` (또는 env 등가). claims.json 에서 `taskId == <task-id> && owner == <owner-session>` entry 를 찾아 `prNumber`/`status=PR_OPEN` 만 갱신, 그 외 모든 entry 및 sibling tree 엔트리는 byte-보존 (preserve_except_regex `\s(claims\.json|lock\.json)$` mirror). lock.json tombstone 동반 여부는 select-claim 과 동형으로 결정 (release 가 아니므로 lock.json 미교체 — `claims.json` 만 교체).
- [ ] **Happy-path unit test**: stale 아닌 자기 claim(prNumber=null, status=CLAIMED) 1개를 `prNumber=N, status=PR_OPEN` 으로 갱신 성공 + CAS push 후 ref tip 의 claims.json 이 정확히 반영됨을 검증 (test 1+).
- [ ] **Error path unit test**: (1) 인자 누락(task-id/pr-number/owner 중 하나 빈 값) → non-zero exit + stderr 사유, (2) 대상 taskId 부재 → no-op 또는 명확한 non-zero, (3) owner 불일치(다른 driver claim) → 갱신 거부(타 driver claim 무변경) test 각 1+.
- [ ] **Flow / branch coverage**: prNumber 이미 non-null(재호출 idempotent — 같은 값이면 no-op success), status 가 이미 PR_OPEN 인 경우 분기 등 각 분기 1+ test.
- [ ] **Negative cases 충분 cover**: (a) CAS race lose(틀린 old-sha lease) → `lock_tree_cas_push` 20 재시도 후 정상 처리, (b) 동시 sync 시도 → CAS 로 1개만 성공(sibling claim wipe 0, #588 류 회귀 가드), (c) 빈 claims.json/ref 부재 → 명확한 no-op 또는 non-zero, (d) sibling 파일(meta.txt 등)·타 claim entry byte-보존 검증 각 1+ test. 단일 negative 금지 — 각 예외 분기마다 cover.
- [ ] **Coverage 최소치**: bash executable spec 이므로 jest `coverageThreshold` 대신 `scripts/sync-claim-pr.test.sh` 의 분기-검증 매핑 주석(B1..Bn ↔ T1..Tn)으로 모든 분기 cover 를 명시 (select-claim.test.sh / reclaim-stale-claim.test.sh L13~28 스타일). `bash scripts/sync-claim-pr.test.sh` 가 전부 `ok:` 로 통과.
- [ ] `pnpm lint && pnpm build` green (script 추가가 build 영향 0 확인). tester 가 `bash scripts/sync-claim-pr.test.sh` 실행 결과 첨부.
- [ ] CI 가 본 test 를 실행하도록 이미 등록돼 있으면 통과 확인, 미등록이면 follow-up 으로 적되 본 task 에서 CI workflow 는 건드리지 않음 (touchesFiles 제한).

## Out of Scope

- **LOOP.md / `.claude/agents/integrator.md` 의 호출 wiring** — driver/integrator 가 PR open 직후 본 primitive 를 **언제** 호출하는지의 텍스트 계약은 별도 direct doc task (follow-up). 본 task 는 primitive + test 만.
- `scripts/reclaim-stale-claim.sh` 자체 수정 금지 — 기존 `prNumber != null → RESUME` 분기는 이미 옳다. 본 primitive 가 그 분기를 정상 작동하게 만드는 것이 목적.
- `select-claim.sh` 수정 금지 (claim 생성 시 prNumber:null 은 그대로 유지).
- ADR 신설 금지 — claim schema(필드 집합) 변경 0 (기존 `prNumber`/`status` 필드 갱신만). protocol 단계 추가의 ADR 박제가 필요하다고 판단되면 Follow-ups 에 적고 본 task 는 primitive 구현에 집중.
- `.github/workflows/ci.yml` 변경 금지 (touchesFiles 2파일 한정 — CI 등록은 follow-up).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
