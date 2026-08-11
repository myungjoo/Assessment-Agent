---
id: T-1568
title: 체크인 baseline 배선 describe 를 공유 suite factory 로 추출
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 270
estimatedFiles: 2
created: 2026-08-11
createdAt: 2026-08-11T15:42:00Z
independentStream: perf-baseline-checkin
dependsOn: [T-1566, T-1567]
touchesFiles:
  - test/perf/checkin-baseline-spec-suite.ts
  - test/perf/checkin-baseline-spec-suite.spec.ts
plannerNote: "P5 성능 검증 — ADR-0056 배선 복제 비용 절감 부품 slice: 국면 describe 를 suite factory 로 추출 (신규 파일 2 개)"
---

# T-1568 — 체크인 baseline 배선 describe 를 공유 suite factory 로 추출

## Why

[T-1567](T-1567-checkin-baseline-wire-helper-assessment.md) 이 assessment measure→confirm
perf-spec 에 체크인 baseline 배선 describe 를 **첫 복제** 하면서 실측 비용이 드러났다 — 한 spec
당 **+197 LOC**(test 8 개 + import 블록 + 주석). 배선을 태울 잔여 소비자는
`contribution` · `app-root` 두 개의 measure→confirm perf-spec 과 `*-realdb` 계열 5 개, 합계
**7 개** 라서 지금 형태로 복제를 계속하면 약 **1,400 LOC** 의 같은 describe 가 9 벌로 갈라진다.
이는 [T-1566](T-1566-checkin-baseline-spec-wiring-helper.md) 이 판정·경로 관용구를 helper 로
모아 없앤 drift 표면을, 이번엔 **jest 국면 배선 층에서 다시 만드는** 셈이다.

본 task 는 그 복제를 멈추기 위한 **부품 slice** 로,
[test/perf/assessment-measure-confirm.perf-spec.ts](../../test/perf/assessment-measure-confirm.perf-spec.ts)
의 배선 describe 가 실제로 spec 마다 달라지는 부분(`envMeta` · candidate 측정 함수 · 임시
디렉토리 생성기)만 **주입 파라미터** 로 뽑고 나머지 국면 배선을 공유 factory 함수 하나로 모은다.
factory 가 서면 잔여 7 spec 의 추가분은 import + 호출 **~10 LOC** 로 줄고, 이미 복제된 summary ·
assessment 두 spec 도 후속 slice 에서 같은 호출로 수렴시킬 수 있다.

**판정 · 경로 · 로그 · 실경로 가드 재구현 0** — 전량 T-1560 ~ T-1566 모듈 위임이며, 본 모듈이
더하는 책임은 (1) jest 국면 등록과 (2) 등록 시점 인자 형태 검사 둘뿐이다. 토글
(`PERF_CHECKIN_BASELINE`) 이 꺼진 기본 상태에서 `fs` 조회 0 · write 0 · exit code 불변이라
기존 `perf test` step 동작은 바뀌지 않는다(ADR-0056 `§Decision 2` · `§Decision 3 (b)`).

## Required Reading

