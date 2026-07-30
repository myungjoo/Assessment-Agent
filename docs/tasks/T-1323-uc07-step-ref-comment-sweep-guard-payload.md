---
id: T-1323
title: UC-07 §5 step 참조 주석 sweep slice 7 — AuthModule guard · payload 검증 Note · 복합 인용 6 곳 (옛 step 5 · 7 · 7·11 → 현 8 · 9 · 9·13)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-030]
estimatedDiff: 22
estimatedFiles: 5
created: 2026-07-30
independentStream: uc07-step-ref-comment-sweep
dependsOn: [T-1316, T-1317, T-1318, T-1319, T-1320, T-1321, T-1322]
touchesFiles:
  - src/export/export-access-denial-message.ts
  - src/export/export-dump-checksum.ts
  - src/export/import-dump-validate.ts
  - src/export/import-restore-failure-message.ts
  - src/export/import-restore-plan.ts
plannerNote: "T-1322 Out of Scope 잔여 — guard/payload/복합 6 곳(옛 5·7·7·11 → 현 8·9·9·13). pr, 22 LOC / 5 파일"
---

# T-1323 — UC-07 §5 step 참조 주석 sweep slice 7 (AuthModule guard · payload 검증 Note · 복합 인용)

## Why

[T-1316](T-1316-uc07-step-count-and-mapping-table.md) 이 박제한 [UC-07](../use-cases/UC-07-export-import.md) `§5.1 step 번호 · 이름 대응표` 를 소비하는 주석 sweep 의 **7 번째이자 사실상 마지막 판정 slice** 다. slice 1~6 ([T-1317](T-1317-uc07-step-ref-comment-sweep-chunk-stream.md) ~ [T-1322](T-1322-uc07-step-ref-comment-sweep-confirmation.md)) 이 판정 A(→ 현 17) · B/D/F/H(→ 현 4) · C(→ 현 14) · E(→ 현 15) 계열을 닫았고, origin/main `4398ae31` 실측 잔여는 **8 곳** 뿐이다 (`§5 step 7` 3 곳 · `§5 step 5` 3 곳 · `§5 step 2` 2 곳).

본 slice 는 그중 **인용 문구로 판정이 확정되는 6 곳 / 5 파일** 만 잘라낸다. 나머지 2 곳 (`src/import/import.controller.ts`) 은 [T-1321](T-1321-uc07-step-ref-comment-sweep-dialog-result.md) · T-1322 가 연속으로 격리한 미확정 항목이라 본 slice 에서도 Out of Scope 로 둔다 (5 파일 cap 도 이미 정확히 소진). PLAN P5 의 UC-07 문서 ↔ 코드 주석 정합 유지 (REQ-030) 를 잇는다.

## 판정표 (실측 6 곳 / 5 파일 — origin/main `4398ae31`)

옛 번호를 **기계적으로 +2 하지 말고** §5.1 판정 규약대로 **주석이 인용한 이름** 으로 판정했다. 아래 3 판정은 이미 확정된 결론이므로 실행 중 재추론하지 말 것.

### 판정 I — AuthModule guard → 현 step 8 (1 곳)

| 파일:행 | 현 문자열 | 판정 근거 |
| --- | --- | --- |
| `src/export/export-access-denial-message.ts:7` | `§5 step 5 AuthModule guard` | 인용이 `AuthModule guard` = §5 mermaid 78 행 `BackendAPI->>AuthModule: 인증·권한 검증` = **현 8** (표의 이전 번호 = 6). 옛 5 는 `WebUI->>BackendAPI 본 요청` 이라 **선행 drift** — +2 (= 7) 도 오답. 인접 문맥 (§7.1 401 / §7.2 403 안내) 도 현 8 에 붙은 `Note over AuthModule` 과 정확히 일치. |

교체 결과: `§5 step 8 (인증 · 권한 검증)`.

### 판정 G — payload 검증 Note 계열 → 현 step 9 (3 곳 / 2 파일)

