---
id: T-1574
title: 소비자 4 perf-spec 의 factory 배선 국면 개수 · 조합 주석 parity 갱신
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 45
estimatedFiles: 4
created: 2026-08-16
createdAt: 2026-08-16T18:39:21Z
completedAt: 2026-08-16T19:56:19Z
prNumber: 1255
independentStream: perf-baseline-checkin
dependsOn: [T-1573]
touchesFiles:
  - test/perf/summary-measure-confirm.perf-spec.ts
  - test/perf/assessment-measure-confirm.perf-spec.ts
  - test/perf/contribution-measure-confirm.perf-spec.ts
  - test/perf/app-root-measure-confirm.perf-spec.ts
plannerNote: "P5 성능 검증 — T-1573 Follow-up: 승격으로 factory 국면 7→10 이 된 뒤 남은 소비자 spec 주석 drift 정정"
---

# T-1574 — 소비자 4 perf-spec 의 factory 배선 국면 개수 · 조합 주석 parity 갱신

## Why

T-1573 이 공유 factory([checkin-baseline-spec-suite.ts](../../test/perf/checkin-baseline-spec-suite.ts))
에 **토글 on × 기본 바인딩** 국면 3 개를 승격해 factory 국면은 **7 개 → 10 개**
(happy 3 · error 2 · 분기 2 · negative 3)가 됐고, colocated spec 은 이미 `toHaveLength(10)` ·
`"3,2,2,3"` 으로 갱신됐다. 그런데 factory 를 쓰는 소비자 4 perf-spec 의 주석은 여전히
"배선 국면 7 개(happy 2 · error 2 · 분기 1 · negative 2)" 로 남아 **사실과 어긋난다** —
T-1573 이 Follow-up 으로 명시하고 Out of Scope 로 미룬 doc-sync slice 다. 특히
`summary` 의 "factory 국면 7 개는 토글 on 이면 전부 임시 `repoRoot` 주입" 서술은 승격 이후
**틀린 근거**라, 다음 slice(고유 국면 중복 정리)의 판단 근거를 오염시킨다.

## Required Reading

- [test/perf/checkin-baseline-spec-suite.ts](../../test/perf/checkin-baseline-spec-suite.ts) — 정본. `phases` 객체의 현재 국면 **10 개** 와 label 접두(happy / error / 분기 / negative) 확인용. 본 task 에서 **수정하지 않는다**
- [test/perf/checkin-baseline-spec-suite.spec.ts](../../test/perf/checkin-baseline-spec-suite.spec.ts) — 갱신된 개수 · 조합 단언(`toHaveLength(10)`, `kinds.join()` === `"3,2,2,3"`)이 주석 문구의 근거. 본 task 에서 **수정하지 않는다**
- [test/perf/summary-measure-confirm.perf-spec.ts](../../test/perf/summary-measure-confirm.perf-spec.ts) — 변경 대상 1. 파일 상단 배선 요약 주석(`배선 국면 7 개는 …`), `registerCheckinBaselineWiringSuite` 호출 직전 블록 주석(`배선 국면 7 개(happy 2 · …)`), T-1572 고유분 블록 주석의 `factory 국면 7 개는 토글 on 이면 전부 임시 repoRoot 주입 …` 서술
- [test/perf/assessment-measure-confirm.perf-spec.ts](../../test/perf/assessment-measure-confirm.perf-spec.ts) — 변경 대상 2. 파일 상단 배선 요약 주석 + `registerCheckinBaselineWiringSuite` 호출 직전 블록 주석
- [test/perf/contribution-measure-confirm.perf-spec.ts](../../test/perf/contribution-measure-confirm.perf-spec.ts) — 변경 대상 3. `registerCheckinBaselineWiringSuite` 호출 직전 블록 주석
- [test/perf/app-root-measure-confirm.perf-spec.ts](../../test/perf/app-root-measure-confirm.perf-spec.ts) — 변경 대상 4. `registerCheckinBaselineWiringSuite` 호출 직전 블록 주석
- [docs/tasks/T-1573-promote-real-path-toggle-on-phases-to-factory.md](T-1573-promote-real-path-toggle-on-phases-to-factory.md) — `## Follow-ups` (본 slice 의 출처) + `## 결과` 의 승격 내용

## Acceptance Criteria

- [ ] 소비자 4 spec 의 `배선 국면 7 개` 표기를 **`배선 국면 10 개`** 로, 조합 표기
      `(happy 2 · error 2 · 분기 1 · negative 2)` 를 **`(happy 3 · error 2 · 분기 2 · negative 3)`** 로
      갱신한다. 개수 · 조합은 `checkin-baseline-spec-suite.spec.ts` 의 `toHaveLength(10)` ·
      `"3,2,2,3"` 단언과 일치해야 한다(추측 금지 — 정본 대조).
