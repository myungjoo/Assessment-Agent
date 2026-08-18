---
id: T-1598
title: perf README 임계값 3000ms 불변 bullet 의 measure→confirm slice 열거에 slice 29 를 편입
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 20
estimatedFiles: 1
created: 2026-08-18
independentStream: perf-doc-sync
dependsOn: [T-1557, T-1597]
touchesFiles: [test/perf/README.md]
plannerNote: P5 perf doc-sync — T-1597 Follow-up 첫 항목. 3000ms bullet 이 slice 29 를 빠뜨려 확정·비교 route 를 4 개로 과소 열거.
---

# T-1598 — perf README 임계값 3000ms 불변 bullet 의 measure→confirm slice 열거에 slice 29 를 편입

## Why

[test/perf/README.md](../../test/perf/README.md) 의 **임계값 3000ms 는 불변** bullet 은 `confirmOrCompareBaseline`
로 임시 디렉토리 1 회성 확정·비교를 수행하는 slice 를 "**slice 25·26·27·28 만**" 이라고 단언하는데,
T-1557 이 추가한 **slice 29**(`person-measure-confirm-realdb.perf-spec.ts`, `GET /api/persons`) 도
같은 `measureAndConfirmBaseline` harness 를 태우며 그 harness 는 내부에서
`confirmOrCompareBaseline` 를 그대로 호출한다([test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) `390 행`).
즉 본 bullet 만 확정·비교 route 를 **4 개로 과소 열거** 하고 있고, 같은 문서의 다른 서술
(`slice 25·26·27·28·29 는 규모 축이 아니라 3 불변`, `두·세·네·다섯 번째 route`)은 이미 5 개로 적혀 있어
**문서 내부가 서로 어긋난다**. drift 방향이 위험한 쪽 — 판독자가 "관찰 전용" 과 "확정·비교" 경계를
잘못 읽어 slice 29 를 slice 1~24 부류(관찰 전용)로 오인할 수 있다. 직전 fire 가 T-1597 Follow-up
최우선 후보로 명시 이월한 항목이다.

## Required Reading

- `test/perf/README.md` — `1276 행` ~ `1285 행` 의 **임계값 3000ms 는 불변** bullet (수정 대상). 대조용으로
  `1266 행` ~ `1272 행`(규모 축 서술) · `1252 행` ~ `1262 행`(잔여 4 축 bullet, T-1597 이 이미 현행화) 도 읽는다.
- `test/perf/README.md` `1215 행` ~ `1240 행` — slice 29 항목 (harness · route · 임시 디렉토리 1 회성 성격 확인).
- `test/perf/latency-collector.ts` `380 행` ~ `392 행` — `measureAndConfirmBaseline` 가
  `confirmOrCompareBaseline` 로 위임함을 확인 (열거 편입의 근거).
- `docs/tasks/T-1597-perf-readme-remaining-axes-sync.md` — 직전 slice 의 **과잉 정정 금지** 경계 승계.

## Acceptance Criteria

- [ ] `test/perf/README.md` 의 **임계값 3000ms 는 불변** bullet 에서 확정·비교 slice 열거가
      `slice 25·26·27·28` → `slice 25·26·27·28·29` 로, route 열거가
      `GET /api/summaries` · `GET /api/assessments` · `GET /api/contributions` · `GET /api` 에
      **`GET /api/persons` 를 더한 5 개** 로 갱신돼 있다.
- [ ] 같은 bullet 의 `slice 1~24 는 ... 관찰 전용` 서술은 **불변** 으로 남는다 (slice 29 는 25~28 과
      같은 부류라 관찰 전용 경계 자체는 이동하지 않는다).
- [ ] 같은 bullet 의 나머지 3 단언이 **불변** 임을 확인한다 — ① `DEFAULT_P95_MAX_MS = 3000`(REQ-048) 미변경,
      ② 저장소 체크인 기준 baseline 은 `ci-realdb-person-read` **1 건뿐** 이며 그 비교는 T-1584 로 기존
      `perf test` step 에서 매 run 수행, ③ 나머지 route 의 체크인 baseline · 임계 fix · 나머지 cutover 는
      별도 slice. **과잉 정정 금지** — 이 3 단언을 손대면 AC 실패.
- [ ] 문서 내부 정합 확인 — `1270 행` 부근의 `slice 25·26·27·28·29 는 규모 축이 아니라 3 불변` 및
      `1256 행` 부근의 `두·세·네·다섯 번째 route` 서술과 본 bullet 의 slice 집합이 **동일한 5 개** 로 일치한다.
- [ ] perf-spec 계수(총계 **63** · `*realdb*` **29** · `*read*` **51** · `*read*realdb*` **21**) ·
      인벤토리 (A) **30** / (B) **0** / (C) **0** · 도메인 **15** · 조회 route **31** 서술은 **한 글자도 변경하지 않는다**.
- [ ] **R-112 (코드 변경 0 doc task 의 대체 검증)** — 본 task 는 `test/perf/README.md` 1 개 문서만 수정하며
      production code · perf-spec · harness 변경 **0 LOC**, 신규/수정 public symbol **0** 이라 happy-path ·
      error path · 분기 · negative test 의 신규 작성 대상이 존재하지 않는다. 대체 검증으로 다음 2 가지를 수행한다:
      (a) 갱신 서술이 가리키는 사실을 `test/perf/person-measure-confirm-realdb.perf-spec.ts` 의
      established/compared 두 국면 단언 및 `test/perf/latency-collector.spec.ts` 의
      `measureAndConfirmBaseline` describe 블록(happy · error · 분기 · negative)과 **항목별로 대조**,
      (b) `pnpm lint && pnpm build && pnpm test` 를 실행해 회귀 0 확인. tester 는 이 사실과 대체 검증
      결과를 TESTER trail 에 명시한다.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — `src/` 무변경이라 직전 수치 유지가 기대값.
- [ ] 변경 파일 **1 개** (`test/perf/README.md`), diff ≤ 300 LOC.

## Out of Scope

- `ci.yml` 주석의 '연속 run 을 cancel 하지 않는다' 문장에 pending-run 예외를 명시하는 doc-sync (차순위 후보 — 별도 slice).
- ADR-0056 `§Follow-ups (c)` 임계 승격 — 동일 `env.label` 20 run 축적 부족으로 **착수 불가**.
- `*-realdb` / `*-read` 계열 perf-spec 의 factory 배선 확산.
- 새 perf-spec 추가 · 기존 spec 수정 · harness 수정 · `DEFAULT_P95_MAX_MS` 변경.
- 나머지 route 의 체크인 baseline 추가, 부하 harness(S1/S3) 별도 job 신설.
- `daily-test.sh` leg · drift-guard smoke spec 접촉 (T-1122 파일 cap 전례 회피).
- 계수 · 인벤토리 · 잔여 4 축 bullet 재서술 (T-1597 이 이미 현행화 — 재정정 금지).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
