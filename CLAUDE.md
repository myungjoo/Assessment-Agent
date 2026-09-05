# CLAUDE.md — Assessment-Agent Long-Horizon Driver

모든 conversation 에 자동 로드되는 **불변 규칙**. 요구사항은 [README.md](README.md), 절차는 [docs/LOOP.md](docs/LOOP.md), 결정 근거는 `docs/decisions/ADR-*.md` 에 있다. 이 문서는 *원칙* 만 적는다 — 근거 · 사례 · 현재 flag 값 · 절차 세부는 여기 적지 않는다 (각각 ADR · journal · `docs/STATE.json` · LOOP.md 가 정본).

---

## 0. 미션

[README.md](README.md) 의 Assessment-Agent 를 실사용 가능한 수준까지 완성한다. 사람이 매 step 을 지시하지 않는다. 에이전트가 PLAN 을 스스로 관리하고, context 한계를 넘지 않도록 작은 task 단위로 진행한다.

## 1. 기술 스택 (확정)

Node.js LTS + NestJS + TypeScript / React + Vite / PostgreSQL ([ADR-0002](docs/decisions/ADR-0002-db.md)) / Jest + supertest / GitHub Actions / pnpm. 스택 변경은 반드시 **새 ADR** 로 먼저 기록한다.

## 2. 실행 루프 (매 turn)

1. `docs/STATE.json` 로드 (읽기 전 `git fetch` 필수).
2. Lock 획득 (§10). 실패 시 즉시 종료.
3. `currentTask` → 이어 진행. 없으면 `nextTask` 를 `currentTask` 로. 둘 다 없으면 planner dispatch 후 종료.
4. executor 에 task ID 만 넘긴다. task 파일의 `Required Reading` 외 광범위 read 금지.
5. implementer 후 tester 필수.
6. task 파일 `Status: DONE` + journal 1~5 줄 + STATE 갱신 + lock 해제를 **단일 commit** 으로.
7. Task 1 개 완료 후 종료 (예외는 §2.5). Blocker 는 notifier 에 넘기고 종료.

### 2.5 Multi-task fire

cron fire 에서 `flags.multiTaskFire` 가 true 이면 [LOOP.md §1 [7.5]](docs/LOOP.md) 의 chain 조건 (a)~(e) 충족 시에만 N≤2 로 다음 task 진입 ([ADR-0020](docs/decisions/ADR-0020-multi-task-fire-cron-n2-activation.md)). 조건 미충족 진입은 `multi-task-fire-violation` BLOCKED. 활성 여부는 `docs/STATE.json` 만이 정본이다.

## 3. Task / Commit / PR 원칙

- **1 task = 1 commit.** 상한 diff ≤ 300 LOC, 파일 ≤ 5 개 — 초과 예상 시 planner 가 split.
- **소비처 동반 의무 (하한).** helper / factory / 어댑터 신설 slice 는 그 helper 를 호출하는 소비처 배선을 같은 PR 에 포함한다. 예외는 소비처 포함 시 cap 초과가 task 파일에 `estimatedDiff` / `estimatedFiles` 수치로 제시된 경우뿐이며, 그때 `Follow-ups` 에 소비처 slice 를 파일 · 배선 단위로 명시한다. 판정은 planner, 위반은 reviewer 가 MINOR finding.
- 작업 중 보이는 **다른 주제** (린터 의견 · 무관한 버그) 는 즉시 고치지 않고 task 의 `Follow-ups` 에 적는다.
- **Nit-in-PR closure.** reviewer APPROVE 후 남은 nit 이 (1) test case 추가 (2) style fix (3) 주석 · 한국어 표현 (4) spec describe / it 문자열 명확화 중 하나이고 cap 안이면 follow-up task 를 만들지 않고 같은 PR 의 다음 commit 에서 처리한다.
- Commit message: `<type>(<scope>): <subject 한국어> (T-NNNN)`. type/scope 영어, subject · body 한국어. 모든 commit 본문에 §11 trail blob 포함.
- PR title · body 한국어. body 에 task 파일 링크 + Acceptance Criteria 체크리스트 필수.

### 3.1 Commit mode

