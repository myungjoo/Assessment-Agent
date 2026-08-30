---
id: T-1807
title: ADR — 평가 대상 시스템(수집 대상) 등록·편집 모델·API 계약 (저장 위치 · credential 경계 · env 병합 · RBAC)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-070, REQ-072, REQ-073]
independentStream: p6-collection-target-registration
dependsOn: []
touchesFiles:
  - docs/decisions/ADR-0059-collection-target-registration.md
estimatedDiff: 270
estimatedFiles: 1
created: 2026-08-30
plannerNote: "PLAN 130 행 잔여 3 row(REQ-070·072·073) 중 시스템 축 진입 — 오너가 '모델·API·UI 부재 시 신설(architect 판단 — ADR 동반)' 을 명시한 축의 ADR-우선 첫 slice (doc-only 신규 ADR × 1.6)"
---

# T-1807 — ADR: 평가 대상 시스템(수집 대상) 등록·편집 모델·API 계약

## Why

[PLAN.md](../PLAN.md) `130 행` 오너 지시(2026-08-26, R-164~R-168)의 인원 축은 2026-08-30 재판정으로
5/5 shipped 가 됐고([T-1802](T-1802-requirements-req071-person-crud-rejudge.md) ~
[T-1806](T-1806-api-persons-include-inactive-contract-sync.md)), 남은 잔여는
[requirements.md](../requirements.md) `89 행` REQ-070(빈 상태 우산) · `91 행` REQ-072(시스템 등록·편집) ·
`92 행` REQ-073(RBAC) 세 row 뿐이다. 세 row 는 모두 `PLANNED` 이고 착수 slice 가 **0** 이다.

실측 근거(`origin/main` 기준): 평가 대상 시스템의 좌표는 지금 **env 에만** 존재한다 —
[github-instance-config.ts](../../src/github/github-instance-config.ts) 가 `GITHUB_INSTANCES` key list 와
`_HOST` / `_ORG` / `_REPOS` / `_TOKEN_ENC` 접두 변수를,
[confluence-instance-config.ts](../../src/confluence/confluence-instance-config.ts) 가
`CONFLUENCE_INSTANCES` 와 `_BASE_URL` / `_AUTH_USER` / `_SPACE_ALLOWLIST` / `_TOKEN_ENC` 를 읽는
순수 함수뿐이며, `git grep "CollectionTarget\|collection-target" -- src docs` 결과가 **0 건** 이라
DB model · API · Admin UI 어느 것도 없다. 즉 운영자가 화면에서 평가 대상 시스템을 등록·편집할 수단이
전무하고, PLAN 130 행이 "수집 대상 등록 모델·API·UI 가 부재하면 신설(architect 판단 — ADR 동반)" 이라고
지시한 그 조건이 그대로 성립한다. 본 task 는 그 축의 **ADR-우선 첫 slice** 로 결정만 박제하고
코드는 1 LOC 도 만들지 않는다([T-1738](T-1738-adr-service-identity-management-api.md) 선례 동형).

## Required Reading

- [docs/PLAN.md](../PLAN.md) — `130 행` 오너 지시 bullet (본 task 의 상위 지시. 잔여 3 row 서술).
- [docs/requirements.md](../requirements.md) — `89 행` REQ-070 · `91 행` REQ-072 · `92 행` REQ-073 세 row.
- [docs/decisions/ADR-0058-service-identity-management-api.md](../decisions/ADR-0058-service-identity-management-api.md)
  — 절 구성 · frontmatter · "결정만 박제, 코드 0 LOC" 서술의 **형식 선례**. 그대로 mirror 한다.
- [src/github/github-instance-config.ts](../../src/github/github-instance-config.ts) — 현행 GitHub 대상 좌표
  (`GITHUB_INSTANCES` key list, `_HOST` / `_ORG` / `_REPOS` / `_TOKEN_ENC`).
- [src/confluence/confluence-instance-config.ts](../../src/confluence/confluence-instance-config.ts) — 현행
  Confluence 대상 좌표 (`_BASE_URL` / `_AUTH_USER` / `_SPACE_ALLOWLIST` / `_TOKEN_ENC`).
- [prisma/schema.prisma](../../prisma/schema.prisma) — `55 행` `Person` · `257 행` `ServiceIdentity` ·
  `614 행` `ExportJob` (신규 model 신설 시의 컨벤션 참고: cuid PK · createdAt/updatedAt · `@@unique`).
