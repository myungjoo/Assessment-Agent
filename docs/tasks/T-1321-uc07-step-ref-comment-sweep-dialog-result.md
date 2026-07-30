---
id: T-1321
title: UC-07 §5 step 참조 주석 sweep slice 5 — dialog step 2→4 5 곳 + import 결과 step 12→15 2 곳
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030]
estimatedDiff: 24
estimatedFiles: 5
created: 2026-07-30
independentStream: uc07-step-ref-comment-sweep
dependsOn: [T-1316, T-1317, T-1318, T-1319, T-1320]
touchesFiles:
  - src/export/export-dump-size-estimate.ts
  - src/export/export-scope-description.ts
  - src/export/import-mode-description.ts
  - src/import/import-restore.service.ts
  - src/import/import-job-runner.service.ts
plannerNote: "T-1320 Out of Scope 잔여 sweep — dialog 계열 5 곳(옛 2→현 4) + 선행 drift 2 곳(현 15). pr, 24 LOC / 5 파일"
---

# T-1321 — UC-07 §5 step 참조 주석 sweep slice 5 (dialog 계열 + import 결과 계열)

## Why

[T-1316](T-1316-uc07-step-count-and-mapping-table.md) 이 UC-07 §5.1 에 step 번호 · 이름 대응표 + 판정 규약을 박제한 뒤 slice 1~4 ([T-1317](T-1317-uc07-step-ref-comment-sweep-chunk.md) · [T-1318](T-1318-uc07-step-ref-comment-sweep-export-job.md) · [T-1319](T-1319-uc07-step-ref-comment-sweep-export-service-controller.md) · [T-1320](T-1320-uc07-step-ref-comment-sweep-artifact-audit.md)) 가 42 곳을 닫았고 판정 A (`step 13` → `step 17`) 는 저장소 전체에서 완결됐다. 본 task 는 T-1320 Out of Scope 가 남긴 잔여 중 **판정이 이름 인용으로 이미 확정된 두 묶음만** 잘라낸 slice 5 다.

- **판정 D — dialog 계열 5 곳** (`§5 step 2` → `§5 step 4`): 세 파일의 인용 문구가 모두 `scope 옵션 확인` · `Export scope 옵션 dialog` · `mode 를 *선택하는 dialog 단계*` · `Import mode 선택 dialog` 로 **confirmation dialog 단계** 를 명시한다. §5.1 표의 `4 | WebUI → Admin: confirmation dialog (Export scope 선택 / Import 강한 confirmation) | 2` 행이 직접 근거 (옛 2 → 현 4).
- **판정 E — import 결과 계열 2 곳** (`§5 step 12` → `§5 step 15`): 인용 문구가 `"복원 row count + 영향 요약"` 이라 §5 mermaid 96 행의 `AssessmentModule-->>BackendAPI: 결과 응답 (Export: streaming file. Import: 복원 row count + 영향 요약)` 과 축자 일치한다. 즉 옛 12 (Audit log) 가 아니라 **옛 13 (결과 응답) → 현 15** 를 가리키는 선행 drift 로, T-1320 이 Out of Scope 에서 이미 판정을 확정해 후속 slice 로 넘긴 항목이다.

origin/main `f385534c` 실측 기준 위 두 묶음이 정확히 **5 파일 7 곳** 으로 cap (≤ 300 LOC / ≤ 5 파일) 안에 든다. 판정이 갈리거나 두 step 을 함께 인용하는 잔여 (`import-restore-confirmation.ts` 의 `step 2·step 7` 동시 인용 · `src/import/import.controller.ts` 의 mode 목록 endpoint · step 7 계열 · step 5 계열) 는 후속 slice 책임이다 (Out of Scope 참조).

## Required Reading

