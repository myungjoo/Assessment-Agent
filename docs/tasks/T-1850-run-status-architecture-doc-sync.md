---
id: T-1850
title: api.md + frontend-api-contract.md 를 shipped 된 GET /api/run-status 와 동기
phase: P6
status: PENDING
commitMode: direct
coversReq: [REQ-083]
independentStream: run-status-doc-sync
dependsOn: [T-1846, T-1847, T-1849]
touchesFiles:
  - docs/architecture/api.md
  - docs/architecture/frontend-api-contract.md
estimatedDiff: 70
estimatedFiles: 2
created: 2026-09-02
plannerNote: P6 PLAN 133 행 ④ / ADR-0060 §Follow-ups (f) 앞 절반 — 머지된 run-status route 를 architecture doc 2 종에 동기 (REQ 재판정은 다음 slice)
---

# T-1850 — api.md + frontend-api-contract.md 를 shipped 된 `GET /api/run-status` 와 동기

## Why

[ADR-0060](../decisions/ADR-0060-evaluation-run-status-endpoint.md) `§Follow-ups` chain 의 (a) ~ (e) 가 모두 머지돼
`GET /api/run-status` 가 실제로 동작하고([T-1846](T-1846-run-status-query-route.md) route ·
[T-1847](T-1847-run-status-e2e-contract.md) e2e · [T-1848](T-1848-web-run-status-api-client.md) ·
[T-1849](T-1849-appshell-run-status-polling.md) web polling), [PLAN.md](../PLAN.md) `133 행` 오너 지시 ④
"R-78 평가 진행 배너 자동 polling (실행 상태 조회 endpoint 신설 포함)" 의 코드 축이 닫혔다. 그러나
architecture doc 2 종은 아직 **미존재** 라고 말한다 — 본 slice 는 `§Follow-ups (f)` 중 **architecture doc 동기
절반** 을 집행해 문서와 main 의 진실을 일치시킨다.

**planner pre-check (issue-still-relevant, origin/main `25c46f9f` 실측)** — ① `docs/architecture/api.md` 에
`run-status` 문자열 **0 hit** (§4 prefix 표 · §5 endpoint 표 어디에도 없음). ② `frontend-api-contract.md`
`87 행` 은 여전히 `| 전역 경고 배너 토글 | **평가/수집 실행 상태 조회 endpoint** | **gap (§5) — 미존재** |`
이고 `§5` 목록 `1번` 항목("평가/수집 실행 상태 조회 … P6 dashboard 의 hard dependency")도 그대로 존치.
③ `src/run-status/run-status.controller.ts` 에는 `@Controller("api/run-status")` + `@Get()` +
`@Roles("User")` 가 실재. → **중복 큐잉 아님**, 문서 쪽만 stale.

[CLAUDE.md](../../CLAUDE.md) `§3.1` 규칙 5 에 따라 본 변경은 **결정 내용이 아니라 shipped 사실의 반영**
(비-결정 doc 수정) 이라 `commitMode: direct` 다 — 선례는 [T-1827](T-1827-api-md-collection-target-routes-doc-sync.md)
(collection-targets 5 route api.md 동기, direct).

## Required Reading

- [docs/decisions/ADR-0060-evaluation-run-status-endpoint.md](../decisions/ADR-0060-evaluation-run-status-endpoint.md) — `§Decision 2` (응답 shape · 성공 status 계약 표) · `§Decision 3` (RBAC `User+`) · `§Decision 5` (polling 주기) · `§Follow-ups (f)`
- [src/run-status/run-status.controller.ts](../../src/run-status/run-status.controller.ts) — 실제 route · guard · 반환 타입 (문서에 적을 사실의 정본)
- [src/run-status/run-status.service.ts](../../src/run-status/run-status.service.ts) `33 행` 부근 — `RunStatusSnapshot` 필드 (`active` · 축별 `active`/`runningCount`/`startedAt` · `observedAt`)
- [docs/architecture/api.md](../architecture/api.md) `41~62 행` (§4 Resource model 표 + 그 서두) · `63~70 행` (§5 표 머리) · `165 행` (합계 문단)
- [docs/architecture/frontend-api-contract.md](../architecture/frontend-api-contract.md) `15~16 행` · `81~90 행` (§3.4) · `103~110 행` (§5 gap 목록) · `119 행`

## Acceptance Criteria

