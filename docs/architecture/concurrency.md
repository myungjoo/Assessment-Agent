# Concurrency — fine-grained driver concurrency (claim registry)

본 doc 는 [ADR-0036](../decisions/ADR-0036-fine-grained-concurrency.md) fine-grained
concurrency 의 운영 view 를 박제한다. ADR-0036 은 ADR-0009/0028 의 "활성 driver
항상 1개" 모델을 **critical-section lock + claim 기반 N-driver 모델**로 전환한다
(ACCEPTED, buildThrough — 런타임 활성은 `flags.fineGrainedConcurrency` 토글이 ON
되는 stage 5 부터). 본 doc 는 그 중 **claim registry** 의 schema 와 select+claim
원자성을 운영 관점에서 기술한다 — 결정 본문은 ADR-0036 §Decision 1 이 권위다.

> **현 stage**: stage 2 slice 2 (T-0328) — slice 1(claims.json schema +
> select+claim CAS primitive) 위에 **orphan claim staleness 회수(60분 server-time
> 임계) + PR-resume primitive**([scripts/reclaim-stale-claim.sh](../../scripts/reclaim-stale-claim.sh))
> + 회수 정상 동작 executable spec([scripts/reclaim-stale-claim.test.sh](../../scripts/reclaim-stale-claim.test.sh))
> 추가. 토글 OFF — driver loop 동작 변경 0(forward-looking primitive + spec 만).
> driver loop 통합(stage 3)·per-PR CI group(stage 4)·토글 ON(stage 5)은 미shipped.

## §1 claim registry — 저장 위치와 단일 CAS 평면

task 소유는 lock 이 아니라 **별도 claim registry** 로 표현한다 — 여러 driver 가
*서로 다른* task 를 동시에 소유·진행하게 하는 핵심이다. 저장 위치는 lock ref 와
**동일한 `refs/heads/claude/lock-driver` 브랜치 tip commit tree 의 추가 파일
`claims.json`**(배열)이다. 별도 ref 를 두지 않는 이유(ADR-0036 §Decision 1 / Alt D):

- ADR-0028 의 **단일 CAS 평면을 재사용**해 cloud proxy `claude/*` 허용 prefix 안에
  머문다(credential 0 유지).
- select+claim 을 lock 점유 하에서 **같은 commit** 으로 박제하면 원자성이 공짜(§3).
- ref 가 둘이면 cross-ref split-brain 위험이 새로 생긴다(ADR-0028 §Decision 5 정합).

lock blob(`lock.json`)과 `claims.json` 이 같은 commit 에 동거하므로 단일 조회
(`git show refs/heads/claude/lock-driver:claims.json`)로 lock + 모든 claim 을 본다
(§Decision 7 관측성).

## §2 claims.json schema (ADR-0036 §Decision 1 — 그대로 박제)

`claims.json` 은 task 소유 1건을 원소로 하는 **배열**이다. 각 원소:

```json
{
  "taskId":    "T-NNNN",
  "owner":     "<session — <holder>@<host>-<rand>, lock blob session 동형>",
  "claimedAt": "<ISO 8601 — server time 기준, §Decision 5 clock-skew 보수화>",
  "status":    "CLAIMED | IN_PROGRESS | PR_OPEN | DONE",
  "prNumber":  null
}
```

| 필드 | 타입 | 의미 |
| --- | --- | --- |
| `taskId` | string | 소유 대상 task id(`T-NNNN`). claimed-set 의 키. |
| `owner` | string | claim 주체 session(`<holder>@<host>-<rand>`, lock blob session 동형). |
| `claimedAt` | ISO 8601 string | claim 시각 — **server time 기준**(GitHub API `Date` 헤더 / `gh run` UTC). 로컬 `date` 직접 사용 금지(clock-skew → staleness 오판, §Decision 5). |
| `status` | enum | `CLAIMED`(선택 직후) → `IN_PROGRESS` → `PR_OPEN`(pr-mode) → `DONE`. |
| `prNumber` | int \| null | pr-mode 진행 시 열린 PR 번호. staleness 회수 시 PR-resume 의 키(slice 2). |

본 schema 는 (a) [scripts/select-claim.sh](../../scripts/select-claim.sh) 헤더 주석과
(b) 본 § 두 곳에 박제된다(task T-0327 Acceptance — 단일 권위는 ADR-0036 §Decision 1).

## §3 select+claim 원자성 (이중 claim 0 — 정확성 게이트)

