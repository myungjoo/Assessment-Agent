---
id: T-1572
title: summary perf-spec 에 토글 on × 저장소 실경로 기본 바인딩 체크인 확인 국면 추가
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 110
estimatedFiles: 1
created: 2026-08-12
independentStream: perf-baseline-checkin
dependsOn: [T-1564, T-1568, T-1569]
touchesFiles:
  - test/perf/summary-measure-confirm.perf-spec.ts
plannerNote: "P5 성능 검증 — ADR-0056 Follow-up (b) ci.yml 편입 전 마지막 미검증 seam(토글 on × 저장소 실경로) pilot 1 spec"
---

# T-1572 — summary perf-spec 에 토글 on × 저장소 실경로 기본 바인딩 체크인 확인 국면 추가

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Follow-ups (b)` 의 다음 단계는
`ci.yml` 의 `perf test` step 에서 토글 `PERF_CHECKIN_BASELINE` 을 켜 체크인 baseline 비교
결과를 로그로 가시화하는 것이다. 그런데 **CI 가 실제로 타게 될 조합 — 토글 on × `repoRoot`
기본값(저장소 실경로 `test/perf/baselines`) — 을 검증하는 국면이 현재 저장소에 0 개**다.
공유 factory([checkin-baseline-spec-suite.ts](../../test/perf/checkin-baseline-spec-suite.ts))
의 토글 on 국면 3 개는 전부 임시 `repoRoot` 를 주입하고, 저장소 실경로를 쓰는 국면 2 개는
전부 토글 off 다. 즉 `runCheckinBaselineCheckWithDefaults` 가 토글 on 일 때 실경로에
`baselineFileExists` 를 위임하는 분기는 어떤 run 에서도 실행되지 않는다. 본 slice 는
pilot 1 spec(`summary`, 배선 chain 의 첫 소비자)에 그 조합의 국면을 **추가만** 해서 (b) 편입
전에 seam 을 닫는다. write 경로가 애초에 없는 판정(`CheckinBaselinePlan` 에 `write` 없음)이라
저장소 오염 0 · exit code 불변이다.

## Required Reading

- [test/perf/summary-measure-confirm.perf-spec.ts](../../test/perf/summary-measure-confirm.perf-spec.ts) — 변경 대상. 특히 파일 끝 `describe("체크인 baseline 확인 배선 — spec 고유 통합 국면 …")` 블록(현재 `negative (c)` · `negative (d)` 2 국면)과 그 안의 `measureCandidate()` · `enabledEnv` · `baselineDir()` 지역 헬퍼 — 본 task 는 이 describe 에 국면을 **append** 한다
- [test/perf/checkin-baseline-adapter.ts](../../test/perf/checkin-baseline-adapter.ts) — `runCheckinBaselineCheckWithDefaults` 기본값 결선(`processEnv ?? process.env`, `repoRoot ?? defaultCheckinRepoRoot()`), 토글 off 시 `fs` 조회 생략 / on 시 `baselineFileExists` 위임 계약
- [test/perf/checkin-baseline-spec-wiring.ts](../../test/perf/checkin-baseline-spec-wiring.ts) — `checkCheckinBaselineForSpec` 계약(어댑터 1 회 위임 + `outcome.log` 1 회 출력 + 가공 없는 반환), `seedCheckinBaselineFixture` 의 실경로 가드
- [test/perf/checkin-baseline-plan.ts](../../test/perf/checkin-baseline-plan.ts) — `CHECKIN_BASELINE_ENV_FLAG` 상수, 토글 truthy 해석, `CheckinBaselinePlan` 에 write/establish 가 없는 이유
- [test/perf/checkin-baseline-spec-suite.ts](../../test/perf/checkin-baseline-spec-suite.ts) — factory 가 이미 등록하는 국면 7 개(중복 작성 금지 대상 확인용). 특히 `happy (a)`(토글 off × 실경로) 와 `negative (b)`(토글 off → `baselineFileExists` 0 회)
- [docs/decisions/ADR-0056-perf-baseline-checkin-ci.md](../decisions/ADR-0056-perf-baseline-checkin-ci.md) — `§Decision 2`(갱신은 pr-mode task 만 — CI 가 baseline 을 쓰지 않는다) · `§Decision 3 (b)`(관찰 전용 · exit code 불변) · `§Follow-ups (b)`

## Acceptance Criteria

- [ ] `test/perf/summary-measure-confirm.perf-spec.ts` 의 **기존 `spec 고유 통합 국면` describe 안에만** 국면을 추가한다(다른 describe · 다른 파일 · helper 본체 변경 0). 추가 국면은 전부 `repoRoot` · `processEnv` 를 **생략**해 기본 바인딩(전역 `process.env` × `defaultCheckinRepoRoot()`)을 타야 하며, 토글은 `process.env[CHECKIN_BASELINE_ENV_FLAG]` 를 국면 안에서 세팅하고 **원래 값으로 원복**한다(`try/finally` 또는 이 국면 전용 `beforeEach`/`afterEach`).
- [ ] **happy-path**: 토글 on(`"1"`) × 기본 바인딩 × 실측 candidate 호출이 throw 없이 `CheckinBaselineRunOutcome` 을 반환하고, `log` 가 `CHECKIN_LOG_PREFIX` 로 시작한다. 기대 `status` 는 하드코딩하지 말고 `fs.existsSync(resolveCheckinBaselinePath(env, defaultCheckinRepoRoot()))` 로 **실행 시점에 계산**한다 — 부재면 `{ status: "skipped", reason: "absent" }` 이고 `log` 에 그 해석된 경로 문자열이 포함, 존재하면 `{ status: "compared" }`(ADR-0056 `§Follow-ups (a)` 로 baseline 이 체크인된 뒤에도 국면이 깨지지 않게 하기 위함).
- [ ] **error path**: 토글 on × 기본 바인딩 상태에서 `envMeta.label` 이 빈 문자열인 `envMeta` 로 호출하면 `RangeError` 가 나고, 저장소 실경로 디렉토리 목록 스냅샷이 **호출 전후 동일**하다(파일·디렉토리 생성 0).
- [ ] **분기 cover**: 같은 기본 바인딩 호출을 토글 off(플래그 삭제) 로 한 번 더 태워 `{ status: "skipped", reason: "disabled" }` 가 되는 대비 국면을 두고, `jest.spyOn(baselineIo, "baselineFileExists")` 로 **토글 on 은 1 회 · off 는 0 회** 위임됨을 단언한다(어댑터의 유일한 존재-조회 경계).
- [ ] **negative cases 충분 cover** — 각 1+ test: (1) 위 국면들을 모두 실행한 뒤 `resolveCheckinBaselineDir(defaultCheckinRepoRoot())` 아래 목록이 실행 전 스냅샷과 동일(write 0), (2) 토글 on 국면에서도 예외가 전파되지 않아 `expect` 밖 throw 0 — 회귀 판정이든 `absent` 든 반환만 한다(exit code 불변), (3) 국면 종료 후 `process.env[CHECKIN_BASELINE_ENV_FLAG]` 가 국면 진입 전 값과 정확히 같다(전역 누출 0 — 미설정이었으면 `undefined`).
- [ ] factory 가 이미 등록한 국면 7 개(토글 off × 실경로 · 토글 on × 임시경로 · 회귀 no-throw · 등록 시점 `TypeError` 등)와 **중복되는 국면을 작성하지 않는다**. 어떤 조합이 본 slice 의 고유분인지 한국어 주석 1~3 줄로 명시한다.
- [ ] 실행 후 저장소 실경로 오염 0 확인: `pnpm test:perf` 실행 뒤 `git status --porcelain test/perf/baselines` 출력이 비어 있고 해당 디렉토리가 생성되지 않는다.
- [ ] `pnpm lint --max-warnings=0` · `pnpm build` · `pnpm test` 통과 (미사용 import 0).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm test:perf` 전체 통과, 대상 perf-spec 파일 수 불변(28), 이 spec 의 **기존 국면은 1 개도 삭제·수정되지 않음**(순수 추가 diff).

## Out of Scope

- `test/perf/checkin-baseline-*.ts` helper · factory 본체와 그 colocated spec 수정 — 본 국면의 factory 승격(4 spec 공유)은 pilot 검증 후 별도 slice. 지금 factory 를 고치면 국면 수 표기(`국면 7 개`)가 4 개 소비자 spec 주석과 colocated spec 에 동시 반영돼 파일 cap 을 깬다.
- 나머지 measure→confirm spec(`assessment` · `contribution` · `app-root`) 및 `*-realdb` · `*-read` 계열 배선 — 확산은 후속 slice.
- `.github/workflows/ci.yml` 편집(ADR-0056 `§Follow-ups (b)` 본체 — 본 task 는 그 **선행 seam 검증**까지만).
- ADR-0056 `§Follow-ups (a)` 실 baseline JSON 생성·commit(실측 + 사람 눈 확인 전제) 및 `§Follow-ups (c)` 부하계획 임계 fix 갱신.
- `docs/PLAN.md` · REQ-048 상태 갱신(완료 선언 0 유지), `src/` production 코드 변경, 임계값 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