- [ ] `docs/architecture/api.md` `§4` prefix 표에 `/api/run-status` 행 1 개 추가 — 책임 module `RunStatusModule`, 책임 UC 는 실측대로 표기 (UC §5 sequence 호명 0 이면 `/api/collection-targets` 행과 같은 표기 방식), 비고에 R-78 배너 데이터 소스 + [ADR-0060](../decisions/ADR-0060-evaluation-run-status-endpoint.md) · T-1841/T-1846 근거를 한 줄로 박제.
- [ ] `§4` 서두의 "12 NestJS module … **신규 module 신설 0**" 서술이 새 행과 모순되지 않도록 **최소 한 문장** 으로 단서를 단다 — `RunStatusModule` 은 ADR-0060 이 신설한 module 이라 그 12 종 목록 밖이며 [modules.md](../architecture/modules.md) 전면 동기는 본 slice 밖(Follow-ups)임을 명시. 12 종 목록 자체를 다시 쓰지 않는다.
- [ ] `§5` endpoint 표에 `GET | /api/run-status | … | User+` 행 1 개 추가 — description 은 ≤ 1 줄 압축 규칙을 지키되 (a) 요청 표면 0 (query · body · path param 없음) (b) 항상 200 (비실행도 `active: false` 200) (c) 응답 필드 (`active` · `evaluation`/`collection` 축별 `active`·`runningCount`·`startedAt` · `observedAt`) (d) 미인증 401 · tier 미달 403 은 guard 소관 (e) 박제 task/PR 를 포함. 배치는 표 안의 적절한 group (신설 group 헤더 1 행 허용).
- [ ] `§5` 하단 **합계 문단**(`165 행`) 을 갱신 — endpoint 82 → 83 / shipped 77 → 78 / prefix 17 → 18 로 올리고, 늘어난 근거를 기존 문장 스타일대로 T-1850 조항으로 한 조각 덧붙인다 (기존 조항 삭제 0). prefix 증가 판정 근거(최상위 flat prefix 라 `/api/collection-targets` 선례와 동형)를 한 구절로 남긴다.
- [ ] `docs/architecture/frontend-api-contract.md` `87 행` 표 행의 `**gap (§5) — 미존재**` 를 **shipped** 로 갱신 — `GET /api/run-status`, tier `User+`, 소비처 (`web/src/api/runStatus.ts` helper + `web/src/AppShell.tsx` 5 초 polling → `EvaluationGuardBanner`) 를 적는다.
- [ ] 같은 파일 `§3.4` 서두의 "(a) 의 '실행 상태 조회' 가 **핵심 gap**" 서술을 shipped 서술로 교정.
- [ ] 같은 파일 `§5` 목록에서 `1번` 항목(실행 상태 조회)을 제거하고 나머지 4 항목을 `1~4` 로 재번호. 본문 안의 gap 참조(`119 행` "R-78 배너 (§3.4, gap 1 선행 필요)" 및 `15~16 행` 의 gap 서술)도 잔여 4 항목 기준으로 일관되게 교정 — 문서 안에 "gap 1 = 실행 상태 조회" 라는 표현이 **한 곳도 남지 않아야** 한다 (`grep -n "실행 상태 조회" docs/architecture/frontend-api-contract.md` 결과가 전부 shipped 문맥).
- [ ] 검증: `grep -n "run-status" docs/architecture/api.md` 가 §4 · §5 · 합계 3 지점에서 hit, `grep -n "gap (§5) — 미존재" docs/architecture/frontend-api-contract.md` 가 **0 hit**.
- [ ] 코드 변경 0 — `git diff --name-only` 결과가 위 `touchesFiles` 2 개뿐.
- [ ] [CLAUDE.md](../../CLAUDE.md) `§12` 언어 정책 준수 (본문 한국어 · path/식별자 영어) 및 `§12` 범위 표기 규약(`~` 하나 · `20 행` 형식 · `L` prefix 금지) 준수 — 본 2 파일은 규약 적용 범위(architecture 문서)다.

## Out of Scope

- **[requirements.md](../requirements.md) `102 행` REQ-083 status 재판정 0** — `§Follow-ups (f)` 의 나머지 절반이며 [CLAUDE.md](../../CLAUDE.md) `§3.1` 규칙 6 상 **별도 1 회** slice 다 (아래 Follow-ups).
- **[PLAN.md](../PLAN.md) `133 행` 마커 · ④ 조각 서술 변경 0** — 위 REQ 재판정 slice 와 함께 처리한다 (잔여 ① 전역 CSS 가 남아 `[ ]` 마커 자체는 유지).
- **[modules.md](../architecture/modules.md) 의 module 목록 동기 0** — 저장소 `src/` 에 15 개 `*.module.ts` 가 있는데 문서는 12 종을 말하는 **선행 drift** 이며 `RunStatusModule` 만의 문제가 아니다. 본 slice 는 api.md `§4` 서두에 단서만 달고, 전면 동기는 별도 slice.
- `src/` · `web/` · `test/` · `prisma/` · `package.json` · `.github/workflows/` 변경 0.
- ADR-0060 본문 수정 0 (결정 변경 아님 — 결정 수정은 `pr` 대상).
- 새 endpoint · 새 계약 신설 0 — 문서는 **이미 머지된 사실만** 반영한다.

## Suggested Sub-agents

`implementer` (doc-only 편집)

## Follow-ups

- (다음 slice 후보) `§Follow-ups (f)` 나머지 절반 — [requirements.md](../requirements.md) `102 행` REQ-083 status 를 (a) ~ (e) 실측(`src/run-status/*` · `test/e2e/run-status.e2e-spec.ts` · `web/src/api/runStatus.ts` · `web/src/AppShell.tsx`)에 맞춰 1 회 재판정 + [PLAN.md](../PLAN.md) `133 행` ④ 조각을 shipped 서술로 갱신 (② · ③ · ⑤ 조각과 동형, 선례 [T-1839](T-1839-requirements-req081-req082-session-rejudge.md)).
- [modules.md](../architecture/modules.md) module 목록 drift 동기 — 문서 12 종 vs `src/` 실측 15 종(`export` · `import` · `permission-denied-record` · `user-instance-access` · `run-status` 등). 의존성 그래프 · Components 매핑까지 동반이라 별도 slice 로 크기 산정 필요.
