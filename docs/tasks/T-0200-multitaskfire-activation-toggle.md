---
id: T-0200
title: multi-task fire 활성화 — §10 cron 간격 재조정 + flags.multiTaskFire false→true 토글
phase: P4
status: PENDING
commitMode: direct
coversReq: []
estimatedDiff: 15
estimatedFiles: 2
created: 2026-06-03
dependsOn: [T-0197, T-0198, T-0199]
parents: []
plannerNote: "ADR-0020 rollout step 4(최종 활성화) — CLAUDE.md §10 cron 간격 (2×평균)×2 재조정 + STATE flags.multiTaskFire false→true 토글, driver-direct"
---

# T-0200 — multi-task fire 활성화 (§10 cron 간격 재조정 + flags 토글)

## Why

ADR-0020 의 4-step 활성화 rollout 의 **마지막 step 4(최종 활성화)** 다. step 1(ADR 작성, T-0197) / step 2(STATE `flags.multiTaskFire:false` 필드 추가, T-0198) / step 3(LOOP.md §1 `[7.5]` cron chain 분기, T-0199) 가 모두 main 에 DONE 으로 박제됐다. 본 task 는 (1) CLAUDE.md §10 "동시 실행 정책" 의 cron 간격 규칙을 multiTaskFire 활성 시 `(N × 평균 task 소요시간) × 2 = (2 × 평균) × 2` 로 재조정하고, (2) `docs/STATE.json` 의 `flags.multiTaskFire` 를 `false` → `true` 로 토글한다. 이 토글이 **dormant 상태인 LOOP.md `[7.5]` 분기를 cron fire 에 한해 실제 동작시키는 활성화 행위**다. ADR-0020 은 사용자 명시 승인으로 ACCEPTED 상태이며, 선행 step 2·3 이 모두 완료돼 토글의 전제조건이 충족됐다. CLAUDE.md §2.5 활성화 step 4 에 정확히 대응한다.

## Required Reading

- `docs/decisions/ADR-0020-multi-task-fire-cron-n2-activation.md` — 본 rollout 의 trade-off / N=2 명문화 / 30일 dogfood / 활성 결정 근거 (자동화 안 됐을 경우 파일명 확인: `ls docs/decisions/ADR-0020*`)
- `CLAUDE.md` §2.5 "Multi-task fire (실험적, 기본 OFF)" — 활성화 조건 (a)~(e), 특히 (d) lock 45분 임계 + (b) N≤2 + 활성화 step 4종
- `CLAUDE.md` §10 "동시 실행 정책 (race 회피)" 규칙 1~5 (line ~335~345) — 특히 규칙 2 `cron 간격 ≥ 평균 task 소요시간 × 2` (수정 대상) 와 규칙 5 graceful 종료
- `docs/STATE.json` 의 `flags` 오브젝트 (`"multiTaskFire": false`) — 토글 대상
- `docs/LOOP.md` §1 `[7.5] CRON MULTI-TASK CHAIN` 분기 (line ~139~175, 이중 게이트 `cron fire + flags.multiTaskFire == true` + FIRE-BATCH marker) 와 §4 (graceful 종료) — 본 task 는 이들을 읽기만 하고 수정하지 않음

## Acceptance Criteria

driver-direct 로 다음을 수행한다 (STATE.json 은 single-writer 이므로 driver 가 직접 편집 — implementer/executor sub-agent 미호출):

