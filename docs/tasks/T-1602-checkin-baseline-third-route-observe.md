---
id: T-1602
title: contribution 실 DB perf-spec 에 실측 clock candidate 관찰 국면 추가 (세 번째 route)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-048, REQ-047]
estimatedDiff: 270
estimatedFiles: 1
created: 2026-08-18
createdAt: 2026-08-18T13:45:00Z
completedAt: 2026-08-18T14:02:44Z
prNumber: 1282
mergeCommit: 8510e8cc
independentStream: perf-checkin-baseline
dependsOn: [T-1600, T-1601]
touchesFiles: [test/perf/contribution-measure-confirm-realdb.perf-spec.ts]
plannerNote: P5 perf — ADR-0056 §Follow-ups (a) 나머지 route 축을 세 번째 route(3-level FK chain)로 확산. T-1600 패턴 승계.
---

# T-1602 — contribution 실 DB perf-spec 에 실측 clock candidate 관찰 국면 추가 (세 번째 route)

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Follow-ups (a)` 의
**"나머지 route 의 체크인 baseline"** 축을 **세 번째 route** 로 넓힌다. 저장소에 체크인된 기준
baseline 은 T-1592 → T-1594 의 `baseline-ci-realdb-person-read.json` 과 T-1600 → T-1601 의
`baseline-ci-realdb-assessment-read.json` **2 건뿐** 이고, 나머지 실 DB route 는 CI 로그에 실측
p50/p95/p99 가 전혀 찍히지 않아 `§Consequences (d)` 가 요구하는 **"사람이 값의 타당성을 확인한 뒤
commit"** 의 입력이 없다 — 체크인 배선 소비자 11 개 중 나머지가 전부
`registerCheckinBaselineWiringSuite` 의 `measure` 로 `createStepClock(stepMs)` **합성** 표본만 태우기
때문이다(본 task 대상 파일도 `290~302 행` 이 그렇다).

`GET /api/contributions`(slice 27)를 세 번째 route 로 고르는 근거는 두 가지다 — ① 앞선 두 route
(무-파라미터 목록 · `personId` 단일 필터)와 달리 **`Person → Assessment → Contribution` 3-level FK
chain 을 부모 id 로 긁는** 실 query 라 REQ-048 의 "조회 p95 < 3s" 가 가장 무겁게 매달린 축이 새로
관측되고, ② 실 DB 부트스트랩 · seed(`seed()`, `88~127 행`) · 인증 쿠키 · `RequestFn` factory
(`read`, `129~141 행`)가 이미 갖춰져 있어 신규 배선이 관찰 국면 하나뿐이다.

`§Decision 2`(write 국면 부재) · `§Decision 3 (b)`(회귀는 관찰만, exit code 불변)는 그대로다 — 본
task 는 **로그를 하나 더 내는 관찰**일 뿐이며 baseline JSON 을 만들지도 저장소에 쓰지도 않는다. 실제
체크인(`baseline-ci-realdb-contribution-read.json` 생성 · commit + `CHECKIN_BASELINES` 표 3 행째
추가)은 본 task 가 CI 로그로 노출한 실측 수치를 사람이 확인한 **다음 slice** 의 몫이다(T-1592 ·
T-1601 선례와 동형).

## Required Reading

- `test/perf/contribution-measure-confirm-realdb.perf-spec.ts` — 본 task 가 **유일하게 수정하는
  파일**(304 행). 특히 상수(`PRIMARY_CHILDREN=5` / `OTHER_CHILDREN=3` / `ITER` / `WIRING_ITER`,
  `45~51 행`), `env`(`60 행`, `realdb-contrib-mc`), `beforeEach` 의 `tmpRoot` · `afterEach` 의
  `truncateAll` → `reseedAuthenticatedActors` 순서(`73~81 행`), `dirOf` · `qOf`(`86~87 행`),
  `seed()`(`88~127 행` — Person 1 → Assessment 2 → 자식 5 / 3, 반환값은 부모 id 쌍),
  `read(query, authed)`(`129~141 행` — `RequestFn` 을 **반환하는 factory**), `rows()`(`142 행`),
  `registerCheckinBaselineWiringSuite` 호출(`290~302 행`)을 확인할 것.
- `test/perf/assessment-measure-confirm-realdb.perf-spec.ts` `318~592 행` — T-1600 이 두 번째
  route 에 박제한 **실측 clock 관찰 국면의 정본 패턴**. 지역 helper 구성(`measureRealClock` ·
  `checkWithLogs` · `enabledEnv` · `expectEnabledOutcome` · `metricsLineOf`)과
  `REAL_CLOCK_ITER`(`329 행`) · `REAL_CLOCK_ITER_MIN`(`331 행`) 상수 주석을 그대로 승계하되
  **route 고유분만** 갈아끼운다. 하한 가드 `it`(`525~530 행`)도 동형으로 둔다.
- `test/perf/checkin-baseline-spec-wiring.ts` — 새로 부르는 `checkCheckinBaselineForSpec`
  (어댑터 1 회 위임 + `outcome.log` 를 주입 로거로 원문 1 회 출력 + outcome 무가공 반환) 계약과
  예외 전파 규약. `seedCheckinBaselineFixture` 는 본 task 에서 쓰지 않는다.
- `test/perf/checkin-baseline-report.ts` `formatCheckinCandidateLine` + `CHECKIN_LOG_PREFIX` —
  candidate 줄의 키 순서(`label` · `concurrency` · `p50` · `p95` · `p99` · `throughput` ·
  `errorRate` · `count` · `pass`)와 NaN 무가공 전사 계약.
- `test/perf/latency-collector.ts` `measureBaselineCandidate` — `opts.now` **미주입 시 실 clock**,
  요청 reject 는 failure 집계(표본 제외), 임계 위반을 throw 하지 않고 `pass` 플래그로만 싣는 계약.
- `test/perf/checkin-baseline-file.spec.ts` `55~90 행` — 다음 slice 가 3 행째를 추가할
  `CHECKIN_BASELINES` 표(`label` · `sampleCount` · `dataScalePattern` · `dataScaleOrigin`). 본
  task 의 `dataScale` 표기가 그 표의 정규식 입력이 되므로 **기계적으로 유도 가능한 형태**로 짠다.
- `docs/decisions/ADR-0056-perf-baseline-checkin-ci.md` `§Decision 1~3` · `§Consequences (d)` ·
  `§Follow-ups (a)` — 본 slice 가 여는 선행 조건의 근거.

## Acceptance Criteria

- [ ] `test/perf/contribution-measure-confirm-realdb.perf-spec.ts` 에 **실측 축 전용 nested
      `describe` 1 개**를 추가하고 그 안에서만 `checkCheckinBaselineForSpec` 을 부른다. 그 국면은
      전용 `envMeta`(`label: "ci-realdb-contribution-read"`, `concurrency: 1`, `dataScale` 는
      `PRIMARY_CHILDREN` 등 seed 상수에서 **유도**한 문자열 — 리터럴 손코딩 금지)를 쓰고
      **`repoRoot` 를 생략**해 저장소 실경로 바인딩을 탄다. 기존 `env`(`realdb-contrib-mc`) 와
      label 이 **분리**돼 있어 향후 체크인될 baseline 파일이 배선 · 확정 국면과 충돌하지 않음을
      주석 1~2 줄로 박제한다. 토글은 **`processEnv` 주입**으로만 제어하고 전역 `process.env` 를
      읽지도 쓰지도 않는다(전역 오염 0).
- [ ] **happy-path 1+** — 실 clock(= `measureBaselineCandidate` 에 `now` **미주입**)으로 seed 후
      `read(qOf(primary))` 를 측정한 candidate 를 토글 on 으로 태우면 예외 0 이고, 주입 로거가
      **정확히 1 회** 호출되며 그 문자열이 `CHECKIN_LOG_PREFIX` 로 시작한다. `status` 는
      `"compared"` 또는 `"skipped"`(`reason: "absent"`) 중 하나임을 실행 시점 파일 존재 여부에
      맡겨 **하드코딩하지 않는다**. `absent` 이면 로그가 개행 기준 **정확히 2 줄**이고 둘째 줄에
      `p50=` · `p95=` · `p99=` · `throughput=` · `errorRate=` · `count=` · `pass=` 키가 모두 있으며
      `count` 가 반복 수와 일치한다. 같은 국면에서 `rows()` 길이가 `PRIMARY_CHILDREN` 임을 함께
      단언해 **실 query 발화**를 입증하고, 분기와 무관하게 `formatBaselineLine(candidate)` 한 줄을
      `console.log` 로 남겨 다음 slice 의 `§Consequences (d)` 승인 입력으로 쓴다(T-1593 선례).
- [ ] **error path 2+** — (a) 전량 reject 하는 `RequestFn` 의 실측 candidate 를 같은 경로에 태워도
      **throw 0** 이고 `errorRate=1` · `pass=false` 가 가공 없이 전사된다(실 DB 무의존, seed 불요),
      (b) **`assessmentId` 누락**(`read("")`) 실측 candidate — 전량 400 이라 `count=0` ·
      `errorRate=1` 이면서도 확인 경로는 throw 0 이다(본 route 고유 **필수 파라미터** 축).
- [ ] **분기 cover 2+** — (1) 같은 실측 candidate 를 토글 on(`processEnv` 에 `"1"`) → 수치 키 포함
      다중 줄, 토글 off(`processEnv: {}`) → `status: "skipped"` · `reason: "disabled"` 이고 로그가
      **1 줄**이며 `p95=` 같은 수치 키가 **하나도 실리지 않음** 을 각각 단언한다. (2) **3-level FK
      부모 선택** 분기 — 부모 A · 부모 B 의 실측 candidate 가 **둘 다** 확인 경로를 예외 0 으로
      통과하고 각각 응답 길이가 `PRIMARY_CHILDREN`(5) · `OTHER_CHILDREN`(3) 으로 **서로 다름**을
      단언한다(본 slice 고유 축).
- [ ] **negative cases 충분 cover** — 최소 3 종을 각각 별도 `it` 로: (a) `iterations: 0` 실측
      candidate 를 토글 on 으로 태워도 throw 0 이고 `count=0` 과 `NaN` 표기가 가공 없이 로그에
      실린다, (b) `iterations` 음수는 `RangeError` 가 **확인 경로 도달 전에** 전파되고 로거 호출이
      0 회다, (c) **존재하지 않는 부모 id** 실측 candidate — 404 가 아니라 200 + 빈 배열이라
      `errorRate=0` · `count` 가 반복 수와 같고 `rows()` 길이가 0 이다(부모 필터의 무-매칭 축).
      `test/perf/baselines/` 실경로 무오염 · 전역 토글 누출 0 · **연속 2 회 호출 부작용 0** 국면은
      `registerCheckinBaselineWiringSuite` 의 배선 국면이 **같은 코드 경로로 이미 cover** 하므로
      **재작성 금지**(T-1575 중복 국면 삭제 선례).
- [ ] 실측 반복 수는 **20**(`REAL_CLOCK_ITER = 20`) 으로 두고 하한 회귀 가드 상수
      (`REAL_CLOCK_ITER_MIN = 20`) 와 그 값을 지키는 `it` 1 개를 함께 둔다 — 근거 · 한계 · 비용
      3 줄 주석은 T-1593 → T-1600 이 박제한 문장을 route 에 맞게 승계한다. 기존 `ITER` ·
      `WIRING_ITER` 는 **재사용하지 않는다**(비용 축과 의미가 다른 상수).
- [ ] 기존 국면 불변 — `PRIMARY_CHILDREN` · `OTHER_CHILDREN` · `ITER` · `WIRING_ITER` 값, 기존
      `it` 들의 단언, `registerCheckinBaselineWiringSuite` 호출 인자, `beforeAll`/`beforeEach`/
      `afterEach`/`afterAll` 본문을 **수정하지 않는다**(추가만). `src/` · `prisma/` · 임계값
      (`DEFAULT_P95_MAX_MS = 3000`) 도 0 LOC 변경.
- [ ] diff 는 **1 파일 · 300 LOC 이내**를 지킨다. 국면 밀도가 T-1600(+293) 에 근접하므로 helper
      승계를 최대한 압축하고, 그래도 cap 이 위태로우면 negative (c) 를 **Follow-ups 로 이월**한다
      (국면 축소 시 그 사유를 PR 본문에 1 줄 명시).
- [ ] `pnpm lint && pnpm build` 통과. `pnpm test:perf` 로 본 spec 이 전량 pass 하고(실 DB 필요) 실행
      로그에 `[perf][checkin-baseline]` 실측 candidate 줄과 `ci-realdb-contribution-read` candidate
      줄이 눈으로 확인된다 — PR 본문에 그 줄 원문 1~2 개를 **그대로 인용**해 다음 slice 의 승인
      입력으로 남긴다.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 본 task 는 `src/` 를 0 LOC 변경하므로
      커버리지 수치 변동이 없어야 한다.

## Out of Scope

- **baseline JSON 체크인 금지** — `test/perf/baselines/baseline-ci-realdb-contribution-read.json`
  을 본 task 에서 만들지 않는다(`§Consequences (d)` 의 사람 확인 입력을 먼저 CI 로그로 노출하는
  것이 본 slice 의 전부). 파일 생성 · `checkin-baseline-file.spec.ts` 의 `CHECKIN_BASELINES` 3 행째
  추가는 다음 slice.
- 다른 perf-spec(person-read-realdb · assessment-measure-confirm-realdb 포함 11 소비자) · 공유
  helper(`checkin-baseline-*.ts` · `latency-*.ts` · `step-clock.ts`) 수정 금지.
- `test/perf/README.md` · ADR-0056 · 부하계획 문서 갱신 금지(문서 동기는 별도 slice — T-1590 선례).
- `.github/workflows/ci.yml` · `deploy/daily-test.sh` 등 CI/스크립트 변경 금지(ADR-0056
  `§Follow-ups (b)` 는 drift-guard smoke 3 종 동반으로 파일 cap 이 걸리는 별도 축 — T-1122 전례).
- 임계값(`DEFAULT_P95_MAX_MS`) · tolerance 재산정 금지(ADR-0056 `§Follow-ups (c)` 는 동일
  env.label 20 run 축적 미달로 여전히 착수 불가).
- wall-clock 대소 단언 · `comparison.regressed` 값 단언 금지(공유 runner 비결정성 —
  `§Decision 3 (b)`).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

---

## 결과 (2026-08-18T14:02:44Z DONE)

`pr` mode — PR [#1282](https://github.com/myungjoo/Assessment-Agent/pull/1282) 스쿼시 머지 `8510e8cc`, branch 삭제 완료. `test/perf/contribution-measure-confirm-realdb.perf-spec.ts` 1 파일 `+292/-0` (순수 insertion — 기존 상수 · 국면 · 배선 인자 · hook 및 `src/` 0 LOC). 실측 전용 nested describe 1 개에 전용 label `ci-realdb-contribution-read` · `repoRoot` 생략 · `processEnv` 주입 토글로 국면 9 개 (happy 1 · error 2 · 분기 2 · 표본 하한 가드 1 · negative 3) 를 배선했다.

- **4-게이트** — reviewer VERDICT=APPROVE(round 1, BLOCKER · MAJOR 0) + PR comment 외화 + integrator 자체 점검 + PR CI green(run `32144578369`, "기본 검사" · "배포 산출물 검증" 2 job pass) 으로 4/4. round 2 commit `5189b42` 는 CLAUDE.md `§3` **Nit-in-PR closure**.
- **R-112** — 로컬 `lint` · `build` · `test:cov`(438 suite / 12558 test, line 99.95% · function 100%) 통과. perf · smoke 는 로컬 `DATABASE_URL` 부재로 CI(`services.postgres`)에서 green.
- **다음 slice 승인 입력** (CI 로그 실측 줄) — `[ci-realdb-contribution-read] p50=3.0ms p95=3.6ms p99=3.7ms tput=322.58req/s err=0.00% count=20 pass=true concurrency=1 dataScale=1 person / 8 contributions`. 이 줄이 [ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Consequences (d)` 의 "사람이 값 타당성 확인 후 commit" 입력이 되어, 다음 slice 가 `baseline-ci-realdb-contribution-read.json` 체크인 + `CHECKIN_BASELINES` 3 행째 추가를 수행할 수 있다.
