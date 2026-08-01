---
id: T-1381
title: requirements.md 35 행 REQ-016 Confluence 접근 권한 부족 인식·통지 상태를 실측 기반 재판정
phase: P7
status: PENDING
commitMode: direct
coversReq: [REQ-016]
estimatedDiff: 30
estimatedFiles: 2
created: 2026-08-02
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1381-requirements-confluence-permission-denied-status-rejudge.md
plannerNote: "requirements-status-resync 27 번째 slice — T-1380 Follow-up 이 지목한 REQ-016 Confluence 축, emitter·traversal chain 전수 실측 가능, doc-only direct"
---

# T-1381 — requirements.md 35 행 REQ-016 Confluence 접근 권한 부족 인식·통지 상태를 실측 기반 재판정

## Why

[docs/requirements.md](../requirements.md) 35 행 REQ-016 (README 33 행 — Confluence 수집의 "접근 권한 (read) 을 AA가 가지고 있어야 한다. 접근 권한이 모자를 경우 AA 사용자와 관리자가 인식하여 대응할 수 있어야 한다") 은 아직 상태 컬럼이 `PLANNED` 이지만, main 에는 `src/permission-denied/persisting-confluence-permission-denied-emitter.ts` 와 `src/confluence/confluence-adapter.service.ts` · `confluence-space-traversal.service.ts` 가 모두 박제돼 있어 표-코드 drift 가 남아 있다. 직전 slice T-1380 이 GitHub 축 (REQ-008) 을 `DONE` 으로 재판정하며 Follow-ups 에 "REQ-016 은 Confluence emitter + traversal skip-and-continue 가 실재하므로 동일 방식 실측 가능" 을 남겼다. `requirements-status-resync` stream 의 27 번째 slice 로 감지 · 기록·영속 · 인식 경로 3 축 + 프런트 축을 각각 직접 실측해 표를 코드베이스에 되돌린다.

## Required Reading

- `docs/requirements.md` — 35 행 (REQ-016) 및 표 헤더 (18~19 행) 의 컬럼 순서, 상태 enum (9 행). 인접 REQ-015 (34 행) · REQ-017 (36 행) 은 아직 `PLANNED` 이라 필드 수 비교용으로만 쓴다.
- `docs/tasks/T-1380-requirements-github-permission-denied-status-rejudge.md` — 직전 slice 의 상태 문자열 서술 포맷 (`DONE (implemented-on-main — <근거>)` / `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)` + `한계 —` 부기) 과 완료 기록 포맷을 그대로 따른다. **단 그 안의 실측값 (심볼명 · 행 번호 · it 개수) 을 본 task 근거로 복사하지 않는다** — GitHub 축 실측값은 REQ-008 의 근거이지 REQ-016 의 근거가 아니다. 본 task 는 Confluence 축을 처음부터 직접 실측한다.
- `README.md` 33 행 — REQ-016 원문. 축 분해 = (a) Confluence 권한 부족 **감지** (b) 그 사실의 **기록·영속** (c) **AA 사용자와 관리자 모두** 가 인식할 수 있는 노출 경로.
- `src/confluence/confluence-adapter.service.ts` — 감지 축 1. 어떤 상태 코드 · 예외 형태가 권한 부족으로 판정되고 어느 심볼이 그것을 event 로 바꾸는지 (또는 도메인 에러로만 변환하는지) 를 행 인용으로 확정한다. 추측한 심볼명 · 상태 코드 · 상수값을 적지 않는다.
- `src/confluence/confluence-space-traversal.service.ts` — 감지 축 2. 권한 부족 SPACE 를 만났을 때의 동작 (중단 / skip-and-continue) 과 emit 호출 지점을 행 인용으로 확정한다. **README 33 행이 요구하는 것은 "인식·대응" 이므로 traversal 이 조용히 건너뛰기만 하고 emit 참조가 0 이면 감지 축을 충족으로 판정하지 않는다.**
- `src/permission-denied/persisting-confluence-permission-denied-emitter.ts` — 기록·영속 축. `emit` 진입 시그니처와 record service 호출 지점, 그리고 저장되는 `provider` 값이 실제로 무엇인지 (`"confluence"` 인지) 를 행 인용으로 확정한다. 실패 흡수 (`.catch`) 유무도 그대로 적는다.
- `src/confluence/confluence.module.ts` — emitter 가 실 구현으로 바인딩되는지 (provider token 의 `useClass` / `useValue` 대상) 를 행 인용으로 확정한다. **no-op 구현에 바인딩돼 있으면 기록 축을 충족으로 판정하지 않는다.**
- `src/permission-denied/permission-denied-record.service.ts` · `permission-denied-record.controller.ts` — 인식 경로 축. 조회 route 가 provider 를 구분하지 않는 공용 경로인지 (즉 Confluence 기록도 같은 route 로 노출되는지) 를 필터 파라미터 / where 절 행 인용으로 확정한다. provider 필터가 있으면 그 파라미터명을 그대로 적는다.
- `web/src/components/PermissionDeniedRecordList.tsx` · `web/src/views/DashboardView.tsx` — 프런트 노출 축. 목록이 **Confluence provider 기록도 렌더하는지** (provider 무관 렌더인지 GitHub 전용 분기가 있는지) 를 행 인용으로 확정한다. 컴포넌트 존재만으로 충족이라고 적지 않는다.
- 검증 위치 실 근거용 — `src/permission-denied/persisting-confluence-permission-denied-emitter.spec.ts` · `src/confluence/confluence-space-traversal.service.spec.ts` · `src/confluence/confluence-adapter.service.spec.ts` 의 파일별 `it(` 개수를 직접 실측한다. 표의 검증 위치 컬럼이 `unit` 이므로 unit 밖 (smoke / e2e) 에 Confluence 권한 축 cover 가 실재하는지도 `grep -rn "permission" test/smoke test/e2e` 로 확인한다.

## Acceptance Criteria

- [ ] **감지 축 (README 33 행 "접근 권한이 모자를 경우")** 을 실측한다 — Confluence 권한 부족을 판정하는 입력 (상태 코드 · 예외 타입) 과 그것을 event 로 바꾸는 심볼을 파일 · 행 인용으로 확정하고, 수집 / traversal 경로에서 그 emit 을 실제 호출하는 지점을 1 개 이상 파일 · 행으로 인용한다. 호출 참조가 0 이면 감지 축을 충족으로 판정하지 않는다.
- [ ] **권한 부족 SPACE 의 진행 정책** 을 한 줄로 확정한다 — 중단인지 skip-and-continue 인지를 행 인용으로 적고, skip 이면 그 사실이 기록으로 남는지 (emit 동반 여부) 를 함께 적는다.
- [ ] **기록·영속 축** 을 실측한다 — emitter → record service → repository → Prisma 모델까지의 경로를 행 인용으로 확정하고, 저장되는 `provider` 값의 리터럴을 그대로 인용한다. 모델명은 `prisma/schema.prisma` 에 실재하는 이름만 인용하고 추측하지 않는다. `confluence.module.ts` 의 바인딩 대상이 실 구현인지도 행 인용한다.
- [ ] **인식 경로 축 (README 33 행 "사용자와 관리자가 인식")** 을 판정한다 — 조회 route 가 Confluence 기록을 노출하는지를 provider 필터 / where 절 행 인용으로 확정하고, 사용자 (non-Admin) 와 관리자 (Admin) 각각의 조회 가능 여부를 한 줄로 적는다. 한쪽만 가능하면 그 사실을 그대로 적는다.
- [ ] **프런트 노출 축을 별도로 판정한다** — 목록 컴포넌트의 배선 지점 (import + JSX) 을 파일 · 행으로 인용하고, Confluence provider 기록이 렌더 대상에 포함되는지를 provider 분기 유무로 확정한다. 배선 지점이 없으면 미충족으로 적고 근거 없는 서술을 덧붙이지 않는다.
- [ ] **검증 위치 컬럼의 실 근거** 를 확인한다 — 위 3 spec 파일의 `it(` 개수를 각각 실측해 경로와 개수를 상태 문자열에 인용한다. 표의 `unit` 과 실재 spec 종류가 어긋나면 (예: smoke / e2e 도 cover) 그 사실을 "한계 —" 로만 부기한다 (컬럼 값은 수정하지 않는다).
- [ ] REQ-016 (35 행) 의 상태 컬럼을 실측 결과에 따라 `PLANNED` → `DONE (implemented-on-main — <근거>)`, 일부 축만 충족 시 `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)`, 근거 부족 시 `PLANNED` 유지 + 유지 사유 부기 중 하나로 갱신한다. 근거에는 실재하는 소스 파일 경로 2 개 이상 + spec 파일 경로 1 개 이상이 포함돼야 한다.
- [ ] 실측으로 확인되지 않은 부분 (예: 감지가 cover 하지 못하는 4xx 종류 · 프런트 provider 분기 공백 · push 통지 부재) 은 상태 문자열 안에 "한계 —" 로 1~2 절 부기한다.
- [ ] `grep -n "REQ-016" docs/requirements.md` 결과에서 해당 행의 상태 컬럼이 갱신됐고, 표의 컬럼 수 (`|` 필드 수) 가 인접 행 (REQ-015 · REQ-017) 과 동일하게 유지됨을 확인한다. 상태 문자열 안에 리터럴 `|` 문자를 넣지 않는다 (T-1370 · T-1375 에서 grep 패턴의 `\|` 로 필드 수가 부풀었던 사고 재발 방지). `wc -l docs/requirements.md` = 97 과 `grep -c "^| REQ-" docs/requirements.md` 값이 편집 전후 불변임도 확인한다.
- [ ] 본 task 파일의 `status` 를 `DONE` 으로 바꾸고 완료 시각 · 결과 요약 (실측값 포함) 을 추가한다.

