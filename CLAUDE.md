# CLAUDE.md — Assessment-Agent Long-Horizon Driver

이 문서는 모든 conversation에 자동 로드되며, Claude Code(이하 "에이전트")가 본 저장소에서 행동할 때의 **불변 규칙**이다.
요구사항·기능 명세는 [README.md](README.md)에 있다. 이 문서는 *어떻게 일할지*만 정한다.

---

## 0. 미션

[README.md](README.md)에 명세된 Assessment-Agent를 **실사용 가능한 수준**까지 완성한다. 단, 사람이 매 step을 지시하지 않는다. 에이전트가 PLAN을 스스로 관리하고, 진도를 추적하며, context 한계를 넘지 않도록 작은 task 단위로 자기 자신을 분할해 진행한다.

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

---

## 3. Task / Commit / PR 원칙

- **1 task = 1 commit** (README 109행). PR 사용 여부는 아래 commit mode를 따른다.
- **Task 크기 상한**: diff ≤ 300 LOC, 변경 파일 ≤ 5개. 초과 예상 시 planner가 task를 split한다.
- 한 task 작업 중 다른 주제(linter 의견, 보이는 버그 등)가 보여도 **즉시 고치지 않는다**. planner에게 follow-up task 생성을 요청하거나 task 파일의 `Follow-ups` 섹션에 적어둔다.
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
  4. negative test 1+ (예: 권한 없음, 빈 입력, 경계값)
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
| `reviewer` | integrator | PR push 후 + 매 ANOTHER_ROUND 마다 | PR 번호 / diff | review 코멘트 (README 117–128행). **반드시 `gh pr comment` 로 PR 에 post** — post 안 하면 BLOCKED (§3.3 게이트 2) |
| `integrator` | driver | pr-mode commit 후 | PR 번호 | merge 결정 (§3.3 4-게이트) / 다음 round 요청 / BLOCKED |
| `notifier` | driver | executor가 STATUS=BLOCKED 반환 또는 review round 7 초과 | blocker 설명 | `STATE.json.humanQuestions` 항목 + 종료 |

**Driver context 누적 방지 룰**:

1. driver는 task 본문을 직접 읽지 않는다. executor가 읽는다.
2. driver는 ADR, 코드, 테스트 결과를 직접 보지 않는다. trail section을 commit message로 그대로 흘려보낸다.
3. driver는 어떤 sub-agent의 long output도 자기 conversation으로 받지 않는다. 받는 건 SUMMARY + TRAIL blob 두 덩어리뿐.
4. 호출 chain은 최대 2단계: **driver → executor → {architect, implementer, tester}**. 3단계 chain 금지.

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

본 시스템의 lock은 git push의 fast-forward 검사에 기대는 **약한 mutex**다. 진짜 동시 실행은 정책으로 회피한다.

1. **`/loop` dynamic mode는 동시에 1개 세션만**. 두 conversation을 동시에 띄우지 않는다.
2. **`/schedule` cron 간격 ≥ 평균 task 소요시간 × 2**. 예: task 평균 15분이면 cron 간격 ≥ 30분. 처음엔 2시간 간격으로 시작해 안정화되면 조정.
3. **`/loop` 사용 시간대와 cron 발화 시간대를 분리**. 예: 사용자 `/loop`은 09–18시 주간, cron은 23·02·14시 같은 야간/유휴 시간대.
4. cron이 직전 invocation을 아직 끝내지 못한 상태에서 다음 cron 시점이 오면 — 새 invocation의 driver가 [1] STATE & LOCK 단계에서 holder=cron lock을 발견하고 (60분 이내라면) 즉시 종료한다. 이 동작은 LOOP.md §1·§4가 보장한다.
5. **충돌은 graceful 종료로 흡수** (LOOP.md §4): commit 직전 fetch+rebase, push fail 시 reset+재시도 최대 3회, 그래도 실패하면 BLOCKED. 작업 결과는 working tree에 남으므로 사람이 검토 가능.

이 5개 규칙이 지켜지면 single-operator 환경에서 race는 사실상 일어나지 않는다. 다운라이저/multi-operator 환경이 필요해지면 lock-acquire를 별도 atomic git commit으로 분리하는 강한 mutex(별도 ADR 필요)로 전환한다.

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
INTEGRATOR: pr=<num> round=<n> ci=<pass|fail>   (pr-mode만)
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
