---
id: T-1825
title: AdminView 에 수집 대상(CollectionTarget) 목록 패널 신설 + 마운트
phase: P6
status: DONE
prNumber: 1434
completedAt: 2026-08-31T15:02:45Z
commitMode: pr
coversReq: [REQ-070, REQ-072]
estimatedDiff: 440
estimatedFiles: 4
sizeExempt: true
exemptReason: "consumer-bundled-ui-slice — 소비처(AdminView 마운트) 동반 의무(CLAUDE.md §3) 준수 + R-112 4 종 spec 동반. 컴포넌트만 · 마운트만 으로 쪼개면 소비처 0 helper PR 이 되어 오너 2026-08-31 지시 위반."
independentStream: web-collection-target-ui
dependsOn: []
touchesFiles:
  - web/src/components/CollectionTargetList.tsx
  - web/src/components/CollectionTargetList.test.tsx
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.collection-targets-mount.test.tsx
created: 2026-08-31
plannerNote: "P6/ADR-0059 §Follow-ups (e) 화면 축 첫 조각. cap-bend pre-justified: R-112 backbone × 1.5 = 440 LOC, T-1823 선례 + §3 소비처 동반 의무."
---

# T-1825 — AdminView 에 수집 대상(CollectionTarget) 목록 패널 신설 + 마운트

## Why

[ADR-0059](../decisions/ADR-0059-collection-target-registration.md) `§Follow-ups` 의 (a) ~ (d) 는 T-1808 ~ T-1823 으로 전량 머지돼 backend 5 route 와 오류 계약 e2e 까지 섰지만, **화면 축 (e) 는 아직 0 건**이다 — `web/` 전체에서 `collection-target` 을 언급하는 파일이 하나도 없어, 사람이 등록된 평가 대상 시스템을 **눈으로 확인할 수단이 없다**. [requirements.md](../requirements.md) `89 행` REQ-070(빈 상태에서 막히지 않게 하는 대상 인터페이스) · `91 행` REQ-072(시스템 등록·편집) 가 `PLANNED` 로 남아 있는 이유가 이 화면 부재다.

본 slice 는 그 (e) 를 **읽기 축부터** 연다: 목록 컴포넌트 신설 + AdminView 실제 마운트를 **한 PR 에 함께** 담아, 머지 즉시 Admin 화면에 "수집 대상 관리" 섹션이 실제로 뜨고 빈 상태 안내가 보이게 한다. 컴포넌트만 먼저 만들고 마운트를 다음 slice 로 미루는 절단은 [CLAUDE.md](../../CLAUDE.md) `§3` 소비처 동반 의무(2026-08-31 오너 지시) 가 금지한 형태이므로 채택하지 않는다 — 같은 함정이 ADR-0058 축에서 `web/src/api/serviceIdentity.ts` 를 소비처 0 인 채 세 slice(T-1759 ~ T-1761) 동안 방치시킨 전례가 있다.

등록·수정·삭제 폼(편집 축, Admin+ tier)은 본 slice 범위 밖이며 후속 slice 가 같은 섹션 안에 얹는다.

## Required Reading

- [docs/decisions/ADR-0059-collection-target-registration.md](../decisions/ADR-0059-collection-target-registration.md) — `§Decision 4`(필드) · `§Decision 5`(route · 권한 tier) · `§Follow-ups (e)`
- [src/assessment-collection/collection-target.controller.ts](../../src/assessment-collection/collection-target.controller.ts) `1~80 행` — `GET /api/collection-targets` 가 **`@Roles("User")` 조회 tier** 이고 row 0 개면 빈 배열이라는 계약
- [prisma/schema.prisma](../../prisma/schema.prisma) `690~707 행` — `CollectionTarget` 의 9 필드(`id` · `type` · `instanceKey` · `endpoint` · `orgs[]` · `repos[]` · `spaces[]` · `active` · 타임스탬프)
- [web/src/components/ServiceIdentityList.tsx](../../web/src/components/ServiceIdentityList.tsx) — loading → error → empty → populated 4 분기 presentational 선례(본 컴포넌트가 그대로 승계할 형태)
- [web/src/components/ServiceIdentityList.test.tsx](../../web/src/components/ServiceIdentityList.test.tsx) — 위 4 분기 spec 선례
- [web/src/components/LlmProviderConfigList.tsx](../../web/src/components/LlmProviderConfigList.tsx) — row 타입을 **컴포넌트 파일에서 정의·named export** 하는 선례(본 slice 는 새 api client 모듈을 만들지 않는다)
- [web/src/api/useApiResource.ts](../../web/src/api/useApiResource.ts) `1~60 행` — `path` 하나로 loading/error/data 를 주는 조회 hook 계약
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) `3140~3170 행`(`useApiResource` 호출 선례) · `5573 행` 부터의 파트 관리 `<section>` 과 `5674 행` 의 그 닫는 태그(새 섹션을 그 뒤, 최외곽 `</section>` 앞에 넣는다)
- [web/src/views/AdminView.service-identity-row-actions-mount.test.tsx](../../web/src/views/AdminView.service-identity-row-actions-mount.test.tsx) — AdminView 마운트 계약 spec 선례(fetch mock 방식 포함)

## Acceptance Criteria