| 파일:행 | 현 문자열 | 판정 근거 |
| --- | --- | --- |
| `src/export/export-dump-checksum.ts:5` | `§5 step 5 Note("Import: file 무결성 hash — REQ-030, REQ-032")` | 괄호 안 축자 인용이 §5 mermaid 82 행 `Note over AssessmentModule: payload 검증 … Import: file schema version / 크기 한계 / 무결성 hash — REQ-030, REQ-032` 다. 이 Note 는 `BackendAPI->>AssessmentModule: exportDump/importRestore 호출` = **현 9** (이전 7) 에 붙는다. 옛 5 표기는 선행 drift. |
| `src/export/export-dump-checksum.ts:168` | `UC-07 §5 step 5 Note / §7.4 정합:` | 위와 같은 Note 를 축약 참조 — 동일 판정. |
| `src/export/import-dump-validate.ts:6` | `UC-07 §5 step 7 payload` + 다음 줄 `검증, §7.4 …` (줄바꿈으로 갈림) | 인용 `payload 검증` 이 같은 Note. 옛 7 = `exportDump/importRestore 호출` 이라 표 lookup (이전 7 → 현 9) 과 이름 판정이 **일치** — drift 없음. T-1322 가 "같은 `step 7` 문자열이나 payload 검증 Note 계열 = 현 9" 로 Out of Scope 에 박제한 항목의 주인. |

교체 결과: `§5 step 9 Note (payload 검증)` 형태 (168 행처럼 문맥이 이미 `Note` 를 말하면 번호만 교체해도 됨 — 아래 AC 참조).

### 판정 J — 복합 인용 `step 7·11` → 현 `step 9·13` (2 곳 / 2 파일)

| 파일:행 | 현 문자열 | 판정 근거 |
| --- | --- | --- |
| `src/export/import-restore-failure-message.ts:9` | `(§5 step 7·11 / §8 (b)(c) 정합)` | 두 옛 번호 모두 표 이전 번호 열에 정확히 대응 — 옛 7 = `exportDump/importRestore 호출` → **현 9**, 옛 11 = `복원 row count 또는 rollback error` → **현 13**. 즉 이 복합 인용은 "복원 실행 구간의 시작·끝" 을 가리키므로 두 끝점을 각각 표로 옮기면 의미가 보존된다 (drift 없음). |
| `src/export/import-restore-plan.ts:11` | `(UC-07 §5 step 7·11, §6.2, §8 (a) 게이트된 후속 sub-slice 책임)` | 동일 복합 인용 · 동일 판정. |

교체 결과: `§5 step 9·13` (`·` 결합 형태 그대로 보존).

## Required Reading

- `docs/use-cases/UC-07-export-import.md` — §5 mermaid (69~99 행) + `§5.1 step 번호 · 이름 대응표` + 판정 규약 (기계적 +2 금지).
- `docs/tasks/T-1322-uc07-step-ref-comment-sweep-confirmation.md` — 직전 slice 의 Out of Scope 3 종 (본 task 가 그중 2 종을 인수).
- `src/export/export-access-denial-message.ts` — 4~10 행 주석 블록.
- `src/export/export-dump-checksum.ts` — 3~8 행 · 166~170 행 주석 블록.
- `src/export/import-dump-validate.ts` — 4~10 행 주석 블록 (참조가 두 줄로 갈려 있음).
- `src/export/import-restore-failure-message.ts` — 1~12 행 주석 블록.
- `src/export/import-restore-plan.ts` — 9~14 행 주석 블록.

## Acceptance Criteria

- [ ] 위 판정표 6 곳을 각각 판정 I (→ `step 8`) · G (→ `step 9`) · J (→ `step 9·13`) 대로 교체한다. **판정을 실행 중 재추론하지 말 것** — 표가 정본이다.
- [ ] **기계적 +2 미사용** — 판정 I · G 의 옛 `step 5` 는 선행 drift 라 +2 (= 7) 가 오답임을 확인한다 (§5.1 판정 규약의 실례).
- [ ] **이름 중복 병기 회피** — 문맥이 이미 대상 step 의 이름을 말하고 있으면 (예: `export-dump-checksum.ts:168` 의 `step 5 Note / §7.4 정합`, `import-dump-validate.ts:6` 의 다음 줄 `검증`) **번호만 교체** 하고 이름을 덧붙이지 않는다. 짧은 나열형 참조 (예: `export-access-denial-message.ts:7` 의 `AuthModule guard`) 는 T-1321 선례대로 이름 병기 (`step 8 (인증 · 권한 검증)`) 를 허용한다.
- [ ] **축자 인용 보존** — `export-dump-checksum.ts:5` 의 `Note("Import: file 무결성 hash — REQ-030, REQ-032")` 괄호 인용 문자열은 글자 그대로 유지한다 (번호만 교체).
- [ ] **복합 인용 형태 보존** — 판정 J 2 곳은 `step 9·13` 처럼 `·` 결합 단일 참조를 유지한다. 두 참조로 쪼개거나 범위 표기 (`9~13`) 로 바꾸지 않는다.
- [ ] 주석 재줄바꿈은 **필요한 줄에 한해** 허용 (기존 80~100 char 폭 유지). 인접 문장의 의미 변경 0.
- [ ] **주석-only 게이트**: `git diff -U0 origin/main -- src/` 결과의 추가/삭제 줄이 **전부 `//` 주석 줄** 임을 확인한다 (production 로직 0 LOC 변경).
- [ ] 검증 grep — 공백 유무 양쪽 (`step 5` / `step5` 등) 을 본다:
  - `git grep -nE "§5 step ?5" -- "src/export/*" "src/import/*"` → **0 hit**
  - `git grep -nE "§5 step ?7" -- "src/export/*" "src/import/*"` → **0 hit**
  - `git grep -nE "§5 step ?8" -- "src/export/*"` → 1 hit, `§5 step ?9` → 3 hit, `step 9·13` → 2 hit
  - `git grep -nE "§5 step ?2" -- "src/import/*"` → 2 hit (Out of Scope 로 남기는 `import.controller.ts` 2 곳 — 그대로여야 정상)
