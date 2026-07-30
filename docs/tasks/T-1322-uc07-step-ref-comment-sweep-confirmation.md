---
id: T-1322
title: UC-07 §5 step 참조 주석 sweep slice 6 — 강한 confirmation dialog 계열 8 곳 (옛 step 7 · step 2 → 현 step 4)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030]
estimatedDiff: 26
estimatedFiles: 4
created: 2026-07-30
independentStream: uc07-step-ref-comment-sweep
dependsOn: [T-1316, T-1317, T-1318, T-1319, T-1320, T-1321]
touchesFiles:
  - src/export/import-merge-conflict.ts
  - src/export/import-restore-plan-summary.ts
  - src/export/import-restore-preview.ts
  - src/export/import-restore-confirmation.ts
plannerNote: "T-1321 Out of Scope 잔여 — 강한 confirmation dialog 계열 8 곳(옛 7·2 → 현 4). pr, 26 LOC / 4 파일"
---

# T-1322 — UC-07 §5 step 참조 주석 sweep slice 6 (강한 confirmation dialog 계열)

## Why

[T-1316](T-1316-uc07-step-count-and-mapping-table.md) 이 UC-07 §5.1 에 step 번호 · 이름 대응표 + 판정 규약을 박제한 뒤 slice 1~5 ([T-1317](T-1317-uc07-step-ref-comment-sweep-chunk.md) · [T-1318](T-1318-uc07-step-ref-comment-sweep-export-job.md) · [T-1319](T-1319-uc07-step-ref-comment-sweep-export-service-controller.md) · [T-1320](T-1320-uc07-step-ref-comment-sweep-artifact-audit.md) · [T-1321](T-1321-uc07-step-ref-comment-sweep-dialog-result.md)) 가 49 곳을 닫아 판정 A (`step 13` → `17`) · C (`step 12` = Audit) · D (Export/Import dialog `step 2`) · E (결과 응답 `step 12` → `15`) 계열이 완결됐다. 본 task 는 T-1321 이 Out of Scope 로 미뤄둔 **step 7 계열 중 "강한 confirmation dialog" 를 가리키는 참조만** 잘라낸 slice 6 이다.

- **판정 F — 강한 confirmation dialog (`§5 step 7` → `§5 step 4`, 6 곳)**: §5.1 판정 규약이 직접 예시로 든 **선행 drift** 다. `import-restore-preview.ts` 의 `step 7 "강한 confirmation — destructive 명시 + 영향 범위"` 는 실제 confirmation dialog 가 현 step 4 (T-1311 이전 번호로도 7 이 아닌 2) 라 **기계적 +2 (→ 9) 가 성립하지 않는다**. 인용 문구가 `강한 confirmation dialog(영향 범위 표시)` · `강한 confirmation dialog(destructive 명시 + 영향 범위)` · `후속 confirmation dialog` 로 전부 dialog 단계를 축자 명시하므로 §5.1 표의 `4 | WebUI → Admin: confirmation dialog (Export scope 선택 / Import 강한 confirmation) | 2` 행이 정답 근거다.
- **판정 H — `§5 step 2·step 7` 동시 인용 붕괴 (2 곳)**: `import-restore-confirmation.ts` 6 · 126 행은 한 참조가 옛 2 와 옛 7 을 함께 부른다. 옛 2 = confirmation dialog (현 4), 옛 7 = 위 선행 drift 로 역시 현 4 — **두 참조가 같은 번호로 붕괴** 하므로 T-1321 이 "step 7 계열 판정과 함께 결정하라" 며 격리했다. 본 slice 가 그 판정의 주인이므로 여기서 단일 `§5 step 4` 참조로 합쳐 닫는다.

origin/main `f385534c` 실측 기준 위 두 묶음이 정확히 **4 파일 8 곳** 으로 cap (≤ 300 LOC / ≤ 5 파일) 안에 든다. 같은 `step 7` 문자열이라도 dialog 가 아닌 참조 (`import-dump-validate.ts` 의 payload 검증 Note · `step 7·11` 복합 인용 2 곳) 와 `import.controller.ts` 의 mode 목록 endpoint 는 판정 계열이 달라 후속 slice 책임이다 (Out of Scope 참조).

## Required Reading

- `docs/use-cases/UC-07-export-import.md` **70 행** — 판정 근거 arrow 원문. `WebUI->>Admin: 사용자 confirmation dialog (Export 는 scope 옵션 선택, Import 는 강한 confirmation — destructive 명시 + 영향 범위 … + 기존 데이터 삭제 경고)` = **현 step 4**.
- `docs/use-cases/UC-07-export-import.md` **103~131 행** — §5 참조 규약 (번호 + step 이름 병기) + `### 5.1 step 번호 · 이름 대응표` + 표 아래 **판정 규약**. 본 slice 의 정답 근거 행: `4 | WebUI → Admin: confirmation dialog (Export scope 선택 / Import 강한 confirmation) | 2`. 판정 규약이 **본 slice 의 파일 (`import-restore-preview.ts`) 을 선행 drift 실례로 직접 지목** 하고 있으니 그 문단을 반드시 읽는다.
- `src/export/export-selection-summary.ts` **9 행**, `src/export/import-mode-description.ts` **5 · 46 행** — **읽기만**. slice 1~5 가 확정한 `§5 step 4 (confirmation dialog — Export scope 선택)` 이름 병기 형태 + 문맥이 이미 dialog 를 말할 때는 번호만 고친 선례. 본 slice 는 이 두 형태를 그대로 따른다.
- 치환 대상 8 곳 (origin/main `f385534c` 기준 행 번호 — 편집 전 grep 으로 실제 위치 재확인할 것):
  - **판정 F (`§5 step 7` → `§5 step 4`, 6 곳)**
    - `src/export/import-merge-conflict.ts` **8 행** (`§5 step 7 강한 confirmation dialog(영향 범위 표시)는 기존 13 helper 중 …`)
    - `src/export/import-restore-plan-summary.ts` **6 행** (`UC-07 §5 step 7 의 강한 confirmation dialog(destructive 명시 + 영향 범위)와`) · **33 행** (`dialog(UC-07 §5 step 7)와 Audit row(§8 (e))가 …`)
    - `src/export/import-restore-preview.ts` **8 행** (`(UC-07 §5 step 7 "강한 confirmation — destructive 명시 + 영향 범위", §8 (e) …`) · **25 행** (`후속 confirmation dialog(UC-07 §5 step 7) 가 이 요약을 …`) · **49 행** (`… 산출한다. UC-07 §5 step 7 / §8 (e) 정합:`)
  - **판정 H (`§5 step 2·step 7` → `§5 step 4`, 2 곳)**
    - `src/export/import-restore-confirmation.ts` **6 행** (`UC-07 §3 trigger 2 + §5 step 2·step 7 은 Import / Restore 가 "가장 destructive 한 흐름 …" 을 요구한다`) · **126 행** (`… 순수 합성한다(UC-07 §3 trigger 2 + §5 step 2·step 7 정합):`)

## Acceptance Criteria

