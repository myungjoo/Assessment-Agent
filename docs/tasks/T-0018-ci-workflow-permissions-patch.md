---
id: T-0018
title: T-0017-patch — ci.yml workflow permissions 누락 수정 (gh pr view 권한)
phase: P1
status: DONE
commitMode: pr
coversReq: [REQ-060]
estimatedDiff: 5
estimatedFiles: 1
created: 2026-05-24
completedAt: 2026-05-24T23:30:51+09:00
mergedAs: 4fab0e55ca546149a4c18e03c389fbe73f36a18f
prNumber: 17
reviewRounds: 1
hqOrigin: null
patchOrigin: T-0017
prOrigin: PR-16
dependsOn: []
blocks: [T-0017-remerge]
plannerNote: T-0017 PR-16 의 CI fail 원인 — ci.yml 의 reviewer-approval step 이 gh pr view 호출 시 default GITHUB_TOKEN 의 pull-requests scope 부재. workflow-level permissions block 신설로 fix.
---

# T-0018 — `.github/workflows/ci.yml` workflow permissions 누락 patch

## Why

2026-05-24 [T-0017](T-0017-t-a4-module-view.md) (T-A4 module view) PR-16 의 CI 가 `reviewer agent approval 검증` step (ci.yml:77–110) 에서 fail. 원인은 commit `06504fe` 가 본 step 을 도입할 때 **workflow-level `permissions:` block 을 함께 추가하지 않은 구조적 결함**:

- 본 step 은 `gh pr view --json reviews --json comments` 로 PR Pulls API 에 GraphQL 조회를 수행한다.
- GitHub Actions 의 default `GITHUB_TOKEN` 은 workflow 에 `permissions:` block 이 없으면 **저장소 설정의 default scope** 를 그대로 따른다 (대부분의 repo 에서 read 만 부여, Pulls API 접근 제한).
- 본 repo 의 default 가 Pulls API 미부여 → `gh pr view` 가 `Resource not accessible by integration` GraphQL error → step exit 1 → CI red.

**Impact 범위**: T-0017 PR-16 1 건만이 아니라 **본 workflow file 을 통해 trigger 되는 모든 향후 PR 의 CI 가 동일 사유로 red**. Phase P1 의 마지막 task (T-0017) merge 가 막혀 있고, 이후 모든 pr-mode task 도 본 결함이 fix 되지 않으면 진행 불가.

Failed run 증거: <https://github.com/myungjoo/Assessment-Agent/actions/runs/26363373490>.

**Fix scope**: ci.yml 의 `on:` block 직후, `jobs:` 전에 다음 3 줄 추가 (GitHub Actions 공식 문서 — workflow-level `permissions:` block 이 `GITHUB_TOKEN` 의 scope 를 명시적으로 설정):

```yaml
permissions:
  contents: read
  pull-requests: read
```

- `contents: read` — checkout step 의 source 접근 (default scope 이지만 명시).
- `pull-requests: read` — `gh pr view` 가 호출하는 Pulls API GraphQL 접근. 본 결함의 직접 원인.

본 task merge 후 **T-0017 PR-16 의 CI re-run 또는 rebase 가 별도 필요** (PR-16 의 head 가 본 fix 를 포함하지 않으므로 — Follow-ups 참조). 본 task 의 직접 책임은 ci.yml fix 까지.

## Required Reading

- [.github/workflows/ci.yml](../../.github/workflows/ci.yml) — 전체 workflow. `on:` block 위치 + `jobs:` block 위치 확인 후 그 사이에 `permissions:` block 신설.

## Acceptance Criteria

1. **`.github/workflows/ci.yml` 의 `on:` block 직후, `jobs:` 전에 `permissions:` block 신설** — 다음 정확한 형태로:
   ```yaml
   permissions:
     contents: read
     pull-requests: read
   ```
   indent / key 명 / value 모두 위 그대로 (GitHub Actions workflow syntax 표준).
2. **권한 명세 의도 한국어 comment 1 줄 추가** — `permissions:` line 직전에 다음과 유사한 한국어 주석 1 줄 (정확한 문안은 implementer 재량, 단 의도가 명확해야 함):
   ```yaml
   # GITHUB_TOKEN scope: checkout 용 contents:read + gh pr view 용 pull-requests:read
   ```
