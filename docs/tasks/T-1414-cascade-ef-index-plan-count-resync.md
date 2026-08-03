---
id: T-1414
title: cascade (e) INDEX.md 118 행 · (f) PLAN.md 36 행 수치 동기 + §12.3 표 (e) · (f) row 치환
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-004]
estimatedDiff: 90
estimatedFiles: 4
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1413]
touchesFiles:
  - docs/use-cases/INDEX.md
  - docs/PLAN.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1414-cascade-ef-index-plan-count-resync.md
plannerNote: "uc-doc-audit-resync 26 번째 slice — T-1413 Follow-up 1 (의존 최전방, §12.4 분리 허용 잔여분). doc-only enumerated-section × 1.6"
---

# T-1414 — cascade (e) `docs/use-cases/INDEX.md` 118 행 · (f) `docs/PLAN.md` 36 행 수치 동기 + §12.3 표 (e) · (f) row 치환

## Why

[T-1413](T-1413-req004-gap-to-uc-covered-reclassification.md) 이 [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) §3 38 행 REQ-004 row 를 `gap` → `uc-covered` 로 재분류하고 cascade **(a) ~ (d)** 를 원자 실행해 audit 문서 내부 수치를 `uc-covered 49 / cross-cutting 4 / infrastructure 13 / gap 0 = 66` 으로 확정했다. 그러나 [§12.4](../use-cases/REQ-COVERAGE-AUDIT.md) 가 **분리 허용** 으로 남긴 **(e) INDEX.md 118 행** · **(f) PLAN.md 36 행** 두 외부 요약 지점은 아직 옛 4 값 (`uc-covered 48 / … / gap 1`) 을 노출하고 있다. 본 slice 가 그 lag 을 닫는다 — T-1413 Follow-up 1 이자 **의존 순서상 최전방**.

동시에 [§12.3](../use-cases/REQ-COVERAGE-AUDIT.md) 표의 **(e) · (f) row `현재 값` 열** 도 함께 치환해야 한다. T-1413 은 두 row 를 의도적으로 무편집으로 남겼는데 (당시에는 옛 수치가 **실제** 였으므로), 본 slice 가 두 파일을 갱신하는 순간 그 셀이 stale 로 전환되기 때문이다 — 같은 slice 안에서 닫지 않으면 audit 문서가 자기 cascade 표에 대해 거짓을 말하게 된다.

[PLAN.md](../PLAN.md) 의 미완 bullet (140 ~ 142 행 P7 성능 검증 · 151 행 P8 부하·내성 · 108 · 109 행 live-LLM) 은 각각 [ADR-0054](../decisions/ADR-0054-load-resilience-harness-tool.md) PROPOSED 대기 · 새 dependency · 외부 credential 게이트라 planner 단독 진행이 불가하므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/use-cases/INDEX.md` — **118 ~ 120 행** (closure 문단 3 줄: 118 행 원 출처 2026-05-25 서술 + 4 값 + gap 서술, 119 행 `2026-08-02 재판정:` 줄, 120 행 `2026-08-03 재판정:` 줄 — 본 slice 가 승계할 **append-only 화법의 정본**), **122 행** (`Refs:` 줄 — 삽입 위치의 하한).
- `docs/PLAN.md` — **36 행** (Phase P2 셋째 bullet 1 줄. `… gap 1 건 (REQ-004 …)` bold 구간 + `uc-covered 48 / cross-cutting 4 / infrastructure 13 / gap 1 = 66.` 문장 + `2026-08-03 재판정: …` 문장이 **한 줄 안에** 이어 붙은 구조 — 본 slice 도 같은 줄 끝에 문장 1 개를 append).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **296 ~ 306 행** (§12.3 cascade 6 지점 표 — (e) · (f) row 의 `현재 값` 열이 본 slice 의 치환 대상, (a) ~ (d) row 는 T-1413 이 이미 동기 완료), **307 ~ 310 행** (표 아래 규약 문단 + T-1412 · T-1413 각주 2 줄 — 본 slice 각주의 화법 source), **312 ~ 317 행** (§12.4 순서 · 원자 묶음 · **분리 허용** · 5 파일 cap 규약), **793 ~ 867 행** (§12.11 — T-1413 실판정 절. 확정 4 값 · 판정 근거의 유일한 source 이며 본 slice 는 **무편집**), **868 행** (`## 11. References` — 신규 §12.12 절의 삽입 위치 상한), **869 ~ 878 행** (References bullet — 본 slice **무편집**, Follow-up 소관).
- `docs/tasks/T-1413-req004-gap-to-uc-covered-reclassification.md` — **112 ~ 115 행** (Follow-ups 4 건 — 본 slice 는 1 번, 나머지 3 건은 후속), **119 ~ 129 행** (완료 기록 — 확정 수치 대조용).

