---
id: T-1832
title: AdminView 수집 대상 범위 배열 3 축(orgs·repos·spaces) 인라인 편집 + PATCH 배선
phase: P6
status: DONE
commitMode: pr
prNumber: 1440
coversReq: [REQ-070, REQ-072, REQ-073]
independentStream: collection-target-admin-ui
dependsOn: [T-1831]
touchesFiles:
  - web/src/views/adminCollectionTargetRunners.ts
  - web/src/components/CollectionTargetList.tsx
  - web/src/components/CollectionTargetList.test.tsx
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.collection-targets-scope-edit.test.tsx
estimatedDiff: 850
estimatedFiles: 5
sizeExempt: true
exemptReason: "cap-bend pre-justified — R-112 4-카테고리 backbone(파싱 helper + 러너 patch 확장 + 컴포넌트 폼 분기 + 컨테이너 배선 + spec 2 종) × 1.5. 동형 선례 실측이 T-1831 5 파일 +1,039/-0(제품 261 LOC · 나머지 전부 spec)이고 본 slice 는 축이 3 개라 spec 이 그만큼 늘어난다. 파일 수 5 로 파일 cap(≤ 5)은 예외 없이 준수 — LOC 만 면제."
created: 2026-09-01
plannerNote: "P6 / ADR-0059 §Follow-ups (e) 편집 축의 마지막 조각 — 배열 3 축을 한 기능으로 묶어 발사(§3 소비처 동반 의무, 축별 분할 금지)"
---

# T-1832 — AdminView 수집 대상 범위 배열 3 축(orgs·repos·spaces) 인라인 편집 + PATCH 배선

## Why

[ADR-0059](../decisions/ADR-0059-collection-target-registration.md) `§Follow-ups (e)` (AdminView
등록·편집 패널) 에서 아직 화면이 없는 축은 **범위 배열 3 종**(`orgs` · `repos` · `spaces`) 하나뿐이다.
읽기([T-1825](T-1825-admin-collection-target-list-panel.md)) · 등록([T-1826](T-1826-admin-collection-target-create-form.md)) ·
삭제([T-1828](T-1828-admin-collection-target-delete.md)) · 활성 토글([T-1829](T-1829-admin-collection-target-active-toggle.md)) ·
endpoint 편집([T-1831](T-1831-admin-collection-target-endpoint-edit.md)) 이 모두 shipped 이고,
T-1831 이 남긴 `Follow-ups` 가 본 slice 의 배선 지점(파싱 helper 는 러너 모듈, 노출 분기는 목록의
편집 폼 안 행 `type`)까지 못박아 두었다.

