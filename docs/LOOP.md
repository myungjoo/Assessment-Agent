# LOOP.md — Long-Horizon Driver 실행 지침

이 문서는 `/loop` (사용자 대면 dynamic-pacing) 와 `schedule` cron routine 둘 다가 사용하는 **단일 진입 prompt** 와 운영 규칙을 정의한다.

자세한 행동 규칙은 [CLAUDE.md](../CLAUDE.md) 참조. 여기는 *어떻게 깨우고 어떻게 멈추는지*만 다룬다.

---

## 1. 표준 Driver Prompt

`/loop` 와 `schedule` 모두 다음 prompt 1개를 그대로 사용한다.

```
Assessment-Agent long-horizon driver를 1 turn 수행한다.

1. CLAUDE.md를 읽지 않았다면 읽는다. 절대 규칙이다.
2. docs/STATE.json을 읽는다.
3. state.lock이 비어있지 않고 holder가 본인(driver: "loop" 또는 "cron")이 아니며
   since로부터 60분이 지나지 않았다면 즉시 종료한다.
4. state.lock을 본인 holder로 설정하고 (since=현재 ISO) commit 없이 메모리상에서 잡는다.
5. 작업 선정:
   - state.currentTask가 있으면 그 task를 이어 수행한다.
   - 없고 state.nextTask가 있으면 state.currentTask = state.nextTask로 옮기고
     state.nextTask = null로 둔다.
   - 둘 다 없으면 planner sub-agent를 dispatch하여 다음 task 1개를 생성한 뒤,
     아래 6단계 commit·해제를 수행하고 종료한다.
6. task 수행:
   - docs/tasks/<currentTask>.md 를 읽는다.
   - frontmatter commitMode 확인 (direct | pr). 누락 시 BLOCKED — planner 재호출.
   - Required Reading 외 광범위 read 금지.
   - commitMode == "pr" 이면 작업 시작 전에 feature branch (claude/<TaskID>-<slug>) 로 이동
     하거나 새로 만든다. commitMode == "direct" 이면 main에서 작업.
   - Suggested Sub-agents 순서대로 dispatch한다.
   - 어느 단계에서든 BLOCKED 신호가 오면 notifier를 즉시 dispatch한다.
7. 완료 처리:
   - task 파일 frontmatter status: DONE (또는 IN_PROGRESS, BLOCKED).
   - state.currentTask = null (DONE인 경우), counters.tasksCompleted++.
   - docs/progress/journal-<YYYY-MM-DD>.md 에 1~5줄 append.
   - state.lock = null.
   - state.lastActivity = ISO 현재, state.lastCommit = (commit 이후 추가)
8. 단일 commit으로 묶어 commit (CLAUDE.md §3). 메시지: <type>(<scope>): <subject> (T-NNNN).
   commitMode 별 후처리:
   - direct: main 브랜치에서 작업 중이므로 commit 후 즉시 git push origin main.
     PR 생성·reviewer dispatch 안 함.
   - pr: feature branch 에 commit 후 git push -u origin <branch>. 이어서 integrator
     sub-agent를 dispatch (PR open, reviewer 호출, 합의·merge 또는 round 진행).
     integrator가 BLOCKED 또는 round 미합의를 반환하면 notifier로.
9. 종료. 다음 task로 자동 진입 금지.

종료 시 한 줄 요약을 사용자에게 보여라:
"turn end — <T-NNNN status>; next: <state.nextTask or 'planner needed'>".
```

---

## 2. /loop 사용법 (사용자 대면)

대화창에서 한 번만 실행:

```
/loop
```

interval 없이 dynamic pacing 으로 시작하면 driver가 1 turn 끝나고 자기 pacing으로 다음 turn 시작 시점을 결정한다 (보통 즉시).

interval 지정 가능:

```
/loop 30m
```

→ 30분마다 1 turn. 사용자가 자리에 있으나 turn 사이에 코드 리뷰를 할 시간이 필요할 때.

**중지**: 사용자가 대화창에서 다른 prompt를 입력하거나 ESC.

---

## 3. schedule (cron) 사용법 (백그라운드)

[/schedule](https://docs.claude.com/) 로 routine을 등록. 예시 (KST 02:00, 14:00):

```
/schedule
  name: assessment-agent-driver
  cron: "0 17,5 * * *"   # UTC; KST 02:00, 14:00
  prompt: <위 §1의 표준 prompt 전체>
  cwd: <이 저장소 경로>
```

schedule 측은 `driver: "cron"` 으로 lock holder를 잡는다. `/loop`와 cron이 동시에 깨어나도 lock으로 한 쪽만 진행한다.

**중지**: `/schedule list` → `/schedule delete <id>` 또는 disable.

---

## 4. Lock & 충돌 규약

- `state.lock = {"holder": "loop" | "cron", "since": "<ISO>"}`
- 다른 holder의 lock이 60분 미만이면 → 즉시 종료 (no-op)
- 60분 이상이면 stale로 간주, 탈취 후 작업 시작. 탈취 시 journal에 1줄 기록.
- 정상 종료 또는 BLOCKED 종료 시 항상 lock 해제. commit으로 영속화.
- worktree 충돌 방지: 모든 driver가 동일 working tree 또는 동일 base branch 기준으로 동작해야 한다. 별도 worktree에서 동시 진행 시 lock이 무용지물이 되므로 1개 working tree 사용을 원칙으로 한다.

---

## 5. 사람이 개입해야 할 때

`STATE.json.humanQuestions` 에 미해결 항목이 있으면 driver는 새 task 시작을 멈춘다. 사용자는:

1. 질문 읽기: `docs/STATE.json` 의 `humanQuestions` 배열 확인 (또는 최근 journal 줄).
2. 답: 해당 항목에 `resolvedAt: <ISO>`, `decision: "<답>"` 를 추가하고 commit.
3. 다음 driver turn (혹은 `/loop`)이 자동으로 unblock된 task를 진행.

질문 해소는 그 자체로도 1 turn에 해당하는 의사결정 → 가능하면 ADR로도 박제될 수 있도록 planner가 follow-up task를 만든다.

---

## 6. 정지·재개

- **일시 정지**: `STATE.json.lock` 에 `{"holder": "human", "since": "<ISO>"}` 를 commit. driver는 lock holder가 다르면 즉시 종료하므로 멈춘다.
- **재개**: lock을 `null`로 되돌리고 commit → 다음 turn 정상 진행.

---

## 7. Observability

- 매 turn 후 last journal entry 와 `state.lastActivity`, `state.counters` 로 진척을 확인.
- 누적 진척: `git log --oneline | grep "T-"` 로 완료된 task 목록 확인.
- CI 상태: `gh run list --limit 5`.
