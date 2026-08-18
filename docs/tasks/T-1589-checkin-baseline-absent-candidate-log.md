---
id: T-1589
title: 체크인 baseline absent 국면에 candidate 지표 로그 박제 (§Follow-ups (a) 선행)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 190
estimatedFiles: 4
created: 2026-08-18
createdAt: 2026-08-18T00:40:00Z
independentStream: perf-baseline-checkin
dependsOn: []
touchesFiles:
  - test/perf/checkin-baseline-report.ts
  - test/perf/checkin-baseline-report.spec.ts
  - test/perf/checkin-baseline-run.ts
  - test/perf/checkin-baseline-run.spec.ts
plannerNote: "P5 성능 검증 — ADR-0056 §Follow-ups (a) 선행: absent 국면이 측정 수치를 안 실어 최초 baseline 값 확인 경로가 없음"
---

# T-1589 — 체크인 baseline `absent` 국면에 candidate 지표 로그 박제 (`§Follow-ups (a)` 선행)

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Follow-ups` 중 `(b) ci.yml 편입`
(T-1584) 과 `(d) doc-sync`(T-1585) 는 닫혔고, 남은 축은 `(a) 체크인 baseline JSON 최초 생성·commit`
과 `(c) 임계 fix` 다. 그런데 `(a)` 를 지금 착수할 수 없는 **구조적 이유**가 하나 있다 —
`§Decision 2` 가 CI 자동 commit 을 비채택했기 때문에 최초 baseline 은 사람이 **CI 로그에서 측정
수치를 읽어** 승인·작성해야 하는데([`§Consequences (d)`](../decisions/ADR-0056-perf-baseline-checkin-ci.md)
"최초 확정 run 이 비정상적으로 느린 환경에서 찍히면 느슨한 기준이 박제되므로 사람 눈으로 확인"),
현재 `runCheckinBaselineCheck` 의 `skip(absent)` 국면은
`outcome=skipped reason=absent path=<경로>` 한 줄만 내고 **측정된 candidate 수치를 한 개도 싣지
않는다**. 즉 토글이 켜진 CI(T-1584) 를 아무리 돌려도 baseline 후보 값을 얻을 방법이 없다.

본 task 는 그 공백만 메운다 — 순수 포매터 1 개를 추가해 `absent` 국면 로그에 candidate 지표
(`p50` · `p95` · `p99` · `throughput` · `errorRate` · `count` · `pass` + env label · concurrency)
를 함께 싣는다. baseline 파일 생성 · commit 은 여전히 `(a)` 소관이며 본 task 는 그 **입력을 관측
가능하게** 만드는 선행 slice 다. REQ-048 의 회귀 탐지 전제(기준선 영속) 로 가는 경로에서 지금
가장 앞을 막고 있는 한 칸이다.

## Required Reading

- `test/perf/checkin-baseline-report.ts` — 본 task 가 포매터를 **추가**하는 파일(122 행).
  `CHECKIN_LOG_PREFIX` 상수 · `requireNonBlankString` 헬퍼 · `requireOutcome` ·
  `formatCheckinOutcomeLine` · `formatCheckinOutcomeBlock` 의 예외 계약(`TypeError` = 형태 불량,
  `RangeError` = 빈/공백-only · 허용 밖 값)과 "순수 · 부작용 0 · exit code 불변" 서두 주석 규약을
  그대로 승계할 것.
- `test/perf/checkin-baseline-run.ts` — `runCheckinBaselineCheck` 의 3 국면
  (`skip(disabled)` · `skip(absent)` · `compare`). 본 task 는 **`absent` 분기 로그 조립 한 곳만**
  건드린다(88~93 행 부근). `disabled` 분기와 `compare` 분기는 불변.
- `test/perf/latency-baseline.ts` `38~55 행` — `BaselineReport` 필드 8 개와 그 주석. 특히
  **성공 표본 0 이면 `p50`/`p95`/`p99` 가 `NaN`** 이고 `throughput` 은 `0` 이라는 계약(포매터가
  `NaN` 을 거부하면 안 되는 근거).
- `test/perf/checkin-baseline-report.spec.ts` — 기존 포매터 spec 의 국면 배치(happy / error /
  분기 / negative) 와 문자열 단언 방식. 신규 포매터 spec 을 같은 파일에 같은 형태로 잇는다.
- `test/perf/checkin-baseline-run.spec.ts` `80~87 행` — 현재 `absent` happy 단언
  (`result.log` 이 `reason=absent path=${DIR}/` 를 **contain**). 본 task 로 로그가 2 줄이 되므로
  이 국면의 단언을 갱신한다(기존 `disabled` · `compare` 국면 단언은 불변).
- `docs/decisions/ADR-0056-perf-baseline-checkin-ci.md` — `§Decision 2`(갱신 주체 = pr-mode task
  만, CI 자동 commit 비채택) · `§Decision 3 (b)`(상대 회귀는 관찰, exit code 불변) ·
  `§Consequences (d)`(첫 run 의 자기 승인 위험) · `§Follow-ups (a)`.

## Acceptance Criteria

- [ ] `test/perf/checkin-baseline-report.ts` 에 순수 포매터
      `formatCheckinCandidateLine(candidate: BaselineReport): string` 를 추가한다 — 반환은 **개행
      없는 한 줄** 이고 `CHECKIN_LOG_PREFIX` 로 시작하며 `candidate` marker 뒤에 `label` ·
      `concurrency` · `p50` · `p95` · `p99` · `throughput` · `errorRate` · `count` · `pass` 를
      `key=value` 공백 구분으로 싣는다(키 이름은 영어 고정 — grep 축). 파일 시스템 · 환경변수 ·
      시각 · 난수 접근 **0**, 수치 재계산 · 반올림 · 임계 판정 **0**(받은 값을 그대로 문자열화).
- [ ] happy path — 정상 `BaselineReport` 1 건으로 기대 문자열 전체를 **정확 일치**(`toBe`) 로
      단언하는 test 1+, 그리고 `runCheckinBaselineCheck` 의 `absent` 국면이 기존 한 줄 뒤에
      개행 1 개로 candidate 줄을 이어 **정확히 2 줄** 을 내는 test 1+.
- [ ] error path — `candidate` 가 non-object · `null` 이면 `TypeError`, 수치 필드가 non-number 이거나
      `pass` 가 non-boolean 이면 `TypeError`, `env.label` 이 빈/공백-only 면 `RangeError` 를 던지는
      test 각 1+. 예외 메시지에 함수명 prefix 를 포함해 호출측 추적이 가능해야 한다.
- [ ] 분기 cover — (1) 성공 표본이 있는 정상 report ↔ **표본 0 (`p50`/`p95`/`p99` 가 `NaN`,
      `throughput` 0)** 두 갈래가 모두 예외 없이 문자열화되어 `NaN` 이 로그에 그대로 보이는 것,
      (2) `pass: true` ↔ `pass: false` 두 갈래, (3) `runCheckinBaselineCheck` 의
      `skip(disabled)` ↔ `skip(absent)` 두 갈래(**`disabled` 는 candidate 를 검증도 노출도 하지
      않는다** — 토글 off 국면 단락 유지) 를 각각 test 로 cover.
- [ ] negative 충분 cover — (a) `disabled` 국면에 **형태가 깨진 candidate** 를 넣어도 예외 0 ·
      로그 1 줄 불변(판정 단락 우선), (b) `absent` 국면의 기존 `path=` 표기 · 순서 · prefix 가
      불변(candidate 줄은 **뒤에** 붙는다), (c) `compare` 국면 로그 · 반환(`regressed`) 이 완전
      불변, (d) 포매터가 입력 객체를 변형하지 않음(호출 전후 deep-equal), (e) `errorRate` 가 `0`
      또는 `1` 같은 경계값에서도 문자열 누락 없이 실림 — 각 1+ test.
- [ ] `runCheckinBaselineCheck` 의 반환 union 형태(`status` · `reason` · `regressed` 필드 구성) 와
      `compare` 주입 함수 호출 횟수(`absent` 에서 **0 회**) 는 불변임을 test 로 재확인한다.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 통과(기존 unit suite 무회귀) + `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%).
