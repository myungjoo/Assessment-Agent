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

[4] COMMIT MODE 분기 (충돌-안전 push)
- executor STATUS가 BLOCKED면 notifier sub-agent를 호출한다.
  notifier가 STATE.humanQuestions를 갱신하고 BLOCKER trail을 반환한다.
- 모든 commit·push는 다음 충돌-안전 절차를 따른다 (§4 graceful 종료):
  (i)   git add <변경 파일들> && git commit -m "<message with trail>"
  (ii)  git fetch origin <target>      # direct→main, pr→해당 feature branch
  (iii) target이 origin보다 뒤져있으면 git rebase origin/<target> 시도
        - rebase OK → (iv)
        - STATE/journal text conflict → driver가 base를 origin 값으로 채택하고
          자기 변경(특히 counters: origin+1)을 재적용 후 commit. (iv)
        - 코드 영역 conflict (src/, web/, test/) → BLOCKED, reason=merge-conflict-code
  (iv)  git push origin HEAD:<target>
        - 성공 → 종료, [5] CI 검증으로
        - reject (다른 driver가 그 사이 push) → 재시도 카운터 +1, (ii)로 돌아감
        - 3회 reject 후에도 실패 → git stash 후 BLOCKED, reason=push-contention
- DONE이고 task.commitMode == "direct":
    target=main. 위 (i)~(iv) 따라 main에 push.
- DONE이고 task.commitMode == "pr":
    target=claude/<TaskID>-<slug> (없으면 main에서 새로 생성).
    위 (i)~(iv) 따라 feature branch에 push.
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

[7] 종료 요약
- 종료 한 줄 요약을 사용자에게 출력:
    "turn end — T-NNNN <STATUS>; next: <STATE.nextTask or 'planner needed'>;
     ci: <ok|fail|pending>; blockers: <count>"

[8] DYNAMIC SELF-RESCHEDULE (오직 /loop dynamic mode일 때)
- ScheduleWakeup 도구가 가용한지 확인.
  - 없으면 (schedule cron 또는 headless 모드) 이 단계 skip. 그냥 종료.
  - 있으면 아래 조건 평가:
- Reschedule 하지 않는 조건 (어느 하나라도 해당 시 호출 안 함 → loop 종료):
  (a) STATE.humanQuestions 에 resolvedAt 없는 항목이 1개 이상
  (b) 이번 turn STATUS = BLOCKED
  (c) STATE.ci.consecutiveFails >= 3
  (d) PLAN.md 의 마지막 phase 마지막 bullet까지 done (시스템 완성)
- 그 외에는 ScheduleWakeup 호출:
    delaySeconds: 1200 (기본 20분).
      - 직전 turn이 CI in_progress 였다면 270 (cache 안에서 재확인).
      - 직전 turn에 새 task 생성만 했고 다음 turn이 즉시 가용하다면 60.
    prompt: 사용자가 처음 /loop에 넣었던 그 prompt 문자열 그대로
            (ScheduleWakeup 도구 설명 참조: 같은 /loop input을 verbatim).
    reason: 한 줄, 구체적으로
            (예: "T-0001 in PR review round 1; check next CI run").
- 다음 task 자동 진입(현 turn에서 두 번째 task 시작)은 금지. ScheduleWakeup은
  *다음* turn 예약일 뿐이다.
