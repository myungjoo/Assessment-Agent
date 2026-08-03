---
id: T-1415
title: api.md 211 · 223 행 · data-model.md 168 행 REQ-004 gap pointer 동기 + audit §12.13 기록
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-004]
estimatedDiff: 45
estimatedFiles: 4
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1414]
touchesFiles:
  - docs/architecture/api.md
  - docs/architecture/data-model.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1415-arch-doc-req004-pointer-resync.md
plannerNote: "uc-doc-audit-resync 27 번째 slice — T-1414 Follow-up 1 (의존 최전방, cascade (a)~(f) 소진 후 잔여). doc-only enumerated-section × 1.6"
---

# T-1415 — `docs/architecture/api.md` 211 · 223 행 · `docs/architecture/data-model.md` 168 행 REQ-004 gap pointer 동기 + audit §12.13 기록

## Why

[T-1413](T-1413-req004-gap-to-uc-covered-reclassification.md) 이 REQ-004 을 `gap` → `uc-covered` (UC-09) 로 재분류하고 [T-1414](T-1414-cascade-ef-index-plan-count-resync.md) 가 cascade **(e) · (f)** 를 실행해 [§12.3](../use-cases/REQ-COVERAGE-AUDIT.md) 의 cascade **6 지점이 (a) ~ (f) 전건 closure** 됐다. 그러나 cascade 6 지점 **밖** 에 있는 P2 artifact 2 종 — [api.md](../architecture/api.md) **211 행** (`gap REQ-004 … UC-09 신설 또는 UC-01 확장 후 본 § 5 에 endpoint 추가 예정`) · **223 행** (`uc-covered 48 REQ 의 분류 / gap 1 (REQ-004) 추적`) 과 [data-model.md](../architecture/data-model.md) **168 행** (`gap REQ-004 … UC-09 신설 또는 UC-01 확장 후 본 § 2 표에 row 추가 예정`) — 은 여전히 **UC-09 가 없고 gap 이 1 건이던 시점의 상태** 를 현행 서술처럼 말하고 있다.

본 slice 는 T-1414 Follow-up 1 (= T-1413 Follow-up 2 = T-1412 Follow-up 3 = T-1411 Follow-up 3 의 4 회 이월분) 이자 **의존 순서상 최전방** 이다. 특히 [§12.10](../use-cases/REQ-COVERAGE-AUDIT.md) 790 행 한계 2 가 "api.md 211 행 · data-model.md 168 행 · §8 161 행 … **승계 task 를 실제로 생성하는 slice 가 한꺼번에 갱신하는 편이 경제적**" 이라고 명시 예고했고, T-1411 의 UC-09 신설로 그 승계가 실재하게 됐으므로 지금이 그 시점이다 (§8 161 행은 시점 기록이라 여전히 제외 — Follow-up 3 소관).

세 행은 모두 날짜 stamp 가 없는 **living document 의 현행 상태 서술** (`## Out of scope` 목록 · `## References` bullet) 이라 §12.3 306 행의 append-only 보존 대상이 아니다 — **in-place 갱신이 규약상 맞는 처리** 이며, 그래서 INDEX.md / PLAN.md 처럼 append 로 다루지 않는다.

