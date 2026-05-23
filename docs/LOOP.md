# LOOP.md — Long-Horizon Driver 실행 지침

이 문서는 `/loop` (사용자 대면 dynamic-pacing) 와 `schedule` cron routine 둘 다가 사용하는 **단일 진입 prompt** 와 운영 규칙을 정의한다.

자세한 행동 규칙은 [CLAUDE.md](../CLAUDE.md) 참조. 여기는 *어떻게 깨우고 어떻게 멈추는지*만 다룬다.

---

## 1. 표준 Driver Prompt

`/loop` 와 `schedule` 모두 다음 prompt 1개를 그대로 사용한다. **driver는 task 본문을 직접 읽지 않는다.** 모든 task 수행은 `executor` sub-agent가 한다 — driver는 그저 lock·STATE·commit·CI 검증 coordinator일 뿐이다.

```
Assessment-Agent long-horizon driver를 1 turn 수행한다.
이 turn은 fresh process여야 한다 (CLAUDE.md §10).

[1] STATE & LOCK
- CLAUDE.md 미로드라면 읽는다. docs/STATE.json 읽는다.
- state.lock이 다른 holder가 잡고 있고 since < 60분이면 즉시 종료.
- 본인(driver: "loop" 또는 "cron")으로 lock 잡는다 (메모리상, since=현재 ISO).
- 미해결 humanQuestion이 있고 resolvedAt 없는 항목이 1개라도 있으면 즉시 종료
  (사람이 답할 때까지 대기). turn end summary에 그 사실 표기.

[2] 작업 선정
- state.currentTask가 있으면 그것을 그대로 사용한다.
- 없고 state.nextTask가 있으면 currentTask=nextTask, nextTask=null.
- 둘 다 없으면 planner sub-agent를 dispatch한다.
  → planner가 task 1개를 만들고 STATE.nextTask를 갱신해 돌아오면
    아래 [5][6] 단계로 가서 doc-only direct commit으로 마무리하고 종료.

[3] EXECUTOR 호출
- task 파일은 driver가 읽지 않는다. taskId만 executor에게 전달한다.
- executor sub-agent를 1회 호출.
- executor 반환 형태: SUMMARY (≤200 chars) + TRAIL blob + STATUS.
- driver context에는 이 두 덩어리만 들어온다. 그 외 sub-agent 출력은
  executor 안에서 흡수되어 driver 메모리에 안 남는다.

[4] COMMIT MODE 분기
- executor STATUS가 BLOCKED면 notifier sub-agent를 호출한다.
  notifier가 STATE.humanQuestions를 갱신하고 BLOCKER trail을 반환한다.
- DONE이고 task.commitMode == "direct":
    main 브랜치에서 git add + commit (메시지 본문에 executor TRAIL blob 포함,
    CLAUDE.md §11 포맷). 즉시 git push origin main.
- DONE이고 task.commitMode == "pr":
    feature branch (claude/<TaskID>-<slug>)에서 git add + commit
    (메시지 본문에 executor TRAIL blob 포함). git push -u origin <branch>.
    이어서 integrator sub-agent 호출 (PR open + reviewer dispatch + 결과 판정).
    integrator 반환에 따라:
      MERGED → INTEGRATOR trail을 merge commit 메시지에 포함시켜 머지 (이미 됨).
      ANOTHER_ROUND → STATE.reviewRounds++; executor 재호출은 다음 turn으로 미룬다.
      BLOCKED → notifier 호출.

[5] CI 검증 (push 직후)
- .github/workflows/ 디렉토리가 비어있으면 (T-0001 완료 전 부트스트랩 구간)
  이 단계를 skip하고 STATE.ci.status="not-yet-configured" 로만 표기.
- 그 외:
  gh run list --limit 1 --json status,conclusion,headSha 으로 latest run 확인.
  - in_progress: STATE.ci.lastRun=ISO, status="running" 표기. 다음 turn에서 재확인.
  - failure: STATE.ci.consecutiveFails++. 3 이상이면 BLOCKED 처리 (notifier).
    그렇지 않으면 CI 결과 SUMMARY에 표기하고 다음 turn에서 재시도.
  - success: STATE.ci.consecutiveFails=0, STATE.ci.lastRun=ISO, status="green".
- gh CLI 인증 실패 시: BLOCKED (reason: credential, "gh auth required").

[6] STATE & JOURNAL 갱신
- task 파일 frontmatter status: DONE / BLOCKED.
- STATE.currentTask = null (DONE인 경우), counters.tasksCompleted 또는 tasksBlocked++.
- mostRecentTasks 배열에 taskId prepend, 길이 5 cap.
- docs/progress/journal-<YYYY-MM-DD>.md 에 한 줄 append:
    "<HH:MM> driver: T-NNNN <STATUS> — <SUMMARY 첫 100 chars>"
- STATE.lock = null. STATE.lastActivity = ISO.
- 이 STATE/journal/task-file 변경은 doc-only이므로 main에 direct commit해도 무방.
  단, pr-mode task의 본 commit과는 별도 commit으로 분리한다
  (한 commit = 한 주제 원칙 보존).

[7] 종료
- 종료 한 줄 요약을 사용자에게 출력:
    "turn end — T-NNNN <STATUS>; next: <STATE.nextTask or 'planner needed'>;
     ci: <ok|fail|pending>; blockers: <count>"
- 다음 task 자동 진입 금지. 다음 turn까지 대기.
```

driver 자신은 이 prompt 외에 절대 추가 read·grep를 하지 않는다. 모든 본문 read는 executor가 한다.

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