- [ ] **CLAUDE.md §10 cron 간격 재조정** — §10 "동시 실행 정책" 의 cron 간격 규칙(규칙 2, "cron 간격 ≥ 평균 task 소요시간 × 2")에 multiTaskFire **활성 시** 의 재조정 규칙을 추가한다: `flags.multiTaskFire` 가 활성이면 한 fire 가 N=2 task 를 연속 처리할 수 있으므로 cron 간격은 `(N × 평균 task 소요시간) × 2 = (2 × 평균) × 2` 이상이어야 한다. **근거 명시**: §2.5(d) lock 45분 임계가 §2 step 2 의 60분 stale 임계를 보호하므로, 2-task fire 가 lock 점유를 60분 너머로 끌고 가지 않도록 간격을 scale 한다.
- [ ] **§10 수치 예시 포함** — 재조정 문구에 구체 예시 1개 박제: 예) "task 평균 15분이면 multiTaskFire 활성 시 cron 간격 ≥ `(2×15)×2 = 60분`". 기존 단일-task 가이드(평균 15분 → 30분)는 **그대로 유지**하고, 재조정은 활성 시에만 적용됨을 명시.
- [ ] **flags.multiTaskFire false→true 토글** — `docs/STATE.json` 의 `flags.multiTaskFire` 를 `false` 에서 `true` 로 변경. **이것이 활성화 행위** — LOOP.md `[7.5]` 분기가 cron fire 에서 live 가 된다.
- [ ] **cron-only / `/loop` 미영향 note** — task 본문 또는 commit trail / journal 에 명시: 토글은 `holder=cron` fire 에만 multi-task fire 를 활성화한다 (`[7.5]` 는 `flags.multiTaskFire===true && holder=cron` 이중 게이트). `/loop`(holder=loop) 및 사람 진입점은 **영향 없음** — 1-task-per-turn 유지. (`/loop` 이 chaining 을 시작할 것이라 오해하지 않도록.)
- [ ] **N≤2 hard-cap / `[7.5]` 로직 불변 note** — N≥2 는 hard-cap 유지, N≥3 는 ADR-0020 에 의해 금지. LOOP.md `[7.5]` 분기 로직(step 3, T-0199 에서 완성)은 **수정하지 않는다**.
- [ ] **JSON 유효성** — 토글 후 `docs/STATE.json` 이 valid JSON 임을 검증: `node -e "JSON.parse(require('fs').readFileSync('docs/STATE.json','utf8')); console.log('ok')"` 가 `ok` 출력. (STATE note 편집 시 full-match — dangling JSON 방지.)
- [ ] **30일 dogfood window 시작 note** — flag flip 으로 ADR-0020 의 30일 dogfood 관찰 window 가 시작됨을 task DONE 요약 / journal 에 명시. 관찰 항목: 위반 / context 누적 증후 / race / push-contention. 롤백 = 1회 재발 시 flag 를 false 로 토글.
- [ ] commitMode `direct` — main 에 직접 commit → push. PR / reviewer 없음. CI 는 doc/state-only 변경이라 자동 트리거 (R-114 종료 전 CI 시작 확인).

## Out of Scope

- N≥3 multi-task fire 도입 — ADR-0020 이 금지. 본 task 는 N=2 유지만.
- `/loop`(holder=loop) 또는 headless 진입점을 multi-task chain 에 포함시키기 — `[7.5]` 는 cron 전용 이중 게이트. 본 task 는 그 게이트를 변경하지 않음.
- LOOP.md `[7.5]` 분기 로직 / FIRE-BATCH marker 형식 수정 — step 3(T-0199)에서 이미 완성. 읽기만.
- §2.5 활성화 조건 (a)~(e) 자체 변경 — 본 task 는 그 조건을 honor 하는 §10 간격 규칙만 추가.
- `STATE.json` 의 flags 외 다른 필드 변경 — nextTask/lock/counters 등은 driver 의 일반 bookkeeping 으로 별도 처리.

## Suggested Sub-agents

driver-direct, no sub-agent — `docs/STATE.json` 은 STATE single-writer(driver/planner/notifier only)이고 CLAUDE.md §10 은 운영규칙 direct 편집이므로 driver 가 직접 Edit 한다 (T-0198 토글-필드-추가와 동일 패턴). implementer/executor 미호출. tester 도 불필요(doc/state-only, 코드 0 LOC) — 단 `node -e JSON.parse` 1줄로 STATE 유효성만 driver 가 자체 검증.

## Follow-ups

- (ADR-0020 Follow-up #4) 30일 dogfood 관찰 window — flag flip 시점부터 30일간 multi-task fire 의 실제 동작을 관찰(위반 / context 누적 / race / push-contention). 기간 종료 시 ADR-0020 갱신(정착) 또는 본 flag 를 false 로 롤백 결정. 1회 재발 시 즉시 롤백.
- 본 task 는 ADR-0020 rollout 의 **마지막 step(step 4)** — 완료 후 4-step 활성화 rollout 이 전부 완결된다. 별도 후속 rollout step 없음.
