# ADR-0009 — 강한 git-ref CAS lock + multi-machine 동일역할 운영 모델

## Status

PROPOSED (2026-06-01)

> ACCEPTED 전이는 본 ADR 의 Decision 을 반영하는 후속 개정 task —
> [docs/LOOP.md](../LOOP.md) §1 [1] · §4 개정 + [CLAUDE.md](../../CLAUDE.md) §10 개정
> + STATE schema `session` 필수화 — 가 머지된 직후 별도 direct commit 으로 수행한다.
> 그 전까지 driver loop 는 기존 약한 mutex (STATE.json 인메모리 lock) 로 동작하며,
> 전환 기간의 동시-진입 보호는 **운영 규율(실행자 1개)** + 필요 시 human lock(B 방식)으로 대체한다.

## Context

현 시스템의 동시-진입 보호는 **약한 mutex** 다. driver 는 `docs/STATE.json.lock` 을 인메모리로 점검·설정하고, 작업 결과를 commit 할 때 비로소 push 한다. lock 점검(read)과 push(commit-and-push) 사이에 시간 간격이 있어, 두 driver 가 같은 `lock=null` 을 동시에 관측하고 둘 다 진입할 수 있다 (read-then-push race). [CLAUDE.md](../../CLAUDE.md) §10 "동시 실행 정책" 은 이 lock 이 "git push 의 fast-forward 검사에 기대는 약한 mutex" 임을 명시하며, 안전을 **단일 operator / 단일 worktree** 전제 + 시간대 분리 정책으로 흡수해 왔다.

운영 시나리오가 이 전제를 깬다:

- **cron** — 사용자가 자리를 비울 때 백그라운드(Anthropic 클라우드)로 상시 가동. 매 발화가 fresh conversation (진정한 long-horizon backbone).
- **/loop** — 사용자가 자리에 있을 때 가동. **장소가 바뀌면 /loop 를 돌리는 기기도 달라진다** (multi-machine). 기기마다 별도 clone/worktree.
- 둘 다 동시에 무장(armed)되며, 동시 진입 시도가 실재한다.

추가로 실제 사고가 두 차례 관측됐다(본 ADR 의 직접 동기):

1. **stale worktree 오작동** — feature-branch worktree(예: `.claude/worktrees/*`)에서 `/loop` 를 돌리면, 그 worktree 의 로컬 `STATE.json` 이 origin/main 보다 수십 commit 뒤처져 있어 (read 전 fetch 부재) 큐잉된 task 를 못 보고 "할일 없음" 으로 무위 종료한다. push 한 곳(origin/main)과 loop 가 읽은 곳(stale worktree)이 달랐다.
2. **multi-machine staleness** — 기기 A 에서 잡은 lock 은 push 되기 전까지 기기 B 에 보이지 않는다. 로컬 파일 기반 lock 은 기기 간 공유가 불가능하다.

**부트스트랩 역설**: lock 을 고치는 작업 자체가 옛 약한 lock 위에서 돌아간다. 따라서 본 ADR 작성·머지 기간에는 사람이 **B 방식(human lock commit, [LOOP.md](../LOOP.md) §6)** 으로 cron 을 일시정지해 단일 active driver 를 보장한다. 단 human lock 도 60분 stale 탈취 대상이므로 단기(큐잉 구간) 보호용임을 전제한다.

본 ADR 은 [CLAUDE.md](../../CLAUDE.md) §10 마지막 단락("multi-operator 환경이 필요해지면 … 강한 mutex(별도 ADR 필요)로 전환")과 [docs/PLAN.md](../PLAN.md) "운영 정책 review backlog" 가 직접 예고한 결정이다.

## Decision

### (1) lock 취득을 별도의 원자적 step 으로 분리

driver 는 **작업을 시작하기 전에** lock 을 획득하고, **작업이 끝난 후** 해제한다. lock 획득/해제는 작업 결과 commit 과 분리된 독립 연산이며, 작업 전 구간을 lock 이 덮는다. 이는 "작업 끝에 결과와 함께 lock 을 push" 하던 기존 인메모리 방식과 대비된다.

### (2) lock 저장소 = 전용 git ref `refs/locks/driver`

lock 은 main 브랜치의 커밋된 파일이 아니라 **전용 ref** 에 둔다. main 히스토리를 더럽히지 않고, lock 경쟁과 콘텐츠 push 를 완전히 분리한다.

획득 절차:

```sh
# 1. 현 lock 상태 fetch (read 전 fetch 의무)
git fetch origin +refs/locks/driver:refs/locks/origin-driver

# 2. ref 가 비어있음(미존재) 또는 stale(60분 초과) 이면 lock blob 생성 후 CAS push
#    --force-with-lease 가 "내가 본 old-sha 일 때만 갱신" 을 강제 → 진짜 compare-and-swap
git push origin <new-lock-sha>:refs/locks/driver \
    --force-with-lease=refs/locks/driver:<observed-old-sha>

#    push 성공  → lock 획득. 작업 시작.
#    push reject → 경쟁 패배. 재 fetch → 여전히 held 면 즉시 종료(no-op).
```

해제도 동일하게 `--force-with-lease` CAS push (lock blob 을 빈 값/tombstone 으로 갱신). lock 내용(holder/session/since)은 ref 가 가리키는 blob 에 JSON 으로 직렬화한다.

