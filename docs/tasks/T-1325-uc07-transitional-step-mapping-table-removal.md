---
id: T-1325
title: UC-07 §5.1 과도기 step 번호·이름 대응표 제거 (sweep 완결로 수명 종료) + 제거 근거 한 줄 박제
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-030, REQ-045]
estimatedDiff: 28
estimatedFiles: 1
created: 2026-07-30
independentStream: uc07-step-ref-comment-sweep
dependsOn: [T-1316, T-1324]
touchesFiles:
  - docs/use-cases/UC-07-export-import.md
plannerNote: "sweep 종결(T-1324)로 과도기 표 수명 종료 — direct(§3.1 rule1: use-case doc 은 pr 컬럼 미해당·동작 변경 0, T-1316 선례). 28 LOC / 1 파일"
---

# T-1325 — UC-07 §5.1 과도기 대응표 제거

## Why

[T-1316](T-1316-uc07-step-count-and-mapping-table.md) 이 [UC-07](../use-cases/UC-07-export-import.md) 에 박제한 `### 5.1 step 번호 · 이름 대응표` 는 **129 행이 스스로 "코드 주석 sweep 완결 후 제거 가능한 과도기 표" 라고 밝힌** 한시적 장치다. 그 표를 소비하는 sweep 이 slice 1~8 ([T-1317](T-1317-uc07-step-ref-comment-sweep-chunk.md) ~ [T-1324](T-1324-uc07-step-ref-comment-sweep-final-modes.md), 총 65 곳 / 32 파일) 로 **완전히 종결** 됐고 (origin/main `0b5bfc2b` 실측: `§5 step ?2` · `?5` · `?7` 전부 `src/` 0 hit), T-1317~T-1324 가 매 slice Follow-ups 에 "마지막 slice 가 표 제거 여부를 함께 판단" 이라고 이월해 온 항목의 **제거 조건이 최초로 충족** 됐다.

본 task 는 그 과도기 표를 제거해 UC-07 §5 를 정상 상태(mermaid + 영속 규약 + step 수 선언)로 되돌리고, 제거 근거를 한 문장으로 박제한다. PLAN P5 의 UC-07 문서 ↔ 코드 주석 정합 유지(REQ-030 / REQ-045)를 잇는 stream 의 최종 마감이다.

## 제거 범위 (실측 확정 — origin/main `0b5bfc2b`, 실행 중 재판정 금지)

대상 파일은 `docs/use-cases/UC-07-export-import.md` **1 개뿐** 이다. 현재 행 구조는 다음과 같다:

| 행 | 내용 | 처분 |
| --- | --- | --- |
| 101 | mermaid 블록 종료 ` ``` ` | **보존** |
| 103 | "위 step 번호는 mermaid `autonumber` 가 매기는 **arrow 순번** …" 참조 규약 문단 | **보존 + 문장 1 개 추가** (아래) |
| 105 | `### 5.1 step 번호 · 이름 대응표` 소절 heading | **삭제** |
| 107 | "T-1311 이 §6.5 Import preview 왕복 arrow 2 개를 삽입해 … 아래 표만 읽고 판정한다." | **삭제** |
| 109~110 | 표 header + 구분선 (`현 번호` / `step 이름` / `T-1311 이전 번호`) | **삭제** |
| 111~127 | 표 본문 17 행 (현 1 ~ 현 17) | **삭제** |
| 129 | "**판정 규약** — 옛 참조를 고칠 때 기계적 +2 를 적용하지 말고 … 제거 가능한 **과도기 표** 다." | **삭제** |
| 131 | "step 수 17 (autonumber 기준 — 103 행 규약과 같은 기준으로 …" 로 시작하는 문단 (T-0027 자기점검 범위 초과 사실 · 의존성 방향 정합 · UC-01 conceptual reference 서술 포함) | **글자 그대로 보존** |
| 133~ | `## 6. Alternative flows` 이하 전부 | **보존** |

즉 **105 행부터 130 행(129 행 뒤 빈 줄)까지 연속 삭제** 하고, 결과적으로 103 행 문단 → 빈 줄 → 131 행 문단이 이어지도록 만든다. 삭제 후에도 **131 행 문단 안의 "103 행 규약" 이라는 행 번호 참조는 유효** 하다 (삭제 구간이 전부 103 행 뒤에 있어 103 행의 위치가 바뀌지 않는다).

### 103 행에 추가할 문장 (정본 — 이 문구를 쓴다)

103 행 문단의 **맨 끝에 한 문장을 이어 붙인다** (새 소절 · 새 목록 만들지 않는다, 같은 한 줄 유지 — 이 파일의 기존 긴 줄 스타일 그대로):

> 과도기였던 `§5.1 step 번호 · 이름 대응표` ([T-1316](../tasks/T-1316-uc07-step-count-and-mapping-table.md) 박제) 는 옛 번호를 쓰던 코드 주석 sweep 이 [T-1324](../tasks/T-1324-uc07-step-ref-comment-sweep-final-modes.md) 로 완결돼 소임을 다했으므로 제거했다 — 옛 번호 ↔ 현 번호 매핑이 다시 필요하면 git history 를 참조한다.

## 다른 문서의 링크 처리 (조사 완료 — 추가 작업 없음)

planner 가 origin/main `0b5bfc2b` 에서 `git grep -n "5\.1" -- docs/ src/ test/ web/` + `git grep -rn "대응표"` 로 전수 조사한 결과:

