---
id: T-1380
title: requirements.md 27 행 REQ-008 접근 권한(read) 부족 인식·통지 상태를 실측 기반 재판정
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-008]
estimatedDiff: 30
estimatedFiles: 2
created: 2026-08-02
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1380-requirements-github-permission-denied-status-rejudge.md
plannerNote: "requirements-status-resync 26 번째 slice — REQ-008 만 PLANNED 잔존, src/permission-denied chain 전수 실측 가능, doc-only direct"
---

# T-1380 — requirements.md 27 행 REQ-008 접근 권한(read) 부족 인식·통지 상태를 실측 기반 재판정

## Why

[docs/requirements.md](../requirements.md) 27 행 REQ-008 (README 20 행 — "접근 권한 (read) 을 AA가 가지고 있어야 한다. 접근 권한이 모자를 경우 AA 사용자와 관리자가 인식하여 대응할 수 있어야 한다") 은 아직 상태 컬럼이 `PLANNED` 이지만, main 에는 `src/permission-denied/` 모듈 chain (controller / service / repository / module + GitHub·Confluence emitter) 과 `test/e2e/permission-denied-records.e2e-spec.ts` · `test/smoke/permission-denied-record.smoke-spec.ts` · `web/src/components/PermissionDeniedRecordList.tsx` 가 모두 박제돼 있어 표-코드 drift 가 남아 있는 상태다. REQ-008 은 (a) 권한 부족 **감지** (수집 어댑터의 4xx → event) (b) **기록·영속** (c) **사용자와 관리자 모두의 인식 경로** 3 축으로 분해되며 세 축 모두 심볼 전수 대조가 가능하다. `requirements-status-resync` stream 의 26 번째 slice 로 3 축을 각각 실측해 표를 코드베이스에 되돌린다.

## Required Reading

- `docs/requirements.md` — 27 행 (REQ-008) 및 표 헤더 (18~19 행) 의 컬럼 순서, 상태 enum (9 행). 인접 REQ-007 (26 행) · REQ-009 (28 행) 의 상태 문자열은 **서술 포맷 참고용** 이며 그 실측값을 본 task 의 근거로 재인용하지 않는다 (반드시 본 task 에서 직접 실측한 값만 인용).
- `docs/tasks/T-1379-requirements-auth-protection-coverage-status-rejudge.md` — 직전 slice 의 상태 문자열 서술 포맷 (`DONE (implemented-on-main — <근거>)` / `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)` + `한계 —` 부기) 과 완료 기록 포맷을 그대로 따른다. **단 그 안의 실측값 (심볼명 · 행 번호 · it 개수) 을 본 task 근거로 복사하지 않는다** — 본 task 는 REQ-008 자기 축을 직접 실측한다.
- `README.md` 20 행 — REQ-008 원문. 축 분해 = (a) 권한 부족 **감지** (b) 그 사실의 **기록·영속** (c) **AA 사용자와 관리자 모두** 가 인식할 수 있는 노출 경로.
- `src/permission-denied/persisting-permission-denied-emitter.ts` — GitHub 축 emitter. 어떤 입력 (상태 코드 · 예외 형태) 이 `PermissionDeniedEvent` 로 변환되는지, 그 변환 심볼과 시그니처를 행 인용으로 확정한다. 추측한 심볼명 · 상태 코드 · 상수값을 적지 않는다.
- `src/permission-denied/permission-denied-record.service.ts` · `permission-denied-record.repository.ts` — 기록·영속 축. 저장 진입 메서드와 조회 메서드, 그리고 **조회 결과가 호출자 role 에 따라 달라지는지** (Admin 전체 / non-Admin 범위 제한 여부) 를 행 인용으로 확정한다. 차등이 없으면 없다고 그대로 적는다.
- `src/permission-denied/permission-denied-record.controller.ts` — 인식 경로 축. route decorator (경로 · method) 와 guard / `@Roles` decorator 를 행 인용으로 확정한다. **어떤 role 이 조회 가능한지** 가 "사용자와 관리자 모두" 판정의 직접 근거다.
- 감지 축 전수 실측용 — `grep -rn "PermissionDenied" src --include=*.ts | grep -v spec` 로 참조 지점을 전수 확인하고, 그중 **수집 경로에서 실제로 emit 을 호출하는 지점** (`src/assessment-collection/github-collection.service.ts` · `src/assessment-collection/github-org-repo-enumerate.service.ts` · `src/github/github-adapter.service.ts` 중 실재하는 것) 을 파일 · 행으로 인용한다. 정의만 있고 호출 참조 0 인 심볼은 충족 근거로 쓰지 않는다.
- `web/src/components/PermissionDeniedRecordList.tsx` · `web/src/views/AdminView.tsx` · `web/src/views/DashboardView.tsx` — 프런트 노출 축. 목록 컴포넌트가 실제 화면에 **배선** 돼 있는지 (import + JSX 사용 지점) 를 행 인용으로 확정한다. 컴포넌트 파일 존재만으로 배선 충족이라고 적지 않는다.
- 검증 위치 실 근거용 — `test/e2e/permission-denied-records.e2e-spec.ts` · `test/smoke/permission-denied-record.smoke-spec.ts` · `src/permission-denied/permission-denied-record.controller.spec.ts` · `src/permission-denied/persisting-permission-denied-emitter.spec.ts` 의 파일별 `it(` 개수를 직접 실측한다. 표의 검증 위치 컬럼이 `unit + smoke` 이므로 smoke 가 실제로 존재·통과 대상인지도 확인한다.

