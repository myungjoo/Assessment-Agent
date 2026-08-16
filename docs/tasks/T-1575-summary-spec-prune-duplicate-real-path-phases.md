---
id: T-1575
title: summary perf-spec 의 factory 중복 국면 3 개 정리 (기본 바인딩 고유분 축소)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 135
estimatedFiles: 1
created: 2026-08-16
independentStream: perf-baseline-checkin
dependsOn: [T-1574]
touchesFiles:
  - test/perf/summary-measure-confirm.perf-spec.ts
plannerNote: "P5 성능 검증 — T-1574 Follow-up: T-1573 승격으로 중복화된 summary 고유 국면 3 개 삭제 + 잔존 근거 명시"
---

# T-1575 — summary perf-spec 의 factory 중복 국면 3 개 정리 (기본 바인딩 고유분 축소)

## Why

T-1572 가 [summary-measure-confirm.perf-spec.ts](../../test/perf/summary-measure-confirm.perf-spec.ts)
에만 **토글 on × 저장소 실경로 기본 바인딩** 국면 5 개를 넣어 마지막 seam 을 닫았으나, T-1573 이
같은 성격의 국면 3 개(`happy (c)` · `분기 (d)` · `negative (c)`)를 공유 factory
[checkin-baseline-spec-suite.ts](../../test/perf/checkin-baseline-spec-suite.ts) 로 승격하면서 그
고유분 중 3 개가 **정확한 중복**이 됐다. T-1574 는 주석으로 중복 사실만 박제하고 정리는 별도
slice 로 미뤘다(`## Follow-ups`). 중복 국면은 같은 seam 을 두 번 실행해 perf suite 시간만
늘리고, 지역 사본이 남아 있으면 factory 판본과 갈라질 drift 원천이 된다 — 본 slice 가 그 3 개만
삭제한다.

## Required Reading

- [test/perf/summary-measure-confirm.perf-spec.ts](../../test/perf/summary-measure-confirm.perf-spec.ts) — 본 task 의 **유일한 수정 대상**. `describe("체크인 baseline 확인 배선 — spec 고유 통합 국면 ...")` 안의 국면 7 개(주입 토글 2 + 기본 바인딩 5)와 파일 머리말의 국면 개수 주석
- [test/perf/checkin-baseline-spec-suite.ts](../../test/perf/checkin-baseline-spec-suite.ts) — 중복 판정의 **정본**. `phases` 의 T-1573 승격분 3 개(`happy (c) 토글 on × 기본 바인딩` · `분기 (d) 기본 바인딩 존재-조회` · `negative (c) 기본 바인딩 on/off 연속`)가 무엇을 단언하는지 대조용. 본 task 에서 **수정하지 않는다**
- [test/perf/checkin-baseline-spec-suite.spec.ts](../../test/perf/checkin-baseline-spec-suite.spec.ts) — factory 국면 10 개 · 조합 `"3,2,2,3"` 단언(중복 판정의 근거). 본 task 에서 **수정하지 않는다**
- [docs/tasks/T-1574-consumer-perf-spec-factory-phase-comment-parity.md](T-1574-consumer-perf-spec-factory-phase-comment-parity.md) — `## Follow-ups`(본 slice 의 출처) + `## 결과`
- [docs/decisions/ADR-0056-checkin-latency-baseline.md](../decisions/ADR-0056-checkin-latency-baseline.md) — `§Decision 2`(write 경로 부재) · `§Decision 3 (b)`(exit code 불변) · `§Follow-ups (b)`

## Acceptance Criteria

- [ ] `summary-measure-confirm.perf-spec.ts` 의 spec 고유 국면 중 **factory 승격분과 1:1 중복인 3 개**
      — `happy (e) 토글 on × 기본 바인딩(실경로) …` · `분기 (g) 기본 바인딩 존재-조회 경계 …` ·
      `negative (h) 기본 바인딩 토글 on/off 연속 호출 …` — 만 **삭제**한다. 삭제 전 각 국면의 단언이
      factory 의 `happy (c)` · `분기 (d)` · `negative (c)` 에 **모두 포함됨을 정본 대조로 확인**하고,
      대응 관계를 남는 블록 주석에 1 줄로 박제한다(추측 삭제 금지).
- [ ] **잔존 국면 4 개는 그대로 둔다** — 주입 토글 2 개(`negative (c)` · `negative (d)`) +
      기본 바인딩 2 개(`error (f) … envMeta.label 빈 값 → RangeError 전파 + 실경로 목록 불변` ·
      `negative (i) 국면 종료 후 전역 토글이 진입 전 값과 정확히 동일`). 이 둘이 factory 국면에
      **없는 고유 seam** 인 이유(전자는 기본 바인딩 × 경로 해석 선행으로 실경로 mkdir · write 0,
      후자는 spec 지역 `withGlobalFlag` 의 `try/finally` 원복 계약)를 주석 1~3 줄로 명시한다.
