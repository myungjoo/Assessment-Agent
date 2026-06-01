---
id: T-0131
title: "ref-CAS lock 동작 검증 스크립트 + CI step (ADR-0009 executable spec)"
phase: P3
status: DONE
completedAt: 2026-06-01T14:05:00+09:00
mergedAs: fa8635a
reviewRounds: 1
prNumber: 129
commitMode: pr
coversReq: []
estimatedDiff: 90
estimatedFiles: 2
created: 2026-06-01
dependsOn: [T-0126, T-0127]
plannerNote: "ADR-0009 follow-up(선택) — ref-CAS lock 이 의존하는 git --force-with-lease CAS 의미를 self-contained bash 스크립트(로컬 bare repo + 2 clone)로 검증하고 CI step 에 엮어 regression 보호. T1 동시획득 1승 / T2 올바른 lease 갱신 / T3 stale lease 거부. scripts/verify-ref-cas-lock.sh + .github/workflows/ci.yml — pr-mode."
---

# T-0131 — ref-CAS lock 동작 검증 스크립트 + CI step

## Why

[ADR-0009](../decisions/ADR-0009-strong-ref-cas-lock.md) 의 lock 상호배제는 `git push <sha>:refs/locks/driver --force-with-lease=refs/locks/driver:<old>` 의 compare-and-swap 의미에 전적으로 의존한다. 이 가정을 **executable spec** 으로 박제해, git 동작 변화나 환경 차이로 CAS 전제가 깨지면 CI 가 잡도록 한다. self-contained(로컬 bare repo + 2 clone, remote/네트워크 불요)이므로 CI ubuntu 에서 그대로 통과한다.

## Required Reading

- `docs/tasks/T-0131-ref-cas-lock-verify-ci.md` (본 파일)
- `docs/decisions/ADR-0009-strong-ref-cas-lock.md` — 검증 대상 CAS 의미
- `.github/workflows/ci.yml` (lines ~61-75) — step 삽입 위치(spec-presence 자체 test 직후)
- `scripts/check-spec-presence.sh` — 기존 bash 스크립트 convention 참조

## Acceptance Criteria

- [ ] **`scripts/verify-ref-cas-lock.sh` 신설** — `set -u`, `mktemp -d` + trap cleanup, bare origin + 2 clone. 검증 3종:
  - [ ] T1: 빈 ref 에 두 driver 동시 획득(lease=expect-absent) → **정확히 1개만 성공**.
  - [ ] T2: 현재 holder 가 올바른 lease(현재 sha)로 ref 갱신(해제/교체) → 성공.
  - [ ] T3: stale lease(틀린 old-sha)로 갱신 → **거부**.
  - [ ] 모두 통과 시 exit 0, 하나라도 실패 시 exit 1. push exit code 는 pipe 없이 직접 캡처.
- [ ] **`.github/workflows/ci.yml` 에 step 추가** — "ref-CAS lock 검증" step(`bash scripts/verify-ref-cas-lock.sh`)을 spec-presence 자체 test 직후에 삽입. fail 시 CI red.
- [ ] 편집/신설은 `scripts/verify-ref-cas-lock.sh` + `.github/workflows/ci.yml` 2 파일. src/ 변경 0.
- [ ] 로컬(`bash scripts/verify-ref-cas-lock.sh`) + CI 둘 다 green.
- [ ] CI 전 step green + reviewer 4-게이트 PASS.

## Out of Scope

- **실제 driver lock 취득 코드(TypeScript) 구현** — lock 절차는 LOOP.md prompt(prose)로 driver 가 수행. 본 task 는 primitive 검증만.
- **remote(GitHub) 대상 실제 push race 테스트** — 권한/네트워크 의존 회피. 로컬 bare 로 충분.
- **production code / src 변경** — 0.

## Suggested Sub-agents

`implementer`(스크립트 + ci.yml) → `tester`(스크립트 로컬 실행 + lint/build/test/smoke/e2e green 확인). architect 미호출(ADR-0009 기존 결정).

## Follow-ups

(없음 — ADR-0009 operationalization 체인 종결.)
