---
id: T-1383
title: requirements.md 36 행 REQ-017 Confluence SPACE 탐색 정책(ADR) 상태를 실측 기반 재판정
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-017]
estimatedDiff: 30
estimatedFiles: 2
created: 2026-08-02
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1383-requirements-confluence-traversal-policy-adr-status-rejudge.md
plannerNote: "requirements-status-resync 29 번째 slice — T-1382 가 Out of Scope 로 미룬 인접 REQ-017 (ADR 필수 row), ADR-0013 실재·구현 정합 전수 실측 가능, doc-only direct"
---

# T-1383 — requirements.md 36 행 REQ-017 Confluence SPACE 탐색 정책(ADR) 상태를 실측 기반 재판정

## Why

[docs/requirements.md](../requirements.md) 36 행 REQ-017 (README 34 행 — "지정된 SPACE 내 Crawling을 해야 할 수 있다. 단, 지정된 SPACE 내 페이지 List나 Hierarchy (directory) 구조를 기반으로 탐색하여도 된다") 는 kind = `Constraint`, 구현 위치 = `P4 (ADR 필수)`, 검증 위치 = `policy` 인 **ADR 필수 row** 인데 상태 컬럼이 아직 `PLANNED` 다. 그러나 main 에는 `docs/decisions/ADR-0013-confluence-space-traversal-policy.md` 가 이미 존재하고 그 Context 절이 REQ-017 을 명시 트리거로 인용하고 있어, 표-저장소 drift 가 남아 있다. 직전 slice T-1382 (REQ-015 재판정) 는 Out of Scope 에 "REQ-017 (36 행, crawling vs hierarchy 탐색 정책 ADR) 재판정 — 탐색 방식 자체의 정책 판정은 별도 slice 이며 ADR 필수 row 다" 를 명시해 본 slice 를 남겨뒀다. `requirements-status-resync` stream 의 29 번째 slice 로 **ADR 실재 축 · 결정 내용 축 · 구현 정합 축** 을 각각 직접 실측해 표를 저장소 사실에 되돌린다.

## Required Reading