- [docs/architecture/api.md](../architecture/api.md) — `77 행` `GET /api/persons` 행의 권한 컬럼 표기와
  성공 status 관례(POST 201 / DELETE 204). 새 endpoint 표기를 여기에 정합시켜 결정한다(동기 자체는 후속).

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0059-collection-target-registration.md` 신설. frontmatter 는 ADR-0058 과 동형
      (`id: ADR-0059`, `title`, `status: ACCEPTED`, `date: 2026-08-30`, `relatedTask: [T-1807]`,
      `relatedReq: [REQ-070, REQ-072, REQ-073]`, `supersedes: null`) + 절 구성 동형
      (`Status` / `Context` / `Decision` / `Consequences` / `Alternatives considered` / `Out of scope` /
      `References` / `Follow-ups`).
- [ ] **§Decision 1 — 저장 위치**: (a) 신규 Prisma model 신설 · (b) env-only 유지 + 조회 API 만 ·
      (c) env + DB hybrid 중 **하나** 를 채택하고 나머지를 §Alternatives 로 내린다. 채택 근거는 REQ-072 의
      "등록·편집" 문언과 현행 env-only 실측(위 Why)에 직접 연결한다 — "미결" 로 남기지 않는다.
- [ ] **§Decision 2 — credential 경계**: 대상 좌표(host / org / repo / baseUrl / SPACE)와 credential
      (`_TOKEN_ENC` · `_AUTH_USER`)의 분리를 못 박는다. **token 실값도 암호문도 DB·API 응답에 넣지 않는다**
      는 결정을 CLAUDE.md §9 와 기존 env 계약(ADR-0014 / ADR-0017 / ADR-0018)에 정합하게 명시하고,
      등록된 대상이 어떤 credential key 를 쓸지를 어떻게 가리킬지(예: instance key 참조만 보관)를 결정한다.
- [ ] **§Decision 3 — env 와 등록 대상의 관계·우선순위**: 기존 `resolveGithubInstances` /
      `resolveConfluenceInstances` 결과와 새 등록 대상이 **병합되는지 · 어느 쪽이 우선인지 · 충돌 시
      동작** 을 결정한다. 기존 수집 경로가 본 결정만으로는 **동작 변화 0** 임을 1 구절로 명시한다
      (배선은 후속 slice 책임).
- [ ] **§Decision 4 — 대상 종류 모델링**: GitHub(host / org / repos)와 Confluence(baseUrl / SPACE)를
      단일 model + type discriminator 로 둘지, 2 model 로 나눌지를 결정하고 근거를 붙인다. 채택안의
      필드 목록과 유일성 제약(`@@unique` 후보)을 표 1 개로 못 박는다. Prisma enum 격상 여부도 명시적으로
      결정한다(기존 enum-as-String 관례 정합 여부를 근거로).
- [ ] **§Decision 5 — API 표면 + RBAC**: method × path 목록(조회 · 추가 · 수정 · 삭제)을 표 1 개로 박제하고
      각 행의 성공 status 를 api.md `77 행` 이하 관례(POST 201 / DELETE 204)에 정합하게 명시. 권한은
      **조회 `User+` / 편집 `Admin+`** 로 REQ-073 과 일관되게 결정하고 적용 수단(`@Roles` + `RolesGuard`)을
      명시. 오류 계약 최소 3 종(중복 등록 → 409, 미존재 row → 404, 형식 검증 실패 → 400)을 표에 포함.
- [ ] **§Decision 6 — §5 새-dep · DB schema 게이트 판정**: 채택안이 새 외부 dependency 를 **0** 으로
      유지함을 명시하고, 신규 Prisma model 을 도입한다면 그것이 **기존 row 의 data migration 0 인 additive
      신규 table** 인지 판정해 1 구절로 박제한다. additive 가 아니거나 기존 model 변경이 필요하다는 결론이면
      그 사실과 함께 **CLAUDE.md §5 owner 게이트(humanQuestion) 경유 의무** 를 §Follow-ups 첫 항목으로 박제한다.
- [ ] **§Consequences** 에 부정적 귀결 2+ — 최소 (a) 대상 좌표를 DB 로 옮길 때 env 계약과의 이원화가
      남기는 혼동, (b) credential 을 env 에 남기면 화면에서 등록한 대상이 credential 부재로 수집 0 건이
      되는 조용한 실패 경로.
- [ ] **§Alternatives considered** 에 미채택 2+ 안을 근거와 함께 박제(§Decision 1 에서 내린 안 포함).
- [ ] **§Out of scope** 에 명시: `prisma/schema.prisma` 변경 0 · migration 0 · 수집 파이프라인
      ([collection-entry.service.ts](../../src/assessment-collection/collection-entry.service.ts)) 변경 0 ·
      web 패널 신설 0 · api.md · requirements.md 동기 0.
- [ ] **§Follow-ups** 에 후속 slice 를 순서와 함께 나열: (a) schema/migration slice(§5 게이트 판정 결과 병기),
      (b) repository + service, (c) DTO + controller + RBAC 배선, (d) e2e 로 오류 계약 고정,
      (e) AdminView 등록·편집 패널, (f) api.md · requirements.md doc-sync. 각 항목에 ≤300 LOC / ≤5 파일 +
      R-112 준수 의무를 1 구절씩 병기.
- [ ] **완료 선언 0** — 본 ADR 은 PLAN `130 행` 을 `[x]` 로 바꾸지 않고 REQ-070 / REQ-072 / REQ-073 의
      `PLANNED` status 도 바꾸지 않는다. 그 사실을 ADR 본문에 1 구절로 명시.
- [ ] **§12 범위 표기 규약 준수** — 행 범위는 물결 `~` 하나(`257~275 행`), 단일 행은 `77 행`,
      `L` prefix 금지. ADR 은 규약 적용 5 문서군에 속한다.
- [ ] `src/` · `web/` · `test/` · `prisma/` · `package.json` · `.github/workflows/` 변경 **0**
      (결정 전용). 신규 public symbol 신설 0 · 분기 0 이므로 **R-112 의 happy-path / error path /
      분기 cover / negative cases 4 항목은 본 doc-only ADR 에 미적용** — 그 사실을 task Result 에 명시한다.
- [ ] `tester` 가 **R-110 검증** 수행: `pnpm lint && pnpm build && pnpm test` 실행으로 회귀 0 확인
      (코드 변경 0 이어도 pr-mode 는 tester 호출 의무). 기존 coverage 게이트(line ≥ 80% / function ≥ 80%)가
      본 변경으로 흔들리지 않음을 함께 확인.

## Out of Scope

- **코드 1 LOC 도 쓰지 않는다** — `src/` · `web/` · `test/` · `prisma/` 어느 것도 건드리지 않는다.
- `prisma/schema.prisma` 에 model 을 추가하거나 migration 을 만드는 일(§Follow-ups (a) 소관, §5 게이트 대상).
- 기존 `resolveGithubInstances` / `resolveConfluenceInstances` 또는 수집 파이프라인 동작 변경.
- `docs/architecture/api.md` · `docs/architecture/data-model.md` · `docs/requirements.md` 동기
  (§Follow-ups (f) 소관 — 본 task 의 diff 는 ADR 1 파일뿐).
- PLAN `130 행` 마커 변경 · REQ-070 / REQ-072 / REQ-073 status 재판정.
- credential 실값 · PAT · token 을 문서에 적는 일(CLAUDE.md §9 절대 금지 — env 이름만 인용).

## Suggested Sub-agents

`architect → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append 한다.)