- [ ] **R-112**: 본 task 는 주석 전용 변경이라 **신규 public symbol 0 · 신규 분기 0** — happy-path / error path / 분기 / negative cases 각각에 대응하는 **신규 test 대상이 없다** (T-1314 · T-1317~T-1322 선례). 대신 기존 spec 무회귀로 대체 검증한다:
  - `pnpm lint && pnpm build` 통과.
  - `pnpm test` 전량 통과 (특히 `export-access-denial-message.spec.ts` · `export-dump-checksum.spec.ts` · `import-dump-validate.spec.ts` · `import-restore-failure-message.spec.ts` · `import-restore-plan.spec.ts`).
  - `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- **`src/import/import.controller.ts` 38 · 347 행의 `§5 step 2`** — mode 설명 목록 endpoint 가 현 2/3 (import preview 왕복) 을 가리키는지 현 4 (mode 선택 dialog) 를 가리키는지 인용만으로 확정 불가. T-1321 · T-1322 가 연속 격리한 항목이며 본 slice 도 5 파일 cap 을 정확히 소진하므로 그대로 남긴다 (마지막 후속 slice 또는 판정 확정 후 처리).
- 이미 정정 완료된 참조 (`step 17` 34 곳 · `step 4` 17 곳 · `step 14` 4 곳 · `step 15` 2 곳) 의 재수정 · 표현 통일.
- `docs/use-cases/UC-07-export-import.md` 본문 · §5.1 표 수정 (과도기 표 제거는 sweep 완결 후 별건).
- `docs/use-cases/UC-08-*.md` 의 step 수 정합 (16 vs 14) — 별건.
- spec 파일 본문 수정 · drift-guard smoke 신설 · 주석 외 리팩터 · 신규 helper.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 append)

## 완료 기록

- **완료 시각**: 2026-07-30T14:50:42Z (PR [#1204](https://github.com/myungjoo/Assessment-Agent/pull/1204) squash merge `cf6d230c`)
- **결과**: 5 파일 6 곳 주석 전용 정정 (+6/-6, production 로직 0 LOC). 판정 I (`export-access-denial-message.ts:7` guard → 현 **8**) 1 곳 · 판정 G (payload 검증 Note 계열 → 현 **9**) 3 곳 · 판정 J (복합 인용 `step 7·11` → 현 **9·13**) 2 곳. 축자 인용과 `·` 결합 형태를 보존했고, 문맥이 이름을 이미 말하는 5 곳은 번호만 교체했다.
- **검증**: reviewer APPROVE round 1 + PR comment 외부 post + integrator 자체 점검 + CI green = 4-게이트 PASS. 428 suite / 12271 test 전량 pass, line 99.95% · function 100%.
- **AC 문구 주석**: 검증 grep 의 `§5 step ?9` 기대치 "3 hit" 은 실측 **5 hit** — 같은 정규식이 판정 J 의 `step 9·13` 2 곳을 함께 매칭하기 때문 (5 = 3 + 2). 편집 누락·초과가 아니라 AC 문구의 정규식 해상도 문제이며, PR 본문·reviewer comment 에 자진 박제했다.
- **잔여**: `src/import/import.controller.ts` 38 · 347 행의 `§5 step 2` 2 곳 — 종결 slice [T-1324](T-1324-uc07-step-ref-comment-sweep-final-modes.md) 가 blame 근거로 판정 확정해 닫는다.