- [test/perf/checkin-baseline-spec-wiring.ts](../../test/perf/checkin-baseline-spec-wiring.ts) — factory 가 위임할 helper 2 개(`checkCheckinBaselineForSpec` · `seedCheckinBaselineFixture`)의 시그니처 · 예외 계약 · 실경로 오염 가드.
- [test/perf/checkin-baseline-spec-wiring.spec.ts](../../test/perf/checkin-baseline-spec-wiring.spec.ts) — 합성 `BaselineReport` 리터럴 빌더(`report()`) · 임시 `repoRoot` 격리 · 전역 토글 저장·원복 패턴. 본 task 의 colocated spec 이 그대로 따를 형태이며, helper 계약이 이미 cover 하는 국면을 중복 작성하지 않기 위한 참조.
- [test/perf/assessment-measure-confirm.perf-spec.ts](../../test/perf/assessment-measure-confirm.perf-spec.ts) `626~809 행` — 추출 원본 describe 전체(국면 8 개). 그중 `negative (d)` round-trip 만 spec 고유 통합 국면이라 factory 대상이 아니다(아래 Out of Scope).
- [test/perf/checkin-baseline-store.ts](../../test/perf/checkin-baseline-store.ts) — `resolveCheckinBaselineDir` · `resolveCheckinBaselinePath`(국면 단언이 쓰는 경로 계산).
- [test/perf/checkin-baseline-plan.ts](../../test/perf/checkin-baseline-plan.ts) `CHECKIN_BASELINE_ENV_FLAG` · [test/perf/checkin-baseline-report.ts](../../test/perf/checkin-baseline-report.ts) `CHECKIN_LOG_PREFIX` — 토글 격리 · 로그 접두 단언에 필요.
- [docs/decisions/ADR-0056-perf-baseline-checkin-ci.md](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Decision 2` · `§Decision 3 (b)` · `§Follow-ups (b)`.

## Acceptance Criteria

- [ ] 신규 [test/perf/checkin-baseline-spec-suite.ts](../../test/perf/checkin-baseline-spec-suite.ts) 가 `registerCheckinBaselineWiringSuite(options)` **1 개** 를 export 하고, 국면 label 배열(`string[]`)을 반환한다 — 호출 1 회로 `describe` 1 개 + 국면 test **7 개**(happy 2 · error 2 · 분기 1 · negative 2) 를 등록.
- [ ] options 는 spec 고유분만 받는다 — `envMeta` · `measure(stepMs: number): Promise<BaselineReport> | BaselineReport` · `tempDir(name: string): string` (+ 선택 `title`). 판정 · 경로 · 로그 · seed 는 **전량 helper 위임** — `grep -n "CHECKIN_BASELINE_DIR\|baselines\"" test/perf/checkin-baseline-spec-suite.ts` 결과에 경로 문자열 리터럴 **0 줄**.
- [ ] **happy-path** — colocated spec 이 (a) 유효 options 로 factory 를 호출하면 등록 국면 label **7 개** 를 반환하고 등록된 test 들이 실제로 통과, (b) `title` 지정 시 그 문자열이 describe 제목에 포함, 각 1+.
- [ ] **error path** — (1) `options` 가 non-object(`undefined` · `null` · 문자열) → `TypeError`, (2) `measure` · `tempDir` 가 non-function → 각각 `TypeError`, 각 1+. 등록 시점 검사이므로 `describe` · `it` 은 **0 회** 호출됨을 함께 단언.
- [ ] **분기 cover** — 등록된 국면이 실행될 때 (a) 토글 off → `status === "skipped"` · `reason === "disabled"`, (b) 토글 on × baseline 부재 → `reason === "absent"` + 비교 함수 미호출, (c) 토글 on × 존재 → `status === "compared"` · `regressed === false` 3 국면이 각각 test 로 분리된다.
- [ ] **negative cases 충분 cover** — (a) `regressed === true` 여도 throw 0(exit code 불변), (b) 토글 off 국면에서 `baselineFileExists` spy 호출 **0 회**, (c) factory **호출만** 으로는 `measure` · `tempDir` 이 0 회 호출됨(등록 ≠ 실행), (d) 전 국면 통과 후에도 저장소 실경로 `test/perf/baselines` 목록이 불변(오염 0), (e) `envMeta.label` 이 빈 문자열인 국면에서 `RangeError` 가 래핑 없이 전파되고 baseline 디렉토리 미생성, 각 1+.
- [ ] 전역 토글(`CHECKIN_BASELINE_ENV_FLAG`)은 factory 가 등록하는 `beforeEach` / `afterEach` 안에서 저장·원복해 다른 describe 로 누출 **0** — colocated spec 이 suite 실행 후 `process.env` 원값 보존을 단언.
- [ ] 기존 measure→confirm perf-spec **5 개 전부 미변경** — `git diff --name-only origin/main` 결과가 신규 2 파일뿐.
- [ ] `pnpm lint`(`--max-warnings=0`) `&& pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%).
- [ ] `pnpm test:perf` 통과 + 실행 후 저장소 실경로 `test/perf/baselines` 가 **생성되지 않았음**(또는 기존 내용 불변) 확인.
- [ ] 총 diff ≤ 300 LOC · 신규 파일 2 개 유지 — JSDoc 은 위임 대상 helper 문서를 참조하는 짧은 문장으로 축약하고, 같은 형태의 인자 검증 test 는 `it.each` 로 묶는다.

## Out of Scope

- 기존 perf-spec(`summary` · `assessment`) 의 배선 describe 를 factory 호출로 교체 — 후속 slice(본 task 는 부품만 박제하고 소비자 편집 0).
- 잔여 measure→confirm perf-spec(`contribution` · `app-root` · `*-realdb` 계열) 에 배선 복제 — 후속 slice.
- assessment spec 의 `negative (d)` round-trip 국면(`measureAndConfirmBaseline` established→compared) 을 factory 에 넣는 것 — spec 고유 통합 국면이라 각 spec 에 남긴다.
- 체크인 baseline JSON 최초 생성·commit (ADR-0056 `§Follow-ups (a)`) — 실측 + 사람 눈 확인 전제.
- `.github/workflows/ci.yml` 편집 · 신규 job 추가 · `scripts/daily-test.sh` leg 추가(drift-guard smoke 3 종 동반 수정으로 파일 cap 파괴).
- `checkin-baseline-*.ts` helper 5 종의 시그니처 · 동작 수정(본 task 는 그 위에 얹는 국면 배선만 추가).
- 측정 로직 · tolerance 기본값 · endpoint 추가 등 perf harness 자체 변경.
- PLAN `140~142 행` 체크박스 · REQ-048 상태 변경(완료 선언 금지).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

- 후속 slice 후보 1 — `summary` · `assessment` 두 spec 의 배선 describe 를 본 factory 호출로 수렴(순삭 diff 예상).
- 후속 slice 후보 2 — `contribution` · `app-root` measure→confirm perf-spec 에 factory 호출 배선(spec 당 ~10 LOC 이라 묶음 가능).
- 후속 slice 후보 3 — `*-realdb` 계열 5 spec 배선. DB 부재 시 skip 게이트와 국면 등록의 상호작용을 먼저 확인할 것.
