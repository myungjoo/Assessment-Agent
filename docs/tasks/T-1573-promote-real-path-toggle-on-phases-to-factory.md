---
id: T-1573
title: 체크인 baseline 배선 factory 에 토글 on × 저장소 실경로 기본 바인딩 국면 승격
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 140
estimatedFiles: 2
created: 2026-08-12
createdAt: 2026-08-12T01:20:00Z
independentStream: perf-baseline-checkin
dependsOn: [T-1568, T-1572]
touchesFiles:
  - test/perf/checkin-baseline-spec-suite.ts
  - test/perf/checkin-baseline-spec-suite.spec.ts
plannerNote: "P5 성능 검증 — T-1572 pilot(토글 on × 실경로) 을 공유 factory 로 승격해 소비자 4 spec 전부에 seam 적용"
---

# T-1573 — 체크인 baseline 배선 factory 에 토글 on × 저장소 실경로 기본 바인딩 국면 승격

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Follow-ups (b)` 의 `ci.yml` 편입
직전 마지막 미검증 seam — **토글 on × `repoRoot` 기본값(저장소 실경로 `test/perf/baselines`)** —
은 T-1572 가 `summary` 1 spec 의 고유 국면으로만 닫았다. 공유 factory
([checkin-baseline-spec-suite.ts](../../test/perf/checkin-baseline-spec-suite.ts)) 의 국면 7 개는
여전히 **토글 on 이면 전부 임시 `repoRoot` 주입 · 실경로를 쓰면 전부 토글 off** 라, factory 를
쓰는 나머지 소비자 3 spec(`assessment` · `contribution` · `app-root`) 에서는 그 분기가 한 번도
실행되지 않는다. 본 slice 는 pilot 에서 검증된 국면을 factory 로 **승격(추가)** 해 소비자 4 spec
전부가 같은 seam 을 타게 한다. 판정 · 경로 · 로그는 전량 어댑터 위임(재구현 0)이고 write 경로가
애초에 없어(`CheckinBaselinePlan` 에 `write` 없음) 저장소 오염 0 · exit code 불변이다.

## Required Reading

- [test/perf/checkin-baseline-spec-suite.ts](../../test/perf/checkin-baseline-spec-suite.ts) — 변경 대상 1. 특히 `phases` 객체(현재 국면 7 개)와 지역 헬퍼 `call()` · `realDir()` · `snap()`, 그리고 `beforeEach` / `afterEach` 가 전역 토글(`CHECKIN_BASELINE_ENV_FLAG`)을 저장 · 원복하는 구조
- [test/perf/checkin-baseline-spec-suite.spec.ts](../../test/perf/checkin-baseline-spec-suite.spec.ts) — 변경 대상 2. `capture()` / `runPhase(index)` 헬퍼와 label 개수 · 종류 단언(`toHaveLength(7)`, `"2,2,1,2"`), 인덱스 기반 국면 실행 단언(`[0, 6]` 등)
- [test/perf/summary-measure-confirm.perf-spec.ts](../../test/perf/summary-measure-confirm.perf-spec.ts) — 승격 원본. 파일 끝 `describe("체크인 baseline 확인 배선 — spec 고유 통합 국면 …")` 안의 T-1572 국면 `happy (e)` · `error (f)` · `분기 (g)` · `negative (h)` · `negative (i)` 와 지역 헬퍼 `withGlobalFlag` · `realCheckinDir` · `realDirSnapshot`
- [test/perf/checkin-baseline-spec-wiring.ts](../../test/perf/checkin-baseline-spec-wiring.ts) — `checkCheckinBaselineForSpec` 의 입력 계약(`repoRoot` · `processEnv` 생략 시 기본 바인딩)
- [docs/decisions/ADR-0056-perf-baseline-checkin-ci.md](../decisions/ADR-0056-perf-baseline-checkin-ci.md) — `§Decision 2`(write 경로 없음) · `§Decision 3 (b)`(exit code 불변) · `§Follow-ups (b)`

## Acceptance Criteria

- [ ] `checkin-baseline-spec-suite.ts` 의 `phases` 에 **토글 on × 기본 바인딩(저장소 실경로)** 국면 **3 개**를 기존 국면 **뒤에 append** 한다(기존 7 개의 label · 본문 · 등록 순서 변경 0 — 인덱스 0~6 이 그대로여야 colocated spec 의 인덱스 단언이 보존된다).
  - happy: 토글 on × `repoRoot: undefined` → throw 0 + `CHECKIN_LOG_PREFIX` 로그. 기대 `status` 는 **실행 시점 `fs.existsSync`** 로 계산(존재 → `compared`, 부재 → `skipped`/`absent`) — 하드코딩 금지(ADR-0056 `§Follow-ups (a)` 로 실 baseline 이 체크인된 뒤에도 성립해야 한다).
  - 분기: `baselineFileExists` 위임 경계 — 토글 on 은 **1 회**(인자가 저장소 실경로 디렉토리) · off 는 **0 회**.
  - negative: 토글 on/off 연속 호출이 전부 throw 0 으로 반환만 하고 **실경로 write 0**(`snap()` 결과 · 디렉토리 존재 여부 불변).
- [ ] 새 국면은 전역 토글을 `process.env[FLAG]` 로 세팅하되 원복은 기존 `afterEach` hook 에 맡긴다(별도 원복 로직 추가 0 — 누출 0 은 colocated spec 의 토글 보존 국면이 검증).
- [ ] error path 단언 1+ — 새 국면 계열에서 `envMeta.label` 빈 값 등 무효 입력이 기본 바인딩 경로에서도 `RangeError` 를 **전파**하고 실경로 목록이 불변임을 확인한다(factory 안 국면 또는 colocated spec 의 `runPhase(index, over)` 중 한 곳에서 1+, 중복 작성 금지).
- [ ] `checkin-baseline-spec-suite.spec.ts` 의 label 단언을 갱신 — `toHaveLength(7)` → 새 개수, 종류 문자열 `"2,2,1,2"` → 새 조합. 재호출 동일 구성(`capture(opts()).labels`) 단언은 유지.
- [ ] colocated spec 에 새 국면을 `runPhase(index)` 로 직접 실행하는 단언 추가 — happy(실행 시점 존재 여부로 기대 계산) · 분기(`jest.spyOn(baselineIo, "baselineFileExists")` 호출 횟수 on 1 / off 0) · negative(실경로 목록 불변) **각 1+**.
- [ ] 기존 colocated spec 국면 전부 보존 — 특히 "전 국면 통과 후에도 저장소 실경로 baselines 목록이 불변(오염 0)" 이 새 국면까지 순회하면서 통과.
- [ ] `pnpm lint --max-warnings=0` · `pnpm build` 통과.
- [ ] `pnpm test` 통과 + `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%).
- [ ] `npx jest -c test/perf/jest-perf.json --testPathPattern "checkin-baseline-spec-suite|measure-confirm\\.perf-spec"` 로 factory colocated spec + 소비자 4 spec(`summary` · `assessment` · `contribution` · `app-root`) 전량 pass(`*-realdb` 계열은 Postgres 부재로 제외).
- [ ] 실행 후 저장소 실경로 `test/perf/baselines` 가 **생성되지 않았음**을 확인(`ls test/perf/baselines` → 미존재 또는 실행 전과 동일 목록).

## Out of Scope

- `summary-measure-confirm.perf-spec.ts` 의 T-1572 고유 국면 5 개 **삭제 · 축약**(factory 승격 후 중복이 되지만, 소비자 spec 정리는 별도 slice — 본 slice 는 factory 쪽 **추가만**).
- 소비자 spec 4 개의 주석 parity 갱신(`registerCheckinBaselineWiringSuite` 국면 개수 표기 등) — 별도 doc-sync slice.
- `.github/workflows/ci.yml` 편집 · `perf test` step 토글 on 편입(ADR-0056 `§Follow-ups (b)` 본체).
- `test/perf/baselines/*.json` 최초 생성 · commit(`§Follow-ups (a)`).
- `*-realdb` · `*-read` 계열 perf-spec 의 factory 배선.
- `PLAN.md` · REQ-048 상태 갱신 등 완료 선언(`§Follow-ups (d)`).
- 판정 · 경로 · 로그 helper(`checkin-baseline-*.ts`) 의 동작 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
