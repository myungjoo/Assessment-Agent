---
id: ADR-0020
title: multi-task fire 활성화 결정 — 한 cron fire 안에서 task 2개까지 연속 진행(N=2) / 적용 대상 cron 한정(/loop 제외) / chain 허용은 §2.5 조건 (a)~(e) 5개 모두 충족 시에만 / FIRE-BATCH marker 형식 확정 / §10 cron 간격 (2×평균)×2 재조정 근거 / 30일 dogfood + rollback 조건 / cloud cron refs/locks 403 한계로 실효는 direct-mode doc-task chain 위주
status: ACCEPTED
date: 2026-06-03
relatedTask: T-0197
supersedes: null
---

# ADR-0020 — multi-task fire cron N=2 활성화 결정

## Status

ACCEPTED (2026-06-03)

> [CLAUDE.md §2.5](../../CLAUDE.md) 가 forward-looking spec 으로만 박제하고 **기본 OFF** 로 둔
> multi-task fire (한 cron fire 안 task 2개 연속 진행) 를 **활성 결정**하는 ADR.
> §2.5 "기본 OFF 의 의미" 가 명시한 4단계 활성화 step 중 **step 1 (ADR 작성)** 에 해당한다.
> 사용자가 활성화를 **직접 승인**했으므로(아래 Context) 즉시 ACCEPTED.

## Context

[CLAUDE.md §2.5](../../CLAUDE.md) (multi-task fire 실험적, 기본 OFF) 는 cron 1 fire 1 task 패턴이 매 task 마다 지불하는 **cold-start tax** (CLAUDE.md / STATE / PLAN / journal 재로드 ~ 15k tok / fire) 를 완화하기 위해, 한 cron fire 안에서 **task 2개까지 연속 진행**하는 opt-in 경로를 사전 박제했다(T-0078). 그러나 활성화는 별도 ADR + `docs/STATE.json.flags.multiTaskFire = true` 토글로만 가능하도록 **기본 OFF** 로 묶어 두었다. §2.5 "기본 OFF 의 의미" 는 활성화를 4 step 으로 분해했고, **그 step 1 이 본 ADR 작성**이다.

### 승인 출처

본 결정은 planner 추론이 아니라 **사용자의 직접 승인**이다(T-0197 frontmatter `plannerNote` — user-interactive injection, planner bypass):

- **대화** — 사용자가 "cron 에 대해 N=2 로 올려 시행" 을 결정.
- **AskUserQuestion 2종으로 scoping 확정**:
  1. **시행 방식** = loop 파이프라인. 본 ADR + 후속 doc task 들을 작업 큐에 주입하고, 자율 driver loop 이 reviewer / CI 게이트를 거쳐 실행한다(사람이 매 step 을 손으로 머지하지 않음).
  2. **적용 범위** = **cron 한정**. `/loop` turn 안의 2-task chain 은 본 활성화 범위에서 **제외**한다(추후 별도 결정).

### 환경 제약 (정직하게 박제해야 할 사실)

이 저장소의 cron 은 **cloud cron** 이고 `refs/locks/*` push 가 403 이라 [ADR-0009](ADR-0009-strong-ref-cas-lock.md) 의 ref-CAS lock 을 잡지 못해 **pr-mode task 에서 stand down** 한다(MEMORY: cloud-cron-ref-push-403; [ADR-0010](ADR-0010-cron-github-mcp-pr-mode.md) (3) graceful degradation). 실질 driver 는 로컬 `/loop` 다. 따라서 "cron N=2" 의 실제 효과는 **direct-mode doc-task 2개 chain 정도로 제한적**이다 — 이 한계는 본 ADR 의 Consequences 에 정직하게 명시한다.

## Decision

### (1) 활성 범위·상한 — N=2, cron fire 한정