## Acceptance Criteria

- [x] **감지 축 (README 20 행 "접근 권한이 모자를 경우")** 을 실측한다 — 권한 부족을 판정하는 입력 (상태 코드 · 예외 타입) 과 그것을 event 로 바꾸는 심볼을 파일 · 행 인용으로 확정하고, 수집 경로에서 그 emit 을 실제 호출하는 지점을 1 개 이상 파일 · 행으로 인용한다. 호출 참조가 0 이면 감지 축을 충족으로 판정하지 않는다.
- [x] **기록·영속 축** 을 실측한다 — 저장 진입 메서드와 저장 대상 (테이블 / 모델명) 을 행 인용으로 확정한다. 모델명은 `prisma/schema.prisma` 에 실재하는 이름만 인용하고 추측하지 않는다.
- [x] **인식 경로 축 (README 20 행 "사용자와 관리자가 인식")** 을 판정한다 — 조회 route 의 경로 · method · guard · `@Roles` 값을 행 인용하고, **사용자 (non-Admin) 와 관리자 (Admin) 각각이 조회 가능한지** 를 service 계층의 audience 차등 유무와 함께 한 줄로 확정한다. 한쪽만 가능하면 그 사실을 그대로 적는다.
- [x] **프런트 노출 축을 별도로 판정한다** — `PermissionDeniedRecordList` 의 import 지점과 JSX 사용 지점을 파일 · 행으로 인용한다. 배선 지점이 없으면 미충족으로 적고, P6 미완 같은 근거 없는 서술을 덧붙이지 않는다.
- [x] **검증 위치 컬럼의 실 근거** 를 확인한다 — 위 4 spec 파일의 `it(` 개수를 각각 실측해 경로와 개수를 상태 문자열에 인용한다. 표의 `unit + smoke` 와 실재 spec 종류 (unit / smoke / e2e) 가 어긋나면 그 사실을 "한계 —" 로만 부기한다 (컬럼 값은 수정하지 않는다).
- [x] REQ-008 (27 행) 의 상태 컬럼을 실측 결과에 따라 `PLANNED` → `DONE (implemented-on-main — <근거>)`, 일부 축만 충족 시 `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)`, 근거 부족 시 `PLANNED` 유지 + 유지 사유 부기 중 하나로 갱신한다. 근거에는 실재하는 소스 파일 경로 2 개 이상 + spec 파일 경로 1 개 이상이 포함돼야 한다.
- [x] 실측으로 확인되지 않은 부분 (예: 감지 축이 cover 하지 못하는 4xx 종류 · 프런트 배선 공백 · smoke 가 cover 하지 않는 축) 은 상태 문자열 안에 "한계 —" 로 1~2 절 부기한다.
- [x] `grep -n "REQ-008" docs/requirements.md` 결과에서 해당 행의 상태 컬럼이 갱신됐고, 표의 컬럼 수 (`|` 필드 수) 가 인접 행 (REQ-007 · REQ-009) 과 동일하게 유지됨을 확인한다. 상태 문자열 안에 리터럴 `|` 문자를 넣지 않는다 (T-1370 · T-1375 에서 grep 패턴의 `\|` 로 필드 수가 부풀었던 사고 재발 방지). `wc -l docs/requirements.md` 와 `grep -c "^| REQ-" docs/requirements.md` 값이 편집 전후 불변임도 확인한다.
- [x] 본 task 파일의 `status` 를 `DONE` 으로 바꾸고 완료 시각 · 결과 요약 (실측값 포함) 을 추가한다.

