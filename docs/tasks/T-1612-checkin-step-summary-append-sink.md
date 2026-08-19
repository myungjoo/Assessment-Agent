---
id: T-1612
title: 체크인 baseline step 요약 markdown 을 $GITHUB_STEP_SUMMARY 에 append 하는 sink 모듈 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048, REQ-047]
estimatedDiff: 270
estimatedFiles: 2
created: 2026-08-19
createdAt: 2026-08-19T07:41:00Z
independentStream: perf-checkin-baseline
dependsOn: [T-1611]
touchesFiles:
  - test/perf/checkin-baseline-step-summary-sink.ts
  - test/perf/checkin-baseline-step-summary-sink.spec.ts
plannerNote: P5 perf — ADR-0056 §Decision 3 (b) "step 요약" 축 배선 조각. 포매터 출력을 $GITHUB_STEP_SUMMARY 에 붙이는 주입식 sink 1 개(ci.yml 은 다음 slice).
---

# T-1612 — 체크인 baseline step 요약 append sink 모듈 신설

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Decision 3 (b)` 는 baseline 대비 상대
회귀를 **"로그와 step 요약으로 가시화만 하고 exit code 를 바꾸지 않는다"** 고 못 박았다. 이 중 **로그**
축은 `checkin-baseline-report.ts` 가, **요약 markdown 조립** 축은 T-1610(PR #1288) · T-1611(PR #1289)
가 `formatCheckinStepSummaryBlock` 으로 확정했다. 그러나 그 문자열을 **GitHub Actions job 요약으로
실제 내보내는 경로가 저장소에 한 줄도 없다** — 조립만 하고 아무도 쓰지 않으므로 관찰-only 정책의
유일한 신호인 가시성이 여전히 0 이다.

본 slice 는 그 배선의 **첫 조각 하나**만 잡는다 — 조립된 markdown 블록을 `$GITHUB_STEP_SUMMARY`
경로에 append 하는 **주입식 sink 함수 1 개**. 환경변수 record 와 append 함수를 전부 **주입**받아
전역 `process.env` · `fs` 를 직접 만지지 않으므로, `checkin-baseline-run.ts` 가 비교 함수를 주입받는
기존 패턴과 동형이고 spec 이 모든 국면을 결정론적으로 겨냥할 수 있다. 특히 **append 실패를 삼켜
`skipped` / `failed` 로만 보고**하는 계약이 핵심이다 — 요약 기록 실패가 CI 를 빨갛게 만들면
`§Decision 3 (b)` 의 exit code 불변 약속이 깨진다.

`ci.yml` 편입(`§Follow-ups (b)`) 과 `checkin-baseline-run.ts` 호출처 배선은 **다음 slice** 다. 본 task 는
`src/` 0 LOC · workflow 0 변경이며 [PLAN.md](../PLAN.md) `140 행` 은 `[ ]` 유지, REQ-048 상태 표기도
불변이다(관찰-only · 임계 fix 미완).

## Required Reading

- [test/perf/checkin-baseline-step-summary.ts](../../test/perf/checkin-baseline-step-summary.ts) — 본 sink 가 소비할 `formatCheckinStepSummaryBlock` 의 반환 계약(끝에 개행을 덧붙이지 않는다 — "이음은 호출측 책임").
- [test/perf/checkin-baseline-run.ts](../../test/perf/checkin-baseline-run.ts) — 주입식 배선 모듈의 선례(주입 함수 타입 선언 · 결과 union · 검증 시점 계약 · JSDoc 서술 밀도).
- [test/perf/checkin-baseline-run.spec.ts](../../test/perf/checkin-baseline-run.spec.ts) — 주입 함수 호출 횟수 · 인자 · 미호출 국면을 겨냥하는 spec 서술 패턴.
- [docs/decisions/ADR-0056-perf-baseline-checkin-ci.md](../decisions/ADR-0056-perf-baseline-checkin-ci.md) — `§Decision 3 (b)`(관찰-only · exit code 불변) · `§Follow-ups (b)`(`ci.yml` 편입은 별도 slice).

## Acceptance Criteria

- [ ] `test/perf/checkin-baseline-step-summary-sink.ts` 를 신설하고 append 진입점 **1 개**를 export 한다
      (예: `appendCheckinStepSummary(block, deps)`). `deps` 는 최소 ① 환경변수 record
      (`Record<string, string | undefined>`) ② append 함수(`(path: string, data: string) => void`) 를
      **주입**받는다. 모듈 안에서 `process.env` 를 읽거나 `fs` 를 import 하지 않는다(전역 접근 0).
- [ ] 대상 환경변수명 `GITHUB_STEP_SUMMARY` 는 **상수 1 곳**에만 적고 export 해, 다음 배선 slice 와
      spec 이 문자열을 다시 적지 않게 한다.
- [ ] 결과는 **판별 union** 으로 낸다 — 최소 (i) append 수행(`appended`, 대상 경로 포함) (ii) 환경변수
      부재 · 빈/공백-only 라 **append 함수를 호출하지 않음**(`skipped`, 사유 슬러그) (iii) append 함수가
      throw 해 삼킨 국면(`failed`, 사유 슬러그) 3 국면. 슬러그는 영어 기계 분류용 토큰.
- [ ] **exit code 불변(관찰-only)** — append 함수가 어떤 예외를 던져도 본 진입점은 **throw 하지 않고**
      `failed` 를 반환한다(ADR-0056 §Decision 3 (b)). 반대로 **인자 형태 위반**(프로그래머 오류) 은
      기존 형제 모듈과 동일하게 `TypeError` / `RangeError` 로 던진다 — 두 계약을 JSDoc `@throws` 에 명시.
- [ ] **본문 가공 0** — 넘겨받은 블록 문자열을 trim · 재정렬 · 이스케이프 · 재포맷하지 않는다. 다만
      GitHub 요약이 이어붙을 때 블록끼리 붙지 않도록 **끝 개행 1 개 보장**만 하고, 그 규칙을 JSDoc 에 명시.
- [ ] append 함수는 수행 국면에서 **정확히 1 회**, `(환경변수 값, 블록+개행)` 인자로 호출된다(재시도 · 중복
      호출 0). skip 국면에서는 **0 회**.
- [ ] **happy-path** test 1+ — 환경변수가 정상 경로일 때 `appended` 반환 · append 함수 1 회 호출 · 인자
      (경로 · 본문 문자열) 가 기대와 일치. `formatCheckinStepSummaryBlock` 실제 출력으로 조립한 국면 1+ 포함.
- [ ] **error path** test 1+ — append 함수가 throw(예: `EACCES` 계열 `Error`) 하면 **호출측으로 전파되지
      않고** `failed` 를 반환. 인자 형태 위반(블록 non-string · `deps` non-object · append 함수 non-function)
      에서 `TypeError` 가 나오는 국면도 각 1+.
- [ ] **분기 cover** — 결과 union 3 국면(`appended` / `skipped` / `failed`) 각 1+ test, 그리고 skip 사유
      분기(환경변수 키 부재 · 값이 빈 문자열 · 값이 공백-only) 각 1+ test.
- [ ] **negative cases 충분 cover** — 최소 다음 각 1+ test: (a) 블록이 빈/공백-only → `RangeError`,
      (b) `deps` 가 `null` / `undefined` → `TypeError`, (c) 환경변수 record 가 non-object → `TypeError`,
      (d) append 함수가 `Error` 아닌 값(문자열 · `undefined`) 을 throw 해도 삼키고 `failed`,
      (e) skip 국면에서 append 함수 호출 **0 회** 임을 spy 로 단언, (f) 블록 안에 개행 · 백틱 · 유니코드가
      섞여도 본문이 **한 글자도 바뀌지 않음**, (g) 같은 입력 2 회 호출이 같은 결과를 내고 인자(`deps` ·
      환경변수 record) 가 변형되지 않음(순수성 — append 호출 외 부작용 0).
- [ ] 신규 모듈의 stmt · branch · func · line coverage 100%, `pnpm test:cov` 통과
      (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] 변경 파일 **2 개** · diff ≤ 300 LOC 유지.

## Out of Scope

- `.github/workflows/ci.yml` 변경 0 — perf step 편입 · 요약 노출 · 토글 추가는 `§Follow-ups (b)` 의 별도 slice.
- `checkin-baseline-run.ts` · `checkin-baseline-adapter.ts` · `checkin-baseline-spec-wiring.ts` 등 기존 모듈
  변경 0. 본 sink 의 **호출처 신설 0**(주입 지점 배선은 다음 slice).
- 기본 주입값(`process.env` · `fs.appendFileSync`) 바인딩 0 — 전역 접근을 들이는 순간 결정론이 깨지므로
  기본값 제공은 배선 slice 에서 판단한다.
- `checkin-baseline-step-summary.ts`(포매터) 수정 0 — 출력 계약은 T-1611 로 확정됐다.
- `test/perf/baselines/*.json` 추가 · 갱신 0, `*-measure-confirm` / `*-read` perf-spec 변경 0.
- 상대 회귀의 fail 승격 · tolerance 재산정(§Decision 3 (b) 20 run 표본 조건 미충족) 0.
- `docs/PLAN.md` · `docs/requirements.md` · 부하계획 완료 표기 변경 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 발견 시 추가)
