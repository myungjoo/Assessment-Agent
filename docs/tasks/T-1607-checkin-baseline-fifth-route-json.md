---
id: T-1607
title: app-root 실 DB 체크인 baseline JSON 전사 + 가드 표 5 행째 추가
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-047, REQ-048]
estimatedDiff: 120
estimatedFiles: 3
created: 2026-08-18
createdAt: 2026-08-18T22:41:48Z
independentStream: perf-checkin-baseline
dependsOn: [T-1605, T-1606]
touchesFiles:
  - test/perf/baselines/baseline-ci-realdb-app-root-read.json
  - test/perf/checkin-baseline-file.spec.ts
  - test/perf/README.md
plannerNote: P5 perf — ADR-0056 §Follow-ups (a) 다섯 번째 route 체크인, T-1606 실측 줄 전사만 (T-1605 패턴 승계)
---

# T-1607 — app-root 실 DB 체크인 baseline JSON 전사 + 가드 표 5 행째 추가

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Follow-ups (a)` 의 **"나머지 route 의
체크인 baseline"** 축은 현재 `ci-realdb-person-read`(T-1592 → T-1594) ·
`ci-realdb-assessment-read`(T-1601) · `ci-realdb-contribution-read`(T-1603) ·
`ci-realdb-summary-read`(T-1605) **4 건**에서 멈춰 있다. 직전 T-1606 이 **마지막 남은
`measure→confirm` route** 인 `GET /api`(DB 미접촉 floor) 에 실측 clock 관찰 국면을 열어 PR
[#1286](https://github.com/myungjoo/Assessment-Agent/pull/1286) CI run `32189302680` 로그에 20 표본
실측 줄을 남겼으므로, `§Consequences (d)` 가 요구하는 **"사람이 값의 타당성을 확인한 뒤 commit"**
의 입력이 이미 확보됐다.

본 slice 는 그 줄을 **재계산 · 재반올림 · 임의 보정 0 · 전사만** 으로 baseline JSON 에 체크인하고
가드 표(`CHECKIN_BASELINES`) 에 5 행째를 더해, 다섯 번째 route 를 매 CI run 의 `compared` 국면으로
올린다. 이 route 는 요청 경로가 DB 를 전혀 타지 않아 **framework + HTTP 왕복만의 floor** 이고,
앞선 네 route 의 체크인 수치에서 인프라 하한을 빼서 읽는 기준선이 된다.
`§Decision 2`(갱신 주체는 pr-mode task 뿐) · `§Decision 3 (b)`(상대 회귀는 관찰만, exit code 불변)
는 그대로다.

전사 입력 (T-1606 PR [#1286](https://github.com/myungjoo/Assessment-Agent/pull/1286) 의 CI run
`32189302680` 로그 `[perf][checkin-baseline] candidate` 줄):

```
label=ci-realdb-app-root-read concurrency=1 p50=0.8067320000000109 p95=0.8638406000001851 p99=0.8795209199999954 throughput=1250 errorRate=0 count=20 pass=true
```

`dataScale` 은 실측 spec 이 상수에서 조립한 `0 rows / no db access`
(`DB_ROWS_TOUCHED = 0`, `test/perf/app-root-measure-confirm-realdb.perf-spec.ts` `319 행` ·
`326 행`) 이다.

**전사 정밀도 주의** — 위 candidate 줄은 `formatCheckinCandidateLine` 의 무가공 전사라 소수 16 자리
raw float 이다. 기존 네 baseline 파일이 시각적으로 소수 1~3 자리인 것에 맞추려고 **반올림하지
않는다** — 그것이 곧 `§Decision 2` 가 금지한 재반올림이다. 받은 값을 그대로 JSON number 로 적는다.

## Required Reading

- `docs/decisions/ADR-0056-perf-baseline-checkin-ci.md` — `§Decision 2`(pr-mode 갱신 절차) ·
  `§Decision 3 (b)` · `§Consequences (a) (d)` · `§Follow-ups (a)`.
- `test/perf/baselines/baseline-ci-realdb-summary-read.json` — 직전 slice 가 넣은 **정본 직렬화
  형태**(키 순서 · 단일 행 · 후행 개행 1 개) 참조 원본.
- `test/perf/checkin-baseline-file.spec.ts` — `CHECKIN_BASELINES` 표(`71~110 행` 부근, 현재 4 행) ·
  표 크기 하한 국면(`131~136 행` 부근, 현재 `toBeGreaterThanOrEqual(4)` + 제목 `label 4 개 이상`) ·
  파일명 집합 일치 negative (c)(`158 행` 부근) · 표 순회 happy/분기/negative describe.
- `test/perf/app-root-measure-confirm-realdb.perf-spec.ts` `304~330 행` — 실측 label
  (`ci-realdb-app-root-read`) · `REAL_CLOCK_ITER = 20` · `DB_ROWS_TOUCHED` 유도 `dataScale` 표기.
- `test/perf/README.md` `1258 행`("4 건 한정으로 착수") · `1265 행`("네 건만") · `1292 행`
  ("4 건뿐") — 체크인 건수 · label 열거 서술 3 곳.

## Acceptance Criteria

- [ ] `test/perf/baselines/baseline-ci-realdb-app-root-read.json` 신설. 값은 위 실측 줄의
      **전사만** — `p50=0.8067320000000109` · `p95=0.8638406000001851` · `p99=0.8795209199999954` ·
      `throughput=1250` · `errorRate=0` · `count=20` · `pass=true`, `env = { label:
      "ci-realdb-app-root-read", concurrency: 1, dataScale: "0 rows / no db access" }`.
      재계산 · 재반올림 · 임의 보정 **0**(형제 파일의 소수 자리수에 맞추는 반올림도 금지).
- [ ] 파일 원문이 `serializeBaselineReport(parseBaselineReport(body))` 와 **문자열 동일**(키 순서 ·
      단일 행 · 후행 개행 1 개). 기존 네 baseline JSON 과 같은 형태.
- [ ] `CHECKIN_BASELINES` 에 **5 행째** 추가 — `label: "ci-realdb-app-root-read"` ·
      `sampleCount: 20` · `dataScalePattern: /^\d+ rows \/ no db access$/` · `dataScaleOrigin` 은
      `app-root-measure-confirm-realdb.perf-spec.ts` 의 `DB_ROWS_TOUCHED` 유도 표기를 지목하고,
      주석 1~2 줄로 **DB 미접촉 floor route** 라 `dataScale` 형태가 앞 네 행과 다르다는 사실을
      남긴다. 기존 4 행 · 상수 · 국면 삭제 **0**(추가만).
- [ ] 표 크기 하한 국면의 `toBeGreaterThanOrEqual(4)` 를 **`5`** 로 올려 새 행이 조용히 빠지면
      fail 하게 한다(국면 제목 문구 `label 4 개 이상` → `5 개 이상` 도 함께 정정).
- [ ] **happy-path 1+** — 표 순회 happy 국면이 다섯 번째 label 에 대해서도 통과: 파일이 예외 0 으로
      복원되고 `count === 20` · `pass === true` · `errorRate === 0` · `p50`/`p95`/`p99`/`throughput`
      4 지표가 모두 유한하며 원문이 정본 직렬화 형태와 문자열 동일.
- [ ] **error path 1+** — 미체크인 label(`ci-realdb-does-not-exist`) 의 `readBaselineFile` ENOENT
      무래핑 전파 + `exists === false` 고정 국면이 그대로 통과(신규 label 이 그 축을 오염시키지
      않음 — 표의 어떤 행도 그 label 을 쓰지 않는다는 단언 포함).
- [ ] **분기 cover 2+** — 다섯 번째 label 에 대해 (1) 동일 수치 candidate 는 `regressed === false`,
      (2) `p95` 를 10 배로 키운 candidate 는 `p95.regressed === true` · `regressed === true` 이면서
      `p50` · `p99` 는 false. 두 분기 모두 throw 0 이고 wall-clock 실측 단언 **0**.
- [ ] **negative cases 충분 cover** — 기존 표 순회 negative 집합이 다섯 label 전부에 대해 성립:
      (a) 표본 0(`NaN`) candidate 비교 throw 0 + 회귀 표기, (b) `env.dataScale` 이 행별 정규식과
      일치하는 비어있지 않은 string, (c) 디렉토리 `.json` 집합 == 표 유도 파일명 집합(누락 ·
      stale 양방향 fail, 신규 파일 포함해 **5 개**), (d) `count >= CHECKIN_SAMPLE_MIN`(20),
      (e) 단조성 `p50 <= p95 <= p99` 와 값 범위, (f) label 중복 0 + 표 크기 하한 5. 국면을 새로
      복제하지 말고 **표 1 행 추가로 자동 흡수**되게 한다(신규 test 파일 0 — T-1603 · T-1605 선례).
- [ ] `test/perf/README.md` 의 체크인 건수 · label 열거만 정정 — `1258 행` "4 건 한정으로 착수" →
      5 건, `1265 행` "네 건만" → 다섯 건, `1292 행` "4 건뿐" → 5 건. 각 열거에 T-1607 이 넣은
      `ci-realdb-app-root-read`(slice 28 `GET /api` 의 T-1606 실측 20 표본 전사) 를 한 항목으로
      더한다. **그 외 서술은 불변**(과잉 정정 금지 — T-1601 · T-1603 · T-1605 선례).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%).
      `src/` 변경 **0 LOC** 이라 coverage 수치 변동이 없어야 한다.
- [ ] diff 는 **3 파일 · 300 LOC 이내**. PR 본문에 ADR-0056 `§Decision 2` 절차대로 갱신 사유 +
      입력이 된 CI 실측 줄 원문을 박제하고, `env.label` 신규 추가라 이전 수치가 없어
      `absent` → `compared` 진입임을 명시한다.

## Out of Scope

- `app-root-measure-confirm-realdb.perf-spec.ts` **본문 수정 금지** — 본 slice 는 그 spec 이 이미 낸
  실측 줄의 소비자일 뿐이다.
- 실측 값 재측정 · 다른 run 의 줄로 교체 — 전사 입력은 위 `32189302680` 줄로 고정한다.
- `§Follow-ups (c)` tolerance · 임계값(`DEFAULT_P95_MAX_MS = 3000`) 재산정 — 축적 run 이
  `§Decision 5` 최소 20 run 미만이라 여전히 미충족.
- `§Follow-ups (b)` 본체 `.github/workflows/ci.yml` · `deploy/daily-test.sh` perf step 편입 —
  drift-guard smoke 3 종(T-0791 · T-0944 · T-0947) 동반으로 5 파일 cap 이 걸리는 별도 축
  (T-1122 BLOCKED 전례).
- 공유 helper(`checkin-baseline-*.ts` · `latency-*.ts` · `step-clock.ts`) · 다른 perf-spec ·
  ADR-0056 본문 · 부하계획 문서 수정 금지.
- `src/` · `prisma/` 프로덕션 코드 변경 0 LOC.
- wall-clock 대소 단언 · `comparison.regressed` 실측 값 단언 금지(공유 runner 비결정성 —
  `§Decision 3 (b)`).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
