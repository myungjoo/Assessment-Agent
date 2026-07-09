---
id: T-0864
title: S2 latency baseline JSON 직렬화·역직렬화 순수 함수 신설 (serializeBaselineReport / parseBaselineReport)
phase: P8
status: DONE
mergedAs: 7a8ddeba
prNumber: 758
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 200
estimatedFiles: 3
created: 2026-07-10
independentStream: s2-latency-harness
dependsOn: []
touchesFiles:
  - test/perf/latency-baseline.ts
  - test/perf/latency-baseline.spec.ts
  - test/perf/README.md
plannerNote: "P8 load-resilience §5 #5(baseline 확정) — 저장 baseline JSON 직렬화·역직렬화 순수 함수. compareBaselineReports 의 저장측 선행 slice, 관찰 전용·판정 불변. R-112 backbone×1.5 → est 200."
---

# T-0864 — S2 latency baseline JSON 직렬화·역직렬화 순수 함수 신설

## Why

P8 부하·내성 테스트 계획([load-resilience-test-plan.md](../ops/load-resilience-test-plan.md)) §5 follow-up #5 는 "baseline 확정 + 임계 fix — 최초 실측으로 §3 임계를 실 수치로 확정"을 요구하며, §3 "환경 고정"은 각 run 을 **비교 가능하게 저장**할 것을 요구한다. 직전 T-0862 가 `BaselineReport` 를 조립하는 primitive 를, T-0863 이 두 리포트를 비교하는 `compareBaselineReports` 를 신설했다. 그러나 저장된 기준 baseline 을 **디스크에 영속화(직렬화)하고 다시 읽어(역직렬화) `compareBaselineReports` 에 먹이는** 순수 함수는 아직 없다. 실 baseline 실측 harness(§5 #5)가 "저장된 기준을 로드해 이번 측정과 비교"하려면 이 직렬화·역직렬화 primitive 를 import 만 하면 되도록 최소 선행 slice 를 박제한다. 관찰·리포트 전용이며 S2 pass/fail 임계 로직(assertS2Threshold)·판정은 전혀 바꾸지 않는다.

## Required Reading

- `test/perf/latency-baseline.ts` — `BaselineReport` / `BaselineEnvMeta` 인터페이스 + `isValidReport` / `isValidEnvMeta` 형태 가드. 본 task 가 여기에 `serializeBaselineReport` / `parseBaselineReport` 를 추가한다(기존 형태 가드 재사용).
- `test/perf/latency-baseline.spec.ts` (colocated spec) — 기존 spec 구조를 따라 새 함수 spec 을 여기에 추가한다.
- `test/perf/README.md` §"baseline 리포트 (`latency-baseline.ts`)" 절 — 새 함수 항목 2줄 추가.
- `docs/ops/load-resilience-test-plan.md` §3(환경 고정·비교 가능성) / §5 #5 — 영속화·비교의 근거 맥락.

## 설계 요지

- `serializeBaselineReport(report: BaselineReport): string` — 유효 `BaselineReport` 를 **안정적(stable)·비교 가능한 JSON 문자열**로 직렬화한다. NaN 지표(빈 표본)는 JSON 이 NaN 을 표현 못 하므로 명시 sentinel(예: `null`)로 저장하고, 역직렬화 시 다시 NaN 으로 복원해 round-trip 을 보존한다. 지표 재계산 없음 — 파생값을 그대로 전사만 한다.
- `parseBaselineReport(json: string): BaselineReport` — 위 문자열을 파싱해 `BaselineReport` 로 복원한다. NaN sentinel 을 NaN 으로 복원하고, 파싱 실패(잘못된 JSON) 시 `SyntaxError`(또는 명시 `TypeError`), 형태 불량(필수 필드 누락·타입 불일치) 시 `TypeError` 를 throw 한다(기존 `isValidReport` 가드 재사용).
- **round-trip 불변**: `parseBaselineReport(serializeBaselineReport(r))` 는 원본 `r` 과 지표·env-meta 가 동등해야 한다(NaN 포함).
- optional env-meta(cpu/memoryMb/dataScale)는 지정된 것만 보존하고, 미지정은 직렬화·역직렬화 후에도 미지정으로 유지한다.

## Acceptance Criteria

- [ ] `test/perf/latency-baseline.ts` 에 `serializeBaselineReport` / `parseBaselineReport` 두 함수를 export 추가. 지표 재계산 없이 파생값만 전사하며, 기존 `isValidReport` / `isValidEnvMeta` 형태 가드를 재사용한다.
- [ ] Happy-path unit test 1+ — 정상 `BaselineReport` 를 직렬화 후 역직렬화하면 원본과 지표·env-meta 가 동등(round-trip). NaN 미포함 정상 케이스 + 유한 수치 정확 복원.
- [ ] Error path unit test 1+ — `parseBaselineReport` 에 (1) 잘못된 JSON 문자열(파싱 실패 → `SyntaxError`/`TypeError`), (2) JSON 은 유효하나 형태 불량(필수 필드 누락·타입 불일치 → `TypeError`) 각 1+. `serializeBaselineReport` 에 유효하지 않은 `BaselineReport` 입력 시 `TypeError` 1+.
- [ ] Flow / branch coverage — 각 분기 1+ test: (1) NaN 지표(p95=NaN 빈 표본) 직렬화 시 sentinel 저장 + 역직렬화 시 NaN 복원, (2) optional env-meta 전부 지정 vs 전부 미지정 두 분기 round-trip, (3) `throughput=0`(빈 표본 관찰값) 정상 round-trip, (4) 파싱 성공 분기 vs 형태 가드 실패 분기.
- [ ] Negative cases 충분 cover — 각 1+ test: 빈 문자열 파싱, 배열/숫자 등 object 아닌 JSON 파싱, env 필드 누락 JSON, p95 가 string 인 형태 불량 JSON, NaN sentinel 이 아닌 실제 `null` 이 유한 지표 자리에 온 경우의 처리, serialize 결과가 `JSON.parse` 가능한 유효 JSON 인지 검증.
- [ ] `test/perf/README.md` 의 baseline 리포트 절에 `serializeBaselineReport` / `parseBaselineReport` 항목 1~2줄 추가(영속화·round-trip·NaN sentinel 명시).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 함수는 100% 목표.
- [ ] `pnpm lint && pnpm build` 통과.

## Out of Scope

- assertS2Threshold / S2Assertion / collector orchestration 변경 금지 — pass/fail 임계·판정 로직 불변.
- 실제 파일 I/O(디스크 read/write, `fs` 호출), CI job 편입, 실 Postgres 실측 — 전부 별도 follow-up(§5 #4·#5 harness). 본 task 는 순수 문자열 직렬화·역직렬화만.
- baseline 파일 경로 규약·버저닝·마이그레이션 정책 — 저장 harness 착수 시 별도 task.
- 신규 외부 dependency 추가 금지(supertest/jest 이내). 새 dep 필요 시 BLOCKED.
- DB schema·migration·auth 변경 없음.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
