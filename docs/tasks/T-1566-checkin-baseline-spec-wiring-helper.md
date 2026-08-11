---
id: T-1566
title: 체크인 baseline perf-spec 배선 관용구를 공유 helper 로 추출
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 255
estimatedFiles: 2
created: 2026-08-11
createdAt: 2026-08-11T12:10:00Z
independentStream: perf-baseline-checkin
dependsOn: [T-1560, T-1561, T-1562, T-1563, T-1564, T-1565]
touchesFiles:
  - test/perf/checkin-baseline-spec-wiring.ts
  - test/perf/checkin-baseline-spec-wiring.spec.ts
plannerNote: "P5 성능 검증 bullet — ADR-0056 Follow-up (b) 잔여 4 spec 복제 전 관용구 helper 선행 (부품 slice, perf-spec 편집 0)"
---

# T-1566 — 체크인 baseline perf-spec 배선 관용구를 공유 helper 로 추출

## Why

[T-1565](T-1565-checkin-baseline-wire-summary-perf-spec.md) 가
[test/perf/summary-measure-confirm.perf-spec.ts](../../test/perf/summary-measure-confirm.perf-spec.ts)
`579~774 행` 에 체크인 baseline 배선 형태를 **한 번 확정**했다. 그런데 그 형태의 핵심 관용구
(어댑터 호출 1 회 + `outcome.log` 그대로 출력 / 임시 `repoRoot` 안에만 baseline JSON 을 심는
seed) 가 **spec 안 지역 함수** 라, ADR-0056 `§Follow-ups (b)` 의 잔여 4 개 measure→confirm
perf-spec 이 그 형태를 복제하면 같은 관용구가 5 벌로 갈라진다(복제 총량 ~800 LOC · cap 초과 ·
drift 표면 5 배).

본 task 는 **부품만** 만든다 — 그 두 관용구를 `test/perf/checkin-baseline-spec-wiring.ts`
공유 helper 로 추출하고 colocated spec 으로 계약을 못 박는다. **perf-spec 은 한 줄도 건드리지
않는다**(summary 리팩터 · 잔여 4 spec 배선은 각각 후속 slice). 이는 T-1560 ~ T-1564 가 따른
"부품 먼저 박제, 배선은 다음 slice" 리듬 그대로다.

**신규 판정 로직 0** — 토글 판정 · 경로 계산 · 존재 조회 · 비교 · 로그 문자열은 전량 기존
5 모듈 위임이고, 본 helper 는 (1) 위임 1 회 + 로그 출력 결선, (2) 픽스처 seed 의 실경로 오염
차단 가드 두 가지만 책임진다.

완료 선언 0 — [PLAN.md](../PLAN.md) `140~142 행` `[ ]` 와 REQ-048 상태는 본 task 로 바뀌지 않는다.

## Required Reading

- [docs/decisions/ADR-0056-perf-baseline-checkin-ci.md](../decisions/ADR-0056-perf-baseline-checkin-ci.md) — `§Decision 2`(write 국면 부재 — helper 의 seed 는 **테스트 픽스처 전용**이며 저장소 실경로에 쓰지 않는다) · `§Decision 3 (b)`(관찰 전용 · exit code 불변) · `§Follow-ups (b)`
- [test/perf/checkin-baseline-adapter.ts](../../test/perf/checkin-baseline-adapter.ts) — `CheckinBaselineDefaultsInput` · `runCheckinBaselineCheckWithDefaults`(본 helper 가 감싸는 유일한 진입점) · `defaultCheckinRepoRoot`(실경로 가드 비교 기준)
- [test/perf/checkin-baseline-store.ts](../../test/perf/checkin-baseline-store.ts) — `resolveCheckinBaselineDir` · `resolveCheckinBaselinePath`(경로 문자열을 다시 적지 말 것 — 전량 위임)
- [test/perf/checkin-baseline-run.ts](../../test/perf/checkin-baseline-run.ts) — `CheckinBaselineRunOutcome` union(반환은 **가공 없이** 그대로 낸다)
- [test/perf/summary-measure-confirm.perf-spec.ts](../../test/perf/summary-measure-confirm.perf-spec.ts) `605~636 행` — 추출 원본인 `checkCheckinBaseline` · `seedCheckinBaseline` 두 지역 함수 (본 task 는 이 파일을 **읽기만** 한다)
- [test/perf/checkin-baseline-adapter.spec.ts](../../test/perf/checkin-baseline-adapter.spec.ts) — 같은 계열 colocated spec 의 서술 · 픽스처 관용구(임시 디렉토리 격리 · `BaselineEnvMeta` fixture) 참고

## Acceptance Criteria

