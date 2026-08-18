---
id: T-1597
title: 실 DB baseline slice 목록의 잔여 4 축 서술을 체크인 baseline·CI 편입 이후 현행으로 doc-sync
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 90
estimatedFiles: 1
created: 2026-08-18
createdAt: 2026-08-18T08:20:00Z
independentStream: perf-checkin-baseline
dependsOn: [T-1584, T-1592, T-1596]
touchesFiles:
  - test/perf/README.md
plannerNote: "P5 성능 검증 — PLAN 140~142 행(REQ-048) 축, T-1596 Follow-ups 첫 항목: 잔여 4 축 서술이 T-1584·T-1592 이전 상태로 stale"
---

# T-1597 — 실 DB baseline slice 목록의 잔여 4 축 서술을 현행으로 doc-sync

## Why

직전 [T-1596](T-1596-checkin-baseline-compared-readme-sync.md) 이 `test/perf/README.md` 의
**체크인 baseline 게이트 절**(`108~217 행`)만 코드와 맞추고, 같은 파일 아래쪽 **실 DB
round-trip baseline (slice 목록)** 절의 잔여 축 서술은 `Follow-ups` 첫 항목으로 명시 이월했다.
그 서술은 [T-1584](T-1584-ci-perf-checkin-baseline-toggle.md)(CI `perf test` step 에
`PERF_CHECKIN_BASELINE: "1"` 편입) · [T-1592](T-1592-checkin-baseline-first-json.md)(저장소에
첫 체크인 baseline JSON `test/perf/baselines/baseline-ci-realdb-person-read.json` 박제) **이전
상태로 굳어 있어**, 지금은 사실과 다르다 — slice 25 ~ 29 와 **잔여** · **임계값 3000ms** bullet
7 곳이 "체크인 기준 baseline(`§ 5` #5) · CI job 편입(`§ 5` #4) · 임계 fix 는 **전부 미착수
그대로**" 라고 현재형으로 단언한다 (`1139~1140` · `1159~1160` · `1181~1182` · `1208~1209` ·
`1237~1238` · `1255~1256` · `1271~1272` 행).

