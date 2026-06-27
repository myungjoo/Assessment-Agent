---
id: T-0727
title: realdata-e2e build-time consistency-guard harness architecture doc 신설 + INDEX 동기
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-032, REQ-059]
estimatedDiff: 180
estimatedFiles: 2
created: 2026-06-28
independentStream: realdata-e2e-guard-harness-doc
dependsOn: []
touchesFiles:
  - docs/architecture/realdata-e2e-guard-harness.md
  - docs/architecture/INDEX.md
plannerNote: "P5 §109 실 평가 e2e — build-time consistency-guard sweep(T-0584~T-0726, composer 33↔guard 33+shape 3=71 helper) 종결을 architecture doc 으로 외화. 미래 planner re-survey 비용 0 화. doc-only direct, dependency-free cron-autonomous."
---

# T-0727 — realdata-e2e build-time consistency-guard harness architecture doc 신설 + INDEX 동기

## Why

PLAN.md Phase P5(Evaluation pipeline) 109행 "실 평가 e2e" bullet 의 build-time consistency-guard sweep 가 **종결**됐다(STATE.backlogNote: "build-time consistency-guard sweep 종결. nextTask=null. … 추가 value-consistency 신설 정당화 0"). 이 sweep 는 T-0584(`resolveRealDataResultIssueAction`) 부터 T-0726(`buildRealDataResultIssueOutcomeReport` self-wire) 까지 이어진 가장 긴 단일 task 사슬로, `test/helpers/realdata-e2e-*.ts` 에 **composer 33 개 ↔ 정합 가드 33 개 + shape 가드 3 개 = 71 helper 파일**(non-spec 기준)을 박제했다. 그러나 이 harness 는 **architecture-level 문서가 0** 이다 — `docs/architecture/INDEX.md` 의 문서 목록 표가 deployment / components / modules / api / data-model / concurrency / race-patterns 등 모든 주요 view 를 박제하면서도 realdata-e2e guard harness 만 누락돼 있다(`grep -rln "realdata-e2e" docs/architecture/` 결과 0).

이 문서 부재의 비용: 다음 fire 의 planner 가 "fresh survey" 를 하려면 71 개 helper 파일 + 그 사슬의 task 정의서들을 다시 읽어 composer↔guard 대응·self-wire idiom·"왜 더 이상 신설 정당화가 0 인가(transitive cover)" 를 **재추론**해야 한다(CLAUDE.md §7.3 "같은 결정을 두 번 추론하지 않도록 ADR/doc 에 적는다" 위반). 본 task 는 그 hard-won survey 결과를 architecture doc 1 개로 영속 외화해, 미래 planner / architect 가 그 1 개만 읽고 harness 전모·sweep 종결 근거·잔여 NO-GUARD leaf 판정을 파악하게 한다. REQ-032(이슈 표면 정합·raw 미저장)·REQ-059(입력 외 데이터 생성 0) 가드층의 설계 의도를 문서화한다.

본 task 는 **doc-only(`commitMode: direct`)** — 코드·테스트·CI·dependency 변경 0. 새 가드를 신설하지 않는다(sweep 종결 — backlogNote "추가 value-consistency 신설 정당화 0" 준수). dependency-free·credential-free 라 cron 이 자율 실행 가능하다.

## Required Reading

