---
id: T-0332
title: ci.yml 에 per-PR concurrency group 추가 (ADR-0036 stage 4)
phase: P5
status: DONE
completedAt: 2026-06-10T19:41:50+09:00
commitMode: pr
prNumber: 275
mergeCommit: aedd7be
coversReq: [REQ-058]
estimatedDiff: 12
estimatedFiles: 1
created: 2026-06-10
independentStream: adr0036-rollout
dependsOn: []
touchesFiles: [.github/workflows/ci.yml]
plannerNote: "P5 ADR-0036 §rollout stage4 — ci.yml per-PR concurrency group(§Decision6). pr-mode, dependency-free, buildThrough."
---

# T-0332 — ci.yml 에 per-PR concurrency group 추가 (ADR-0036 stage 4)

## Why

[ADR-0036](../decisions/ADR-0036-fine-grained-concurrency.md) §rollout stage 4 + §Decision 6 — fine-grained concurrency 활성 시 N 동시 PR = N CI run 이 된다. 같은 PR 의 연속 push 가 직전 run 을 cancel 하게 하되, **서로 다른 PR / main push 는 서로 cancel 하지 않고 독립 실행**되도록 workflow 에 `concurrency:` key 를 추가한다. stage 1~3 (T-0326~T-0331) 머지 완료, stage 4 만 PENDING. 토글(stage 5) ON 전에도 CI 비용 절감(같은 PR 의 중복 run 취소) 효과는 즉시 유효하며, fine-grained 활성 시 비용이 N 선형 안에 머물게 하는 전제다.

## Required Reading

- `D:\Assessment-Agent\.github\workflows\ci.yml` — 현 workflow 전체 (특히 `on:` 트리거 블록 L7-17: pull_request / push / issue_comment / pull_request_review, 그리고 job `ci`). 아직 `concurrency:` key 없음.
- `D:\Assessment-Agent\docs\decisions\ADR-0036-fine-grained-concurrency.md` §Decision 6 (CI 비용/동시성) + §rollout stage 4 (break-even: 동시 PR CI 가 서로 cancel 안 하고 비용이 N 선형 안에 머묾).

## Acceptance Criteria

- [ ] `.github/workflows/ci.yml` 에 **workflow-level** `concurrency:` key 를 추가한다. group 식별자는 ADR-0036 §Decision 6 의 형태를 따른다 — 이벤트 종류와 PR 번호(또는 ref)를 결합해, **같은 PR 의 중복 run 만 서로 묶이고 서로 다른 PR / main push 는 별개 그룹**이 되도록 한다. 권장 형태:
  - `group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}`
  - `cancel-in-progress: true`
- [ ] **main push run 보호 검증**: group 식별자에 `github.ref` 가 포함되므로 main push 는 모두 `refs/heads/main` 그룹으로 묶인다. `cancel-in-progress: true` 가 직전 main-push CI 를 cancel 할 수 있는 영향(R-114 / §11 의 main-push CI green 게이트와의 상호작용)을 PR body 에서 명시적으로 설명한다 — 연속 main push 시 더 새 commit 의 run 만 살아남는 것이 의도된 동작인지, 아니면 main push 는 `cancel-in-progress: false` 가 적절한지 판단을 박제한다. **둘을 분리해야 한다면** `concurrency.cancel-in-progress` 를 `${{ github.event_name == 'pull_request' }}` 같은 표현식으로 두어 **PR run 만 cancel, main push 는 비-cancel** 로 설정하는 안을 우선 채택한다 (main-push CI 무결성 우선).
- [ ] issue_comment / pull_request_review 이벤트로 트리거되는 run 이 같은 PR 의 pull_request run 과 어떻게 묶이는지(또는 분리되는지) 확인하고, 기존 approval-gate rerun 흐름(STATE.ci.benignRedNote 의 issue_comment-event run 패턴)을 깨지 않음을 PR body 에서 설명한다.
- [ ] **R-110 / R-113 (production code 0 LOC 변경)**: 본 task 는 CI config 변경으로 production code 를 건드리지 않는다. tester 는 `pnpm lint && pnpm build && pnpm test` (또는 `pnpm test:cov`) 를 실행해 기존 동작이 깨지지 않음을 확인한다. concurrency key 는 빌드/테스트 로직을 바꾸지 않으므로 기존 unit/smoke/e2e 결과가 불변임을 TESTER trail 에 박제한다.
- [ ] YAML 문법 유효성: workflow 가 GitHub Actions 에서 정상 파싱되어 PR push 시 CI 가 트리거된다 (PR 의 GitHub Actions 가 실제로 run 을 시작하는 것으로 확인).
- [ ] PR body 에 본 task 파일 링크 + Acceptance Criteria 체크리스트 + "concurrency 변경의 검증 방법" (같은 PR 재push 시 직전 run cancel 관찰 / main push 비-cancel 확인) 을 포함한다.

## Out of Scope

- `flags.fineGrainedConcurrency` 토글 ON (stage 5 — 30일 dogfood 합의 후, 별도 task).
- claim registry / select-claim / loop 재작성 (stage 1~3, 이미 완료).
- 동시 driver 수 N 상한 변경 (ADR-0036 §Decision 6 — N 상향은 별도 ADR).
- approval-gate step 의 issue_comment / main-ref 매칭 로직 변경 (STATE.ci.benignRedNote 의 잠재 follow-up — 본 task 는 concurrency key 추가만, gate 로직 수정 금지).
- ci.yml 의 다른 step(spec-presence / lint / build / prisma / test / smoke / e2e / approval) 변경.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0036 §Decision 6 에 형태 박제, 새 architecture 결정 없음).

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append)
