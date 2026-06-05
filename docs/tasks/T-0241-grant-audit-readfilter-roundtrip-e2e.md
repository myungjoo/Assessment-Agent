---
id: T-0241
title: grant→own-instance audit READ 필터 round-trip e2e (ADR-0027 Follow-up 4)
phase: P4
status: DONE
commitMode: pr
completedAt: 2026-06-05T10:38:34+09:00
mergedAs: cd5f8f9
prNumber: 208
reviewRounds: 1
coversReq: [REQ-016, REQ-044]
estimatedDiff: 180
estimatedFiles: 1
created: 2026-06-05
plannerNote: P4 — ADR-0027 Follow-up(4) cross-chain e2e. grant write-path 머지로 deferred precondition 충족 → dependency-free 첫 가능. R-112 backbone(test-only) ×1.5 ≈ 180 LOC.
sizeExempt: true
exemptReason: e2e single-file spec — test-only 0 production LOC. T-0240(+331) / T-0216 precedent. cross-chain round-trip + negative 다수라 단일 파일이 의미 단위. cap-bend pre-justified: R-112 backbone(test-only) ×1.5, T-0240/T-0216 패턴 정당화.
---

# T-0241 — grant→own-instance audit READ 필터 round-trip e2e (ADR-0027 Follow-up 4)

## Why

ADR-0024→ADR-0027 grant chain 이 4 slice(service→controller→api.md→e2e)로 종결됐다. 그러나 이 chain 전체가 존재하는 **단 하나의 목적** — "Admin 이 non-Admin user 에게 instance 를 부여하면 그 user 가 자기 instance 의 permission-denied audit record 를 조회할 수 있다" — 는 아직 end-to-end 로 검증된 적이 없다.

- ADR-0027 §Consequences (4) (line 156) 가 이 round-trip e2e 를 Follow-up 으로 명시 deferred 했다: "grant→READ 필터 round-trip e2e (Admin grant → non-Admin 이 그 instance audit 조회 → 보임 / revoke → 안 보임)".
- 기존 audit e2e (`test/e2e/permission-denied-records.e2e-spec.ts` line 21~22) 는 "non-Admin own-instance 실 필터 — User↔instance binding schema 선행 요구 (deferred). 본 e2e 는 non-Admin → 빈 배열 fallback 까지만 assert" 라고 명시 — binding **write 경로 부재** 때문에 own-instance 가 보이는 case 를 검증하지 못했다.
- T-0240 e2e 는 grant/revoke endpoint 를 **고립** 검증(201/204 + DB persist/delete + 11 negative)할 뿐, grant 후 audit 가 실제로 보이는 cross-chain 은 cover 하지 않는다.

binding write 경로(grant)가 이번 세션에 머지되면서 그 deferred precondition 이 처음으로 충족됐다 — 따라서 본 task 는 dependency-free 이며, chain 이 실제로 의도대로 작동함을 닫는 핵심 통합 검증이다(make-work 아님). REQ-016(권한 부족의 user/admin audience 분리) + REQ-044(권한 거부 가시성)의 user-audience 측 실증.

## Required Reading

- `docs/decisions/ADR-0027-instance-access-grant-rbac-contract.md` — §Consequences (4) (line 156) 의 round-trip e2e Follow-up 정의 + grant/revoke endpoint surface(POST 201 / DELETE 204 `/api/users/:id/instance-access`, @Roles(Admin)).
- `docs/decisions/ADR-0024-user-instance-binding-data-model.md` — §3 own-instance 필터 의미(allowlist → instanceRef WHERE) + §4 instanceRef 정규화(host case·trailing-slash). 본 e2e 의 기대 결과 산정 기준.
- `test/e2e/permission-denied-records.e2e-spec.ts` — audit READ endpoint e2e. `createAuthenticatedE2EApp` 다중 actor seed 패턴, `seedRecord` helper(instanceRef override), `truncateAll`, `buildAuthCookie`, non-Admin 빈 배열 fallback assert(line 234~) — 본 task 가 그 fallback 의 **반대 case**(binding 있으면 보임)를 검증.
- `test/e2e/user-instance-access.e2e-spec.ts` (T-0240) — grant/revoke endpoint 호출 방식(POST body `{ instanceRef }`, DELETE body, Admin/SuperAdmin/User cookie, self-grant 403) 참조. 본 task 는 이 endpoint 를 setup step 으로 재사용.
- `src/permission-denied/permission-denied-record.service.ts` (line 96~160 주석) — Admin bypass vs non-Admin allowlist 필터 분기. query.instanceRef ∩ allowlist 교집합 의미.