- **N=2** (한 cron fire 당 task 최대 2개). 직전 task 완료 후 §2.5 활성화 조건이 모두 충족되면 같은 fire 안에서 두 번째 task 1개에만 추가 진입한다.
- **N≥3 은 본 ADR 도 금지** — 추가 상향(N 을 3 이상으로)은 **별도 ADR** 로만 가능하다. 본 ADR 은 N 의 상한을 2 로 못 박는다.
- **적용 대상 = cron fire 한정**. `/loop` turn 안의 2-task chain 은 본 ADR 범위에서 **명시적 out-of-scope** (사용자 cron-only 결정). `/loop` 는 사람이 옆에 있는 short-sprint 도구이고(CLAUDE.md §10), 무감독 누적 risk 가 있어 본 활성화에 포함하지 않는다. `/loop` 의 multi-task chain 은 추후 별도 결정으로 미룬다.

### (2) chain 허용 조건 — §2.5 (a)~(e) 5개 모두 충족 시에만

cron fire 의 두 번째 task 진입은 [CLAUDE.md §2.5](../../CLAUDE.md) "활성화 조건 (5개 모두 충족 시에만 chain 허용)" 5조건을 **verbatim 재참조**하며, 5개가 **모두 true** 일 때만 허용한다(하나라도 false → §2 step 7 그대로 1 task 후 종료):

- **(a) Sub-agent 격리** — 직전 task 를 `executor` sub-agent 1회 호출로 처리했고, driver 가 받은 응답이 ≤ 200 char SUMMARY + 표준 trail blob 뿐(CLAUDE.md §4, §11). raw output / 긴 log 를 driver context 로 끌고 오면 chain 자동 차단. driver 책임 self-enforce.
- **(b) N ≤ 2** — 한 fire 의 task 수 최대 2. 3 이상은 §2.5 가 명시적으로 금지 — N 상향은 별도 ADR 로만 가능.
- **(c) 실패 시 즉시 종료** — 직전 task 가 `BLOCKED`, CI fail, push contention, merge conflict 중 하나라도 발생하면 chain 중단 + fire 종료. notifier 호출은 CLAUDE.md §5.
- **(d) Lock 45분 임계** — `STATE.json.lock.since` 로부터 경과 시간 ≥ 45분이면 추가 task 진입 금지(§2 step 2 의 60분 stale 임계 보호 — 두 번째 task 가 lock holding 을 60분 너머로 끌고 가는 시나리오 차단).
- **(e) commitMode mixed chain 금지** — 같은 `commitMode` 끼리만 chain 허용(direct + direct OR pr + pr). direct + pr 또는 pr + direct 혼합은 §3.2 R-114 CI 검증 경계가 모호해 §2.5 가 명시 금지.

### (3) marker 형식 확정 — `FIRE-BATCH: <task1>+<task2>`

chained fire 의 두 task commit trail footer 에 **`FIRE-BATCH: <task1>+<task2>`** 형식을 박제한다(예: `FIRE-BATCH: T-0210+T-0211`). 이 marker 는 commit message footer (trail blob 인접) 에 들어가며, 한 fire 가 2 task 를 묶었음을 외화한다.

- reviewer agent 는 PR 검토 시(또는 direct commit log 점검 시) 이 marker 로 **fire 구조를 인지**하고, §2.5 조건 (a)~(e) 미충족 chain 을 **MINOR finding 으로 catch** 한다(§2.5 "활성 시 위반 처리" — CI 가 별도 정상 통과했다면 MINOR 분류).
- marker 형식의 정밀 위치 / 파싱 규칙(LOOP.md 의 어느 step 에서 박는지)은 활성화 step 3 (LOOP.md cron chain 분기) 에서 구현 명세로 확정한다 — 본 ADR 은 **형식 문자열만** 확정.

### (4) §10 cron 간격 재조정 — `(N × 평균 task) × 2` = `(2 × 평균) × 2`