## Acceptance Criteria

### 1. cascade (e) — `docs/use-cases/INDEX.md` closure 문단 (append-only)

- [ ] **118 행 원문은 무편집** — `원 출처 2026-05-25` 로 시점이 명시된 서술이라 §12.3 표 아래 규약 (`이전 요약 문장은 append-only 규약상 각 시점 판정을 그대로 보존하고 이후 상태는 새 bullet 이 가리킨다`) 대상이다. `uc-covered 48` · `gap 1 (REQ-004 …)` 문자열을 지우거나 덮어쓰지 않는다.
- [ ] **120 행 다음에 새 줄 1 개 append** — 119 · 120 행의 `2026-08-0N 재판정: …` 화법을 승계하되 본 건은 분류 변경이므로 `2026-08-03 재분류:` 로 시작. 내용 필수 3 요소: (i) [T-1411](T-1411-uc-09-user-defined-period-evaluation.md) UC-09 신설 + [T-1412](T-1412-index-uc09-row-registration.md) INDEX 등록 + [T-1413](T-1413-req004-gap-to-uc-covered-reclassification.md) 재분류의 chain, (ii) **위 4 값이 `uc-covered 49 / cross-cutting 4 / infrastructure 13 / gap 0 = 66` 으로 갱신** 됐다는 명시, (iii) 근거를 `REQ-COVERAGE-AUDIT.md §12.11 · §12.12` 로 위임 (119 · 120 행이 `§9` · `§12.9` 로 위임한 것과 동형).
- [ ] `wc -l docs/use-cases/INDEX.md` = **123** (편집 전 122 + append 1 줄). `Refs:` 줄은 문단 아래에 그대로 유지 — 새 줄은 120 행과 그 다음 blank line **사이** 에 넣는다.
- [ ] §2 UC 표 (38 ~ 39 행 UC-09 row 포함) · §3 description · 그 외 INDEX.md 본문 일체 **무편집** — `git diff docs/use-cases/INDEX.md` 의 hunk 가 **1 개** 이고 삭제 열 **0** 임을 확인 (`git diff -U0 docs/use-cases/INDEX.md | grep -c '^-[^-]'` = 0).

### 2. cascade (f) — `docs/PLAN.md` 36 행 (같은 줄 끝 append)

- [ ] 36 행 **줄 끝에 문장 1 개 append** — `2026-08-03 재분류 (T-1413): REQ-004 는 UC-09 신설로 gap → uc-covered 전이해 위 4 값이 uc-covered 49 / cross-cutting 4 / infrastructure 13 / gap 0 = 66 으로 갱신 — 근거는 [REQ-COVERAGE-AUDIT.md](use-cases/REQ-COVERAGE-AUDIT.md) §12.11 참조.` 형태. 기존 `2026-08-03 재판정: …` 문장 바로 뒤에 이어 붙인다.
- [ ] **줄 안의 기존 문자열은 한 글자도 지우지 않는다** — bold 구간의 `gap 1 건 (REQ-004 사용자 지정 기간 임의 평가문, UC-09 신설 또는 UC-01 확장 권장 …)` 과 `uc-covered 48 / … / gap 1 = 66.` 은 T-0029 시점 기록이라 보존 (§12.3 표 아래 규약 그대로).
- [ ] `wc -l docs/PLAN.md` = **175** 불변 (한 줄 안의 in-place 확장이라 행 수 무변). `git diff --numstat docs/PLAN.md` = **1 추가 / 1 삭제**.
- [ ] PLAN.md 의 다른 bullet · phase heading · checkbox 상태 (`[x]` / `[ ]`) 일체 **무편집** — 특히 34 ~ 35 행 · 37 ~ 40 행.