drift 의 방향이 위험한 쪽이다: 실제로는 체크인 baseline 이 **1 route 한정으로 착수** 됐고 CI 는
매 run `compared` 국면으로 진입하는데, README 는 "미착수" 라 읽는 사람이 축적 표본의 존재
자체를 모른 채 [ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Decision 5` 의
임계 승격 절차를 아예 찾지 않게 된다. 동시에 **과잉 정정도 금지** 다 — 부하계획
[`§ 5` item 4](../ops/load-resilience-test-plan.md) 가 말하는 "부하 harness 별도 job" 은
여전히 미착수이고 (T-1584 는 `§Decision 4` 대로 **기존 step 재사용** · 신규 job 0), `§ 5`
item 5 의 임계 fix 도 축적 2 run 이라 `§Decision 5` 4 항(단일·소수 run 고정 금지)에 걸려
미착수다. 본 task 는 PLAN `140~142 행`(REQ-047 / REQ-048 성능 검증) 축의 harness 문서를 **정확히
현행만큼만** 갱신하는 문서 전용 slice 이며 코드 변경은 0 이다.

## Required Reading

- `test/perf/README.md` — `1130~1277 행`(slice 25 ~ 29 + **잔여** + **로컬 실행 전제** +
  **임계값 3000ms 는 불변** bullet). 갱신 대상 전부가 이 범위 안이다.
- `test/perf/README.md` `108~142 행` — 체크인 baseline 게이트 절 + 토글 절. T-1590 · T-1596 이
  이미 현행화한 문장이며, 본 task 의 새 서술은 이 절과 **모순되지 않아야** 한다.
- `docs/decisions/ADR-0056-perf-baseline-checkin-ci.md` — `§Decision 1`(체크인 위치) ·
  `§Decision 4`(별도 job 신설 없이 기존 `perf test` step 재사용) · `§Decision 5`(임계 승격
  절차와 표본 요건) · `§Follow-ups`.
- `docs/ops/load-resilience-test-plan.md` `126~136 행` — `§ 5` item 1 ~ 5 원문. README 가
  인용하는 `#4` · `#5` 의 **원래 범위** 를 여기서 확인한다 (item 4 = 부하 harness 별도 job).
- `test/perf/baselines/baseline-ci-realdb-person-read.json` — 현재 체크인된 baseline 이
  **1 건 · `env.label = ci-realdb-person-read` 한정** 임을 확인 (파일 목록 확인이면 충분).

## Acceptance Criteria

- [ ] `test/perf/README.md` 의 **잔여** bullet(`1242~1262 행`) 4 축 서술에서 baseline 확정 축의
      현행 상태를 정정한다 — ① 체크인 기준 baseline 은 **`ci-realdb-person-read` 1 건 한정으로
      착수** (T-1592) 되어 CI 가 매 run `compared` 로 진입하고, ② 나머지 route 의 체크인 baseline
      과 **임계 fix 는 여전히 미착수** 이며, ③ 그럼에도 **4 축은 소진되지 않았다** 는 결론은
      유지. "전부 미착수 그대로" 라는 blanket 표현은 남기지 않는다.
- [ ] CI 편입 인용을 정확히 갈라 적는다 — ADR-0056 체크인 게이트는 **기존 `perf test` step 에
      편입 완료**(T-1584, `§Decision 4` 대로 신규 job 0) 이나 부하계획 `§ 5` item 4 의 **부하
      harness 별도 job 은 미착수** 임이 한 문장 안에서 구분돼야 한다. `§ 5` #4 를 통째로
      "완료" 로 뒤집지 않는다.
- [ ] slice 25 ~ 29 의 동일 문구 5 곳(`1139~1140` · `1159~1160` · `1181~1182` · `1208~1209` ·
      `1237~1238` 행)이 현재형 단언으로 남지 않게 한다 — 각 slice 의 **작성 시점 기록** 임을
      드러내는 최소 표기(예: 해당 slice 시점 기준 + 현행은 **잔여** bullet 참조)로 정정하고,
      각 slice 의 고유 축 · 계수 · 검증 서술 본문은 **재작성하지 않는다**.
- [ ] **임계값 3000ms 는 불변** bullet(`1268~1272 행`)의 마지막 문장을 갱신한다 —
      `DEFAULT_P95_MAX_MS = 3000` 불변 · slice 별 **임시 디렉토리 1 회성** 확정·비교라는 사실은
      그대로 두되, "체크인 기준 baseline 은 별도 slice" 서술을 T-1592 이후 현행(1 건 체크인 완료
      · 나머지 route 와 임계 fix 는 별도 slice)으로 고친다.
- [ ] 사실 무결성: 각 slice 의 **임시 디렉토리 1 회성** · 저장소 오염 0 · perf-spec 계수(총계
      **63** · `*realdb*` **29** · `*read*` **51** · `*read*realdb*` **21**) · 인벤토리 (A) **30**
      / (B) **0** / (C) **0** · 도메인 **15** · 조회 route **31** · 규모 축 route **3** 수치는
      **한 글자도 바꾸지 않는다** (본 task 는 새 측정을 하지 않는다).
- [ ] 코드 · spec · CI workflow · baseline JSON 변경 0 — `git diff --stat` 결과가
      `test/perf/README.md` 1 파일이다.
- [ ] R-112 happy-path: 코드 변경 0 · 신규 public symbol 0 이라 신규 test 대상이 없다. 대신
      갱신된 서술을 `test/perf/checkin-baseline-run.spec.ts` 의 기존 happy-path 단언(3 국면 ·
      로그 줄 순서)과 **항목별 대조** 해 모순 0 임을 PR 본문에 적는다.
- [ ] R-112 error path: 위와 같은 이유로 신규 error-path test 없음. 기존 spec 의 예외 전파
      단언과 README 서술이 어긋나지 않음을 확인해 PR 본문에 적는다.
- [ ] R-112 분기: 본 task 는 문서 전용이라 **신규 분기 0** — 이 항목은 "분기 없음" 으로 명시한다.
- [ ] R-112 negative: 문서 서술이 "체크인 baseline 이 모든 route 에 있다" · "부하 harness 별도
      job 이 완료됐다" · "임계 fix 가 끝났다" 같은 **과잉 주장으로 뒤집히지 않았음** 을 3 항목
      각각 확인 (과잉 정정이 본 task 의 주된 실패 모드다).
- [ ] `pnpm lint` · `pnpm build` · `pnpm test` 통과, `pnpm test:cov` 통과(line ≥ 80% /
      function ≥ 80% — `src/` 무변경이라 직전 수치 유지).

## Out of Scope

- 새 perf-spec 추가 · 기존 perf-spec 수정 · baseline JSON 추가/갱신 (route 확대는 별도 slice).
- ADR-0056 `§Follow-ups (c)` 임계 fix 승격 — 축적 2 run 이라 `§Decision 5` 4 항에 걸린다.
- `.github/workflows/ci.yml` · `scripts/daily-test.sh` 수정 (파일 cap · T-1122 전례).
- `docs/ops/load-resilience-test-plan.md` `§ 3` · `§ 5` 본문 수정 (본 task 는 인용 측만 고친다).
- slice 25 ~ 29 의 고유 축 · 계수 · 검증 · negative 서술 본문 재작성.
- `test/perf/README.md` 의 체크인 baseline 게이트 절(`108~217 행`) 재편집 — T-1596 이 이미 현행.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups
