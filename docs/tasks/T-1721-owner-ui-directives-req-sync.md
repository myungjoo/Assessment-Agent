---
id: T-1721
title: 오너 지시 3 건(대시보드 실동작 · 서비스 ID 매핑 · UI 기본기)을 requirements.md REQ row 로 동기 (REQ-074~REQ-084)
phase: P6
status: DONE
commitMode: direct
coversReq: [REQ-074, REQ-075, REQ-076, REQ-077, REQ-078, REQ-079, REQ-080, REQ-081, REQ-082, REQ-083, REQ-084]
estimatedDiff: 25
estimatedFiles: 1
independentStream: req-traceability-sync
dependsOn: []
touchesFiles:
  - docs/requirements.md
created: 2026-08-26
plannerNote: P6 — 오너 신규 지시 3 건(PLAN 131~133 행)이 명시한 선행 step. README 175~191 행을 REQ-074~REQ-084 11 row 로 동기
---

# T-1721 — 오너 지시 3 건을 requirements.md REQ row 로 동기 (REQ-074~REQ-084)

## Why

오너가 2026-08-26 에 직접 push 한 commit `90bb60ca` 가 [README.md](../../README.md) `171~191 행` 에
신규 섹션 **"UI 실동작·기본기 개선 (오너 요구 2026-08-26)"** 을 추가하고, 같은 지시를
[PLAN.md](../PLAN.md) `131~133 행` 에 🔴 bullet 3 건 (① 대시보드 실동작 ② 인원별 서비스 ID 매핑
③ UI 기본기) 으로 큐잉했다. 세 bullet 모두 planner 지시로 **"REQ row 동기 후 task 분해"** 를 명시하므로
분해보다 **REQ row 동기가 선행 slice** 다 (직전 오너 지시 2 건을 같은 방식으로 처리한 T-1709 선례 승계).

여기서 `R-NNN` 은 REQ ID 가 아니라 **README 행 번호** 표기다. 실측 결과 README 총 191 행이고 신규 지시
문장은 `175`·`176`·`177`·`178` (대시보드 실동작) / `182`·`183` (서비스 ID 매핑) / `187`·`188`·`189`·`190`·`191`
(UI 기본기) 에 정확히 위치해 PLAN 의 `R-175~R-178` / `R-182~R-183` / `R-187~R-191` 표기와 **일치** 한다
(`171`·`173`·`180`·`185` 는 제목 행, 나머지는 빈 줄이라 REQ 대상이 아니다). [requirements.md](../requirements.md)
매핑 표는 현재 `REQ-001` ~ `REQ-073` **73 row** 이므로 신규 채번은 `REQ-074` 부터 충돌 없이 이어진다.

진행 중이던 **REQ-070 chain (T-1717~T-1720)** 과는 대상이 갈린다 — REQ-070~REQ-073 은 "평가 대상(인원·시스템)
추가·편집 인터페이스와 그 RBAC" 이고, 본 task 가 박제할 REQ-074~REQ-084 는 "대시보드 조회 동선·표시 계약",
"ServiceIdentity 매핑 CRUD", "전역 CSS·로그아웃·세션 복원·polling·오류 표시" 다. 본 slice 는 기존 row 를
재서술하지 않고 **append** 만 하여 중복을 만들지 않는다. 실제 API·UI 구현은 본 task 가 박제한 REQ row 를
`coversReq` 로 참조하는 **후속 분해 task** 소관이며, 본 slice 는 `docs/requirements.md` 1 파일만 건드리는
doc-sync 다 (코드 변경 0 → `commitMode: direct`).

## Required Reading

- [README.md](../../README.md) `171~191 행` — 오너 신규 섹션 원문 (대시보드 실동작 4 문장 + 서비스 ID 매핑 2 문장 + UI 기본기 5 문장).
- [docs/requirements.md](../requirements.md) `12 행` (P1-Entry 66 row 서술 + T-1709 승계 문장), `16~19 행` (7 컬럼 schema 설명 + 표 헤더 + 구분선), `86~92 행` (`REQ-067` ~ `REQ-073` 마지막 7 row — 신규 row 를 이어 붙일 위치와 row 포맷 선례).
- [docs/requirements.md](../requirements.md) `§ 매핑 표 갱신 룰` 뒤의 **T-1470 (`§ 12.68`) pointer 판정 각주** — "산문 13 지점 + 매핑 표 `README 행` 컬럼 73 지점 = 86" 산술이 담긴 문단 (row 추가 시 stale 해지는 숫자).
- [docs/PLAN.md](../PLAN.md) `131~133 행` — 오너 🔴 bullet 3 건 (본 task 가 집행하는 선행 step 문장 포함).
- [docs/tasks/T-1709-owner-directive-req-row-sync.md](T-1709-owner-directive-req-row-sync.md) — 동형 선행 slice (REQ-067~REQ-073 동기) 의 AC 구성·row 포맷 선례.
- [CLAUDE.md](../../CLAUDE.md) `§12 범위 좌표 표기` — 행 범위 구분자는 물결 `~` 하나, 단일 행은 `175~175` 로 적지 않음. 신규 작성분부터 적용이며 **기존 row 의 `117-128` 같은 표기는 소급 치환 금지**.

## Acceptance Criteria

- [ ] [docs/requirements.md](../requirements.md) 매핑 표의 `REQ-073` row 바로 다음에 아래 **11 row** 를 7 컬럼 schema
      (`REQ | README 행 | 요약 | kind | 구현 위치 (phase/task) | 검증 위치 | 상태`) 로 추가한다. 각 row 의
      `README 행` 값은 괄호 안 그대로:
  - `REQ-074` (175) — 대시보드 화면 안에서 평가 대상 인원을 직접 선택하는 UI 제공 (안내문만 있고 선택 수단이 없는 상태 금지).
  - `REQ-075` (176) — 평가 결과 표시(테이블·상세 패널·점수 분포·시계열)가 backend 응답 필드(volume · difficulty · contributionScore · narrative · period/periodStart)와 계약 일치 + 실데이터 렌더 검증.
  - `REQ-076` (177) — 점수 분포 등 시각화의 축·구간을 실제 metricScore 스케일에 맞춤 (0–100 임의 가정 금지).
  - `REQ-077` (178) — 조회 기간(일/주/월 + 시작 시점) 지정 UI 제공 + 사용자 지정 기간 평가(POST /api/assessment-evaluation/period) UI 호출 경로.
  - `REQ-078` (182) — 인원별 서비스 ID 매핑(서비스별 ID · primary 지정 포함)의 조회·추가·수정·삭제 API 와 Admin UI 제공.
  - `REQ-079` (183) — 인원 추가/편집 동선에서 서비스 ID 매핑까지 이어서 입력 가능 (이름/email 만 입력 가능한 상태 금지).
  - `REQ-080` (187) — 전역 스타일(CSS) 도입으로 구획·간격·표 스타일이 있는 화면 + 관리 화면 다수 섹션의 탭/구획 내비게이션.
  - `REQ-081` (188) — 로그아웃 기능 제공 (backend 세션/쿠키 무효화 포함).
  - `REQ-082` (189) — 새로고침 시 유효한 세션이면 로그인 화면으로 되돌리지 않고 인증 상태 복원.
  - `REQ-083` (190) — 평가 진행 중 경고 배너의 자동 갱신(polling) 반영 + 실행 상태 조회 endpoint 신설.
  - `REQ-084` (191) — 폼 오류 등 여러 줄 안내를 줄 단위로 구분해 표시 (한 줄 합침 금지).
- [ ] 11 row 의 `kind` 는 enum (`FR` / `NFR` / `Constraint`) 값만 쓴다 — 표현 품질 요구인 `REQ-080` 만 `NFR`,
      나머지 10 row 는 `FR`. `상태` 는 11 row 모두 `PLANNED` (PLAN bullet 등록 · 대응 구현 task 미착수).
      `구현 위치` 컬럼에는 대응 PLAN bullet 좌표를 명시한다 (`REQ-074` ~ `REQ-077` → `P6 (PLAN 131 행)`,
      `REQ-078` ~ `REQ-079` → `P6 (PLAN 132 행)`, `REQ-080` ~ `REQ-084` → `P6 (PLAN 133 행)`).
- [ ] `검증 위치` 컬럼은 enum (`unit` / `smoke` / `e2e` / `perf` / `policy` / `manual` / `n/a`) 값만 쓰고 복수는 ` + ` 로 잇는다.
      권장 배치: `REQ-074`·`REQ-077`·`REQ-079`·`REQ-080`·`REQ-082` → `e2e`, `REQ-075`·`REQ-078`·`REQ-081`·`REQ-083` → `unit + e2e`,
      `REQ-076`·`REQ-084` → `unit`.