select+claim 은 **반드시 lock(critical section) 하에서** 수행한다(ADR-0036
§Decision 1 "원자성"). [scripts/select-claim.sh](../../scripts/select-claim.sh) 의
절차:

1. lock ref 의 현재 tip(old-sha)을 읽고 거기서 `claims.json` 을 읽는다(read 전 fetch).
2. 이미 claim 된 task(claimed-set)를 후보에서 제외한 **첫 claimable task 1개**를
   선택한다. claimable 부재 시 non-zero exit + "no claimable task".
3. 자기 claim 을 `claims.json` 에 append 한 새 commit 을 만들어(같은 commit 에 lock
   tombstone 동반 = 즉시 release) lock ref 에 `--force-with-lease=<ref>:<old-sha>`
   로 **CAS push** 한다.
4. lease-stale(그 사이 다른 driver 가 claim 박제 → ref 이동)이면 push 거부 → claims
   재독 후 재시도(최대 N회).

**claim 박제가 release 이전**에 같은 CAS commit 으로 일어나므로 두 driver 가 같은
task 를 이중 claim 하지 못한다 — ADR-0009 의 CAS 원자성이 claim 직렬화까지 커버한다.
이 "이중 claim 0" 가 ADR-0036 §rollout 2 의 **정확성 break-even 게이트**이며,
[scripts/select-claim.test.sh](../../scripts/select-claim.test.sh) 가 bare-repo +
2 clone self-contained 로 happy / 이중 claim 0 / claimable 부재 / stale-lease 거부
4 종을 박제해 CI(`select-claim CAS 검증` step)에서 매 PR 강제한다.

## §4 동시 claimable 조건 (planner 사전 인코딩)

N driver 의 throughput 이득은 **동시 진행 가능한 독립 task 의 존재**에 달렸다
(ADR-0036 §Decision 0 — 순차 chain 만 있으면 이득 0). 동시 claim 안전은 런타임
충돌 탐지가 아니라 **큐잉 단계 회피**로 보장한다. 동시 claimable 조건(셋 모두 충족):

- (a) **파일-disjoint** — 두 task 의 변경 파일 집합이 겹치지 않음(특히 `src/`).
- (b) **의존성 없음** — 미머지 task 에 의존하지 않음(`dependsOn` 전부 머지됨).
- (c) **같은 `commitMode` 권장**.

planner 가 task frontmatter 에 `independentStream` + `dependsOn` + `touchesFiles`
를 박제해 사전 인코딩한다(stage 1, T-0326 도입). select-claim 단계는 본 slice 에서
**claimed-set 제외만** 구현하며, `dependsOn` 미머지 등 **런타임 의존성 평가는
호출측 책임**(§Decision 3, slice 2+)이다 — select-claim.sh 주석에 경계 명시.

## §5 staleness 회수 / PR-resume (shipped: scripts/reclaim-stale-claim.sh)

driver 사망 시 orphan claim 은 lock stale 과 **동형 60분 임계**(server-time 기준,
§Decision 5)로 회수한다. 단 회수 전 PR-resume 우선: claim 에 `prNumber` 가 있으면
회수 driver 는 새 PR 을 만들지 않고 그 PR 을 resume(중복 PR 방지, ADR-0034 사고
메커니즘 직접 차단).

**shipped (stage 2 slice 2, T-0328)**:
[scripts/reclaim-stale-claim.sh](../../scripts/reclaim-stale-claim.sh) 가 lock-하에서
`claims.json` 을 읽어 회수를 수행하는 primitive 다. 절차:

1. lock ref tip 의 `claims.json` 을 읽고(read 전 fetch) 각 claim 의 `claimedAt`
   과 주입된 **server-time now** 의 차가 **60분 임계 초과**인 orphan 을 식별한다.
2. orphan 을 `prNumber` 로 분기한다 — **(a) `prNumber == null`** 이면 `claims.json`
   배열에서 단순 제거(회수), **(b) `prNumber != null`** 이면 제거하지 않고 owner 를
   회수 driver 로 교체(prNumber 보존)하고 `RESUME prNumber=<n> taskId=<T-NNNN>`
   신호를 stdout 에 박제한다(중복 PR 방지 — ADR-0034 사고 메커니즘 직접 차단).
3. 회수 결과를 lock tombstone(즉시 release) 동반 commit 으로 `--force-with-lease`
   CAS push 한다(동시 회수 시 1개만 성공 = 이중 회수 0, select-claim.sh mirror).