- [ ] `test/perf/checkin-baseline-spec-wiring.ts` 신규 — export 는 다음 **2 함수 + 입력 타입 1 개** 로 한정한다(그 외 export 추가 금지).
  - [ ] `checkCheckinBaselineForSpec(input)` — `runCheckinBaselineCheckWithDefaults` 를 **정확히 1 회** 호출하고, 주입 로거(`input.log`, 미지정 시 `console.log`)를 **정확히 1 회** `outcome.log` **원문 그대로** 로 호출한 뒤 outcome 을 **가공 없이** 반환한다(로그 문자열 재조립 · 반환 재해석 금지).
  - [ ] `seedCheckinBaselineFixture(envMeta, repoRoot, report)` — `resolveCheckinBaselinePath` 로 얻은 경로에 상위 디렉토리 생성 후 JSON 을 쓰고 그 경로를 반환한다. 단 `repoRoot` 가 `defaultCheckinRepoRoot()` 와 같은 위치로 정규화되면 **`RangeError` 를 던지고 write · mkdir 을 0 회** 수행한다(저장소 실경로 오염 차단 가드).
- [ ] happy path 1+ — 토글 off 기본 상태에서 `checkCheckinBaselineForSpec` 이 `status: "skipped"` · `reason: "disabled"` 를 반환하고 주입 로거가 `outcome.log` 와 **동일 문자열**로 1 회 호출됨을 검증.
- [ ] happy path 1+ — `seedCheckinBaselineFixture` 가 임시 `repoRoot` 아래에 파일을 만들고, 그 경로가 `resolveCheckinBaselinePath(envMeta, repoRoot)` 와 일치하며 내용이 round-trip 파싱됨을 검증.
- [ ] error path 1+ — `checkCheckinBaselineForSpec` 에서 위임 예외(`envMeta.label` 빈 문자열 → `RangeError`, `input` non-object → `TypeError`)가 **래핑 없이** 전파되고 그 국면에서 **로거 호출이 0 회** 임을 검증.
- [ ] error path 1+ — `seedCheckinBaselineFixture` 의 실경로 가드가 `RangeError` 를 던지고, 그 국면에서 `test/perf/baselines` 실경로의 디렉토리 목록이 **호출 전후 동일**함을 검증.
- [ ] 분기 cover — 각 1+ test: (a) `input.log` 주입 국면 vs 미지정(`console.log` spy) 국면, (b) 토글 on × baseline 부재(`skipped`/`absent`), (c) 토글 on × 임시 baseline 존재(`compared` + `regressed` boolean).
- [ ] negative cases 충분 cover — 각 1+ test: (a) `input.log` 가 non-function(예: `123`) → `TypeError` 이고 위임 호출 0 회, (b) `regressed=true` 국면에서도 helper 가 throw 하지 않고 outcome 만 반환(exit code 불변), (c) 토글 off 국면에서 `baselineFileExists` spy 호출 0 회(부작용 0), (d) helper 가 입력 객체(`input` · `envMeta` · `report`)를 변형하지 않음(호출 전후 deep-equal).
- [ ] `test/perf/checkin-baseline-spec-wiring.spec.ts` 는 **colocated** 위치에 두고, 임시 디렉토리는 `afterEach` 재귀 삭제로 회수한다(전역 토글 환경변수는 국면마다 저장 · 원복).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%).
- [ ] 변경 파일 2 개 · diff ≤ 300 LOC 유지 — 초과 조짐이 보이면 JSDoc 을 축약하거나 `it.each` 로 병합하되 위 4 종 test 를 빼지 말 것.

## Out of Scope

- **모든 `*.perf-spec.ts` 편집** — summary spec 의 지역 함수를 helper 위임으로 바꾸는 리팩터, 잔여 4 개 measure→confirm spec 배선 모두 **후속 slice**. 본 task 는 helper 를 소비하는 코드를 만들지 않는다.
- **`test/perf/checkin-baseline-{store,report,plan,run,adapter}.ts` 5 모듈 수정** — 부족한 점이 보이면 Follow-ups 에만 적는다.
- **jest hook(`beforeEach`/`afterEach`) 을 helper 모듈 안에 넣는 형태** — 토글 격리 hook 은 각 spec 의 책임으로 남긴다(helper 는 hook 무의존 순수 함수 + fs 픽스처 2 개만).
- **체크인 baseline JSON 최초 생성 · commit**(ADR-0056 `§Follow-ups (a)`) — 저장소 `test/perf/baselines/` 에 파일 · 디렉토리를 만들지 않는다.
- **`.github/workflows/ci.yml` 편집 · `daily-test.sh` leg 추가 · drift-guard smoke spec 수정** — 파일 cap 을 깨는 축이라 진입 금지.
- **PLAN `140~142 행` · REQ-048 · 부하계획 `§ 3` 갱신** — 별도 doc-sync task.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- summary measure→confirm perf-spec 의 지역 `checkCheckinBaseline` · `seedCheckinBaseline` 을
  본 helper 위임으로 교체(중복 제거 slice).
- 잔여 4 개 measure→confirm perf-spec(assessment · contribution · app-root · person 계열)에
  helper 기반 배선 복제 — helper 도입으로 spec 당 변경이 작아져 2 개씩 묶어 slice 가능.
- ADR-0056 `§Follow-ups (a)` — 체크인 baseline JSON 최초 생성 · commit(실측 + 사람 눈 확인 전제).