- [ ] 삭제로 **미사용이 된 import 만** 정리한다 — `CHECKIN_LOG_PREFIX` ·
      `resolveCheckinBaselinePath` · `import * as baselineIo` 각각이 파일 안에서 0 회 참조인지
      `grep -n` 으로 확인한 뒤 제거하고, 여전히 참조되는 심볼(`resolveCheckinBaselineDir` ·
      `seedCheckinBaselineFixture` · `parseBaselineReport` · `defaultCheckinRepoRoot` 등)은
      **건드리지 않는다**. 지역 helper(`withGlobalFlag` · `realCheckinDir` · `realDirSnapshot` ·
      `measureCandidate`)도 잔존 국면이 쓰므로 유지한다.
- [ ] 국면 개수 주석 parity — 파일 머리말의 "T-1572 가 그 고유분에 … 국면 5 개를 더해 … 지금은 그
      5 개가 중복분이다(정리는 별도 slice)" 서술과 고유 국면 블록의 "주입 토글 2 + 기본 바인딩 5,
      합 7 개" 표기를 **정리 후 실제 개수(주입 토글 2 + 기본 바인딩 2, 합 4 개)** 로 갱신한다.
      `grep -n "기본 바인딩 5\|합 7 개" test/perf/summary-measure-confirm.perf-spec.ts` → 0 건.
- [ ] factory 호출부(`registerCheckinBaselineWiringSuite({ envMeta … tempDir })`)의 인자와 그 밖의
      기존 국면(S2 measure→confirm 본체 · 주입 토글 2 국면)의 **실행 코드는 1 줄도 바뀌지 않는다** —
      `git diff` 에서 해당 영역 변경 hunk 0 을 확인한다.
- [ ] R-112 happy-path: 본 slice 는 **test 삭제 전용이라 신규 public symbol 0** 이므로, 삭제된 3 국면이
      겨냥하던 happy seam(토글 on × 기본 바인딩 → throw 0 + prefix 로그)이 factory 의 `happy (c)` 로
      **여전히 실행됨**을 jest 출력의 국면 label 존재로 증명한다(soft-delete 아님 — 커버리지 이관 증명).
- [ ] R-112 error path: 삭제 후에도 error seam 2 종(`error (f)` 지역 잔존분 +
      factory `error (1)` · `error (2)`)이 모두 실행돼 `RangeError` 전파와 실경로 목록 불변이
      계속 단언됨을 jest 출력으로 확인한다.
- [ ] R-112 분기 cover: `baselineFileExists` 위임 경계(토글 on 1 회 / off 0 회) 분기가 factory
      `분기 (d)` · `negative (b)` 로 양쪽 다 계속 실행됨을 확인한다 — 삭제로 사라지는 분기 0.
- [ ] R-112 negative cases 충분 cover: 실경로 무오염(`negative (c)` factory) · 회귀에도 throw 0
      (`negative (a)` factory) · 전역 토글 누출 0(`negative (i)` 지역 잔존) 3 종이 정리 후에도 모두
      실행됨을 확인한다. 본 slice 가 새로 추가하는 분기 0 — 신규 test 는 작성하지 않는다.
- [ ] `npx jest -c test/perf/jest-perf.json --testPathPattern "checkin-baseline-spec-suite|measure-confirm\\.perf-spec"`
      전량 pass 이고, 전체 test 개수가 **정확히 3 감소**(삭제한 국면 수와 일치)함을 정리 전후 수치로
      확인한다(`*-realdb` 계열은 Postgres 부재로 제외).
- [ ] `pnpm lint --max-warnings=0` · `pnpm build` 통과(미사용 import 잔존 시 여기서 red).
- [ ] `pnpm test` 통과 + `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%).
- [ ] 실행 후 저장소 실경로 `test/perf/baselines` 가 실행 전과 동일(미존재 또는 목록 불변) — 오염 0.

## Out of Scope

- `checkin-baseline-spec-suite.ts` · `checkin-baseline-spec-suite.spec.ts` 수정(정본 — 이미 정합).
- 소비자 3 spec(`assessment` · `contribution` · `app-root`) 수정 — 이들에는 애초에 고유 중복분이 없다.
- 잔존 국면 4 개(주입 토글 2 + `error (f)` + `negative (i)`) 의 삭제 · 축약 · factory 승격.
- 지역 helper 를 factory 로 옮기는 리팩터(승격은 별도 slice 성격).
- `.github/workflows/ci.yml` 편집 · `perf test` step 토글 on 편입(ADR-0056 `§Follow-ups (b)` 본체).
- `test/perf/baselines/*.json` 최초 생성 · commit(`§Follow-ups (a)`).
- `*-realdb` · `*-read` 계열 perf-spec 의 factory 배선.
- `PLAN.md` · REQ-048 상태 갱신 등 완료 선언(`§Follow-ups (d)`).
- 판정 · 경로 · 로그 helper(`checkin-baseline-*.ts`) 의 동작 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups
