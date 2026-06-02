# CLAUDE.md — Assessment-Agent Long-Horizon Driver

이 문서는 모든 conversation에 자동 로드되며, Claude Code(이하 "에이전트")가 본 저장소에서 행동할 때의 **불변 규칙**이다.
요구사항·기능 명세는 [README.md](README.md)에 있다. 이 문서는 *어떻게 일할지*만 정한다.

---

## 0. 미션

[README.md](README.md)에 명세된 Assessment-Agent를 **실사용 가능한 수준**까지 완성한다. 단, 사람이 매 step을 지시하지 않는다. 에이전트가 PLAN을 스스로 관리하고, 진도를 추적하며, context 한계를 넘지 않도록 작은 task 단위로 자기 자신을 분할해 진행한다.

---

## 0.5 Hard rule 인덱스 (cheat sheet — 본문 § 참조)

prompt 후반부에 박힌 hard rule 의 attention drift 누락을 막기 위해 핵심 8 개를 앞단에 모은다. 본문은 각 § 에서 자세히 — 본 인덱스는 navigation + 한 줄 요약.

1. **R-110~R-114 (test/CI 절대 규칙)** — pr-mode tester 의무, CI fail = merge 차단, happy/error/branch/negative test 필수 (negative cases 충분 cover — 예외 상황 분기마다), **coverage line ≥ 80% AND function ≥ 80%**, smoke+e2e 도 CI 에서. → §3.2.
2. **4-게이트 (reviewer + integrator 이중 합의)** — reviewer.APPROVE + PR comment 외부 존재 + integrator 자체 점검 + CI green. 하나라도 false → ANOTHER_ROUND / BLOCKED. → §3.3.
3. **Sub-agent dispatch (context 누적 방지)** — driver → executor → {architect, implementer, tester, ...}. 3 단계 chain 금지. 모든 sub-agent ≤ 200 char SUMMARY + trail blob 만 반환. → §4.
4. **Push source/target 매칭** — direct → main 에서 `push HEAD:main`. pr → feature branch 에서 `push HEAD:claude/T-NNNN-<slug>`. source ≠ target push 는 agent 자동 실행 금지. 위반 = `wrong-source-branch` BLOCKED. → [docs/LOOP.md](docs/LOOP.md) §4.
5. **STATE single-writer** — `STATE.json` / journal / counters 는 driver / planner / notifier 만 write. counter 는 origin+1 read-modify-write. → §9.
6. **Commit trail blob 표준 포맷** — 모든 commit (direct · pr) 본문에 trail blob 포함. 헤더 / 키는 영어, 값 / 본문은 한국어. `notes` / `coverage` ≤ 2 줄. → §11.
7. **언어 정책** — commit subject · body / 코드 주석 / PR comment / 문서 본문 = 한국어. 식별자 / enum / commit type prefix / 명령어 / 경로 / status 토큰 = 영어. → §12.
8. **1 task = 1 commit / 1 fire = 1 task** — task 크기 ≤ 300 LOC / 5 파일. 다른 주제는 즉시 고치지 말고 task 의 Follow-ups 에. cron 1 fire 1 task 후 종료. **기본 OFF — 실험적 multi-task fire 는 §2.5**. → §3 + [docs/LOOP.md](docs/LOOP.md) §1 [7].

historical 사고 증거 (룰이 박힌 이유): PR-5/6/7 reviewer 우회 / T-0007 PR-8 source≠target / T-0003 jest.roots catch 누락 / T-0001 task-too-large / T-0009 PR-10 spec check — [docs/progress/](docs/progress/) journal 참조.

---

## 1. 기술 스택 (확정)

| 영역 | 선택 |
| --- | --- |
| Backend | Node.js LTS + NestJS + TypeScript |
| Frontend | (별도 ADR로 결정 — 기본 후보: React + Vite, P6 진입 시) |
| DB | PostgreSQL ([ADR-0002](docs/decisions/ADR-0002-db.md) ACCEPTED) |
| Test | Jest (unit), supertest (e2e) |
| CI | GitHub Actions |
| Package manager | pnpm |

스택 변경은 반드시 **새 ADR**로 기록한다. 코드보다 ADR이 먼저다.

---

## 2. 실행 루프 (매 turn 반드시 따른다)

에이전트가 어떤 진입점(`/loop`, `schedule` cron, headless 호출)으로 깨어나든 다음 순서를 따른다.

1. **상태 로드**: [docs/STATE.json](docs/STATE.json) 을 읽는다.
2. **Lock 검사**:
   - `state.lock`이 비어있으면 → 본인 식별자로 lock을 잡는다 (`{"holder": "<driver>", "since": "<ISO>"}`).
   - 다른 holder가 잡고 있고 `since`가 60분 이상 지났으면 stale로 간주하고 탈취. 아니면 즉시 종료.
3. **다음 작업 결정**:
   - `state.currentTask`가 있으면 그 task를 이어 진행.
   - 없고 `state.nextTask`가 있으면 그것을 `currentTask`로 옮긴다.
   - 둘 다 없으면 **planner sub-agent를 dispatch**하여 다음 task 1개를 생성한 뒤 종료(다음 turn에서 실행).
4. **Task 실행**:
   - `docs/tasks/<TaskID>.md` 를 읽는다.
   - 그 안의 `Required Reading` 목록에 있는 파일만 추가로 읽는다 (불필요한 광범위 read 금지 — context 보호).
   - `Acceptance Criteria` 가 시키는 일을 적절한 sub-agent에 dispatch한다 (§4 참조).
5. **검증**: implementer가 끝나면 tester를 호출해 unit/smoke를 통과시킨다.
6. **기록 & 해제**:
   - 완료 시 task 파일에 `Status: DONE`, 완료 시각, 결과 요약 추가.
   - [docs/progress/journal-YYYY-MM-DD.md](docs/progress/) 에 1~5줄 append.
   - `STATE.json` 갱신: `currentTask`→null, 결과 반영, `lock` 해제.
   - 한 turn = 한 commit 원칙(§3). 위 변경을 단일 commit으로 묶는다.
7. **종료 조건**:
   - Task 1개 완료 후 종료. 다음 task로 자동 진입하지 않는다 (context 누적 방지).
   - Blocker 발생 시 notifier sub-agent에게 넘기고 즉시 종료.
   - **Multi-task fire ([§2.5](#25-multi-task-fire-실험적-기본-off)) 활성 시에는 본 step 의 "1 task 후 종료" 가 조건부** — §2.5 의 활성화 조건 (a)~(e) 모두 충족 시에만 다음 task 진입 허용. **현재 기본 OFF** — 별도 ADR + `STATE.flags.multiTaskFire = true` 토글로만 활성.

---

## 2.5 Multi-task fire (실험적, 기본 OFF)

§2 step 7 의 "Task 1 개 완료 후 종료" 는 본 시스템의 **기본 동작이자 default rule**. 단, 향후 throughput 개선 실험을 위해 driver 가 한 cron fire / `/loop` turn 안에서 **task 2 개까지 연속 진행** 할 수 있는 opt-in 경로를 본 § 에 명문화한다. **현재 기본값 OFF — 활성화는 별도 ADR + `docs/STATE.json.flags.multiTaskFire = true` 토글로만 가능**.

도입 배경: cron 1 fire 1 task 패턴은 cold-start tax (CLAUDE.md / STATE / PLAN / journal 재로드 ~ 15k tok / fire) 를 매 task 마다 지불한다. multi-task fire 는 1 회 cold-start + N × orchestration overhead 로 token 측면 cheaper 하지만 driver context "fresh process per task" 격리 보장이 약화된다 ([§10](#10-long-horizon-실행-모드) 의 자동 cleanup 메커니즘 의도와 부분 충돌). 그래서 활성화 조건과 안전 가드레일을 사전 박제한 후 별도 ADR 에서 활성 결정.

### 활성화 조건 (5 개 모두 충족 시에만 chain 허용)

- (a) **Sub-agent 격리** — 직전 task 를 `executor` sub-agent 1 회 호출로 처리했고, driver 가 받은 응답이 ≤ 200 char SUMMARY + 표준 trail blob 뿐 ([§4](#4-sub-agent-dispatch-context-관리-핵심), [§11](#11-commit-message-agent-trail-long-horizon-외화의-핵심)). raw output / 긴 log 를 driver context 로 끌고 오면 chain 자동 차단. driver 책임 self-enforce.
- (b) **N ≤ 2** — 한 fire 의 task 수 최대 2. **3 이상은 본 § 가 명시적으로 금지** — N 상향은 별도 ADR 로만 가능.
- (c) **실패 시 즉시 종료** — 직전 task 가 `BLOCKED`, CI fail, push contention, merge conflict 중 하나라도 발생하면 chain 중단 + fire 종료. notifier 호출은 [§5](#5-hitl-human-in-the-loop-정책--균형).
- (d) **Lock 45 분 임계** — `STATE.json.lock.since` 로부터 경과 시간 ≥ 45 분이면 추가 task 진입 금지 ([§2](#2-실행-루프-매-turn-반드시-따른다) step 2 의 60 분 stale 임계 보호 — 두 번째 task 가 lock holding 을 60 분 너머로 끌고 가는 시나리오 차단).
- (e) **commitMode mixed chain 금지** — 같은 `commitMode` 끼리만 chain 허용 (direct + direct OR pr + pr). direct + pr 또는 pr + direct 혼합은 [§3.2](#32-testci-절대-규칙-readme-110114행-명문화) R-114 CI 검증 경계가 모호 (direct push 가 main CI 와 PR CI 사이에 끼면 검증 책임 모호) — 본 § 는 명시 금지.

### 기본 OFF 의 의미

- 현재 driver loop 는 §2 step 7 그대로 — 1 task 완료 후 종료. [docs/LOOP.md](docs/LOOP.md) §1 [7] 의 종료 분기가 본 § 와 충돌하지 않음 (활성 OFF 상태에서는 본 § 가 noop).
- 활성화 step (모두 별도 task / ADR):
  1. ADR 작성 — trade-off 박제 + N=2 명문화 + dogfood 30 일 기간 + 활성 결정 근거.
  2. `docs/STATE.json` schema 에 `flags.multiTaskFire: boolean` 필드 추가 (기본 `false`) + `docs/architecture/data-model.md` 또는 schema 문서 동기.
  3. [docs/LOOP.md](docs/LOOP.md) §1 에 chain 분기 step 추가 — 직전 task 완료 후 (a)~(e) 평가 → true 시 다음 task entry, false 시 §2 step 7 그대로.
  4. `flags.multiTaskFire = true` 토글 (별도 direct commit).
- 비활성 동안 본 § 는 forward-looking spec 으로 기능 — 향후 활성 의도와 안전 가드레일을 사전에 박제. 활성화 전에는 본 § 만으로 driver 동작이 변하지 않음.

### 활성 시 위반 처리

- (a)~(e) 중 하나라도 false 인 상태에서 driver 가 두 번째 task 로 진입 → `multi-task-fire-violation` BLOCKED → notifier → 종료. STATE.blockers[] 에 위반 조건 명시.
- reviewer agent 는 PR 검토 시 trail blob 의 fire 구조 (commit message footer 에 박제될 `FIRE-BATCH: <task1>+<task2>` 형태 marker) 를 보고 위반을 catch — MINOR finding 분류 (CI 가 별도 정상 통과했다면). marker 형식 자체는 활성화 ADR 에서 확정.
- 활성 후 첫 30 일은 dogfood 기간 — 위반 / context 누적 증후 / race 발생 시 ADR 갱신 또는 본 § 폐기 결정.

### 본 § 와 §10 의 관계

- §10 의 "진정한 long-horizon 은 cron 만이 보장 — 매 발화 새 conversation 으로 자동 cleanup" 룰은 **유지**. 본 § 는 1 fire 안의 N=2 일 뿐 — N>1 이어도 fire 자체는 매 발화 fresh.
- §10 "동시 실행 정책" 의 "cron 간격 ≥ 평균 task 소요시간 × 2" 는 multi-task fire 활성 시 `(N × 평균 task) × 2` 로 scale 필요 — 활성화 ADR 에서 함께 갱신. 그 전까지는 활성 OFF 라 변경 불요.

---

## 3. Task / Commit / PR 원칙

- **1 task = 1 commit** (README 109행). PR 사용 여부는 아래 commit mode를 따른다.
- **Task 크기 상한**: diff ≤ 300 LOC, 변경 파일 ≤ 5개. 초과 예상 시 planner가 task를 split한다.
- 한 task 작업 중 다른 주제(linter 의견, 보이는 버그 등)가 보여도 **즉시 고치지 않는다**. planner에게 follow-up task 생성을 요청하거나 task 파일의 `Follow-ups` 섹션에 적어둔다.
- **Nit-in-PR closure 의무 (15-step §11 차용, T-0148 박제)** — 위 follow-up 룰의 예외: **reviewer 가 APPROVE 했어도 Nit / Low-priority finding 이 남아있고, cap (300 LOC / 5 파일) 안에서 처리 가능하면 본 PR 안에서 완결**. 다음 4 종 fix 가 해당:
  1. Test case 추가 (R-112 충분 cover 부족 — reviewer 가 nit 으로 분류했어도).
  2. Style fix (prettier / lint 자동 처리 안 된 사소한 정리).
  3. Comment typo / 한국어 표현 자연화 (§12 정합).
  4. spec 의 describe / it 문자열 명확화.

  본 4 종은 follow-up task 생성 금지 — PR 의 다음 commit (round +1) 에서 처리. cap 초과 risk 시 (예: nit fix 가 ≥50 LOC 누적) 만 예외적으로 follow-up task 박제. ROI: follow-up task 양산 차단 + nit residual 의 main 진입 차단. integrator 의 4-게이트 (c) self-check 동반 (`.claude/agents/integrator.md` §5 CI fix re-review 의무 와 별도 — 본 룰은 reviewer 가 APPROVE 한 상태의 nit cleanup, 그 §5 는 CI fail 후 fix 의 reviewer 재호출).
- Commit message: `<type>(<scope>): <subject> (T-NNNN)` — type 예: feat, fix, refactor, test, docs, chore, ci. **type/scope/괄호는 영어, subject는 한국어**. body도 한국어 (자세히는 §12).
- PR 본문에는 반드시 task 파일 링크와 acceptance criteria 체크리스트를 포함한다. PR title·body 모두 한국어.

### 3.1 Commit mode (README 1f17123 규칙)

코드 작성은 PR + reviewer 합의 과정을 거치지만, **PLAN/STATE/CLAUDE 같은 진행상황 문서 업데이트**는 direct commit한다. 이 둘은 **별도 task·별도 commit**으로 분리한다.

| commitMode | 적용 대상 | 절차 |
| --- | --- | --- |
| `direct` | `docs/STATE.json`, `docs/PLAN.md`, `docs/progress/`, `docs/tasks/` 의 status 업데이트, `CLAUDE.md` 내 운영규칙 변경, `.claude/` 메타 변경, `README.md` 변경 | main 브랜치에 직접 commit → push. PR·reviewer 없음. |
| `pr` | `src/`, `web/`, `test/`, 새 `docs/architecture/*` 또는 `docs/decisions/*` 추가, `.github/workflows/` (CI 변경), `package.json`/lockfile, 그 외 동작 변경을 일으키는 모든 파일 | feature branch (`claude/T-NNNN-<slug>`) → commit → push → PR open → reviewer dispatch → 합의 → integrator merge. |

**판정 규칙 (planner가 task 생성 시 결정, frontmatter `commitMode:` 에 명시)**:

1. task의 변경 대상이 위 `direct` 컬럼에만 속하면 → `direct`.
2. 변경 대상이 `pr` 컬럼 파일을 하나라도 포함하면 → `pr`.
3. 한 task가 두 종류를 모두 건드려야 한다면 **task를 두 개로 split**한다 (먼저 direct doc task, 다음 pr code task — 또는 그 반대 순서 중 의존성에 맞는 것).
4. 새 ADR 자체는 `pr` (아키텍처 결정은 reviewer 점검 대상). 단, ADR의 status 갱신(예: PROPOSED→ACCEPTED) 한 줄 수정은 `direct`.

**Driver loop은 task의 `commitMode` 를 따라 자동 분기한다**. 자세한 절차는 [docs/LOOP.md](docs/LOOP.md) §1 참조.

**모든 commit (direct·pr 둘 다) 의 본문에는 agent-trail blob을 포함한다** (§11 참조). 이것이 driver context 외화의 핵심 메커니즘이다.

### 3.2 Test·CI 절대 규칙 (README 110–114행 명문화)

본 시스템은 [README.md](README.md) 110–114행의 다음 지시를 **task / commit / PR / merge 의 어떤 단계에서도 우회 불가능한 절대 규칙**으로 강제한다.

**R-110** ([README.md](README.md) 110행) — 하나의 commit 혹은 PR 작성 후 **코드 검토 + test case 작성 + test 수행** 이 모두 이뤄져야 한다.

- 적용: `commitMode: pr` task 는 architect/implementer 호출 후 `tester` 를 **반드시** 호출한다. production code 변경이 0 LOC 이어도 (config/CI/doc 변경 task) `tester` 가 `pnpm lint && pnpm build && pnpm test` 실행 결과를 확인해야 한다. tester 미호출은 §3 위반.
- direct-mode doc-only commit 만 본 규칙 면제 (코드가 없으므로).

**R-111** ([README.md](README.md) 111행) — 모든 test 는 **CI 에서 자동 실행** 되고, test fail 시 **CI error 로 연결되어** 코드 작성 agent 와 개발자 모두 인지한다.

- 적용: `.github/workflows/ci.yml` 의 step 중 어느 하나라도 fail 이면 PR 의 GitHub Actions 가 red. integrator 의 3중 게이트 중 "CI green" 검사가 이를 강제한다.

**R-112** ([README.md](README.md) 112행) — 개별 feature 작성 시 **(기능 + 예외처리 + flow) 3종을 대부분 커버하는 unit test 작성**, **negative test cases 포함**.

- 적용: 모든 `commitMode: pr` 코드 task 의 Acceptance Criteria 에 다음 4 항목을 planner 가 **자동으로** 포함시킨다:
  1. 추가/수정된 모든 public symbol(함수/클래스/엔드포인트)에 대해 happy-path unit test 1+
  2. 각 symbol 의 error path 1+ (잘못된 입력, 의존성 실패 등)
  3. flow / 분기 cover (분기 발생 시 각 분기 1+ test)
  4. **negative cases 충분 cover** — 예외 상황 (권한 부족 · 빈 입력 · 경계값 · type mismatch · 의존성 실패 · 비정상 시퀀스 등) **각 1+ test**. 단일 negative 만으로 부족 — 예외 처리 분기마다 cover.
- **Coverage 최소치 (jest `coverageThreshold` 강제)**: **line ≥ 80% AND function ≥ 80%** (`package.json` 의 `coverageThreshold.global`). 미달 시 jest exit 1 → CI `test:cov` step fail → PR red.
- **Entrypoint 예외**: `src/main.ts` 같이 NestJS 부트스트랩 함수만 담는 entrypoint 는 직접 unit-test 가 까다로워 [package.json](package.json) 의 `coveragePathIgnorePatterns` + [scripts/check-spec-presence.sh](scripts/check-spec-presence.sh) 에서 제외 처리. 단 entrypoint 안에 **분기 있는 helper 로직** (env parsing · 조건 부 init 등) 이 있으면 **별도 함수로 분리해 unit-testable 하게** 만들고 spec 추가 의무 — entrypoint 는 helper 호출만. helper 분리 없이 entrypoint 안에 분기 두면 R-112 위반. 예: `src/parse-port.ts` (helper) + `src/parse-port.spec.ts` (R-112 4 종 + negative cases 충분 cover).
- patch task (frontmatter `hqOrigin` 있음) 는 추가로 **regression test 1+** 의무 — 결함이 다시 발생하면 그 test 가 fail 하도록.

**R-113** ([README.md](README.md) 113행) — unit 외에 **smoke + end-to-end test 도 CI 에서 함께 수행**.

- 적용: CI workflow 는 단일 step 이 아니라 unit (`pnpm test`) + smoke (`pnpm test:smoke`) + e2e (`pnpm test:e2e`) 3 종을 각각 실행. 셋 다 fail 시 PR fail.
- P0.5 phase 의 T-0009/T-0010 이 smoke/e2e 인프라를 도입. 그 전까지는 unit 만으로 진행하되, PR 본문에 "smoke/e2e 미존재 — P0.5 에서 도입 예정" 명시.

**R-114** ([README.md](README.md) 114행) — agent 가 commit 후 **test 수행으로 검증**, agent 종료 전 **commit/PR된 내용에 대한 CI 수행**까지 완료.

- 적용: driver 는 push 후 `gh run list` 로 latest run 의 conclusion 확인 (LOOP.md §1 [5]).
  - `success`: STATE.ci 갱신 후 정상 종료.
  - `in_progress`: 본 turn 종료해도 무방하나, 다음 turn 의 [1] 단계에서 가장 먼저 conclusion 재확인.
  - `failure`: 즉시 BLOCKED (ci-repeat-fail 또는 ci-fail) 처리, notifier.
- "종료 전 CI 수행" 의 정확한 의미: CI 가 **시작은** 되어 있어야 한다 (push 자체로 trigger). conclusion 까지 본 turn 안에서 기다릴 수도 있고 (`gh run watch`), 그렇지 않으면 다음 turn 에서 확인.

### 3.3 Reviewer + Committer 이중 합의 (README 116행 명문화)

[README.md](README.md) 116행 — Reviewer 와 Committer 두 agent 가 모두 merge 에 합의해야 PR merge. 본 시스템의 매핑:

- **Reviewer Agent** ([.claude/agents/reviewer.md](.claude/agents/reviewer.md)) — PR diff 를 README 117–128 의 8 check 로 검토. **review 결과는 반드시 `gh pr comment` 로 PR 에 외화** (post 안 하면 reviewer-post-failed BLOCKED).
- **Committer Agent** ([.claude/agents/integrator.md](.claude/agents/integrator.md)) — reviewer verdict 를 받은 후 자체적으로 Acceptance Criteria / CI / Out of Scope / 기타 6 항목을 재점검. integrator 가 본 역할 겸함.

**합의 충족 = 4-게이트 모두 true**:

1. reviewer.VERDICT == APPROVE
2. PR 에 reviewer comment 외부 존재 — integrator self-check + **CI step "reviewer agent approval 검증" 이 자동 게이트** (GitHub formal review APPROVED 1+ 또는 PR comment 의 approve 어휘 한/영 case-insensitive 매칭 1+). 향후 별도 identity reviewer-bot 도입 시 formal approve 도 활용.
3. integrator 자체 점검 통과
4. CI green (위 (2) 의 CI step 포함)

하나라도 false → ANOTHER_ROUND 또는 BLOCKED. 게이트 (2) 는 reviewer 위장 (PR body 에 verdict inline) 패턴을 차단하는 외부 사실 게이트.

**4-게이트 평가 도구는 gh / MCP unified** ([ADR-0005](docs/decisions/ADR-0005-mcp-tools-for-pr-review-flow.md) ACCEPTED) — 게이트 (2) = `gh pr view <num> --json comments` OR `mcp__github__list_issue_comments(issue_number)` 결과 header 매칭 1+, 게이트 (4) = `gh pr checks <num>` OR `mcp__github__list_check_runs(ref=head_sha)` conclusion == success. 게이트 자체는 도구 path 무관 — 평가 결과 (boolean) 만이 합의 충족 판정 기준이며 외부 fact (PR comment / CI run conclusion) 가 어느 path 로 박제되든 동등.

이 4-게이트가 reviewer round 1 catch 누락 (예: T-0003 jest.roots) 의 보호 layer.

---

## 4. Sub-agent dispatch (context 관리 핵심)

**Long-horizon에서 driver(메인 conversation)의 context가 누적되지 않도록 하는 핵심 메커니즘.**

기본 원칙:
- driver는 `executor`만 호출한다. 다른 sub-agent들은 `executor` 안에서 호출된다.
- 모든 sub-agent는 driver/상위 caller에게 **≤200 char SUMMARY + 자기 trail section** 만 반환한다. 긴 출력은 파일로 외화하거나 `docs/progress/details/T-NNNN-<step>.md` 에 적는다.

| Sub-agent | 누가 호출 | 언제 호출 | 무엇을 받음 | 무엇을 반환 |
| --- | --- | --- | --- | --- |
| `planner` | driver | currentTask·nextTask 둘 다 비었을 때 | `STATE.json`, `PLAN.md`, 최근 journal | 새 task 파일 + `STATE.json.nextTask` 갱신 (코드 변경 없음) |
| `executor` | driver | task 1개를 실제로 수행할 때 | task ID | 짧은 SUMMARY + 조립된 agent-trail blob + status |
| `architect` | executor | 모듈/API/스키마/library 결정 필요 시 | task 정의서 | ADR 1개 + `docs/architecture/` 업데이트 + ARCHITECT trail section |
| `implementer` | executor | 코드 변경이 필요한 모든 task | task 정의서 + Required Reading | 스테이징된 코드 변경 + IMPLEMENTER trail section |
| `tester` | executor | implementer 직후 | 변경된 파일 목록 | 테스트 코드 + 실행 결과 + TESTER trail section |
| `reviewer` | integrator | PR push 후 + 매 ANOTHER_ROUND 마다 | PR 번호 / diff | verdict 본문 (≤200 char SUMMARY + trail section, README 117–128행). PR 외부 post 는 driver 가 `mcp__github__add_issue_comment` 또는 reviewer 가 직접 `gh pr comment` (local /loop fallback) — [ADR-0005](docs/decisions/ADR-0005-mcp-tools-for-pr-review-flow.md) 참조. post 안 되면 §3.3 게이트 2 fail. |
| `integrator` | driver | pr-mode commit 후 | PR 번호 | merge decision (§3.3 4-게이트 모두 PASS / ANOTHER_ROUND / BLOCKED). 실 머지 action 은 driver 가 `mcp__github__merge_pull_request(squash)` + `mcp__github__delete_branch` 또는 integrator 가 직접 `gh pr merge --squash --delete-branch` (local /loop fallback) — [ADR-0005](docs/decisions/ADR-0005-mcp-tools-for-pr-review-flow.md) 참조. |
| `notifier` | driver | executor가 STATUS=BLOCKED 반환 또는 review round 7 초과 | blocker 설명 | `STATE.json.humanQuestions` 항목 + 종료 |

**Driver context 누적 방지 룰**:

1. driver는 task 본문을 직접 읽지 않는다. executor가 읽는다.
2. driver는 ADR, 코드, 테스트 결과를 직접 보지 않는다. trail section을 commit message로 그대로 흘려보낸다.
3. driver는 어떤 sub-agent의 long output도 자기 conversation으로 받지 않는다. 받는 건 SUMMARY + TRAIL blob 두 덩어리뿐.
4. 호출 chain은 최대 2단계: **driver → executor → {architect, implementer, tester}**. 3단계 chain 금지.
5. **driver 의 외부 API call 예외** ([ADR-0005](docs/decisions/ADR-0005-mcp-tools-for-pr-review-flow.md) Path A 영구화 박제) — reviewer / integrator sub-agent 가 verdict / finding / merge decision 만 return 하고 driver 가 `mcp__github__add_issue_comment` / `mcp__github__merge_pull_request` / `mcp__github__list_check_runs` 등 외부 API 를 직접 호출하는 패턴은 ≤200 char SUMMARY 룰의 예외. 단 driver 는 raw MCP response (JSON 전문) 를 받자마자 핵심 결과 (boolean / SHA / id 1~2 개) 만 남기고 raw payload 는 즉시 discard — context 외화 의무는 driver 책임 self-enforce. cron env (`which gh` exit 1) 에서 sub-agent 환경의 MCP grant unknown 으로 인한 책임 분담 backbone.

---

## 5. HITL (Human-In-The-Loop) 정책 — "균형"

자동 진행하는 것 / 사람에게 물어야 하는 것을 명확히 한다.

### 자동 진행 (notifier 호출 안 함)
- PLAN.md에 이미 들어있는 phase·task의 정상 진행
- bug fix, refactor, test 추가, 문서 갱신
- 이미 결정된 stack/library 내에서의 신규 모듈 작성
- ADR-NN로 이미 결정된 사항의 구현

### BLOCKED 처리 (notifier 호출 후 종료)
- **새 외부 dependency 추가** (package.json에 새 패키지 / 새 외부 서비스 호출)
- **기존 ADR과 충돌하는 architecture 변경**
- **DB schema 변경** (data migration 필요)
- **Security/auth 관련 변경** (인증 흐름, secret 처리, 권한 모델)
- **외부 자격증명 필요** (GitHub token, Confluence token, LLM API key)
- **Review round 7 초과** (README 116행)
- **CI가 같은 사유로 3회 연속 fail**
- **요구사항 ambiguity** (README 해석이 갈리는 지점)

BLOCKED는 죄가 아니다. 막혔으면 깔끔하게 멈춰서 사람에게 넘긴다.

---

## 6. 파일 맵 (어디에 무엇이 있나)

```
README.md                          요구사항 명세 (불변에 가까움)
CLAUDE.md                          이 문서 — 행동 규칙
docs/
  PLAN.md                          마스터 플랜 (phase, milestone, 의존성)
  STATE.json                       머신리더블 상태
  LOOP.md                          /loop, schedule 실행 지침
  use-cases/UC-NN-*.md             각 use case
  architecture/                    overview, modules, api, data-model, directory
  decisions/ADR-NN-*.md            아키텍처 의사결정 기록
  tasks/T-NNNN-*.md                개별 task 정의서
  progress/journal-YYYY-MM-DD.md   일일 작업 로그
.claude/
  agents/<role>.md                 sub-agent 정의
  settings.json                    권한 / hook
src/                               NestJS backend
web/                               (P6) Frontend
.github/workflows/                 CI
```

---

## 7. Context 절약 규칙

Long-horizon으로 살아남는 핵심.

1. **광범위 read 금지**: `src/` 전체 read·grep 대신 `docs/architecture/modules.md` 인덱스를 먼저 읽고 필요한 파일만 read.
2. **Sub-agent에 위임**: 큰 read·search·implement는 메인 context에 넣지 말고 sub-agent로 분리.
3. **결정은 ADR로**: 같은 결정을 두 번 추론하지 않도록 ADR에 적는다. 다음에는 ADR 1개만 읽으면 됨.
4. **journal은 5줄 이내**: 길게 쓰지 않는다. 무엇을 했는지·다음에 무엇을 할지·blocker만.
5. **task 파일은 self-contained**: task 정의서 안에 Required Reading, Acceptance Criteria, Out-of-Scope를 명시. sub-agent가 그 파일만 읽고 일할 수 있어야 함.

---

## 8. 도구 사용

- **Bash**: 빌드/테스트/git/gh. 광범위 file 탐색에는 쓰지 않는다 (Glob/Grep 사용).
- **Read/Edit/Write**: 파일 작업의 기본.
- **Glob/Grep**: 코드 탐색.
- **Agent(sub-agent)**: §4 표 참조.
- **WebFetch/WebSearch**: 외부 docs 참조 시. architect만 자유롭게 씀.
- **git push --force, secret 접근, 외부 서비스 변경**: 금지. 필요 시 BLOCKED.

---

## 9. 안전장치

- 절대 `git push --force`, `git reset --hard origin/...`를 수행하지 않는다.
- secret(API key, token)은 코드·journal·task 파일에 절대 적지 않는다.
- 새 dependency 추가는 BLOCKED. 사용자 승인 후 ADR 작성 → 추가.
- 어떤 turn에서도 commit 없이 push하지 않는다.
- **STATE 단일 writer 원칙**: `docs/STATE.json`, `docs/progress/journal-*.md`, `STATE.counters.*` 는 **driver와 planner와 notifier만** write할 수 있다. architect / implementer / tester / reviewer / integrator / executor 는 read는 자유지만 write 금지. 이는 단순 약속이 아니라 race 방지의 핵심이다 — write 권한 있는 액터가 적을수록 충돌 표면이 작아진다.
- **Counters는 read-modify-write 방식**: `tasksCompleted` 등 누적 카운터를 갱신할 때 driver는 항상 최신 origin/main의 STATE를 fetch한 직후의 값을 base로 +1 한다. 절대값 덮어쓰기 금지.

---

## 10. Long-horizon 실행 모드

각 turn을 **fresh process / fresh conversation** 으로 실행해야 driver conversation 자체의 누적이 일어나지 않는다. 우선순위:

1. **`/schedule` cron routine (주력)** — 매 발화가 새 conversation. 가장 견고. KST 02:00·14:00 권장. [docs/LOOP.md](docs/LOOP.md) §3.
2. **`claude -p "..."` headless** — GitHub Actions 또는 외부 cron에서 호출 가능. 매 invocation fresh. (P6 phase에서 셋업)
3. **`/loop` dynamic pacing (보조)** — 사용자가 옆에 있을 때 **5~10 turn** 모니터링·디버깅용. **무한 long-horizon용 아님**.

**ScheduleWakeup 의 검증된 동작 (공식 사실)**: `ScheduleWakeup` 은 같은 conversation 의 새 turn 으로 wake 한다 — 새 conversation 으로 분리하지 않는다 ([scheduled-tasks.md](https://code.claude.com/docs/en/scheduled-tasks.md): "Tasks are session-scoped: they live in the current conversation"). 따라서 같은 conversation 안에서 turn 이 누적되어 context 가 자란다.

**자동 cleanup 메커니즘 부재**: Hook 에서 `/clear` 또는 `/compact` 호출 불가 ([hooks.md](https://code.claude.com/docs/en/hooks.md): hook 은 shell/HTTP/MCP/prompt/agent 만 가능). `ScheduleWakeup` 에 fresh-conversation 옵션 없음. **그래서 /loop dynamic 은 본질적으로 short-sprint 도구**.

이를 완화하기 위해 [docs/LOOP.md](docs/LOOP.md) §1 [8] (e) 에 **10-turn cap** 룰을 두어, cap 도달 시 driver 가 자체적으로 종료하고 사용자에게 `/compact` 또는 `/clear` 후 새 `/loop` 시작을 안내한다.

dynamic mode 에서 driver prompt 가 매 turn 끝에 `ScheduleWakeup` 도구로 자기 자신을 재예약해야 turn 이 이어진다 ([docs/LOOP.md](docs/LOOP.md) §1 step [8]). reschedule 안 하면 1 turn 후 정지.

같은 lock·STATE를 공유하므로 어느 모드든 일관되게 진행된다. **진정한 long-horizon 은 cron (또는 headless) 만이 보장** — 매 발화 새 conversation 으로 자동 cleanup.

### 동시 실행 정책 (race 회피)

본 시스템의 lock은 [ADR-0009](docs/decisions/ADR-0009-strong-ref-cas-lock.md) 에 따라 **전용 ref `refs/locks/driver` 의 `git push --force-with-lease` CAS** 로 동작하는 **강한 mutex**다. ref push 는 서버 측 원자적 연산이라 N 개 기기·진입점이 동시에 push 해도 1개만 lock 을 획득한다 — **여러 기기의 `/loop` + cron 을 동시에 무장(armed)해도 안전**하다(어느 순간에도 활성 driver 는 정확히 1개). 단 아래 read-전-fetch 규율이 전제다. (과거에는 STATE.json 인메모리 lock 의 **약한 mutex** 였고 동시 실행을 정책으로 회피했다 — ADR-0009 가 이를 대체.)

1. **활성 driver 는 항상 1개** — 진입점(cron + 여러 기기 `/loop`)은 여럿 무장해도 되나, ref-CAS 가 직렬화해 한 순간 한 driver 만 작업한다. 나머지는 lock 점유를 보고 즉시 종료(no-op). **각 진입점은 lock 점검·STATE read 전 반드시 `git fetch`** 하고, driver loop 는 origin/main 추적 체크아웃에서만 실행한다(feature-worktree 금지 — LOOP.md §1[1]·§4).
2. **`/schedule` cron 간격 ≥ 평균 task 소요시간 × 2**. 예: task 평균 15분이면 cron 간격 ≥ 30분. 처음엔 2시간 간격으로 시작해 안정화되면 조정.
3. **`/loop` 사용 시간대와 cron 발화 시간대를 분리**. 예: 사용자 `/loop`은 09–18시 주간, cron은 23·02·14시 같은 야간/유휴 시간대.
4. cron이 직전 invocation을 아직 끝내지 못한 상태에서 다음 cron 시점이 오면 — 새 invocation의 driver가 [1] STATE & LOCK 단계에서 holder=cron lock을 발견하고 (60분 이내라면) 즉시 종료한다. 이 동작은 LOOP.md §1·§4가 보장한다.
5. **충돌은 graceful 종료로 흡수** (LOOP.md §4): commit 직전 fetch+rebase, push fail 시 reset+재시도 최대 3회, 그래도 실패하면 BLOCKED. 작업 결과는 working tree에 남으므로 사람이 검토 가능.

규칙 2·3 (cron 간격·시간대 분리)은 **강한 mutex 도입 후에도 권장**이다 — 충돌이 안전하게 흡수되더라도, 무의미한 wake·즉시종료의 비용(LLM/CI)을 줄여준다. 규칙 4·5 의 충돌 흡수 동작은 ref-CAS 가 lock 취득 단계에서 1차 직렬화하고, 그래도 겹치는 콘텐츠 push 는 LOOP.md §4 graceful 종료가 2차로 흡수한다. ADR-0009 가 과거 "multi-operator 환경 필요 시 강한 mutex(별도 ADR)로 전환" 예고를 실제로 구현했다 — multi-machine `/loop` + cron 동시 무장이 본 ref-CAS 위에서 지원된다.

### Branch protection 정책 (자동 merge 보장)

- **main branch protection: 없음으로 시작.** GitHub UI 에서 main 에 어떤 protection rule (review approval required / status check required / linear history 등) 도 설정하지 않는다.
- **자동 merge 권한**: integrator agent 는 reviewer agent 의 VERDICT=APPROVE + CI green + Acceptance Criteria 다 ok 의 3중 게이트가 모두 충족되면 `gh pr merge --squash --delete-branch` 를 즉시 수행한다. 사람 PR 승인 단계 없음.
- **이유**: long-horizon 자동화에는 사람 critical path 가 없어야 한다. reviewer agent 의 review 가 사람의 review 를 대신한다고 본다. README 117–128행이 이 위임을 정당화한다.
- **이슈 발생 시 상향**: reviewer 가 너무 헐겁다고 판단되면 별도 ADR 로 정책 상향 (예: "main 에 status check required 만 추가" 또는 "reviewer 가 일정 조건에서 `gh pr review --approve` 호출"). 그때까지는 본 정책 유지.
- **사용자가 GitHub UI 에서 protection rule 을 켜면**: integrator 가 `gh pr merge` 시 fail → BLOCKED (`protected-branch`) → notifier → 사용자 결정. CLAUDE.md §10 본 단락도 동기 갱신해야 한다.

---

## 11. Commit message agent-trail (long-horizon 외화의 핵심)

driver context를 비우는 가장 강력한 도구. 각 sub-agent의 결과물은 **commit message body 안의 표준 trail section**으로 영속화된다. 나중에 `git log --grep "T-NNNN"` 으로 한 task의 모든 활동을 재구성할 수 있다.

### 표준 포맷

trail의 **헤더와 키(`PLANNER`, `ARCHITECT`, `IMPLEMENTER`, `files`, `loc`, `notes` 등)는 영어로 고정** (grep·자동 파싱·인덱싱 용이). **값과 본문은 한국어** (§12).

```
<type>(<scope>): <subject 한국어> (T-NNNN)

<2~5줄 한국어 사람 친화 요약 — PR/changelog용>

--- agent-trail ---
PLANNER: <한국어 한 줄 — 어느 phase·bullet에서 split>
ARCHITECT: <ADR-NN 링크, 핵심 결정 키워드 한국어 한 줄>   (해당 시)
IMPLEMENTER:
  files: <변경 파일 목록, comma-separated — 경로는 영어 그대로>
  loc: +X/-Y
  notes: <한국어 1~2줄>
TESTER:
  added: <test 파일 목록 또는 "none">
  result: pass | fail(N)
  coverage: <한국어 간단 메모>
INTEGRATOR: pr=<num> round=<n> ci=<pass|fail> [tool=<gh|mcp>]   (pr-mode만; tool 토큰은 선택 — driver 가 어느 path 로 머지했는지 박제, ADR-0005)
ACCEPTANCE:
  - <criterion 본문 한국어>: ok | pending | failed
--- /agent-trail ---

Refs: T-NNNN [, ADR-NN] [, PR-NN]

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

### 규칙

- **trail은 commit message body 안에 인라인**으로 들어간다. 첨부파일이 아니다.
- 해당 task에서 호출되지 않은 sub-agent의 섹션은 **생략**한다. 빈 섹션 두지 않는다.
- 각 sub-agent는 자기 섹션의 본문을 자기 출력의 `TRAIL:` 블록으로 반환한다. driver/executor가 합친다.
- BLOCKED 종료 시에도 trail은 만든다 (`BLOCKER:` 섹션 추가). 그래야 다음 turn이 상황을 안다.
- `notes:` 와 `coverage:` 는 **각각 ≤2줄**. 더 길면 `docs/progress/details/T-NNNN-<step>.md` 로 외화하고 그 경로만 적는다.
- subject 길이 ≤ 70 char (gh/git 표준).
- body 첫 줄과 trail 사이에 빈 줄 1개 필수.

### CI 검증과의 연계

- 모든 commit이 push되면 GitHub Actions가 lint/build/test 자동 실행.
- driver는 push 후 `gh run list --limit 1` 로 latest run을 확인. fail이면 다음 turn에서 BLOCKED. (자세히는 [docs/LOOP.md](docs/LOOP.md) §1)
- direct-mode commit이 main의 CI를 깨면 즉시 다음 turn BLOCKED → 사람 개입.
- pr-mode는 PR check가 fail이면 integrator가 round를 진행하거나 BLOCKED.

---

## 12. 언어 정책 (한국어 우선)

본 프로젝트의 사람-친화 텍스트는 모두 **한국어**로 작성한다. 단, 기계 친화 식별자·헤더·외부 표준 용어는 영어를 유지한다 — grep 가능성, 자동 파싱, 외부 표준과의 호환성을 위해서다.

### 0. 기본 원칙 (최상위)

본 과제의 **기본 소통 언어는 한국어**다. 사람(개발자·사용자)을 향한 모든 발화 — 설명·요약·**질문(기술적 질문 포함)**·알림·리뷰 코멘트 — 는 한국어를 기본으로 한다. 단, **분석 대상이 되는 코드·문서는 한국어·영어 어느 쪽이든 그대로 수용**한다(번역하거나 영어라는 이유로 거부하지 않는다). inbound 가 영어인 issue/PR 에는 그 언어로 답해도 된다. 아래 "한국어로 쓰는 것 / 영어로 유지하는 것" 분류는 이 원칙의 구체화다.

### 한국어로 쓰는 것

- Git **commit message subject**(prefix 뒤)와 **body 전체**
- **Code comments** (`//`, `#`, `/* */`, docstring 본문 등)
- **PR title·description·comment** (reviewer agent의 review 코멘트 포함)
- **문서 본문**: `docs/PLAN.md`, `docs/tasks/T-NNNN-*.md` 본문, `docs/architecture/*.md`, `docs/decisions/ADR-*.md`, `docs/progress/journal-*.md`, ADR 내 Context·Decision·Consequences·Alternatives 본문
- **Agent의 driver-facing SUMMARY 본문**
- **Agent-trail blob의 값(value)과 본문(notes/coverage/details 등)**
- **STATE.json 의 사람-친화 필드 본문**: `humanQuestions[*].summary`, `humanQuestions[*].context`, `humanQuestions[*].options`, `blockers[*].details` 등
- **Task 파일의 Why / Acceptance Criteria 본문 / Out of Scope 본문 / Follow-ups 본문**

### 영어로 유지하는 것

- **Code identifiers** — 변수명, 함수명, 클래스명, 파일명, 디렉토리명, 모듈명, 패키지명
- **Code itself** — 키워드, type 이름, 라이브러리 API, framework convention
- **Commit subject prefix** — `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `(<scope>)` 등 conventional-commit 토큰
- **Trail/JSON 헤더와 키** — `PLANNER`, `IMPLEMENTER`, `files`, `loc`, `notes`, `commitMode`, `status`, `phaseProgress` 등
- **명령어·경로·URL·shell flag** — `git fetch origin main`, `pnpm test`, `docs/STATE.json`, `https://...`, `--squash` 등
- **외부 표준 용어** — HTTP method (GET/POST), status code 이름, OAuth, OWASP, REST, GraphQL, SQL keyword, regex syntax 등
- **Status enum 값** — `PENDING`, `IN_PROGRESS`, `DONE`, `BLOCKED`, `APPROVE`, `REQUEST_CHANGES`, `MERGED` 같이 STATE/trail에 사용하는 enum 토큰
- **고유 식별자** — `T-NNNN`, `ADR-NNNN`, `Q-<id>`, `PR-NN`
- **에러 메시지 reason 카테고리** — `new-dep`, `task-too-large`, `merge-conflict-code`, `push-contention` 등 (기계 분류용 슬러그)

### 혼합이 자연스러운 경우

- "PR open 후 reviewer dispatch" 같이 일부 영어 토큰이 문장 안에 들어와도 OK (technical noun을 한국어로 어색하게 번역하지 않는다).
- 코드 블록(\`\`\`) 안은 코드 그대로 — 한국어 강제 안 함.
- 다른 사람이 영어로 inbound한 PR comment·issue에 답할 때는 그쪽 언어를 따른다.

### 과거와의 호환

- 이미 main에 머지된 영어 commit(부트스트랩 commit 5개)은 **그대로 둔다**. `git push --force` 금지(§9) 와 history 보존 우선.
- 이 §12 적용은 **본 commit 이후 새 commit·새 문서·새 코드부터**.
- 기존 문서를 갱신할 일이 생기면 그 갱신 부분만 한국어로 자연스럽게 다듬는다 (대량 일괄 번역 task는 만들지 않는다 — long-horizon 비용 낭비).

### 적용 검증

- reviewer agent는 PR 변경 중 새로 추가된 commit·comment·문서가 §12를 따르는지 함께 점검한다.
- 위반 발견 시 MINOR finding으로 분류 (BLOCKER 아님 — 의사소통은 가능하므로).
- code comment 한국어 작성으로 폰트/렌더링 이슈 등 실용적 문제 발견 시 ADR로 정책 재조정.

---

이 문서는 자주 갱신되지 않는다. 갱신이 필요한 변경은 PR로 따로 제안한다.