[PLAN.md](../PLAN.md) 의 미완 bullet (140 ~ 142 행 P7 성능 검증 · 151 행 P8 부하·내성 · 108 · 109 행 live-LLM) 은 각각 [ADR-0054](../decisions/ADR-0054-load-resilience-harness-tool.md) PROPOSED 대기 · 새 dependency · 외부 credential 게이트라 planner 단독 진행이 불가하므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/api.md` — **198 행** (`## 8. Out of scope` heading — 211 행이 속한 절의 성격 확인용), **211 행** (갱신 대상 1: `- **gap REQ-004** (사용자 지정 기간 임의 평가문) — [REQ-COVERAGE-AUDIT.md](…) 의 gap 1 건. UC-09 신설 또는 UC-01 확장 후 본 § 5 에 endpoint 추가 예정.`), **212 행** (인접 bullet — 무편집 경계), **214 행** (`## 9. References` heading), **223 행** (갱신 대상 2: `- [docs/use-cases/REQ-COVERAGE-AUDIT.md](…) — uc-covered 48 REQ 의 분류 / gap 1 (REQ-004) 추적`), **62 · 153 행** (§5 Endpoint 표 heading + 합계 문단 — 본 slice **무편집** 임을 확인하기 위한 경계).
- `docs/architecture/data-model.md` — **154 행** (`## 7. Out of scope` heading), **168 행** (갱신 대상 3: `- **gap REQ-004** (사용자 지정 기간 임의 평가문) — [REQ-COVERAGE-AUDIT.md](…) gap. UC-09 신설 또는 UC-01 확장 후 본 § 2 표에 row 추가 예정.`), **167 · 169 행** (인접 bullet — 무편집 경계), **16 · 38 행** (§2 Entity 목록 heading + `13 entity` 합계 문단 — 본 slice **무편집** 경계).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **869 ~ 907 행** (§12.12 — 신설 절의 화법·구성 정본이며 본 slice **무편집**), **908 행** (`## 11. References` — 신규 §12.13 절의 삽입 위치 상한), **793 ~ 868 행** 중 **§12.11 판정 결론 부분** (확정 4 값 `uc-covered 49 / cross-cutting 4 / infrastructure 13 / gap 0 = 66` 의 유일한 source — **무편집**), **293 ~ 310 행** (§12.3 cascade 6 지점 표 + 각주 — 본 slice 대상 3 행이 이 표 **밖** 임을 확인, **무편집**), **786 ~ 792 행** (§12.10 한계 절 — 특히 790 행 한계 2 의 "3 지점 미정정" 예고, **무편집**).
- `docs/use-cases/UC-09-user-defined-period-evaluation.md` — **1 ~ 11 행** frontmatter (`coversReq: [REQ-004]`) + **54 행** (`## 5. Main flow` heading) — 갱신 문장이 UC-09 를 가리킬 때의 링크 대상 확인용. 본 slice **무편집** 이고 §5 sequence 내용을 endpoint 로 옮기지 않는다.
- `docs/tasks/T-1414-cascade-ef-index-plan-count-resync.md` — **98 ~ 101 행** (Follow-ups 4 건 — 본 slice 는 1 번, 나머지 3 건은 후속), **105 ~ 119 행** (완료 기록 — 확정 수치 대조용).

## Acceptance Criteria

### 1. `docs/architecture/api.md` 211 행 갱신 (in-place)

- [ ] 211 행을 **1 행 in-place 치환** — 필수 3 요소: (i) `gap REQ-004` · `gap 1 건` 표현 제거 후 **2026-08-03 (T-1413) 재분류로 `uc-covered` (UC-09) 이고 gap 0 건** 임을 명시, (ii) 그럼에도 **[UC-09](../use-cases/UC-09-user-defined-period-evaluation.md) §5 sequence 가 호명하는 endpoint 는 아직 본 §5 표에 미박제** 라 여전히 out-of-scope 이라는 잔여 의무 보존, (iii) 근거를 `REQ-COVERAGE-AUDIT.md §12.11 · §12.13` 로 위임.
- [ ] bullet 은 **1 행 유지** (여러 줄로 쪼개지 않는다) 이고 `## 8. Out of scope` 목록 안에서의 **위치 (211 행) 도 불변**.
- [ ] `UC-09 신설 또는 UC-01 확장 후 … 예정` 문구는 UC-09 실재로 전제가 충족돼 **사실이 아니게 됐으므로 남기지 않는다** — 본 행은 날짜 stamp 없는 현행 상태 서술이라 §12.3 306 행 append-only 보존 대상이 아니다 (이 판정 근거를 §12.13 에 1 줄 박제).

### 2. `docs/architecture/api.md` 223 행 갱신 (in-place)

- [ ] `## 9. References` 의 audit bullet 223 행을 **1 행 in-place 치환** — `uc-covered 48 REQ 의 분류 / gap 1 (REQ-004) 추적` → **`uc-covered 49 REQ 의 분류 / gap 0 추적`** + 전이 사실 부기 (`2026-08-03 T-1413 재분류로 REQ-004 이 UC-09 로 전이 — 48 / gap 1 은 그 이전 시점 값`).
- [ ] 링크 target (`../use-cases/REQ-COVERAGE-AUDIT.md`) · bullet 순서 · 인접 References bullet (221 · 222 · 224 행 등) **무편집**.
- [ ] 검산: `grep -c "gap 1" docs/architecture/api.md` = **0**, `grep -c "uc-covered 48" docs/architecture/api.md` = **0**.

### 3. `docs/architecture/data-model.md` 168 행 갱신 (in-place)