`git push` 의 ref 갱신은 서버 측에서 원자적이므로, **N 개 기기가 동시에 push 해도 정확히 1개만 승리**한다. 이것이 multi-machine 환경에서 작동하는 유일하게 견고한 primitive 다 (cron 클라우드는 `gh` 가 끊겨도 `git` 은 살아있고, 모든 /loop 기기도 `git` 은 있다 — git remote 가 세 진입점의 유일한 공통분모).

### (3) holder 식별자 강화 + read 전 fetch 의무

lock blob 스키마:

```json
{
  "holder": "loop | cron | human",
  "session": "<holder>@<host>-<short-rand>",
  "since": "<ISO 8601>"
}
```

- **`session` 필수** — 같은 holder 카테고리(예: 두 기기의 loop)를 구분한다. `session` 이 직전과 다르면 `loopSessionTurnCount` 를 reset(기기 이동 = 새 session).
- **read 전 fetch 의무** — driver 는 lock 점검·STATE 읽기 전에 **반드시** `git fetch` 한다. stale worktree 무위 종료(Context 사고 1)의 근본 원인이 "read 전 fetch 부재" 이므로, 이를 hard rule 로 박는다. driver loop 는 origin/main 을 추적하는 체크아웃에서만 실행하며, feature-branch worktree 에서의 driver 실행은 금지한다.

### (4) stale 탈취도 CAS

60분 임계를 초과한 lock 의 탈취 역시 `--force-with-lease` CAS push 로 수행해 동시 탈취 시 1개만 승리하게 한다. `human` lock 도 60분 stale 탈취 대상임을 명시한다 — 즉 human lock(B 방식)은 **단기 보호용**이며, 장기간 cron 차단 용도로는 적합하지 않다(60분 후 cron 이 탈취 가능).

### (5) 역할 분리 없음 (동일 역할)

cron 과 /loop 는 **동일 역할** — 둘 다 모든 task 후보를 잡을 수 있다. lock 하나가 전 직렬화 부담을 짊어진다. 단, cron 클라우드가 pr-mode task 를 머지까지 완수하려면 `gh`/MCP 경로가 필요하다(현 cron-env `gh` 부재 이력 HQ-0006/8/9/10/13). 이 복구는 **별도 ADR/task** 로 분리한다(아래 Consequences). 그 ADR 이 머지되기 전까지 cron 이 pr-mode 를 잡으면 머지 단계에서 BLOCKED 될 수 있음을 운영상 인지한다.

## Consequences

**장점**

- 진짜 multi-machine 안전 — git ref CAS 로 N 개 기기 동시 push 중 1개만 lock 획득.
- main 히스토리 청결 — lock 연산이 main 에 commit 노이즈를 남기지 않는다.
- lock 경쟁과 콘텐츠 push 의 ref 분리 — FF reject 가 "lock 경쟁" 인지 "콘텐츠 경쟁" 인지 모호하지 않다.
- stale worktree 무위 종료 차단 — read 전 fetch 의무가 (3) 에 박힘.

**비용 / 후속 의무**

- driver prompt 가 ref 조작(`fetch +refs/...`, `push --force-with-lease`)을 학습해야 한다 → [LOOP.md](../LOOP.md) §1 [1] · §4 개정 필요.
- 사람이 lock 을 보려면 `git ls-remote origin refs/locks/driver` (커밋된 STATE.json 직독 대비 한 단계 추가).
- [CLAUDE.md](../../CLAUDE.md) §10 개정 — "single operator / 단일 worktree 전제" → "multi-entry strong-mutex" 모델로 갱신.
- STATE schema `session` 필수화 + data-model 문서 동기.
- **cron 환경 gh/MCP 복구 ADR + 구현** (결정 5 의 전제) — GitHub MCP path 우선 (gh CLI 설치는 [CLAUDE.md](../../CLAUDE.md) §5 "새 dependency" 판정 소지이므로 MCP 로 회피, [ADR-0005](ADR-0005-mcp-tools-for-pr-review-flow.md) 가 MCP path 정당화).
- 강한 mutex 도입 후에도 `--force-with-lease` 의 lease 갱신 타이밍·clock skew(60분 임계는 각 기기 NTP 동기 전제) 등 잔여 리스크는 운영 점검 대상.

## Alternatives

- **(a) 로컬 파일 / 인메모리 lock** — 기각. 기기 간 공유 불가(기기 A 의 lock 이 기기 B 에 안 보임). multi-machine 요구를 원천적으로 못 푼다.
- **(b) 커밋된 STATE.json 파일 lock 유지(현 방식)** — 기각. lock 과 콘텐츠가 같은 ref(main)를 두고 경쟁해 FF reject 의미가 혼재하고, lock 연산마다 main commit 노이즈. read-then-push race 도 그대로.
- **(c) GitHub API lock (Issue/label/deployment 등)** — 기각. cron 클라우드의 `gh` 부재 이력으로 불안정(HQ-0006/8/9/10/13). git remote 가 더 낮은 공통분모.
- **(d) 외부 lock 서버 (Redis / DynamoDB 등)** — 기각. 새 외부 dependency([CLAUDE.md](../../CLAUDE.md) §5 BLOCKED 사유) + 클라우드 도달성 불확실 + 운영 복잡도 증가. git ref CAS 로 충분.
