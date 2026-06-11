# LOOP.md — Long-Horizon Driver 실행 지침

이 문서는 `/loop` (사용자 대면 dynamic-pacing) 와 `schedule` cron routine 둘 다가 사용하는 **단일 진입 prompt** 와 운영 규칙을 정의한다.

자세한 행동 규칙은 [CLAUDE.md](../CLAUDE.md) 참조. 여기는 *어떻게 깨우고 어떻게 멈추는지*만 다룬다.

---

## 1. 표준 Driver Prompt

`/loop` 와 `schedule` 모두 다음 prompt 1개를 그대로 사용한다. **driver는 task 본문을 직접 읽지 않는다.** 모든 task 수행은 `executor` sub-agent가 한다 — driver는 그저 lock·STATE·commit·CI 검증 coordinator일 뿐이다.

```
Assessment-Agent long-horizon driver를 1 turn 수행한다.
이 turn은 fresh process여야 한다 (CLAUDE.md §10).

[1] STATE & LOCK  (branch-lock CAS — ADR-0028, ADR-0009 invariant 보존)
- **read 전 fetch 의무**: 가장 먼저
  `git fetch origin main +refs/heads/claude/lock-driver:refs/remotes/origin/claude/lock-driver`.
  - 브랜치 `claude/lock-driver` 미존재(fetch refspec 매칭 0) → lock 비어있음(free)으로 간주.
  - driver loop 는 **origin/main 을 추적하는 체크아웃에서만** 실행한다.
    feature-branch worktree(`.claude/worktrees/*`)나 origin/main 보다 뒤처진
    클론에서 깨어났으면 STATE/lock 을 stale 하게 읽어 무위 종료·오작동하므로
    **즉시 종료**(reason: `stale-worktree`). 이는 ADR-0009 Context 사고 1 의 차단책.
- CLAUDE.md 미로드라면 읽는다. fetch 직후 docs/STATE.json 읽는다.
- **lock 획득 (`claude/lock-driver` 브랜치 commit-ref CAS)**: 브랜치 tip commit 의 `lock.json` 을 본다(미존재면 free).
  - 다른 holder 가 점유 & since < 60분 → 즉시 종료(no-op).
  - 비어있음(브랜치 미존재 또는 tip 이 tombstone `{"holder":null}`) 또는 stale(since ≥ 60분) → 본인 `lock.json` 담은 commit 생성 후
    `git push origin <new-commit>:refs/heads/claude/lock-driver --force-with-lease=refs/heads/claude/lock-driver:<observed-old-sha>`
    (브랜치 미존재 시 `<observed-old-sha>` = `0{40}` zero-sha CAS — "브랜치 생성").
    - 성공 → 획득. (stale 탈취였다면 journal 1줄: `stole stale lock from <prev>`.)
    - reject → 경쟁 패배. 재 fetch → 여전히 held 면 즉시 종료(no-op).
  - `lock.json` 스키마 = `{ "holder": "loop"|"cron"|"human", "session": "<holder>@<host>-<rand>"(필수), "since": "<ISO>" }` (ADR-0009 schema 불변).
    STATE.json.lock 은 **비권위 human mirror** — bookkeeping commit 시 동기해도 되나 상호배제 권위는 브랜치 tip `lock.json` 뿐.
- **cutover 메모 (ADR-0028)**: lock 저장소가 옛 blob ref `refs/locks/driver` → `claude/lock-driver` 브랜치로 이전됐다(cron@cloud 의 `claude/*` push 만으로 credential 0 자율 lock — proxy 403 해소). **효력은 다음 fresh session / fresh cron fire 부터** — 진행 중인 session 의 mid-turn 에 적용 않는다. 옛 ref 와 새 브랜치를 **병행 권위로 운영 금지**(ADR-0028 Decision (5)). 활성 driver 는 항상 1개(CLAUDE.md §10)이므로, 옛 ref 로 시작한 session 은 그대로 끝나고 다음 fresh 진입점만 새 브랜치를 본다 — 두 프로토콜이 같은 critical section 을 경쟁하는 window 없음(split-brain 부재). 옛 blob ref 는 60분 후 stale 방치(누구도 더 안 읽음, 별도 정리 불요).
- **모든 진입점 lock CAS 무조건 선행 의무 (ADR-0034 흡수 — #246/#247 중복-PR 사고 차단)**: cron · 로컬 `/loop` · cloud `/loop` · headless 어느 진입점이든, **작업(executor 호출 / commit / PR 생성)을 시작하기 전에 위 권위 `claude/lock-driver` CAS 획득을 반드시 시도**한다. lock 을 "mirror 만 쓰고 진행"(권위 ref 미변경, STATE.json.lock mirror 만 동기) 하는 경로는 **금지**다.
  - **`gh 부재` · `main 직접 push 불가` 는 lock-skip 근거가 아니다**: lock CAS 는 `gh` 가 아니라 raw `git push … --force-with-lease` 로 수행하므로 `gh` 비의존이고, lock 저장소는 `claude/lock-driver`(허용 prefix)이며 **main 이 아니다** → main push 차단과 무관. 두 제약은 pr-mode stand-down 판정(gh·MCP 둘 다 부재 시 pr-mode task no-op)에는 영향을 주나 lock 획득 자체는 면제하지 않는다. (사고 근본 원인: 2026-06-09 cloud `/loop` 세션이 이 두 제약을 lock-skip 근거로 잘못 결부해 권위 CAS 를 시도조차 않고 feature branch + draft PR 로 격리 진행 → #246/#247 중복 PR. ADR-0034 §Context.)
- session 기반 loopSessionTurnCount 처리:
  - 직전 lock blob 의 `session` 과 본 wake 의 session 이 **같으면**
    (ScheduleWakeup 연속 wake) → loopSessionTurnCount = (직전 값) + 1, loopSessionStartedAt 유지.
  - session 이 **다르면**(새 /loop session, 또는 기기 이동 — host 가 다른 새 session)
    → loopSessionTurnCount = 1, loopSessionStartedAt = 현재 ISO.
- 미해결 humanQuestion이 있고 resolvedAt 없는 항목이 1개라도 있으면 즉시 종료
  (사람이 답할 때까지 대기). turn end summary에 그 사실 표기.

[2] 작업 선정 + (PR 미완료) Resume 판정
- **claim-pickup 분기 (오직 flags.fineGrainedConcurrency == true 일 때 — ADR-0036 stage3)**:
    STATE.flags.fineGrainedConcurrency 가 `true` 면 단일-task pickup 대신
    claim 기반 N-driver pickup 으로 분기한다(이중 게이트: flag true 가 아니면
    본 sub-step 통째 skip 후 아래 단일-task 경로로). 절차:
    (a) [1] 에서 잡은 lock(critical section) 보유 상태에서 회수 우선 점검:
        server-time(GitHub API `Date` 헤더 / `gh run` UTC)을 확보해
        `RECLAIM_NOW=<server-time> scripts/reclaim-stale-claim.sh <self-session>`
        를 호출, orphan claim 회수 + PR-resume 신호를 받는다(server-time now
        주입 계약 — 아래 별도 단락). `RESUME prNumber=<n> taskId=<T-X>` stdout
        신호가 있으면 그 task 를 currentTask 로 삼고 **새 PR 생성 대신 본 [2]
        의 PR Resume 판정**(아래 a~f 재사용)으로 분기한다.
    (b) 회수 후 `scripts/select-claim.sh <self-session> <claimable 후보…>` 로
        **첫 claimable task 1개를 select+claim** 한다 — claim append + lock
        tombstone CAS push 가 **같은 commit** 이라 claim 박제 즉시 lock release
        (critical section 종료). claim 성공 = 그 taskId 를 currentTask 로 삼는다.
    (c) claim 박제 후에는 **lock-free 로** [3] EXECUTOR 호출 → implement/test 를
        진행한다(lock 점유 0 — 다른 driver 가 disjoint task 를 동시 claim 가능).
    (d) select-claim 이 non-zero(claimable 부재 — 후보 전부 이미 claimed)면
        **no-op 종료**(다른 driver 가 가용 task 를 모두 소유 중 — 이번 fire 는 진행 없음).
    **토글 OFF(현 상태, flags.fineGrainedConcurrency=false — T-0326)면 본 분기는
    inert** 다. 아래 단일-task pickup(currentTask/nextTask/planner dispatch) 경로가
    그대로 현행 동작이며, claim-pickup 은 토글 ON(stage5) 일 때만 진입한다 —
    forward-looking spec(driver 동작 변경 0). ADR-0036 §Decision 1/§rollout stage3.
- **토글 ON 시 driver 의 stage5 안전장치 의무 (ADR-0036 §Decision 8 — forward-looking, 토글 OFF 동안 inert)**:
    위 (b) 의 select+claim 직전에 driver 는 후보 task 의 `touchesFiles` 가 활성
    claim 보유 task 들의 `touchesFiles` 와 교집합 0 인지, `dependsOn` 전원이
    origin/main 에 머지됐는지를 **런타임 재검증**한다(§D8 (b)). 판정이 불확실하면
    (claims.json 파싱 실패·schema 불일치·후보 frontmatter 누락·server-time 미확보)
    그 후보를 병렬 후보에서 제외하거나 단일-task 경로로 **fail-safe 강등**한다
    (§D8 (a) — 모르면 직렬화, reclaim 의 fail-closed 계약을 select 면으로 확장).
    incident 누적 모니터링: STATE `concurrencyIncidents` 카운터의 같은 유형(`double-claim`
    / `merge-conflict-code` / `reclaim-misfire` / `ci-cost-overrun`) 2회 누적 시
    driver 는 lock(critical section) 하에서 `flags.fineGrainedConcurrency = false`
    로 **자동 OFF 강등 + notifier 보고**(§D8 (d) 회로 차단기 — 재활성은 사람 결정).
    본 의무는 토글 OFF(현 기본값) 동안 inert — STATE schema/select-claim.sh 재검증
    로직/회로 차단기 분기의 실제 구현은 별도 task chain(T-0341 Follow-ups).
- **reclaim primitive server-time now 주입 계약 (ADR-0036 §Decision 5 — clock-skew 오회수 차단)**:
    위 (a) 의 reclaim 호출 시 회수 판정의 now 는 **server-time 기준으로 주입**한다
    (`RECLAIM_NOW` env 또는 인자 2). driver 는 server-time 을 GitHub API 응답의
    `Date` 헤더 또는 `gh run` 의 UTC 시각으로 확보한다 — **로컬 `date` 를 회수
    임계 판정에 쓰지 않는다**(기기 간 clock-skew 가 살아있는 claim 을 오회수할 위험).
    **server-time 확보 불가 시 RECLAIM_NOW 를 주입하지 않는다** — primitive 가
    회수를 보류(변경 0, 오회수 0)하므로 미주입 자체가 안전한 fail-closed 계약이다
    (concurrency.md §5 / reclaim-stale-claim.sh 헤더 "now 미주입 — 회수 보류" mirror).
    `RESUME prNumber=<n> taskId=<T-X>` stdout 신호를 받으면 **새 PR 생성 대신**
    본 [2] 의 PR Resume 판정(a~f)으로 분기해 그 PR 을 이어 진행한다(중복 PR 방지 —
    ADR-0034 사고 메커니즘 직접 차단). 실제 server-time fetch·PR checkout 명령은
    driver 책임(새 스크립트 도입 0 — LOOP 텍스트 계약만).
- state.currentTask가 있으면 그것을 그대로 사용한다.
  - **추가**: task.commitMode == "pr" 이고 task 파일 frontmatter 에 `prNumber: N`
    이 있으면 **이전 turn 의 PR 진행이 도중 종료된 상태로 본 turn 에서 resume**.
    [3] EXECUTOR 호출 직전에 다음 점검을 수행해 다음 step 을 결정:
      a. `gh pr view N --json state,mergedAt,reviews,comments,headRefOid,mergeable`
         (또는 cron 등 gh 부재 환경에서는 `mcp__github__get_pull_request` — ADR-0010)
         으로 PR 현 상태 fetch.
      b. PR state == MERGED → cleanup 누락. integrator §C cleanup checklist 만
         실행 후 본 turn 종료.
      c. PR 의 latest `Round N/7` reviewer comment 의 N 과 STATE.reviewRounds[T-X]
         비교. latest comment 의 N 이 더 크면 → integrator 가 verdict 처리 미완.
         바로 integrator dispatch 로 점프해 4-게이트 검증부터.
      d. PR head sha 의 시각 > 마지막 reviewer comment 시각 → executor 가 fix
         push 후 reviewer 재호출 못 한 상태. integrator dispatch (reviewer 재호출
         포함) 로 점프.
      e. head sha == 마지막 reviewer-인지 sha + reviewer.VERDICT == REQUEST_CHANGES
         → executor re-entry mode 로 진입 ([3] EXECUTOR 호출 단계로).
      f. 위 모두 아님 (정상 진행 중) → [3] EXECUTOR 호출.
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
  (0)   **Prerequisite**: `git branch --show-current` 로 현재 branch 가
        의도한 target 과 일치하는지 검증 (§4 "Push source/target 매칭 hard rule" 참조).
        direct → main, pr → claude/<TaskID>-<slug>. 불일치 시 즉시 BLOCKED
        (reason: `wrong-source-branch`); commit·push 시도 금지.
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
    **(cron 인 경우 prerequisite — ADR-0010)**: PR 연산은 gh 또는 GitHub MCP
    (`mcp__github__create_pull_request` / `add_issue_comment` / `list_check_runs` /
    `merge_pull_request` / `delete_branch`) 로 수행한다. integrator 호출 전 gh/MCP 가용성을
    가벼운 호출로 probe. **gh·MCP 둘 다 부재면** 이 pr-mode task 를 claim 취소
    (lock 해제) 하고 **no-op 으로 종료** — BLOCKED 아님, draft/stale PR 생성 금지
    (과거 13 PR 잔재 반복 차단). 해당 task 는 nextTask 로 남아 gh 보유 `/loop` 기기 또는
    MCP 가용 cron fire 가 집어간다.
    target=claude/<TaskID>-<slug> (없으면 main에서 새로 생성).
    위 (i)~(iv) 따라 feature branch에 push.
    이어서 integrator sub-agent 호출 (PR open + reviewer dispatch + 결과 판정).
    integrator 반환에 따라:
      MERGED → INTEGRATOR trail을 merge commit 메시지에 포함시켜 머지 (이미 됨).
      ANOTHER_ROUND → STATE.reviewRounds++. 같은 turn 안에서 executor re-entry 즉시
        진행 (REVIEW_FINDINGS 를 amendment 로 전달). 단 integrator 가 § B 의 "다음
        turn 으로 미룸" 조건 (round 누적 3+ / turn cap 임박 / 큰 변경) 신호를 보내면
        본 turn 종료 후 다음 turn 에서 executor 재호출. 같은 PR 안에서 round 여러
        번 진행 가능.
      BLOCKED → notifier 호출.

[5] CI 검증 (push 직후)
- gh run list --limit 1 --json status,conclusion,headSha 으로 latest run 확인
  (또는 gh 부재 시 `mcp__github__list_check_runs(ref=head_sha)` — ADR-0010).
  gh·MCP 둘 다 부재(cron)면 CI conclusion 확인을 다음 turn 으로 위임(BLOCKED 아님).
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

[7.5] CRON MULTI-TASK CHAIN (오직 cron fire + flags.multiTaskFire == true 일 때)
- **이중 게이트** — 본 step 은 다음 두 조건이 **모두 참**일 때만 평가한다:
    (G1) STATE.flags.multiTaskFire === true   AND
    (G2) lock.holder == "cron"
  둘 중 하나라도 거짓이면 본 step 을 **통째로 skip** 하고 현행 종료로 간다
  (cron 인데 flag=false → 그냥 종료 / `/loop`·`human` holder → [8] 로).
- **DORMANT 표기** — 현재 STATE.flags.multiTaskFire 는 `false`(T-0198) 이므로
  본 분기는 **inert** 다 — ADR-0020 롤아웃 step 4 의 토글 ON 전까지 driver 동작은
  전혀 바뀌지 않는다. 이 step 은 그때를 위한 forward-looking 명세다.
  (활성 토글 위치 = §4 `flags.multiTaskFire` 설명 / ADR-0020 step 4.)
- **cron-only** — lock.holder 가 "loop" 또는 "human" 이면 본 분기는 **절대 trigger
  되지 않는다** (사용자 cron-only 결정 — ADR-0020 Decision (1)). `/loop` 의 [8]
  DYNAMIC SELF-RESCHEDULE turn-cap(10) self-reschedule 동작은 본 step 과 독립이며
  전혀 건드리지 않는다.
- **§2.5 (a)~(e) 재평가** — 두 번째 task 진입 전에 [CLAUDE.md §2.5](../CLAUDE.md)
  / [ADR-0020](decisions/ADR-0020-multi-task-fire-cron-n2-activation.md) Decision (2)
  의 5조건을 **모두** 재평가한다. 하나라도 false → 진입 안 하고 현행 cron 종료(위 [7]):
    (a) 직전 task 를 `executor` 1회 호출로 처리했고 driver 가 받은 게 ≤200 char
        SUMMARY + 표준 trail blob 뿐 (raw output / 긴 log 를 driver context 로
        끌고 왔으면 chain 차단 — CLAUDE.md §4·§11).
    (b) N ≤ 2 — 본 fire 에서 아직 task 1개만 수행했을 때만(이미 두 번째면 더 진입 X).
    (c) 직전 task 가 BLOCKED / CI fail / push contention / merge conflict 중
        하나라도면 **즉시 종료(fail-fast)** — chain 안 함.
    (d) STATE.lock.since 로부터 경과 시간 ≥ 45분이면 추가 진입 금지
        (§2 60분 stale 임계 보호 — 두 번째 task 가 lock 점유를 60분 너머로
        끌고 가는 시나리오 차단).
    (e) 두 task 의 commitMode 가 같을 때만(direct+direct OR pr+pr) — 혼합
        (direct+pr / pr+direct) 금지(§3.2 R-114 CI 검증 경계 모호).
- **N≤2 hard cap** — 한 fire 당 추가 task 는 **최대 1개**(총 2개). 두 번째 task
  완료 후에는 무조건 종료하며 **세 번째 task 진입 금지**(N≥3 은 ADR-0020 도 금지).
- **두 번째 task 진입 경로** — 위 G1·G2 + (a)~(e) 가 **모두 통과**하면:
    STATE.nextTask 가 비어있으면(planner 가 미리 큐잉한 다음 task 없음) → 종료.
    STATE.nextTask 가 있으면 → currentTask=nextTask, nextTask=null 로 옮기고
    [2]~[6] 를 **한 번 더** 수행한다(두 번째이자 마지막 task). 완료 후 [7] 종료.
- **FIRE-BATCH marker** — chain 된 두 task 의 commit trail footer 에
  `FIRE-BATCH: <task1>+<task2>` 형식(예: `FIRE-BATCH: T-0210+T-0211`)을 박는다
  (ADR-0020 Decision (3)). marker 는 commit message footer 의 trail blob 인접
  위치에 들어가 한 fire 가 2 task 를 묶었음을 외화한다 — reviewer / log 점검이
  fire 구조를 인지하고 조건 미충족 chain 을 MINOR finding 으로 catch 하는 근거.
- **§10 관계** — fire 자체는 매 발화 fresh conversation 이므로(CLAUDE.md §10),
  격리 약화는 1 fire 내부(2 task 사이)에만 국한되고 fire 경계는 여전히 clean 하다
  (CLAUDE.md §2.5 "본 § 와 §10 의 관계").

[8] DYNAMIC SELF-RESCHEDULE (오직 /loop dynamic mode일 때)
- ScheduleWakeup 도구가 가용한지 확인.
  - 없으면 (schedule cron 또는 headless 모드) 이 단계 skip. 그냥 종료.
  - 있으면 아래 조건 평가:
- Reschedule 하지 않는 조건 (어느 하나라도 해당 시 호출 안 함 → loop 종료):
  (a) STATE.humanQuestions 에 resolvedAt 없는 항목이 1개 이상
  (b) 이번 turn STATUS = BLOCKED
  (c) STATE.ci.consecutiveFails >= 3
  (d) PLAN.md 의 마지막 phase 마지막 bullet까지 done (시스템 완성)
  (e) **같은 /loop 세션의 누적 turn 수 ≥ 10**
      — STATE.lock.loopSessionTurnCount 가 10 이상이면 reschedule 안 함.
      이는 같은 conversation 안에서 turn 이 누적되어 context 비대화·오염되는 것을 막기 위함
      (ScheduleWakeup 이 같은 conversation 의 새 turn 으로 wake 한다는 공식 사실 — CLAUDE.md §10).
      종료 메시지에 다음을 포함:
      "/loop session turn cap (10) 도달. cleanup 권장:
       (1) /compact 로 같은 conversation 압축 후 새 /loop, 또는
       (2) /clear 로 새 conversation 시작 후 /loop, 또는
       (3) 그냥 종료하고 다음 cron 발화 (KST 01-05시) 를 기다림."
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

### 주의: /loop의 한계 (검증된 사실)

**공식 문서 확인**: `ScheduleWakeup` 은 같은 conversation 안에서 다음 turn 을 wake 한다 ([scheduled-tasks.md](https://code.claude.com/docs/en/scheduled-tasks.md): "Tasks are session-scoped: they live in the current conversation"). 새 conversation 으로 자동 분리되지 않는다.

따라서 /loop dynamic 으로 진행할수록 conversation context 가 누적된다. driver / executor 의 누적이 잘 차단되어 있어도 (CLAUDE.md §4) **conversation 외피 자체는 자란다**. 자동 summarization 이 일부 회수하긴 하나 정보 손실 + 오염 위험.

**Claude Code 의 자동 cleanup 메커니즘은 현재 존재하지 않음**:

- Hook 으로 `/clear` 또는 `/compact` 자동 호출 불가 — hook 은 shell / HTTP / MCP / prompt / agent 만 가능, slash command 못 호출 ([hooks.md](https://code.claude.com/docs/en/hooks.md)).
- `ScheduleWakeup` 에 "fresh conversation 으로 시작" 옵션 없음.
- → 사용자 수동만 가능.

### 그래서 /loop 의 운영 룰

- §1 [8] (e) 의 **10-turn cap** 으로 driver 가 자체적으로 종료 + 사용자에게 cleanup 안내.
- 사용자가 cap 도달 시:
  - **`/compact`** — 같은 conversation 안에서 context 압축. 빠른 cleanup. CLAUDE.md / system prompt / TaskCreate task / memory 는 유지 ([commands.md](https://code.claude.com/docs/en/commands.md)). conversation 흐름은 보존되지만 압축됨.
  - **`/clear`** — 새 conversation 시작. 이전 대화는 `/resume` 으로 복구 가능. 가장 깔끔한 cleanup.
- 그 다음 `/loop` 입력하면 새 session 시작 (turn count reset).
- 또는 그냥 종료하고 cron 발화 (KST 01-05) 를 기다림.

### /loop ↔ /schedule cron 의 정확한 관계 (대체 X, 보완)

| 항목 | /loop dynamic | /schedule cron |
| --- | --- | --- |
| 매 turn conversation | 같은 conversation 누적 | 매 발화 **새 conversation** (자동 cleanup) |
| 사용자 자리 | 필요 (Claude Code 켜둬야) | 불필요 (백그라운드 클라우드) |
| 진정한 long-horizon | **불가** (10-turn cap) | **가능** (무한) |
| 적정 용도 | **5~10 turn 모니터링·디버깅** + 사용자 옆 | **무한 진행 backbone** |

**cron 은 대체 가능한 게 아니라 long-horizon 의 진정한 backbone**. /loop 은 사용자가 옆에 있을 때의 짧은 sprint 용도.

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
pr-mode task 는 gh/MCP probe 후 진행하고, 둘 다 부재면 direct 우선 또는
stand down 한다 (ADR-0010 — BLOCKED·stale PR 양산 금지).
```

마지막 한 줄을 추가해 두면 ScheduleWakeup이 잘못 호출되는 일을 막을 수 있다 (cron 모드에서 또 dynamic reschedule을 하면 두 메커니즘이 겹친다).

### Lock과 충돌 방지

schedule 측은 lock holder를 `"cron"` 으로 잡는다. `/loop`("loop")과 cron("cron")이 동시에 깨어나도 §4 lock 규약에 의해 한쪽만 진행한다.

### 관리

- 목록: `/schedule list`
- 일시 중지: `/schedule disable <id>` 또는 cron을 비활성화하는 prompt
- 삭제: `/schedule delete <id>`
- 한 번만 실행: `/schedule 내일 오전 10시에 한 번만 driver turn 실행` 같이 one-shot도 가능

### 운영 점검

- 처음 1 주는 매일 사람이 STATE.json·journal 점검. 안정되면 주간 점검.

**미래 완화 검토**: "1 fire = 1 task" 룰은 영속 정책이 아니라 시스템 안정 후 multi-task chaining 가능성을 ADR 로 검토 — [PLAN.md](PLAN.md) "운영 정책 review backlog" 참조. 트리거 충족 전까지 임의 chaining 금지.

---

## 4. Lock & 충돌 규약

이 시스템의 lock은 [ADR-0028](decisions/ADR-0028-cloud-proxy-branch-lock.md)(ADR-0009 invariant 보존) 에 따라 **`refs/heads/claude/lock-driver` 브랜치(commit ref) tip 의 `git push --force-with-lease` CAS(compare-and-swap)** 로 직렬화한다. ref push 는 서버 측에서 원자적이므로 N 개 기기가 동시에 push 해도 1개만 승리 — multi-machine(여러 기기의 `/loop`) + cron 동시 무장 환경에서 진짜 상호배제를 보장한다. `claude/*` 는 cloud proxy 가 기본 허용하는 prefix 이므로 cron@cloud 도 credential 0 으로 자율 lock CAS 가 가능하다(옛 `refs/locks/driver` blob ref 는 proxy 가 403 으로 거부했었다 — ADR-0028 이 저장 위치만 이전해 해소, CAS 원자성·강한 mutex·60분 stale·read 전 fetch 의무는 ADR-0009 그대로 불변). (과거: lock 을 STATE.json 에 인메모리로 점검·설정하고 작업 끝에 push 하던 **약한 mutex** 였고 read-then-push race 에 취약했다 — ADR-0009 가 이를 대체. STATE.json.lock 은 비권위 human mirror 로만 남는다.) CLAUDE.md §10 "동시 실행 정책"과 함께 읽는다.

### Lock 형태

권위 lock 은 **`refs/heads/claude/lock-driver` 브랜치 tip commit 의 단일 파일 tree `lock.json`** 에 JSON 으로 직렬화된다 (main 의 커밋된 파일이 아니다 — main 히스토리 비오염 + lock·콘텐츠 push 분리):

```json
{
  "holder": "loop" | "cron" | "human",
  "session": "<필수 — <holder>@<host>-<short-rand>, 예: loop@laptop-a3f9>",
  "since": "<ISO 8601>",
  "loopSessionStartedAt": "<ISO 8601 — loop dynamic 첫 turn 시각, holder=loop 일 때만>",
  "loopSessionTurnCount": "<integer — 같은 loop dynamic session 안에서 누적 turn 수, holder=loop 일 때만>"
}
```

`session` 필드는 **필수** 다 — 같은 holder 카테고리(예: 두 기기의 `loop`)를 구분한다. `<holder>@<host>-<rand>` 형태로 채운다. session 이 직전과 다르면 기기 이동/새 session 으로 간주해 loopSessionTurnCount 를 reset(§1 [1]). 사람이 lock 확인 시 `git ls-remote origin refs/heads/claude/lock-driver` 후 tip commit 의 `lock.json` 을 직독한다(브랜치 delete 대신 tombstone commit 채택이라 브랜치는 상존, tip 이 free/held 표현 — ADR-0028 Decision (3)·(6)). STATE.json.lock 은 동일 구조의 **비권위 human mirror** 로, 위 ls-remote 없이 사람이 STATE 만 봐도 대략 알 수 있게 bookkeeping commit 때 동기할 수 있다(권위는 브랜치 tip `lock.json`).

`loopSessionTurnCount`·`loopSessionStartedAt` 는 **`/loop` dynamic mode 전용** — §1 [8] (e) turn cap (10) 의 카운터다. 매 turn 시작 시 driver 가 1 증가. holder 가 "loop" 가 아닌 다른 값으로 바뀌면 (cron 이 다음 발화에서 lock 잡거나, human 이 잡으면) 이 두 필드는 누락되어도 무방. 새 /loop session (`holder=loop` 이고 직전 holder 가 다른 값이거나 lock=null 상태에서) 의 첫 turn 시점에 카운터 1 로 reset.

cron / human / headless mode 의 lock 에는 본 두 필드 없음 — 매 발화 / 호출이 새 conversation 이라 누적 위험 없음.

### STATE.json `flags` (lock blob 과 무관한 top-level 설정 필드)

`docs/STATE.json` 에는 lock 과 별개로 top-level `flags` object 가 있다 (lock blob 이 아니라 main 에 커밋된 STATE.json 본문):

- `flags.multiTaskFire` — **boolean, 기본값 `false`**. multi-task fire (한 cron fire 안에서 task 최대 N=2 chain) 의 활성 토글이다 ([CLAUDE.md §2.5](../CLAUDE.md), [ADR-0020](decisions/ADR-0020-multi-task-fire-cron-n2-activation.md)). `false` 인 동안 driver 는 현행 "1 fire = 1 task" 그대로 동작한다. `true` 로의 전환은 ADR-0020 롤아웃 **step 3** (§1 의 cron 전용 chain 분기 로직 추가) + **step 4** (cron 간격 재조정 + 토글) 가 먼저 완료된 뒤에만 가능하다 — 본 필드는 그 토글이 읽을 자리만 미리 박제한 것이며, 분기 로직이 없으면 토글을 켜도 효과가 없다.

### 획득 / 해제 (branch-ref CAS)

- **fetch 먼저**: `git fetch origin +refs/heads/claude/lock-driver:refs/remotes/origin/claude/lock-driver` (§1 [1] read 전 fetch 의무). 브랜치 미존재 → free.
- **획득**: 다른 holder 가 점유 & since < 60분 → 즉시 종료(no-op). 비어있음/stale(≥60분) →
  본인 `lock.json` 담은 commit 을 `git push origin <commit>:refs/heads/claude/lock-driver --force-with-lease=refs/heads/claude/lock-driver:<observed-old-sha>`
  (브랜치 미존재 시 `<observed-old-sha>` = `0{40}` zero-sha CAS). 성공 = 획득, reject = 경쟁 패배(재 fetch 후 held 면 종료).
- **stale 탈취도 CAS** — 60분 초과 탈취 역시 `--force-with-lease` push 로 동시 탈취 시 1개만 승리.
  탈취 시 journal 1줄(`<HH:MM> driver: stole stale lock from <prev-holder>`).
  **`human` lock 도 60분 stale 탈취 대상** — 즉 human lock(B 방식 일시정지)은 단기(큐잉 구간) 보호용이며
  장기간 cron 차단 용도가 아니다(60분 후 cron 이 탈취 가능).
- **해제**: 정상·BLOCKED 종료 시 항상 tombstone empty commit(`lock.json` = `{"holder":null}` 또는 빈 tree)을 동일 `--force-with-lease` CAS 로 push.
  **브랜치 delete(`git push origin :refs/heads/claude/lock-driver`)는 금지** — cloud proxy 가 브랜치 delete 를 막을 여지가 있어 tombstone commit 으로 통일(브랜치 상존, tip 이 free 표현 — ADR-0028 Decision (3)).
  STATE.json.lock human mirror 도 동기(선택).
- 사람이 점검·정지 목적으로 `human` holder lock 을 ref 에 박을 수 있다(수동 일시정지) — 위 60분 한계 유의.

### Lock 미획득 = stand-down (ADR-0034 흡수 — 격리 병렬 작업 금지)

- **lock 미획득(경쟁 패배 또는 `git push` 권한 부재) 시 = stand-down(no-op 종료)** — 권위 CAS 가 reject 되거나 다른 holder(since < 60분)가 점유 중이면 해당 진입점은 즉시 no-op 종료한다. **"lock 은 못 잡았지만 feature branch + draft PR 로 격리해서 진행"하는 패턴은 금지** — 이것이 2026-06-09 #246/#247 중복-PR 사고의 직접 메커니즘이었다(ADR-0034 §Context). 작업 결과를 외화할 곳이 없으면 그냥 종료하고 lock 보유 driver / 다음 fire 에 맡긴다.
- **`claude/*` push 권한조차 없는 극단 환경**(ADR-0028 의 403 패턴 재발 등): lock CAS 자체가 불가하므로 위 규율에 의해 **무조건 stand-down**. credential/proxy 한계는 BLOCKED 가 아니라 no-op 종료로 흡수한다(ADR-0028 정합). 이 경우에도 "lock 없이 작업 외화" 는 금지.
- 본 규율은 ADR-0034("cloud 진입점의 권위 lock CAS 의무화") §Decision (1)~(4) 를 운영 doc 에 흡수한 것이다 — ADR-0036 §Decision1 의 "complementary·subsume 안 됨, 규율 흡수 후 #249 close" 권고 정합. 출처/사고(#246/#247) 추적: ADR-0034.

### Commit · Push 충돌 처리 (graceful 종료)

driver가 변경을 commit한 후 push할 때 fast-forward fail (다른 driver가 먼저 push)이 일어나면:

1. `git reset --soft HEAD~1` 으로 자기 commit 풀기 (변경은 working tree에 보존).
2. `git fetch origin main && git rebase origin/main` 으로 최신 main 위로 변경 이식 시도.
   - rebase가 자동 성공: 다시 commit + push. 재시도 카운터 +1.
   - rebase가 conflict: STATE.json·journal 같은 단순 textual conflict는 driver가 직접 해결 시도 (origin쪽 값을 base로 자기 변경 다시 적용 — 특히 counters는 origin+1).
   - rebase conflict가 코드 영역(`src/`, `web/`, `test/`)이면: driver는 **건드리지 않고** BLOCKED 처리 (reason: `merge-conflict-code`). 사람이 해결.
3. push 재시도. 총 3회 시도까지 허용.
4. 3회 후에도 push 실패: BLOCKED 처리 (notifier; reason: `push-contention`). working tree의 변경은 stash해서 보존 (`git stash push -m "T-NNNN driver attempt"`).

BLOCKER reason 카테고리: `merge-conflict-code`, `push-contention`, `credential`, `ci-trigger-missing`, `wrong-source-branch`, `stale-worktree`.

**토글-gated claim/N-driver regime 의 충돌 경계 (`flags.fineGrainedConcurrency == true` 일 때 — ADR-0036 stage3, forward-looking spec)**: 토글 ON 으로 여러 driver 가 §1[2] claim-pickup 분기로 서로 다른 task 를 동시 진행하면 충돌 면이 둘로 갈린다. (a) **bookkeeping 충돌**(STATE.json·journal·counters)은 select+claim 과 마찬가지로 lock(critical section) 하에서만 write 되므로 lock CAS 직렬화가 동시 write 를 1개씩 흘려보내 안전하다 — counters origin+1 read-modify-write 불변(§5 Single-writer·CLAUDE §9·ADR-0009 보존). 위 1~4 step 의 reset-soft → fetch → rebase → 재push 흐름이 이 직렬화의 표현이다(STATE/journal text conflict 는 step 2 의 origin-base 재적용으로 흡수). (b) **코드 충돌**(두 PR 이 같은 `src/`)은 implement 가 lock-free 라 lock 으로 못 막는다 — ADR-0036 §Decision 0 의 **파일-disjoint(`touchesFiles` 겹침 0) 동시 큐잉이 1차 방어**이며, 그래도 충돌하면(planner 분해 실수 등) 나중 머지 PR 이 위 step 2~3 rebase 단계에서 기존대로 `merge-conflict-code` BLOCKED 로 흡수된다(데이터 손상 0·throughput 만 상실 — ADR-0036 §Decision 2). 즉 본 regime 은 step 1~4 graceful 종료 로직을 **바꾸지 않고 그대로 재사용**한다 — 토글 ON 은 동시 진행 driver 수만 늘릴 뿐 충돌 흡수 메커니즘은 동일. **토글 OFF(현 기본값 `false` — T-0326)면 활성 driver 는 한 시점 1개(coarse single-driver)라 위 1~4 가 1:1 그대로이며 본 단락은 inert** — 본 doc-sync 는 충돌 흡수 행동을 바꾸지 않는 forward-looking 서술이다.

**토글 ON 시 integrator squash-전 rebase + CI 재확인 의무 (ADR-0036 §Decision 8 (c) — forward-looking, 토글 OFF 동안 inert)**: 토글 ON 으로 동시 진행되는 PR 들이 파일-disjoint 라도 의미가 충돌(semantic conflict)할 수 있어 — 4-게이트(§3.3) 통과 후 squash 직전에 integrator 는 PR head 가 최신 main 을 포함하는지 확인하고, 뒤처졌으면 update-branch/rebase 후 **CI green 을 재확인**한 뒤에만 머지한다(main 진입 직전 마지막 그물). 본 의무는 토글 OFF 동안 inert — `.claude/agents/integrator.md` 의 실제 박제는 별도 후속 task(T-0341 Follow-ups).

### Push source/target 매칭 hard rule

driver 가 commit · push 를 시작하기 전 **반드시** 다음 3개 hard rule 을 만족해야 한다. 위반은 BLOCKED (reason: `wrong-source-branch`) 즉시 처리.

1. **`commitMode: direct` 작업**은 반드시 **main branch 의 working tree** 에서 commit + push. 만약 driver 가 feature branch 위에 깨어났다면 (직전 turn 이 pr-mode 였거나 worktree 가 다른 branch 를 가리키고 있다면) 먼저 `git switch main` 후 변경을 cherry-pick / re-apply 해서 commit 한다. push 는 `git push origin HEAD:main` 또는 `git push origin main:main` 만 허용 — source 와 target 이 모두 main.
2. **`commitMode: pr` 작업**은 반드시 **`claude/T-NNNN-<slug>` feature branch 의 working tree** 에서 commit. push target 도 **그 feature branch 만** 허용 (`git push origin HEAD:claude/T-NNNN-<slug>`). pr-mode 작업의 push target 으로 main 을 지정하는 것은 **절대 금지**.
3. **`git push origin <source-ref>:<other-target-ref>` 형태** (source ref 와 target ref 가 다른 push) 는 일반적으로 금지. 예외는 사용자가 직접 시행하는 hotfix 만. driver agent 는 어떤 상황에서도 source ≠ target 인 push 명령을 자동 실행하지 않는다.

driver 는 §1 [4] (0) prerequisite step 에서 `git branch --show-current` 의 출력값과 task frontmatter 의 `commitMode` 기반 expected target 을 비교해 일치 여부를 검증한다. 불일치 시 commit 자체를 진행하지 않고 BLOCKED 종료, notifier 호출.

**claim/N-driver regime 에서도 불변** (`flags.fineGrainedConcurrency == true` — ADR-0036 stage3): 여러 driver 가 §1[2] claim-pickup 으로 동시 진행해도 위 hard rule 1~3 은 **진입점별로 그대로 강제**된다 — 각 driver 는 자기 claim 한 task 의 `commitMode` 에 따라 `direct`→main / `pr`→`claude/T-NNNN-<slug>` 로 push 하며, source≠target push 금지(hard rule 3)는 N-driver 동시 진행 시에도 driver 마다 독립적으로 적용된다. claim 은 task 소유만 표현할 뿐 push 매칭 규율을 완화하지 않으며(claim 박제는 lock 하에서 main 의 lock-ref 에만 일어나고 task 의 코드 push 와 무관), 위 사고 사례의 source≠target 차단도 동일하게 유효하다. 토글 OFF(현 기본값) 시 단일 driver 라 본 단락 역시 inert — push 매칭 행동 변경 0.

**사고 사례** (이 hard rule 이 박힌 이유): 2026-05-24 01:12 KST, driver(loop session #3) 가 T-0007 BLOCKED bookkeeping commit 을 feature branch `claude/T-0007-ci-spec-presence-check` 위에서 작성한 후 `git push origin HEAD:main` 으로 main 에 직접 push. feature branch 의 parent chain (T-0007 production code 포함) 이 fast-forward 로 main 에 함께 들어가 PR-8 이 CI 검증 없이 자동 MERGED 처리됨 (HQ-0003, STATE.counters.tasksAccidentalMerge=1). 본 hard rule 은 같은 형태의 source≠target push 를 prerequisite step 에서 사전 차단한다.

### worktree 정책

- **driver loop 는 origin/main 을 추적하는 체크아웃에서만 실행한다.** feature-branch worktree(`.claude/worktrees/*`)나 origin/main 보다 뒤처진 클론에서 driver 를 돌리면, read 전 fetch 를 하더라도 로컬 branch 가 main 이 아니어서 direct push hard rule(§4 "Push source/target 매칭")에 걸리거나 stale STATE 를 읽어 무위 종료한다. 이런 위치에서 깨어났으면 §1 [1] 에 의해 즉시 종료(reason: `stale-worktree`).
- branch-ref CAS lock(ADR-0028)은 origin 을 통해 모든 기기·클론이 같은 `refs/heads/claude/lock-driver` 를 보므로, multi-machine `/loop` + cron 동시 무장에서도 상호배제가 성립한다. 단 **각 진입점은 lock 점검·STATE read 전 반드시 `git fetch`** 해야 한다(§1 [1] read 전 fetch 의무) — 안 하면 stale ref 로 잘못된 판단을 한다.
- **feature-branch 정리 가드**: 머지된 `claude/T-*` feature branch 를 삭제하는 정리 스크립트/명령은 **`claude/lock-driver` 를 오삭제하지 않도록 이름 패턴 exclude** 해야 한다(예: `claude/T-[0-9]*` 패턴만 매칭, `claude/lock-driver` 제외 — ADR-0028 Consequences "오삭제 가드 필요"). 오삭제 시 zero-sha CAS 로 재생성되지만 진행 중 lock 을 날릴 수 있다.
- **1 driver = 1 working tree** 원칙은 유지. 같은 기기에서 multi-worktree driver 동시 가동 금지.

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