[CLAUDE.md §10](../../CLAUDE.md) "동시 실행 정책" 의 "cron 간격 ≥ 평균 task 소요시간 × 2" 는 multi-task fire 활성 시 **`(N × 평균 task 소요시간) × 2` = `(2 × 평균) × 2`** 로 scale 해야 한다.

- **근거**: §2.5 (d) 의 lock 45분 임계가 §2 step 2 의 **60분 stale 임계를 넘지 않도록 보호**하려면, 한 fire 가 2 task 를 도는 동안 lock 점유가 60분을 넘지 않아야 한다. cron 간격을 `(2 × 평균) × 2` 로 잡으면 두 번째 fire 가 첫 fire 의 2-task 진행과 겹쳐 무의미한 wake / 즉시 종료를 양산하는 비용을 줄이고, 두 번째 task 가 lock holding 을 60분 너머로 끌고 가는 시나리오를 간격 측면에서도 차단한다.
- 실제 cron 간격 **수치 변경**(예: 30분 → 60분)은 **Follow-up direct task** 가 §10 본문에 반영한다(아래 롤아웃 step 4). 본 ADR 은 **공식 + 근거만** 박제하고 수치를 직접 바꾸지 않는다.

### (5) 30일 dogfood + rollback 조건

활성 후 **첫 30일은 dogfood 관찰 기간**이다(§2.5 "활성 후 첫 30일은 dogfood 기간").

- **관찰 지표**: 위반 발생(조건 미충족 chain) / context 누적 증후(driver context 가 fire 안에서 자라는 징후) / race(lock 직렬화 우회) / push contention(겹치는 push 충돌).
- **rollback 조건**: 위 지표 중 **사고 1건이라도 재발**하면 즉시 `STATE.json.flags.multiTaskFire = false` 로 **토글 OFF**(별도 direct commit) 하거나, 구조적 문제로 판단되면 **§2.5 자체 폐기**를 검토한다.
- 30일 후: 무사고면 ADR-0020 을 "dogfood 통과" 로 갱신, 사고 기록이 있으면 위반 / 누적 / race 정황을 ADR 에 추가하고 rollback / 완화 결정.

### (6) 활성화 롤아웃 시퀀스 (step 1 = 본 ADR)

§2.5 "기본 OFF 의 의미" 의 활성화 4 step 을 **순서·의존성과 함께** 박제한다. 각 step 은 **별도 task** 다:

| step | 내용 | commitMode | 선행 조건 |
| --- | --- | --- | --- |
| **1** | **본 ADR-0020 작성** — trade-off 박제 + N=2 명문화 + dogfood 30일 + marker 형식 + §10 재조정 근거 + 활성 결정 근거 | pr | (없음 — 본 task T-0197) |
| 2 | `docs/STATE.json` schema 에 `flags.multiTaskFire: false` 필드 추가 + `docs/architecture/data-model.md` 또는 schema 문서 동기 | direct | ADR-0020 merge |
| 3 | [docs/LOOP.md §1](../LOOP.md) 에 **cron 전용 chain 분기 step** 추가 — 직전 task 완료 후 §2.5 (a)~(e) 평가 → true 면 2번째 task 진입(N≤2), false 면 현행 step 7 종료. `FIRE-BATCH` marker 를 chained commit trail 에 박는 지침 포함 | direct | step 2 |
| 4 | [CLAUDE.md §10](../../CLAUDE.md) cron 간격을 `(2×평균)×2` 로 명문화 + `docs/STATE.json.flags.multiTaskFire = true` **토글** | direct | **step 2·3 완료** (토글 ON 은 schema 필드·chain 분기 모두 존재한 뒤에만) |

- **순서 강제**: step 4 의 토글 ON 은 step 2(flag 필드 존재) 와 step 3(chain 분기 로직 존재) 이 모두 완료된 뒤에만 가능하다. flag 없이 토글하거나 분기 로직 없이 토글하면 driver 가 활성 상태를 해석할 수 없어 무의미하다.
- step 2~4 는 planner 가 본 ADR merge 후 순차 큐잉한다(T-0197 Follow-ups).