- [ ] 168 행을 **1 행 in-place 치환** — AC 1 과 동형 3 요소이되 잔여 의무는 **§2 Entity 표 row 추가 미완** 으로 기술 (endpoint 가 아니라 entity). UC-09 가 신규 entity 를 요구하는지 여부는 **판정하지 않고** "UC-09 §5 기준 entity 도출은 후속 slice 소관" 으로만 남긴다 (날조 0).
- [ ] bullet 1 행 유지 · `## 7. Out of scope` 안 위치 (168 행) 불변 · 인접 167 · 169 행 **무편집**.
- [ ] 검산: `grep -n "REQ-004" docs/architecture/data-model.md` 출력이 **168 행 1 건** 이고 그 행에 `gap REQ-004` **미포함**.

### 4. audit §12.13 실행 기록 절 신설

- [ ] `## 11. References` **바로 앞** (= §12.12 마지막 행 뒤) 에 `### 12.13 cascade 밖 P2 artifact 2 종 REQ-004 pointer 동기 (T-1415)` 절 추가. `###` 이므로 `grep -c "^## " docs/use-cases/REQ-COVERAGE-AUDIT.md` = **12** 불변.
- [ ] 절 구성은 §12.12 화법 승계 — (i) 서두 blockquote (본 절 소관 = cascade 6 지점 **밖** 의 잔여 pointer closure · 삽입 위치 규약 1 줄), (ii) **갱신 3 행 기록** 각 1 줄 (api.md 211 · 223, data-model.md 168 — 편집 방식이 **in-place** 인 이유 = 날짜 stamp 없는 현행 상태 서술이라 append-only 대상 아님, 을 명시), (iii) §12.10 790 행 **한계 2 의 3 지점 중 2 건 closure · §8 161 행 1 건 잔존** 을 1 줄, (iv) **불변 검산 출력 블록** (AC 5 의 명령 + 실측 출력 그대로), (v) **한계** 3 항.
- [ ] 한계 절 최소 3 항: ① UC-09 의 **endpoint / entity 실박제는 미완** — 본 slice 는 pointer 만 동기했고 api.md §5 표 72 endpoint · data-model.md §2 13 entity 합계는 무변, ② §11 References bullet 의 `8 UC backbone` · `UC-01 ~ UC-08 — 8 UC 본문` 표기와 api.md 3 · 12 · 64 행 · data-model.md 3 · 38 행의 `8 UC` 표기가 9 UC 실재와 어긋나나 **후속 slice 소관** (본 slice 무편집), ③ §1 18 행 · §8 160 ~ 161 행 · §9.4 188 행의 옛 `gap 1 건` 요약은 시점 기록이라 여전히 무편집 (§12.12 한계 1 존속).

### 5. 불변 검산 (인접 문서 무편집 증명)

- [ ] `git status --porcelain` 의 변경 파일이 정확히 **4 개** — `docs/architecture/api.md` · `docs/architecture/data-model.md` · `docs/use-cases/REQ-COVERAGE-AUDIT.md` + 본 task 파일 (driver 가 같은 commit 에 얹는 `docs/STATE.json` · journal 은 본 계산 제외).
- [ ] `docs/use-cases/INDEX.md` · `docs/PLAN.md` · `docs/requirements.md` · `docs/use-cases/UC-01-evaluation-execution.md` ~ `UC-09-user-defined-period-evaluation.md` · `CLAUDE.md` 모두 `git status --porcelain` **미등장**.
- [ ] `wc -l` 검산: `docs/architecture/api.md` = **229** 불변 · `docs/architecture/data-model.md` = **190** 불변 (셋 다 1:1 in-place 치환이라 행 수 무변).
- [ ] audit 검산: `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` = **66** 불변 · `grep -c "^## "` = **12** 불변 · §3 38 행 REQ-004 row · §4 116 행 정합식 (`34 + 15 + 4 + 13 + 0 = 66`) · §5 표 (`49 / 4 / 13 / 0`) · §12.3 표 6 row **무변**.
- [ ] `git diff --numstat` 을 완료 기록에 박제 — api.md **2 추가 / 2 삭제** · data-model.md **1 추가 / 1 삭제** · audit **삭제 0** (순수 append) 이고, 3 doc 파일 **삭제 열 합 = 3 이며 전부 in-place 치환의 짝 → 순수 삭제 0**. 합계가 [CLAUDE.md](../../CLAUDE.md) §3 상한 (≤ 300 LOC / ≤ 5 파일) 안임을 명시.

### 6. R-110 / R-112 (direct doc-only)

