---
id: T-1709
title: 오너 지시 2 건(계정 생성 UX · 평가 대상 관리 UI)을 requirements.md REQ row 로 동기 (REQ-067~REQ-073)
phase: P6
status: PENDING
commitMode: direct
coversReq: [REQ-067, REQ-068, REQ-069, REQ-070, REQ-071, REQ-072, REQ-073]
estimatedDiff: 20
estimatedFiles: 1
independentStream: req-traceability-sync
dependsOn: []
touchesFiles:
  - docs/requirements.md
created: 2026-08-26
plannerNote: P6 — 오너 신규 지시 2 건(PLAN 129~130 행)이 명시한 선행 step. README 154~168 행 신규 섹션을 REQ-067~REQ-073 7 row 로 동기
---

# T-1709 — 오너 지시 2 건을 requirements.md REQ row 로 동기 (REQ-067~REQ-073)

## Why

오너가 2026-08-26 에 직접 push 한 commit `9485c923` 가 [README.md](../../README.md) `154~168 행` 에
신규 섹션 **"계정·평가 대상 관리 UX"** 를 추가했고, 같은 지시가 [PLAN.md](../PLAN.md) `129~130 행` 에
🔴 bullet 2 건으로 등록됐다. 두 bullet 모두 planner 지시로 **"README 신규 R-158~R-160 / R-164~R-168 을
requirements.md REQ row 로 동기 후 task 분해"** 를 명시하므로, 분해보다 **REQ row 동기가 선행 slice** 다.

여기서 `R-NNN` 은 REQ ID 가 아니라 **README 행 번호** 표기다 (본 저장소의 `docs/requirements.md` 는
`README 행` 컬럼으로 추적한다). 실측 결과 README 총 168 행이고 신규 지시 문장은 `158`·`159`·`160`
(계정 생성 UX) 과 `164`·`165`·`166`·`167`·`168` (평가 대상 관리 UI) 에 정확히 위치해 PLAN 의
`R-158~R-160` / `R-164~R-168` 표기와 **일치** 한다. 한편 [requirements.md](../requirements.md) 의 매핑 표는
현재 `REQ-001` ~ `REQ-066` 66 row 이며 위 신규 지시에 대응하는 row 가 **0 개** (grep 으로 확인) 라 미동기
상태다. 따라서 신규 채번은 `REQ-067` 부터 충돌 없이 이어진다.

본 slice 는 `docs/requirements.md` 1 파일만 건드리는 doc-sync 다 (코드 변경 0 → `commitMode: direct`).
실제 UI·API 구현은 본 task 가 박제한 REQ row 를 `coversReq` 로 참조하는 **후속 분해 task** 소관이다.

## Required Reading

- [README.md](../../README.md) `152~168 행` — 오너 신규 섹션 원문 (계정 생성 UX 3 문장 + 평가 대상 관리 UI 5 문장).
- [docs/requirements.md](../requirements.md) `12 행` (P1-Entry 66 row 서술), `16~19 행` (7 컬럼 schema 설명 + 표 헤더 + 구분선), `80~85 행` (`REQ-061` ~ `REQ-066` 마지막 6 row — 신규 row 를 이어 붙일 위치와 row 포맷 선례).
- [docs/requirements.md](../requirements.md) `§ 매핑 표 갱신 룰` 직후의 **T-1470 (`§ 12.68`) pointer 판정 각주** — "산문 13 지점 + 매핑 표 `README 행` 컬럼 66 지점 = 79" 산술이 담긴 문단 (row 추가 시 stale 해지는 숫자).
- [docs/PLAN.md](../PLAN.md) `129~130 행` — 오너 🔴 bullet 2 건 (본 task 가 집행하는 선행 step 문장 포함).
- [CLAUDE.md](../../CLAUDE.md) `§12 범위 좌표 표기` — 행 범위 구분자는 물결 `~` 하나, 단일 행은 `164~164` 로 적지 않음. 신규 작성분부터 적용이며 **기존 row 의 `117-128` 같은 표기는 소급 치환 금지**.

## Acceptance Criteria

- [ ] [docs/requirements.md](../requirements.md) 매핑 표의 `REQ-066` row 바로 다음에 아래 **7 row** 를 7 컬럼 schema
      (`REQ | README 행 | 요약 | kind | 구현 위치 (phase/task) | 검증 위치 | 상태`) 로 추가한다. 각 row 의
      `README 행` 값은 괄호 안 그대로:
  - `REQ-067` (158) — 계정 생성 화면의 아이디·암호 조건 사전 안내 (허용 문자·형식·최소/최대 길이).
  - `REQ-068` (159) — 계정 생성 실패 시 어떤 입력이 어떤 조건을 위반했는지 구체 사유 표시. 포괄 오류 문구 1 개로 뭉뚱그리기 금지.
  - `REQ-069` (160) — 아이디 중복 오류와 형식/길이 위반 오류를 구분해 표시.
  - `REQ-070` (`164~165`) — 로그인 직후 빈 상태에서 막히지 않도록 평가 대상 추가·편집 인터페이스 제공.
  - `REQ-071` (166) — 평가 대상 인원의 추가/삭제/변경/Deactivate/Activate 를 Web UI 에서 수행.
  - `REQ-072` (167) — 평가 대상 시스템 등록·편집 (GitHub organization/repository, Confluence base URL·SPACE).
  - `REQ-073` (168) — 평가 대상 편집은 Admin 등급만, User 등급은 조회만 (RBAC 일관).
- [ ] 7 row 의 `kind` 는 enum (`FR` / `NFR` / `Constraint`) 값만 쓴다 — `REQ-067` ~ `REQ-072` 는 `FR`,
      권한 제약인 `REQ-073` 은 `NFR`. `상태` 는 7 row 모두 `PLANNED` (PLAN bullet 등록 · 대응 task 미착수).
      `구현 위치` 컬럼에는 대응 PLAN bullet 좌표를 명시한다 (`REQ-067` ~ `REQ-069` → `P6 (PLAN 129 행)`,
      `REQ-070` ~ `REQ-073` → `P6 (PLAN 130 행)`).
- [ ] `README 행` 값이 실제 README 와 일치함을 검증한다:
      `grep -n "" README.md | sed -n '158p;159p;160p;164p;165p;166p;167p;168p'` 출력의 각 행 주제가
      대응 REQ 요약과 일치 (예: 158 행 = 조건 사전 안내, 168 행 = Admin 편집 / User 조회).
- [ ] 신규 row 의 범위 표기는 `164~165` 처럼 물결 `~` 하나를 쓰고, 단일 행은 `158` 로 적는다 (`158~158` 금지 — CLAUDE.md §12).
      **기존 row 의 `117-128` 표기는 건드리지 않는다** (소급 치환 금지).
- [ ] `docs/requirements.md` `12 행` 의 "66 REQ row 모두 ... 분류 완료" 서술이 stale 해지지 않도록
      **"P1-Entry (T-0013) 시점 66 row"** 임을 명시하고 "이후 README 추가분은 `REQ-067` 부터 승계" 한 문장을 덧붙인다
      (문장 전면 재작성 금지 — 최소 inline amend).
- [ ] T-1470 pointer 판정 각주의 census 산술을 정정한다: 매핑 표 `README 행` 컬럼 `66 지점` → `73 지점`,
      합계 `79` → `86`. **산문 13 지점의 전수 판정 결과 (참 11 · 부분참 2 · 거짓 0) 는 변경하지 않는다**
      (본 task 는 산문 pointer 를 추가하지 않으므로 판정 모수 불변).
- [ ] `grep -c "^| REQ-" docs/requirements.md` 결과가 **73** 이다 (66 + 7).
- [ ] `git diff --name-only` 결과가 `docs/requirements.md` **단일 파일** 이다 (STATE / journal 은 driver bookkeeping 소관).
- [ ] 표 마크다운이 깨지지 않는다 — 신규 7 row 모두 파이프 `|` 8 개 (7 컬럼) 로 기존 row 와 열 수가 같다.
- [ ] R-112 test 항목: 본 task 는 `commitMode: direct` doc-only 이며 production code 변경 0 LOC 이라
      CLAUDE.md §3.2 의 unit test 의무가 **면제** 된다 (tester 미호출 정당). 분기 없음 — 해당 항목 생략.

## Out of Scope

- **backend / frontend 코드 변경 일체** — DTO 검증 메시지, 오류 응답 계약, `web/` 컴포넌트, RBAC guard 등은 후속 분해 task 소관.
- **새 ADR 작성** — 평가 대상 시스템(GitHub org/repo · Confluence SPACE) 등록 모델의 신설 여부 판단은 architect 가
  후속 task 에서 수행한다 (PLAN 130 행이 이미 "architect 판단 — ADR 동반" 으로 명시).
- **PLAN.md 수정** — 🔴 bullet 의 체크 / 문구 변경 / 하위 bullet 추가 금지. 본 task 는 bullet 이 지시한 선행 step 만 집행한다.
- **README.md 수정** — 오너가 직접 push 한 원문이므로 한 글자도 고치지 않는다.
- **use-case 문서(`docs/use-cases/UC-NN-*.md`) 신설 / REQ-COVERAGE-AUDIT 갱신** — 별도 slice.
- **기존 `REQ-001` ~ `REQ-066` row 의 상태 / 요약 / 행 좌표 갱신** — 본 task 는 append + 위에 명시한 2 개 stale 숫자 정정만.
- **후속 분해 task 파일 생성** — 한 호출 1 task 원칙. 다음 planner 호출이 REQ row 를 근거로 분해한다.

## Suggested Sub-agents

`implementer` (doc 편집 단독). doc-only direct commit 이라 `tester` / `reviewer` / `integrator` 미호출.

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 append)