- `docs/requirements.md` — 36 행 (REQ-017) 및 표 헤더 (18~19 행) 의 컬럼 순서, 상태 enum (9 행). 인접 REQ-016 (35 행, 이미 `DONE`) · REQ-018 (37 행, 이미 `DONE`) 은 필드 수 비교 및 서술 포맷 참고용으로만 쓴다.
- `docs/tasks/T-1382-requirements-confluence-space-scope-status-rejudge.md` — 직전 slice 의 상태 문자열 서술 포맷 (`DONE (implemented-on-main — <근거>)` / `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)` + `한계 —` 부기) 과 완료 기록 포맷을 그대로 따른다. **단 그 안의 실측값 (심볼명 · 행 번호 · it 개수) 을 본 task 근거로 복사하지 않는다** — 그것은 SPACE 지정·수집 축 (REQ-015) 의 근거이지 탐색 **정책 결정** 축 (REQ-017) 의 근거가 아니다. 본 task 는 처음부터 직접 실측한다.
- `README.md` 34 행 — REQ-017 원문. 축 분해 = (a) **ADR 실재 축**: 탐색 정책을 결정하는 ADR 문서가 실재하고 status 가 무엇인지, (b) **결정 내용 축**: README 가 허용한 셋 (crawling / page List / Hierarchy) 중 **어느 것을 구현 default 로 택했는지** 가 ADR 안에 명시 선택으로 박제됐는지, (c) **구현 정합 축**: 실제 traversal 코드가 그 결정과 일치하는지.
- `docs/decisions/ADR-0013-confluence-space-traversal-policy.md` — ADR 실재 축 + 결정 내용 축. frontmatter 의 `id` · `status` · `date` · `relatedTask` 를 행 인용으로 확정하고, Decision 절에서 **택 1 된 탐색 메커니즘 문장** 을 행 번호와 함께 인용한다. 추측한 결정 요약을 적지 않는다. status 가 `ACCEPTED` 가 아니면 (예: `PROPOSED`) 그 값을 그대로 적고 ADR 축을 충족으로 판정하지 않는다.
- `src/confluence/confluence-space-traversal.service.ts` — 구현 정합 축 1. 실제 호출하는 API path 와 query 구성 지점 · 페이지네이션 순회 지점을 행 인용으로 확정하고, 그것이 ADR 결정 (crawling / list / hierarchy 중 택 1) 과 **일치하는지 어긋나는지** 를 한 줄로 확정한다. 코드 안에 `ADR-0013` 참조 주석이 있으면 그 행도 인용한다.
- `src/confluence/confluence-instance-config.ts` · `src/assessment-collection/domain/page-dedup.ts` — 구현 정합 축 2. `grep -rn "ADR-0013" src` 로 확인되는 소스측 ADR 역참조 지점을 파일 · 행으로 인용한다 (역참조가 정책 준수의 직접 증거는 아니므로, 인용만 하고 과대 해석하지 않는다).
- `docs/architecture/modules.md` — 문서측 정합 축. ConfluenceModule row 가 "crawling vs hierarchy 정책은 P4 ADR" 를 어떻게 서술하는지 (ADR 결정 반영 여부) 를 행 인용으로 확인한다. 서술이 아직 "미결정" 톤이면 그 사실을 "한계 —" 로만 부기한다 (본 task 는 modules.md 를 수정하지 않는다).
- 검증 위치 실 근거용 — 표의 검증 위치 컬럼이 `policy` 이므로 test 개수를 근거로 삼지 않는다. 대신 (i) ADR 문서 자체의 실재 · status, (ii) 소스측 ADR 역참조 개수 (`grep -rn "ADR-0013" src` 결과 파일 수 · 행), (iii) 정책 drift 를 잡는 spec 이 실재하는지 (`grep -rln "ADR-0013" test src --include=*spec.ts`) 를 각각 실측해 인용한다. drift-guard spec 이 0 이면 그 사실을 그대로 적는다.

## Acceptance Criteria

- [x] **ADR 실재 축** 을 실측한다 — `docs/decisions/ADR-0013-confluence-space-traversal-policy.md` 의 frontmatter `id` · `status` · `date` · `relatedTask` 값을 행 인용으로 확정하고, status 값을 상태 문자열에 그대로 적는다 (해석 · 승격 금지).
- [x] **결정 내용 축** 을 실측한다 — README 34 행이 허용한 셋 (crawling / page List / Hierarchy) 중 ADR 이 **명시 선택한 구현 default 1 개** 를 Decision 절 행 인용으로 확정한다. 셋 중 택 1 이 명시돼 있지 않으면 "택 1 명시 없음" 을 그대로 적고 본 축을 충족으로 판정하지 않는다.
- [x] **구현 정합 축** 을 실측한다 — `src/confluence/confluence-space-traversal.service.ts` 의 실 호출 path · query · 순회 지점을 행 인용하고, ADR 결정과 일치 / 불일치를 한 줄로 확정한다. 불일치면 "한계 —" 가 아니라 **상태 판정 자체를 `IN_PROGRESS`** 로 낮춘다.
- [x] **소스측 ADR 역참조** 를 실측한다 — `grep -rn "ADR-0013" src` 결과의 파일 수와 대표 파일 · 행 2 개 이상을 인용한다. 역참조 0 이면 그 사실을 그대로 적는다.
- [x] **검증 위치 컬럼 (`policy`) 의 실 근거** 를 확인한다 — 본 row 는 test 가 아니라 정책 문서가 검증 매체이므로, ADR 실재 + 소스 역참조를 근거로 인용하고, 추가로 정책 drift-guard spec 실재 여부 (`grep -rln "ADR-0013" test src --include=*spec.ts` 결과 개수) 를 실측해 함께 적는다. drift-guard spec 0 이면 컬럼 값은 수정하지 않고 "한계 —" 로만 부기한다.
- [x] REQ-017 (36 행) 의 상태 컬럼을 실측 결과에 따라 `PLANNED` → `DONE (implemented-on-main — <근거>)`, 일부 축만 충족 시 `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)`, 근거 부족 시 `PLANNED` 유지 + 유지 사유 부기 중 하나로 갱신한다. 근거에는 ADR 문서 경로 1 개 + 실재하는 소스 파일 경로 2 개 이상이 포함돼야 한다.
- [x] 실측으로 확인되지 않은 부분 (예: drift-guard spec 부재 · modules.md 서술이 미결정 톤 유지 · hierarchy 미구현 경로) 은 상태 문자열 안에 "한계 —" 로 1~2 절 부기한다.
- [x] `grep -n "REQ-017" docs/requirements.md` 결과에서 해당 행의 상태 컬럼이 갱신됐고, 표의 컬럼 수 (`|` 필드 수) 가 인접 행 (REQ-016 · REQ-018) 과 동일하게 유지됨을 확인한다. 상태 문자열 안에 리터럴 `|` 문자를 넣지 않는다 (T-1370 · T-1375 에서 grep 패턴의 `\|` 로 필드 수가 부풀었던 사고 재발 방지). `wc -l docs/requirements.md` = 97 과 `grep -c "^| REQ-" docs/requirements.md` = 66 이 편집 전후 불변임도 확인한다.
- [x] 본 task 파일의 `status` 를 `DONE` 으로 바꾸고 완료 시각 · 결과 요약 (실측값 포함) 을 추가한다.