- `docs/architecture/INDEX.md` — architecture 문서 목록 표 + ADR 매핑 표. 본 task 가 "문서 목록" 표에 realdata-e2e-guard-harness 행 1 줄을 추가한다(생성 task = T-0727, 상태 = 완료). 표 컬럼 형식(문서 / 책임 / 생성 task / 상태)을 기존 행과 동일하게 맞춘다.
- `test/helpers/realdata-e2e-result-issue-action.ts` 상단 주석(L1~60) — composer→guard 패턴의 대표 예. "build-time 완결 — dependency-free(cloud cron 자율 실행 가능)"·"raw 미저장 정합(R-59/REQ-032)"·"결정론적 출력(동일 입력 → byte-identical)"·"무공유 보장(입력 mutate 0)" 4 불변식이 모든 composer 의 공통 설계 계약. 이 4 불변식을 doc §설계계약 으로 일반화 박제.
- `test/helpers/realdata-e2e-result-issue-outcome-report-output-consistency.ts`(가드 본체 예) + `docs/tasks/T-0725-realdata-e2e-result-issue-outcome-report-output-value-consistency.md`(가드 신설 task) + `docs/tasks/T-0726-realdata-e2e-result-issue-outcome-report-output-value-consistency-self-wire.md`(self-wire 짝) — "독립 재유도 deep-equal 정합 가드 신설 → 컴포저 단일 return 직전 self-wire 배선" 2-step idiom 의 대표. 구조결손 TypeError ↔ 값정합 위반 RangeError 분리, type-only import 라 순환 0·top-level import(lazy require 불요) 패턴을 doc §self-wire idiom 으로 박제.
- STATE.json `backlogNote`(T-0726 DONE 항목) — sweep 종결 선언("build-time consistency-guard sweep 종결")·종결 근거("shape-only 9개의 value drift 는 sibling value-consistency 가드(T-0711/T-0721/T-0723)로 transitive cover 확인 — 추가 value-consistency 신설 정당화 0")·다음 방향 후보(rolling-issue helper 또는 §109 step③ live-LLM). 이 종결 판정·근거를 doc §sweep 종결 로 박제(미래 planner 가 본 doc 만 읽고 "더 신설 말 것" 을 안다).

## Acceptance Criteria

`docs/architecture/realdata-e2e-guard-harness.md` 1 개를 신설하고 `docs/architecture/INDEX.md` 문서 목록 표에 1 행을 추가한다. 본 task 는 **doc-only** — `test/`·`src/`·`.github/`·`package.json`·`schema.prisma` 변경 0. 새 가드 helper 신설 0(sweep 종결 준수).

- [ ] `docs/architecture/realdata-e2e-guard-harness.md` 신설. 다음 절을 포함(한국어 본문, §12):
  - [ ] **§1 목적·배경** — PLAN §109 실 평가 e2e step ④(daily-test result/rolling 이슈 박제)의 build-time(network/credential 0) 산출 경로 검증이 harness 의 존재 이유. `deploy/daily-test.sh` step_eval live wiring 은 별개(credential gate) — 본 harness 는 순수 함수 composer 의 산출 정확성만 build-time 에 fail-fast 한다.
  - [ ] **§2 composer↔guard 인벤토리** — `test/helpers/realdata-e2e-*.ts`(non-spec) **71 파일 = composer 33 + 정합 가드 33 + shape 가드 3** 의 대응을 도메인 그룹(seed / evaluation / pipeline / live-gating / result-summary / result-issue / scoring)별로 표 박제. 각 행: 그룹 / 대표 composer / 짝 가드 / 신설·self-wire task ID(anchor 예: action T-0584, summary-line T-0711, search-parse T-0721/22, output-parse T-0723/24, outcome-report T-0725/26). 전수 71 행 나열은 불요 — 그룹 단위 요약 + anchor task 로 미래 navigate 가능하게.
  - [ ] **§3 composer 설계 계약(4 불변식)** — 모든 composer 가 공유하는 ① build-time 완결(network/env/DB/LLM/credential 0, 내장 string/배열 연산만) ② raw 미저장 정합(R-59/REQ-032 — narrative·raw 활동 본문 비노출) ③ 결정론적 출력(동일 입력 → byte-identical, 시각·난수·env 의존 0) ④ 무공유(입력 mutate 0, 매 호출 새 객체) 를 일반화 박제. result-issue-action.ts 상단 주석을 일반화 출처로 인용.
  - [ ] **§4 정합 가드 2-step idiom** — (1) 독립 재유도 deep-equal 가드 신설(composer 재호출 없이 입력으로부터 expected 산출을 재유도해 deep-equal 대조, 구조결손 TypeError ↔ 값정합 위반 RangeError 분리) → (2) composer 단일 return 직전 self-wire 배선(type-only import 라 순환 0·top-level import, lazy require 불요). T-0725(신설)/T-0726(self-wire) 를 idiom 의 canonical 예로 인용.
  - [ ] **§5 sweep 종결 판정·근거** — sweep 범위(T-0584~T-0726), 종결 선언, 종결 근거(shape-only 가드의 value drift 는 sibling value-consistency 가드로 transitive cover → 추가 value-consistency 신설 정당화 0), 미래 방향 후보(rolling-issue helper / §109 step③ live-LLM credential gate). **미래 planner 가 본 §만 읽고 "추가 value-consistency 가드 신설 금지(redundant)" 를 판정**할 수 있게 명시.
  - [ ] **§6 cross-ref** — PLAN §109, REQ-032/REQ-059, STATE.backlogNote, race-patterns.md(가드가 race 와 무관함 — 순수 함수), concurrency.md(test-only helper 라 claim/lock 무관) 로의 링크.
