---
id: T-1762
title: web ServiceIdentityList 표시 전용 목록 컴포넌트 신설 (읽기 축)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-078, REQ-079]
estimatedDiff: 270
estimatedFiles: 2
created: 2026-08-29
independentStream: service-identity-web
dependsOn: [T-1761]
touchesFiles:
  - web/src/components/ServiceIdentityList.tsx
  - web/src/components/ServiceIdentityList.test.tsx
plannerNote: "P6/PLAN 132 행 — ADR-0058 (d) 네 번째 web slice: 편집·배선 이전 표시 전용 목록 컴포넌트 1 개만 절단"
---

# T-1762 — web ServiceIdentityList 표시 전용 목록 컴포넌트 신설 (읽기 축)

## Why

[PLAN.md](../PLAN.md) `132 행` 오너 지시 (R-182 ~ R-183) 의 잔여는 [ADR-0058](../decisions/ADR-0058-service-identity-management-api.md) `§Follow-ups (d)` **AdminView 편집 UI** 다. backend 5 route (T-1748 ~ T-1756) 와 web client 5 함수 (T-1759 ~ T-1761, `web/src/api/serviceIdentity.ts`) 는 이미 main 에 머지됐고, `web/src/components/` 에 ServiceIdentity 를 그리는 컴포넌트는 아직 0 건이다 (origin/main 실측 — `web/src` 전수에서 `ServiceIdentity` hit 은 client 2 파일 + `PersonList.tsx` `4 행` 주석뿐).

`(d)` 전체 (목록 표시 + 추가 · 수정 · 삭제 · primary 편집 동선 + AdminView 배선 + RBAC gating) 는 [CLAUDE.md](../../CLAUDE.md) §3 의 cap (≤ 300 LOC / ≤ 5 파일) 을 확실히 넘는다. 본 task 는 그 중 **표시 축 한 겹만** 절단한다 — props 로 받은 identity 목록을 렌더하는 순수 presentational 컴포넌트 1 개 + spec. 편집 handler · fetch · AdminView 배선은 후속 slice 로 남긴다 (REQ-079 의 "이름 / email 만 입력 가능한 상태 금지" 해소는 그 후속 slice 가 판정한다 — 본 slice 만으로는 어떤 REQ 도 DONE 표기하지 않는다).

## Required Reading

- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md) — `§Decision 1` (5 route) · `§Decision 2` (1 인원 1 primary invariant) · `§Follow-ups (d)`
- `web/src/api/serviceIdentity.ts` — `28 행` `ServiceIdentityRow` 타입 (본 컴포넌트가 재사용할 row 계약)
- `web/src/components/PermissionDeniedRecordList.tsx` — 표시 전용 목록 컴포넌트 선례 (분기 순서 · 기본 문구 · named + default export convention)
- `web/src/components/PermissionDeniedRecordList.test.tsx` — vitest + `react-dom/server` `renderToStaticMarkup` spec 선례 (jsdom · @testing-library 미사용)
- `web/src/components/LlmProviderConfigList.tsx` — 동일 계열 목록 컴포넌트 보조 선례

## Acceptance Criteria

- [ ] `web/src/components/ServiceIdentityList.tsx` 신설 — props `identities` (필수) · `loading?` · `error?` · `emptyMessage?` 를 받는 **controlled presentational 컴포넌트**. 컴포넌트 본문 ≤ 120 LOC.
- [ ] row 타입은 재선언하지 않고 `import type { ServiceIdentityRow } from '../api/serviceIdentity'` 로 재사용한다 (계약 이중 정의로 인한 drift 차단). `AssessmentResultTable.tsx` `16 행` 선례 승계.
- [ ] 분기 순서는 선례와 동일하게 **loading 우선 → error → empty → populated** 로 고정하고, 각 분기의 근거를 한국어 주석으로 남긴다.
- [ ] populated 분기는 `<ul>` / `<li>` 로 행마다 `service` · `externalId` 를 표시하고, `isPrimary === true` 인 행에만 primary 식별 표식을 렌더한다 (ADR-0058 `§Decision 2` 의 1 인원 1 primary 를 사람이 눈으로 확인할 수 있게). 정렬 · 필터 · 복제는 하지 않고 props 배열 순서를 그대로 보존한다.
- [ ] **happy-path test 1+** — `identities` 2 건 전달 시 `<ul>` / `<li>` 2 개 + 각 행의 `service` · `externalId` 문자열이 렌더되고, primary 행에만 표식이 붙는지 검증 (`pnpm --dir web test`).
- [ ] **error path test 1+** — `error` 가 truthy 이면 목록 대신 `role="alert"` 영역에 그 문구만 렌더되고 행이 0 개인지 검증.
- [ ] **분기 cover** — loading / error / empty / populated 4 분기 각각 1+ test, 그리고 우선순위 분기 (`loading=true` 이면 `error` · `identities` 가 있어도 로딩 표시만) 1+ test.
- [ ] **negative cases 충분 cover** — 최소 6 종 각 1+ test: ① 빈 배열 → 기본 빈 상태 문구 ② `emptyMessage=''` (경계값) → 기본 문구 fallback ③ `error=''` (falsy 경계값) → alert 분기 미진입 ④ `isPrimary` 가 전부 `false` → primary 표식 0 개 ⑤ `isPrimary=true` 가 2 건인 계약 위반 입력에서도 throw 없이 렌더 (컴포넌트가 invariant 를 강제하지 않음을 고정) ⑥ `externalId` 가 빈 문자열이어도 throw 없이 해당 행이 렌더.
- [ ] spec 파일명은 `web/src/components/ServiceIdentityList.test.tsx` — root jest 의 `testRegex` (`.*\.spec\.ts$`) pickup 충돌 회피. 검증 방식은 `renderToStaticMarkup` 정적 문자열 비교로 한정 (새 dependency 0).
- [ ] `pnpm --dir web test` green (신규 spec 포함 전량 pass), `pnpm lint` · `pnpm build` green.
- [ ] backend 쪽 변경이 0 이므로 root `pnpm test:cov` 의 line ≥ 80% / function ≥ 80% threshold 가 본 diff 로 떨어지지 않음을 확인 (`pnpm test:cov` 통과).

## Out of Scope

- 편집 동선 일체 — 추가 (`POST`) · 수정 (`PATCH`) · 삭제 (`DELETE`) · primary 지정 (`POST .../primary`) 을 호출하는 form · button · handler prop. 후속 slice.
- 컴포넌트 안에서의 실제 fetch (`fetchServiceIdentities` 호출) · 상태 보유 · `useApiResource` 배선. 본 컴포넌트는 props 만 받는다.
- `web/src/views/AdminView.tsx` 배선 및 그 contract test 추가. 후속 slice.
- RBAC gating (`Admin` 전용 편집 tier 노출 제어) 판단.
- ADR-0058 `§Consequences (b)` 의 **service 후보 목록 제시** 방식 결정 (활성 instance key 조회 수단 신설 여부) — `(d)` 의 편집 slice 가 판단한다.
- `docs/requirements.md` 의 REQ-078 / REQ-079 status 재판정 — ADR-0058 `§Follow-ups (e)` doc-sync slice 몫.
- CSS · 전역 스타일 도입 (PLAN 의 별도 오너 지시 R-187 축).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