- [ ] `summary-measure-confirm.perf-spec.ts` 의 T-1572 고유분 블록 주석에서
      "factory 국면 7 개는 토글 on 이면 전부 임시 `repoRoot` 주입이고 실경로 국면은 전부 토글 off 라
      … 본 국면들에서만 실행된다(중복 0)" 서술을 사실에 맞게 정정한다 — T-1573 승격 이후
      **factory 에도 토글 on × 기본 바인딩 국면 3 개가 존재**하므로 본 고유분은 더 이상
      "유일 경로" 가 아니라 **중복분이며 별도 slice 에서 정리 예정** 임을 1~3 줄로 명시한다.
- [ ] 주석 **문구만** 바뀌고 실행 코드(`import` · `describe` · `it` · 단언 · `registerCheckinBaselineWiringSuite`
      호출 인자)는 1 줄도 바뀌지 않는다 — `git diff` 상 변경 hunk 가 전부 `//` 주석 줄임을 확인한다.
- [ ] 4 파일 어디에도 `배선 국면 7 개` · `factory 국면 7 개` · `happy 2 · error 2 · 분기 1 · negative 2`
      문자열이 남지 않음을 확인한다(`grep -rn "국면 7 개\|분기 1 · negative 2" test/perf/*.perf-spec.ts` → 0 건).
- [ ] R-112 (happy / error / 분기 / negative): 본 slice 는 **주석 전용 변경으로 public symbol 추가 ·
      수정 0 · 실행 분기 0** 이라 신규 test 를 작성하지 않는다 — 대신 기존 test 가 **하나도 줄지 않고
      전부 그대로 통과**함으로 회귀 부재를 증명한다(아래 두 항목). 분기 없음 — 이 항목 생략.
- [ ] `npx jest -c test/perf/jest-perf.json --testPathPattern "checkin-baseline-spec-suite|measure-confirm\\.perf-spec"`
      로 factory colocated spec + 소비자 4 spec 전량 pass, **test 개수가 변경 전과 동일**함을 확인한다
      (`*-realdb` 계열은 Postgres 부재로 제외).
- [ ] `pnpm lint --max-warnings=0` · `pnpm build` 통과.
- [ ] `pnpm test` 통과 + `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%).
- [ ] 실행 후 저장소 실경로 `test/perf/baselines` 가 실행 전과 동일(미존재 또는 목록 불변) — 오염 0.

## Out of Scope

- `summary-measure-confirm.perf-spec.ts` 의 T-1572 고유 국면 5 개 **삭제 · 축약** — 본 slice 는
  주석 정정만 하고 중복 정리는 별도 slice(코드 삭제 + 단언 재배치라 성격이 다름).
- `checkin-baseline-spec-suite.ts` · `checkin-baseline-spec-suite.spec.ts` 수정(정본 — 이미 정합).
- `.github/workflows/ci.yml` 편집 · `perf test` step 토글 on 편입(ADR-0056 `§Follow-ups (b)` 본체).
- `test/perf/baselines/*.json` 최초 생성 · commit(`§Follow-ups (a)`).
- `*-realdb` · `*-read` 계열 perf-spec 의 factory 배선.
- `PLAN.md` · REQ-048 상태 갱신 등 완료 선언(`§Follow-ups (d)`).
- 판정 · 경로 · 로그 helper(`checkin-baseline-*.ts`) 의 동작 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- `summary-measure-confirm.perf-spec.ts` 의 T-1572 고유 국면 5 개 **중복 정리** slice — T-1573 factory
  승격으로 중복화된 국면을 삭제하고 단언을 재배치(코드 삭제 성격이라 본 주석 slice 와 분리).

## 결과 (2026-08-16)

- **DONE** — PR **#1255** squash merge `4e0f6d1d`. 소비자 4 perf-spec 의 배선 국면 표기를 정본
  단언(`toHaveLength(10)` · `"3,2,2,3"`)과 대조해 **7 개 → 10 개**(happy 3 · error 2 · 분기 2 ·
  negative 3) 로 갱신 — **주석 전용 변경**(diff hunk 전부 `//`, 실행 코드 0 줄, `+17/-15` · 4 파일).
- `summary` 의 "유일 경로(중복 0)" 서술은 T-1573 승격 이후 **중복분** 임을 명시하도록 정정.
- **R-110/R-112** — 주석 전용이라 신규 spec 불요, perf 4 suite **126 test** 변경 전과 동일 pass,
  전체 unit **436 suite / 12482 test** pass, `test:cov` line · function ≥ 80% 통과,
  `lint --max-warnings=0` · `build` 통과, `test/perf/baselines` 실행 전후 미존재(오염 0).
- **4-게이트** — reviewer APPROVE(round 1) PR comment 외화 + integrator 자체 점검 + CI green +
  squash merge · branch 삭제. Nit finding 0 이라 nit-in-PR closure 추가 commit 없음.
