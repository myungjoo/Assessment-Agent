---
id: T-1605
title: summary 실 DB 체크인 baseline JSON 전사 + 가드 표 4 행째 추가
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-047, REQ-048]
estimatedDiff: 120
estimatedFiles: 3
created: 2026-08-18
createdAt: 2026-08-18T18:40:00Z
independentStream: perf-checkin-baseline
dependsOn: [T-1603, T-1604]
touchesFiles:
  - test/perf/baselines/baseline-ci-realdb-summary-read.json
  - test/perf/checkin-baseline-file.spec.ts
  - test/perf/README.md
plannerNote: P5 perf — ADR-0056 §Follow-ups (a) 네 번째 route 체크인, T-1604 실측 줄 전사만 (T-1603 패턴 승계)
---

# T-1605 — summary 실 DB 체크인 baseline JSON 전사 + 가드 표 4 행째 추가

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Follow-ups (a)` 의 **"나머지 route 의
체크인 baseline"** 축은 현재 `ci-realdb-person-read`(T-1592 → T-1594) ·
`ci-realdb-assessment-read`(T-1601) · `ci-realdb-contribution-read`(T-1603) **3 건**에서 멈춰 있다.
직전 T-1604 가 네 번째 route `GET /api/summaries`(`personId` + `period` 2 차 필터 축) 에 실측 clock
관찰 국면을 열어 CI run `32156964647` 로그에 20 표본 실측 줄을 남겼으므로, `§Consequences (d)` 가
요구하는 **"사람이 값의 타당성을 확인한 뒤 commit"** 의 입력이 이미 확보됐다.

본 slice 는 그 줄을 **재계산 · 재반올림 · 임의 보정 0 · 전사만** 으로 baseline JSON 에 체크인하고
가드 표(`CHECKIN_BASELINES`) 에 4 행째를 더해, 네 번째 route 를 매 CI run 의 `compared` 국면으로
올린다. `§Decision 2`(갱신 주체는 pr-mode task 뿐) · `§Decision 3 (b)`(상대 회귀는 관찰만, exit code
불변) 는 그대로다.

전사 입력 (T-1604 머지 PR [#1284](https://github.com/myungjoo/Assessment-Agent/pull/1284) 의 CI run
`32156964647` 로그, journal 2026-08-18 `16:00` 항목에 박제):

```
label=ci-realdb-summary-read concurrency=1 p50=2.332 p95=2.521 p99=2.710 throughput=425.53 errorRate=0 count=20 pass=true
```

`dataScale` 은 실측 spec 이 seed 상수에서 유도한 `1 person / 5 summaries`
(`TOTAL_ROWS = WEEK_ROWS(3) + MONTH_ROWS(2)`, `test/perf/summary-measure-confirm-realdb.perf-spec.ts`
`56~58 행` · `328~338 행`) 이다.

## Required Reading

- `docs/decisions/ADR-0056-perf-baseline-checkin-ci.md` — `§Decision 2`(pr-mode 갱신 절차) ·
  `§Decision 3 (b)` · `§Consequences (a) (d)` · `§Follow-ups (a)`.
- `test/perf/baselines/baseline-ci-realdb-contribution-read.json` — 직전 slice 가 넣은 **정본
  직렬화 형태**(키 순서 · 단일 행 · 후행 개행 1 개) 참조 원본.
- `test/perf/checkin-baseline-file.spec.ts` — `CHECKIN_BASELINES` 표(`72~103 행` 부근, 현재 3 행) ·
  표 크기 하한 국면(`126 행` 부근, 현재 `toBeGreaterThanOrEqual(3)`) · 파일명 집합 일치 negative
  (c)(`152 행` 부근) · 표 순회 happy/분기/negative describe(`167 행` 이후).
- `test/perf/summary-measure-confirm-realdb.perf-spec.ts` `315~340 행` — 실측 label
  (`ci-realdb-summary-read`) · `REAL_CLOCK_ITER = 20` · `SEED_SUMMARIES = TOTAL_ROWS` 유도
  `dataScale` 표기(`1 person / ${SEED_SUMMARIES} summaries`).
- `test/perf/README.md` `1258 행`("3 건 한정으로 착수") · `1263 행`("세 건만") · `1288~1291 행`
  ("3 건뿐") — 체크인 건수 서술 3 곳.

## Acceptance Criteria

- [ ] `test/perf/baselines/baseline-ci-realdb-summary-read.json` 신설. 값은 위 실측 줄의 **전사만** —
      `p50=2.332` · `p95=2.521` · `p99=2.710` · `throughput=425.53` · `errorRate=0` · `count=20` ·
      `pass=true`, `env = { label: "ci-realdb-summary-read", concurrency: 1, dataScale:
      "1 person / 5 summaries" }`. 재계산 · 재반올림 · 임의 보정 **0**. JSON number 직렬화로
      `2.710` 이 `2.71` 로 적히는 것은 표기 정규화일 뿐 재반올림이 아니다(값 동일).
- [ ] 파일 원문이 `serializeBaselineReport(parseBaselineReport(body))` 와 **문자열 동일**(키 순서 ·
      단일 행 · 후행 개행 1 개). 기존 세 baseline JSON 과 같은 형태.
- [ ] `CHECKIN_BASELINES` 에 **4 행째** 추가 — `label: "ci-realdb-summary-read"` ·
      `sampleCount: 20` · `dataScalePattern: /^1 person \/ \d+ summaries$/` · `dataScaleOrigin` 은
      `summary-measure-confirm-realdb.perf-spec.ts` 의 `TOTAL_ROWS` 유도 표기를 지목. 기존 3 행 ·
      상수 · 국면 삭제 **0**(추가만).
- [ ] 표 크기 하한 국면의 `toBeGreaterThanOrEqual(3)` 을 **`4`** 로 올려 새 행이 조용히 빠지면
      fail 하게 한다(국면 제목 문구 `label 3 개 이상` → `4 개 이상` 도 함께 정정).
- [ ] **happy-path 1+** — 표 순회 happy 국면이 네 번째 label 에 대해서도 통과: 파일이 예외 0 으로
      복원되고 `count === 20` · `pass === true` · `errorRate === 0` · `p50`/`p95`/`p99`/`throughput`
      4 지표가 모두 유한하며 원문이 정본 직렬화 형태와 문자열 동일.
- [ ] **error path 1+** — 미체크인 label(`ci-realdb-does-not-exist`) 의 `readBaselineFile` ENOENT
      무래핑 전파 + `exists === false` 고정 국면이 그대로 통과(신규 label 이 그 축을 오염시키지
      않음 — 표의 어떤 행도 그 label 을 쓰지 않는다는 단언 포함).
- [ ] **분기 cover 2+** — 네 번째 label 에 대해 (1) 동일 수치 candidate 는 `regressed === false`,
      (2) `p95` 를 10 배로 키운 candidate 는 `p95.regressed === true` · `regressed === true` 이면서
      `p50` · `p99` 는 false. 두 분기 모두 throw 0 이고 wall-clock 실측 단언 **0**.
- [ ] **negative cases 충분 cover** — 기존 표 순회 negative 집합이 네 label 전부에 대해 성립:
      (a) 표본 0(`NaN`) candidate 비교 throw 0 + 회귀 표기, (b) `env.dataScale` 이 route 표기
      정규식과 일치하는 비어있지 않은 string, (c) 디렉토리 `.json` 집합 == 표 유도 파일명 집합
      (누락 · stale 양방향 fail, 신규 파일 포함해 **4 개**), (d) `count >= CHECKIN_SAMPLE_MIN`(20),
      (e) 단조성 `p50 <= p95 <= p99` 와 값 범위, (f) label 중복 0 + 표 크기 하한 4. 국면을 새로
      복제하지 말고 **표 1 행 추가로 자동 흡수**되게 한다(신규 test 파일 0 — T-1603 선례).
- [ ] `test/perf/README.md` 의 체크인 건수 서술만 정정 — `1258 행` "3 건 한정으로 착수" → 4 건,
      `1263 행` "세 건만" → 네 건, `1290 행` "3 건뿐" → 4 건(각각 T-1605 가 넣은
      `ci-realdb-summary-read` — slice 25 `GET /api/summaries` 의 T-1604 실측 20 표본 전사 —
      를 명시). **그 외 서술은 불변**(과잉 정정 금지 — T-1601 · T-1603 선례).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%).
      `src/` 변경 **0 LOC** 이라 coverage 수치 변동이 없어야 한다.
- [ ] diff 는 **3 파일 · 300 LOC 이내**. PR 본문에 ADR-0056 `§Decision 2` 절차대로 갱신 사유 +
      입력이 된 CI 실측 줄 원문을 박제하고, `env.label` 신규 추가라 이전 수치가 없어
      `absent` → `compared` 진입임을 명시한다.

## Out of Scope

- `summary-measure-confirm-realdb.perf-spec.ts` **본문 수정 금지** — 본 slice 는 그 spec 이 이미 낸
  실측 줄의 소비자일 뿐이다.
- 다섯 번째 route 의 실측 clock 관찰 국면 추가 — 다음 slice.
- `§Follow-ups (c)` tolerance · 임계값(`DEFAULT_P95_MAX_MS = 3000`) 재산정 — 축적 run 이
  `§Decision 5` 최소 20 run 미만이라 여전히 미충족.
- `§Follow-ups (b)` 본체 `.github/workflows/ci.yml` · `deploy/daily-test.sh` perf step 편입 —
  drift-guard smoke 3 종 동반으로 파일 cap 이 걸리는 별도 축(T-1122 BLOCKED 전례).
- 공유 helper(`checkin-baseline-*.ts` · `latency-*.ts` · `step-clock.ts`) · 다른 perf-spec ·
  ADR-0056 본문 · 부하계획 문서 수정 금지.
- `src/` · `prisma/` 프로덕션 코드 변경 0 LOC.
- wall-clock 대소 단언 · `comparison.regressed` 실측 값 단언 금지(공유 runner 비결정성 —
  `§Decision 3 (b)`).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
