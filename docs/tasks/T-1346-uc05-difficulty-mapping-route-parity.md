---
id: T-1346
title: UC-05 문서의 difficulty-mapping route 표기를 실 controller 와 정합 (67 · 184 행)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-049, REQ-050]
estimatedDiff: 8
estimatedFiles: 2
created: 2026-07-31
independentStream: uc-doc-route-parity
dependsOn: [T-1345]
touchesFiles:
  - docs/use-cases/UC-05-llm-config.md
  - docs/tasks/T-1346-uc05-difficulty-mapping-route-parity.md
plannerNote: "T-1345 Follow-ups 가 유일 잔여로 지목한 UC-05 step 2 서술 — route 표기 2 곳이 실 controller 와 불일치"
---

# T-1346 — UC-05 문서의 difficulty-mapping route 표기를 실 controller 와 정합 (67 · 184 행)

## Why

[T-1345](T-1345-api-doc-uc05-crossref-method-scope.md) 가 `docs/architecture/api.md` § 7 표의 route 실재 재검증 축을 종결하면서, Follow-ups 마지막 줄에 **유일한 잔여 관심사** 로 `docs/use-cases/UC-05-llm-config.md` step 2 서술의 difficulty-mapping 표기를 지목했다. planner 가 실측한 결과 그 지목은 실 gap 이며, 부류는 **route 표기 불일치 2 곳** 이다.

UC-05 는 67 행 (§ 5 sequence diagram 의 WebUI→BackendAPI 화살표) 과 184 행 (§ component/module 매핑 표 Backend API 행) 두 곳에서 매핑 route 를 `` `PATCH /api/llm/difficulty-mapping` `` 로 적는다. 실 controller 는 `src/llm/difficulty-mapping.controller.ts` 의 `@Controller("api/llm/difficulty-mappings")` (**복수형**) + `@Patch(":difficulty")` 라서 실 route 는 `PATCH /api/llm/difficulty-mappings/:difficulty` 다 — **단복수와 path parameter 둘 다** 어긋나 있어, 문서만 보고 프런트엔드 호출을 작성하면 404 가 난다. 같은 184 행이 LlmModule 책임을 `provider · 매핑 CRUD` 로 적는 것도 매핑 쪽에는 과대 표기다 (매핑은 `GET` 조회 + `PATCH /:difficulty` 재지정 **2 종뿐** — 슬롯 easy/medium/hard 3 개가 고정이라 `POST` · `DELETE` 가 없다, T-1345 가 api.md 189 행에 박제한 사실과 동일).

본 slice 는 그 두 행만 실측에 맞춰 고쳐 UC 문서 ↔ 구현 parity 를 닫고, T-1345 가 남긴 마지막 잔여를 종결한다.

## Required Reading

- `docs/use-cases/UC-05-llm-config.md` **67 행** — 수정 대상 1. 현재 전문:
  `    WebUI->>BackendAPI: POST·PATCH·DELETE /api/llm/providers 또는 PATCH /api/llm/difficulty-mapping + payload`
  mermaid sequence diagram 블록 **안** 이다. 화살표 문법 (`WebUI->>BackendAPI:`) · 들여쓰기 · `POST·PATCH·DELETE /api/llm/providers` 부분 · 끝의 `+ payload` 는 **불변** — `PATCH /api/llm/difficulty-mapping` 토큰만 실 route 로 교체한다.
- `docs/use-cases/UC-05-llm-config.md` **184 행** — 수정 대상 2. component/module 매핑 표의 `Backend API` 행. 셋째 셀 안의 `` `PATCH /api/llm/difficulty-mapping` `` 토큰과 `provider·매핑 CRUD` 표현이 대상. **첫 셀 (`Backend API`) · 둘째 셀 (`AuthModule (guard) + LlmModule (controller + service)`) · REQ 링크 나열 · 마지막 문장 (`다른 UC 는 LlmModule 의 LLMGateway 호출 wrapper 만 사용`) 은 불변.**
- `docs/architecture/api.md` **121 · 122 · 189 행** — 정본 pointer. 121 = `GET /api/llm/difficulty-mappings`, 122 = `PATCH /api/llm/difficulty-mappings/:difficulty`, 189 행 = T-1345 가 박제한 method 범위 구절 (문체 참고용). **읽기 전용 — 수정 금지.**
- 실측 명령 3 종 (executor 가 직접 실행해 본문 주장을 재확인한다 — 불일치 시 **실측이 정본**):
  - `git grep -n "@Controller(\|@Get(\|@Patch(\|@Post(\|@Delete(" -- src/llm/difficulty-mapping.controller.ts` → `@Controller("api/llm/difficulty-mappings")` · `@Get()` · `@Patch(":difficulty")` **3 개만** (`@Post` · `@Delete` 0).
  - `grep -n "difficulty-mapping" docs/use-cases/UC-05-llm-config.md` → 편집 전 **2 hit (67 · 184 행)**. 행 번호 drift 시 실측 행 번호를 따르고 Follow-ups 에 기록.
  - `sed -n '67p;184p' docs/use-cases/UC-05-llm-config.md` → 편집 대상 두 행 전문 확인.

## Acceptance Criteria

- [ ] **67 행 route 토큰 교체** — `PATCH /api/llm/difficulty-mapping` → `PATCH /api/llm/difficulty-mappings/:difficulty`. 같은 행의 provider route 나열 · 화살표 문법 · 들여쓰기 · `+ payload` 는 그대로 둔다. mermaid 블록이라 backtick 코드 마크업을 **새로 넣지 않는다** (기존 행에 없으므로).
- [ ] **184 행 2 요소 수정** — (a) `` `PATCH /api/llm/difficulty-mapping` `` → `` `GET·PATCH /api/llm/difficulty-mappings[/:difficulty]` `` 형태로 실 route 와 method 범위를 함께 표기 (표기 문법은 api.md 189 행 선례를 따른다), (b) `provider·매핑 CRUD` 과대 표기 보정 — 매핑은 조회 (`GET`) + 슬롯 재지정 (`PATCH /:difficulty`) **2 종뿐이고 신설 (POST) · 삭제 (DELETE) 는 없다** 는 한 구절 + 사유 (슬롯 easy/medium/hard 3 개 고정) + 정본 pointer (`api.md § 5 121~122 행`) 를 셀 안에 인라인으로 append. 셀 밖 새 문단 신설 금지.
- [ ] **mermaid 블록 무손상** — 편집 후 67 행이 여전히 **한 줄** 이고 (줄바꿈 삽입 금지), `grep -c '^```mermaid' docs/use-cases/UC-05-llm-config.md` 가 편집 전후 동일하다.
- [ ] **표 구조 무손상** — 편집 후 `awk 'NR==184{print gsub(/\|/,"|")}' docs/use-cases/UC-05-llm-config.md` 가 **4** 로 편집 전과 동일하고 (컬럼 증감 · 행 병합 금지), `wc -l docs/use-cases/UC-05-llm-config.md` 가 편집 전후 모두 **225** 다.
- [ ] **검증 grep** — (a) `grep -n "difficulty-mapping" docs/use-cases/UC-05-llm-config.md | grep -v "difficulty-mappings"` 결과가 **0 hit** (단수형 잔재 0 — `setDifficultyMapping` 은 camelCase 라 본 grep 에 걸리지 않는다), (b) `grep -c "difficulty-mappings" docs/use-cases/UC-05-llm-config.md` = **2**, (c) `git diff --stat` 이 `docs/use-cases/UC-05-llm-config.md` · 본 task 파일 **2 개만** 보이고 UC-05 의 `git diff` hunk 가 **67 행 · 184 행 2 개뿐** 이다.
- [ ] **다른 서술 불변** — 5 행 · 19 행 · 27 행 · 39 · 40 행 · 51 행 · 71 행 (`setDifficultyMapping` service 메서드명) · 72 행 (`3 슬롯 모두 채움` invariant) · 100 행 · 108 행 (§ 6.2) 은 diff 에 등장하지 않는다. 서비스 메서드명 (`setDifficultyMapping`) 은 코드 식별자라 단수형 그대로 두는 것이 정상이다.
- [ ] **api.md 불변** — 본 slice 는 use-case 문서 축이다. `docs/architecture/api.md` 는 `git status --porcelain` 에 등장하지 않는다.
- [ ] `src/` · `test/` · `web/` · `prisma/` · `docs/requirements.md` · `docs/architecture/*` · 그 외 어떤 파일도 수정하지 않는다 (§3.1 rule 3 — direct task 는 doc 만). `git status --porcelain` 결과가 위 2 파일뿐 (driver 의 STATE/journal bookkeeping 제외).
- [ ] doc-only 라 R-110 tester 면제 (production code 0 LOC · 신규 symbol/분기 0 → R-112 신규 test 대상 없음, [T-1340](T-1340-api-doc-uc07-crossref-placeholder.md) ~ [T-1345](T-1345-api-doc-uc05-crossref-method-scope.md) 선례) — 대신 위 검증 grep + 구조 self-check 로 대체한다. `pnpm lint` 는 doc 변경 무영향이라 실행 불요.

## Out of Scope

- **`POST` · `DELETE /api/llm/difficulty-mappings` 실 구현** — 슬롯 고정 설계 (3 난이도) 를 바꾸는 결정이라 ADR + `pr` 소관. 본 task 는 **문서를 현실에 맞추는 것** 이지 그 반대가 아니다.
- **`docs/architecture/api.md` 재수정** — 121 · 122 · 189 행은 T-0139 · T-1345 가 확정했다. 본 slice 는 pointer 로만 참조한다.
- **UC-05 § 6.2 (108 행 이하) 매핑 서술 확장** — 본 slice 는 route 표기 parity 만 닫는다. § 6.2 본문의 슬롯 invariant 서술은 별개 판단이며 실 gap 이 확인되지 않았다.
- **72 행 `3 슬롯 모두 채움` invariant 문구 손질** — PATCH 가 슬롯 단위 재지정인 점과 invariant 서술의 관계는 별도 판단 대상. 본 slice 에서 건드리면 diff 축이 흐려진다 (필요하면 Follow-ups → 별도 task).
- **다른 UC 문서 (UC-01 ~ UC-04 · UC-06 ~) 의 route 표기 전수 재검증** — 축이 다르고 크기 상한을 넘긴다. UC-05 에서 같은 부류 gap 이 확인되면 Follow-ups 에 1 줄만 남긴다.
- **`docs/requirements.md` REQ-049 · REQ-050 문구 수정** — 요구사항 정본이라 문서 parity slice 의 대상이 아니다.
- **use-case 문서 § 5 step 수 선언 재계산** — [T-1327](T-1327-uc-doc-step-count-parity.md) 이 확정했고 본 편집은 step 수를 바꾸지 않는다.

## Suggested Sub-agents

`implementer` (doc-only · UC-05 2 행 인라인 수정 — architect · tester 불요, T-1340 ~ T-1345 선례)

## Follow-ups

(비어 있음 — sub-agent 가 작업 중 발견한 관련 작업을 여기에 append)
