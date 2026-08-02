---
id: T-1382
title: requirements.md 34 행 REQ-015 Confluence 지정 SPACE 평가 상태를 실측 기반 재판정
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-015]
estimatedDiff: 30
estimatedFiles: 2
created: 2026-08-02
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1382-requirements-confluence-space-scope-status-rejudge.md
plannerNote: "requirements-status-resync 28 번째 slice — T-1381 Follow-up 이 지목한 REQ-015 Confluence SPACE 지정·수집·평가 축, spaceAllowlist chain 전수 실측 가능, doc-only direct"
---

# T-1382 — requirements.md 34 행 REQ-015 Confluence 지정 SPACE 평가 상태를 실측 기반 재판정

## Why

[docs/requirements.md](../requirements.md) 34 행 REQ-015 (README 31 행 — "지정된 주소의 Confluence Service 내 지정된 SPACE들 내에서의 문서 작성 / 업데이트 활동") 는 아직 상태 컬럼이 `PLANNED` 이지만, main 에는 `src/confluence/confluence-instance-config.ts` · `confluence-space-traversal.service.ts` · `src/assessment-collection/confluence-collection.service.ts` 가 모두 박제돼 있어 표-코드 drift 가 남아 있다. 직전 slice T-1381 이 REQ-016 (Confluence 권한 부족 인식) 을 `DONE` 으로 재판정하며 Follow-ups 에 "traversal 실측 중 `config.spaceAllowlist` 순회 + `confluence-instance-config.ts` 의 env 기반 SPACE 지정 경로가 실재함을 확인 — REQ-015 재판정 slice 에서 동일 방식 실측 가능" 을 남겼다. `requirements-status-resync` stream 의 28 번째 slice 로 지정 축 · 수집 축 · 평가 배선 축을 각각 직접 실측해 표를 코드베이스에 되돌린다.

## Required Reading

- `docs/requirements.md` — 34 행 (REQ-015) 및 표 헤더 (18~19 행) 의 컬럼 순서, 상태 enum (9 행). 인접 REQ-014 (33 행, 이미 `DONE`) · REQ-016 (35 행, 이미 `DONE`) 은 필드 수 비교 및 서술 포맷 참고용으로만 쓴다.
- `docs/tasks/T-1381-requirements-confluence-permission-denied-status-rejudge.md` — 직전 slice 의 상태 문자열 서술 포맷 (`DONE (implemented-on-main — <근거>)` / `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)` + `한계 —` 부기) 과 완료 기록 포맷을 그대로 따른다. **단 그 안의 실측값 (심볼명 · 행 번호 · it 개수) 을 본 task 근거로 복사하지 않는다** — 그것은 권한 부족 축 (REQ-016) 의 근거이지 SPACE 지정·평가 축 (REQ-015) 의 근거가 아니다. 본 task 는 처음부터 직접 실측한다.
- `README.md` 31 행 — REQ-015 원문. 축 분해 = (a) **지정 축**: "지정된 주소" (Confluence instance base URL) 와 "지정된 SPACE들" (복수 SPACE 목록) 이 설정으로 주입되는 경로, (b) **수집 축**: 지정 SPACE 안에서 **문서 작성 / 업데이트 활동** 을 실제로 수집하는 경로, (c) **평가 배선 축**: 수집된 Confluence 활동이 평가 입력까지 이어지는지.
- `src/confluence/confluence-instance-config.ts` — 지정 축 1. base URL 과 SPACE 목록을 담는 타입 · 그 값을 구성하는 심볼 (env 이름 · 파싱 함수) 을 행 인용으로 확정한다. 추측한 env 변수명 · 필드명을 적지 않는다. SPACE 목록이 단수인지 복수 배열인지 (README 31 행이 요구하는 "SPACE들") 를 그대로 적는다.
- `src/assessment-collection/collection-spec.service.ts` — 지정 축 2. 수집 spec 이 어떤 Confluence 지정값 (instance / SPACE 목록) 을 조립해 내려보내는지, 그 값의 출처가 env 인지 DB 인지 요청 파라미터인지를 행 인용으로 확정한다.
- `src/confluence/confluence-space-traversal.service.ts` — 수집 축 1. `spaceAllowlist` 순회 지점과 SPACE 별로 어떤 API path 를 호출해 어떤 문서 목록을 얻는지를 행 인용으로 확정한다. **allowlist 밖 SPACE 가 제외되는 근거 (순회 대상이 allowlist 자체인지, 전체 조회 후 필터인지) 를 한 줄로 확정한다.**
- `src/assessment-collection/confluence-collection.service.ts` — 수집 축 2. traversal 결과가 어떤 활동 단위 (문서 작성 / 업데이트) 로 매핑되는지, **작성과 업데이트를 구분하는 필드 (예: version · createdAt 대 updatedAt 계열) 가 실재하는지** 를 행 인용으로 확정한다. 구분 근거가 없으면 그 사실을 그대로 적고 충족으로 판정하지 않는다.
- `src/assessment-collection/collection-orchestrator.service.ts` — 수집 배선 축. Confluence 수집이 orchestration 경로에서 실제 호출되는 지점을 1 개 이상 행 인용한다 (caller 0 이면 배선 미충족으로 적는다).
- `src/assessment-evaluation/domain/evaluation-input.mapper.ts` · `evaluation-input.ts` — 평가 배선 축. 수집된 Confluence 활동이 평가 입력 타입으로 변환되는 지점 (source / provider 판별 리터럴 포함) 을 행 인용으로 확정한다. GitHub 전용 분기만 있고 Confluence 경로가 없으면 미충족으로 적는다.
- 검증 위치 실 근거용 — 표의 검증 위치 컬럼이 `unit + e2e` 이므로 두 축을 각각 실측한다. unit 은 `src/confluence/confluence-instance-config.spec.ts` · `src/confluence/confluence-space-traversal.service.spec.ts` · `src/assessment-collection/confluence-collection.service.spec.ts` · `src/assessment-collection/collection-spec.service.spec.ts` 의 파일별 `it(` 개수를 직접 실측한다. e2e 는 `test/e2e/assessment-collection-trigger.e2e-spec.ts` 에서 Confluence / SPACE 축을 cover 하는 it 이 실재하는지 `grep -n "onfluence\|space" test/e2e/assessment-collection-trigger.e2e-spec.ts` 로 확인하고 개수 · 행을 인용한다.

## Acceptance Criteria

- [x] **지정 축 (README 31 행 "지정된 주소 … 지정된 SPACE들")** 을 실측한다 — Confluence instance base URL 과 SPACE 목록의 타입 · 구성 심볼 · 값 출처 (env / DB / 요청) 를 파일 · 행 인용으로 확정하고, SPACE 목록이 **복수** 를 지원하는지 (배열 여부) 를 한 줄로 적는다.
- [x] **수집 축** 을 실측한다 — allowlist 순회 지점과 SPACE 별 호출 path 를 행 인용으로 확정하고, allowlist 밖 SPACE 제외 근거 (순회 대상이 allowlist 자체인지 사후 필터인지) 를 한 줄로 확정한다.
- [x] **문서 작성 / 업데이트 구분** 을 별도로 판정한다 — 작성과 업데이트를 구분하는 필드 · 분기가 실재하는지를 행 인용으로 확정한다. 구분이 없으면 "구분 없음 (활동 단위 통합 수집)" 을 그대로 적고 근거 없는 서술을 덧붙이지 않는다.
- [x] **평가 배선 축** 을 판정한다 — 수집된 Confluence 활동 → 평가 입력 변환 지점을 파일 · 행으로 인용하고, orchestration 경로에서 Confluence 수집이 실제 호출되는 지점을 1 개 이상 인용한다. 호출 참조가 0 이면 배선 축을 충족으로 판정하지 않는다.
- [x] **검증 위치 컬럼 (`unit + e2e`) 의 실 근거** 를 확인한다 — 위 4 unit spec 의 `it(` 개수를 각각 실측해 경로와 개수를 상태 문자열에 인용하고, e2e 축의 Confluence / SPACE cover 실재 여부 (해당 it 개수 · 행) 를 함께 인용한다. 컬럼 값과 실재가 어긋나면 (예: e2e cover 0) 그 사실을 "한계 —" 로만 부기한다 (컬럼 값은 수정하지 않는다).
- [x] REQ-015 (34 행) 의 상태 컬럼을 실측 결과에 따라 `PLANNED` → `DONE (implemented-on-main — <근거>)`, 일부 축만 충족 시 `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)`, 근거 부족 시 `PLANNED` 유지 + 유지 사유 부기 중 하나로 갱신한다. 근거에는 실재하는 소스 파일 경로 2 개 이상 + spec 파일 경로 1 개 이상이 포함돼야 한다.
- [x] 실측으로 확인되지 않은 부분 (예: 작성/업데이트 구분 부재 · SPACE 지정의 DB 설정 경로 공백 · e2e cover 공백) 은 상태 문자열 안에 "한계 —" 로 1~2 절 부기한다.
- [x] `grep -n "REQ-015" docs/requirements.md` 결과에서 해당 행의 상태 컬럼이 갱신됐고, 표의 컬럼 수 (`|` 필드 수) 가 인접 행 (REQ-014 · REQ-016) 과 동일하게 유지됨을 확인한다. 상태 문자열 안에 리터럴 `|` 문자를 넣지 않는다 (T-1370 · T-1375 에서 grep 패턴의 `\|` 로 필드 수가 부풀었던 사고 재발 방지). `wc -l docs/requirements.md` = 97 과 `grep -c "^| REQ-" docs/requirements.md` = 66 이 편집 전후 불변임도 확인한다.
- [x] 본 task 파일의 `status` 를 `DONE` 으로 바꾸고 완료 시각 · 결과 요약 (실측값 포함) 을 추가한다.