**server-time now 주입 계약 (§Decision 5 clock-skew 보수화)**: 회수 판정의 now 는
env `RECLAIM_NOW` / 인자로 **주입**받는다. **미주입 시 회수를 보류**한다(변경 0 —
"server-time 확보 불가 시 회수 보류"). 실제 server-time fetch(GitHub API `Date`
헤더 / `gh run` UTC) 와 실제 PR resume 실행(`gh pr checkout` 등)은 **호출측(stage
3 driver loop) 책임**이다 — 본 primitive 는 신호(RESUME 출력 + owner 교체)만 박는다.

회수 정확성은 [scripts/reclaim-stale-claim.test.sh](../../scripts/reclaim-stale-claim.test.sh)
가 bare-repo + 2 clone self-contained 로 happy 회수 / PR-resume / live 보존 /
now 미주입 보류 / stale-lease 거부 / 이중 회수 0 / no-op 7 종을 박제해 CI
(`reclaim-stale-claim 검증` step)에서 매 PR 강제한다.

**미shipped (후속 stage)**: driver loop 통합(§1 loop 재작성 — loop 가 언제
reclaim-stale-claim.sh 를 호출하고 server-time now 를 주입하는지)은 **stage 3**,
per-PR CI concurrency group(§Decision 6)은 **stage 4**, `flags.fineGrainedConcurrency
= true` 토글 ON 은 **stage 5** 책임이다 — 토글 OFF 동안 본 primitive 는
forward-looking spec 으로 기능한다(driver 동작 변경 0).

## §6 보존되는 ADR-0009/0028 invariant

ADR-0036 은 "활성 driver 항상 1개" invariant 만 깬다(lock 보유 driver 는 한 시점
1개지만 claim 보유 = task 진행 중 driver 는 N개). 다음은 **전부 불변**으로 보존:

- CAS 원자성, branch-ref 저장(ADR-0028), read 전 fetch 의무
- 60분 stale 임계, STATE single-writer(CLAUDE.md §9)
- counters origin+1 read-modify-write

lock 은 사라지지 않고 **범위만 critical section 으로 좁아진다**.

## §7 stage 5 기본-ON 안전장치 5종 + 3단계 이행 (ADR-0036 §Decision 8, 2026-06-10 T-0341 amend — 인지 박제)

stage 5 의 `flags.fineGrainedConcurrency = true` 기본-ON 전환은 "최악 동작이 coarse
단일-driver(ADR-0009) 와 정확히 같다"는 원칙 위에서만 안전하다. ADR-0036 §Decision 8
은 그 원칙을 다음 5종 안전장치로 박제하며, §rollout stage 5 를 5a/5b/5c 로 세분한다.
본 §7 은 **인지 박제만** — 결정 본문은 ADR-0036 §Decision 8 권위, 현 stage blockquote
(stage 2 slice 2 = 현 shipped, stage 3~5 미shipped)는 그대로 유지된다.

- **(a) fail-safe 강등** — claim-pickup 분기에서 판정 불확실(claims.json 파싱 실패·
  schema 불일치·후보 frontmatter 누락·server-time 미확보) 시 단일-task 경로로 fallback
  (§5 reclaim 의 fail-closed 계약을 select 면으로 확장). driver 책임 — [LOOP.md §1[2]](../LOOP.md) 박제.
- **(b) claim 시점 런타임 재검증** — driver 가 후보의 `touchesFiles` 가 활성 claim 의
  `touchesFiles` 와 교집합 0 인지, `dependsOn` 전원이 origin/main 머지됐는지 select
  단계에서 검사. §4 의 "런타임 의존성 평가는 호출측 책임" 유보가 본 (b) 로 driver
  의무로 확정된다(planner 큐잉 사전 인코딩의 2차 방어).
- **(c) integrator merge 직전 rebase + CI green 재확인** — 파일-disjoint 라도 semantic
  conflict 가능 → 4-게이트(CLAUDE.md §3.3) 통과 후 squash 직전 PR head 의 main 포함
  확인, 뒤처졌으면 update-branch/rebase 후 CI 재확인. [LOOP.md §4](../LOOP.md) 박제,
  실 구현은 `.claude/agents/integrator.md` 후속 task.
- **(d) `concurrencyIncidents` 회로 차단기** — STATE 카운터의 같은 유형
  (`double-claim` / `merge-conflict-code` / `reclaim-misfire` / `ci-cost-overrun`) 2회
  누적 시 driver 가 lock-하 `flags.fineGrainedConcurrency = false` 로 자동 강등 +
  notifier. CI 3연속 fail BLOCKED 와 동형 self-healing — 재활성은 사람 결정. STATE
  schema 박제는 별도 task.