- **살아있는 문서 중 §5.1 을 참조하는 것은 0** — `docs/architecture/*` · `docs/decisions/*` · `README.md` · 다른 UC 문서에 §5.1 앵커 링크가 없다.
- `src/` · `test/` · `web/` · `scripts/` 코드 주석에도 §5.1 참조 0 (`src/import/import-restore.service.ts:24` 의 UC-07 참조는 §7.3 / §7.4 대상이라 무관).
- 참조가 있는 곳은 **`docs/tasks/T-1312·T-1316~T-1324` 와 `docs/progress/journal-2026-07-30.md` 뿐이며, 이들은 과거 사실을 적은 이력 기록** 이다. **고치지 않는다** (Out of Scope — 이력 개서 금지).

따라서 본 task 는 링크 깨짐 후속 조치 없이 1 파일 편집으로 끝난다.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` — **101~133 행** 만 (mermaid 종료 → §5.1 소절 전체 → `## 6.` 시작). 위 제거 범위 표의 행 번호가 이 구간에 그대로 대응한다.
- `docs/tasks/T-1324-uc07-step-ref-comment-sweep-final-modes.md` — Out of Scope 첫 항목 + Follow-ups (본 task 가 인수하는 항목, "제거 시 §5 103 행의 번호·이름 병기 규약은 남겨야 한다" 조건).

## Acceptance Criteria

- [ ] `docs/use-cases/UC-07-export-import.md` 의 **105~130 행 (소절 heading · 도입 문단 · 표 header/구분선 · 표 본문 17 행 · 판정 규약 문단 및 그 뒤 빈 줄)** 을 삭제한다. 위 제거 범위 표가 정본이며 **행 처분을 실행 중 재판정하지 않는다**.
- [ ] **103 행 참조 규약 문단은 보존** 하고, 위 §"103 행에 추가할 문장" 의 문구를 그 문단 끝에 **한 문장** 이어 붙인다 (새 소절 · 새 표 · 새 목록 신설 0).
- [ ] **131 행 "step 수 17 …" 문단은 글자 그대로 보존** — `step 수 17` 선언 · `Note over` 제외 계수 기준 · T-0027 자기점검 범위 8~14 초과 사실 · 의존성 방향 정합 서술 · UC-01 conceptual reference 서술 중 **어느 것도 삭제 · 요약 · 재작성하지 않는다**. 이 문단 안의 "103 행 규약" 행 번호 참조도 그대로 둔다 (삭제 구간이 모두 103 행 뒤라 유효).
- [ ] `## 5. Main flow` 의 **mermaid 블록 (53~101 행) 무변경** — arrow 삽입 · 삭제 · 문구 수정 0. 편집 후 `grep -cE '\-\->>|\->>' docs/use-cases/UC-07-export-import.md` → **17** (편집 전 실측치와 동일; `Note over` 는 계수 대상 아님).
- [ ] `## 6. Alternative flows` 이하 (§6.1 · §6.2 · §6.5 · §7 · §8 …) **전 구간 무변경**.
- [ ] **제거 검증 grep** (모두 편집 후 실행):
  - `grep -n "### 5.1" docs/use-cases/UC-07-export-import.md` → **0 hit**
  - `grep -n "T-1311 이전 번호" docs/use-cases/UC-07-export-import.md` → **0 hit**
  - `grep -n "과도기 표" docs/use-cases/UC-07-export-import.md` → **0 hit** (129 행 문구 제거 확인 — 새로 넣는 문장은 "과도기였던" 이라 이 패턴에 걸리지 않는다)
  - `grep -c "step 수 17" docs/use-cases/UC-07-export-import.md` → **1 hit** (131 행 보존 확인)
  - `grep -c "번호와 step 이름을 병기" docs/use-cases/UC-07-export-import.md` → **1 hit** (103 행 영속 규약 보존 확인)
- [ ] **단일 파일 게이트**: `git diff --stat` 결과가 `docs/use-cases/UC-07-export-import.md` **1 파일** 뿐이고, 삭제 24~27 줄 · 추가 0~1 줄 범위여야 한다. `src/` · `test/` · `web/` 은 **1 줄도 건드리지 않는다**.
- [ ] **R-112 대체 검증** — 본 task 는 `commitMode: direct` 문서 전용 변경이라 **신규 public symbol 0 · 신규 분기 0 · production 코드 0 LOC** 이므로 happy-path / error path / 분기 / negative cases 각각에 **대응하는 신규 test 대상이 없다** (T-1316 선례). 대신 다음으로 대체한다:
  - `pnpm lint && pnpm build` 통과 (문서 변경이라 영향 0 이어야 한다).
  - `pnpm test` 전량 통과 · `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 기존 spec 무회귀 확인.
  - push 후 main CI conclusion 확인은 driver 책임 (R-114).

## Out of Scope

- **`docs/tasks/T-1312·T-1316~T-1324` · `docs/progress/journal-2026-07-30.md` 안의 §5.1 언급 수정** — 과거 사실을 적은 이력 기록이라 개서 금지. "103~127 행" 같은 행 번호 표기가 본 제거로 stale 해져도 **그대로 둔다**.
- `src/export/**` · `src/import/**` 주석 재수정 — sweep 은 T-1324 로 종결됐다. 표현 통일 · 이름 병기 방식 일괄 정렬도 하지 않는다.
- **drift-guard smoke 신설** (`§5 step` 참조가 다시 어긋나면 fail 하는 spec) — 별건이며, daily-test leg 추가는 drift-guard smoke 3 종 동기 수정을 강제해 5 파일 cap 을 넘긴다 (Q-0054 선례).
- `docs/use-cases/UC-08-*.md` 의 step 수 정합 (16 vs 14) — 별건.
- §5 mermaid 자체의 arrow 추가 · 재배열 · step 이름 문구 개선, §6 이하 본문 개선, UC-07 의 다른 소절 번호 재정렬.
- `docs/PLAN.md` · `docs/STATE.json` 갱신 (driver bookkeeping 영역).

## Suggested Sub-agents

`implementer`

## Follow-ups
