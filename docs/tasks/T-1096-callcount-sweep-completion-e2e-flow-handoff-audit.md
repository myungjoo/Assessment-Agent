---
id: T-1096
title: call-count 완결성 sweep 완료 audit + 다음 축(§D 후보 (c) e2e 흐름 커버리지) pre-check 핸드오프 — positive-loose toHaveBeenCalled() tree-wide 소진(0) 실증 기록 + realdata 상위 flow(collect→evaluate→result→publish) 종단 시퀀스 커버리지 gap-map 박제 + 다음 planner turn 이 재유도 없이 첫 (c) leg 를 큐잉하도록 durable 핸드오프
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 110
estimatedFiles: 1
created: 2026-07-18
dependsOn: []
touchesFiles:
  - docs/progress/details/T-1096-callcount-sweep-completion-e2e-flow-handoff-audit.md
independentStream: realdata-e2e-callcount-sweep-completion-audit
plannerNote: "P5 test-hardening — call-count 완결성 sweep(§D 후보 (b), legs 24~30 = T-1089~T-1095)의 완료 audit leg. planner pre-check(정밀 grep, 2026-07-18, origin/main 머지 반영): realdata consistency spec 55개 + test/ 트리 전량 positive-loose toHaveBeenCalled()(.not. 제외) = 0(tree-wide 소진, leg 28~30 로 확정). struct-precede 축(후보 (a))도 legs T-1080~T-1088 로 소진. → 남은 T-1065 §D 후보는 (c) e2e 흐름 커버리지 뿐인데 그 pre-check(flow-level spec 부재 경로 스캔)가 미정의 + 상위 flow 커버가 이미 조밀(148 smoke, 20-way aggregator threading). 본 audit 이 (b) 소진을 durable 기록하고 (c) 종단 시퀀스 gap-map 을 박제해 다음 turn 이 재유도 없이 첫 (c) leg 를 큐잉하도록 핸드오프. direct doc-only 1파일 file-disjoint dep[] stage5b(direct-only) 병렬-claimable."
---

# T-1096 — call-count 완결성 sweep 완료 audit + 다음 축(§D 후보 (c)) pre-check 핸드오프

## Why

P5 test-hardening 의 order-lock/call-count sweep 는 [T-1065](T-1065-order-lock-sweep-completion-audit.md) §D 가 나열한 3 후보 축을 순차 소진해 왔다. 후보 (a) **구조-guard 선행성 order-lock** 은 legs T-1080~T-1088(struct-precede)로, 후보 (b) **call-count exactly-N 완결성** 은 legs 24~30([T-1089](T-1089-result-report-plan-callcount.md)~[T-1095](T-1095-app-root-perf-getstatus-callcount.md))로 소진됐다. [T-1095](T-1095-app-root-perf-getstatus-callcount.md) Follow-up 은 tighten 완료 후 tree-wide positive-loose 가 실제 0 이면 §D 후보 (c) **e2e 흐름 커버리지 확장** 으로 전환하되, (c) 의 pre-check("flow-level spec 부재 경로 스캔")가 미정의이므로 다음 turn 이 재판정하도록 지시했다.

본 task 는 그 지시를 이행하는 **완료 audit + 핸드오프 leg** 다 — [T-1065](T-1065-order-lock-sweep-completion-audit.md) 자신이 성공적으로 30+ 후속 leg 를 핸드오프한 그 audit 패턴의 재적용이다(CLAUDE.md §7.3 "결정은 doc 로 — 두 번 추론하지 않는다"). (1) call-count 완결성 sweep 의 tree-wide 소진을 재현 가능한 grep 으로 실증·기록하고, (2) 남은 유일 후보 (c) 의 상위 flow(collect→evaluate→result→publish 종단 시퀀스) 커버리지 gap-map 을 박제해, (3) 다음 planner turn 이 audit 을 재유도하지 않고 곧바로 첫 (c) leg(또는 (c) 마저 소진 시 다음 축)를 큐잉하도록 durable 핸드오프한다. production·test 코드 무변경, doc-only.