- [ ] 본 task 는 `commitMode: direct` + production code **0 LOC** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 "direct-mode doc-only commit 만 본 규칙 면제" 조항으로 R-110 tester 호출 · R-112 4 항목 (happy / error / branch / negative) · `pnpm test:cov` 가 전부 **N/A** (분기 없음). 이 사실을 완료 기록에 1 줄 명시.

## Out of Scope

- **`docs/architecture/api.md` §5 Endpoint 표에 UC-09 endpoint row 실제 추가** — UC-09 §5 sequence 해독 + 153 행 합계 (72 endpoint / 16 prefix) 재집계 + §7 UC ↔ endpoint cross-reference 갱신이 동반돼야 하는 별도 판정이라 본 slice 밖. 본 slice 는 **pointer 문장만** 동기한다.
- **`docs/architecture/data-model.md` §2 Entity 표 row 추가 / 38 행 `13 entity` 합계 변경** — 위와 같은 이유로 별도 slice. UC-09 가 신규 entity 를 요구하는지 여부 자체를 본 slice 는 **판정하지 않는다**.
- **api.md 3 · 12 · 64 · 207 · 208 행 · data-model.md 3 · 38 · 167 행 의 `8 UC` 표기 갱신** — 9 UC 실재와 어긋나지만 REQ-004 pointer 와 별개 축이고 문서 전반에 걸친 일괄 판정이 선행돼야 해 Follow-up 소관.
- **audit §11 References bullet 의 `8 UC backbone` · `UC-01 ~ UC-08 — 8 UC 본문` 표기 갱신** — T-1414 Follow-up 2 이월, 별도 slice.
- **audit §1 18 행 · §6 · §8 160 ~ 161 행 · §9 · §10 · §12.1 ~ §12.12 본문 편집 일체** — 각 시점의 요약·판정 서술은 append-only 보존 대상. 옛 행 번호 표기 (`115 행` · `121 ~ 127 행` · `L212` · `104 행`) 도 시점 기록이라 정정하지 않는다.
- **audit §12.3 cascade 6 지점 표 · 각주 편집** — 본 slice 의 3 행은 cascade 6 지점 **밖** 이므로 표에 row 를 추가하거나 셀을 고치지 않는다 (6 지점은 T-1414 로 전건 closure 확정).
- **`docs/use-cases/INDEX.md` · `docs/PLAN.md` · `docs/requirements.md` · UC 본문 편집 일체** · **재판정 후보 17 row 또는 다른 `uc-covered` row 의 분류 재검토** · `src/` · `web/` · `test/` · CI · package.json 등 코드 계열 변경 일체.

## Suggested Sub-agents

`implementer` (신규 ADR 불요 — 확정 4 값은 §12.11, cascade 경계는 §12.3 · §12.12, "3 지점 중 2 건" 예고는 §12.10 790 행이 이미 확정. direct doc-only 라 tester 호출 면제 — §3.2. implementer 가 api.md 211 · 223 행 치환 → data-model.md 168 행 치환 → §12.13 절 작성 → AC 5 불변 검산 명령 실행까지 담당)

## Follow-ups

1. **UC-09 §5 sequence → api.md §5 Endpoint 표 row 실박제** — 본 slice 가 잔여 의무로 남긴 지점. 153 행 합계 (72 endpoint / 16 prefix) 재집계 + §7 cross-reference 갱신이 동반되므로 별도 slice 로 크기 산정 필요.
2. **UC-09 §5 기준 data-model.md §2 entity 도출 판정** — 신규 entity 가 필요한지 (기존 Assessment / AssessmentPeriod 로 충분한지) 를 먼저 판정하고, 필요 시 §2 표 row + 38 행 합계 갱신.
3. **audit §8 161 · 162 행 · §1 18 행의 `gap 1 건` 결론 문장 처리 방침 확정** — T-1413 Follow-up 4 · T-1414 Follow-up 4 이월. §12.10 790 행 한계 2 의 3 지점 중 본 slice 후 **유일하게 남는 1 건**.
4. **audit §11 References bullet + api.md / data-model.md 의 `8 UC` 표기 일괄 갱신** — T-1414 Follow-up 2 이월 + 본 slice 한계 ②. 시점 기록인지 현행 index 서술인지의 판정이 선행.
5. **audit 198 행 `INDEX.md 104 행` 표기 최신성 점검** — T-1412 Follow-up 4 · T-1413 Follow-up 3 · T-1414 Follow-up 3 이월.
