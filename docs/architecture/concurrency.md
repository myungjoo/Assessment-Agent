# Concurrency — fine-grained driver concurrency (claim registry)

본 doc 는 [ADR-0036](../decisions/ADR-0036-fine-grained-concurrency.md) fine-grained
concurrency 의 운영 view 를 박제한다. ADR-0036 은 ADR-0009/0028 의 "활성 driver
항상 1개" 모델을 **critical-section lock + claim 기반 N-driver 모델**로 전환한다
(ACCEPTED, buildThrough — 런타임 활성은 `flags.fineGrainedConcurrency` 토글이 ON
되는 stage 5 부터). 본 doc 는 그 중 **claim registry** 의 schema 와 select+claim
원자성을 운영 관점에서 기술한다 — 결정 본문은 ADR-0036 §Decision 1 이 권위다.

> **현 stage**: stage 2 slice 1 (T-0327) — claims.json schema 박제 +
> lock-하 atomic select+claim CAS primitive([scripts/select-claim.sh](../../scripts/select-claim.sh)) +
> 이중 claim 0 executable spec([scripts/select-claim.test.sh](../../scripts/select-claim.test.sh)).
> 토글 OFF — driver loop 동작 변경 0(forward-looking primitive + spec 만).

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

## §5 staleness 회수 / PR-resume (slice 2+ — 본 doc 의 forward-looking 범위)

driver 사망 시 orphan claim 은 lock stale 과 **동형 60분 임계**(server-time 기준,
§Decision 5)로 회수한다. 단 회수 전 PR-resume 우선: claim 에 `prNumber` 가 있으면
회수 driver 는 새 PR 을 만들지 않고 그 PR 을 resume(중복 PR 방지, ADR-0034 사고
메커니즘 직접 차단). 본 항목과 driver loop 통합(§1 loop 재작성), per-PR CI
concurrency group 은 stage 2 slice 2 / stage 3 / stage 4 의 책임이며 본 slice
(T-0327)의 범위 밖이다 — 토글 OFF 동안 forward-looking spec 으로 기능한다.

## §6 보존되는 ADR-0009/0028 invariant

ADR-0036 은 "활성 driver 항상 1개" invariant 만 깬다(lock 보유 driver 는 한 시점
1개지만 claim 보유 = task 진행 중 driver 는 N개). 다음은 **전부 불변**으로 보존:

- CAS 원자성, branch-ref 저장(ADR-0028), read 전 fetch 의무
- 60분 stale 임계, STATE single-writer(CLAUDE.md §9)
- counters origin+1 read-modify-write

lock 은 사라지지 않고 **범위만 critical section 으로 좁아진다**.