- [ ] `README 행` 값이 실제 README 와 일치함을 검증한다:
      `grep -n "" README.md | sed -n '175p;176p;177p;178p;182p;183p;187p;188p;189p;190p;191p'` 출력의 각 행 주제가
      대응 REQ 요약과 일치 (예: 175 행 = 인원 선택 UI, 191 행 = 여러 줄 안내 줄 단위 표시).
- [ ] 신규 row 의 행 좌표는 모두 단일 행이므로 `175` 처럼 적고 `175~175` 는 쓰지 않는다 (CLAUDE.md §12).
      **기존 row 의 `117-128` 표기는 건드리지 않는다** (소급 치환 금지).
- [ ] `docs/requirements.md` `12 행` 의 승계 문장에 본 task 를 한 구절로 덧붙인다 —
      "T-1721 이 오너 2026-08-26 UI 지시분을 `REQ-074` ~ `REQ-084` 로 승계" (문장 전면 재작성 금지 — 최소 inline amend).
- [ ] T-1470 pointer 판정 각주의 census 산술을 정정한다: 매핑 표 `README 행` 컬럼 `73 지점` → `84 지점`,
      합계 `86` → `97`. **산문 13 지점의 전수 판정 결과 (참 11 · 부분참 2 · 거짓 0) 는 변경하지 않는다**
      (본 task 는 산문 pointer 를 추가하지 않으므로 판정 모수 불변).
- [ ] `grep -c "^| REQ-" docs/requirements.md` 결과가 **84** 이다 (73 + 11).
- [ ] 기존 `REQ-070` ~ `REQ-073` row 와 신규 row 의 요약이 중복 서술되지 않는다 —
      신규 11 row 어디에도 "평가 대상 추가·편집 인터페이스 제공" / "인원 추가·삭제·Deactivate" / "대상 시스템 등록" 을
      재서술하지 않는다 (진행 중 REQ-070 chain 과 책임 경계 분리).
- [ ] `git diff --name-only` 결과가 `docs/requirements.md` **단일 파일** 이다 (STATE / journal 은 driver bookkeeping 소관).
- [ ] 표 마크다운이 깨지지 않는다 — 신규 11 row 모두 파이프 `|` 8 개 (7 컬럼) 로 기존 row 와 열 수가 같다.
- [ ] R-112 test 항목: 본 task 는 `commitMode: direct` doc-only 이며 production code 변경 0 LOC 이라
      CLAUDE.md §3.2 의 unit test 의무가 **면제** 된다 (tester 미호출 정당). 분기 없음 — 해당 항목 생략.

## Out of Scope

- **backend / frontend 코드 변경 일체** — 대시보드 인원 선택 UI, 표시 필드 계약 정합, 분포 축 스케일, 기간 지정 UI,
  ServiceIdentity CRUD API·Admin UI, 전역 CSS, 로그아웃 endpoint, 세션 부트 hydration, 실행 상태 polling,
  오류 줄 단위 표시는 모두 후속 분해 task 소관이다.
- **새 ADR 작성** — ServiceIdentity API 설계(예: `/api/persons/:id/identities`) 와 CSS 방식(순수 CSS vs 새 dep) 판단은
  architect 가 후속 task 에서 수행한다 (PLAN 132~133 행이 이미 "architect 판단 — ADR 동반" 으로 명시).
- **새 dependency 추가 검토** — CSS 라이브러리 도입 여부는 CLAUDE.md §5 BLOCKED 게이트 대상이라 본 doc-sync 가 판단하지 않는다.
- **PLAN.md 수정** — 🔴 bullet 3 건의 체크 / 문구 변경 / 하위 bullet 추가 금지. 본 task 는 bullet 이 지시한 선행 step 만 집행한다.
- **README.md 수정** — 오너가 직접 push 한 원문이므로 한 글자도 고치지 않는다.
- **REQ-070 chain (T-1717~T-1720) 관련 row 갱신** — 해당 chain 의 상태 전이는 그 chain 의 integrator / 후속 slice 소관.
- **use-case 문서(`docs/use-cases/UC-NN-*.md`) 신설 / REQ-COVERAGE-AUDIT 갱신** — 별도 slice.
- **기존 `REQ-001` ~ `REQ-073` row 의 상태 / 요약 / 행 좌표 갱신** — 본 task 는 append + 위에 명시한 2 개 stale 숫자 정정만.
- **후속 분해 task 파일 생성** — 한 호출 1 task 원칙. 다음 planner 호출이 REQ row 를 근거로 분해한다.

## Suggested Sub-agents

`implementer` (doc 편집 단독). doc-only direct commit 이라 `tester` / `reviewer` / `integrator` 미호출.

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 append)
