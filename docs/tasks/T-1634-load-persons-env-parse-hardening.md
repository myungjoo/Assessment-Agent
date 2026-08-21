---
id: T-1634
title: S1/S2 부하 스크립트의 표본 인원 __ENV 파싱 방어 + s1-batch.js 머리 주석 doc-sync
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-047]
estimatedDiff: 230
estimatedFiles: 3
created: 2026-08-21
createdAt: 2026-08-21T03:20:00Z
independentStream: load-harness-k6
dependsOn: [T-1633]
touchesFiles:
  - test/load/s1-batch.js
  - test/load/s2-read.js
  - test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts
plannerNote: P5 R-91 chain 15/N — 인원 env 오입력이 임계식을 NaN 으로 무너뜨리는 구멍 봉인 + T-1633 follow-up 주석 doc-sync. 3 파일.
---

# T-1634 — S1/S2 부하 스크립트의 표본 인원 `__ENV` 파싱 방어 + `s1-batch.js` 머리 주석 doc-sync

## Why

[docs/PLAN.md](../PLAN.md) `144 행` 오너 지시(R-91 k6 최우선·즉시 착수) chain 15/N 이다. T-1633 이
`load-k6.yml` S1 step · `test:load:s1` parity 까지 배선을 끝내 harness 는 완비됐지만, 두 부하
스크립트가 인원 수를 읽는 방식에 **운영 사고 표면 하나**가 남아 있다 —
[test/load/s1-batch.js](../../test/load/s1-batch.js) `22 행` 의 `Number(__ENV.K6_S1_PERSONS || 10)`
은 `K6_S1_PERSONS` 가 숫자가 아닌 값(오타 · 단위 접미사 · 공백)일 때 `NaN` 을 내고, 그 `NaN` 이
`26~30 행` 의 `BATCH_P95_MS` 산식을 타고 임계 문자열 `p(95)<NaN` 으로 굳어 **k6 threshold 파싱
자체가 깨진다**. 즉 ADR-0057 `D4` 가 정한 외삽 게이트가 조용히 무력화되는 것이 아니라 run 이
통째로 실패한다. [test/load/s2-read.js](../../test/load/s2-read.js) `31 행` 도 같은 형태라
`K6_SEED_PERSONS` 오입력 시 seed 인원이 `NaN` 이 되어 조회 대상 0 행 위에서 p95 를 통과하는
착시(T-1623 describe 가 막으려던 바로 그 실패 양식)를 만든다. 두 곳 모두 **분기 0 규약을 지킨
채** 정규화 한 줄로 봉인할 수 있다.

함께 T-1633 이 남긴 follow-up 을 닫는다 — `s1-batch.js` `16 행` 의 "범위 밖(후속 slice):
load-k6.yml step · package.json script · 133명 full seed" 문단은 T-1633 머지로 앞 두 항목이
사실과 어긋나게 됐다. 같은 파일 · 같은 머리 주석이라 별도 slice 로 분리하지 않고 본 task 에서
같이 정정한다.

## Required Reading

- [test/load/s1-batch.js](../../test/load/s1-batch.js) `1~30 행` — 머리 주석(특히 `16 행` 범위 밖
  문단) · `__ENV` 기본값 2 종 · `BATCH_P95_MS` 산식(`26~30 행`)
- [test/load/s2-read.js](../../test/load/s2-read.js) `25~33 행` — `BASE_URL` · `SEED_PERSONS` 선언과
  그 주석
- [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts)
  — 갱신 대상 3 지점: `613 행` `SEED_ENV_KEY` 와 `669~680 행` 의 S2 parity `it`(정규식
  `__ENV\.K6_SEED_PERSONS\s*\|\|\s*(\d+)`), `1296 행` 의 `expect(script).toContain("__ENV.K6_S1_PERSONS || 10")`,
  `1548~1556 행` 의 S1 parity `it`(정규식 `__ENV\.K6_S1_PERSONS \|\| (\d+)`). 신규 describe 는
  파일 끝(`1745 행` 이후)에 붙인다.
- [docs/decisions/ADR-0057-s1-batch-load-io-isolation.md](../decisions/ADR-0057-s1-batch-load-io-isolation.md)
  `## Decision` `D4`(외삽 산식) · `## 범위 밖 (deferred)` — 본 task 가 닫는 항목과 남기는 항목 경계
- [docs/tasks/T-1633-load-k6-s1-step-wiring.md](T-1633-load-k6-s1-step-wiring.md) `Follow-ups` —
  머리 주석 doc-sync 요구의 출처

## Acceptance Criteria

