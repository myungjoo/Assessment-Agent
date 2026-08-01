---
id: T-1379
title: requirements.md 62 행 REQ-043 모든 기능 ID/Password 보호 상태를 실측 기반 재판정
phase: P7
status: PENDING
commitMode: direct
coversReq: [REQ-043]
estimatedDiff: 28
estimatedFiles: 2
created: 2026-08-02
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1379-requirements-auth-protection-coverage-status-rejudge.md
plannerNote: "requirements-status-resync 25 번째 slice — 하위 REQ-044/045/046 은 판정 완료인데 상위 REQ-043 만 PLANNED, guard 적용 전수 실측 가능, doc-only direct"
---

# T-1379 — requirements.md 62 행 REQ-043 모든 기능 ID/Password 보호 상태를 실측 기반 재판정

## Why

[docs/requirements.md](../requirements.md) 62 행 REQ-043 (README 83 행 — "평가 자료 조회와 자료 편집을 포함하여 모든 사용 기능은 보안사항으로서 ID와 Password로 보호되어야 한다") 는 아직 상태 컬럼이 `PLANNED` 이지만, 같은 보안 절의 하위 요구인 REQ-044 (`DONE`) · REQ-045 (`IN_PROGRESS`) · REQ-046 (`DONE`) 은 이미 재판정이 끝나 상위 행만 표-코드 drift 로 남아 있다. REQ-043 은 (a) 자격증명 인증 경로 (b) **모든** 기능 엔드포인트의 보호 적용률 (c) 프런트 진입 차단 3 축으로 분해되며, 인증 모듈과 guard 가 main 에 박제된 현 시점에는 controller 전수 대조로 적용률을 정량 실측할 수 있어 근거 밀도가 높다. `requirements-status-resync` stream 의 25 번째 slice 로 3 축을 각각 실측해 표를 코드베이스에 되돌린다.

## Required Reading

- `docs/requirements.md` — 62 행 (REQ-043) 및 표 헤더 (18 행) 의 컬럼 순서, 상태 enum. 인접 REQ-042 (61 행) · REQ-044 (63 행) 의 상태 문자열은 **서술 포맷 참고용** 이며 그 실측값을 본 task 의 근거로 재인용하지 않는다 (반드시 본 task 에서 직접 실측한 값만 인용).
- `docs/tasks/T-1378-requirements-evaluate-store-display-status-rejudge.md` — 직전 slice 의 상태 문자열 서술 포맷 (`DONE (implemented-on-main — <근거>)` / `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)` + `한계 —` 부기) 과 완료 기록 포맷을 그대로 따른다. **단 그 안의 실측값 (심볼명 · 행 번호 · it 개수) 을 본 task 근거로 복사하지 않는다** — 본 task 는 REQ-043 자기 축을 직접 실측한다.
- `README.md` 83 행 — REQ-043 원문. 축 분해 = (a) **ID 와 Password 로** 인증 (자격증명 방식) (b) **모든 사용 기능** (조회 + 편집 전부) 이 보호됨 (c) 보호의 실제 강제 지점.
- `src/auth/auth.controller.ts` — 자격증명 축. 106 행 `@Controller("api/auth")` 아래 148 행 `@Post("login")` · 194 행 `@Post("logout")` · 218 행 `@Post("refresh")` · 296~297 행 `@Get("me")` 의 입력 필드 · guard decorator 유무를 행 인용으로 확정한다. login 이 받는 자격증명이 실제 ID + Password 쌍인지 DTO 필드명으로 대조한다.
- `src/auth/auth.service.ts` · `src/auth/dto/` — 비밀번호 검증 심볼 (해시 비교 · 실패 처리) 을 행 인용으로 확정. 해시 알고리즘명 · 상수값을 추측해 적지 않는다 — 실제 코드에 있는 것만 인용한다.
- `src/auth/jwt-auth.guard.ts` · `src/auth/roles.guard.ts` · `src/auth/jwt.strategy.ts` — 보호 강제 축. guard 가 요청을 어디서 거르는지, 미인증 시 어떤 예외를 던지는지 행 인용.
- 적용률 전수 실측용 — `grep -rl "@Controller(" src --include=*.controller.ts` 로 controller 전수 목록을 뽑고, 각각 `JwtAuthGuard` 참조 유무를 대조한다. **guard 미참조 controller 는 module provider (`APP_GUARD`) 로 전역 적용됐을 가능성을 반드시 별도 확인** 한다 — `grep -rn "APP_GUARD" src --include=*.ts` 결과가 0 이면 전역 적용이 없다는 뜻이므로 미참조 controller 의 route 는 실제로 미보호로 판정한다. 미보호로 판정되는 controller 는 파일 경로 + route decorator 행을 그대로 인용한다.
- `src/app.controller.ts` — 위 전수 결과에 걸리는 controller 중 health / 진단 목적이라 의도적으로 공개인지 실제 route 본문으로 확인한다. 의도 여부를 코드 근거 없이 추정하지 않는다.
- `web/src/AuthGate.tsx` · `web/src/components/LoginForm.tsx` · `web/src/api/auth.ts` — 프런트 진입 축. 미인증 상태에서 화면 진입이 차단되는지, 자격증명 입력 필드가 ID + Password 2 개인지 행 인용으로 확정.
- 검증 위치 실 근거용 — `test/e2e/auth.e2e-spec.ts` 와 `src/auth/jwt-auth.guard.spec.ts` · `src/auth/roles.guard.spec.ts` 의 파일별 `it(` 개수를 직접 실측. 표의 검증 위치 컬럼이 `e2e` 이므로 e2e 가 **미인증 401 경로** 를 실제로 cover 하는지도 확인한다.

