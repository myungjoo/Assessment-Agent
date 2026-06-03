---
id: T-0197
title: ADR-0020 작성 — multi-task fire cron N=2 활성화 결정 (§2.5 게이트 step 1)
phase: P4
status: DONE
commitMode: pr
coversReq: []
estimatedDiff: 160
estimatedFiles: 1
actualDiff: 115
actualFiles: 1
created: 2026-06-03
completedAt: 2026-06-03T18:05:00+09:00
reviewRounds: 1
prNumber: 176
mergeCommit: f21f13f
dependsOn: []
parents: []
plannerNote: "user-interactive injection (planner bypass) — 사용자가 대화에서 'cron 에 대해 N=2 로 올려 시행' 결정 + AskUserQuestion 2종으로 scoping 확정: (1) 시행 방식 = loop 파이프라인 (ADR+후속 task 를 큐에 주입, 자율 loop 이 reviewer/CI 거쳐 실행), (2) 적용 범위 = cron 한정 (/loop 미포함). §2.5 활성화 step 4단계 중 step 1 (ADR) 만 본 task. 후속 step 2~4 (STATE schema flag / LOOP.md chain 분기 / §10 재조정+토글) 는 본 ADR merge 후 별도 direct task 로 planner 가 순차 큐잉 — Follow-ups 참조. 본 task 는 §3.1 룰 4 에 따라 새 ADR = pr-mode. (원래 T-0196 으로 초안했으나 그 ID 가 orphan /loop #47 의 ADR-0019 flip 에 선점돼 T-0197 로 재배정.)"
---

# T-0197 — ADR-0020 작성 (multi-task fire cron N=2 활성화 결정)

## Why

[CLAUDE.md §2.5](../../CLAUDE.md) 는 "한 cron fire 안에서 task 2개까지 연속 진행(multi-task fire)" 을 **forward-looking spec 으로만** 박제하고 **기본 OFF** 로 두었다 (T-0078). 활성화하려면 §2.5 "기본 OFF 의 의미" 가 명시한 4단계를 밟아야 하며, **그 step 1 이 활성화 ADR 작성** 이다:

> 1. ADR 작성 — trade-off 박제 + N=2 명문화 + dogfood 30일 기간 + 활성 결정 근거.

사용자가 본 결정을 직접 승인했다 (대화 + AskUserQuestion 2종):
- **시행 방식**: loop 파이프라인으로 — 본 ADR + 후속 doc task 들을 작업 큐에 주입하고, 자율 driver loop 이 reviewer/CI 게이트를 거쳐 실행한다.
- **적용 범위**: **cron 한정**. `/loop` turn 안의 2-task chain 은 본 활성화 범위에서 제외한다 (추후 별도 결정).

본 task 는 그 step 1 — **ADR-0020 을 작성** 해 활성 결정·trade-off·N=2·dogfood·marker 형식·§10 cron 간격 재조정 근거를 박제한다. STATE schema flag / LOOP.md chain 분기 / 토글은 본 ADR merge 후 별도 direct task (Out of Scope / Follow-ups).

[CLAUDE.md §3.1 룰 4](../../CLAUDE.md) — 새 ADR 자체는 `pr` (아키텍처 결정은 reviewer 점검 대상).

### 환경 제약 (ADR 가 정직하게 박제해야 할 사실)

이 저장소의 cron 은 cloud cron 이고 `refs/locks/*` push 가 403 이라 ref-CAS lock 을 잡지 못해 **pr-mode task 에서 stand down** 한다 (MEMORY: cloud-cron-ref-push-403, B-credential-2026-06-02 note). 실질 driver 는 로컬 `/loop` 다. 따라서 "cron N=2" 의 실제 효과는 **direct-mode doc-task 2개 chain 정도로 제한적** 이다. ADR 는 이 한계를 Consequences 에 정직하게 명시해야 한다 (활성화의 실효성과 dogfood 관찰 대상이 무엇인지 분명히).

## Required Reading