## Consequences

**장점**

- §2.5 forward-looking spec 이 **실제 활성 경로**를 얻는다 — 향후 throughput 실험의 안전 가드레일(조건 a~e, marker, dogfood, rollback)이 사전 박제된 채 활성.
- cold-start tax (~15k tok / fire) 를 1 fire 안 두 번째 task 가 **재지불하지 않음** — 1회 cold-start + N × orchestration overhead 로 token 측면 cheaper.
- 활성화가 **4 step 으로 분해**되어 각각 reviewer / CI(step 1 pr) 또는 가벼운 direct 검증을 거쳐 incremental 하게 도입된다 — big-bang 활성화의 risk 회피.

**비용 / 한계 (정직한 박제)**

- **cloud cron `refs/locks/*` 403 한계** — 본 환경 cloud cron 은 ref-CAS lock 을 잡지 못해 pr-mode task 에서 **stand down** 한다([ADR-0010](ADR-0010-cron-github-mcp-pr-mode.md) (3)). 따라서 "cron N=2" 의 **실효는 direct-mode doc-task 2개 chain 위주**로 제한적이다. 실질 throughput 이득은 **cold-start tax (~15k tok/fire) × 절약분 한정**.
- **실 driver 인 로컬 `/loop` 는 본 활성 범위 밖** — 사용자 cron-only 결정이므로, 가장 많은 task 를 도는 `/loop` 는 본 활성화로 빨라지지 않는다. 본 ADR 의 효과는 cron 이 잡는 direct doc-task chain 에 국한된다는 점을 명확히 한다.
- **격리 약화 trade-off** — [CLAUDE.md §10](../../CLAUDE.md) 의 "fresh process per task" 격리 보장이 **1 fire 안 N=2 만큼 약화**된다. 단 §2.5 "본 §와 §10 의 관계" 대로 **fire 자체는 매 발화 fresh** — N>1 이어도 cron fire 는 매 발화 새 conversation 으로 cleanup 되므로, 약화는 1 fire 내부(2 task 사이)에만 국한되고 fire 경계는 여전히 clean 하다. 이 trade-off 를 조건 (a) sub-agent 격리 + (d) lock 45분 임계가 가드레일로 보완한다.
- **dogfood 관찰 부담** — 첫 30일 동안 위반 / 누적 / race / push contention 을 사람이 점검해야 한다(자동 계측은 별도 concern).

## Alternatives

- **(1) 현행 유지 (1-fire-1-task)** — 기각. §2 step 7 의 기본 동작은 견고하나, 사용자가 명시적으로 cold-start tax 절감을 위한 N=2 활성화를 승인했다. 가드레일(조건 a~e + dogfood + rollback)이 충분히 박제되어 실험 risk 가 통제 가능하다.
- **(2) N≥3** — 기각. §2.5 (b) 가 N≤2 를 명시했고, N 이 클수록 1 fire 안 context 누적 / 격리 약화가 비선형으로 커진다. N=2 로 먼저 dogfood 한 뒤 데이터에 근거해 별도 ADR 로만 상향한다.
- **(3) `/loop` 도 포함** — 기각. **사용자 cron-only 결정**이 1차 사유. 추가로 `/loop` 는 사람이 옆에 있는 short-sprint 도구지만 무감독으로 길게 돌면(CLAUDE.md §10 의 10-turn cap 이 완화책) chain 이 **driver context 누적**을 가속할 risk 가 있다. cron 은 매 발화 fresh conversation 이라 fire 경계가 clean 하지만 `/loop` 는 같은 conversation 에서 turn 이 쌓이므로(§10 ScheduleWakeup 동작), N=2 chain 의 누적 위험이 cron 보다 크다. 따라서 cron 에서 먼저 검증한다.

## Refs

T-0197, CLAUDE.md §2.5, CLAUDE.md §10, ADR-0009, ADR-0010