## Out of Scope

- **REQ-015 (34 행, Confluence 지정 SPACE 평가) 재판정** — SPACE 지정 · 수집 · 평가 배선 축은 별도 slice 다. 본 task 는 README 33 행 (권한 부족 인식·통지) 만 다룬다. traversal 실측 중 SPACE 지정 경로가 눈에 띄면 Follow-ups 에만 적는다.
- **REQ-017 (36 행, crawling vs hierarchy 탐색 정책 ADR) 재판정** — traversal 방식 자체의 정책 판정은 별도 slice 이며 ADR 필수 row 다. 본 task 는 탐색 방식을 판정 대상으로 삼지 않는다.
- 보안 · 인증 · 권한 모델 관련 **코드 변경 일체** — 감지 누락이나 배선 공백을 발견해도 고치지 않는다 (CLAUDE.md §5 상 BLOCKED 대상). 본 task 는 실측·기록만 한다.
- 상태 컬럼 외 다른 컬럼 (README 행 번호 · 요약 · kind · 구현 위치 · 검증 위치) 수정 — 검증 위치 재판정은 별도 slice 다. 근거 부재를 발견해도 컬럼 값은 건드리지 않고 상태 문자열의 "한계 —" 로만 부기한다.
- REQ-008 (27 행) 상태 문자열 재서술 또는 T-1380 Follow-ups (404 미기록 · push 통지 부재 · 검증 위치 drift · non-Admin binding 의존) 의 구현.
- `src/` · `web/` · `test/` · `prisma/` 등 코드 · schema · **코드 주석** 변경 일체 (본 task 는 `commitMode: direct` doc-only).
- REQ-001 (20 행) · REQ-047 · REQ-048 · REQ-050 · REQ-056 등 다른 `PLANNED` row 재판정 — 각각 별도 slice.
- 새 ADR 작성 또는 기존 ADR status 변경.

## Suggested Sub-agents

`implementer` (doc-only 실측 + 표 갱신). 코드 변경이 0 이므로 tester 는 생략한다 (CLAUDE.md §3.2 R-110 의 direct-mode doc-only 면제).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append 한다.)
