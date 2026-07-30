---
id: T-1320
title: UC-07 §5 step 참조 주석 sweep slice 4 — 잔여 step 13 완결 + audit step 12 계열 5 파일 9 곳
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-045]
estimatedDiff: 32
estimatedFiles: 5
created: 2026-07-30
independentStream: uc07-step-ref-comment-sweep
dependsOn: [T-1316, T-1317, T-1318, T-1319]
touchesFiles:
  - src/export/export-artifact-descriptor.ts
  - src/export/import-chunk-upload-progress.ts
  - src/export/import-restore-result.ts
  - src/export/export-import-audit.ts
  - src/export/export-import-audit-message.ts
plannerNote: "T-1319 Follow-ups 잔여 sweep — 판정 A(step 13→17) 잔여 5 곳 완결 + audit step 12→14 4 곳. pr, 32 LOC / 5 파일"
---

# T-1320 — UC-07 §5 step 참조 주석 sweep slice 4 (잔여 step 13 완결 + audit step 12 계열)

## Why

[T-1316](T-1316-uc07-step-count-and-mapping-table.md) 이 UC-07 §5.1 에 step 번호 · 이름 대응표 + 판정 규약을 박제한 뒤 slice 1~3 ([T-1317](T-1317-uc07-step-ref-comment-sweep-chunk.md) chunk 11 곳 · [T-1318](T-1318-uc07-step-ref-comment-sweep-export-job.md) job/result/selection 10 곳 · [T-1319](T-1319-uc07-step-ref-comment-sweep-export-service-controller.md) service/controller 12 곳) 가 33 곳을 닫았다. 본 task 는 T-1319 Follow-ups 가 남긴 잔여 sweep 중 **판정이 이미 확정된 두 묶음만** 잘라낸 slice 4 다.

- **판정 A 잔여 5 곳** — slice 1~3 과 완전히 같은 판정 (`결과 표시` 의도 → 현 step 17). 본 slice 로 저장소 전체에서 `§5 step 13` (붙어쓰기 `step13` 포함) hit 이 **0** 이 되어 판정 A 가 완결된다.
- **audit 계열 4 곳** — `§5 step 12` 를 `Audit log 1 row 생성` 의도로 인용하는 곳들. §5.1 표의 `14 | AssessmentModule → PersistenceModule: Audit log row insert | 12` 행이 직접 근거라 slice 안에서 재추론 0.

origin/main `3332dea5` 실측 결과 위 두 묶음이 정확히 **5 파일 9 곳** 으로 cap (≤ 300 LOC / ≤ 5 파일) 경계에 딱 맞는다. 나머지 잔여 (step 7 계열 · step 2 계열 · step 5 계열 · `src/import/*`) 는 판정이 서로 달라 후속 slice 책임 — 특히 `src/import/*` 의 `§5 step 12` 는 **인용 문구가 `복원 row count + 영향 요약` 이라 표의 옛 12 (Audit log) 가 아니라 옛 13 (결과 응답) 을 가리키는 선행 drift** 이므로 본 slice 에서 audit 과 같이 묶으면 오답이 된다 (Follow-ups 참조).

## Required Reading

- `docs/use-cases/UC-07-export-import.md` **103~131 행** — §5 참조 규약 (번호 + step 이름 병기) + `### 5.1 step 번호 · 이름 대응표` + 표 아래 **판정 규약** (기계적 +2 금지 · 이름 기준 판정). 본 slice 의 정답 근거 2 행: `14 | AssessmentModule → PersistenceModule: Audit log row insert | 12` 와 `17 | WebUI → Admin: 결과 표시 (다운로드 완료 / 복원 완료 + 재수집 안내) | 15`.
- `src/export/export-result.ts` **4 행 · 179 행** — **읽기만**. slice 1~3 이 확정한 병기 표기 선례 (헤더 참조는 `UC-07 §5 step 17 (결과 표시 — 다운로드 완료)`, 짧은 반복 참조는 `§5 step 17 (결과 표시)`) 를 그대로 따르기 위한 참조.
- 치환 대상 9 곳 (origin/main `3332dea5` 기준 행 번호 — 편집 전 grep 으로 실제 위치 재확인할 것):
  - **판정 A (`step 13` / 붙어쓰기 `step13` → `step 17`, 5 곳)**
    - `src/export/export-artifact-descriptor.ts` **6 행** (`UC-07 §5 step13(\`Export: 다운로드 완료\`)` — 붙어쓰기) · **113 행** (`UC-07 §5 step13 + §8 (a)(c) 정합` — 붙어쓰기)
    - `src/export/import-chunk-upload-progress.ts` **54 행** (`업로드 진행 표시(UC-07 §5 step 13)` — 진행 표시 문맥)
    - `src/export/import-restore-result.ts` **4 행** (헤더 — **다음 줄 5 행에 step 이름 `결과 표시 … Import: 복원 완료 + 재수집 안내` 가 이미 인용돼 있다**) · **139 행** (`§5 step 13 + §8 (a)(c) 정합`)
  - **판정 C (`step 12` → `step 14`, 4 곳)**
    - `src/export/export-import-audit.ts` **8 행** (`"Audit log 1 row 생성(…)"(§5 step 12)`) · **13 행** (`실 Audit log row insert … (UC-07 §5 step 12,`) · **91 행** (`UC-07 §5 step 12 / §8 (b)(e) 정합:`)
    - `src/export/export-import-audit-message.ts` **7 행** (`"Audit log 1 row 생성(…)"(§5 step 12)`)

## Acceptance Criteria

- [ ] **판정 A 5 곳**: `§5 step 13` 및 붙어쓰기 `§5 step13` → `§5 step 17` + step 이름 병기. Export 문맥 (`export-artifact-descriptor.ts`) 은 `결과 표시 — 다운로드 완료`, Import 문맥 (`import-restore-result.ts` · `import-chunk-upload-progress.ts`) 은 `결과 표시 — 복원 완료` 를 쓴다. 파일별 첫(헤더) 참조는 이름 병기 전체 형태, 같은 파일 안의 짧은 반복 참조는 `§5 step 17 (결과 표시)` 를 쓴다 (slice 1~3 이 확정한 2 종 허용 형태 그대로). **기계적 +2 로 15 를 쓰지 않는다** (§5.1 판정 규약).
- [ ] **이름 중복 병기 회피** (`import-restore-result.ts` 4 행): 바로 다음 줄 5 행에 step 이름이 이미 인용돼 있으므로 **번호만 `17` 로 고치고 이름을 중복해 붙이지 않는다** (§5 규약의 "번호 + 이름 병기" 취지가 두 줄로 이미 충족). 5 행 인용 문장 자체는 무변경.
- [ ] **붙어쓰기 2 곳 정규화** (`export-artifact-descriptor.ts` 6 · 113 행 `§5 step13`): 치환하면서 `§5 step 17` 로 **공백을 넣어** 정규화한다 (후속 grep 검증이 성립하도록). 6 행의 기존 괄호 인용 `(\`Export: 다운로드 완료\`)` 는 이름 병기와 뜻이 같으므로 `§5 step 17 (결과 표시 — 다운로드 완료)` 한 형태로 합쳐도 되고, 괄호 인용을 그대로 두고 번호만 고쳐도 된다 — **둘 중 하나만** 택해 문장이 이름을 두 번 말하지 않게 한다.
- [ ] **판정 C 4 곳**: `§5 step 12` → `§5 step 14 (Audit log row insert)` 형태. 옛 12 → 현 14 는 §5.1 표 행이 직접 근거이며, 같은 주석 안의 `§8 (b)` · `§8 (e)` · `T-0443` 인용은 **무변경**.
- [ ] **진행 표시 문맥 의미 보존** (`import-chunk-upload-progress.ts` 54 행): 업로드 진행 표시는 완료 표시 자체가 아니므로 `§5 step 17 (결과 표시 — 복원 완료) 직전의 업로드 진행 표시` 형태로 앵커한다 (slice 1~3 의 `직전의 진행 안내` 선례). 기존 `후속 import controller / WebUI 업로드 진행 표시` · `headline 은 한국어 한 줄 요약` 어휘를 없애지 않는다.
- [ ] 검증 (편집 후, 위 5 파일 대상): `git grep -oE "§5 ?step ?(12|13)\b"` 가 **0 hit**, `git grep -oE "§5 step 17"` 가 **5 hit**, `git grep -oE "§5 step 14"` 가 **4 hit**.
- [ ] **저장소 전체 판정 A 완결 확인**: `git grep -oE "§5 ?step ?13\b" -- "src/export/*" "src/import/*"` 가 **저장소 전체에서 0 hit** (본 slice 가 판정 A 마지막 5 곳을 닫음).
- [ ] **주석-only 보증**: `git diff -U0` 의 모든 `+`/`-` 줄 (diff 헤더 제외) 이 `//` 주석 줄이다. production 로직 · 식별자 · 함수 시그니처 · 상수값 · export 목록 변경 **0 LOC**. 검증: `git diff -U0 | grep -E "^[+-]" | grep -vE "^(\+\+\+|---)" | grep -vcE "^[+-]\s*//"` 가 `0` 을 보고.
- [ ] **줄바꿈 최소화**: 이름 병기로 줄이 길어지면 같은 주석 블록 안에서만 인접 1~2 줄 재줄바꿈을 허용한다 (주변 ~100 char wrap 스타일 유지). 문장 추가 · 문단 재작성 · 어순 재배치 금지 — diff 를 9 곳 주변으로 국소화한다.
- [ ] **happy-path test**: 본 task 는 주석 문자열만 바꾸므로 **신규 · 변경 public symbol 0** 이라 신규 happy-path test 대상이 없다 (slice 1~3 선례). 대신 대응 기존 spec (`export-artifact-descriptor.spec.ts` · `import-chunk-upload-progress.spec.ts` · `import-restore-result.spec.ts` · `export-import-audit.spec.ts` · `export-import-audit-message.spec.ts`) 전량 pass 를 확인한다.
- [ ] **error path test**: 위 spec 들의 기존 error-path test (잘못된 입력 · 빈 payload · 의존성 실패 등) 가 **무회귀 pass**. 신규 error 경로 도입 0 이라 신규 test 불요.
- [ ] **분기 cover**: 신규 · 변경 분기 **0** (주석만 변경) — 신규 branch test 없음. 기존 branch coverage 수치가 변하지 않음을 `pnpm test:cov` 결과로 확인.
- [ ] **negative cases**: 신규 예외 상황 (권한 부족 · 빈 입력 · 경계값 · type mismatch · 의존성 실패 · 비정상 시퀀스) 도입 0 — 기존 negative test 전량 무회귀 pass 로 충족.
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 통과 + `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] 변경 범위 확인: `git diff --stat` 이 **위 5 파일만** 보고 (spec 파일 · 다른 `src/export/*` · `src/import/*` · docs · 워크플로 수정 0).

## Out of Scope

- **`src/import/*` 의 `§5 step 12` 2 곳** (`import-restore.service.ts` 54 행 · `import-job-runner.service.ts` 55 행) — 인용 문구가 `복원 row count + 영향 요약` 이라 표의 옛 12 (Audit log) 가 아니라 **옛 13 (결과 응답) → 현 15** 를 가리키는 선행 drift 다. audit 4 곳과 같은 판정으로 묶으면 오답 — 별 slice 에서 이름 기준으로 판정한다. 본 slice 에서 **건드리지 않는다**.
- 나머지 잔여 §5 step 참조 — step 7 계열 (`import-restore-preview.ts` 3 · `import-restore-plan.ts` 1 · `import-restore-plan-summary.ts` 2 · `import-restore-failure-message.ts` 1 · `import-merge-conflict.ts` 1 · `import-dump-validate.ts` 1) · step 2 계열 (`import-restore-confirmation.ts` 2 · `import-mode-description.ts` 2 · `export-dump-size-estimate.ts` 2 · `export-scope-description.ts` 1 · `src/import/import.controller.ts` 2) · step 5 계열 (`export-dump-checksum.ts` 2 · `export-access-denial-message.ts` 1) — 는 후속 slice 책임. "지나가다 보이니 같이" 고치지 않는다 ([CLAUDE.md](../../CLAUDE.md) §3).
- **spec 파일 수정** — 5 대응 spec 의 `describe`/`it` 문자열 · 단언 · 주석 전부 무변경. 주석 리터럴 drift-guard spec 신설도 본 slice 밖.
- production 로직 · DTO · 반환 shape · 상수 · export 목록 변경 — 주석-only 원칙 위반.
- UC-07 문서 자체 수정 (§5 mermaid · §5.1 표 · 판정 규약 · `step 수 17` 문장) — **read-only**. 표가 틀렸다고 판단되면 고치지 말고 Follow-ups 에 적는다.
- 같은 주석 안의 `§8 (a)(c)` · `§8 (b)(e)` · `T-0438` · `T-0443` · `T-0453` · `T-0454` 인용 재정비 — 본 slice 는 **§5 step 번호만** 건드린다.
- 주석의 영어화 · 전면 재작성 · 어휘 개선 목적 편집 — §12 정합 유지.

## Suggested Sub-agents

`implementer` (9 곳 국소 주석 치환 — 판정 A 5 곳 / 판정 C 4 곳, 붙어쓰기 `step13` 2 곳 + 이름 중복 병기 회피 1 곳 주의) → `tester` (R-110 의무: `pnpm lint && pnpm build && pnpm test` + `pnpm test:cov`, 신규 spec 추가 0 이 정당한지 diff 로 확인).

## Follow-ups

<!-- 비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append -->