## Out of Scope

- **ADR-0013 본문 수정 또는 status 변경** — 본 task 는 ADR 을 읽고 인용만 한다. status 가 `PROPOSED` 라도 승격하지 않는다 (승격은 별도 direct task 이며 판단 근거가 따로 필요하다).
- **`docs/architecture/modules.md` · `p4-implementation-plan.md` · `INDEX.md` 수정** — 문서측 서술 drift 를 발견해도 인용 · 부기만 하고 고치지 않는다.
- **REQ-015 (34 행) · REQ-016 (35 행) 재서술** — 직전 slice T-1382 · T-1381 이 이미 재판정했다. Confluence 축이 겹쳐 보여도 본 task 의 상태 문자열에 섞지 않는다.
- **T-1382 Follow-ups (작성/업데이트 구분 부재 · `spaceRef`/`version` 미전사 · e2e cover 0 · SPACE scope env 전용) 의 구현 또는 재서술.**
- 상태 컬럼 외 다른 컬럼 (README 행 번호 · 요약 · kind · 구현 위치 · 검증 위치) 수정 — 검증 위치 재판정은 별도 slice 다. 근거 부재를 발견해도 컬럼 값은 건드리지 않고 상태 문자열의 "한계 —" 로만 부기한다.
- 탐색 정책의 공백 (예: hierarchy 경로 미구현 · drift-guard spec 부재) 을 발견해도 **고치지 않는다** — 본 task 는 실측·기록만 한다. 발견 사항은 Follow-ups 에만 적는다.
- `src/` · `web/` · `test/` · `prisma/` 등 코드 · schema · **코드 주석** 변경 일체 (본 task 는 `commitMode: direct` doc-only).
- REQ-001 (20 행) · REQ-047 · REQ-048 · REQ-050 · REQ-056 등 다른 `PLANNED` row 재판정 — 각각 별도 slice.
- 새 ADR 작성.

## Suggested Sub-agents

`implementer` (doc-only 실측 + 표 갱신). 코드 변경이 0 이므로 tester 는 생략한다 (CLAUDE.md §3.2 R-110 의 direct-mode doc-only 면제).

## Follow-ups