## Out of Scope

- **REQ-016 (35 행, Confluence 접근 권한 부족 인식·통지) 재판정** — `persisting-confluence-permission-denied-emitter.ts` 축은 별도 slice 다. 본 task 는 README 20 행 (GitHub 수집 축) 만 다룬다. 다만 감지 축 실측 중 Confluence emitter 가 눈에 띄면 Follow-ups 에만 적는다.
- 보안 · 인증 · 권한 모델 관련 **코드 변경 일체** — 감지 누락이나 배선 공백을 발견해도 고치지 않는다 (CLAUDE.md §5 상 BLOCKED 대상). 본 task 는 실측·기록만 한다.
- 상태 컬럼 외 다른 컬럼 (README 행 번호 · 요약 · kind · 구현 위치 · 검증 위치) 수정 — 검증 위치 재판정은 별도 slice 다. 근거 부재를 발견해도 컬럼 값은 건드리지 않고 상태 문자열의 "한계 —" 로만 부기한다.
- `src/` · `web/` · `test/` · `prisma/` 등 코드 · schema · **코드 주석** 변경 일체 (본 task 는 `commitMode: direct` doc-only).
- T-1379 Follow-ups (group · part · person controller 의 guard 미적용 20 route · `app.controller.ts` 공개 의도 명시 · 보호 적용률 drift-guard spec) 의 구현 또는 재서술.
- REQ-001 (20 행) · REQ-015 (34 행) · REQ-017 (36 행) · REQ-047 · REQ-048 · REQ-050 · REQ-056 등 다른 `PLANNED` row 재판정 — 각각 별도 slice.
- 새 ADR 작성 또는 기존 ADR status 변경.

## Suggested Sub-agents

`implementer` (doc-only 실측 + 표 갱신). 코드 변경이 0 이므로 tester 는 생략한다 (CLAUDE.md §3.2 R-110 의 direct-mode doc-only 면제).

## 완료 기록