- **(e) 3단계 이행** — §rollout stage 5 = **5a** `maxConcurrentClaims=1`(메커니즘만
  활성, 병렬 0) → **5b** `commitMode: direct` task 만 동시 claim 허용(코드 충돌 0) →
  **5c** pr-mode 포함 전면 병렬 + 30일 dogfood. 각 단계 정확성 게이트 통과 후 다음 진입.

§Decision 8 (a)~(d) 의 구현은 전부 shipped — (d) schema(T-0343) + 강등 분기(T-0344) +
incrementing 4 탐지 시점(T-0347), (c) integrator merge-전 rebase(T-0345), (a)(b) 런타임
재검증 primitive(T-0346, validate-claim-candidate.sh). **5a 진입도 shipped(T-0348)**:
`flags.fineGrainedConcurrency = true` + `flags.maxConcurrentClaims = 1` — claim-pickup
경로([LOOP.md §1[2]](../LOOP.md))가 처음 런타임 활성됐고, maxConcurrentClaims 게이트
(LOOP §1[2] (a2))가 동시 claim 을 1개로 묶어 병렬 0 — 최악 동작 = coarse
단일-driver(ADR-0009)와 동일하다. §7 (d) 회로 차단기 강등 시 토글은 OFF 로 자동
복귀한다(재활성은 사람 결정).

**5a→5b 정확성 게이트**: 5b(`commitMode: direct` task 동시 claim 허용 +
`maxConcurrentClaims` 상향) 진입은 claim 경로 **실사용 fire** 에서 (i) claim
박제·release 가 정상 동작하고 (ii) `concurrencyIncidents` 4 유형(`double-claim` /
`merge-conflict-code` / `reclaim-misfire` / `ci-cost-overrun`)이 **전부 0 유지**됨을
관측한 후에만 — 별도 task 로 진행한다. 5c(전면 병렬 + 30일 dogfood)도 동형으로 5b
게이트 통과 후 별도 task.

## §7.1 `concurrencyIncidents` schema 운영 view (shipped: T-0343 — 회로 차단기 (d) 1/2)

§7 (d) 회로 차단기의 데이터 자리. `docs/STATE.json` 의 `counters` 인접에
`concurrencyIncidents` object 가 박제돼 있으며, ADR-0036 §Decision 8 (d) 의 4 유형
슬러그를 카운터 key 로 0 초기화한다:

| 슬러그 | 의미 (언제 driver 가 +1 하는가 — incrementing 은 후속 slice) |
| --- | --- |
| `double-claim` | 같은 taskId 를 두 driver 가 이중 claim 한 정황 탐지(이론상 lock-하 atomic select+claim 으로 0 이어야 함 — §3) |
| `merge-conflict-code` | 파일-disjoint 인코딩이 틀렸거나 semantic conflict 로 코드 영역 rebase 충돌 BLOCKED(§4·LOOP §4) |
| `reclaim-misfire` | clock-skew 등으로 살아있는 claim 을 orphan 으로 오회수(§5 server-time fail-closed 가 1차 방어) |
| `ci-cost-overrun` | 동시 PR CI run 이 비용 상한(N 선형)을 넘김(§Decision 6 per-PR concurrency group 이 1차 방어) |

**강등 계약(권위 = ADR-0036 §Decision 8 (d))**: 같은 유형 카운터가 **2회 누적**되면
driver 가 lock(critical section)-하에서 `flags.fineGrainedConcurrency = false` 로 자동
강등하고 notifier(HQ)로 보고한다 — "CI 3연속 fail → BLOCKED" 와 동형 self-healing 이라
사람이 부재해도 사고가 누적되지 않고, 기본 ON 을 one-way door 로 만들지 않는 보험이다.
재활성(토글 재-ON)은 사람 결정(HQ 응답)으로만.

**본 slice 경계(T-0343)**: schema **자리 + 0 초기화 + 본 운영 view** 만이다. 토글
(`flags.fineGrainedConcurrency`)은 `false` 불변, driver 동작 변화 0(forward-looking).
실제 incrementing 로직(언제 어느 유형을 +1) 과 강등 분기(LOOP §1[2] 의 "2회 → 자동
OFF + notifier")는 **후속 slice** 책임이며 본 schema 자리에 의존한다. 단일 권위
본문은 ADR-0036 §Decision 8 (d).
