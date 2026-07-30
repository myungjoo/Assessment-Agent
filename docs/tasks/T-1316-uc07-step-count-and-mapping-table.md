---
id: T-1316
title: UC-07 §5 step 수 선언을 실측 17 로 정합 + 주석 sweep 용 step 번호·이름 대응표 박제
phase: P5
status: DONE
completedAt: 2026-07-30T10:41:00Z
commitMode: direct
coversReq: [REQ-030, REQ-045]
estimatedDiff: 34
estimatedFiles: 1
created: 2026-07-30
independentStream: import-restore-engine
dependsOn: [T-1311, T-1312]
touchesFiles:
  - docs/use-cases/UC-07-export-import.md
plannerNote: "T-1312 Follow-up 2 건 마감 — step 수 13→실측 17 정합 + 41 주석 sweep 의 선행 대응표 확정. doc-only, 34 LOC / 1 파일"
---

# T-1316 — UC-07 §5 step 수 선언을 실측 17 로 정합 + 주석 sweep 용 step 번호·이름 대응표 박제

## Why

[T-1311](T-1311-uc07-sequence-preview-step-sync.md) 이 UC-07 §5 mermaid 에 Import preview 왕복 arrow 2 개를 넣어 arrow 가 15 → 17 로 늘었지만, 같은 절의 **`step 수: 약 13` 선언은 그대로 남아 사실과 4 만큼 어긋난다** ([T-1312](T-1312-uc07-residual-step-ref-realign.md) Follow-ups 의 마지막 관측 — AC 밖이라 미수정). 또한 T-1312 는 `src/export/**` · `src/import/**` 코드 주석의 UC-07 §5 step 참조가 **48 곳 / 27 파일**(origin/main `f4cd5da2` 실측)이라 5 파일 cap 상 최소 6 slice 가 필요하고, `import-restore-preview.ts` 의 `step 7 강한 confirmation` 처럼 **T-1311 이전부터 이름과 번호가 어긋난 선행 drift 가 섞여 기계적 +2 가 불가**함을 확인했다. 본 task 는 그 sweep 의 선행 조건인 **번호·이름 대응표를 UC-07 자신에게 한 번 확정**해, 이후 slice 들이 판정을 재추론하지 않고 표 1 개만 읽고 진행하게 만든다 (§7 context 절약 규칙 — 같은 판정을 두 번 추론하지 않는다).

## Required Reading

- `docs/use-cases/UC-07-export-import.md` 53~106 행 — §5 mermaid `sequenceDiagram` 블록 전체(현 arrow 17 개) + 103 행 step 참조 규약 문단(T-1312 박제, "번호와 step 이름을 병기") + **105 행 `step 수: 약 13 ... 8 ≤ 13 ≤ 14 범위 안` = 수정 대상 문장**
- `docs/tasks/T-0027-uc-07-export-import.md` 101 행 — P2 작성 시 자기점검 범위의 출처 (`sequence step 수: 8 이상 14 이하`). 현 17 은 이 범위를 초과하며, 본 task 는 그 초과를 **은폐하지 않고 사실로 기재**한다.
- `docs/tasks/T-1312-uc07-residual-step-ref-realign.md` Follow-ups 1 번째 · 마지막 항목 — 본 task 가 마감하는 두 관측(주석 sweep 대응표 선행 확정 / `step 수: 약 13` 불일치)
- 대응표 유도용 git 사실: `git show e141fbfb^:docs/use-cases/UC-07-export-import.md` (T-1311 직전 상태, §5 arrow 15 개) 와 현재 파일의 arrow 순서를 대조한다. arrow 목록만 뽑을 명령 — `awk '/^```mermaid/{b++} b==1' <file> | grep -nE '(->>|-->>)'`

## Acceptance Criteria