- 완료 시각: 2026-08-02 (UTC)
- 결과: `docs/requirements.md` 27 행 REQ-008 상태 컬럼을 `PLANNED` → `DONE (implemented-on-main — ...)` 로 갱신. 3 축 + 프런트 축 실측 요약:
  - **감지** — `src/github/github-adapter.service.ts` 411 행 `mapNon2xx` 이 401/403 에서 417 행 `this.permissionDeniedEmitter.emit({ host, path, status })` 호출 후 `GithubDomainError("permission-denied")` throw. 호출 경로는 384 행 `throw this.mapNon2xx(response.status, input)` ← `github-instance-client.service.ts` 70/82 행 adapter 위임 ← `assessment-collection/github-collection.service.ts` 71/90 행 (+ `github-org-repo-enumerate.service.ts` 28/43 행). emitter 는 `github.module.ts` 62 행 `useClass: PersistingPermissionDeniedEmitter` 로 실 구현 바인딩 (no-op 아님).
  - **기록·영속** — `persisting-permission-denied-emitter.ts` 46 행 `emit` → 49~55 행 `recordService.record({ provider: "github", ... })` (fire-and-forget, 56~63 행 `.catch` 흡수) → `permission-denied-record.service.ts` 109 행 `record()` (82 행 `deriveReason`: 401/403 → `permission-denied`, 404 → `not-found-or-hidden`, 그 외 null) → `permission-denied-record.repository.ts` 69 행 `prisma.permissionDeniedRecord.create`. 모델은 `prisma/schema.prisma` 513 행 `model PermissionDeniedRecord`.
  - **인식 경로** — `permission-denied-record.controller.ts` 78 행 `@Controller("api/permission-denied-records")` + 98~100 행 `@Get()` / `@UseGuards(JwtAuthGuard, RolesGuard)` / `@Roles("User")`. audience 차등은 service 159~164 행 `isAdminBypass` (Admin·SuperAdmin 전체) vs 172~197 행 non-Admin allowlist (`findInstanceRefsByUserId` → `instanceRefIn`) — 사용자·관리자 모두 조회 가능하되 사용자는 binding 범위 제한.
  - **프런트** — `web/src/views/DashboardView.tsx` 38 행 import + 632~636 행 JSX + 66 행 endpoint 상수. `web/src/views/AdminView.tsx` 배선 0.
  - **검증 실측** — unit `permission-denied-record.controller.spec.ts` 16 it (434 행 `it.each` 포함) + `persisting-permission-denied-emitter.spec.ts` 8 it, smoke `test/smoke/permission-denied-record.smoke-spec.ts` 6 it, e2e `test/e2e/permission-denied-records.e2e-spec.ts` 10 it.
- 표 불변 확인: `wc -l docs/requirements.md` = 97 (편집 전후 동일), `grep -c "^| REQ-"` = 66 (동일), 26·27·28 행 `|` 개수 = 8 로 균일. 상태 문자열에 리터럴 `|` 0.
- 코드 · schema · 주석 변경 0 (doc-only direct).

## Follow-ups

- **404 (권한 비가시) 미기록** — `github-adapter.service.ts` 415~428 행이 404 를 `not-found` 로만 분류해 emit 하지 않는 반면 service 82 행 `deriveReason` 은 404 → `not-found-or-hidden` 분기를 갖고 있어 GitHub 축에서 도달 불가 dead 분기다. 감지 경계 확정 (404 emit 여부) 은 보안·권한 모델 인접이라 별도 판단 필요.
- **push 통지 경로 부재** — REQ-008 의 "통지" 는 현재 pull 조회 (GET endpoint + DashboardView) 뿐이고 mail / webhook 등 push 알림은 `src/` 에 부재. 필요 여부 판단은 별도 slice.
- **검증 위치 컬럼 drift** — REQ-008 컬럼은 `unit + smoke` 인데 e2e 10 it 도 실재. 검증 위치 컬럼 재판정 slice 에서 일괄 처리 대상.
- **REQ-016 (Confluence 축)** — `src/permission-denied/persisting-confluence-permission-denied-emitter.ts` + `confluence-space-traversal.service.ts` 139 행 skip-and-continue emit 이 실재하므로 REQ-016 재판정 slice 에서 동일 방식 실측 가능.
- **non-Admin binding 의존** — `UserInstanceAccess` binding 이 0 인 사용자는 service 176 행에서 항상 빈 배열을 받는다. 사용자 인식 축의 실효성은 binding 데이터 투입 경로에 달려 있어 별도 확인 필요.
