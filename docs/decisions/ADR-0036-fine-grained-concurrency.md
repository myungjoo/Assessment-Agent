# ADR-0036 — fine-grained concurrency: critical-section-only lock + claim 기반 task 소유 (ADR-0009 "활성 driver 1개" supersede 검토)

ACCEPTED (2026-06-10)

> **2026-06-10 사용자 결정 (ACCEPTED — 옵션 1)**: ADR-0009/0028 의 "활성 driver 항상 1개" 모델을 본 ADR 의 critical-section lock + claim 기반 N-driver 모델로 전환한다. 근거 — §Decision 0 가 ROI 변수로 본 **"두 번째 driver 의 존재"는 cron + multi-machine `/loop` 상시 진입점으로 이미 충족**돼 있다(실제로 cron@cloud / cron@local fire 가 연속적으로 깨어나 lock 을 잡고 task 를 집어가는 것이 관측됨 — 2026-06-10 stage 1 T-0326 자체가 cron@cloud-aa3s1 fire 로 완료). 따라서 §rollout 의 stage 1→2 게이트 **"한 시점 독립 task ≥ 2 실증"은 stage 2-5 인프라 구축(claim registry · select+claim · loop 재작성 · per-PR CI group)을 막는 사유가 아니다 — build-through 승인**. 단 **stage 5 의 `flags.fineGrainedConcurrency` 토글 ON(런타임 활성)은 실측(throughput 이득 > coordination 비용) 후 결정**으로 유지한다(독립 task 공급은 토글 시점 ROI 변수로 남음). 각 stage 의 **정확성 게이트**(이중 claim 0 · orphan 회수 정상 동작 · 동시 무장 시 충돌 없음)는 그대로 강제하며, §Decision 0 / §Consequences 의 ROI 분석 본문은 분석으로서 유효하다(adoption 만 ACCEPTED 로 갱신).
>
> 채택은 ACCEPTED 이나 **런타임 활성은 토글이 ON 되는 stage 5 부터**다 — 그 전까지 코드/loop 동작은 stage 별 머지로 점진 도입되되 토글 OFF 동안 forward-looking spec 으로 기능한다(ADR-0009 모델은 토글 ON 전까지 사실상 동작 유지). `supersedes: ADR-0009`(부분 — §Decision 0 invariant 한정) · `amends: ADR-0028` · `relates: ADR-0034, ADR-0020`.
>
> **2026-06-10 amend (T-0341, 사용자 지시)**: stage 5 기본-ON 전환이 안정성을 해치지 않도록 안전장치 5종을 [§Decision 8](#8-stage-5-기본-on-안전장치-2026-06-10-amend--t-0341) 로 박제하고, §rollout stage 5 를 5a/5b/5c 3단계 이행으로 세분한다. 본 amend 는 설계 박제만으로 동작 변화 0(토글 여전히 OFF) — 안전장치 구현은 T-0341 Follow-ups 의 후속 task chain.

## Context

[ADR-0009](ADR-0009-strong-ref-cas-lock.md)/[ADR-0028](ADR-0028-cloud-proxy-branch-lock.md) 의 강한 mutex 는 한 task 의 **전체 cycle**(implement → PR → CI → merge)이 끝날 때까지 단일 lock 을 점유한다. 따라서 implement/test/CI 대기 idle 구간에도 다른 진입점이 진행하지 못한다. 사용자(2026-06-10 결정)는 multi-machine + cron 동시 운용으로 이 idle 동안 **서로 다른 독립 task 를 병렬 진행**해 throughput 을 올리고 싶어 한다(Option B, fine-grained concurrency).

핵심 전환은 두 가지다. (1) lock 을 **공유 가변 상태**(`docs/STATE.json`·journal·counters·`main` 브랜치·lock ref 자체) 접근 시에만 **짧게** 점유하는 critical-section lock 으로 좁힌다 — implement/test/review/CI-wait 는 lock-free. (2) task 소유는 lock 이 아니라 **별도 claim registry** 로 표현해 여러 driver 가 *서로 다른* task 를 동시에 소유·진행하게 한다.

이는 ADR-0009 의 "활성 driver 항상 1개" invariant 를 깨므로 **코드 전에 ADR**(CLAUDE.md). 동시에 정직한 판정이 필요하다: 현 work 는 대부분 순차 chain(각 slice 가 앞 머지에 의존)이라, 독립 task 가 없으면 N driver 여도 throughput 이득이 0 에 수렴한다(§Decision 0). 또한 직전 [ADR-0034](ADR-0034-cloud-entrypoint-mandatory-lock-cas.md)(PROPOSED, PR #249)는 정반대 방향 — cloud 진입점의 lock-bypass 를 **봉쇄**해 "활성 driver 1개" 를 *강화* 한다. 본 ADR 은 그 긴장을 정면으로 다룬다(§Decision 1 의 ADR-0034 관계).

## Decision

### 0. 병렬 이득 전제 — 정직 평가 (채택 보류도 정당한 결론)

N driver 의 throughput 이득은 **동시 진행 가능한 독립 task 의 존재**에 전적으로 달렸다. 현 backlog 의 대부분은 순차 chain(예: ADR → claim schema → loop 재작성 → 토글; Summary write service T-0307 → T-0308)이라, 한 시점에 독립적으로 claim 가능한 task 가 1개뿐이면 두 번째 driver 는 잡을 게 없어 이득 = 0 이다.

따라서 fine-grained concurrency 는 **planner 의 독립-stream 분해 정책**과 짝을 이뤄야만 의미가 있다:

- **동시 claimable 조건** — (a) 파일-disjoint (두 task 의 변경 파일 집합이 겹치지 않음, 특히 `src/`), (b) 의존성 없음(미머지 task 에 의존하지 않음), (c) 같은 `commitMode` 권장. 셋 모두 충족한 task 만 동시 claim 허용.
- planner 가 task 생성 시 frontmatter 에 `independentStream: <id>` + `dependsOn: [T-...]` + `touchesFiles: [...]` 를 박제해 동시성 안전을 **사전 인코딩**한다(런타임 충돌 탐지 대신 큐잉 단계 회피).

**판정**: 본 ADR 은 설계를 박제하되, **즉시 전환을 채택하지 않는다.** 독립 stream 분해 정책 + claim registry 구현 + 검증이 갖춰지기 전까지 ROI 가 음수일 수 있으므로(아래 §Consequences ROI), `flags` 토글 기반 **단계적 rollout**(§rollout)로 가되 기본 OFF. 독립 task 공급이 실증되지 않으면 토글을 켜지 않는 것이 정당한 결론이다.

### 1. claim registry — 스키마 · 원자성 · staleness · ADR-0009/0028/0034 관계

**스키마** (task 소유 1건):

```json
{
  "taskId": "T-NNNN",
  "owner": "<session — <holder>@<host>-<rand>, lock blob session 동형>",
  "claimedAt": "<ISO 8601 — 서버 time 기준, §Decision 5>",
  "status": "CLAIMED | IN_PROGRESS | PR_OPEN | DONE",
  "prNumber": "<int | null>"
}
```

**저장 위치** = lock ref 와 **동일한 `refs/heads/claude/lock-driver` 브랜치 tip commit tree** 의 추가 파일 `claims.json`(배열). 별도 ref 를 두지 않는다 — 이유: (a) ADR-0028 의 단일 CAS 평면을 재사용해 cloud proxy `claude/*` 허용 prefix 안에 머문다(credential 0 유지), (b) select+claim 을 lock 점유 하에서 같은 commit 으로 박제하면 원자성이 공짜(아래), (c) ref 가 둘이면 cross-ref split-brain 위험이 새로 생긴다(ADR-0028 §Decision 5 정합).

**원자성** — select+claim 은 **반드시 lock(critical section) 하에서** 수행한다: driver 가 lock CAS 획득 → `claims.json` 읽기 → 독립 claimable task 1개 선택 → 자기 claim 박제한 commit 을 lock ref 에 CAS push(같은 commit 에 lock tombstone 동반 = 즉시 release) → 그 후 implement/test 는 lock-free. claim 박제가 release **이전**에 일어나므로 두 driver 가 같은 task 를 이중 claim 하지 못한다(ADR-0009 의 CAS 원자성이 claim 직렬화까지 커버).

**staleness 회수** — driver 사망 시 orphan claim 은 lock stale 과 **동형 60분 임계**(§Decision 5 의 server-time 기준)로 회수한다. 단 회수 전 [LOOP.md §1[2]](../LOOP.md) PR-resume 을 우선 적용: claim 에 `prNumber` 가 있으면 회수 driver 는 새 PR 을 만들지 않고 그 PR 을 resume 한다(중복 PR 방지 — ADR-0034 사고 메커니즘 직접 차단).

**ADR-0009 supersede 범위 — 무엇을 깨고 무엇을 보존하나**:

- **깬다**: ADR-0009 Decision (5) "동일 역할 + lock 하나가 전 직렬화" 와 그로부터 따라오는 "활성 driver 항상 1개" invariant. 이제 **lock 보유 driver 는 한 시점 1개지만(critical section 직렬화), claim 보유 = task 진행 중 driver 는 N 개**가 될 수 있다.
- **보존한다**: CAS 원자성, branch-ref 저장(ADR-0028), read 전 fetch 의무, 60분 stale 임계, STATE single-writer(§9), counters origin+1 read-modify-write — 전부 불변. lock 은 사라지지 않고 **범위만 critical section 으로 좁아진다**.

**ADR-0034(PR #249) 관계** — ADR-0034 는 "cloud 진입점이 lock CAS 를 *건너뛰고* mirror-only 격리 작업하는 것을 금지"한다. 본 ADR 과 **상충하지 않고 오히려 전제**다: fine-grained 모델에서도 select+claim 은 lock 하에서만 — 즉 **lock 을 반드시 잡아야** task 를 claim 할 수 있다. ADR-0034 가 봉쇄한 것은 "lock 없이 작업 외화"이고, 본 ADR 이 허용하는 것은 "lock 을 정상 잡아 claim 박제 후 release 하고 병렬 진행"이라 서로 직교한다. ADR-0034 의 거부된 Alternative (C)(planner 사전 분배)는 "lock 없는 병렬"을 기각한 것이지 "claim 기반 병렬"을 기각한 게 아니다.

- **PR #249 disposition 권고**: ADR-0034 는 본 ADR 에 **subsume 되지 않고 complementary** 다(lock-skip 봉쇄 규율은 fine-grained 에서도 그대로 필요). 단 현 PR #249 는 draft + CONFLICTING + CI FAILURE + 2026-06-09 이후 stale 이다. **권고: PR #249 를 rebase/CI-fix 해 단독으로 먼저 머지**(lock-bypass 봉쇄는 fine-grained 채택과 무관하게 즉시 가치)하거나, conflict 해소 비용이 크면 ADR-0034 의 핵심 규율(§Decision 1~4)을 본 ADR rollout step 의 LOOP/CLAUDE 동기 task 에 흡수하며 #249 close. 어느 쪽이든 "lock CAS 무조건 선행" 규율은 fine-grained 의 select+claim critical section 과 정합하므로 폐기하지 않는다.

### 2. merge 충돌 경계

- **bookkeeping 충돌**(STATE.json·journal·counters): 이들은 lock(critical section) 하에서만 write 하므로 직렬화로 안전. counters 는 origin+1 read-modify-write 유지(ADR-0009/§9 불변). lock 직렬화가 동시 write 를 1개씩 흘려보낸다.
- **코드 충돌**(두 PR 이 같은 `src/` 파일): lock 으로는 못 막는다(implement 는 lock-free). **§Decision 0 의 파일-disjoint 동시 큐잉으로 사전 회피**가 1차 방어. 그래도 충돌이 나면(planner 분해 실수 등) 나중 머지 PR 이 LOOP.md §4 graceful 종료의 rebase 단계에서 `merge-conflict-code` BLOCKED 로 흡수 → 사람 해소. 즉 **충돌은 안전하게 실패**하되 throughput 만 잃는다(데이터 손상 없음).

### 3. 의존성 위반 방지

미머지 task 에 의존하는 task 를 동시 claim 하면 stale main 위에서 빌드 → 깨진다. 방지: claim 가능 조건에 **`dependsOn` 전부 머지됨**을 포함(§Decision 0 (b)). planner 가 task frontmatter `dependsOn: [T-...]` 를 박제하고, driver 의 select 단계가 claims.json + main 의 머지 상태를 보고 의존성 미충족 task 를 **claim 후보에서 제외**한다. 의존 task 가 머지되면 다음 fetch 에서 후보로 풀린다(런타임 의존성 그래프 평가는 큐잉 시점으로 이전).

### 4. cron@cloud credential 한계 — 두 번째 driver 의 task 범위 한정

branch-ref CAS lock/claim 은 cron@cloud 가 credential 0 으로 가능(ADR-0028, `claude/*` prefix). 그러나 cron@cloud 가 **feature branch push + PR open + merge 까지** 완주 가능한지는 불확실하다(memory: gh/MCP 부재 시 pr-mode stand-down; ADR-0009 결정 5 의 미해결 전제). 따라서:

- cron@cloud 가 잡는 두 번째 claim 은 **`commitMode: direct`(doc-only) task 로 한정** 권장 — lock/claim CAS 와 main push(`claude/*` 토글 의존)만 필요하고 PR 머지 파이프라인 불요.
- pr-mode task 의 병렬 진행은 **gh/MCP 가 살아있는 진입점**(로컬 `/loop`, MCP 보유 cloud)에 맡긴다. cron@cloud 가 pr-mode 를 claim 하면 머지 단계 stand-down 위험 → planner 가 cron-eligible stream 을 direct 위주로 분해하거나, claim 시 진입점 capability tag 를 점검.

### 5. multi-machine clock skew → staleness 오판 방지

lock/claim 취득은 SHA-CAS 라 시계 무관하지만 **staleness 회수는 timestamp 기반**이다. 이 repo 는 기기 간 clock skew 가 간헐 실측됐다(memory: env_local_clock_skew, 한 세션 ~9h skew). 로컬 `date` 를 그대로 쓰면 조기/지연 회수가 발생한다. 결정:

- `claimedAt`/`since` 는 가능하면 **server time 기준**(GitHub API `Date` 헤더 또는 `gh run` UTC)으로 박는다 — 직전 lock 사고 회피와 동형.
- 회수 임계는 **보수화**(60분 유지 + skew 여유) — 짧은 임계는 skew 시 살아있는 driver 의 claim 을 오회수할 위험이 크다. server-time 확보 불가 환경에선 회수를 보류하고 다음 server-time 가능 fire 에 맡긴다.

### 6. CI 비용 / 동시성

N 동시 PR = N CI run(Q-0028 spending-limit 사고 = 실제 비용). 결정:

- 동시 PR 은 **per-PR concurrency group** 으로 분리해 서로 cancel 하지 않게 한다 — `.github/workflows` 에 `concurrency: group: ci-${{ github.event.pull_request.number || github.ref }}` 형태(현 approval-gate 의 issue_comment concurrency cancel 사례 PR #257 의 그룹 충돌과 분리). 같은 PR 의 새 push 만 직전 run 을 cancel, 서로 다른 PR 은 독립.
- 비용 상한은 동시 driver 수 N 의 상한으로 통제(rollout 초기 N=2, ADR-0020 N=2 선례 정합). N 상향은 별도 ADR.

### 7. 관측성

journal 인터리브 + 다중 claim 의 추론 난이도 완화:

- 모든 journal entry 에 **진입점 session-id 박제**(`driver(/loop loop@host-rand tN)` 형태 — 이미 부분 적용 중, 의무화).
- claim registry 조회 수단: `git show refs/heads/claude/lock-driver:claims.json` 로 현 소유 일람(사람은 `git ls-remote` 후 직독, driver 는 fetch 후 파싱). lock.json 과 같은 commit 에 있어 단일 조회로 lock + 모든 claim 을 본다.

### 8. stage 5 기본-ON 안전장치 (2026-06-10 amend — T-0341)

핵심 원칙: **기본 ON 이 안전하려면 최악의 경우의 동작이 coarse 단일-driver(ADR-0009)와 정확히 같아야 한다.** 토글 ON 은 "무조건 병렬"이 아니라 "조건 충족 시에만 기회적 병렬 + 불확실하면 자동 직렬화 강등"이다. 안전장치 5종:

- **(a) fail-safe 강등 — 모르면 직렬화**: claim-pickup 분기에서 판정이 불확실하면(claims.json 파싱 실패·schema 불일치·후보 task frontmatter 의 `touchesFiles`/`dependsOn` 누락·server-time 미확보) 해당 후보를 병렬 후보에서 제외하거나 단일-task 경로로 fallback 한다. reclaim 의 fail-closed 계약("now 미주입 = 회수 보류", [scripts/reclaim-stale-claim.sh](../../scripts/reclaim-stale-claim.sh))을 select/pickup 전 판정 면으로 확장. 토글 ON 이어도 독립 후보가 0 이면 자연히 N=1 — **ON 자체가 위험을 만들지 않는다**(backlog 가 순차 chain 뿐인 구간에선 현행과 동작 동일).
- **(b) claim 시점 런타임 재검증**: planner 의 큐잉-시점 사전 인코딩(stage 1)을 신뢰하되 driver 가 select 단계에서 검증한다 — (i) 후보의 `touchesFiles` 와 활성 claim 보유 task 들의 `touchesFiles` 교집합 실검사(겹침 발견 시 후보 제외), (ii) `dependsOn` 전원이 origin/main 에 머지됐는지 확인. §Decision 3 / [select-claim.sh](../../scripts/select-claim.sh) 헤더가 "호출측 책임"으로 유보한 런타임 의존성 평가를 **driver 의무로 확정**한다(planner 분해 실수의 2차 방어).
- **(a)(b) 구현 경계 박제 (2026-06-11 amend — T-0346)**: (a)(b) 의 런타임 재검증·fail-safe 강등은 **신규 read-only primitive [scripts/validate-claim-candidate.sh](../../scripts/validate-claim-candidate.sh)** 에 산다 — `select-claim.sh` 의 CAS push 경로 **밖**이다(CAS 평면 불변 유지: select 는 claimed-set 제외만, 의존성 판정은 별도 primitive). driver 가 select+claim 직전에 본 primitive 를 호출해 `PASS <taskId>`(동시 claim 안전) / `DEMOTE <taskId> reason=<files-overlap|unmerged-dependency|uncertain>`(직렬화 강등) 신호를 받는다. **"dependsOn 머지됨" 판정 기준**: 각 dependsOn task 파일 frontmatter `status: DONE` 을 1차 신호로, 그것이 부재/불확실하면 origin/main `git log --grep "(<taskId>)"` commit 매칭을 2차 신호로 본다(둘 중 하나라도 미충족이면 `unmerged-dependency`). 판정 수단 자체를 확보 못하면(frontmatter 누락·ref 미확보) (a) 의 `uncertain` 으로 fail-safe 강등 — fail-closed. 실제 driver loop wiring(언제 호출하는지)은 별도 slice([LOOP.md](../LOOP.md) §1[2] 가 계약만 박제, 토글 OFF 동안 inert).
- **(c) merge 직전 rebase + CI green 재확인 의무**: integrator 는 4-게이트(§3.3) 통과 후 squash 전에 PR head 가 최신 main 을 포함하는지 확인하고, 뒤처졌으면 update-branch/rebase 후 CI green 을 재확인한다. 파일-disjoint 인코딩이 틀렸거나 파일은 disjoint 인데 의미가 충돌(semantic conflict)하는 경우를 main 진입 직전에 CI 로 잡는 마지막 그물.
- **(d) 회로 차단기 (auto-degrade)**: STATE 에 `concurrencyIncidents` 카운터를 신설한다(유형 슬러그: `double-claim` / `merge-conflict-code` / `reclaim-misfire` / `ci-cost-overrun`). **같은 유형 2회 누적 시 driver 가 lock(critical section) 하에서 `flags.fineGrainedConcurrency = false` 로 자동 강등 + notifier 보고(HQ)**. 기존 "CI 3연속 fail → BLOCKED" 패턴과 동형 — 사람이 부재해도 사고가 누적되지 않는 self-healing 이며, 기본 ON 을 one-way door 로 만들지 않는 보험. 재활성(토글 재-ON)은 사람 결정(HQ 응답)으로만.
- **(e) ON 의 3단계 이행**: stage 5 를 5a/5b/5c 로 세분한다(§rollout 갱신 참조) — **5a** `maxConcurrentClaims=1` 로 새 claim 경로만 활성(병렬 0, 메커니즘 자체를 무사고 검증) → **5b** `commitMode: direct` task 만 동시 claim 허용(충돌해도 코드가 아닌 문서) → **5c** pr-mode 포함 전면 병렬 + 30일 dogfood. 각 단계의 정확성 게이트 통과 후에만 다음 진입.

N=2 상한(§Decision 6)·cron@cloud direct-only 권장(§Decision 4)·server-time 의무(§Decision 5)·lock-하 atomic claim(§Decision 1)은 기본 ON 후에도 불변이다. 본 § 의 구현(STATE schema·select/pickup 재검증·integrator 의무·강등 분기 — LOOP/CLAUDE/concurrency.md 동기 포함)은 별도 task chain 으로 — 본 amend 는 설계 박제만.

### rollout — 단계적 + ROI break-even per stage

ADR-0020 multiTaskFire 토글 선례를 mirror 한 `flags.fineGrainedConcurrency: boolean`(기본 `false`) 기반 단계 rollout. 각 stage 가 ROI 양수 break-even 을 넘겨야 다음 진입:

1. **(direct) `flags` 자리 박제 + planner 독립-stream 분해 정책** — frontmatter `independentStream`/`dependsOn`/`touchesFiles` + planner 가 동시 claimable 한 독립 task 를 실제로 큐잉. **break-even**: 한 시점 독립 task ≥ 2 가 실증돼야(없으면 §Decision 0 이득 0 — 여기서 멈춤이 정당).
2. **(pr) claim registry schema + select+claim critical-section 구현** — claims.json + lock 하 atomic claim + staleness 회수 + PR-resume. **break-even**: 이중 claim 0 · orphan 회수 정상 동작 검증.
3. **(direct) §1 loop 재작성 + CLAUDE §10 / LOOP §4 동기** — critical-section lock + claim pickup 분기. ADR-0034 규율 흡수/정합. **break-even**: 두 driver 동시 무장 시 서로 다른 독립 task 진행 실증 + 충돌 없음.
4. **(pr) `.github` per-PR concurrency group** (§Decision 6). **break-even**: 동시 PR CI 가 서로 cancel 안 하고 비용이 N 선형 안에 머묾.
5. **(direct+pr) `flags.fineGrainedConcurrency = true` 기본-ON — §Decision 8 안전장치 선행 + 3단계 이행** (2026-06-10 T-0341 amend) — 위 1~4 머지 후, **먼저 §Decision 8 (a)~(d) 를 구현**(STATE `concurrencyIncidents` schema + select/pickup 런타임 재검증 + integrator merge-전 rebase 의무 + 회로 차단기 강등 분기 — LOOP §1[2]/CLAUDE §10/concurrency.md 동기 포함). 그 후 **5a → 5b → 5c 순 이행**: 5a `maxConcurrentClaims=1`(새 경로만 활성, 병렬 0) · 5b direct-only 병렬 · 5c 전면 병렬 + 30일 dogfood. **break-even**: 5a 메커니즘 무사고 · 5b 이중 claim 0 + bookkeeping 충돌 0 · 5c 실측 throughput 이득 > coordination 비용(중복/회수/충돌 흡수 오버헤드). 어느 단계든 §Decision 8 (d) 회로 차단기 임계 도달 시 자동 OFF 강등.

각 stage ≤ 300 LOC / ≤ 5 파일. 어느 stage 든 break-even 미달이면 진행 보류(채택 강제 없음 — §Status).

## Consequences

**장점**
- multi-machine + cron 동시 운용 시 implement/test/CI-wait idle 동안 독립 task 병렬 진행 → throughput 개선(독립 task 공급 전제).
- lock 점유 시간 단축(critical section 만) → lock 경합 표면 축소, idle hold 제거(2026-06-10 운영 피드백 즉시 가치 일부 실현).
- 기존 CAS 메커니즘(ADR-0028) 재사용 — 새 ref/외부 dependency 0. cloud proxy 호환 유지.

**비용 / 트레이드오프 (ROI)**
- **독립 task 부재 시 ROI ≤ 0**: 순차 chain 만 있으면 N driver 여도 이득 0 인데 claim/회수/관측 복잡도만 추가(§Decision 0). 그래서 기본 OFF + 독립 stream 분해가 break-even 의 전제.
- coordination 비용 신설: claim 원자성·orphan 회수·clock skew 보수화·코드 충돌 흡수·per-PR CI 그룹 — 전부 신규 운영 면. 이득이 이 비용을 넘는지는 stage 5 dogfood 로 실증.
- ADR-0009 의 "활성 driver 1개" 단순성 상실 — 디버깅·추론 난이도 증가(§Decision 7 관측성으로 완화).
- 채택까지 §rollout 5 stage(별도 task chain) 필요 — 본 ADR 은 설계 박제일 뿐 동작 변화 0.

## Alternatives

- **(A) 현행 coarse mutex 유지(ADR-0009/0028)** — 보류 가능한 정당한 결론. 독립 task 공급이 실증되지 않으면 fine-grained 이득 0 이라 현행 유지가 ROI 우위. 본 ADR 은 이 선택지를 §Status/§Decision 0 으로 명시 보존.
- **(B) multiTaskFire(ADR-0020) 확장으로 대체** — 기각. multiTaskFire 는 *한 driver 가 1 fire 안에서 N task 순차*(여전히 활성 driver 1개)라 multi-machine 병렬 idle 단축 목표를 못 푼다. 본 ADR 과 직교(둘 다 활성 가능하나 별 토글).
- **(C) lock 없는 planner 사전 task 분배** — 기각(ADR-0034 Alt C 동형 기각). 분배 자체가 race 매체를 새로 만들고 권위 직렬화를 잃는다. 본 ADR 은 claim 을 lock 하에서 박아 이 함정을 피한다.
- **(D) 별도 claim ref(`claude/claims`) 분리** — 기각. cross-ref split-brain 위험(ADR-0028 §Decision 5) + 두 CAS 평면의 원자성 결합 비용. lock ref 단일 tree 에 `claims.json` 동거가 원자성·관측성·credential 모두 우위.
- **(E) 본 ADR 채택 — critical-section lock + lock-하 atomic claim + 단계 rollout** — 채택(설계). 단 즉시 전환 아닌 토글 OFF + break-even gated rollout.
