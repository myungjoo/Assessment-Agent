---
id: T-1585
title: 체크인 baseline 기제의 CI 편입 현황을 PLAN 142 행 · REQ-048 행에 doc-sync
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-08-17
createdAt: 2026-08-17T18:40:28Z
independentStream: perf-baseline-checkin
dependsOn: [T-1584]
touchesFiles:
  - docs/PLAN.md
  - docs/requirements.md
plannerNote: "P5 성능 검증 — ADR-0056 §Follow-ups (d) 집행: (b) ci.yml 토글 on 완료 사실을 PLAN·REQ-048 에 반영, 완료 표기는 금지"
---

# T-1585 — 체크인 baseline 기제의 CI 편입 현황을 PLAN 142 행 · REQ-048 행에 doc-sync

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Follow-ups (d)` 는 (a) ~ (c)
진행 상황을 PLAN `142 행` 과 요구사항 매핑 표에 반영하라고 지시한다. 그 중 **(b) `ci.yml`
편입은 T-1584 (PR #1265, main `e7b0a377`) 로 실제 완료**됐고 판정·배선 primitive 도
T-1559 ~ T-1583 으로 안착했는데, 현재 `docs/PLAN.md` 와 `docs/requirements.md` 에는
`ADR-0056` · `체크인 baseline` · `PERF_CHECKIN_BASELINE` 문자열이 **0 회** 등장한다
(`grep -c` 실측). 즉 실측 사실과 계획 문서 사이에 드리프트가 있다.

본 task 는 그 드리프트만 메운다 — PLAN `140 행` 성능 검증 bullet 의 체크박스와 REQ-048 의
status 토큰은 **그대로 둔다**. ADR `§Follow-ups (d)` 가 "본 ADR 만으로는 어떤 완료 표기도
하지 않는다" 고 못 박았고, 체크인 baseline JSON 이 아직 없어 CI 의 비교 경로는
`skip`/`absent` 로만 도는 상태(회귀 비교 실행 0 회)이기 때문이다.

## Required Reading

- `docs/decisions/ADR-0056-perf-baseline-checkin-ci.md` — `§Decision 3` (절대 임계만 fail /
  상대 회귀는 관찰·exit code 불변) · `§Decision 4` (기존 `perf test` step 재사용) ·
  `§Follow-ups (a) ~ (d)` (특히 (d) 의 "완료 표기 금지" 문장).
- `docs/tasks/T-1584-ci-perf-checkin-baseline-toggle.md` `§Result` — 반영할 사실의 정본
  (PR #1265 · 머지 `e7b0a377` · `env: PERF_CHECKIN_BASELINE: "1"` · smoke 13 test ·
  토글 on/off 실행 수치 동일로 ambient 누출 0).
- `docs/PLAN.md` `142 행` — 편집 대상 1. `조회·시각화 3초 이내 (R-92)` 항목의 단일 긴 행.
  말미가 `T-1552 · T-1554 · T-1556` 링크 나열로 끝나며, 본 task 는 **그 뒤에 문장을 이어
  붙인다** (기존 문장·계수 수정 0).
- `docs/requirements.md` `67 행` — 편집 대상 2. `| REQ-048 | 92 | 조회·시각화 3초 이내 | NFR |
  P6 + P7 | perf test | IN_PROGRESS (...) |` 표 row. 말미 괄호 안 서술의 끝
  (`... 잔여 불확실로 남는다`) 뒤에 문장을 이어 붙인다.
- `docs/tasks/T-1556-perf-realdb-slice28-doc-sync.md` 또는
  `docs/tasks/T-1558-perf-realdb-slice29-doc-sync.md` — 같은 두 문서를 갱신한 **direct
  doc-sync 선례**. 문장 톤 · 링크 표기 · 사실 인용 방식의 정본.

## Acceptance Criteria

- [ ] `docs/PLAN.md` `142 행` 말미에 체크인 baseline 기제의 CI 편입 현황을 2 ~ 4 문장으로
      추가한다. 반드시 포함할 사실 4 개: (a) 기제의 근거 문서가
      [ADR-0056](decisions/ADR-0056-perf-baseline-checkin-ci.md) 이라는 점, (b)
      `.github/workflows/ci.yml` 의 기존 `perf test` step 에 `PERF_CHECKIN_BASELINE: "1"` 이
      실려 토글이 켜졌다는 점([T-1584](tasks/T-1584-ci-perf-checkin-baseline-toggle.md),
      main `e7b0a377`), (c) 상대 회귀는 **관찰만** 하고 exit code 를 바꾸지 않는다는 점
      (`§Decision 3 (b)`), (d) 체크인 baseline JSON 이 아직 없어 현재 CI 경로는
      `skip`/`absent` 이며 **회귀 비교 실행 횟수는 0** 이라는 점.
      검증: `grep -c "ADR-0056" docs/PLAN.md` 가 1 이상.
- [ ] `docs/requirements.md` `67 행` (REQ-048 row) 의 status 서술 말미에 같은 사실을
      1 ~ 3 문장으로 추가한다. **status 토큰 `IN_PROGRESS` 는 불변** 이고, "실 scale 부하 하의
      3 초 충족 미검증" · "시각화(web) 렌더 측정 축 부재" 등 기존 미충족 서술은 삭제하지 않는다.
      검증: `grep -c "ADR-0056" docs/requirements.md` 가 1 이상 이고,
      `grep -c "IN_PROGRESS" docs/requirements.md` 값이 편집 전과 동일.
- [ ] PLAN `140 행` 성능 검증 bullet 의 `- [ ]` 체크박스는 **체크하지 않는다**. REQ-048 row 의
      status 토큰도 승격하지 않는다 (ADR-0056 `§Follow-ups (d)` 의 완료 표기 금지).
      검증: `git diff docs/PLAN.md | grep -c "^\+- \[x\]"` 가 0.
- [ ] 표 구조 불변 — `docs/requirements.md` 67 행의 `|` 개수가 편집 전과 동일하고, 추가
      문장 안에 `|` 문자를 넣지 않는다 (표 셀 분할 사고 방지).
      검증: 편집 전후 `awk -F'|' 'NR==67{print NF}' docs/requirements.md` 값 일치.
- [ ] 추가한 markdown 링크의 대상 파일이 실제로 존재한다 (`docs/` 기준 상대 경로 —
      PLAN·requirements 둘 다 `docs/` 안에 있으므로 `decisions/ADR-0056-...` ·
      `tasks/T-1584-...` 형태). 검증: 추가된 링크 경로마다 `test -f docs/<path>` 성공.
- [ ] 행 좌표 표기가 CLAUDE.md `§12` 규약을 따른다 — 구분자는 물결 `~` 하나, 단일 행은
      `142 행` 형태, `L` prefix 금지.
- [ ] 변경 파일이 정확히 2 개이고 두 파일 모두 **각 1 행만** 변경된다 (긴 단일 행 이어붙이기).
      검증: `git diff --stat` 이 `docs/PLAN.md` · `docs/requirements.md` 만 표시.
- [ ] 코드 변경 0 — `git diff --name-only` 에 `src/` · `test/` · `.github/` 경로가 없다.
      (direct doc-only commit 이므로 CLAUDE.md `§3.2` R-110 의 tester 의무 면제 대상이며,
      R-112 4 항목은 코드 변경이 없어 적용 대상 자체가 없다.)

## Out of Scope

- ADR-0056 `§Follow-ups (a)` — `test/perf/baselines/` 아래 체크인 baseline JSON 최초 생성·commit.
  `§Consequences (d)` 가 값 타당성의 사람 눈 확인을 전제하므로 자율 fire 에서 완결 불가.
- ADR-0056 `§Follow-ups (c)` — `docs/ops/load-resilience-test-plan.md` `§ 3` 임계 fix 승격.
  표본 축적이 전제인 별도 slice 이며 본 task 는 그 파일을 건드리지 않는다.
- `test/perf/README.md` 갱신 — `test/` 경로라 CLAUDE.md `§3.1` 상 `pr` mode 대상. direct
  commit 에 섞지 않는다 (별도 task).
- PLAN 체크박스 체크 · REQ-048 status 승격 · 임계 수치(3000ms) 변경 · perf-spec 계수
  (perf-spec 63 / read 51 / 실 DB 29 등) 재계산.
- `src/` · `test/` · `.github/workflows/` · `package.json` 등 코드/워크플로 변경 일체.
- 기존 문장의 대량 재작성 · 과거 slice 서술 정리 · 긴 행 분할 리팩터 (drift 유발 없이
  **이어붙이기만** 한다).

## Suggested Sub-agents

`implementer` (doc 편집 전용 — 코드 변경 0 이라 architect · tester 불요)

## Follow-ups

- (작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
