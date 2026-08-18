---
id: T-1603
title: contribution 실 DB 체크인 baseline JSON 전사 + 가드 표 3 행째 추가
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-047, REQ-048]
estimatedDiff: 120
estimatedFiles: 3
created: 2026-08-18
completedAt: 2026-08-18T14:55:45Z
prNumber: 1283
independentStream: perf-checkin-baseline
dependsOn: [T-1601, T-1602]
touchesFiles:
  - test/perf/baselines/baseline-ci-realdb-contribution-read.json
  - test/perf/checkin-baseline-file.spec.ts
  - test/perf/README.md
plannerNote: P5 perf — ADR-0056 §Follow-ups (a) 세 번째 route 체크인, T-1602 실측 줄 전사만 (T-1601 패턴 승계)
---

# T-1603 — contribution 실 DB 체크인 baseline JSON 전사 + 가드 표 3 행째 추가

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Follow-ups (a)` 의 "나머지 route 의 체크인 baseline" 축은 현재 `ci-realdb-person-read`(T-1592 → T-1594 전사) · `ci-realdb-assessment-read`(T-1601) **2 건**에서 멈춰 있다. 직전 T-1602 가 `GET /api/contributions`(`Person → Assessment → Contribution` 3-level FK chain) 에 실측 clock 관찰 국면을 열어 CI 로그에 20 표본 실측 줄을 남겼으므로, `§Consequences (d)` 가 요구하는 "사람이 값 타당성 확인 후 commit" 의 입력이 이미 확보됐다. 본 slice 는 그 줄을 **재계산 · 재반올림 0 · 전사만** 으로 baseline JSON 에 체크인하고 가드 표(`CHECKIN_BASELINES`) 에 3 행째를 더해, 세 번째 route 를 매 CI run 의 `compared` 국면으로 올린다.

전사 입력 (T-1602 머지 시점 CI run 로그, journal 2026-08-18 14:05 항목에 박제):

```
[ci-realdb-contribution-read] p50=3.0ms p95=3.6ms p99=3.7ms tput=322.58req/s err=0.00% count=20 pass=true concurrency=1 dataScale=1 person / 8 contributions
```

## Required Reading

- `docs/decisions/ADR-0056-perf-baseline-checkin-ci.md` — `§Decision 2` (pr-mode 갱신 절차) · `§Decision 3 (b)` · `§Consequences (a) (d)` · `§Follow-ups (a)`
- `test/perf/baselines/baseline-ci-realdb-assessment-read.json` — 정본 직렬화 형태 (키 순서 · 단일 행 · 후행 개행) 참조 원본
- `test/perf/checkin-baseline-file.spec.ts` — `CHECKIN_BASELINES` 표 (68~85 행) · 표 크기 하한 국면 (110 행 부근) · negative (c) 집합 일치 국면
- `test/perf/contribution-measure-confirm-realdb.perf-spec.ts` — 335~350 행 (`REAL_CLOCK_ITER` · `SEED_CONTRIBUTIONS` 유도 `dataScale` · label `ci-realdb-contribution-read`)
- `test/perf/README.md` — 1257~1262 행 ("2 건 한정으로 착수" · "두 건만") · 1286~1289 행 ("2 건뿐")

## Acceptance Criteria

- [ ] `test/perf/baselines/baseline-ci-realdb-contribution-read.json` 신설. 값은 위 실측 줄의 **전사만** — `p50=3` · `p95=3.6` · `p99=3.7` · `throughput=322.58` · `errorRate=0` · `count=20` · `pass=true`, `env = { label: "ci-realdb-contribution-read", concurrency: 1, dataScale: "1 person / 8 contributions" }`. 재계산 · 재반올림 · 임의 보정 **0**.
- [ ] 파일 원문이 `serializeBaselineReport(parseBaselineReport(body))` 와 문자열 동일 (키 순서 · 단일 행). 기존 두 baseline JSON 과 같은 형태.
- [ ] `CHECKIN_BASELINES` 에 3 행째 추가 — `label: "ci-realdb-contribution-read"` · `sampleCount: 20` · `dataScalePattern: /^1 person \/ \d+ contributions$/` · `dataScaleOrigin` 은 `contribution-measure-confirm-realdb.perf-spec.ts` 의 `SEED_CONTRIBUTIONS` 유도 표기 지목. 기존 2 행 · 상수 · 국면 삭제 **0**.
- [ ] 표 크기 하한 국면의 `toBeGreaterThanOrEqual(2)` 를 `3` 으로 올려, 새 행이 조용히 빠지면 fail 하게 한다 (국면 제목 문구도 함께 정정).
- [ ] happy: 표 순회 happy 국면이 세 번째 label 에 대해서도 통과 — 파일이 예외 0 으로 복원되고 `count === 20` · `pass === true` · `errorRate === 0` · 4 지표 유한.
- [ ] error: 미체크인 label 의 `readBaselineFile` ENOENT 무래핑 전파 + `exists === false` 국면이 그대로 통과 (신규 label 이 그 고정 축을 오염시키지 않음).
- [ ] 분기: 세 번째 label 에 대해 동일 수치 candidate 무회귀 · `p95` 10 배 candidate 회귀 표기 두 분기 모두 통과 (wall-clock 실측 0).
- [ ] negative 충분 cover — (a) label 중복 0, (b) 디렉토리 `.json` 집합 == 표 유도 파일명 집합 (누락 · stale 양방향 fail, 신규 파일 포함해 3 개), (c) 표본 수 하한 `count >= 20`, (d) 단조성 `p50 <= p95 <= p99` 와 값 범위, (e) 표 크기 하한 3 — 모두 세 label 에 대해 성립.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `src/` 변경 0 LOC 이라 직전 수치 유지 확인.
- [ ] `test/perf/README.md` 의 체크인 건수 서술 정정 — 1287 행 "2 건뿐" → 3 건 (T-1603 이 넣은 `ci-realdb-contribution-read` 명시), 1258 행 "2 건 한정으로 착수" · 1261 행 "두 건만" 도 동일 사실이므로 함께 3 건으로. **그 외 서술은 불변** (과잉 정정 금지 — T-1601 선례).
- [ ] PR 본문에 ADR-0056 `§Decision 2` 절차대로 갱신 사유 + 입력이 된 CI 실측 줄 원문을 박제. `env.label` 신규 추가이므로 이전 수치는 없음 (`absent` → `compared` 진입임을 명시).

## Out of Scope

- `§Follow-ups (c)` tolerance 임계 재산정 — 축적 run 이 아직 `§Decision 5` 최소 20 run 미만.
- `§Follow-ups (b)` 본체 `ci.yml` perf step 토글 on 편입 (drift-guard smoke 3 종 동반 → 5 파일 cap).
- 네 번째 route 의 실측 clock 관찰 국면 추가 — 다음 slice.
- `contribution-measure-confirm-realdb.perf-spec.ts` 본문 수정 (본 slice 는 그 spec 이 이미 낸 실측 줄의 소비자일 뿐).
- `DEFAULT_P95_MAX_MS` · tolerance 상수 · `env.label` 명명 규칙 변경.
- `src/` 프로덕션 코드 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음)

## 결과 (2026-08-18)

`pr` mode, PR [#1283](https://github.com/myungjoo/Assessment-Agent/pull/1283) squash merge `8995d3c9` (3 파일 `+23/-8`, `src/` 0 LOC). T-1602 가 CI 로그에 남긴 20 표본 실측 줄을 **재계산 · 재반올림 0 · 전사만** 으로 `baseline-ci-realdb-contribution-read.json` 에 체크인하고, `CHECKIN_BASELINES` 표에 3 행째를 더해 표 크기 하한을 `>= 2` → `>= 3` 으로 올렸다. `README.md` 는 체크인 건수 서술 2 건 → 3 건만 정정. 가드 spec 국면 15 → 21 (표 순회가 세 번째 label 을 자동 흡수 — 신규 test 파일 0). 로컬 `lint` · `build` · `test`(438 suite / 12564 test) green, PR CI(run `32150545817`) 에서 신규 label 이 `compared` 로 진입해 `regressed=false` 확인. reviewer APPROVE round 1 → round 2 는 `envOf` 주석 Nit-in-PR closure, 4-게이트 PASS.