| commitMode | 대상 | 절차 |
| --- | --- | --- |
| `direct` | `docs/STATE.json`, `docs/PLAN.md`, `docs/progress/`, `docs/tasks/` status, `CLAUDE.md` 운영규칙, `.claude/`, `README.md`, ADR status 한 줄 갱신, 기존 ADR · architecture 문서의 비-결정 수정 (pointer · typo · 표기) | main 에 직접 commit → push |
| `pr` | `src/`, `web/`, `test/`, 새 ADR · architecture 문서, ADR 의 결정 내용 변경, `.github/workflows/`, `package.json` / lockfile, 그 외 동작 변경 | `claude/T-NNNN-<slug>` → PR → reviewer → integrator merge |

판정은 planner 가 task frontmatter `commitMode:` 에 명시. 두 종류를 모두 건드리면 task 를 둘로 split. `docs/requirements.md` 의 REQ status 재판정 task 는 **그 REQ 를 구현하는 slice 가 머지된 뒤 REQ 당 1 회만** 생성한다 — 구현 전 판단은 planner 의 issue-still-relevant pre-check 로 하고 구현 task 의 `Why` 에 적는다 (구현 arc 와 무관한 drift 정정은 예외). 절차 분기는 [LOOP.md §1](docs/LOOP.md).

### 3.2 Test · CI 절대 규칙 (README 110~114 행)

- **R-110** — 모든 `pr` task 는 implementer 후 `tester` 를 **반드시** 호출한다. production 변경 0 LOC 여도 `pnpm lint && pnpm build && pnpm test` 확인. direct doc-only commit 만 면제.
- **R-111** — 모든 test 는 CI 에서 실행되고, fail 은 PR red 로 연결된다.
- **R-112** — `pr` 코드 task 의 AC 에 planner 가 자동 포함: (1) public symbol 별 happy-path 1+ (2) error path 1+ (3) 분기별 1+ (4) **negative case 를 예외 분기마다 1+**. Coverage **line ≥ 80% AND function ≥ 80%** (`package.json` `coverageThreshold.global`). `src/main.ts` 류 entrypoint 는 `coveragePathIgnorePatterns` + `scripts/check-spec-presence.sh` 로 제외하되, 분기 있는 로직은 helper 로 분리해 spec 을 붙인다. `hqOrigin` 있는 patch task 는 regression test 1+ 추가.
- **R-113** — CI 는 unit (`pnpm test`) + smoke (`pnpm test:smoke`) + e2e (`pnpm test:e2e`) 를 각각 실행.
- **R-114** — push 후 driver 가 latest run conclusion 확인. `success` 면 STATE.ci 갱신, `in_progress` 면 다음 turn 첫 단계에서 재확인, `failure` 면 즉시 BLOCKED (`ci-fail` / `ci-repeat-fail`).

### 3.3 Reviewer + Integrator 이중 합의 (README 116 행) — 4-게이트

1. reviewer VERDICT == APPROVE
2. PR 에 reviewer comment 가 **외부에 존재** (CI step "reviewer agent approval 검증" 이 자동 게이트)
3. integrator 자체 점검 통과
4. CI green

하나라도 false → ANOTHER_ROUND 또는 BLOCKED. 평가 도구는 gh / MCP 어느 path 든 동등 ([ADR-0005](docs/decisions/ADR-0005-mcp-tools-for-pr-review-flow.md)). 세부는 [.claude/agents/integrator.md](.claude/agents/integrator.md).

## 4. Sub-agent dispatch (context 관리 핵심)

driver 는 `executor` 만 호출하고, 나머지는 executor 안에서 호출된다. **모든 sub-agent 는 ≤ 200 char SUMMARY + 자기 trail section 만 반환** — 긴 출력은 `docs/progress/details/T-NNNN-<step>.md` 로 외화.

| Sub-agent | 호출자 | 시점 | 반환 |
| --- | --- | --- | --- |
| `planner` | driver | currentTask · nextTask 둘 다 없을 때 | task 파일 1 개 + `STATE.nextTask` |
| `executor` | driver | task 1 개 수행 | SUMMARY + 조립된 trail + status |
| `architect` | executor | 모듈 / API / 스키마 / library 결정 | ADR 1 개 + architecture 갱신 |
| `implementer` | executor | 코드 변경 | 스테이징된 변경 |
| `tester` | executor | implementer 직후 | 테스트 + 실행 결과 |
| `reviewer` | integrator | PR push 후 + 매 round | verdict (PR comment 로 외화 — 실패 시 `reviewer-post-failed`) |
| `integrator` | driver | pr-mode commit 후 | PASS / ANOTHER_ROUND / BLOCKED |
| `notifier` | driver | BLOCKED 또는 review round 7 초과 | `STATE.humanQuestions` + 종료 |

규칙: (1) driver 는 task 본문 · ADR · 코드 · 테스트 결과를 직접 읽지 않는다. (2) chain 은 최대 2 단계 (driver → executor → 하위). (3) driver 의 외부 API 호출 (PR comment · merge · check run 조회) 은 예외이나 raw payload 는 boolean / SHA / id 만 남기고 즉시 discard.

## 5. HITL 정책

**자동 진행**: PLAN 안의 정상 진행, bug fix, refactor, test · 문서 갱신, 기존 ADR 범위 내 구현.

**BLOCKED → notifier → 종료**: 새 외부 dependency, 기존 ADR 과 충돌하는 변경, DB schema 변경, security / auth 변경, 외부 자격증명 필요, review round 7 초과, 같은 사유 CI 3 회 연속 fail, 요구사항 ambiguity. BLOCKED 는 죄가 아니다.

## 6. 파일 맵

```
README.md / CLAUDE.md              요구사항 / 행동 규칙
docs/PLAN.md, STATE.json, LOOP.md  마스터 플랜 / 머신 상태 / 실행 절차
docs/use-cases/, architecture/, decisions/, tasks/, progress/
.claude/agents/<role>.md           sub-agent 정의
src/  web/  .github/workflows/     backend / frontend / CI
```

## 7. Context 절약

1. `src/` 전체 read · grep 대신 `docs/architecture/modules.md` 인덱스 먼저.
2. 큰 read · search · implement 는 sub-agent 로.
3. 같은 결정을 두 번 추론하지 않도록 ADR 에 적는다.
4. journal 은 5 줄 이내.
5. task 파일은 self-contained (Required Reading · AC · Out-of-Scope) — 단 문서 본문 인용 대신 경로 + § 좌표.

## 8. 도구

Bash 는 빌드 / 테스트 / git / gh 만 (탐색은 Glob / Grep). WebFetch / WebSearch 는 architect 만 자유롭게. `git push --force`, secret 접근, 외부 서비스 변경 금지 — 필요 시 BLOCKED.

## 9. 안전장치

- `git push --force`, `git reset --hard origin/...` 금지. secret 은 어디에도 적지 않는다. 새 dependency 는 BLOCKED. commit 없이 push 하지 않는다.
- **STATE 단일 writer**: `docs/STATE.json`, `docs/progress/journal-*.md`, `STATE.counters.*` 는 driver · planner · notifier 만 write. 나머지 agent 는 read only.
- **Counters 는 origin+1 read-modify-write**: 최신 origin/main fetch 직후 값을 base 로 +1. 절대값 덮어쓰기 금지.
- **Push source / target 매칭**: direct 는 main 에서 `push HEAD:main`, pr 은 feature branch 에서 `push HEAD:claude/T-NNNN-<slug>`. 불일치는 `wrong-source-branch` BLOCKED.

## 10. Long-horizon 실행 모드

- 진입점 우선순위: (1) `/schedule` cron — 매 발화 fresh conversation, 주력. (2) `claude -p` headless. (3) `/loop` dynamic — 사용자가 옆에 있을 때 5~10 turn 보조용. ScheduleWakeup 은 같은 conversation 에 누적되므로 [LOOP.md §1 [8]](docs/LOOP.md) 의 10-turn cap 을 따른다.
- **Lock** = `refs/heads/claude/lock-driver` tip 의 `push --force-with-lease` CAS ([ADR-0009](docs/decisions/ADR-0009-strong-ref-cas-lock.md), [ADR-0028](docs/decisions/ADR-0028-cloud-proxy-branch-lock.md)). 모든 진입점은 작업 전 lock CAS 를 선행 시도하고, 미획득 시 no-op 종료한다. lock 점검 · STATE read 전 `git fetch` 필수. stale 임계 60 분. feature branch + draft PR 격리 병렬 작업 금지. driver loop 는 origin/main 추적 체크아웃에서만.
- **Fine-grained concurrency** ([ADR-0036](docs/decisions/ADR-0036-fine-grained-concurrency.md), [docs/architecture/concurrency.md](docs/architecture/concurrency.md)): `flags.fineGrainedConcurrency` 가 true 이면 lock 은 critical section 에서만 짧게 잡고 task 소유는 claim registry 로 표현한다 (`maxConcurrentClaims` 이하, 파일-disjoint 독립 task 끼리만). false 면 단일 driver coarse mutex. 분기 절차는 [LOOP.md §1 [2]](docs/LOOP.md). `concurrencyIncidents` 같은 유형 2 회 누적 시 자동 OFF 강등 + notifier.
- cron 간격 ≥ 평균 task 소요 × 2 (multiTaskFire 활성 시 × N 추가). `/loop` 시간대와 cron 시간대 분리. 충돌은 fetch + rebase, push 실패 시 최대 3 회 재시도 후 BLOCKED ([LOOP.md §4](docs/LOOP.md)).
- **Branch protection 없음.** integrator 는 4-게이트 충족 시 `--squash --delete-branch` 로 즉시 merge. 사람이 protection rule 을 켜면 `protected-branch` BLOCKED.

## 11. Commit message agent-trail

trail 의 **헤더 · 키는 영어**, **값 · 본문은 한국어**. commit body 안에 인라인. 호출되지 않은 sub-agent 섹션은 생략. `notes` / `coverage` 각 ≤ 2 줄. subject ≤ 70 char. BLOCKED 종료 시에도 `BLOCKER:` 섹션 포함.

```
<type>(<scope>): <subject 한국어> (T-NNNN)

<2~5 줄 한국어 요약>

--- agent-trail ---
PLANNER: <phase · bullet 출처 한 줄>
ARCHITECT: <ADR-NN, 핵심 결정 한 줄>          (해당 시)
IMPLEMENTER:
  files: <comma-separated>
  loc: +X/-Y
  notes: <≤2 줄>
TESTER:
  added: <test 파일 | none>
  result: pass | fail(N)
  coverage: <≤2 줄>
INTEGRATOR: pr=<num> round=<n> ci=<pass|fail> [tool=<gh|mcp>]   (pr-mode)
ACCEPTANCE:
  - <criterion>: ok | pending | failed
--- /agent-trail ---

Refs: T-NNNN [, ADR-NN] [, PR-NN]
```

## 12. 언어 정책

기본 소통 언어는 **한국어**. inbound 가 영어인 issue / PR 에는 그 언어로 답해도 된다.

- **한국어**: commit subject (prefix 뒤) · body, 코드 주석, PR title · body · comment, 문서 본문, agent SUMMARY, trail 값, STATE 의 사람-친화 필드, task 파일 본문.
- **영어**: 식별자 · 파일명, 코드, commit type / scope, trail · JSON 키, 명령어 · 경로 · URL, 외부 표준 용어, status enum, `T-NNNN` / `ADR-NNNN` / `PR-NN`, 에러 reason 슬러그 (`new-dep`, `task-too-large` 등).
- 행 범위 표기의 정본은 [REQ-COVERAGE-AUDIT.md](docs/use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.76` R1~R7 (R5 는 `§ 12.91` 개정). 요약: 구분자는 `~`, 단일 행은 `20 행`, `L` prefix 금지. 신규 작성분부터 적용, 소급 치환 금지.
- 위반은 reviewer 가 MINOR finding. 기존 영어 commit · 문서는 그대로 두고 갱신 부분만 한국어로.

---

이 문서의 갱신은 원칙 변경일 때만 한다. 근거 · 사례 · 현황은 ADR · journal · STATE 로 보낸다.