## Acceptance Criteria

- [ ] **자격증명 축 (README 83 행 "ID와 Password로")** 을 실측한다 — login route 의 입력 DTO 필드명과 비밀번호 검증 심볼을 파일 · 행 인용으로 확정한다. 인증 성공 후 무엇이 발급되는지 (토큰 종류 · 저장 위치) 도 행 인용으로 적는다. 추측한 심볼명 · 필드명 · 알고리즘명 · 상수값을 적지 않는다.
- [ ] **적용률 축 (README 83 행 "모든 사용 기능")** 을 정량으로 판정한다 — controller 전수 개수와 그중 보호 적용 개수를 숫자로 적고, **미적용 controller 가 있으면 파일 경로를 전부 열거** 한다. `APP_GUARD` 전역 등록 유무 확인 결과 (있음/없음) 를 반드시 함께 적는다. 미적용 0 이 아니면 `DONE` 근거로 쓰지 않는다.
- [ ] **프런트 진입 축** 을 별도로 판정한다 — 미인증 상태의 화면 진입 차단 지점과 자격증명 입력 필드 2 개 존재 여부를 파일 · 행 인용으로 확정한다. 미충족이면 그 사실을 그대로 적고 P6 미완 같은 근거 없는 서술을 덧붙이지 않는다.
- [ ] **wiring 축을 별도로 판정한다** — `grep -rn "JwtAuthGuard\|RolesGuard" src --include=*.ts | grep -v spec` 로 참조 지점을 전수 확인하고 guard 등록 → strategy → service 호출 chain 을 파일 · 행으로 인용한다. 정의만 있고 참조 0 인 심볼은 `DONE` 근거로 쓰지 않는다.
- [ ] **검증 위치 컬럼의 실 근거** 를 확인한다 — 위 3 spec 파일의 `it(` 개수를 각각 실측해 경로와 개수를 상태 문자열에 인용하고, `test/e2e/auth.e2e-spec.ts` 가 미인증 접근 거부 (401) 경로를 cover 하는지 여부를 한 줄로 적는다.
- [ ] REQ-043 (62 행) 의 상태 컬럼을 실측 결과에 따라 `PLANNED` → `DONE (implemented-on-main — <근거>)`, 일부 축만 충족 시 `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)`, 근거 부족 시 `PLANNED` 유지 + 유지 사유 부기 중 하나로 갱신한다. 근거에는 실재하는 소스 파일 경로 2 개 이상 + spec 파일 경로 1 개 이상이 포함돼야 한다.
- [ ] 실측으로 확인되지 않은 부분 (예: 미보호 route 잔존 · 프런트 차단 우회 여지 · e2e 가 cover 하지 않는 축) 은 상태 문자열 안에 "한계 —" 로 1~2 절 부기한다.
- [ ] `grep -n "REQ-043" docs/requirements.md` 결과에서 해당 행의 상태 컬럼이 갱신됐고, 표의 컬럼 수 (`|` 필드 수) 가 인접 행 (REQ-042 · REQ-044) 과 동일하게 유지됨을 확인한다. 상태 문자열 안에 리터럴 `|` 문자를 넣지 않는다 (T-1370 · T-1375 에서 grep 패턴의 `\|` 로 필드 수가 부풀었던 사고 재발 방지). `wc -l docs/requirements.md` 와 `grep -c "^| REQ-" docs/requirements.md` 값이 편집 전후 불변임도 확인한다.
- [ ] 본 task 파일의 `status` 를 `DONE` 으로 바꾸고 완료 시각 · 결과 요약 (실측값 포함) 을 추가한다.

## Out of Scope

- **보안 · 인증 관련 코드 변경 일체** — 미보호 controller 를 발견해도 guard 를 붙이지 않는다. 인증 흐름 · 권한 모델 변경은 CLAUDE.md §5 상 BLOCKED 대상이며, 본 task 는 실측·기록만 한다. 조치 여부 판단은 별도 ADR / 구현 slice.
- 상태 컬럼 외 다른 컬럼 (README 행 번호 · 요약 · kind · 구현 위치 · 검증 위치) 수정 — 검증 위치 재판정은 별도 slice 다. 근거 부재를 발견해도 컬럼 값은 건드리지 않고 상태 문자열의 "한계 —" 로만 부기한다.
- `src/` · `web/` · `test/` · `prisma/` 등 코드 · schema · **코드 주석** 변경 일체 (본 task 는 `commitMode: direct` doc-only).
- 이미 재판정된 REQ-044 · REQ-045 · REQ-046 재서술 — 본 task 는 README 83 행 축만 다루며, 인접 REQ 의 상태 문자열을 근거로 재인용하지 않는다.
- T-1377 · T-1378 Follow-ups (기간 종료 경계 · summary batch narrative HTTP 진입점 · `DashboardView` 필드명 계약 정합 · `model Contribution` narrative 컬럼) 의 구현 또는 재서술.
- REQ-001 (20 행) · REQ-008 (27 행) 등 다른 `PLANNED` row 재판정 — 각각 별도 slice.
- 새 ADR 작성 또는 기존 ADR status 변경.

## Suggested Sub-agents

`implementer` (doc-only 실측 + 표 갱신). 코드 변경이 0 이므로 tester 는 생략한다 (CLAUDE.md §3.2 R-110 의 direct-mode doc-only 면제).

## Follow-ups

(생성 시점에는 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가한다.)
