---
id: T-0350
title: ADR-0036 §rollout stage 5b 진입 — direct-only 동시 claim 허용 + maxConcurrentClaims=2
phase: P5
status: PENDING
commitMode: direct
coversReq: [TBD]
estimatedDiff: 75
estimatedFiles: 4
created: 2026-06-11
independentStream: stage5-default-on-safeguards
dependsOn: [T-0348, T-0349]
touchesFiles: [docs/STATE.json, docs/LOOP.md, docs/architecture/concurrency.md, CLAUDE.md, docs/tasks/T-0350-adr0036-stage5b-direct-only-parallel.md]
plannerNote: "P5 / ADR-0036 §rollout 5b — 5a 게이트(§7 단수 '실사용 fire' 기준: T-0349 cycle 무사고 + incidents 4종 0) 충족 실측 → direct-only 병렬 진입."
---

# T-0350 — ADR-0036 stage 5b 진입: direct-only 동시 claim + `maxConcurrentClaims=2`

## Why

ADR-0036 §Decision 8 (e) / §rollout stage 5 는 5a(`maxConcurrentClaims=1`, 병렬 0) → 5b(`commitMode: direct` task 만 동시 claim 허용) → 5c(전면 병렬 + 30일 dogfood) 의 3단계 이행을 정의하며, "각 단계의 정확성 게이트 통과 후에만 다음 진입"을 요구한다. **5a→5b 게이트는 충족 실측됐다**: concurrency.md §7 게이트 문구(권위 ADR-0036 §rollout "break-even: 5a 메커니즘 무사고"와 동형)는 **단수 "실사용 fire"** 에서 (i) claim 박제·release 정상 동작 + (ii) `concurrencyIncidents` 4 유형 전부 0 유지의 관측을 요구하는데, journal 2026-06-11 t4 가 박제한 T-0349 첫 실사용 claim cycle (select+claim 원자 박제 → lock-free 실행 → closeout 재획득, 이중 claim 0·incident 0) + 현 STATE `concurrencyIncidents` 4종 모두 0 이 두 조건을 모두 충족한다 — 복수 관측 요구 문구는 권위·인지 doc 어디에도 없음 (grep 검증). 게이트 문구가 "별도 task 로 진행한다"고 명시했고 T-0348 Follow-ups 도 본 진입을 사전 박제했으므로 planner 단독 권한 안이다.

5b 의 의미: 동시 claim 을 **두 task 모두 `commitMode: direct` 일 때만** 허용 — 충돌해도 코드가 아닌 문서라 위험 표면이 최소다 (§Decision 8 (e)). `maxConcurrentClaims` 를 2 로 상향하되 (§Decision 6 의 N=2 상한 그대로), pr-mode task 는 활성 claim 0 일 때만 단독 claim 가능하게 LOOP §1[2] 게이트를 좁힌다.

## Required Reading

- docs/decisions/ADR-0036-fine-grained-concurrency.md §Decision 8 (e) (L107) + §rollout stage 5 (L119) — 권위 본문, 변경 금지
- docs/architecture/concurrency.md §7 말미 5a→5b 게이트 단락 (L180~185) — 충족 근거 박제 + 5b shipped 갱신 대상
- docs/LOOP.md §1 [2] claim-pickup 분기 — (a2) maxConcurrentClaims 게이트 (T-0348 박제) 에 direct-only 조건 추가 위치
- CLAUDE.md §10 토글-gated 단락 — 5a 현황 서술의 5b 동기 대상
- docs/STATE.json `flags` object — `maxConcurrentClaims` 1→2 + `adr0036Rollout.stage5` 갱신 대상 (§9 single-writer: driver 직접 편집)
- docs/progress/journal-2026-06-11.md t4 줄 (07:10Z) — 게이트 충족 실측 근거 출처

## Acceptance Criteria

- [ ] `docs/STATE.json`: `flags.maxConcurrentClaims` = `2`, `adr0036Rollout.stage5` = 5b-active 반영. `flags.fineGrainedConcurrency` 는 `true` 불변. JSON 유효성 `jq . docs/STATE.json` exit 0.
- [ ] `docs/LOOP.md` §1[2] (a2) maxConcurrentClaims 게이트에 **5b direct-only 조건** sub-step 박제: 활성 claim ≥ 1 존재 상태에서 추가 claim 은 (i) 기존 활성 claim 의 task 와 후보 task 가 **모두 `commitMode: direct`** 이고 (ii) validate-claim-candidate (a)(b) 재검증 통과 시에만. **후보 또는 기존 claim 의 commitMode 판독 불확실 시 no-op** (모르면-직렬화 fail-safe — §D8 (a) 정합). pr-mode task 는 활성 claim 0 일 때만 단독 claim.
- [ ] `docs/architecture/concurrency.md` §7: (1) 5a→5b 게이트 단락에 **충족 근거 박제** — T-0349 실사용 fire 실측 (select+claim 원자 박제 → lock-free 실행 → closeout release 정상 + `concurrencyIncidents` 4종 0 유지) → 5b 진입 shipped(T-0350) 갱신, (2) **5b→5c 정확성 게이트** 1 단락 박제: direct-only 동시 claim 실사용에서 이중 claim 0 + bookkeeping(STATE/journal/counters) 충돌 0 관측 후에만 5c (전면 병렬 + 30일 dogfood, 별도 task).
- [ ] `CLAUDE.md` §10 토글-gated 단락의 5a 현황 서술을 5b 로 최소 동기 (1~2줄 — 대량 재작성 금지).
- [ ] ADR-0036 본문 변경 0 (권위 불변 — §rollout 의 5b 정의가 본 task 를 cover). `src/` 코드 변경 0, 새 dependency 0.
- [ ] push 후 main CI green 확인 (R-114 — doc-only 라 trivially green 예상, `gh run list` conclusion success).

(분기 없는 doc-only direct task — R-112 unit test 항목 해당 없음, R-110 doc-only direct 면제.)

## Out of Scope

- **5c 진입** (pr-mode 포함 전면 병렬 + 30일 dogfood + throughput 실측) — 5b 정확성 게이트 통과 후 별도 task, 측정 게이트.
- `maxConcurrentClaims` > 2 상향 — §Decision 6 N=2 상한은 ADR 변경 사항.
- `scripts/select-claim.sh` / `scripts/validate-claim-candidate.sh` / `scripts/reclaim-stale-claim.sh` 코드 변경 — 5b 조건은 LOOP 절차 계약으로만 박제 (driver 가 task frontmatter 직독 판정).
- `validate-claim-candidate.test.sh` 의 ci.yml step 등록 — gh token workflow scope 부재 (credential 게이트, T-0346 Follow-up 유지).
- ADR-0036 / ADR-0009 / ADR-0028 본문 변경.
- ADR-0039 ACCEPTED flip·impl chain / live-LLM slice 2/2 — 각각 user·credential 게이트 (6/25 격상 미도래).

## Suggested Sub-agents

`implementer` 1회 (docs/LOOP.md + concurrency.md + CLAUDE.md 3 doc inline-amend) — 단 **docs/STATE.json 은 §9 single-writer 라 driver 가 직접 편집** (T-0343/T-0348 선례). tester 생략 (R-110 doc-only direct 면제).

## Follow-ups

- (direct, 측정 게이트) 5c 진입 — 5b 정확성 게이트 (이중 claim 0 + bookkeeping 충돌 0) 관측 충족 후 + 30일 dogfood 합의.
