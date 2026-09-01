---
id: T-1830
title: AdminView 의 수집 대상 러너 군을 별도 모듈로 순수 추출
phase: P6
status: DONE
commitMode: pr
prNumber: 1438
coversReq: [REQ-070, REQ-072, REQ-073]
independentStream: adminview-god-component-refactor
dependsOn: [T-1829]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/adminCollectionTargetRunners.ts
estimatedDiff: 470
estimatedFiles: 2
sizeExempt: true
exemptReason: "pure-extraction — (a) 동작 변경 0 (코드 이동만) · (b) 신규 로직 0 LOC · (c) 기존 spec 3 개가 import 경로까지 무수정으로 통과. 삭제 218 + 추가 약 250 이 전부 이동량이라 LOC 이 위험도에 비례하지 않는다. 파일 수 2 개로 파일 cap (≤ 5) 은 예외 없이 준수."
plannerNote: "P6 / PLAN 183 행 AdminView god component 부채의 둘째 실분할 — ADR-0059 (e) 값 편집 폼을 덧붙이기 전에 수집 대상 러너 군을 먼저 뺀다"
created: 2026-08-31
---

# T-1830 — AdminView 의 수집 대상 러너 군을 별도 모듈로 순수 추출

## Why

[PLAN.md](../PLAN.md) `183 행` (오너 지시 2026-08-31, AdminView god component 부채) 의 **후속 실분할
축** 두 번째 slice 다. 첫 분할([T-1824](T-1824-adminview-row-actions-extract.md) — ServiceIdentity
행별 액션 helper 군 290 줄) 이 파일을 6,087 → 5,797 줄로 줄였지만, 그 뒤 이어진 수집 대상 기능
slice 4 건([T-1825](T-1825-admin-collection-target-list-panel.md) · [T-1826](T-1826-admin-collection-target-create-form.md) ·
[T-1828](T-1828-admin-collection-target-delete.md) · [T-1829](T-1829-admin-collection-target-active-toggle.md))
이 다시 덧붙어 **현재 6,223 줄** 이다. 즉 부채는 아직 순증 중이고, T-1824 가 박제한 순서 원칙
("같은 파일에 다시 수백 줄을 덧붙이기 전에 응집된 helper 군 하나를 먼저 빼는 것이 부채를 늘리지
않는 유일한 순서") 이 지금 그대로 다시 적용된다 — 다음 대기 작업인 [ADR-0059](../decisions/ADR-0059-collection-target-registration.md)
`§Follow-ups (e)` 의 **값 편집 폼**(`endpoint` · `orgs` · `repos` · `spaces`) 이 같은 파일에 또
수백 줄을 덧붙이기 때문이다.

이번 이동 대상은 위 4 slice 가 쌓아 올린 **수집 대상 러너 군 한 덩어리**(등록 POST · 삭제 DELETE ·
활성 토글 PATCH) 다. 세 러너는 서로 1:1 mirror 로 작성돼 응집도가 높고, AdminView 컨테이너에는
`useCallback` 핸들러 배선만 남는다. 추출해 두면 후속 편집 폼 slice 의 `runUpdateCollectionTarget`
이 AdminView 가 아니라 이 모듈에 붙어 **부채를 더 키우지 않고** 기능을 완성할 수 있다.

본 slice 는 **코드를 옮기기만 한다**. 동작 · 계약 · spec 은 한 줄도 바뀌지 않는다.

issue-still-relevant pre-check (planner, `origin/main` `9fd0e116`): `git grep adminCollectionTargetRunners
-- web/src` **0 건**(모듈 미존재), `web/src/views/` 아래 추출 모듈은 `adminServiceIdentityRowActions.tsx`
**하나뿐**, 세 러너와 그 deps 타입은 여전히 [AdminView.tsx](../../web/src/views/AdminView.tsx)
`1904 행` ~ `2110 행` 에 그대로 있음을 실측했다. 즉 본 추출은 main 에 아직 안착하지 않았다.

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — 이동 대상은 **`1904 행` ~ `2110 행`**(207 줄) 한 덩어리 + 그 러너들이 쓰는 상수 2 개(`182~188 행` `COLLECTION_TARGETS_PATH`, `200~203 행` `COLLECTION_TARGET_TYPE_VALUES`). 그 외에 볼 곳은 `21 행`(`RequestOptions` type import 출처) · `126 행`(`COLLECTION_TARGET_TYPES` import) · `4662 행`(`COLLECTION_TARGETS_PATH` 의 두 번째 소비처 = `useApiResource`) · `4691~4760 행`(세 핸들러 배선) · 파일 끝 `export { ... }` 목록의 `6139~6141 행`.
- [web/src/views/adminServiceIdentityRowActions.tsx](../../web/src/views/adminServiceIdentityRowActions.tsx) — 직전 순수 추출 모듈의 **머리 주석 관례**(무엇을 왜 옮겼는지 · 배치 이유 · AdminView 와의 import 방향)와 배치 컨벤션. 본 모듈이 그대로 따른다.
- [docs/tasks/T-1824-adminview-row-actions-extract.md](T-1824-adminview-row-actions-extract.md) — 같은 카테고리의 선례(이동 목록 명시 · re-export 로 spec 무수정 유지 · Acceptance Criteria 형태).
- [.claude/agents/planner.md](../../.claude/agents/planner.md) 의 cap-bend 표 "순수 추출 리팩터" 행 — (a) 동작 변경 없음 · (b) 신규 로직 0 LOC · (c) 기존 spec 그대로 통과 3 조건.
- 무수정으로 통과해야 하는 기존 spec 3 개: [AdminView.collection-targets-create.test.tsx](../../web/src/views/AdminView.collection-targets-create.test.tsx) · [AdminView.collection-targets-delete.test.tsx](../../web/src/views/AdminView.collection-targets-delete.test.tsx) · [AdminView.collection-targets-active-toggle.test.tsx](../../web/src/views/AdminView.collection-targets-active-toggle.test.tsx) (셋 다 `from './AdminView'` 로 러너를 가져온다). 마운트 spec [AdminView.collection-targets-mount.test.tsx](../../web/src/views/AdminView.collection-targets-mount.test.tsx) 는 path 문자열을 자체 상수로 들고 있어 무영향임도 함께 확인한다.

## 이동 대상 (정확한 목록)

새 파일 **`web/src/views/adminCollectionTargetRunners.ts`** 로 옮긴다. `web/src/views/` 아래에
두는 이유는 이동 블록의 상대 import 경로(`../api/apiClient` · `../components/CollectionTargetAddForm`)
가 그대로 유효해 **본문 재작성이 0** 이 되기 때문이다. JSX 가 없으므로 확장자는 `.ts` 다.

- 상수 2 개 — `COLLECTION_TARGETS_PATH`(`188 행`) · `COLLECTION_TARGET_TYPE_VALUES`(`203 행`)
- 함수 3 개 — `runCreateCollectionTarget` · `runDeleteCollectionTarget` · `runToggleCollectionTargetActive`
- type/interface 4 개 — `CollectionTargetInput` · `CreateCollectionTargetDeps` · `DeleteCollectionTargetDeps` · `ToggleCollectionTargetActiveDeps`
- 각 선언 위의 **주석 블록도 그대로 함께** 옮긴다 (주석이 이 러너 군의 가드 근거를 담은 정본이다).

배선 규칙:

- 새 모듈은 상수 2 개 + 함수 3 개를 `export` 하고(타입 4 개는 모듈 내부 소비만이면 `export` 불요),
  AdminView 는 그것들을 `import` 만 한다. AdminView 파일 끝 `export { ... }` 목록의
  `runCreateCollectionTarget` · `runDeleteCollectionTarget` · `runToggleCollectionTargetActive`
  세 줄은 **한 줄도 바꾸지 않는다** — 임포트한 심볼을 그대로 re-export 할 수 있어 기존 spec 3 개의
  `from './AdminView'` 가 그대로 산다.
- `COLLECTION_TARGETS_PATH` 는 `4662 행`(`useApiResource`) 소비처도 새 모듈에서 import 해 쓴다
  (path 정본 1 개 유지 — 문자열 재선언 금지).
- `COLLECTION_TARGET_TYPES`(`../components/CollectionTargetAddForm` 의 정본) 자체는 AdminView 에도
  `4678 행` · `4707 행` 소비처가 남아 있으므로 AdminView 의 import 는 유지하고, 새 모듈은 같은
  컴포넌트 모듈에서 독립적으로 import 한다 (AdminView 경유 재수출 금지 — 순환 회피).
- 본 slice 는 AdminView → 새 모듈의 **단방향 import** 만 만든다. 역방향 import 가 필요해지면 그
  자체가 이동 범위를 잘못 잡았다는 신호이므로 범위를 넓히지 말고 Follow-ups 로 남긴다.

## Acceptance Criteria

- [ ] `web/src/views/adminCollectionTargetRunners.ts` 가 신설되고 위 9 심볼 + 주석 블록이 **본문 변경 0** 으로 옮겨졌다. `git diff` 에서 이동 블록의 삭제 라인과 추가 라인이 (import 구문 · 파일 머리 주석을 제외하고) 1:1 로 일치함을 확인한다.
- [ ] `AdminView.tsx` 의 `1904 행` ~ `2110 행` 구간과 상수 2 개가 제거되고, 그 자리에 새 모듈 import 만 남았다. 파일 끝 `export { ... }` / `export type { ... }` 목록은 무변경.
- [ ] `wc -l web/src/views/AdminView.tsx` 가 **6,030 줄 이하**(현재 6,223) 임을 확인한다.
- [ ] **happy-path**: 기존 spec 3 개가 이동한 3 러너의 정상 경로(POST/DELETE/PATCH 각 1 회 발사 + 재조회)를 이미 cover 한다는 것을 확인하고, 어느 심볼이든 happy-path test 가 0 이면 해당 기존 spec 파일에 1+ 를 보강한다.
- [ ] **error path**: 각 러너의 실패 경로(발사기 reject → 오류 문구 표면화 · throw 0 · 재조회 미호출)가 기존 spec 에 1+ 존재함을 확인하고, 빠진 것이 있으면 보강한다.
- [ ] **분기 cover**: 이동 대상의 분기 — 등록의 허용 밖 `type` 미발사 · 필수 입력 미완 미발사 · in-flight 미발사, 삭제/토글의 진행 중 id 보유 시 미발사, 토글의 `active` true/false 다음 상태, 성공 경로 vs 실패 경로 — 마다 test 1+ 가 존재함을 확인한다.
- [ ] **negative cases 충분 cover**: 빈 문자열 id · 공백뿐 id · 비문자열 id 미발사, 이중 클릭(진행 중) 미발사, 재발화 시 직전 오류 문구 초기화, 실패 경로에서도 `finally` 로 진행 상태 해제, 특수문자 id 의 `encodeURIComponent` 인코딩 — 예외 분기마다 1+ 가 존재함을 확인한다. 단일 negative 만으로 끝내지 않는다.
- [ ] 위 4 항목의 보강이 필요했다면 **기존 spec 파일 안에서만** 처리한다 (새 spec 파일 신설 금지 — 파일 cap 및 순수 추출 성격 보존). 보강이 0 건이면 task 본문 Follow-ups 에 "보강 0 — 기존 spec 이 전량 cover" 를 적는다.
- [ ] `pnpm --dir web test` green — 기존 spec 3 개가 **import 경로 수정 없이** 통과한다 (순수 추출 조건 (c)). 마운트 spec 도 무변경 green.
- [ ] `pnpm --dir web build` green (`tsc --noEmit` + `vite build`).
- [ ] 백엔드 회귀 무영향 확인 — `pnpm lint && pnpm build && pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `src/` 무변경이라 전역 coverage 변동은 0 이어야 한다.

## Out of Scope

- **동작 변경 일체** — 러너 본문 재작성 · 시그니처 변경 · 새 helper 신설 · per-resource api client 모듈 추출 · 주석 내용 수정. 옮기는 것 외의 개선은 전부 Follow-ups 로.
- 기존 spec 3 개의 **import 경로 변경**(`'./AdminView'` → 새 모듈). AdminView re-export 로 무수정 통과가 가능하므로 본 slice 는 건드리지 않는다 (여러 파일이 한꺼번에 바뀌면 순수 추출의 검증 가능성이 흐려진다).
- [ADR-0059](../decisions/ADR-0059-collection-target-registration.md) `§Follow-ups (e)` 의 **값 편집 폼**(`endpoint` · `orgs` · `repos` · `spaces`) 착수 — 본 추출이 끝난 뒤 별도 slice.
- AdminView 의 다른 helper 군(인스턴스 접근 · LLM provider · schedule 등) 추출. 부채는 slice 를 나눠 갚는다.
- `docs/requirements.md` 의 REQ-070 / REQ-072 / REQ-073 status 재판정 — 편집 축 마지막 조각 머지 후 CLAUDE.md `§3.1` 규칙 6 대로 **구현 후 1 회** 만.
- [PLAN.md](../PLAN.md) `183 행` bullet 의 실측 LOC 갱신 · 마커 승격 · AdminView 행 좌표를 인용하는 문서의 pointer 정정 (`direct` 라 `§3.1` 규칙 3 상 본 `pr` task 와 혼합 금지).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **spec 보강 0 — 기존 spec 이 전량 cover** (T-1830 실측). 이동한 3 러너의 happy-path · error path ·
  분기 · negative 를 기존 spec 3 개가 이미 전부 덮고 있어 한 줄도 보강하지 않았다: 등록은 3 no-op
  가드(허용 밖 `type` 3 종 · 필수 입력 미완 5 종 · in-flight) + `input` 자체 부재 4 종 + reject 4 종
  + 예상 밖 성공 shape 4 종, 삭제/토글은 빈·공백뿐·비문자열 id 미발사 + 이중 클릭 미발사 +
  `encodeURIComponent` 인코딩 + 재발화 시 직전 문구 초기화 + `finally` 진행 해제, 토글은
  `active` true/false 다음 상태 양쪽까지 갖췄다. 즉 순수 추출 조건 (c) 를 spec 수정 0 으로 충족했다.
- **AC "새 spec 파일 신설 금지" 로부터의 불가피한 이탈 1 건 (round 2)** — CI `기본 검사` 의
  [scripts/check-spec-presence.sh](../../scripts/check-spec-presence.sh) 가 **신규 production
  `*.ts` 에 동반 spec 을 강제** 해 red 였다 (T-1824 의 추출 모듈은 확장자가 `.tsx` 라 이 게이트의
  검사 대상이 아니었고, 본 모듈은 JSX 가 없어 `.ts` 라서 걸린다). R-111 CI green 은 우회 불가
  절대 규칙이므로 `web/src/views/adminCollectionTargetRunners.test.ts` 를 신설했다. 단 기존 spec
  3 개의 케이스를 복제하지 않고, 그 3 개가 볼 수 없는 **새 모듈 자신의 공개 표면**(직접 import 경로의
  export 계약 · 정상 발사 · 실패 흡수 · 미발사 가드) 만 4 케이스로 검증한다 — 이동 전에는 존재할 수
  없던 검증이라 중복이 아니다. 기존 spec 3 개는 여전히 **한 줄도 수정하지 않았다**.
- 후속으로 `check-spec-presence.sh` 의 검사 대상을 `.tsx` 까지 넓힐지(현재 `.tsx` 신규 production
  파일은 spec 동반 의무를 우회한다 — T-1824 의 `adminServiceIdentityRowActions.tsx` 가 실제 사례)
  planner 판단이 필요하다. 본 slice 범위 밖이라 여기 남긴다.
- ADR-0059 `§Follow-ups (e)` 의 **값 편집 폼**(`endpoint` · `orgs` · `repos` · `spaces`) slice 는
  `runUpdateCollectionTarget` 을 AdminView 가 아니라 본 모듈
  ([web/src/views/adminCollectionTargetRunners.ts](../../web/src/views/adminCollectionTargetRunners.ts))
  에 추가한다 — 그래야 AdminView 가 다시 자라지 않는다.
- AdminView 는 본 slice 로 6,223 → 6,002 줄이 됐지만 여전히 god component 다. 다음 순수 추출 후보는
  인스턴스 접근 · LLM provider · schedule helper 군이며, PLAN `183 행` 부채 축의 셋째 slice 로
  planner 가 별도 큐잉한다 (본 slice 는 범위를 넓히지 않는다).

## Result (2026-09-01)

`web/src/views/adminCollectionTargetRunners.ts` 를 신설해 AdminView 의 수집 대상 러너 군 (러너 3 + deps 타입 4 + 상수 2) 을 본문 재작성 0 으로 이동했다. 이동 207 줄은 `export` 키워드 3 개를 뺀 나머지가 diff 상 1:1 일치이며, AdminView 는 단방향 import 만 하고 파일 끝 `export { ... }` 목록은 무변경이라 기존 spec 3 개가 **import 경로 수정 0** 으로 통과했다 (순수 추출 조건 (a)(b)(c) 충족). AdminView 는 6,223 → **6,002 줄**. 4 파일 `+428/-222`, web 114 파일 3,255 test green · 루트 `pnpm test:cov` 463 파일 13,404 test green (line · function 80% 게이트 통과, `src/` 무변경이라 전역 coverage 변동 0). PR [#1438](https://github.com/myungjoo/Assessment-Agent/pull/1438) reviewer APPROVE round=2 · CI green · squash 머지 (`b3af6c35`). AC "새 spec 파일 신설 금지" 는 CI `기본 검사` 의 [check-spec-presence.sh](../../scripts/check-spec-presence.sh) 가 신규 production `.ts` 에 동반 spec 을 강제해 round 2 에서 **이탈 1 건** — 기존 spec 복제 0 의 모듈 경계 spec 4 케이스만 신설했고 사유는 `Follow-ups` 에 박제했다 (R-111 CI green 우선).