본 slice 는 그 마지막 조각을 화면에서 끝까지 발사한다 — 이미 열려 있는 인라인 편집 폼에 범위 입력을
얹어 GITHUB 대상은 `orgs` · `repos` 를, CONFLUENCE 대상은 `spaces` 를 콤마 목록으로 고치고
`PATCH /api/collection-targets/:id` 로 보낸 뒤 권위 재조회로 닫는다. **수집 범위를 삭제 + 재등록
없이 넓히거나 좁힐 수 있게 되는, 그 자체로 완결된 사용자 기능**이다 (REQ-072 "평가 대상 시스템
등록·편집" 의 편집 나머지 절반, REQ-070 의 "막히지 않는 대상 인터페이스").

3 축을 **한 slice 로 묶는 것이 의도**다 — 세 축은 같은 폼 · 같은 파싱 helper · 같은 러너 · 같은
컨테이너 handler 를 쓰므로 type 별로 쪼개면 두 번째 slice 의 제품 코드가 ~40 LOC 에 그쳐
[CLAUDE.md](../../CLAUDE.md) `§3` 이 금지하는 "절단면이 기능이 아니라 diff 크기" 인 분할이 된다.
러너 helper 만 신설하고 배선을 미루지도 않는다 (같은 §3 소비처 동반 의무) — 파싱 helper · 폼 입력 ·
컨테이너 handler 를 **한 PR** 에 담는다. 파일 수는 5 로 파일 cap 을 지키고, LOC 만 위 `exemptReason`
으로 면제한다.

issue-still-relevant pre-check (planner, `origin/main` `fa553d7e`): `CollectionTargetList.tsx` 의
편집 props 는 `onEditStart` · `editingId` · `editEndpoint` · `onEditEndpointChange` ·
`onEditSubmit` · `onEditCancel` · `editBusy` 뿐이라 범위 입력 0, `adminCollectionTargetRunners.ts`
`245~247 행` `CollectionTargetPatch` 는 `endpoint?: string` 하나뿐, web 전역에 콤마 파싱 helper
(`parseCommaList` 류) **0 건**. 즉 본 축은 main 에 아직 안착하지 않았다. backend 는 이미 준비돼
있다 — [update-collection-target.dto.ts](../../src/assessment-collection/dto/update-collection-target.dto.ts)
`57~71 행` 이 `orgs` · `repos` · `spaces` 를 `@IsArray()` 허용 축으로 받는다(신규 backend 변경 0).
`docs/requirements.md` `89~92 행` REQ-070 / REQ-072 / REQ-073 재판정은 [CLAUDE.md](../../CLAUDE.md)
`§3.1` 규칙 6 대로 **본 slice 머지 후 1 회**만 하며 본 task 범위 밖이다.

## Required Reading

- [web/src/views/adminCollectionTargetRunners.ts](../../web/src/views/adminCollectionTargetRunners.ts) — `245~247 행` `CollectionTargetPatch`(본 slice 가 배열 3 축을 더한다), `254~268 행` `UpdateCollectionTargetDeps`, `285 행` 이하 `runUpdateCollectionTarget` 의 body 조립 분기(`typeof patch.endpoint === 'string'` 옆에 배열 축 분기를 같은 관례로 붙인다). 상수 `COLLECTION_TARGETS_PATH`(`25 행`) 재선언 금지.
- [web/src/components/CollectionTargetList.tsx](../../web/src/components/CollectionTargetList.tsx) — row 의 `orgs` / `repos` / `spaces`(`30~35 행`), 표시용 `formatScope`(`87 행` 부근), 편집 props 블록(`onEditStart` 이하)과 편집 중 행의 인라인 폼 렌더. presentational 경계(fetch·상태 보유 금지, controlled props 만) 그대로 유지.
- [web/src/components/CollectionTargetList.test.tsx](../../web/src/components/CollectionTargetList.test.tsx) — `660 행` 이하 T-1831 편집 축 케이스. 특히 `682 행` `expect(onEditStart).toHaveBeenCalledWith('t2', 'https://conf.example.com')` 는 **인자 2 개 정확 일치** 라 `onEditStart` 시그니처를 바꾸면 깨진다(아래 설계 계약이 그래서 시그니처를 건드리지 않는다).
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — `4458 행` `collectionTargets` memo(편집 시작 시 범위 prefill 을 여기서 조회한다), `4563~4620 행` 편집 축 state 3 + handler 3(시작 · 취소 · 저장), `5905~5935 행` 목록 마운트와 `isAdmin` gating.
- [web/src/views/AdminView.collection-targets-endpoint-edit.test.tsx](../../web/src/views/AdminView.collection-targets-endpoint-edit.test.tsx) — 직전 동형 slice 의 spec 구조(러너 단위 케이스 + 컨테이너 배선 렌더 케이스를 **한 파일**에 둔다). 본 slice 의 새 spec 이 이 구조를 따른다.
- [src/assessment-collection/dto/update-collection-target.dto.ts](../../src/assessment-collection/dto/update-collection-target.dto.ts) — `57~71 행` `orgs` / `repos` / `spaces` `@IsArray()` 허용 축, 정체성 축(`type` · `instanceKey`) body 금지(`forbidNonWhitelisted` 400).
- [docs/decisions/ADR-0059-collection-target-registration.md](../decisions/ADR-0059-collection-target-registration.md) `§Decision 5`(PATCH 200 / merge patch / 400 · 403 · 404 오류 표) · `§Follow-ups (e)`.

## 설계 계약 (구현 전 확정)

**파싱 helper** — `adminCollectionTargetRunners.ts` 에 `parseScopeInput(raw: string): string[]` 을
export 한다(순수 함수, throw 0): 콤마로 나눠 각 원소 trim → 빈 원소 제거 → 앞선 것 우선으로 중복
제거. 비문자열 입력은 빈 배열. 빈 배열 결과는 **유효한 값**이다 (범위를 전부 비우는 편집).

**러너** — `CollectionTargetPatch` 에 `orgs?: string[]` · `repos?: string[]` · `spaces?: string[]`
를 더하고, body 조립에서 축마다 `Array.isArray(patch.<축>)` 인 경우에만 싣는다(배열 아닌 값은 무시 —
400 확정 요청 차단). `endpoint` 축 계약과 가드(빈 id · 빈 patch · in-flight · `finally` 해제 ·
성공 재조회 + `onUpdated` · 실패 문구 표면화 throw 0)는 **글자 그대로 유지**한다. 적용 키가 0 개면
여전히 미발사다 — 배열 축만 실린 PATCH 는 정상 발사된다.

**목록 컴포넌트** — 편집 폼에 범위 입력을 추가하되 props 는 2 개만 늘린다(6 개로 흩지 않는다):
`editScopes?: { orgs?: string; repos?: string; spaces?: string }`(controlled 값) ·
`onEditScopeChange?: (field: 'orgs' | 'repos' | 'spaces', next: string) => void`. **`onEditStart`
시그니처는 바꾸지 않는다**(`682 행` 정확-일치 assert 보호 — 범위 prefill 은 컨테이너가 자기
`collectionTargets` 에서 id 로 찾는다). 노출 분기는 편집 중인 행의 `type` 으로 가른다 — `GITHUB` 은
`orgs` · `repos` 2 입력, `CONFLUENCE` 는 `spaces` 1 입력, 그 외/누락 type 은 범위 입력 0(endpoint 만).
각 입력은 접근 가능한 이름을 갖고, `onEditScopeChange` 미전달 시 범위 입력을 렌더하지 않는다(하위
호환 — 선행 slice 회귀 0).

**컨테이너** — AdminView 에 범위 편집 state 1 개(`collectionTargetScopeEditInput`, 3 필드 문자열
객체) 를 추가하고 ① 편집 시작 handler 에서 `collectionTargets` 를 id 로 찾아 각 배열을 `', '` 로
접어 prefill ② 변경 handler 는 field 별로 state 를 갱신 ③ 저장 handler 는 편집 중 행의 `type` 에
맞는 축만 `parseScopeInput` 으로 파싱해 `{ endpoint, ...범위축 }` 로 실어 보낸다 ④ 취소·성공 시
범위 state 도 함께 비운다. 범위 콜백도 편집 축과 같이 **`isAdmin` 일 때만** 내려보낸다
(`@Roles("Admin")` PATCH — 403 확정 컨트롤 미노출, REQ-073).

## Acceptance Criteria

- [ ] `parseScopeInput` + `CollectionTargetPatch` 배열 3 축이 `adminCollectionTargetRunners.ts` 에 추가되고, `CollectionTargetList` 편집 폼 · AdminView handler 까지 같은 PR 에서 배선돼 화면에서 범위 편집이 실제 PATCH 로 발사된다(helper 단독 slice 아님 — §3 소비처 동반 의무).
- [ ] **happy-path**: ① GITHUB 행에서 "편집" → `orgs` · `repos` 입력 변경 → "저장" 이 `PATCH /api/collection-targets/<encode(id)>` 를 body `{ endpoint, orgs: [...], repos: [...] }` 로 1 회 발사하고 성공 시 재조회 + 폼 종료. ② CONFLUENCE 행에서 같은 흐름이 `{ endpoint, spaces: [...] }` 로 발사되는 test 1+. ③ `parseScopeInput('a, b ,c')` → `['a','b','c']` 단위 test 1+.
- [ ] **error path**: 발사기 reject(400 · 403 · 404 · 5xx · 네트워크 0 표면) 시 오류 문구가 표면화되고 throw 0 · 재조회 미호출 · 진행 id 가 `finally` 로 해제되며 입력값이 유지된다는 test 1+.
- [ ] **분기 cover**: 러너 — 배열 축만 실린 patch 발사 · `endpoint` 와 배열 동시 발사 · 배열이 배열 아님(무시) · 적용 키 0 개 미발사 · in-flight 미발사 각 1+. 컴포넌트 — `type === 'GITHUB'` 은 orgs/repos 만, `type === 'CONFLUENCE'` 는 spaces 만, 알 수 없는/누락 type 은 범위 입력 0, `onEditScopeChange` 미전달 시 범위 입력 미렌더 각 1+. 컨테이너 — prefill 이 배열을 `', '` 로 접는 경로 · 빈 배열/`undefined` 배열 prefill 경로 각 1+.
- [ ] **negative cases 충분 cover**(단일 negative 금지 — 예외 분기마다): `parseScopeInput` 의 빈 문자열 · 공백뿐 · 콤마뿐(`',,,'`) · 중복 원소 · 앞뒤 공백 · 비문자열(`undefined` · 숫자 · 배열) 입력 각 1+ · 범위를 전부 지운 저장이 빈 배열로 발사(축 누락 아님) · 이중 저장 클릭 미발사 · 재발화 시 직전 오류 문구 초기화 · 특수문자 id 의 `encodeURIComponent` 인코딩 · 예상 밖 응답 shape(배열 · null)에도 throw 0 · non-Admin 마운트에서 범위 입력 미렌더(403 확정 컨트롤 미노출).
- [ ] 기존 spec 회귀 0 — 수집 대상 관련 기존 spec 6 개(`collection-targets-mount` · `create` · `delete` · `active-toggle` · `endpoint-edit` · `adminCollectionTargetRunners.test.ts` · `CollectionTargetList.test.tsx`)가 **기존 케이스 수정 없이** 통과한다(새 props 는 전부 optional, `onEditStart` 시그니처 불변).
- [ ] `pnpm --dir web test` green · `pnpm --dir web build` green(`tsc --noEmit` + `vite build`).
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `src/` 무변경이라 backend coverage 변동 0 이어야 한다.
- [ ] 변경 파일이 frontmatter `touchesFiles` 5 개를 넘지 않는다(파일 cap 준수 — 새 컴포넌트/모듈 파일 신설 금지, 러너 단위 케이스는 신규 spec 파일에 함께 둔다).

## Out of Scope

- **정체성 축(`type` · `instanceKey`) 편집** — ADR-0059 `§Decision 5` 가 "변경은 DELETE + POST" 로 못박았다. 입력조차 만들지 않는다.
- 새 컴포넌트 파일(`CollectionTargetEditForm.tsx`) · 새 helper 모듈 신설 — 파일 cap 을 깨고 slice 를 다시 쪼개게 만든다. 범위 입력은 `CollectionTargetList` 안 인라인, 파싱 helper 는 기존 러너 모듈에 둔다.
- `adminCollectionTargetRunners.test.ts` 수정 — 러너·helper 단위 케이스는 본 slice 의 신규 spec 파일에 둔다(T-1831 선례, 파일 cap 보호).
- backend 변경(`src/`) 일체 — `UpdateCollectionTargetDto` 는 이미 배열 3 축을 받는다. `prisma/schema.prisma` · migration · e2e 신설 0.
- per-resource api client 모듈 추출 · 낙관적 갱신(성공 후 권위 재조회 유지) · `useApiResource` 전환.
- AdminView 의 다른 helper 군 순수 추출(PLAN `183 행` 부채 축) — 본 slice 는 이미 추출된 러너 모듈에 붙일 뿐 새 추출을 하지 않는다.
- `docs/requirements.md` REQ-070 / REQ-072 / REQ-073 재판정 · `docs/architecture/api.md` doc-sync · PLAN `130 행` · `183 행` 갱신 — 전부 `direct` 라 `§3.1` 규칙 3 상 본 `pr` task 와 혼합 금지이며, REQ 재판정은 규칙 6 대로 본 slice 머지 후 1 회만.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (reviewer MINOR, informational) 콤마 목록 UI 라 **원소 자체에 `,` 가 든 범위 값**은 접었다 펴는 과정에서 갈라진다. GitHub org/repo · Confluence space key 명명 규칙상 실현 가능성이 사실상 0 이라 본 PR cap 안에서 고치지 않았다 — 구분자 변경이 필요해지면 별도 slice 로 판정한다.
- (planner 예약) 편집 축 3 slice(T-1831 · 본 slice) 머지 후 **1 회** 의 `direct` doc-sync — `docs/requirements.md` REQ-070 / REQ-072 / REQ-073 재판정 + `docs/architecture/api.md` 수집 대상 5 route 표 동기 + PLAN `130 행` 시스템 축 잔여 갱신(ADR-0059 `§Follow-ups (f)`).

## Result (2026-09-01)

`web/src/views/adminCollectionTargetRunners.ts` 에 콤마 목록 파싱 helper(`parseScopeInput`)와 `type` 별 축 매핑을 두고, `runUpdateCollectionTarget` 의 `patch` 에 배열 3 축(`orgs` · `repos` · `spaces`)을 실어 보내도록 확장했다 — 배열이면 **빈 배열도 그대로 발사**해 "범위 비우기" 를 표현하고, 배열 아닌 값은 body 에서 제외한다. 소비처는 같은 PR 에 동반했다: `CollectionTargetList` 는 props 2 개(`editScopes` · `onEditScopeChange`)만 늘려 이미 열려 있는 인라인 편집 폼 안에서 행 `type` 으로 입력을 가르고(GITHUB → `orgs`/`repos`, CONFLUENCE → `spaces`), `onEditStart` 시그니처는 불변으로 두었다. `AdminView` 는 state 1 개로 prefill · 갱신 · 리셋을 관장한다. 정체성 축(`type` · `instanceKey`)은 입력조차 만들지 않아 ADR-0059 `§Decision 5` 를 지켰고, 편집 콜백은 `isAdmin` 일 때만 내려 403 확정 컨트롤을 미노출한다(REQ-073).

5 파일 `+1,113/-5` — `estimatedDiff: 850`(`sizeExempt: true` 사전 정당화) 대비 초과분은 spec LOC 이고 파일 cap(5)은 예외 없이 준수했다. 신규 spec `AdminView.collection-targets-scope-edit.test.tsx` 92 케이스로 R-112 4 종(happy / error path 400·403·404·5xx·네트워크 / 분기 러너 5 · 컴포넌트 4 · 컨테이너 6 / negative 빈 · 공백 · 콤마뿐 · 중복 · 비문자열 · 범위 비우기 · 이중 저장 · 문구 초기화 · `encodeURIComponent` · 응답 shape · non-Admin 미노출)을 덮었다. web 3,446 test(116 파일) green · 루트 `pnpm lint && pnpm build && pnpm test` 13,404 test green(`src/` 무변경이라 backend coverage 변동 0). PR [#1440](https://github.com/myungjoo/Assessment-Agent/pull/1440) reviewer APPROVE round=1 · CI green · squash 머지(`82a409d2`). 이로써 ADR-0059 `§Follow-ups (e)` 편집 축의 마지막 조각이 닫혔다.