- [ ] `docs/architecture/INDEX.md` "문서 목록" 표에 행 추가: `[realdata-e2e-guard-harness.md](realdata-e2e-guard-harness.md) | realdata-e2e build-time consistency-guard harness — composer 33↔guard 33+shape 3 인벤토리 + 4 불변식 설계계약 + 독립재유도→self-wire 2-step idiom + sweep 종결 근거(T-0584~T-0726) | T-0727 (P5) | 완료 (T-0727)`. 기존 표 컬럼·정렬과 동일 형식.
- [ ] 새 doc 의 §2 인벤토리 수치(composer 33 / 가드 33 / shape 3 / 합 71)가 실제 `ls test/helpers/realdata-e2e-*.ts | grep -v .spec.ts` 결과와 일치(작성 시 재확인 — 본 task 가 가드를 신설하지 않으므로 수치 고정).
- [ ] 본문 한국어·식별자/경로/REQ ID 영어(§12). markdown 링크 경로가 `docs/architecture/` 기준 상대경로로 정확.
- [ ] `test/`·`src/`·`.github/workflows/`·`package.json`·`schema.prisma` **변경 0**(doc-only). 새 가드 helper 신설 0.

## Out of Scope

- 새 consistency 가드·shape 가드·composer helper 신설 **금지** — sweep 종결(backlogNote "추가 value-consistency 신설 정당화 0"). 본 task 는 기존 harness 의 문서화만.
- self-wire 배선 추가·기존 가드 수정·composer 산출 규약 변경 금지(read-only 인벤토리·설계 설명).
- `test/`·`src/` 코드·CI workflow·package.json·schema.prisma 변경 금지(doc-only `direct`).
- §109 step ④ live wiring(`deploy/daily-test.sh` step_eval·`LLM_LIVE_*`·실 gh issue create/edit)·step③ live-LLM 검증(credential gate) 진입 금지 — 본 doc 은 build-time harness 의 경계만 설명, live 경로는 cross-ref 로만 언급.
- INDEX.md 의 "ADR 매핑" 표·"갱신 룰" 절 수정 금지(본 harness 는 ADR 신설을 동반하지 않음 — test helper 설계 패턴은 ADR 대상 아님). "문서 목록" 표 1 행 추가만.
- 71 helper 전수 나열 금지(§2 는 그룹 단위 요약 + anchor task ID — 본문 비대화 방지, ≤300 LOC cap 보호).
- 새 dependency 도입 0.

## Suggested Sub-agents

`implementer`(doc-only — architect 불요: 새 ADR/architecture 결정 없이 기존 harness 의 설계 의도·인벤토리를 외화만. tester 불요: 코드·CI 변경 0 인 direct doc-only commit, CLAUDE.md §3.2 R-110 doc-only 면제). driver 가 implementer 결과를 받아 direct commit.

## Follow-ups

- 본 doc §5 sweep 종결 박제 후, 다음 fire planner 는 §109 step③ live-LLM 검증(credential gate — 사용자 승인 2026-06-11, 만료 2026-06-30 임박)을 별도 BLOCKED-gated task 로 큐잉할지, 또는 §110 timezone ADR-first(dependency-free) 를 다음 forward 방향으로 잡을지 판정.
- rolling-issue 방향이 실제 새 helper 를 요구하는지(현 harness 는 update=snapshot replace 의미 — 누적 helper 부재가 gap 인지 design 인지)는 본 doc §2/§4 정리 후 case-by-case 재판정. 현재로선 replace semantics 가 의도된 설계(T-0584 action resolver 주석 "후보 2+ 건 → 최소 number update" 멱등 회귀 보호)로 보임 — 신설 불요 가능성 높음.