- [ ] `docs/use-cases/UC-07-export-import.md` 105 행의 `step 수: 약 13 (autonumber 기준 — ... 8 ≤ 13 ≤ 14 범위 안)` 을 **실측값 기반 문장으로 교체**한다: (a) `step 수 17` 을 명시, (b) 계수 기준을 103 행 규약과 일치시켜 **arrow 만 세고 `Note over ...` 는 포함하지 않음**을 명시(현 `1 conceptual Note 포함` 서술은 103 행과 모순이라 제거), (c) [T-0027](T-0027-uc-07-export-import.md) 101 행의 자기점검 범위 8~14 를 **초과한 사실과 그 사유**(§6.5 Import preview 왕복 반영 = shipped 현실 동기화, T-1311) 를 한 줄로 남긴다. 같은 문장 뒤쪽의 의존성 방향 정합 서술·UC-01 재수집 conceptual reference 서술은 **글자 그대로 유지**.
- [ ] 검증: `awk '/^```mermaid/{b++} b==1' docs/use-cases/UC-07-export-import.md | grep -cE '(->>|-->>)'` 결과가 **17** 이고, 새로 쓴 문장의 숫자가 그 값과 일치한다.
- [ ] 103 행 규약 문단 **직후**에 소절(예: `### 5.1 step 번호 · 이름 대응표`) 을 신설하고 **17 행 표**를 박제한다. 열은 `현 번호` | `step 이름 (화자 → 수신자 요지, 한국어 짧게)` | `T-1311 이전 번호`. preview 왕복 2 개(현 2·3)는 이전 번호 칸에 `신설` 로 표기하고, 나머지는 실측 대조 결과(현 1 = 이전 1, 현 N≥4 = 이전 N−2)를 각 행에 채운다 — 규칙만 적고 표를 비우지 않는다.
- [ ] 표 아래에 **판정 규약 1~2 줄**을 덧붙인다: 코드 주석의 옛 참조를 고칠 때 **기계적 +2 를 적용하지 말고 주석이 가리키는 의도(step 이름)로 판정**한다 — 선행 drift 실례로 `src/import/import-restore-preview.ts` 의 `step 7 강한 confirmation`(실제 confirmation dialog 는 현 step 4, 옛 번호로도 7 이 아님) 을 명시. 표의 수명도 한 줄로 밝힌다(주석 sweep 완결 후 제거 가능한 **과도기 표**).
- [ ] 표의 이름 칸은 §5 mermaid arrow 라벨에서 **요지만 축약**해 쓰고, 라벨 원문·REQ ID 나열을 그대로 복사해 표를 비대하게 만들지 않는다 (행당 1 줄 유지).
- [ ] 변경 범위 확인: `git diff --stat` 이 **`docs/use-cases/UC-07-export-import.md` 1 파일**만 보고한다. 다른 UC 파일 · `docs/architecture/api.md` · `src/**` 주석 · ADR 수정 0.
- [ ] drift-guard 미파손 확인: `grep -rn "step 수" test/` 가 0 hit 임을 재확인(본 리터럴을 감시하는 spec 부재 — 사전 확인 완료, 변경 후 재확인). 코드·spec 변경 0 이라 `pnpm test` 영향 없음.

## Out of Scope

- `src/export/**` · `src/import/**` 코드 주석 48 곳 / 27 파일의 실제 치환 — 본 task 는 **대응표 확정까지만**. 치환은 파일 묶음별 후속 slice(각 ≤ 5 파일)의 책임이며, 그 slice 들이 본 표를 Required Reading 으로 읽는다.
- 다른 UC 문서(UC-01~UC-06 · UC-08)의 `step 수: 약 N` 선언 정합 — UC-08 은 실측 arrow 16 vs 선언 14, 나머지 6 개는 ±1~2 차이로 관측됐으나 계수 기준(Note 포함 여부)이 문서마다 달라 별도 판정이 필요하다. 8 파일이라 5 파일 cap 상 별 slice. Follow-ups 에 기록만 한다.
- §5 mermaid arrow 자체의 추가 · 삭제 · 라벨 변경 — 본 task 는 **선언 문장과 대응표만** 손댄다. 다이어그램 본문은 read-only.
- `docs/architecture/api.md` 의 step 참조 재정렬 — T-1311 · T-1312 가 이미 마감했다. 재확인만 하고 손대지 않는다.
- api.md 136~137 행 미구현 endpoint 표기 · `perEntity` breakdown 표시 위치 · export preview 500→4xx 매핑 등 T-1312 Follow-ups 의 제품 판단 항목.

## Suggested Sub-agents

`implementer` (문서 편집 · git 대조로 표 유도) → 검증은 위 Acceptance Criteria 의 `awk` · `grep` · `git diff --stat` 명령으로 충분 (코드 변경 0 이라 `tester` 불요 — direct doc-only, CLAUDE.md §3.2 R-110 면제 경로).

## Result (2026-07-30 10:41Z, DONE)

direct doc-only commit `e8a77f3d` main 머지 (CI green). `docs/use-cases/UC-07-export-import.md` 1 파일 +27/-1 — 105 행 `step 수: 약 13` 선언을 실측 **17** 기반 문장으로 교체(계수 기준 = arrow 만, `Note over` 제외 명시 / [T-0027](T-0027-uc-07-export-import.md) 101 행 자기점검 범위 8~14 초과 사실과 사유를 은폐 없이 1 줄 기재) + 103 행 규약 직후 `### 5.1 step 번호 · 이름 대응표` 소절 신설(17 행 표 — preview 왕복 2 개는 `신설`, 나머지 현 N = 이전 N−2) + 판정 규약(기계적 +2 금지, 이름 기준 판정 / 과도기 표 수명).

**편차 1 건 (실경로 정정)**: 판정 규약의 선행 drift 실례 파일 경로를 본 task 본문의 `src/import/import-restore-preview.ts` 대신 **실측 경로 `src/export/import-restore-preview.ts`** 로 기재했다 (`src/import/` 에 해당 파일 부재 — 존재하지 않는 경로를 권위 문서에 박제하지 않기 위함). 후속 sweep slice 는 이 실경로를 따른다.

## Follow-ups

- (본 task 에서 분리) UC-08 `step 수: 약 14` vs 실측 arrow 16 정합 + UC-01~UC-06 의 `약 N` 계수 기준 통일(Note 포함 여부) — 8 파일이라 2 slice 이상 필요.
- (T-1312 이월, 본 task 가 선행 확정) `src/export/**` · `src/import/**` 주석 48 곳 / 27 파일 치환 — 본 §5.1 표 기준 이름 병기 형태로, 파일 묶음별 slice.