3. **ci.yml 외 다른 파일 수정 0** — `src/`, `web/`, `test/`, `package.json`, lockfile, 다른 workflow file, docs 모두 untouched.
4. **production code 0 LOC** — 본 task 는 CI workflow config 변경. NestJS / Jest / TypeScript source 0 LOC 변경.
5. **R-110 (CLAUDE.md §3.2) — tester invoke 의무** — pr-mode 이므로 `pnpm lint && pnpm build && pnpm test` 실행. workflow 변경은 local pnpm 명령에 영향 없으므로 **기존 baseline 통과 그대로** 예상. tester 가 commit message TESTER trail 의 `result:` 에 pass 박제.
6. **R-112 (CLAUDE.md §3.2) — happy/error/branch/negative 4 항목** — production code 0 LOC, 새 public symbol 0 개, 분기 추가 0 개. **R-112 N/A** — tester 가 TESTER trail 의 `notes:` 에 "production code 0 LOC, R-112 N/A — workflow config patch" 명시. 본 task 는 분기 없음 — Acceptance Criteria 의 분기 분리 항목 생략.
7. **R-112 patch 추가 항목 — regression test** — 본 task 는 hqOrigin 없는 driver auto-spawned patch 이지만, **patch 의 성질상 결함이 다시 발생하면 fail 하는 test 가 필요**. 단, 본 결함의 regression check 는 **CI workflow 자체 실행 으로만 검증 가능** (local unit test 로는 GitHub Actions 의 GITHUB_TOKEN scope 재현 불가). 따라서 본 항목의 검증은 **본 task 자체의 PR CI 가 green 인지로 박제** — 본 task 의 PR 이 CI green 으로 머지된다는 사실 자체가 regression test 통과 증거. tester / integrator 가 본 사실을 trail 에 명시.
8. **size cap 검증** — diff ≤ 5 LOC / 파일 ≤ 1 (CLAUDE.md §3 cap ≤300 LOC / ≤5 파일 충분 여유).
9. **신규 dependency 0** — package.json / pnpm-lock.yaml untouched. 본 task 는 YAML config 한 줄 추가.
10. **CI 7 step 모두 green** — push 후 CI conclusion = success 확인. 7 step: lint / build / spec-check / unit test / smoke test / e2e test / coverage. **추가로 본 task 의 fix target 인 `reviewer agent approval 검증` step 자체가 success** 여야 — `gh pr view` GraphQL 호출이 `Resource not accessible by integration` 없이 정상 응답.
11. **본 task 자체의 4-gate** — reviewer APPROVE + PR comment 외화 + integrator self-check + CI green. 4-gate 모두 충족 시 squash merge.
12. **본 task merge 후 STATE 갱신은 driver 책임** — completedAt / mergedAs / prNumber / reviewRounds 박제는 executor 가 task 파일에 inline 추가 + driver 가 STATE.counters.tasksCompleted +1 + STATE.currentTask 정리 + journal 추가. (본 patch task 의 일반적인 flow — 별도 명시.)

## Out of Scope

- **다른 workflow file 추가 / 수정** — `.github/workflows/` 의 ci.yml 외 다른 file 은 본 task 가 touch 하지 않는다. 새 workflow (예: deploy.yml, release.yml) 신설은 별도 task.
- **reviewer-approval step logic 자체의 개선** — 현 step (ci.yml:77–110) 의 정규식 / pattern matching / verdict 추출 algorithm 등의 조정은 본 task 범위 밖. 본 task 는 권한 부여만으로 step 이 작동하게 한다 — logic 결함은 향후 별도 patch.
- **다른 permission 추가** — `issues: write`, `pull-requests: write`, `contents: write` 등은 현재 필요 0. 본 task 는 `contents: read` + `pull-requests: read` 2 개만. 향후 다른 권한 필요 시 별도 ADR + patch task.
- **T-0017 PR-16 의 rebase / CI re-trigger** — 본 task merge 후 PR-16 의 head workflow 가 본 fix 를 포함하도록 만드는 작업은 driver 별도 책임. 본 task 의 직접 책임은 ci.yml fix 까지. Follow-ups 에 명시.
- **smoke / e2e test 신설** — production code 변경 0 LOC. R-113 의 smoke/e2e 인프라 (T-0009/T-0010) 위에서 단순 CI green 만 요구.
- **GitHub repo 의 default GITHUB_TOKEN permission 설정 변경** — Settings → Actions → General → Workflow permissions 의 UI 설정 변경은 본 task 범위 밖. 본 task 는 workflow-level `permissions:` 로 명시적 scope 부여 — repo 설정에 의존하지 않는 robust fix.