- [ ] **판정 F 6 곳**: `§5 step 7` → `§5 step 4`. **기계적 +2 (→ 9) 는 오답** — §5.1 판정 규약이 이 계열을 선행 drift 실례로 명시했음을 지킨다 (dialog 는 현 4).
- [ ] **이름 중복 병기 회피**: 같은 문장이 이미 dialog 를 말하고 있는 5 곳 (`import-merge-conflict.ts` 8 행 `강한 confirmation dialog(영향 범위 표시)` · `import-restore-plan-summary.ts` 6 행 `의 강한 confirmation dialog(…)` · 33 행 `후속 confirmation / dialog(…)` · `import-restore-preview.ts` 8 행 축자 인용 `"강한 confirmation — destructive 명시 + 영향 범위"` · 25 행 `후속 confirmation dialog(…)`) 은 **번호만 `4` 로 고치고 이름을 중복해 붙이지 않는다**. 이름 병기 전체 형태 `§5 step 4 (confirmation dialog — Import 강한 confirmation)` 는 문맥이 이름을 드러내지 않는 짧은 나열 참조 **`import-restore-preview.ts` 49 행** (`UC-07 §5 step 7 / §8 (e) 정합:`) 에만 적용한다.
- [ ] **판정 H 2 곳**: `§5 step 2·step 7` 두 인용이 같은 현 step 4 로 붕괴하므로 **단일 참조 `§5 step 4` 로 합친다** (`step 4·step 4` 같은 중복 표기 금지). 6 행은 문맥이 dialog 를 직접 말하지 않으므로 이름 병기 `§5 step 4 (confirmation dialog — Import 강한 confirmation)`, 126 행은 바로 앞이 `강한 confirmation dialog 메시지 모델을 순수 합성한다` 라 **번호만** 고친다. 6 행은 주어가 복수 (`step 2·step 7 은`) 에서 단수로 바뀌므로 **조사만 자연스럽게 (`… 는`) 맞춘다** — 문장 뜻 · 어순 변경 금지.
- [ ] **인접 인용 무변경**: 같은 주석 줄의 `UC-07 §3 trigger 2` · `§8 (e)` · `§7.4` · `T-0437`~`T-0453` 계열 인용 · helper 이름 (`RestorePlanSummary` · `ImportImpact` 등) 은 **글자 그대로 유지**.
- [ ] 검증 (편집 후, 위 4 파일 대상): `git grep -oE "§5 ?step ?(2|7)\b" -- <4 파일>` 이 **0 hit**, `git grep -oE "§5 step 4\b" -- <4 파일>` 이 **8 hit**. 저장소 전체 기준으로는 `git grep -cE "§5 ?step ?7\b" -- "src/export/*" "src/import/*"` 가 **3 hit 잔존** (`import-dump-validate.ts` 1 + `import-restore-plan.ts` 1 + `import-restore-failure-message.ts` 1 — 전부 Out of Scope) 임을 확인한다.
- [ ] **주석-only 보증**: `git diff -U0` 의 모든 `+`/`-` 줄 (diff 헤더 제외) 이 `//` 주석 줄이다. production 로직 · 식별자 · 함수 시그니처 · 상수값 · export 목록 변경 **0 LOC**. 검증: `git diff -U0 | grep -E "^[+-]" | grep -vE "^(\+\+\+|---)" | grep -vcE "^[+-]\s*//"` 가 `0` 을 보고.
- [ ] **줄바꿈 최소화**: 이름 병기로 줄이 길어지면 같은 주석 블록 안에서만 인접 1~2 줄 재줄바꿈을 허용한다 (주변 ~100 char wrap 스타일 유지). 문장 추가 · 문단 재작성 · 어순 재배치 금지 — diff 를 8 곳 주변으로 국소화한다.
- [ ] **happy-path test**: 본 task 는 주석 문자열만 바꾸므로 **신규 · 변경 public symbol 0** 이라 신규 happy-path test 대상이 없다 (slice 1~5 선례). 대신 대응 기존 spec (`import-merge-conflict.spec.ts` · `import-restore-plan-summary.spec.ts` · `import-restore-preview.spec.ts` · `import-restore-confirmation.spec.ts`) 전량 pass 를 확인한다.
- [ ] **error path test**: 위 spec 들의 기존 error-path test (비-object dump · records 비-배열 · Invalid Date · 잘못된 mode 등) 가 **무회귀 pass**. 신규 error 경로 도입 0 이라 신규 test 불요.
- [ ] **분기 cover**: 신규 · 변경 분기 **0** (주석만 변경) — 신규 branch test 없음. 기존 branch coverage 수치가 변하지 않음을 `pnpm test:cov` 결과로 확인.
- [ ] **negative cases**: 신규 예외 상황 (권한 부족 · 빈 입력 · 경계값 · type mismatch · 의존성 실패 · 비정상 시퀀스) 도입 0 — 기존 negative test 전량 무회귀 pass 로 충족.
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 통과 + `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] 변경 범위 확인: `git diff --stat` 이 **위 4 파일만** 보고 (spec 파일 · 다른 `src/export/*` · `src/import/*` · docs · 워크플로 수정 0).

## Out of Scope

- **`src/export/import-dump-validate.ts` 6 행 (`§5 step 7 payload 검증`)** — 같은 `step 7` 문자열이지만 가리키는 대상이 dialog 가 아니라 **`Note over AssessmentModule` 의 payload 검증** 이라 정답이 다르다 (현 **9** `BackendAPI → AssessmentModule: exportDump / importRestore 호출` 직후 Note 계열). **본 slice 의 오답 함정** — dialog 묶음과 같이 `4` 로 고치면 오답이다. `export-dump-checksum.ts` 5 · 168 행 (`§5 step 5 Note`) 과 같은 계열이므로 후속 slice 가 Note 참조 표기 규약과 함께 판정한다.
- **`src/export/import-restore-plan.ts` 11 행 · `import-restore-failure-message.ts` 9 행 (`§5 step 7·11` 복합 인용)** — 한 참조가 dialog 계열 (옛 7) 과 transaction 결과 계열 (옛 11 = 현 13 `복원 row count 또는 rollback error`) 을 함께 부른다. 두 번호가 서로 다른 값으로 갈라지므로 참조를 쪼갤지 합칠지 별도 판정이 필요 — 본 slice 밖.
- **`src/import/import.controller.ts` 38 · 347 행 (`§5 step 2 + §6.2`)** — mode 설명 목록 조회 endpoint 라 **현 2/3 (import preview 요청 · mode 포함 응답)** 과 **현 4 (mode 선택 dialog)** 중 어느 쪽인지 인용 문구만으로 확정되지 않는다 (T-1321 이 같은 사유로 격리). 후속 slice 가 §6.2 · §6.5 본문까지 읽고 판정한다.
- 나머지 잔여 §5 step 참조 — step 5 계열 (`export-dump-checksum.ts` 2 곳 · `export-access-denial-message.ts` 1 곳 = AuthModule guard 라 현 8 계열) 은 후속 slice 책임. "지나가다 보이니 같이" 고치지 않는다 ([CLAUDE.md](../../CLAUDE.md) §3).
- **spec 파일 수정** — 4 대응 spec 의 `describe`/`it` 문자열 · 단언 · 주석 전부 무변경. 주석 리터럴 drift-guard spec 신설도 본 slice 밖.
- production 로직 · DTO · 반환 shape · 상수 · export 목록 변경 — 주석-only 원칙 위반.
- UC-07 문서 자체 수정 (§5 mermaid · §5.1 표 · 판정 규약 · `step 수 17` 문장) — **read-only**. 표가 틀렸다고 판단되면 고치지 말고 Follow-ups 에 적는다.
- 같은 주석 안의 `§3 trigger 2` · `§6.2` · `§7.4` · `§8 (b)(c)(e)` · `T-0437`~`T-0453` 인용 재정비 — 본 slice 는 **§5 step 번호만** 건드린다.
- 주석의 영어화 · 전면 재작성 · 어휘 개선 목적 편집 — §12 정합 유지.

## Suggested Sub-agents

`implementer` (8 곳 국소 주석 치환 — 판정 F 6 곳 / 판정 H 2 곳, 이름 중복 병기 회피 5 곳 + `step 2·step 7` 단일 참조 붕괴 2 곳 + `import-dump-validate.ts` 오답 함정 회피 주의) → `tester` (R-110 의무: `pnpm lint && pnpm build && pnpm test` + `pnpm test:cov`, 신규 spec 추가 0 이 정당한지 diff 로 확인).

## Follow-ups

<!-- 비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append -->
