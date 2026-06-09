# ADR-0034 — cloud 진입점의 권위 lock CAS 의무화 (lock-bypass 중복-PR 사고 차단)

## Status

PROPOSED (2026-06-09)

> [ADR-0009](ADR-0009-strong-ref-cas-lock.md)(강한 ref-CAS mutex) + [ADR-0028](ADR-0028-cloud-proxy-branch-lock.md)(lock 저장소를 `claude/lock-driver` 브랜치로 이전)의 **운영 규율만** 강화한다 — CAS 메커니즘·저장 위치·schema 결정은 그대로 불변. 본 ADR 은 "cloud 진입점이 lock CAS 를 *건너뛸* 수 있다"는 빈틈을 닫는다.

## Context

ADR-0028 은 lock 저장소를 cloud proxy 가 허용하는 `refs/heads/claude/lock-driver` 브랜치로 옮겨 **cron@cloud 도 credential 0 으로 자율 lock CAS 가 가능**하게 만들었다. 설계 의도는 "세 진입점(cron + 여러 기기 `/loop`)이 모두 같은 ref 를 두고 경쟁 → 어느 순간에도 활성 driver 1개"였다.

그런데 **2026-06-09, 이 mutex 가 우회되어 중복 작업 사고가 발생했다.**

### 1차 증거 — 두 cloud `/loop` 세션이 같은 task 를 동시 수행

- 두 cloud `/loop` 세션 `loop@cloud-turn-cap-5` / `loop@cloud-turn-cap-10` 이 동시에 깨어나 **같은 작업**(Q-0029 결정 + ADR-0033 + T-0297)을 각자 수행했다.
- 결과: **중복 PR** — PR #246(`claude/loop-turn-cap-10-n6hs91`) 과 PR #247(`claude/loop-turn-cap-5-…`)이 같은 역할로 생성. #247 이 먼저 머지되며 #246 은 superseded → closed, 이어 #248 이 뒷정리에 소요됐다(낭비된 LLM/CI/리뷰 비용).
- 사고 시점 권위 lock `refs/heads/claude/lock-driver` tip 은 `38c22fab…` 로 **두 세션 누구도 건드리지 않았다**. 즉 mutex 직렬화가 전혀 작동하지 않았다.

### 근본 원인 — "못 잡은" 게 아니라 "안 잡은"

사고 세션의 STATE.json lock 노트와 PR #248 본문이 직접 자백한다:

> "gh 부재 + main 직접 push 불가 제약이라 작업을 feature branch + draft PR 로 외화. 권위 `claude/lock-driver` 미변경."

세션은 **두 환경 제약을 lock 과 무관한데도 lock-skip 근거로 잘못 결부**시켰다:

1. **gh 부재** — 사실이나 lock CAS 는 `gh` 가 아니라 raw `git push` 로 수행한다. **lock 과 무관.**
2. **main 직접 push 불가** — 사실이고 `commitMode: direct` 커밋에는 영향을 준다. 그러나 lock 은 main 이 아니라 `claude/*` 에 있다. **lock 과 무관.**

두 제약 다 lock 획득을 막지 않는데, 세션이 lock 을 "비권위 mirror" 로만 취급하고 권위 ref CAS 를 **시도조차 하지 않았다**. ADR-0028 의 LOOP.md 서술이 cloud 환경에서 "권위 미변경, mirror 동기만" 으로 합리화할 여지를 남긴 것이 빈틈이었다.

### 2차 증거 — cloud 진입점은 lock CAS 를 *물리적으로 수행할 수 있다*

본 ADR 작성 환경(cloud `/loop` proxy: `http://local_proxy@…/git/…`)에서 직접 실측:

- cloud 세션이 만든 `claude/loop-turn-cap-*` feature 브랜치들이 origin 에 실재 — `claude/*` push 동작 확인.
- `git push --dry-run origin HEAD:refs/heads/claude/_probe` → `* [new branch]` (proxy 허용) — lock 이 free 일 때의 zero-sha CAS(브랜치 생성)와 동일 연산.
- `git push --dry-run --force-with-lease=refs/heads/claude/lock-driver:<tip> …` → proxy 거부 없음.

즉 lock ref 는 `claude/*` 허용 prefix 안에 있어(ADR-0028 이 일부러 그렇게 옮김) **cloud 진입점도 lock CAS 가 가능**하다. 보강은 cloud 세션을 영구 no-op 으로 만들지 않는다 — 막혀서 못 잡던 게 아니므로 제대로 lock 을 잡고 직렬화된다.

## Decision

### (1) lock CAS 는 모든 진입점의 **무조건 선행 의무** — skip 근거 없음