- [ ] perf 대상 실행으로 `checkin-baseline-report.spec.ts` · `checkin-baseline-run.spec.ts` 전량
      pass — 실행 명령과 test 수 증감을 PR 본문에 명시한다.
- [ ] 저장소 실경로 오염 0 — 본 변경으로 `test/perf/baselines/` 에 파일이 생기지 않는다(본 task 는
      write 국면을 만들지 않는다, ADR-0056 `§Decision 2`).

## Out of Scope

- ADR-0056 `§Follow-ups (a)` **본체** — `test/perf/baselines/` 아래 baseline JSON 실제 생성 ·
  값 타당성 확인 · commit(별도 pr-mode task, 본 task 가 낸 로그를 입력으로 사용).
- ADR-0056 `§Follow-ups (c)` — 부하계획 `§ 3` 임계 fix 승격(doc-sync, 별도 task).
- `.github/workflows/ci.yml` 수정 — 토글 on 은 T-1584 로 이미 완료. workflow 접촉 0
  (`deploy/daily-test.sh` 계열 동반 수정으로 파일 cap 이 깨진 T-1122 전례 회피).
- `checkin-baseline-plan.ts` · `checkin-baseline-store.ts` · `checkin-baseline-adapter.ts` ·
  `checkin-baseline-spec-suite.ts` · `latency-baseline*.ts` 수정 — 판정 · 경로 · 배선 · 판정
  primitive 재구현 0.
- `*.perf-spec.ts` 소비자 배선 확산(T-1586 · T-1587 계열) — 본 slice 는 primitive 축만.
- `test/perf/README.md` 문서 동기 — 5 번째 파일이 되어 cap 압박이 생기므로 Follow-ups 로 이월.
- 프로덕션 코드(`src/`) 변경, 새 dependency 추가, 상대 회귀의 CI fail 승격
  (ADR-0056 `§Decision 3 (b)` 정량 조건 미충족).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (생성 시점) `test/perf/README.md` 에 `formatCheckinCandidateLine` 및 `absent` 국면 2 줄 로그
  규약을 반영하는 doc-sync 1 slice — 본 task 의 파일 cap 밖.