- [CLAUDE.md §2.5](../../CLAUDE.md) — multi-task fire opt-in spec 전체. 활성화 조건 (a)~(e), "기본 OFF 의 의미" 의 4단계 활성화 step, "활성 시 위반 처리", "본 §와 §10 의 관계". **본 ADR 가 활성화하는 대상.**
- [CLAUDE.md §2](../../CLAUDE.md) step 7 — "Task 1개 완료 후 종료" 기본 룰 + §2.5 조건부 예외 bullet.
- [CLAUDE.md §10](../../CLAUDE.md) — Long-horizon 실행 모드 + "동시 실행 정책" 의 "cron 간격 ≥ 평균 task 소요시간 × 2". 활성 시 `(N × 평균 task) × 2` 로 scale 필요 — ADR 가 이 재조정 근거를 박제.
- [docs/LOOP.md §1](../LOOP.md) — driver loop step [4]~[7] 종료 분기 (활성 시 chain 분기가 들어갈 자리). [docs/LOOP.md §3](../LOOP.md) — cron 사용법 + "1 fire = 1 task" 현행 룰.
- [docs/decisions/ADR-0010-cron-github-mcp-pr-mode.md](../decisions/ADR-0010-cron-github-mcp-pr-mode.md) — cron 환경의 gh/MCP·lock 제약 (cloud cron stand-down 배경) + ADR 작성 포맷 참조.
- [docs/tasks/T-0078-claude-md-2-5-multi-task-fire-opt-in-spec.md](T-0078-claude-md-2-5-multi-task-fire-opt-in-spec.md) — §2.5 spec 을 박제한 원 task (Follow-ups 에 "활성화 검토 ADR" 예고).

## Acceptance Criteria

### A. ADR-0020 신설 — `docs/decisions/ADR-0020-multi-task-fire-cron-n2-activation.md`

표준 ADR 포맷 (Status / Context / Decision / Consequences / Alternatives, 본문 한국어 §12). 다음을 **모두** 박제:

- [ ] **Status**: `ACCEPTED` — 사용자가 활성화를 직접 승인했으므로 (대화 + AskUserQuestion). Context 에 승인 출처 명시.
- [ ] **Decision — 활성 범위·상한**:
  - N=2 (한 cron fire 당 task 최대 2개). **N≥3 은 본 ADR 도 금지** — 추가 상향은 별도 ADR.
  - **적용 대상 = cron fire 한정**. `/loop` turn 안의 2-task chain 은 본 ADR 범위 제외 (명시적 out-of-scope).
  - chain 허용 = §2.5 활성화 조건 (a)~(e) 5개 모두 충족 시에만 (sub-agent 격리 / N≤2 / 실패 즉시 종료 / lock 45분 임계 / commitMode mixed 금지). ADR 가 5조건을 verbatim 재참조.
- [ ] **Decision — marker 형식 확정**: chained fire 의 commit trail footer 에 `FIRE-BATCH: <task1>+<task2>` 형식 박제 (예: `FIRE-BATCH: T-0210+T-0211`). reviewer 가 이 marker 로 fire 구조를 인지하고 위반 (조건 미충족 chain) 을 MINOR finding 으로 catch (§2.5 "활성 시 위반 처리").
- [ ] **Decision — §10 cron 간격 재조정**: cron 간격 ≥ `(N × 평균 task 소요시간) × 2` = `(2 × 평균) × 2`. 근거 = §2.5 (d) lock 45분 임계가 §2 step 2 의 60분 stale 임계를 넘지 않도록 보호 (두 번째 task 가 lock holding 을 60분 너머로 끌고 가는 시나리오 차단). 실제 cron 간격 수치 변경은 Follow-up direct task 가 §10 본문에 반영 (본 ADR 는 공식·근거만).
- [ ] **Decision — 30일 dogfood**: 활성 후 첫 30일 관찰 기간 + 관찰 지표 (위반 발생 / context 누적 증후 / race / push contention) + **rollback 조건** (사고 1건 재발 시 토글 OFF 또는 §2.5 폐기 검토).
- [ ] **Consequences — 정직한 한계 박제**: 본 환경 cloud cron 은 `refs/locks/*` 403 으로 pr-mode stand down → cron N=2 의 실효는 **direct-mode doc-task chain 위주** 로 제한적. 실질 throughput 이득은 cold-start tax (~15k tok/fire) × 절약분 한정. 실 driver 인 로컬 `/loop` 는 본 활성 범위 밖 (cron-only 결정) 임을 명시.
- [ ] **Consequences — 격리 약화 trade-off**: §10 "fresh process per task" 격리 보장이 1 fire 안 N=2 만큼 약화 (단 fire 자체는 매 발화 fresh 유지 — §2.5 "본 §와 §10 의 관계").
- [ ] **Alternatives**: (1) 현행 유지 (1-fire-1-task) / (2) N≥3 / (3) `/loop` 도 포함 — 각각 기각 사유 (특히 (3) 은 사용자 cron-only 결정 + /loop 무감독 누적 risk).
- [ ] **활성화 롤아웃 시퀀스 박제**: 본 ADR = step 1. 후속 step 2 (STATE schema `flags.multiTaskFire` 필드) → step 3 (LOOP.md §1 cron chain 분기) → step 4 (§10 재조정 + `flags.multiTaskFire=true` 토글) 를 순서·의존성과 함께 ADR 안에 명시 (각각 별도 direct task).