- [ ] `test/load/s1-batch.js` 의 `SAMPLE_PERSONS` 선언이 **비수치 · 빈 문자열 · 미설정 · 0 이하**
      입력에서도 양의 정수를 내도록 정규화된다. 조건문 · 삼항 · `if` 를 쓰지 않는 **분기 0 표현**
      이어야 한다(예: `Math.max(1, Math.trunc(Number(__ENV.K6_S1_PERSONS)) || 10)` 형태). 기본값
      `10` 리터럴은 그대로 유지 — workflow 주입값 `"10"` 과의 parity 가 깨지면 안 된다.
- [ ] `test/load/s2-read.js` 의 `SEED_PERSONS` 도 같은 규약으로 정규화하고 기본값 `30` 유지.
- [ ] 두 선언 위 주석에 "오입력 정규화" 의도를 한국어 1~2 줄로 남긴다(값 재산정 아님 — ADR-0057
      `D4` 산식 · 계획 `§3` 임계는 무변경임을 명시).
- [ ] `test/load/s1-batch.js` `16 행` 의 "범위 밖(후속 slice)" 문단을 사실과 일치시킨다 —
      `load-k6.yml` step · `package.json` script 는 T-1633 로 완료(항목에서 제거), 남는 것은
      133명 full seed · baseline 실측/임계 fix · 서버 단계별 분해 지표.
- [ ] drift-guard smoke의 기존 parity 단언 3 지점을 새 표현과 정합하게 갱신하되 **parity 보호력이
      약해지면 안 된다** — 스크립트 기본값과 workflow 주입값을 여전히 서로 뽑아 대조한다. 두
      스크립트가 공유하는 fallback 추출 helper 1 개를 새로 두고 S1/S2 양쪽 `it` 가 함께 쓴다.
- [ ] 신규 describe `... 표본 인원 __ENV 파싱 방어 drift smoke (T-1634)` 를 spec 끝에 추가하고
      아래 4 종을 모두 cover 한다:
  - happy-path — 두 스크립트가 정규화 표현을 갖고, 기본값 리터럴(10 / 30)이 workflow 주입값과
    parity 이며, 머리 주석 "범위 밖" 문단이 `load-k6.yml`/`package.json` 을 더는 후속으로 적지
    않음을 각각 단언(각 1+ `it`).
  - error path — 새 helper 에 non-string 입력을 주면 `TypeError` 를 던진다(파일 read 실패 시
    0-byte false-PASS 차단, 기존 `extractTopLevelBlock` 계약과 동형) + 대상 부재 시 `null` 정규형.
  - 분기 cover — helper 의 "패턴 발견 / 미발견" 두 갈래, 그리고 정규화 표현이 감싸는 형태
    (`Number(...)` 안쪽 / 바깥 `|| <기본값>`) 양쪽을 합성 문자열로 각각 단언.
  - negative cases 충분 cover — ① 옛 취약 표현 `Number(__ENV.K6_S1_PERSONS || 10)` 이 스크립트에
    남아 있지 않음, ② `Number(__ENV.K6_SEED_PERSONS || 30)` 도 남아 있지 않음, ③ 두 스크립트에
    `if (` · 삼항 `?` 조건 분기가 새로 들어오지 않음(분기 0 규약), ④ 기본값이 `0` 또는 음수
    리터럴로 바뀌지 않음, ⑤ 임계 산식 상수(`133` · `3600000`)가 무변경, ⑥ 실 HTTP · 실 k6 · 실
    docker 실행 0(파일 read + 합성 문자열만) 을 각각 `it` 로 고정.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 전량 green — 기존 T-1620/22/23/24/25/31/33 describe 회귀 0.
- [ ] `pnpm test:smoke` 통과(갱신 대상 spec 포함).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `src/` 변경 0 이므로 coverage 수치는
      불변이어야 한다.
- [ ] 변경 파일 3 개 · diff ≤ 300 LOC 준수.

## Out of Scope

- `src/` · `.github/workflows/load-k6.yml` · `package.json` 변경 — 본 slice 는 `test/` 안에서 끝난다.
- 133명 full scale seed 투입, baseline 실측 · 계획 `§3` 임계 fix, 서버 단계별(수집 / LLM / 저장)
  소요 분해 지표 — ADR-0057 `## 범위 밖` 잔여 항목 그대로 남긴다.
- ADR-0057 본문 수정 · status flip · REQ-047 상태 전이(PLANNED 유지 — 실측 전이라 근거 없음).
- `s3-concurrent.js` · `smoke.js` — 수치 `__ENV` 가 없어 본 결함 표면이 없다.
- 새 dependency 추가, k6 옵션 프로파일(vus / iterations) 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음)