## Acceptance Criteria

신규 `test/e2e/user-instance-access-audit-roundtrip.e2e-spec.ts` 1 파일(test-only, production code 0 LOC). 모든 assert 는 실 PostgreSQL + 실 HTTP guard 를 통과(supertest). 다음을 모두 만족:

- [ ] **Happy round-trip (핵심)**: Admin 이 non-Admin user 에게 instance(예: `github.sec.samsung.net`) grant(POST 201) → 그 instance 의 permission-denied record 를 seed → 해당 non-Admin user cookie 로 `GET /api/permission-denied-records` 시 200 + 그 record 가 **보임**(T-0240 격리 e2e 와 달리 grant→audit 가시성 cross-chain 을 1 test 로 닫음).
- [ ] **Revoke round-trip (핵심)**: 위 상태에서 Admin 이 revoke(DELETE 204) → 동일 non-Admin user 가 다시 `GET /api/permission-denied-records` 시 200 + **빈 배열**(binding 제거 후 own-instance fallback 복귀, 403 아님).
- [ ] **분기 — 타 instance 비노출**: user 가 instance A 만 grant 받은 상태에서 instance B(allowlist 밖)의 record 는 보이지 않음(ADR-0024 §3 allowlist 교집합 — 권한 밖 instance 격리). grant 받은 A 의 record 만 반환됨을 함께 assert(분기 양쪽).
- [ ] **분기 — 정규화 정합**: grant 시 입력한 instanceRef 와 record 의 instanceRef 가 host case / trailing-slash 차이가 있어도 ADR-0024 §4 정규화로 매칭되어 보임(정규화 분기 1 test). 정규화 의미가 service 단에서만 적용되고 e2e 표면에서 재현 불가하면 본 항목은 "정규화 e2e 재현 불가 — service unit(permission-denied-record.service.spec.ts)에서 cover 됨" 으로 본문에 명시하고 생략 가능.
- [ ] **Negative — grant 없는 user 는 빈 배열**: grant 를 전혀 받지 않은 non-Admin 은 record 가 DB 에 존재해도 200 + 빈 배열(기존 fallback 회귀 보호 — 본 task 가 그 동작을 깨지 않음 확인).
- [ ] **Negative — Admin bypass 불변**: 위 시나리오 전반에서 Admin cookie 는 grant 여부 무관하게 전체 record 조회(bypass) — non-Admin 필터 추가가 Admin 경로를 오염시키지 않음.
- [ ] **Negative — 미인증 401**: grant→audit 시나리오의 audit 조회를 cookie 부재로 호출 시 401(인증 경계 회귀 보호).
- [ ] flow / 분기: 위 happy(보임) + revoke(안 보임) + 타-instance(격리) + grant-없음(fallback) 각각이 별도 it 로 분리되어 own-instance 필터의 각 분기를 cover. 분기마다 1+ test 충족.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:e2e` 가 본 spec 포함 전부 통과(실 PostgreSQL service, ADR-0004 migrate-deploy).
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 단 본 task 는 test-only 라 production coverage 를 낮추지 않음(신규 production symbol 0). cov 게이트가 기존 임계 유지됨을 확인.

## Out of Scope

- production code 변경 금지(`src/**`). 본 task 는 순수 e2e 검증 — 필터 로직은 이미 머지됨. 검증 중 필터 결함 발견 시 즉시 고치지 말고 Follow-ups 에 적고 patch task 로 escalate.
- grant/revoke endpoint 자체의 격리 RBAC e2e(403/409/404/400/401) — 이미 T-0240 이 cover. 본 task 는 cross-chain round-trip 만(중복 negative 재작성 금지, setup 으로만 grant 호출).
- audit query 필터(provider/httpStatus query param) e2e — T-0216 cover. 본 task 는 own-instance(instanceRef×allowlist) 가시성에 집중.
- smoke spec / unit spec 추가 — 본 task 는 e2e 1 파일만. service-layer 필터 unit 은 이미 존재.
- modules.md / api.md doc-sync — 본 task 는 코드(e2e) 만. 문서는 이미 정합(T-0239 api.md, ADR-0027 §4).

## Suggested Sub-agents

`implementer → tester` (production code 0 — architect 불요. e2e 작성 후 tester 가 `pnpm test:e2e` 실 DB 통과 검증).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