### B. pr-mode 검증 (R-110 / R-114)

- [ ] production code 변경 0 LOC (ADR = doc only) → 신규 unit test 불요. 단 tester 가 `pnpm lint && pnpm build && pnpm test` 실행 결과 green 확인 (R-110: config/doc task 도 tester 호출 의무).
- [ ] reviewer dispatch → §3.3 4-게이트 (reviewer APPROVE + PR comment 외부 존재 + integrator self-check + CI green) 모두 PASS 후 integrator merge.
- [ ] PR title·body 한국어 (§12), task 파일 링크 + Acceptance 체크리스트 포함.

### C. 트레이서빌리티

- [ ] 본 task frontmatter status: DONE + actualDiff/actualFiles/completedAt/reviewRounds 박제 (driver bookkeeping, 별도 direct commit).
- [ ] STATE.json: counters.tasksCompleted +1 / mostRecentTasks prepend T-0197 / reviewRounds[T-0197] 기록 / lastActivity bump.
- [ ] journal 에 entry append (5줄 이내).
- [ ] ADR commit + driver bookkeeping commit 분리 (한 commit = 한 주제).

## Out of Scope

- **STATE.json schema 의 `flags.multiTaskFire: boolean` 필드 추가 + data-model/schema doc 동기** — 활성화 step 2, 별도 direct task (Follow-up). 본 ADR merge 가 선행.
- **docs/LOOP.md §1 의 cron 전용 chain 분기 step 추가** — 활성화 step 3, 별도 direct task.
- **CLAUDE.md §10 cron 간격 수치 재조정 + `flags.multiTaskFire=true` 토글** — 활성화 step 4, 별도 direct task. **토글 ON 은 step 2·3 완료 후에만.**
- **`/loop` turn 안의 multi-task chain** — 사용자 cron-only 결정으로 범위 제외.
- **cron 의 `refs/locks/*` 403 / pr-mode stand-down 환경 문제 해결** — 별개 concern (T-0154 cloud-fire 계열). 본 ADR 는 그 한계를 *기술* 만 하고 *해결* 하지 않음.

## Follow-ups

본 ADR-0020 merge 후 planner 가 아래를 **순서대로** 큐잉 (각 별도 task):

1. **(direct) STATE schema flag** — `docs/STATE.json` 에 `flags.multiTaskFire: false` 필드 추가 + `docs/architecture/data-model.md` 또는 schema 문서 동기 (§2.5 활성화 step 2).
2. **(direct) LOOP.md cron chain 분기** — `docs/LOOP.md §1` 에 cron 전용 분기 step: 직전 task 완료 후 §2.5 (a)~(e) 평가 → true 면 2번째 task 진입 (N≤2), false 면 현행 step 7 종료. `FIRE-BATCH` marker 를 chained commit trail 에 박는 지침 포함 (§2.5 활성화 step 3).
3. **(direct) §10 재조정 + 토글** — `CLAUDE.md §10` cron 간격을 `(2×평균)×2` 로 명문화 + `docs/STATE.json.flags.multiTaskFire = true` 토글 (§2.5 활성화 step 4). **step 2·3 완료가 선행 조건** (flag 필드 존재 + LOOP.md chain 분기 배선이 모두 갖춰져야 토글 ON 이 의미 있음; step 1 ADR 은 본 task 로 완료).
4. dogfood 30일 관찰 후 ADR-0020 갱신 (위반/누적/race 기록) 또는 rollback 결정.