### 3. §12.3 표 (e) · (f) row `현재 값` 열 치환 + 행 pointer 동기

- [ ] (e) row — `지점` 열 `docs/use-cases/INDEX.md` 118 행 → **`118 ~ 121 행`** (append 후 실측값으로 기재; 편집 후 `grep -n "REQ ↔ UC coverage audit closure" docs/use-cases/INDEX.md` 및 새 줄 번호로 재확인), `현재 값` 열 `uc-covered 48 / cross-cutting 4 / infrastructure 13 / gap 1` → **`uc-covered 49 / cross-cutting 4 / infrastructure 13 / gap 0 (118 행 원 출처 4 값 48 / 4 / 13 / 1 은 시점 기록으로 보존)`**.
- [ ] (f) row — `현재 값` 열 `uc-covered 48 / cross-cutting 4 / infrastructure 13 / gap 1 = 66` + gap 1 건 서술 → **`uc-covered 49 / cross-cutting 4 / infrastructure 13 / gap 0 = 66 (36 행 앞부분의 옛 4 값 + gap 1 건 서술은 시점 기록으로 보존)`**. `지점` 열 `docs/PLAN.md` 36 행 은 **무변** (행 수 불변).
- [ ] **(a) ~ (d) row 는 무편집** — T-1413 이 이미 동기 완료했고 본 slice 는 audit 문서 안의 수치를 건드리지 않는다.
- [ ] 표 구조 검산: (e) · (f) row 의 `|` 필드 수가 헤더 · 인접 행과 동일 (**4 컬럼**), §12.3 표 row 수 **6 + 헤더 2** 불변.

### 4. §12.3 각주 1 줄 append

- [ ] T-1413 각주 (§12.3 표 아래 규약 문단 다음) **바로 다음 줄** 에 각주 1 줄 append, blank line 없이 이어 붙임 (T-1412 → T-1413 각주 연쇄 화법 승계) — `2026-08-03 (T-1414): §12.4 가 분리 허용으로 남긴 cascade (e) · (f) 를 실행해 INDEX.md 118 ~ 121 행 · PLAN.md 36 행에 현 시점 4 값을 append 했고, 위 표의 (e) · (f) `현재 값` 열을 그 결과로 치환했다. 두 파일의 옛 4 값 문장은 append-only 규약대로 무편집 보존 — 근거 §12.12.` 형태.

### 5. §12.12 cascade (e) · (f) 실행 기록 절 신설

