---
id: T-0348
title: ADR-0036 §rollout stage 5a 진입 — flags.fineGrainedConcurrency 토글 ON + maxConcurrentClaims=1
phase: P5
status: DONE
completed: 2026-06-11
commitMode: direct
coversReq: [TBD]
estimatedDiff: 80
estimatedFiles: 5
created: 2026-06-11
independentStream: stage5-default-on-safeguards
dependsOn: [T-0343, T-0344, T-0345, T-0346, T-0347]
touchesFiles: [docs/STATE.json, docs/LOOP.md, docs/architecture/concurrency.md, CLAUDE.md, docs/tasks/T-0348-adr0036-stage5a-toggle-on-maxclaims1.md]
plannerNote: "P5 / ADR-0036 §rollout stage5a — §D8 (a)~(d)+incrementing 완결(T-0343~T-0347) 후 첫 토글 ON. maxConcurrentClaims=1 로 병렬 0, claim 경로 무사고 검증."
---

# T-0348 — ADR-0036 stage 5a 진입: 토글 ON + `maxConcurrentClaims=1`

## Why

ADR-0036 §rollout stage 5 는 "§Decision 8 (a)~(d) 선행 구현 → 5a→5b→5c 이행"으로 정의되며, 선행 구현은 세션 c10b 에서 전부 완결됐다 — (d) schema(T-0343) + (d) 강등 분기(T-0344) + (c) integrator rebase(T-0345) + (a)(b) 런타임 재검증 primitive(T-0346, PR #283) + (d) incrementing 시점(T-0347). 직전 lock release note 가 명시한 잔여 = **5a 진입뿐**.

5a 의 의미(ADR-0036 §Decision 8 (e)): `flags.fineGrainedConcurrency = true` 로 claim-pickup 경로(LOOP §1[2])를 처음 런타임 활성하되, **`maxConcurrentClaims = 1` 로 동시 claim 을 1개로 제한해 병렬 0** — 새 메커니즘(reclaim → select+claim → lock-free 진행 → claim release) 자체를 무사고 검증하는 단계다. 최악 동작 = coarse 단일-driver(ADR-0009)와 동일해야 한다는 §Decision 8 핵심 원칙이 본 단계의 정확성 게이트다. 단, `maxConcurrentClaims` 필드와 그 게이트 판정 절차는 아직 어느 doc 에도 박제돼 있지 않으므로(STATE 부재 + LOOP §1[2] 미언급 grep 확인) 본 task 가 필드 도입 + 게이트 절차 박제 + 토글 flip 을 한 direct commit 으로 묶는다.

## Required Reading

- docs/decisions/ADR-0036-fine-grained-concurrency.md §Decision 8 (특히 (a)/(e)) + §rollout stage 5 (L98~121) — 권위 본문, 변경 금지
- docs/LOOP.md §1 [2] claim-pickup 분기 (L46~120) — 게이트 박제 위치
- docs/architecture/concurrency.md §7 / §7.1 (L143~185) — 5a 진입 표기 갱신 대상
- CLAUDE.md §10 "토글-gated N-driver 경로" 단락 — "(현 기본값 false)" 서술 동기 대상
- docs/STATE.json `flags` object (L4~7) — flip + 필드 추가 대상 (§9 single-writer: driver 직접 편집)

## Acceptance Criteria

- [ ] `docs/STATE.json`: `flags.fineGrainedConcurrency` = `true`, `flags.maxConcurrentClaims` = `1` 추가 (claim-pickup 분기와 회로 차단기 강등 write 가 같은 `flags` object 를 읽는 단일 read point — 위치 근거를 commit body 에 1줄). JSON 유효성 `jq . docs/STATE.json` exit 0 으로 검증. `adr0036Rollout` 추적 필드에 stage5 = 5a-active 반영.
- [x] `docs/LOOP.md` §1[2] claim-pickup 분기에 **maxConcurrentClaims 게이트** sub-step 박제: (b) select+claim **직전**, (a) reclaim 후의 활성 claim 수가 `flags.maxConcurrentClaims` 이상이면 추가 claim 없이 no-op 종료. **필드 부재·파싱 불확실 시 1 로 간주**(가장 보수적 — §D8 (a) fail-safe 강등 계약 정합). 판정은 [1] lock(critical section) 보유 상태에서.
- [x] `docs/LOOP.md` §1[2] 의 "토글 OFF(현 상태, …)" 등 stale 현황 서술을 5a ON 현황으로 갱신 (forward-looking 표현 → 활성 표현, 회로 차단기 강등 시 OFF 복귀 가능 명시 유지).
- [x] `docs/architecture/concurrency.md` §7 말미의 "5a 진입은 … 후 별도 direct commit" 단락을 shipped(T-0348) 로 갱신 + **5a→5b 정확성 게이트** 1 단락 박제: claim 경로 실사용 fire 에서 claim 박제/release 정상 + `concurrencyIncidents` 4 유형 전부 0 유지 관측 후에만 5b 진입(별도 task).
- [x] `CLAUDE.md` §10 토글-gated 단락의 "(현 기본값 false)" / "토글 OFF 동안 forward-looking" 현황 서술을 5a ON 으로 최소 동기 (1~3줄 — 대량 재작성 금지).
- [x] ADR-0036 본문 변경 0 (권위 불변 — §rollout 5 의 5a 정의가 이미 본 task 를 cover). `src/` 코드 변경 0, 새 dependency 0.
- [ ] push 후 main CI green 확인 (R-114 — doc-only 라 trivially green 예상, `gh run list` conclusion success).

(분기 없는 doc-only direct task — R-112 unit test 항목 해당 없음, R-110 doc-only direct 면제.)

## Out of Scope

- **5b / 5c 진입** (direct-only 병렬 허용, 전면 병렬 + 30일 dogfood) — 각각 5a 정확성 게이트 통과 후 별도 task.
- `maxConcurrentClaims` > 1 상향 — 5b 이후 책임.
- `scripts/select-claim.sh` / `scripts/validate-claim-candidate.sh` / `scripts/reclaim-stale-claim.sh` 코드 변경 — 게이트는 LOOP 절차 계약으로만 박제 (driver 가 claims.json 직독 판정).
- `validate-claim-candidate.test.sh` 의 ci.yml step 등록 — gh token workflow scope 부재 (credential 게이트, T-0346 Follow-up 유지).
- ADR-0036 / ADR-0009 / ADR-0028 본문 변경.
- T-0341 frontmatter status flip — Follow-ups 참조.

## Suggested Sub-agents

`implementer` 1회 (docs/LOOP.md + concurrency.md + CLAUDE.md 3 doc inline-amend) — 단 **docs/STATE.json 은 §9 single-writer 라 driver 가 직접 편집**한다 (T-0343 선례: executor 위임 시 위반). tester 생략 (R-110 doc-only direct 면제).

## Result (2026-06-11, loop@cloud-0en1pb t2)

- doc 3종 박제 완료: LOOP §1[2] (a2) maxConcurrentClaims 게이트(부재·불확실 시 1 간주, lock-하 판정) + 5a ON 현황 갱신(강등 시 inert 복귀 명시) / concurrency.md §7 말미 shipped(T-0348) + 5a→5b 정확성 게이트 단락 / CLAUDE.md §10 최소 동기(3곳 1줄 내외).
- `docs/STATE.json` flip(flags.fineGrainedConcurrency=true + maxConcurrentClaims=1 + adr0036Rollout.stage5=5a-active)은 §9 single-writer 에 따라 **driver 가 직접 적용** (jq 검증 포함). push 후 main CI green 확인(R-114)도 driver 책임.
- ADR-0036 본문 변경 0, src/ 변경 0, 새 dependency 0.

## Follow-ups

- (direct) T-0341 frontmatter `status: IN_PROGRESS` → `DONE` flip 누락 bookkeeping — 사용자 직접 commit 9fde830 으로 본문은 박제 완료 상태 (AC 4/5 체크, 마지막 CI 항목은 direct 진행으로 무의미).
- (direct) 5b 진입 — 5a 정확성 게이트(본 task 가 concurrency.md 에 박제) 관측 충족 후.