cron · 로컬 `/loop` · cloud `/loop` · headless 어느 진입점이든, **작업(executor 호출 / commit / PR 생성)을 시작하기 전에 권위 `refs/heads/claude/lock-driver` CAS 획득을 반드시 시도**한다. lock 을 "mirror 만 쓰고 진행" 하는 경로는 **금지**한다.

### (2) `gh 부재`·`main push 불가` 는 lock-skip 근거가 **아니다**

- lock CAS 는 raw `git push … --force-with-lease` 로 수행하며 `gh` 에 의존하지 않는다.
- lock 저장소는 `claude/lock-driver`(허용 prefix)이며 main 이 아니다 — main push 차단과 무관.
- 따라서 두 제약은 ADR-0028 의 pr-mode stand-down 판정(gh·MCP 둘 다 부재 시 pr-mode task no-op)에는 영향을 주지만, **lock 획득 자체를 면제하지 않는다.**

### (3) lock 미획득(경쟁 패배) 시 = **stand-down(no-op 종료)**, 격리 병렬 작업 금지

권위 CAS 가 reject 되거나 다른 holder(since < 60분)가 점유 중이면, 해당 진입점은 **즉시 no-op 종료**한다. "lock 은 못 잡았지만 feature branch + draft PR 로 격리해서 진행" 하는 패턴은 **금지** — 이것이 #246/#247 중복-PR 사고의 직접 메커니즘이었다. 작업 결과를 외화할 곳이 없다면 그냥 종료하고 lock 보유 driver / 다음 fire 에 맡긴다.

### (4) `git push` 권한 자체가 없는 극단 환경의 명시적 분기

만에 하나 진입점이 `claude/*` push 권한조차 없다면(ADR-0028 의 403 패턴 재발 등), lock CAS 도 불가하므로 (3)에 의해 **무조건 stand-down** 한다. 이 경우에도 "lock 없이 작업 외화" 는 금지 — credential/proxy 한계는 BLOCKED 가 아니라 no-op 종료로 흡수한다(ADR-0028 Decision 정합).

## Consequences

**장점**

- 중복-PR 사고(#246/#247)의 직접 원인 차단 — 모든 진입점이 단일 CAS 평면에서 직렬화되어 "활성 driver 1개" invariant 복원.
- cloud 진입점도 lock 을 정상 사용(2차 증거로 실측) — credential 0 자율 long-horizon 의도(ADR-0028) 가 실제로 성립.
- "환경 제약 → lock skip" 합리화 경로를 문서에서 봉쇄.

**비용 / 트레이드오프**

- cloud `/loop` 세션이 lock 경쟁에서 지면 즉시 종료 → 사용자가 옆에 있어도 "아무것도 안 하고 끝남" 경험 가능. 단 이는 의도된 동작(중복 방지 > 무위 작업).
- LOOP.md §1[1]·§4 + CLAUDE.md §10 문구 동기 필요(아래 Follow-up).

**Follow-up (ACCEPTED 전이 gate)**

1. (본 PR) [docs/LOOP.md](../LOOP.md) §1[1] 에 "cloud 포함 모든 진입점 lock CAS 의무 + gh부재/main-push 불가는 skip 근거 아님 + 미획득 시 stand-down" 명문화, §4 에 cloud 진입점 규율 추가.
2. (본 PR) [CLAUDE.md](../../CLAUDE.md) §10 "동시 실행 정책" 에 동일 규율 한 줄 동기.
3. (운영 검증) 보강 머지 후, 두 cloud `/loop` 를 동시에 무장했을 때 한쪽만 진행(다른 쪽 no-op)하는지 + cloud 진입점의 실제 update-force-push CAS 가 격리 probe 브랜치에서 착지하는지 검증(2차 증거의 no-op dry-run 잔여 불확실성 closeout).

## Alternatives

- **(A) 현행 유지(cloud 는 mirror-only 격리 작업 허용)** — 기각: #246/#247 이 증명한 중복-PR 사고가 재발한다. mutex 의 존재 의의가 무력화된다.
- **(B) STATE.json `currentTask` 클레임으로 중복 회피** — 기각/보완 불가: STATE 는 single-writer(§9) + 비권위 mirror 라 race-safe 클레임 매체가 아니다. 권위 직렬화는 ref CAS 만이 보장(ADR-0009).
- **(C) cloud 세션의 작업을 lock 없이 허용하되 planner 가 task 를 사전 분배** — 기각: work-partitioning 은 별도 동기화 문제를 새로 만들고(누가 분배? 분배 자체가 race), 본 시스템의 모델은 mutual-exclusion(1개씩 직렬) 이지 병렬 분배가 아니다.
- **(D) 본 ADR 채택 — 모든 진입점 lock CAS 의무 + 미획득 시 stand-down** — 채택. 기존 CAS 메커니즘 재사용, 새 dependency 0, 사고 직접 원인 차단.