- [ ] `## 11. References` **바로 앞** (= §12.11 마지막 행 뒤) 에 `### 12.12 cascade (e) · (f) 외부 요약 2 곳 수치 동기 (T-1414)` 절 추가. `###` 이므로 `grep -c "^## " docs/use-cases/REQ-COVERAGE-AUDIT.md` = **12** 불변.
- [ ] 절 구성은 §12.11 화법 승계 — (i) 서두 blockquote (본 절 소관 = §12.4 분리 허용 잔여분 closure · 삽입 위치 규약 1 줄), (ii) **cascade (e) · (f) 실행 기록** 각 1 ~ 2 줄 (편집 방식이 in-place 치환이 아니라 **append** 임을 명시), (iii) **§12.3 표 (e) · (f) 셀 치환 기록** 1 줄, (iv) **불변 검산 출력 블록** (AC 6 의 명령 + 실측 출력 그대로 박제), (v) **한계** 3 항 이내.
- [ ] 한계 절에 최소 3 항: ① §12.4 cascade 6 지점이 본 slice 로 **(a) ~ (f) 전건 closure** 됐다는 사실과, 그럼에도 §1 18 행 · §8 160 ~ 161 행 · §9.4 188 행 의 옛 `gap 1 건` 요약은 시점 기록이라 **여전히 무편집** 이라는 사실, ② References bullet 의 `8 UC backbone` · `UC-01 ~ UC-08 — 8 UC 본문` 표기가 UC-09 실재로 stale 이나 cascade 6 지점 밖이라 **후속 slice 소관**, ③ 재판정 후보 밖 49 row 는 여전히 미재판정 (§12.9 한계 4 존속).

### 6. 불변 검산 (인접 문서 무편집 증명)

- [ ] `git status --porcelain` 의 변경 파일이 정확히 **4 개** — `docs/use-cases/INDEX.md` · `docs/PLAN.md` · `docs/use-cases/REQ-COVERAGE-AUDIT.md` + 본 task 파일 (driver 가 같은 commit 에 얹는 `docs/STATE.json` · journal 은 본 계산 제외).
- [ ] `docs/requirements.md` · `docs/use-cases/UC-01-evaluation-execution.md` ~ `UC-09-user-defined-period-evaluation.md` · `docs/architecture/api.md` · `docs/architecture/data-model.md` · `CLAUDE.md` 모두 `git status --porcelain` **미등장**.
- [ ] `wc -l` 검산: `docs/use-cases/INDEX.md` = **123** · `docs/PLAN.md` = **175** (불변).
- [ ] audit 문서 검산: `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` = **66** 불변 · `grep -c "^## "` = **12** 불변 · §3 38 행 REQ-004 row 와 §4 · §5 수치 (`34 + 15 + 4 + 13 + 0 = 66` · `49 / 4 / 13 / 0`) **무변**.
- [ ] `git diff --numstat` 합계를 완료 기록에 박제하고 [CLAUDE.md](../../CLAUDE.md) §3 상한 (≤ 300 LOC / ≤ 5 파일) 안임을 명시. 3 doc 파일의 **삭제 열 합 ≤ 4** (PLAN 1 + audit §12.3 2 ~ 3 — 모두 in-place 치환의 짝, 순수 삭제 0) 임을 확인.

### 7. R-110 / R-112 (direct doc-only)

- [ ] 본 task 는 `commitMode: direct` + production code **0 LOC** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 "direct-mode doc-only commit 만 본 규칙 면제" 조항으로 R-110 tester 호출 · R-112 4 항목 (happy / error / branch / negative) · `pnpm test:cov` 가 전부 **N/A** (분기 없음). 이 사실을 완료 기록에 1 줄 명시.

## Out of Scope

- **`docs/architecture/api.md` 211 행 · `docs/architecture/data-model.md` 168 행 의 "UC-09 신설 또는 UC-01 확장 후 추가 예정" pointer 동기** — T-1411 Follow-up 3 · T-1412 Follow-up 3 · T-1413 Follow-up 2 이월분, 별도 slice.
- **audit §11 References bullet 의 `8 UC backbone` · `UC-01 ~ UC-08 — 8 UC 본문` 표기 갱신** — cascade 6 지점 밖이라 본 slice 소관이 아니다. Follow-up 으로 이월.
- **§1 18 행 · §6 · §8 160 ~ 161 행 · §9 · §10 · §12.6 ~ §12.11 본문 편집 일체** — 각 시점의 요약·판정 서술은 append-only 보존 대상. 옛 행 번호 표기 (`110 행` · `115 행` · `121 ~ 127 행` · `L212`) 도 시점 기록이라 정정하지 않는다.
- **§3 매트릭스 66 row · §4 bullet · §4 정합식 · §5 통계표 편집** — T-1413 이 이미 확정했고 본 slice 는 그 값을 **옮겨 적기만** 한다. audit 문서 안의 수치를 재계산하거나 다시 손대지 않는다.
- **INDEX.md 118 행 · PLAN.md 36 행 의 옛 4 값 · gap 서술 in-place 치환** — append-only 규약 위반. 새 줄 / 새 문장으로만 현 시점을 가리킨다.
- **재판정 후보 17 row 또는 다른 `uc-covered` row 의 분류 재검토** · **`docs/requirements.md` 23 행 REQ-004 status 변경** · **UC 본문 편집** · `src/` · `web/` · `test/` · CI · package.json 등 코드 계열 변경 일체.

