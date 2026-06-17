---
id: T-0464
title: UC-07 §7.1/§7.2 Export·Import 진입 인증·권한 거부 사람-친화 안내 메시지 조립 순수 helper buildExportAccessDenial
phase: P7
status: DONE
commitMode: pr
coversReq: [REQ-043, REQ-044, REQ-045]
estimatedDiff: 195
estimatedFiles: 2
created: 2026-06-17
independentStream: uc07-export-import-helpers
dependsOn: []
touchesFiles:
  - src/export/export-access-denial-message.ts
  - src/export/export-access-denial-message.spec.ts
hqOrigin: null
plannerNote: "P7 UC-07 §7.1(401 인증)/§7.2(403 권한) Export·Import 진입 거부 안내 — 입구 guard 측 메시지. payload/scope/dump reject 메시지(T-0459/T-0463)의 입구 guard 대칭. pr, 게이트-free, dependsOn []."
---

# T-0464 — UC-07 §7.1/§7.2 Export·Import 진입 인증·권한 거부 사람-친화 안내 메시지 조립 순수 helper buildExportAccessDenial

## Why

UC-07 [§7.1](../use-cases/UC-07-export-import.md) (인증 실패 → 401 + login redirect) 과 [§7.2](../use-cases/UC-07-export-import.md) (권한 부족 → 403 + "Admin 권한 필요" 안내) 는 Export·Import main flow 진입을 차단하는 **입구 guard** 의 두 error path 다 ([§4](../use-cases/UC-07-export-import.md) precondition 1·2, [§5](../use-cases/UC-07-export-import.md) step 5 AuthModule guard). 기존 27 helper 는 payload 검증 실패(§7.3 `buildExportScopeRejection` T-0463), dump 구조 실패(§7.4 `buildDumpValidationMessage` T-0459), DB write 실패(§7.5 `buildRestoreFailureMessage` T-0461), race timeout(§7.6 `evaluateImportRaceGuard` T-0460) 의 사람-친화 안내까지 모두 cover 하나, **진입 자체를 막는 §7.1(인증)/§7.2(권한) 거부 안내 메시지** 는 27 helper 중 0 회 cover 된 gap 이다 — error path 6 종 중 마지막 미cover 2 종.

이는 §7.3/§7.4 의 reject 메시지 패턴(T-0459 `DumpValidationMessage{ headline, detailLines, blocking }` / T-0463 `ExportScopeRejectionMessage{ headline, detailLines, blocking }`)을 **입구 guard 측(인증·권한)** 에 적용한 것이다 — payload/dump reject 가 "잘못된 입력" 을 막는다면, access denial 은 "자격 없는 호출자" 를 막는다. 두 흐름 모두 "구조화 판정 → 사람-친화 메시지 모델(headline + detailLines + blocking)" 패턴을 따른다.

`buildExportAccessDenial(decision: ExportAccessDecision): ExportAccessDenialMessage` 는 이미 산출된 인증·권한 판정 descriptor `{ authenticated: boolean; role?: AuditActorRole | "User" | null; operation: ExportImportAuditOperation }` 를 입력으로만 받아(실 guard / JWT 검증 / session lookup / DB / REST 0 — 순수·재실행 0) 한국어 headline + 다음 행동 안내 detailLines + blocking flag + reason 슬러그(`"unauthenticated"` / `"insufficient-role"` / `"granted"`)를 담은 단일 메시지 모델을 조립한다. §7.1 우선순위 박제 — 미인증이면 권한 평가 전에 인증 거부(401 우선). non-mutating, 한국어 TypeError/RangeError 입력 방어. touchesFiles disjoint·dependsOn [] — stage 5b 동시 driver 안전.