## Suggested Sub-agents

`implementer → tester`. implementer 가 ci.yml 의 `on:` block 직후 위치를 찾아 `permissions:` block + 한국어 comment 1 줄 추가 (총 +5 LOC). tester 는 `pnpm lint && pnpm build && pnpm test` 실행 (baseline pass 확인) + push 후 CI 7 step + `reviewer agent approval 검증` step 의 GraphQL 호출이 success 인지 확인. architect 호출 불필요 — 본 task 는 단일 YAML config 추가, ADR 결정 사항 없음 (workflow permissions 는 GitHub Actions 표준 mechanism, 별도 결정 없이 명시적 부여).

## Follow-ups

- **T-0017 PR-16 의 CI re-trigger** — 본 T-0018 merge 후 driver 는 다음 중 1 방법으로 PR-16 의 CI 를 본 fix 가 적용된 workflow 로 재실행:
  - (a) **Rebase**: `git checkout claude/T-0017-t-a4-module-view && git rebase origin/main && git push --force-with-lease`. PR-16 의 head sha 가 갱신되어 latest workflow (본 fix 포함) 로 CI 재실행.
  - (b) **Empty commit retrigger**: `git commit --allow-empty -m "chore(ci): retrigger T-0017 with fixed permissions" && git push`. PR-16 의 새 commit 으로 CI 재실행. workflow file 은 PR head 의 file 을 따르므로 (b) 는 main 의 ci.yml 을 따르지 않음 — 따라서 (b) 만으로는 본 fix 적용 안 됨. (a) rebase 가 정공법.
  - (c) **`gh workflow run` 강제 실행**: workflow 가 `workflow_dispatch:` trigger 를 포함해야 가능. 현 ci.yml 의 trigger 확인 필요.
- **본 결함의 root cause 회피 룰** — `.github/workflows/*.yml` 신규 작성 / 수정 시 `gh` CLI 또는 GitHub API 호출 step 포함되면 **반드시 workflow-level `permissions:` block 으로 명시적 scope 부여**. 이 룰을 reviewer agent check list (README 117–128) 또는 별도 doc 에 박제하는 follow-up task 후보.
- **reviewer-approval step 의 작동 범위 점검** — 본 step 이 정상 작동하기 시작하면, T-0017 PR-16 외 과거 PR (PR-13 ~ PR-15) 의 verdict 추출도 정상이었는지 회고. driver one-time workaround 로 reviewer 를 직접 dispatch 한 round 들이 본 step 의 자동 검증 대상에서 누락되지 않았는지 확인.

## Notes

- **본 task 의 우선순위**: T-0017 PR-16 unblock + 향후 모든 pr-mode task 의 CI green 확보. Phase P1 의 마지막 task (T-0017) merge 의 직접 dependency.
- **commitMode=pr 의 이유**: `.github/workflows/` 변경은 CLAUDE.md §3.1 표의 `pr` 컬럼. direct commit 불가.
- **patch task naming convention**: T-0012 (check-spec-presence.sh patch) 와 동일 패턴 — `T-NNNN-<scope>-patch.md` 파일명 + frontmatter `hqOrigin` 또는 `patchOrigin` 으로 출처 박제.
- **size cap 여유**: estimatedDiff=5 LOC, estimatedFiles=1. cap (≤300/≤5) 대비 매우 작음.
- **branch 명명**: `claude/T-0018-ci-workflow-permissions-patch` 또는 `claude/T-0018-ci-permissions` 권장 (LOOP.md §1 branch convention).
- **GitHub Actions 공식 문서 참고**: <https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication#permissions-for-the-github_token> — workflow-level `permissions:` block 의 표준 사용법 + default scope 의 repo 설정 의존성 설명.