## Suggested Sub-agents

`implementer` (신규 ADR 불요 — 갱신 대상은 §12.3 표 (e) · (f), 순서·분리 허용은 §12.4, 확정 수치는 §12.11 이 이미 확정. direct doc-only 라 tester 호출 면제 — §3.2. implementer 가 INDEX.md append → PLAN.md 문장 append → 행 번호 실측 → §12.3 (e) · (f) 셀 치환 + 각주 → §12.12 절 작성 → AC 6 불변 검산 명령 실행까지 담당)

## Follow-ups

1. **`docs/architecture/api.md` 211 행 · `docs/architecture/data-model.md` 168 행 pointer 동기** — 두 곳의 "UC-09 신설 또는 UC-01 확장 후 추가 예정" 서술이 UC-09 실재 + REQ-004 재분류로 stale. T-1411 Follow-up 3 · T-1412 Follow-up 3 · T-1413 Follow-up 2 이월.
2. **audit §11 References bullet 의 UC 개수 표기 갱신** — `docs/use-cases/INDEX.md — 8 UC backbone` · `UC-01 … ~ UC-08 … — 8 UC 본문` 2 줄이 9 UC 실재와 어긋난다. 시점 기록이 아니라 **현행 index 성격의 서술** 이라 정정 대상인지 append 대상인지 판정이 선행돼야 한다.
3. **audit 198 행 `INDEX.md 104 행` 표기 최신성 점검** — T-1412 Follow-up 4 · T-1413 Follow-up 3 이월. §9.5 시점 기록 안의 stale 후보라 append-only 규약과의 관계 판정이 선행.
4. **§8 161 · 162 행 · §1 18 행의 `gap 1 건` 결론 문장 처리 방침 확정** — T-1413 Follow-up 4 이월. gap 0 이 된 이후 audit 문서 최상단 요약을 읽는 사람의 오독 여지를 "요약 절 말미에 현 시점 pointer 1 줄 append" 로 닫을지 판정.

## 완료 기록 (2026-08-03)

**Status: DONE.** 변경 파일 **정확히 4 개** — `docs/use-cases/INDEX.md` (+1/-0) · `docs/PLAN.md` (+1/-1) · `docs/use-cases/REQ-COVERAGE-AUDIT.md` (+42/-2) · 본 task 파일. 3 doc 파일 합계 **삽입 44 / 삭제 3** 으로 [CLAUDE.md](../../CLAUDE.md) §3 상한 (≤ 300 LOC / ≤ 5 파일) 안이며, 삭제 3 은 전부 in-place 치환의 짝 (PLAN 36 행 1 + §12.3 표 (e) · (f) 2) 이라 **순수 삭제 0** 이다 (AC 6).

**AC 1 (cascade (e) INDEX.md)** — 118 행 원문 무편집. 120 행 뒤에 `2026-08-03 재분류:` 줄 1 개 append — T-1411 UC-09 신설 → T-1412 INDEX 등록 → T-1413 실판정 chain · 갱신 4 값 (`uc-covered 49 / cross-cutting 4 / infrastructure 13 / gap 0 = 66`) · 근거 §12.11 · §12.12 위임의 3 요소 충족. `wc -l` = **123**, `git diff -U0 docs/use-cases/INDEX.md | grep -c '^-[^-]'` = **0** (hunk 1 개 · 삭제 0), `Refs:` 줄은 문단 아래 그대로.