planner pre-check(정밀 grep, 2026-07-18, origin/main 최신 머지 반영):
- realdata consistency spec 55개 전량 positive-loose(`.not.` 제외) = **0**.
- `test/` 트리 전량 positive-loose = **0**(leg 28~30 로 소진 확정).
- struct-precede 축(후보 (a))도 legs T-1080~T-1088 로 소진 → 남은 §D 후보는 (c) 뿐.

## Required Reading

- `docs/tasks/T-1065-order-lock-sweep-completion-audit.md` — 본 audit 이 계승하는 완료-audit 패턴 + §D 3 후보 정의(특히 후보 (c) e2e 흐름 커버리지의 원 pre-check 지침). **§D 섹션만.**
- `docs/progress/details/T-1065-order-lock-sweep-completion-audit.md` — T-1065 이 박제한 §D 핸드오프 doc 의 형식(섹션 A/B/C/D 표·재현 grep·후보 나열). 본 task 산출 doc 의 형식 mirror. **섹션 D 만.**
- `docs/tasks/T-1095-app-root-perf-getstatus-callcount.md` — 직전 sweep 마감 leg(tree-wide) 의 Follow-up(본 audit 을 지시). **Follow-ups 절만.**
- (스캔 대상 — read 아닌 grep, 경로만) `test/helpers/realdata-e2e-*-consistency.ts`(55) + `test/smoke/realdata-e2e-*-assembly.smoke-spec.ts` + `test/smoke/realdata-e2e-aggregator-*-run-plan-threading-*way-*.smoke-spec.ts` — 후보 (c) gap-map 은 아래 Acceptance Criteria 의 재현 grep 집계로만 도출한다. **개별 파일 광범위 read 금지**(context 보호) — grep 집계 결과만 표로 기록.

## Acceptance Criteria

본 task 는 `direct` doc-only 이므로 R-112 test 4종(happy/error/branch/negative + coverage)은 **면제**된다(CLAUDE.md §3.2 "direct-mode doc-only commit 만 본 규칙 면제" — 코드·spec 변경 0). 대신 아래 audit 산출물의 정확성·재현성을 검증 기준으로 삼는다. 산출물은 `docs/progress/details/T-1096-callcount-sweep-completion-e2e-flow-handoff-audit.md` 1파일.

- [ ] **섹션 A — call-count 완결성 sweep 소진 실증**: 아래 재현 grep 3종의 출력이 모두 **0** 임을 표로 기록.
  - realdata consistency spec: `for f in test/helpers/realdata-e2e-*-consistency.spec.ts; do grep -E 'expect\([^)]*\)\.toHaveBeenCalled\(\)' "$f" 2>/dev/null | grep -v '\.not\.'; done | wc -l` → 0.
  - test/helpers 전량: `grep -rlE 'expect\([^)]*\)\.toHaveBeenCalled\(\)' test/helpers/`(각 파일에서 `.not.` 제외 positive-loose 잔존 여부 필터) → 0.
  - test/ 트리 전량: `grep -rlE 'expect\([^)]*\)\.toHaveBeenCalled\(\)' test/`(각 파일 `.not.` 제외 positive-loose 필터) → 0.
  - sweep leg 매핑(24~30 = T-1089~T-1095, 각 leg 이 tighten 한 helper/spec) 한 줄 표로 박제.
- [ ] **섹션 B — §D 후보 (a)/(b) 소진 확정 + 남은 후보 명시**: 후보 (a) 구조-guard 선행성은 legs T-1080~T-1088 로, 후보 (b) call-count 완결성은 legs T-1089~T-1095 로 소진됨을 기록하고, 남은 §D 후보가 (c) e2e 흐름 커버리지 **단 하나** 임을 명시.
- [ ] **섹션 C — 후보 (c) e2e 흐름 커버리지 gap-map**: realdata 상위 flow(collect→evaluate→result→publish 종단 시퀀스)의 flow-level spec 존재/부재를 재현 grep 으로 스캔해 표로 박제. 최소 다음 3 축을 기록:
  - 단일-source threading 커버(존재): `ls test/smoke/realdata-e2e-aggregator-*-run-plan-threading-*way-*.smoke-spec.ts | wc -l` 및 base assembly(`test/smoke/realdata-e2e-assembly.smoke-spec.ts`)가 seed→run-plan→step-args 를 커버함을 기록.
  - 종단 시퀀스 order 커버(존재/부재 판정): 전체 pipeline 을 **한 번** 조립해 collect→evaluate→result→publish 의 seam 이 한 flow 안에서 이어짐(각 seam 산출이 다음 seam 입력으로 실제 threading)을 assert 하는 단일 flow-level spec 이 있는지 grep 으로 판정(있으면 경로, 없으면 "부재 → 후보 (c) leg1 대상" 기록).
  - execution-order 커버(존재): daily-test.sh nightly runner 의 step-chain SKIP-propagation/step order 정적 smoke(예: T-0947 계열)가 **실행 순서** 를 이미 커버함을 기록(build-time 조립 vs runtime 실행 축 구분).
- [ ] **섹션 D — 다음 축 pre-check 핸드오프**: 섹션 C 결과에 따라 둘 중 하나를 durable 하게 박제.
  - (c) 에 **진성 gap 발견 시**: 첫 (c) code leg 후보 1~2개를 "적격 판정 grep 1줄 + 예상 산출물 형태(test-only pr, 종단 시퀀스 flow-level spec 1파일) + touchesFiles 후보" 와 함께 제시. **본 task 는 leg 화하지 않는다** — 후보·pre-check 만 박제하고 실제 선택·큐잉은 다음 planner turn.
  - (c) 마저 **이미 조밀 커버로 소진 확인 시**: 그 근거(threading 20-way + base assembly + runtime step-order smoke 3축이 종단 커버를 이미 포괄)를 기록하고, 다음 축 후보(예: `toHaveBeenCalledWith` 인자-충실도 완결성, 또는 P5 의 다른 PLAN bullet)를 pre-check 지침과 함께 나열.
- [ ] **doc-only 확인**: `src/`·`test/`·`prisma/`·helper `.ts` diff 0. 오직 `docs/progress/details/T-1096-*.md` 1파일 신규. `docs/PLAN.md`·`docs/STATE.json` 은 driver/planner 소관이라 본 task 에서 미변경.
- [ ] **재현성 확인**: 산출 doc 의 모든 수치(0, 20-way 개수 등)가 문서에 박제된 grep 명령을 그대로 재실행했을 때 일치.

## Out of Scope

- **어떤 code/spec 변경도 금지** — 본 leg 은 완료 audit + gap-map 박제 doc 1파일뿐. call-count tighten·flow-level spec 신설·guard 배선은 전부 후속 leg(다음 planner turn 이 섹션 D 근거로 큐잉).
- `test/helpers/*`·`test/smoke/*` 개별 파일의 광범위 read — grep 집계 결과만 사용(context 보호). 특정 seam 의 상세 구조가 필요하면 후속 code leg 의 Required Reading 으로 미룬다.
- §D 후보 (c) 의 **실제 선택·leg 화 단정** — 본 task 는 후보 나열 + pre-check 지침만. 실제 첫 (c) leg 큐잉은 다음 turn.
- `docs/PLAN.md` phase/bullet 갱신, `docs/STATE.json` 편집 — driver/planner loop 소관(본 audit doc 밖).
- ADR 신설·`docs/architecture/*` 변경 — 새 architecture 결정 없음(기존 sweep 패턴의 소진 기록일 뿐).

## Suggested Sub-agents

`implementer`(doc 작성). architect·tester 불요(direct doc-only, 신규 결정·코드·spec 0 — R-112 면제). implementer 는 위 재현 grep 을 실행해 수치를 채우고 gap-map 표를 박제한다. driver 는 direct-mode 이므로 tester 미호출(CLAUDE.md §3.2 doc-only 면제) — 단 push 후 R-114 main CI conclusion 은 확인.

## Follow-ups

- (다음 planner turn) 본 audit 섹션 D 의 pre-check 결과로 첫 (c) leg 를 큐잉하거나(진성 gap 발견 시 — 종단 시퀀스 flow-level spec 1파일 test-only pr), (c) 소진 확인 시 다음 축(§D 를 넘어선 P5 test-hardening 후보: 예 `toHaveBeenCalledWith` 인자-충실도 완결성, 또는 다른 PLAN bullet)으로 전환. audit 이 "부분 gap" 으로 끝나면 발견된 gap 을 다음 leg 최우선으로.
