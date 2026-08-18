---
id: T-1608
title: 체크인 baseline JSON 5 route 확정 사실을 PLAN 142 행 · REQ-048 행에 doc-sync
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 90
estimatedFiles: 2
created: 2026-08-18
createdAt: 2026-08-18T23:55:16Z
independentStream: perf-baseline-checkin
dependsOn: [T-1585, T-1607]
touchesFiles:
  - docs/PLAN.md
  - docs/requirements.md
plannerNote: "P5 성능 검증 — ADR-0056 §Follow-ups (d) 집행: (a) 축 5 route 완결을 PLAN·REQ-048 에 반영, 완료 표기는 금지"
---

# T-1608 — 체크인 baseline JSON 5 route 확정 사실을 PLAN 142 행 · REQ-048 행에 doc-sync

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Follow-ups (d)` 는 (a) ~ (c) 의
진행 상황을 PLAN `142 행` 과 요구사항 매핑 표에 반영하라고 지시한다. 직전 T-1585 가 (b) `ci.yml`
토글 편입 사실을 두 문서에 박았을 당시에는 **체크인 baseline JSON 이 0 개** 였으므로, 두 문서 모두
"`test/perf/baselines/` 아래 체크인 baseline JSON 이 아직 없어 … 현재 CI 경로는 `skip`/`absent`
로만 돌고 **회귀 비교 실행 횟수는 0**" 이라고 적혀 있다.

그 서술은 이제 사실과 어긋난다 — T-1592 ~ T-1607 로 **`measure→confirm` 5 route 전부** 의 체크인
baseline 이 저장소에 확정됐고(`ls test/perf/baselines/` 5 파일), CI 의 체크인 경로는 `absent` 가
아니라 `compared` 로 돈다. 본 task 는 그 드리프트만 메운다. `§Follow-ups (c)` 임계 fix 는 여전히
미완이고 실 scale 부하(REQ-047) · 시각화(web) 렌더 측정 축도 부재하므로, PLAN `140 행` 체크박스와
REQ-048 status 토큰은 **그대로 둔다** (`§Follow-ups (d)` 의 "본 ADR 만으로는 어떤 완료 표기도 하지
않는다").

반영할 사실 (정본 — 각 task 의 `## 결과` 절과 머지 commit):

| label | 확정 task | PR | main |
| --- | --- | --- | --- |
| `ci-realdb-person-read` | T-1592 (최초) → T-1594 (20 표본 refresh) | #1272 → #1274 | `e9817f4f` → `47a9850f` |
| `ci-realdb-assessment-read` | T-1601 | #1281 | `2f8b8a2f` |
| `ci-realdb-contribution-read` | T-1603 | #1283 | `8995d3c9` |
| `ci-realdb-summary-read` | T-1605 | #1285 | `f6bd543a` |
| `ci-realdb-app-root-read` | T-1607 | #1287 | `9b22909f` |

## Required Reading

- `docs/decisions/ADR-0056-perf-baseline-checkin-ci.md` — `§Decision 2`(갱신 주체는 pr-mode task
  뿐 · write 경로 부재) · `§Decision 3 (b)`(상대 회귀는 관찰만 · exit code 불변) ·
  `§Follow-ups (a)`(본 task 가 "완결" 로 적을 축) · `§Follow-ups (c)`(아직 미완인 축) ·
  `§Follow-ups (d)`(완료 표기 금지 문장).
- `docs/tasks/T-1585-checkin-baseline-ci-doc-sync.md` — 같은 두 행을 갱신한 **직전 선례**.
  본 task 가 정정할 문장(말미의 "JSON 이 아직 없어 … 회귀 비교 실행 횟수는 0")이 그때 박힌
  것이므로, 문장 톤 · 링크 표기 · 사실 인용 방식의 정본으로 삼는다.
- `docs/tasks/T-1607-checkin-baseline-fifth-route-json.md` `## 결과` — 다섯 번째이자 **마지막**
  route 완결의 정본(전사 수치 · 가드 표 5 행 · 표 크기 하한 `4 → 5`).
- `docs/PLAN.md` `142 행` — 편집 대상 1. `조회·시각화 3초 이내 (R-92)` 항목의 단일 긴 행.
  말미 문장 `그리고 test/perf/baselines/ 아래 체크인 baseline JSON 이 아직 없어(ADR-0056
  §Follow-ups (a) 미착수) 현재 CI 경로는 skip/absent 로만 돌고 회귀 비교 실행 횟수는 0 이므로,
  본 축의 완료 표기는 하지 않고 140 행 checkbox [ ] 도 그대로 유지한다.` 가 정정 대상이다.
- `docs/requirements.md` `67 행` — 편집 대상 2. REQ-048 표 row 의 말미 서술 중
  `체크인 baseline JSON 이 아직 없어 현재 CI 경로는 skip/absent 로만 돌아 회귀 비교 실행
  횟수는 0 이다 — 따라서 본 row 의 status 토큰은 승격하지 않는다` 가 정정 대상이다.

## Acceptance Criteria