**AC 2 (cascade (f) PLAN.md)** — 36 행 줄 끝에 `2026-08-03 재분류 (T-1413): …` 문장 1 개 append. bold 구간의 `gap 1 건 (REQ-004 …)` · `uc-covered 48 / … / gap 1 = 66.` 은 T-0029 시점 기록이라 한 글자도 지우지 않았고, `wc -l` = **175** 불변 · `--numstat` = **1 추가 / 1 삭제** (한 줄 in-place 확장). 34 ~ 35 · 37 ~ 40 행 등 다른 bullet · checkbox 무편집.

**AC 3 ~ 4 (§12.3 표 + 각주)** — (e) row 의 `지점` 열을 append 후 실측대로 `118 행` → `118 ~ 121 행`, `현재 값` 열을 갱신 4 값 + 원 출처 4 값 보존 부기로, (f) row 의 `현재 값` 열을 갱신 4 값 + 옛 서술 보존 부기로 1:1 치환 (`지점` 열 무변). (a) ~ (d) row 무편집, 두 row 모두 **4 컬럼** 유지 · 표 row 수 6 + 헤더 2 불변. T-1413 각주 바로 다음 줄에 blank line 없이 T-1414 각주 1 줄 append.

**AC 5 (§12.12 신설)** — `## 11. References` 바로 앞에 `### 12.12 …` 절 (39 행) 삽입, `grep -c "^## "` = **12** 불변. 구성은 서두 blockquote / cascade (e) · (f) 실행 기록 (편집 방식이 append 임을 명시) + §12.3 셀 치환 기록 / 불변 검산 출력 블록 (AC 6 명령 + 실측 그대로) / 한계 3 항 (① (a) ~ (f) 전건 closure 후에도 §1 18 행 · §8 160 ~ 161 행 · §9.4 188 행 옛 요약 무편집, ② References 의 `8 UC` 표기 stale — 후속 소관, ③ 후보 밖 49 row 미재판정).

**AC 6 (불변 검산)** — `git status --porcelain` 변경 파일 4 개 (위 목록) 이고 `docs/requirements.md` · `UC-01` ~ `UC-09` 본문 · `docs/architecture/api.md` · `data-model.md` · `CLAUDE.md` **미등장**. audit 검산 `grep -c "^| REQ-"` = **66** · `grep -c "^## "` = **12** 불변이며 §3 38 행 REQ-004 row · §4 116 행 정합식 (`34 + 15 + 4 + 13 + 0 = 66`) · §5 표 (`49 / 4 / 13 / 0`) 는 hunk 밖 무변 (`git diff -U0 | grep '^@@'` = 5 hunk: PLAN 36 · INDEX 121 · §12.3 표 2 행 · §12.3 각주 · §12.12 삽입).

**AC 7 (R-110 / R-112 면제)** — 본 task 는 `commitMode: direct` + production code **0 LOC** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 "direct-mode doc-only commit 만 본 규칙 면제" 조항으로 tester 호출 (R-110) · R-112 4 항목 (happy / error / branch / negative) · `pnpm test:cov` 가 전부 **N/A** 다 (분기 0, architect / tester dispatch 0).

**Out of Scope 준수** — api.md / data-model.md pointer, audit §11 References bullet, §1 18 행 · §6 · §8 · §9 · §10 · §12.6 ~ §12.11 본문, §3 매트릭스 66 row · §4 · §5 수치, INDEX.md 118 행 · PLAN.md 36 행 앞부분의 in-place 치환, 재판정 후보 17 row, requirements / UC 본문, 코드 계열 전부 **한 글자도 건드리지 않았다**.