- **ADR-0013 정책 drift-guard spec 부재** — `grep -rln "ADR-0013" test src --include=*spec.ts` = 0. 탐색 메커니즘이 List 기반에서 이탈해도 (예: 재귀 crawling 도입 · allowlist 우회 전수 발견) CI 가 자동으로 잡지 못한다. `src/confluence/confluence-space-traversal.service.spec.ts` 에 "content path 는 `/content` + spaceKey query 이며 allowlist 밖 SPACE 를 호출하지 않는다" 를 assert 하는 정책 guard it 을 추가하는 별도 pr-mode task 후보.
- **List API content type 필터 미구현** — ADR-0013 Consequences 음의 1 이 지목한 blog / attachment / draft 누락 위험. 현재 요청 query 는 `{ spaceKey }` 뿐이라 type 범위가 서버 default 에 맡겨져 있다 (REQ-015 "문서 작성 / 업데이트" 대상 type 범위 확정 필요).
- **Hierarchy 보강 (ancestors 메타) 미구현** — ADR-0013 Consequences 5 가 남긴 확장 여지. `grep -rn "ancestors" src` = 0 으로 계층 context 를 평가 메타로 전사하는 경로가 아직 없다.

## 완료 기록

- **완료 시각**: 2026-08-02 (UTC)
- **결과 요약**: `docs/requirements.md` 36 행 REQ-017 상태를 `PLANNED` → `DONE (implemented-on-main — ...)` 로 재판정. 실측 3 축 모두 충족 — (a) ADR 실재 축: `docs/decisions/ADR-0013-confluence-space-traversal-policy.md` frontmatter 2 행 `id: ADR-0013` · 4 행 `status: ACCEPTED` · 5 행 `date: 2026-06-01` · 6 행 `relatedTask: T-0145` (status 원문 그대로 인용, 승격 0). (b) 결정 내용 축: 47 행 Decision §1 제목 + 49 행 본문이 **page List 기반 (SPACE content list API 순회)** 1 개를 default 로 명시 선택했고 50 행 (full crawling) · 51 행 (Hierarchy tree) 이 각각 미채택 사유와 함께 기각 — 98~104 행 Alternatives 표가 (1) 채택 / (2)(3) 기각으로 재박제. (c) 구현 정합 축: `src/confluence/confluence-space-traversal.service.ts` 65 행 `CONFLUENCE_CONTENT_PATH = "/content"` · 68 행 `SPACE_KEY_QUERY_PARAM = "spaceKey"` · 119~125 행 request 조립 · 129 행 `requestAllPages` 위임 (→ `src/confluence/confluence-adapter.service.ts` 353 행, 17~20 행 주석의 `_links.next` cursor 순회 계약) · 115 행 `for (const spaceKey of config.spaceAllowlist)` · 131~161 행 skip-and-continue (148~156 행 emit, 161 행 continue) 로 ADR 결정과 **일치**, crawling/hierarchy 순회 경로 부재.
- **소스측 역참조 실측**: `grep -rn "ADR-0013" src` = **3 파일 12 행** — `confluence-space-traversal.service.ts` (3 · 11 · 61 · 67 · 72 · 108 · 141 행), `confluence-instance-config.ts` (16 · 25 · 54 행), `assessment-collection/domain/page-dedup.ts` (19 행).
- **검증 위치 (`policy`) 근거**: ADR 문서 실재 (ACCEPTED) + 위 12 행 역참조 + `docs/architecture/modules.md` 36 행 ConfluenceModule row 의 ADR 컬럼 `ADR-0013 (SPACE 탐색 정책)` 실링크 (미결정 톤 해소 확인). 정책 drift-guard spec = **0** 이라 검증 위치 컬럼은 미수정하고 "한계 —" 로만 부기.
- **표 불변 확인**: `wc -l docs/requirements.md` = 97, `grep -c "^| REQ-" docs/requirements.md` = 66, 34~37 행 `|` 필드 수 = 9 로 인접 REQ-016 · REQ-018 과 동일. 상태 문자열 안 리터럴 `|` 0.
- **변경 파일**: `docs/requirements.md` (36 행 1 줄), 본 task 파일 (status + 체크박스 + 완료 기록 + Follow-ups). 코드 변경 0 LOC.
