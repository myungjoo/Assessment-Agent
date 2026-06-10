---
id: T-0334
title: ADR-0036 amend — stage 5 기본-ON 안전장치 §Decision 8 박제 + rollout 5 세분 (5a/5b/5c)
phase: P5
status: IN_PROGRESS
commitMode: pr
coversReq: [TBD]
estimatedDiff: 140
estimatedFiles: 2
created: 2026-06-10
independentStream: stage5-default-on-safeguards
dependsOn: []
touchesFiles: [docs/decisions/ADR-0036-fine-grained-concurrency.md, docs/tasks/T-0334-adr0036-stage5-default-on-safeguards-amend.md]
hqOrigin: "사용자 대면 세션 2026-06-10 — '기본 ON이 되면서도 안정성을 해치지 않도록 하려면?' 논의 후 '권한대로 해봐' 지시 (loop 외 user-directed)"
plannerNote: "loop planner 가 아닌 사용자 대면 세션에서 직접 큐잉·실행. stage 1~4(T-0326~T-0332) 완료 후 남은 빈칸 — 회로 차단기·claim 재검증 의무·merge-전 rebase·ON 3단계 이행 — 을 ADR 에 설계 박제. 구현은 Follow-ups."
---

# T-0334 — ADR-0036 amend: stage 5 기본-ON 안전장치 박제

## Why

ADR-0036 은 ACCEPTED + stage 1~4 구현 완료(T-0326~T-0332) 상태이나, stage 5(`flags.fineGrainedConcurrency` 토글 ON)는 "30일 dogfood 합의 후" 한 줄로만 정의되어 있었다. 사용자가 2026-06-10 대면 세션에서 "기본 ON 이 되면서도 안정성을 해치지 않으려면?"을 물었고, 그 답으로 도출된 안전장치 — **fail-safe 강등(모르면 직렬화) · claim 시점 런타임 재검증 · merge 직전 rebase 의무 · 사고 시그널 회로 차단기(auto-degrade) · ON 3단계 이행(5a/5b/5c)** — 를 ADR 에 박제하라고 지시했다("권한대로 해봐"). 핵심 원칙: **기본 ON 의 최악 동작 = coarse 단일-driver 와 동일** 해야 토글 전환이 안전하다.

기존 구현이 남긴 빈칸과의 정합: [scripts/select-claim.sh](../../scripts/select-claim.sh) 헤더는 "`dependsOn` 미머지 등 런타임 의존성 평가는 호출측 책임"으로 유보했고, LOOP §1[2] claim-pickup 분기·concurrency.md 어디에도 회로 차단기/자동 강등/ON 단계적 이행은 없다. 본 task 가 그 설계 공백을 ADR 레벨에서 닫는다(구현 0 — 설계 박제만, 토글 OFF 유지).

## Required Reading

- docs/decisions/ADR-0036-fine-grained-concurrency.md (전문 — 특히 §Decision 1/3/4/5/6, §rollout)
- docs/LOOP.md §1 [2] claim-pickup 분기 + §4 충돌 경계 단락 (현행 박제 범위 확인)
- scripts/select-claim.sh 헤더 주석 (호출측 책임 유보 문구)
- scripts/reclaim-stale-claim.sh 헤더 주석 (fail-closed 계약 — §Decision 8 (a) 가 mirror 하는 선례)

## Acceptance Criteria

- [x] ADR-0036 에 **§Decision 8 "stage 5 기본-ON 안전장치"** 를 신설하고 5종을 박제한다: (a) fail-safe 강등(판정 불확실 시 후보 제외/단일-task fallback — reclaim fail-closed 계약의 확장), (b) claim 시점 런타임 재검증(`touchesFiles` 교집합 실검사 + `dependsOn` 머지 확인을 driver 의무로 확정), (c) integrator merge 직전 rebase + CI green 재확인 의무, (d) `concurrencyIncidents` 회로 차단기(같은 유형 2회 → lock 하 자동 토글 OFF + notifier, 재활성은 사람 결정만), (e) ON 3단계 이행(5a `maxConcurrentClaims=1` → 5b direct-only → 5c 전면 + 30일 dogfood).
- [x] §rollout stage 5 를 (e) 의 5a/5b/5c 구조로 갱신하고, §Decision 8 (a)~(d) 구현 선행을 명시한다. 각 단계 break-even 게이트 포함.
- [x] Status blockquote 에 amend 이력(2026-06-10, T-0334, 사용자 지시) 1 단락을 추가한다. ACCEPTED status 와 "토글 OFF — 동작 변화 0" 불변 명시.
- [x] N=2 상한·cron@cloud direct-only·server-time 의무·lock-하 atomic claim 등 기존 §Decision 불변식과의 정합을 §Decision 8 말미에 명시한다.
- [ ] (CI) doc-only PR — `pnpm lint && pnpm build && pnpm test` green (R-110, CI 에서 검증).

## Out of Scope

- §Decision 8 의 **구현 일체** — STATE schema(`concurrencyIncidents`) 추가, select-claim/claim-pickup 재검증 로직, integrator.md rebase 의무 반영, LOOP §1[2] 강등 분기, concurrency.md 동기. 전부 Follow-ups 의 후속 task.
- `flags.fineGrainedConcurrency` 토글 값 변경 (여전히 `false`).
- ADR-0020 multiTaskFire 와의 상호작용 재정의 (현행 직교 유지).

## Follow-ups

- (pr) §Decision 8 (b)/(a) 구현 — select-claim.sh 또는 claim-pickup 절차에 `touchesFiles` 교집합·`dependsOn` 머지 재검증 + fail-safe 강등 분기 추가.
- (direct) §Decision 8 (d) 구현 — STATE.json schema 에 `concurrencyIncidents` 필드 + LOOP §1[2] 에 회로 차단기 강등 분기 + CLAUDE §10/concurrency.md 동기.
- (direct) §Decision 8 (c) 구현 — .claude/agents/integrator.md 에 merge-전 rebase + CI 재확인 의무 추가.
- (direct) 5a 진입 — `maxConcurrentClaims` 필드 도입 + 토글 ON(5a 모드). 이후 5b/5c 는 각각 별도 task.