`git grep` 으로 `buildExportAccessDenial` / `ExportAccessDenial` / `ExportAccessDecision` / `accessDenied` / `buildAuthorizationMessage` / `insufficientRole` src/export 0 매칭 확인.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` — §7.1 (인증 실패 → 401 + login redirect) + §7.2 (권한 부족 → 403 + "Admin 권한 필요") + §4 precondition 1·2 + §5 step 5 (AuthModule guard) + §2 actor 표(User 등급은 본 UC actor 아님).
- `src/export/export-scope-rejection-message.ts` — T-0463 `buildExportScopeRejection` / `ExportScopeRejectionMessage`. 본 helper 의 **직접 본보기** — plain 모델 interface(`{ headline, detailLines, blocking }`) + `isPlainObject`/`describe` 입력 방어 + 한국어 TypeError/RangeError convention + non-mutating + blocking 불변 패턴.
- `src/export/export-import-audit.ts` — `AuditActorRole = "Admin" | "SuperAdmin"` + `ExportImportAuditOperation = "export" | "import"` 타입. 본 helper 의 `role` / `operation` 필드는 이 타입을 **재사용**(role 은 거부 대상까지 포함하도록 `"User"` 를 union 에 확장하거나 별도 입력 union 으로 표현 — 구현 시 1택 후 명시). 새 actor-role/operation 도메인 타입 신설 금지.
- `src/export/import-dump-validate-message.ts` — T-0459 `buildDumpValidationMessage` / `DumpValidationMessage`. blocking 불변 + 한국어 메시지 convention 의 보조 본보기.

## Acceptance Criteria

- [ ] `src/export/export-access-denial-message.ts` 신설 — `buildExportAccessDenial(decision: ExportAccessDecision): ExportAccessDenialMessage` 순수 함수 + `ExportAccessDecision` / `ExportAccessDenialMessage` interface export. `AuditActorRole` / `ExportImportAuditOperation` 재사용(role 거부 대상 표현은 구현 정책 1택 후 명시). persistence/repository/transaction/DB/REST/guard/JWT 호출 0, 새 외부 dependency 0.
- [ ] 모델 shape: `ExportAccessDenialMessage { headline: string; detailLines: string[]; blocking: boolean; reason: "unauthenticated" | "insufficient-role" | "granted" }`. `blocking === (reason !== "granted")` 불변.
- [ ] `authenticated === false` 분기 → §7.1 인증 거부 headline(한국어) + login 재인증 안내 detailLine + `reason === "unauthenticated"` + `blocking === true`. **§7.1 우선순위** — 미인증이면 role 평가 전에 인증 거부(role 값과 무관).
- [ ] `authenticated === true` + `role` 이 Admin/SuperAdmin 미만(예: `"User"` 또는 권한 없음) 분기 → §7.2 권한 거부 headline + "Admin 이상 권한 필요" 안내 + operation(export/import) 맥락 라인 + `reason === "insufficient-role"` + `blocking === true`.
- [ ] `authenticated === true` + `role` 이 Admin/SuperAdmin 분기 → 접근 허용 headline + 진행 가능 detailLine + `reason === "granted"` + `blocking === false`.
- [ ] `src/export/export-access-denial-message.spec.ts` colocated 신설.
- [ ] Happy-path test 1+: 미인증 decision → §7.1 모델, User 권한 decision → §7.2 모델, Admin/SuperAdmin decision → granted 모델 각각 기대 shape(headline·detailLines·blocking·reason) 반환.
- [ ] Error path test 1+: `decision` 비-object/null/배열 → TypeError; `decision.authenticated` 비-boolean → TypeError; `decision.operation` 가 "export"/"import" 외 값 → RangeError; `authenticated === true` 인데 `role` 가 부재/null 인 경계(권한 평가 불가) 처리 정책 명시 후 그 분기 test(구현 정책 1택 — 권한 없음 취급 또는 RangeError — 후 단언).
- [ ] Branch coverage: unauthenticated / insufficient-role / granted 3 분기 + operation export/import 분기 + blocking 분기 각 1+ test.
- [ ] Negative cases 충분 cover: `role` 가 union 외 임의 문자열 / `authenticated=false` 인데 role 이 Admin(인증 우선순위로 §7.1 이 이기는지 단언) / 입력 `decision` 객체 deepFreeze 후 호출해도 throw 0 + 입력 불변 단언(non-mutating regression) / detailLines 가 operation 맥락을 정확히 반영하는지 단언 — 예외·우선순위 분기마다 1+.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 파일은 100% 목표.
- [ ] `pnpm lint && pnpm build && pnpm test` green, 새 외부 dependency 0.

## Out of Scope

- 실 인증·권한 *검증* 로직(JWT/session 검증, role guard, NestJS `@UseGuards` / `CanActivate`) 구현 — AuthModule/controller 게이트된 후속. 본 helper 는 이미 내려진 판정(`ExportAccessDecision`)을 입력으로만 받아 표시 메시지만 조립.
- 실 HTTP status code 매핑(401/403) · WebUI login redirect · "Admin 권한 필요" 컴포넌트 렌더링 / i18n — controller/frontend(P6) 영역. 본 helper 는 표시 모델만(reason 슬러그로 후속 status 매핑을 후속 layer 에 위임).
- §7.3 scope payload reject(T-0463 `buildExportScopeRejection`) / §7.4 dump 구조 reject(T-0459 `buildDumpValidationMessage`) / §7.5 DB write fail(T-0461 `buildRestoreFailureMessage`) / §7.6 race timeout(T-0460 `evaluateImportRaceGuard`) 과 중복 메시지 조립 금지 — 본 helper 는 §7.1/§7.2 입구 guard 거부만.
- 새 도메인 타입을 `ExportAccessDecision`/`ExportAccessDenialMessage` 외에 신설 금지(`AuditActorRole`/`ExportImportAuditOperation` 재사용 — role union 의 `"User"` 확장이 필요하면 본 helper 입력 타입 내부에서만 표현).
- fine-grained 권한 모델(entity 별 분할 권한 등) — UC-07 §2 가 "Admin 이상" 까지만 박제(Out of Scope).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)