## Out of Scope

- **REQ-016 (35 행, Confluence 권한 부족 인식·통지) 재서술** — 직전 slice T-1381 이 이미 `DONE` 으로 재판정했다. 권한 부족 축이 눈에 띄어도 본 task 의 상태 문자열에 섞지 않는다.
- **REQ-017 (36 행, crawling vs hierarchy 탐색 정책 ADR) 재판정** — 탐색 방식 자체의 정책 판정은 별도 slice 이며 ADR 필수 row 다. 본 task 는 탐색 방식을 판정 대상으로 삼지 않고, allowlist 순회 사실만 실측한다.
- **T-1381 Follow-ups (traversal emitter production no-op · 404 미기록 · push 통지 부재 · 검증 위치 drift) 의 구현 또는 재서술.**
- 상태 컬럼 외 다른 컬럼 (README 행 번호 · 요약 · kind · 구현 위치 · 검증 위치) 수정 — 검증 위치 재판정은 별도 slice 다. 근거 부재를 발견해도 컬럼 값은 건드리지 않고 상태 문자열의 "한계 —" 로만 부기한다.
- 수집 · 평가 배선의 공백을 발견해도 **고치지 않는다** — 본 task 는 실측·기록만 한다. 발견 사항은 Follow-ups 에만 적는다.
- `src/` · `web/` · `test/` · `prisma/` 등 코드 · schema · **코드 주석** 변경 일체 (본 task 는 `commitMode: direct` doc-only).
- REQ-001 (20 행) · REQ-047 · REQ-048 · REQ-050 · REQ-056 등 다른 `PLANNED` row 재판정 — 각각 별도 slice.
- 새 ADR 작성 또는 기존 ADR status 변경.

## Suggested Sub-agents

`implementer` (doc-only 실측 + 표 갱신). 코드 변경이 0 이므로 tester 는 생략한다 (CLAUDE.md §3.2 R-110 의 direct-mode doc-only 면제).

## 완료 기록