- [ ] `docs/PLAN.md` `142 행` 말미의 "체크인 baseline JSON 이 아직 없어 … 회귀 비교 실행 횟수는
      0" 문장을 **현행화**한다. 반드시 포함할 사실 4 개: (a) `test/perf/baselines/` 아래 체크인
      baseline JSON 이 `measure→confirm` **5 route 전부**(`ci-realdb-person-read` ·
      `-assessment-read` · `-contribution-read` · `-summary-read` · `-app-root-read`) 로
      확정됐다는 점, (b) 확정 task 와 머지 좌표(위 Why 표의 T-1592/T-1594 · T-1601 · T-1603 ·
      T-1605 · T-1607), (c) 그 결과 CI 의 체크인 경로가 `absent`(skip) 이 아니라 `compared` 로
      돈다는 점, (d) 그럼에도 상대 회귀는 **관찰만** 이고 exit code 는 불변이며
      `§Follow-ups (c)` 임계 fix 는 미완이라 **완료 표기는 하지 않는다** 는 점.
      검증: `grep -c "baseline-ci-realdb-app-root-read\|app-root-read" docs/PLAN.md` 가 1 이상이고,
      `grep -c "체크인 baseline JSON 이 아직 없어" docs/PLAN.md` 가 **0**.
- [ ] `docs/requirements.md` `67 행` (REQ-048 row) 의 같은 취지 문장도 현행화한다. **status 토큰
      `IN_PROGRESS` 는 불변** 이고, "실 scale 부하(REQ-047) 하의 3 초 충족 미검증" · "시각화(web)
      렌더 측정 축 부재" · "임계 fix 미완" 등 기존 미충족 서술은 삭제하지 않는다.
      검증: `grep -c "체크인 baseline JSON 이 아직 없어" docs/requirements.md` 가 **0** 이고,
      `awk -F'|' 'NR==67{print $8}' docs/requirements.md | grep -c IN_PROGRESS` 가 1.
- [ ] PLAN `140 행` 성능 검증 bullet 의 `- [ ]` 체크박스는 **체크하지 않는다**. REQ-048 row 의
      status 토큰도 승격하지 않는다 (ADR-0056 `§Follow-ups (d)` 완료 표기 금지).
      검증: `git diff docs/PLAN.md | grep -c "^\+- \[x\]"` 가 0.
- [ ] 표 구조 불변 — `docs/requirements.md` 67 행의 `|` 개수가 편집 전과 동일하고, 추가·수정
      문장 안에 `|` 문자를 넣지 않는다 (표 셀 분할 사고 방지).
      검증: 편집 전후 `awk -F'|' 'NR==67{print NF}' docs/requirements.md` 값 일치.
- [ ] 인용한 사실이 실재와 일치한다 — `ls test/perf/baselines/` 결과가 정확히 5 파일이고 본문에
      적은 label 5 개와 1:1 대응한다. 검증: `ls test/perf/baselines | wc -l` 이 5.
- [ ] 추가한 markdown 링크의 대상 파일이 실제로 존재한다 (`docs/` 기준 상대 경로 —
      `tasks/T-1607-checkin-baseline-fifth-route-json.md` 형태). 검증: 추가된 링크 경로마다
      `test -f docs/<path>` 성공.
- [ ] 행 좌표 표기가 CLAUDE.md `§12` 규약을 따른다 — 구분자는 물결 `~` 하나, 단일 행은
      `142 행` 형태, `L` prefix 금지.
- [ ] 변경 파일이 정확히 2 개이고 두 파일 모두 **각 1 행만** 변경된다 (긴 단일 행 인라인 수정).
      검증: `git diff --stat` 이 `docs/PLAN.md` · `docs/requirements.md` 만 표시하고 각각 `1 +-`.
- [ ] 코드 변경 0 — `git diff --name-only` 에 `src/` · `test/` · `.github/` 경로가 없다.
      **R-112 4 항목(happy-path / error path / 분기 / negative cases 충분 cover) 은 코드 변경이
      0 이라 적용 대상 자체가 없다** — 새 public symbol · 분기 · 예외 경로가 생기지 않으므로 본
      task 는 spec 을 추가하지 않는다. 같은 이유로 CLAUDE.md `§3.2` R-110 의 tester 의무도
      direct doc-only commit 면제 대상이다 (T-1585 선례와 동형).

## Out of Scope

- ADR-0056 `§Follow-ups (c)` — `docs/ops/load-resilience-test-plan.md` `§ 3` 임계 fix 승격.
  축적 run 이 20 미만이라 전제 미충족이며 본 task 는 그 파일을 건드리지 않는다.
- `docs/ops/load-resilience-test-plan.md` `§ 5` item 5 의 "baseline 확정 미착수" 서술 정정 —
  같은 성격의 드리프트지만 그 파일 안에 산재한 slice 별 과거 서술(526 · 547 · 567 · 618 · 663 ·
  861 ~ 862 행)과의 경계 판정이 필요해 별도 slice 로 뗀다 (아래 Follow-ups).
- `test/perf/README.md` 갱신 — `test/` 경로라 CLAUDE.md `§3.1` 상 `pr` mode 대상. direct commit
  에 섞지 않는다.
- PLAN 체크박스 체크 · REQ-048 status 승격 · 임계 수치(3000ms) 변경 · perf-spec 계수
  (perf-spec 63 / read 51 / 실 DB 29 등) 재계산.
- 새 baseline JSON 추가 · 기존 baseline 수치 재계산 · 가드 spec 변경 등 `test/` 일체.
- `src/` · `.github/workflows/` · `package.json` 등 코드/워크플로 변경 일체.
- 기존 문장의 대량 재작성 · 과거 slice 서술 정리 · 긴 행 분할 리팩터 (**해당 문장만** 인라인
  수정한다).

## Suggested Sub-agents

`implementer` (doc 편집 전용 — 코드 변경 0 이라 architect · tester 불요)

## Follow-ups

- (작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
