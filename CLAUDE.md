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
| Frontend | (T-0001 이후 별도 ADR로 결정 — 기본 후보: React + Vite) |
| DB | (별도 ADR로 결정 — 기본 후보: PostgreSQL via Prisma 또는 TypeORM) |
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
- Commit message: `<type>(<scope>): <subject> (T-NNNN)` — type 예: feat, fix, refactor, test, docs, chore, ci.
- PR 본문에는 반드시 task 파일 링크와 acceptance criteria 체크리스트를 포함한다.

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

---

## 4. Sub-agent dispatch (context 관리 핵심)

메인 에이전트의 context를 비우는 가장 효과적인 도구. 각 sub-agent는 자기만의 fresh context를 받는다.

| Sub-agent | 언제 호출 | 무엇을 받음 | 무엇을 반환 |
| --- | --- | --- | --- |
| `planner` | 다음 task가 정해지지 않았을 때 / task 분할 필요 시 | `STATE.json`, `PLAN.md`, 최근 journal | 새 task 파일 + `STATE.json.nextTask` 갱신 |
| `architect` | 모듈/API/스키마 변경, ADR 필요 | task 정의서 | ADR 1개 + `docs/architecture/` 업데이트 |
| `implementer` | 코드 변경이 필요한 모든 task | task 정의서 + Required Reading 파일 목록 | 코드 변경 (commit 직전 상태) |
| `tester` | implementer 직후, 또는 회귀 검증 필요 시 | 변경된 파일 목록 + task 정의서 | 테스트 코드 + 실행 결과 |
| `reviewer` | PR push 후 (자동 hook 또는 integrator가 호출) | PR 번호 / diff | review 코멘트 (README 117–128행 형식) |
| `integrator` | reviewer 끝난 뒤 | PR 번호 | merge 결정 또는 추가 round 요청 |
| `notifier` | BLOCKED 상태 / review round 7 초과 / 사람 결정 필요 | blocker 설명 | `STATE.json.humanQuestions` 항목 + 종료 |

**규칙**: 메인 에이전트는 가능한 한 빨리 sub-agent에 위임하고 자기 context를 짧게 유지한다. 메인이 직접 코드를 짜는 것은 task가 trivial(≤30 LOC, 단일 파일)할 때만 허용한다.

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
src/                               (T-0001 이후) NestJS backend
web/                               (이후 ADR) Frontend
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

---

이 문서는 자주 갱신되지 않는다. 갱신이 필요한 변경은 PR로 따로 제안한다.