```

driver 자신은 이 prompt 외에 절대 추가 read·grep를 하지 않는다. 모든 본문 read는 executor가 한다.

---

## 2. /loop 사용법 (사용자 대면)

### Dynamic mode (권장 일반 사용)

대화창에 한 번 입력:

```
/loop Assessment-Agent long-horizon driver를 1 turn 수행해라.
docs/LOOP.md §1 표준 prompt를 그대로 따른다.
```

이 dynamic mode에서는 §1 step [8]에 의해 driver가 매 turn 끝에 `ScheduleWakeup`을 호출하여 자기 자신을 재예약한다. **BLOCKED·humanQuestion이 없는 한 무한 진행**한다. 기본 간격 1200초 (20분), CI 대기 중이면 270초, 즉시 진행 가능하면 60초.

### Interval mode (간단한 강제 주기)

```
/loop 30m Assessment-Agent long-horizon driver를 1 turn 수행해라.
docs/LOOP.md §1 표준 prompt를 그대로 따른다.
```

→ loop skill이 30분마다 강제로 1 turn 실행. dynamic mode의 self-reschedule 로직(§1 [8])은 작동하지 않아도 무방하지만, 매 발화가 같은 conversation에 누적되는 점은 dynamic과 동일.

### Dynamic vs Interval 선택 가이드

- **Dynamic**: turn 사이 간격이 작업 종류에 따라 가변적이어도 OK일 때. CI 대기 중엔 짧게, 정상 진행 중엔 길게 자동 조정.
- **Interval**: 단순·예측 가능한 주기가 필요할 때.

**중지**: 사용자가 대화창에서 다른 prompt를 입력하거나 ESC.

### 주의: /loop의 한계

같은 conversation 안에서 turn이 쌓이므로 conversation context는 결국 자란다. driver와 executor의 누적이 잘 차단되어 있어도 conversation 외피는 자란다 (CLAUDE.md §10). 따라서:

- **수십 turn 이상**의 진행에는 `/schedule` cron (§3)을 사용한다.
- `/loop`은 사용자가 옆에서 5~20 turn 모니터링·디버깅할 때 적절.
- 둘을 **병행** 가능: cron이 야간/주말 백그라운드 backbone, `/loop`은 주간 모니터링.

---

## 3. schedule (cron) 사용법 (백그라운드)

`/schedule` skill로 cron routine을 등록한다. **매 발화가 새 conversation으로 시작**되므로 진정한 long-horizon에 적합 (CLAUDE.md §10).

### 등록 방법

대화창에서 다음과 같이 invoke:

```
/schedule
```

또는 자연어로:

```
/schedule 매일 KST 02:00과 14:00에 routine 등록. 이름은
assessment-agent-driver. prompt는 docs/LOOP.md §1 표준 prompt 전체.
cwd는 이 저장소.
```

또는 더 구체적으로 cron 식으로:

- cron: `0 17,5 * * *` (UTC; KST 02:00·14:00)
- 또는 시작 시점: `0 */3 * * *` (3시간마다)

권장: **하루 2~4회**. 너무 자주 돌리면 CI 비용·LLM 비용이 누적되고, 너무 드물면 진척이 느림. 처음 1~2주는 2회로 시작해 phase 진척 상황 보고 조정.

### routine prompt 본문

routine의 prompt 필드에는 docs/LOOP.md §1의 driver prompt 전체를 넣는다 (또는 줄여서):

```
Assessment-Agent long-horizon driver를 1 turn 수행한다.
docs/LOOP.md §1 표준 prompt를 그대로 따른다.
이 invocation은 schedule cron 발화이므로 [8] DYNAMIC RESCHEDULE는 skip한다.
```

마지막 한 줄을 추가해 두면 ScheduleWakeup이 잘못 호출되는 일을 막을 수 있다 (cron 모드에서 또 dynamic reschedule을 하면 두 메커니즘이 겹친다).

### Lock과 충돌 방지

schedule 측은 lock holder를 `"cron"` 으로 잡는다. `/loop`("loop")과 cron("cron")이 동시에 깨어나도 §4 lock 규약에 의해 한쪽만 진행한다.

### 관리

- 목록: `/schedule list`
- 일시 중지: `/schedule disable <id>` 또는 cron을 비활성화하는 prompt
- 삭제: `/schedule delete <id>`
- 한 번만 실행: `/schedule 내일 오전 10시에 한 번만 driver turn 실행` 같이 one-shot도 가능

### 첫 등록 시 권장 절차

1. 부트스트랩 후 사용자가 `/loop` dynamic으로 5~10 turn 직접 모니터링하며 driver·executor·sub-agent 동작 확인.
2. T-0001 (NestJS·CI) 완료된 뒤 cron 등록 — CI가 동작해야 routine이 안전.
3. 처음 1주는 매일 사람이 STATE.json·journal 점검. 안정되면 주간 점검.

---

## 4. Lock & 충돌 규약

이 시스템의 lock은 **git push fast-forward 검사에 기대는 약한 mutex** 다. race-free 보장은 아니므로 CLAUDE.md §10 "동시 실행 정책"과 함께 읽어야 한다.

### Lock 형태

```json
"lock": {
  "holder": "loop" | "cron" | "human",
  "session": "<선택 — 사용자가 부여한 식별 문자열, 예: hostname+timestamp>",
  "since": "<ISO 8601>"
}
```

`session` 필드는 같은 holder 카테고리(예: 두 cron) 사이의 구분을 돕는다. driver가 lock 잡을 때 가능하면 채운다.

### 획득 / 해제

- 다른 holder의 lock이 60분 미만이면 → 즉시 종료 (no-op).
- 60분 이상이면 stale로 간주, 탈취 후 작업 시작. 탈취 시 journal에 1줄 기록 (`<HH:MM> driver: stole stale lock from <prev-holder>`).
- 정상 종료·BLOCKED 종료 시 항상 lock 해제. commit으로 영속화.
- 사람이 점검·정지 목적으로 `human` holder lock을 commit으로 박을 수 있다 (수동 일시정지).

### Commit · Push 충돌 처리 (graceful 종료)

driver가 변경을 commit한 후 push할 때 fast-forward fail (다른 driver가 먼저 push)이 일어나면:

1. `git reset --soft HEAD~1` 으로 자기 commit 풀기 (변경은 working tree에 보존).
2. `git fetch origin main && git rebase origin/main` 으로 최신 main 위로 변경 이식 시도.
   - rebase가 자동 성공: 다시 commit + push. 재시도 카운터 +1.
   - rebase가 conflict: STATE.json·journal 같은 단순 textual conflict는 driver가 직접 해결 시도 (origin쪽 값을 base로 자기 변경 다시 적용 — 특히 counters는 origin+1).
   - rebase conflict가 코드 영역(`src/`, `web/`, `test/`)이면: driver는 **건드리지 않고** BLOCKED 처리 (reason: `merge-conflict-code`). 사람이 해결.
3. push 재시도. 총 3회 시도까지 허용.
4. 3회 후에도 push 실패: BLOCKED 처리 (notifier; reason: `push-contention`). working tree의 변경은 stash해서 보존 (`git stash push -m "T-NNNN driver attempt"`).

### worktree 정책

- 모든 driver는 동일 working tree 또는 같은 base branch 기준으로 동작한다. 별도 worktree에서 동시 진행하면 lock의 commit이 즉시 보이지 않을 수 있어 약한 mutex가 깨진다.
- **1 driver = 1 working tree** 를 원칙으로 한다. multi-worktree 환경에서 driver를 동시 가동하지 않는다.

### Single-writer 룰 (STATE/journal/counters)

CLAUDE.md §9의 "STATE 단일 writer 원칙"에 의해 STATE.json·journal·counters를 write할 수 있는 액터는 **driver, planner, notifier 3종 뿐**이다. 그 외 sub-agent는 자기 결과를 trail blob으로만 돌려보낸다. write 표면을 작게 유지하는 것이 충돌 회피의 핵심이다.

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