- `docs/use-cases/UC-07-export-import.md` **70 행 · 96 행** — 판정 근거가 되는 mermaid arrow 원문 2 개. 70 행 `WebUI->>Admin: 사용자 confirmation dialog (Export 는 scope 옵션 선택, Import 는 강한 confirmation …)` = 현 step 4, 96 행 `AssessmentModule-->>BackendAPI: 결과 응답 (… Import: 복원 row count + 영향 요약)` = 현 step 15.
- `docs/use-cases/UC-07-export-import.md` **103~131 행** — §5 참조 규약 (번호 + step 이름 병기) + `### 5.1 step 번호 · 이름 대응표` + 표 아래 **판정 규약** (기계적 +2 금지 · 이름 기준 판정). 본 slice 의 정답 근거 2 행: `4 | WebUI → Admin: confirmation dialog (Export scope 선택 / Import 강한 confirmation) | 2` 와 `15 | AssessmentModule → BackendAPI: 결과 응답 (file stream / row count) | 13`.
- `src/export/export-selection-summary.ts` **9 행**, `src/export/export.controller.ts` **17 행** — **읽기만**. slice 1~4 가 확정한 `§5 step 4 (confirmation dialog — Export scope 선택)` 병기 표기 선례. 본 slice 는 이 형태를 그대로 따른다.
- 치환 대상 7 곳 (origin/main `f385534c` 기준 행 번호 — 편집 전 grep 으로 실제 위치 재확인할 것):
  - **판정 D (`§5 step 2` → `§5 step 4`, 5 곳)**
    - `src/export/export-dump-size-estimate.ts` **12 행** (`§5 step 2(scope 옵션 확인)가 필요로 하는 …`) · **52 행** (`(UC-07 §3 trigger 1 / §5 step 2 / §8 NFR)`)
    - `src/export/export-scope-description.ts` **107 행** (`Export scope 옵션 dialog 의 설명 메시지 모델을 순수 합성한다(UC-07 §5 step 2 + §6.1 + §8 (a) 정합)`)
    - `src/export/import-mode-description.ts` **5 행** (`사용자가 mode 를 *선택하는 dialog 단계*(UC-07 §5 step 2)에서`) · **46 행** (`Import mode 선택 dialog 의 설명 메시지 모델을 순수 합성한다(UC-07 §6.2 + §5 step 2 정합)`)
  - **판정 E (`§5 step 12` → `§5 step 15`, 2 곳)**
    - `src/import/import-restore.service.ts` **54 행** (`(T-1294, UC-07 §5 step 12 "복원 row count + 영향 요약" 의 첫 배선)`)
    - `src/import/import-job-runner.service.ts` **55 행** (`(UC-07 §5 step 12 "복원 row count + 영향 요약" 의 요약 쪽)`)

## Acceptance Criteria