- [ ] `web/src/components/CollectionTargetList.tsx` 를 신설한다. `ServiceIdentityList` 와 동형의 **controlled presentational 컴포넌트** 로, fetch · 상태 보유 · 정렬 · 필터 · 복제를 일체 하지 않고 props(`targets` · `loading?` · `error?` · `emptyMessage?`)만 받아 렌더한다. 분기 순서는 loading → error → empty → populated 로 고정한다.
- [ ] row 타입 `CollectionTargetRow` 를 같은 파일에서 정의하고 named export 한다(`LlmProviderConfigRow` 선례). 필드는 schema `690~707 행` 과 1:1 이며, 표시는 최소 `type` · `instanceKey` · `endpoint` · `active` 4 축으로 한다(배열 3 종의 표시 형태는 구현자 재량, 단 `undefined` / 빈 배열에서 throw 하지 않을 것).
- [ ] `web/src/views/AdminView.tsx` 에 **실제 마운트** 한다 — `useApiResource<CollectionTargetRow[]>('/api/collection-targets')` 1 회 호출(기존 조회에 double-fetch 추가 금지)로 얻은 data/loading/error 를 그대로 props 로 내려보내고, `<section aria-label={COLLECTION_TARGET_HEADING}>` + `<h2>` 를 파트 관리 섹션 뒤에 추가한다. backend GET 이 `User+` tier 이므로 이 섹션은 `isAdmin` gating **바깥**에 둔다(편집 컨트롤이 없으므로 403 유발 0).
- [ ] 빈 상태 문구는 REQ-070 의도(빈 상태에서 막히지 않게)를 살려 한국어로 명시한다(예: `등록된 수집 대상이 없습니다`). 문구 상수는 기존 `*_HEADING` 상수 convention 을 따른다.
- [ ] **happy-path unit test** — `CollectionTargetList` 가 row 2+ 건을 받으면 각 행의 `type` · `instanceKey` · `endpoint` 가 DOM 에 뜨는 test 1+, AdminView 마운트 spec 에서 `GET /api/collection-targets` 응답 row 가 실제 화면 노드로 렌더되는 test 1+.
- [ ] **error path unit test** — `error` prop 이 truthy 면 목록 대신 `role="alert"` 만 렌더되는 test 1+, AdminView 마운트 spec 에서 조회가 비-2xx(예: 500)일 때 목록 대신 오류 표면이 뜨는 test 1+.
- [ ] **분기 cover** — loading · error · empty · populated 4 분기 각 1+ test, 그리고 우선순위(`loading` 이 error · 잔여 목록보다 우선, `error` 가 빈 목록보다 우선) test 1+.
- [ ] **negative cases 충분 cover** — 최소 5 종: ① `targets` 빈 배열(정상 empty), ② `emptyMessage` 빈 문자열 → 기본 문구 fallback, ③ 필드 누락 row(`endpoint` 부재 등)에서 throw 없이 렌더, ④ `active: false` 행이 활성 행과 구분돼 표시, ⑤ 응답 body 가 배열이 아닐 때(`null` · 객체) AdminView 가 throw 없이 빈 상태로 흡수. 각 1+ test.
- [ ] `pnpm --dir web test` 전량 green (기존 web spec 회귀 0), `pnpm --dir web build` 성공.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 본 slice 는 `src/` 무변경이라 백엔드 coverage 변동 0 이어야 한다.
- [ ] `src/` · `prisma/` · `test/` · `package.json` · `.github/workflows/` 무변경.

## Out of Scope

- 등록 · 수정 · 삭제 · `active` 토글 폼(편집 축, Admin+ tier) — 후속 slice 가 같은 섹션 안에 얹는다.
- `web/src/api/collectionTarget.ts` 같은 **새 api client 모듈 신설** — 본 slice 는 조회 1 개뿐이라 `useApiResource` 로 충분하고, 소비처보다 앞선 client 모듈은 §3 소비처 동반 의무가 막는다.
- ADR-0059 `§Consequences (a)` 의 env 유래 vs DB row **출처 표시** 와 `(b)` 의 `instanceKey` 후보 제시 — 편집 축과 함께 판단한다.
- `docs/architecture/api.md` · `docs/requirements.md` doc-sync — `§Follow-ups (f)` 소관이며 `direct` 라 본 `pr` task 와 혼합 금지(CLAUDE.md §3.1 규칙 3).
- AdminView 의 기존 섹션 · 기존 export 목록 · 기존 helper 리팩터(순수 추출 포함) — 본 slice 는 신규 섹션 추가만 한다.
- e2e / smoke spec 추가 — 화면 e2e 는 편집 축이 선 뒤 별도 slice.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 추가한다.)

## Result (2026-08-31)

**DONE** — [PR #1434](https://github.com/myungjoo/Assessment-Agent/pull/1434) → main `2fe1b581` (squash), 4 파일 `+639/-0`. reviewer round 2 APPROVE(round 1 MINOR 2 건을 본 PR 안에서 closure — CLAUDE.md §3 Nit-in-PR closure), 4-게이트 PASS.

- `web/src/components/CollectionTargetList.tsx` 신설 — `ServiceIdentityList` 동형 controlled presentational. 분기 순서 `loading → error → empty → populated` 고정, `CollectionTargetRow` 같은 파일 named export.
- `web/src/views/AdminView.tsx` 마운트 — `useApiResource` 1 회 조회를 `Array.isArray` 로 정상화해 `isAdmin` gating **바깥** 섹션에 내려보낸다(`GET /api/collection-targets` 는 `@Roles("User")` 조회 tier).
- spec 2 개 27 case 신규 — happy / error(`role="alert"` · 비-2xx 500) / 분기 4 종 우선순위 / negative 5 종(round 2 에서 빈 문자열 · 비-배열 경계 2 건 가산). web 109 파일 3,078 test 전량 green, build 성공.
- `src/` · `prisma/` · `test/` · `package.json` · `.github/workflows/` 무변경이라 전역 coverage 변동 0(백엔드 463 suite / 13,404 test green).
- 실측 `+639 LOC` 로 `estimatedDiff` 440 초과 — 초과분 전량 spec 이고 제품 코드는 206 LOC(300 상한 내). `sizeExempt: true` 이며 PR 본문 · review 에 공시했다.