- 완료: 2026-08-02
- 결과: `docs/requirements.md` 34 행 REQ-015 상태를 `PLANNED` → `DONE (implemented-on-main — …)` 으로 재판정. 지정 축 · 수집 축 · 평가 배선 축 3 개 모두 실측으로 실재 확인.
- 지정 축 실측: `src/confluence/confluence-instance-config.ts` 94~96 행 `resolveConfluenceInstances(env)` (순수 함수) 가 29 행 `CONFLUENCE_INSTANCES` key list 와 34~37 행 suffix (`_BASE_URL` · `_AUTH_USER` · `_TOKEN_ENC` · `_SPACE_ALLOWLIST`) 를 80~82 행 `confluenceEnvName` 로 조립해 읽는다. 지정 주소 = 46 행 `baseUrl: string` (필수, 138~148 행 부재 시 reject), 지정 SPACE 목록 = 57 행 `spaceAllowlist: string[]` — **복수 지원 (배열)**, 156~161 행 comma split + trim. 값 출처는 env 전용 (`collection-spec.service.ts` 51 행 `resolveConfluenceInstances(this.env)` · 32 행 `@Optional() env = process.env`; DB · 요청 파라미터 경로 0).
- 수집 축 실측: `confluence-space-traversal.service.ts` 115 행 `for (const spaceKey of config.spaceAllowlist)` — 순회 대상이 **allowlist 자체** (사후 필터 아님). SPACE 별 호출은 119~125 행 `/content` (65 행) + `spaceKey` query (68 행) → 129 행 `requestAllPages`. 활동 매핑은 `confluence-collection.service.ts` 70 행 traversal 호출 → 74~79 행 `mapConfluenceActivity` → 90 행 page-id + version latest-wins dedup.
- 작성/업데이트 구분: **구분 없음 (활동 단위 통합 수집)**. `activity.ts` 74~80 행 `ConfluenceActivity` 에 활동 종류 필드 부재 (GitHub 은 36 행 `GithubActivityKind` 보유), `confluence-activity.mapper.ts` 는 89 행 `version.when` (마지막 수정 시각) · 71 행 `version.by` (마지막 수정자) 만 읽고 createdAt / createdBy 추출 0 · version history 전개 0.
- 평가 배선 축 실측: `collection-orchestrator.service.ts` 67 행 `collectActivities` 안 71~72 행에서 `collectConfluenceActivities` 호출 · 77 행 concat. orchestrator caller 는 `collection-entry.service.ts` 52~53 행 · `collection-persistence.service.ts` 62 행 (호출 참조 ≥ 1). 평가 입력 변환은 `evaluation-input.mapper.ts` 60~63 행 — Confluence 는 항상 `contributionKind: "document"`, 68 행에서 `sourceType` 보존.
- 검증 실측: unit 4 spec 58 it (`confluence-instance-config.spec.ts` 25 · `confluence-space-traversal.service.spec.ts` 14 · `confluence-collection.service.spec.ts` 11 · `collection-spec.service.spec.ts` 8, `it.each` 0). e2e 는 `test/e2e/assessment-collection-trigger.e2e-spec.ts` 8 it 중 SPACE 축 cover 0 (Confluence 언급은 14 행 주석 1 줄뿐, `test/e2e/` 전체 `spaceKey` · `spaceRef` · `SPACE_ALLOWLIST` grep 0) — 컬럼 값은 수정하지 않고 "한계 —" 로만 부기.
- 표 불변 확인: `wc -l docs/requirements.md` = 97, `grep -c "^| REQ-" docs/requirements.md` = 66, REQ-014 · REQ-015 · REQ-016 필드 수 9 동일, 상태 문자열 안 리터럴 `|` 0.

## Follow-ups

- Confluence 활동의 작성 / 업데이트 구분 축 도입 검토 — 현재 page 1 건당 최신 version 1 활동만 수집돼 README 31 행의 두 활동이 합쳐진다. version history 순회 또는 `version === 1` 판정으로 활동 종류를 부여할지 ADR 판단 필요 (수집 mapper · 도메인 타입 변경 동반이라 별도 pr-mode task).
- `spaceRef` · `version` 이 평가 입력까지 전사되지 않는 공백 — `evaluation-input.mapper.ts` 65~75 행이 두 필드를 옮기지 않고 `buildMetadata` (`confluence-activity.mapper.ts` 95~102 행) 는 `titleLength` 만 담아, `evaluation-update-count-neutral.ts` 171~174 행 `resolveUpdateCount` 의 `input.metadata.version` 이 production 에서 항상 0 fallback 이다 (R-41 update 횟수 중립화 신호 미식별). 별도 slice 로 실배선 여부 판단.
- REQ-015 검증 위치 컬럼 (`unit + e2e`) 의 e2e cover 0 drift — 검증 위치 재판정 slice 또는 e2e 보강 task 에서 다룬다.
- SPACE 지정이 env 전용이라 Person / 평가 대상별 SPACE scope 지정 경로가 없다 (ADR-0030 §3 의도된 경계인지 공백인지 확인 필요).