## 완료 기록

- **완료 시각**: 2026-08-30T14:57Z (PR [#1419](https://github.com/myungjoo/Assessment-Agent/pull/1419) squash merge `de0d2a51`)
- **결과 요약**: [ADR-0059](../decisions/ADR-0059-collection-target-registration.md) 를 신설해 (`1 파일 +299/-0`, 코드 0 LOC) 수집 대상 등록·편집의 6 개 결정 축을 박제했다 — (1) 저장 위치는 신규 Prisma model `CollectionTarget` 채택 (env-only 유지·별도 설정 파일 두 대안은 Alternatives 로 강등), (2) credential 경계는 token 실값·암호문의 DB·응답·요청 body 진입을 금지하고 DB 는 `instanceKey` 참조만 보유, (3) env 병합은 env 우선 union 이라 기존 수집 경로 동작 변화 0, (4) 대상 종류는 단일 model + type discriminator (Prisma enum 격상 비채택), (5) API 는 flat `/api/collection-targets` 5 route + 조회 `User+` · 편집 `Admin+`, (6) CLAUDE.md `§5` 게이트는 새 dependency 0 · additive 신규 table 로 판정했다. schema · migration · 수집 파이프라인 · web 패널 · api.md 동기는 전부 Out of Scope 로 남겨 Follow-ups (a)~(g) 에 이월했고, 완료 선언 (PLAN `130 행` 마커 · REQ-070/072/073 status) 은 하지 않았다. reviewer APPROVE round 1/7, 4-게이트 전부 pass, CI green (기본 검사 + 배포 산출물 검증), feature branch 삭제 완료.