- [ ] **판정 D 5 곳**: `§5 step 2` → `§5 step 4` + step 이름 병기. Export 문맥 (`export-dump-size-estimate.ts` · `export-scope-description.ts`) 은 `§5 step 4 (confirmation dialog — Export scope 선택)`, Import 문맥 (`import-mode-description.ts`) 은 `§5 step 4 (confirmation dialog — Import mode 선택)` 을 쓴다 (`export-selection-summary.ts` 9 행 선례 형태 그대로). **기계적 +2 판단이 아니라 이름 기준 판정** 임을 지킨다 (§5.1 판정 규약).
- [ ] **이름 중복 병기 회피**: 같은 문장이 이미 dialog 를 말하고 있는 3 곳 (`export-dump-size-estimate.ts` 12 행 `(scope 옵션 확인)` · `export-scope-description.ts` 107 행 `Export scope 옵션 dialog 의 …` · `import-mode-description.ts` 5 행 `*선택하는 dialog 단계*` · 46 행 `Import mode 선택 dialog 의 …`) 은 **번호만 `4` 로 고치고 이름을 중복해 붙이지 않는다**. 이름 병기 전체 형태는 문맥이 dialog 를 말하지 않는 짧은 참조 (`export-dump-size-estimate.ts` 52 행 `§3 trigger 1 / §5 step 2 / §8 NFR` 나열) 에만 적용한다. 결과적으로 파일당 최소 1 곳은 이름이 드러나야 한다.
- [ ] **판정 E 2 곳**: `§5 step 12` → `§5 step 15` 로 고치고, **바로 뒤의 축자 인용 `"복원 row count + 영향 요약"` 은 그대로 둔다** (그 인용이 이미 step 이름 병기 역할을 하므로 이름을 덧붙이지 않는다). 같은 주석 안의 `T-1294` · 필드 설명 (`summary` · `kept` · `deleted.perEntity`) · 상류 (`ImportJobRunnerService`) 서술은 **무변경**.
- [ ] **선행 drift 근거 보존**: 판정 E 는 옛 12 (Audit log) 가 아니라 옛 13 (결과 응답) 을 가리키는 drift 수정이다 — 두 주석 어디에도 `Audit log` 어휘를 새로 넣지 않는다.
- [ ] 검증 (편집 후, 위 5 파일 대상): `git grep -oE "§5 ?step ?(2|12)\b" -- <5 파일>` 이 **0 hit**, `git grep -oE "§5 step 4\b" -- <5 파일>` 이 **5 hit**, `git grep -oE "§5 step 15\b" -- <5 파일>` 이 **2 hit**.
- [ ] **주석-only 보증**: `git diff -U0` 의 모든 `+`/`-` 줄 (diff 헤더 제외) 이 `//` 주석 줄이다. production 로직 · 식별자 · 함수 시그니처 · 상수값 · export 목록 변경 **0 LOC**. 검증: `git diff -U0 | grep -E "^[+-]" | grep -vE "^(\+\+\+|---)" | grep -vcE "^[+-]\s*//"` 가 `0` 을 보고.
- [ ] **줄바꿈 최소화**: 이름 병기로 줄이 길어지면 같은 주석 블록 안에서만 인접 1~2 줄 재줄바꿈을 허용한다 (주변 ~100 char wrap 스타일 유지). 문장 추가 · 문단 재작성 · 어순 재배치 금지 — diff 를 7 곳 주변으로 국소화한다.
- [ ] **happy-path test**: 본 task 는 주석 문자열만 바꾸므로 **신규 · 변경 public symbol 0** 이라 신규 happy-path test 대상이 없다 (slice 1~4 선례). 대신 대응 기존 spec (`export-dump-size-estimate.spec.ts` · `export-scope-description.spec.ts` · `import-mode-description.spec.ts` · `import-restore.service.spec.ts` · `import-job-runner.service.spec.ts`) 전량 pass 를 확인한다.
- [ ] **error path test**: 위 spec 들의 기존 error-path test (잘못된 입력 · 빈 payload · 복원 실패 · 의존성 실패 등) 가 **무회귀 pass**. 신규 error 경로 도입 0 이라 신규 test 불요.
- [ ] **분기 cover**: 신규 · 변경 분기 **0** (주석만 변경) — 신규 branch test 없음. 기존 branch coverage 수치가 변하지 않음을 `pnpm test:cov` 결과로 확인.
- [ ] **negative cases**: 신규 예외 상황 (권한 부족 · 빈 입력 · 경계값 · type mismatch · 의존성 실패 · 비정상 시퀀스) 도입 0 — 기존 negative test 전량 무회귀 pass 로 충족.
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 통과 + `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] 변경 범위 확인: `git diff --stat` 이 **위 5 파일만** 보고 (spec 파일 · 다른 `src/export/*` · `src/import/*` · docs · 워크플로 수정 0).

## Out of Scope

- **`src/export/import-restore-confirmation.ts` 6 · 126 행 (`§5 step 2·step 7` 동시 인용)** — 한 참조가 두 step 을 함께 부르고, `step 7` 쪽은 §5.1 판정 규약이 예시로 든 **강한 confirmation 선행 drift** 와 같은 계열이라 step 7 계열 판정과 함께 결정해야 한다. 본 slice 에서 **건드리지 않는다** (dialog 라는 이유로 같이 고치면 두 참조가 같은 번호로 붕괴할 위험).
- **`src/import/import.controller.ts` 38 · 347 행 (`§5 step 2 + §6.2`)** — mode 설명 목록 조회 endpoint 라 **현 2/3 (import preview 요청 · mode 포함 응답)** 과 **현 4 (mode 선택 dialog)** 중 어느 쪽을 가리키는지 인용 문구만으로 확정되지 않는다. 판정이 애매하므로 본 slice 밖 — 후속 slice 가 §6.2 · §6.5 본문까지 읽고 판정한다.
- 나머지 잔여 §5 step 참조 — step 7 계열 (`import-restore-preview.ts` 3 · `import-restore-plan-summary.ts` 2 · `import-restore-plan.ts` 1 · `import-restore-failure-message.ts` 1 · `import-merge-conflict.ts` 1 · `import-dump-validate.ts` 1) · step 5 계열 (`export-dump-checksum.ts` 2 — 인용이 payload 검증 Note 라 현 9 계열 · `export-access-denial-message.ts` 1 — AuthModule guard 라 현 8 계열) 은 후속 slice 책임. "지나가다 보이니 같이" 고치지 않는다 ([CLAUDE.md](../../CLAUDE.md) §3).
- **spec 파일 수정** — 5 대응 spec 의 `describe`/`it` 문자열 · 단언 · 주석 전부 무변경. 주석 리터럴 drift-guard spec 신설도 본 slice 밖.
- production 로직 · DTO · 반환 shape · 상수 · export 목록 변경 — 주석-only 원칙 위반.
- UC-07 문서 자체 수정 (§5 mermaid · §5.1 표 · 판정 규약 · `step 수 17` 문장) — **read-only**. 표가 틀렸다고 판단되면 고치지 말고 Follow-ups 에 적는다.
- 같은 주석 안의 `§3 trigger 1/2` · `§6.1` · `§6.2` · `§8 (a)(b)` · `§8 NFR` · `T-0438` · `T-0449` · `T-0450` · `T-0462` · `T-1294` 인용 재정비 — 본 slice 는 **§5 step 번호만** 건드린다.
- 주석의 영어화 · 전면 재작성 · 어휘 개선 목적 편집 — §12 정합 유지.

## Suggested Sub-agents

`implementer` (7 곳 국소 주석 치환 — 판정 D 5 곳 / 판정 E 2 곳, 이름 중복 병기 회피 4 곳 + 축자 인용 보존 2 곳 주의) → `tester` (R-110 의무: `pnpm lint && pnpm build && pnpm test` + `pnpm test:cov`, 신규 spec 추가 0 이 정당한지 diff 로 확인).

## Follow-ups

<!-- 비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append -->
