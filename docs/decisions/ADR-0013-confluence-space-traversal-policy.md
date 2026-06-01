---
id: ADR-0013
title: Confluence SPACE 탐색 정책 — 탐색 메커니즘 / 다중 SPACE·page 수집 경계 / 권한 부족 4xx 탐색-제어 박제
status: ACCEPTED
date: 2026-06-01
relatedTask: T-0145
supersedes: null
---

# ADR-0013 — Confluence SPACE 탐색 정책 박제

## Context

본 ADR 은 [docs/PLAN.md L84](../PLAN.md) Phase P4 의 **"Confluence SPACE 탐색 정책 (R-34) — Crawling 또는 page List/Hierarchy 기반 탐색 중 택. ADR 로 결정."** 의무를 박제한다 — 동 bullet 이 명시한 "ADR 로 결정" 이 본 ADR 의 single source of truth 트리거. [docs/requirements.md](../requirements.md) 의 **REQ-017** (Confluence SPACE crawling vs hierarchy 탐색 정책, kind = Constraint, phase = "P4 (ADR 필수)", status = PLANNED) 도 동일 결정을 명시 요구한다. [README.md L34](../../README.md) 가 결정 대상을 verbatim 박제한다: *"지정된 SPACE 내 Crawling을 해야 할 수 있다. 단, 지정된 SPACE 내 페이지 List나 Hierarchy (directory) 구조를 기반으로 탐색하여도 된다."* — README 가 셋 (crawling / page List / Hierarchy) 을 모두 **허용** 하므로, 본 ADR 이 그중 구현 default 1 개를 명시 선택하는 것이 본 결정의 본질이다.

[docs/architecture/p4-implementation-plan.md §3 ADR 후보 (a)](../architecture/p4-implementation-plan.md) 와 §2 표의 ConfluenceModule row 가 ConfluenceAdapter 탐색 구현 진입 직전 본 ADR 신설을 트리거로 박제한다. [CLAUDE.md §1](../../CLAUDE.md) ("코드보다 ADR이 먼저다") + [§3.1 rule 3](../../CLAUDE.md) (ADR + 코드 혼합 task 는 split) 에 따라, **ConfluenceAdapter 의 실 page 수집 코드 task (HITL 게이트 동반) 의 선행 결정 ADR** 을 본 ADR 이 단독 박제하여 후속 adapter 코드가 일관된 탐색 contract 위에서 구현되게 한다. 본 ADR 은 **순수 결정 문서** 다 — 외부 dependency 추가 / 외부 자격증명 처리 / DB schema 변경 / auth-flow 변경을 하지 않는다 (Out of scope 는 [§HITL 경계](#hitl-경계-본-adr-과-후속-task) 와 References 박제).

### 결정 대상 3 축

[README.md L31–34](../../README.md) + [docs/requirements.md REQ-015/016/017](../requirements.md) + [docs/architecture/modules.md ConfluenceModule row](../architecture/modules.md) ("SPACE list / page list / page version 조회 adapter. crawling vs hierarchy 정책은 P4 ADR. 4xx catch → PermissionDeniedEvent emit.") 가 ConfluenceModule 의 책임을 conceptual 박제하되 탐색 메커니즘 / 수집 경계 / 4xx 처리 위상의 구체 결정은 본 ADR 로 미룬다. 본 ADR 이 그 3 축을 확정:

- **축 (1) 탐색 메커니즘 택일** — (a) full crawling (link 따라가며 재귀 수집) vs (b) page List 기반 (SPACE 의 content list API 순회) vs (c) page Hierarchy / directory 기반 (parent-child tree 순회) 중 하나를 구현 default 로 확정.
- **축 (2) 지정 SPACE 다중 관리 + page 단위 수집 경계** — 지정된 SPACE 들 (다중) 을 어떻게 enumerate 하는지 + page 단위 (page + version) 수집의 단위 경계. raw 미저장 invariant 와의 정합.
- **축 (3) 권한 부족 (4xx) 처리 위상** — 지정 SPACE 일부 접근 권한 부재 시 4xx 가 탐색을 abort 하는지 / skip 하고 계속하는지의 탐색-제어 정책.

### REQ 외력 (본 ADR 이 cover)

- **REQ-015** ([docs/requirements.md](../requirements.md), README L31) — 지정된 주소의 Confluence Service 내 지정된 SPACE 들 내 문서 작성 / 업데이트 활동 평가. 본 ADR 의 축 (1)·(2) 가 그 "지정 SPACE 들 내 page 수집" 의 탐색 메커니즘·수집 경계를 박제.
- **REQ-016** ([docs/requirements.md](../requirements.md), README L33) — 접근 권한 (read) 부족 시 AA 사용자·관리자가 인식·대응. 본 ADR 의 축 (3) 이 그 4xx 의 탐색-제어 위상 (탐색 abort 여부) 을 박제 (PermissionDeniedEvent emit 자체 책임은 modules.md ConfluenceModule row).
- **REQ-017 (= R-34)** ([docs/PLAN.md L84](../PLAN.md), README L34) — Confluence SPACE crawling vs hierarchy 탐색 정책. Constraint, "P4 ADR 필수". 본 ADR 의 축 (1) 이 그 택일을 박제 (본 ADR 의 직접 motivation).

### 선행 박제 정합 (raw 미저장 / adapter leaf)

- **raw 미저장 invariant** — [ADR-0006 (assessment-data-model)](ADR-0006-assessment-data-model.md) / REQ-059 상 평가 대상의 raw 본문 (Confluence page body) 은 저장하지 않고 평가 결과 (점수 / contribution 메타) 만 영속화한다. 본 ADR 의 축 (2) 수집 경계가 이 invariant 위에서 성립 — page body 는 평가 파이프라인을 거쳐 결과만 남고 raw 는 transient.
- **adapter leaf** — [docs/architecture/modules.md](../architecture/modules.md) 상 ConfluenceModule 은 다른 internal module 을 import 하지 않는 **adapter leaf** 로 외부 Confluence HTTPS 만 호출. [ADR-0003 §4](ADR-0003-deployment.md) 의 외부 adapter direct egress 정합. 본 ADR 의 탐색 정책은 이 leaf 경계 안 (HTTP 호출 + 결과 변환) 에서만 동작.

### ADR cross-reference (번호 정합 박제)

- **다음 free 번호 ADR-0013** — `docs/decisions/` 에 ADR-0001 ~ ADR-0012 점유 (ADR-0007 은 미신설 — [ADR-0011 §ADR cross-reference](ADR-0011-difficulty-model-assignment.md) 박제). 본 ADR 은 다음 free 번호 ADR-0013 을 사용 (T-0145 acceptance 의 번호 정합 명시).
- **p4-implementation-plan §3 의 트리거 task 표기** — [p4-implementation-plan.md §3 후보 (a)](../architecture/p4-implementation-plan.md) 가 본 ADR 트리거를 "T-0143" 로 placeholder 박제했으나, 실 planner 할당은 **T-0145** (P3→P4 진행 중 task ID 자연 shift — 동 문서 §2 가 "task ID 는 잠정 placeholder, 진행 중 자연 split / 한 자리 shift 가능" 박제). 트리거 source (R-34 / PLAN L84) 는 동일.
- [ADR-0002 (DB / Prisma)](ADR-0002-db.md) — 후속 PermissionDeniedRecord entity 의 PostgreSQL row 영속 baseline (본 ADR scope 외 — 축 (3) 은 탐색-제어만, entity schema 0).

## Decision

본 ADR 은 다음 3 결정을 박제한다.

### Decision §1 — 탐색 메커니즘: page List 기반 (SPACE content list API 순회)

- **page List 기반 채택** — ConfluenceAdapter 의 default 탐색 메커니즘은 **지정 SPACE 의 content list API 순회** 다. Confluence REST API 의 SPACE-scoped content 조회 (예: `GET /rest/api/space/{spaceKey}/content` 또는 `GET /rest/api/content?spaceKey={key}` 류, cursor / `start`+`limit` paging) 로 SPACE 내 page 를 **평면 list 로 enumerate** 하고 paging 을 끝까지 순회한다. 구체 endpoint 경로 / API 버전 (REST v1 vs v2) 선택은 ConfluenceAdapter 코드 task 책임 — 본 ADR 은 "SPACE content list API 순회" 라는 탐색 메커니즘 class 만 default 로 확정.
- **full crawling 미채택 사유** — link 따라가며 재귀 수집하는 full crawling 은 (i) page body 의 link 파싱 의존 → raw body 처리 결합도 ↑ (raw 미저장 invariant 와 마찰) (ii) SPACE 경계 이탈 위험 (link 가 외부 / 타 SPACE 로) (iii) 재귀 depth / cycle 방어 복잡. README L34 가 "Crawling 을 해야 할 수 있다" 로 허용은 하나 **필요조건이 아니므로** (List / Hierarchy 도 허용) MVA 상 단순한 List 우선.
- **Hierarchy 기반 미채택 사유 (default 아님)** — parent-child tree 순회는 SPACE 의 page 계층 구조에 의존하는데, (i) 모든 page 가 tree 에 속하지 않을 수 있고 (orphan / 루트 직속) (ii) tree 순회는 평면 list 대비 추가 ancestor / child 호출 round-trip 증가. 단 **List API 가 hierarchy 정보 (ancestors) 를 함께 반환** 하면 평가 메타로 활용 가능 — Hierarchy 는 default 탐색 경로가 아니라 List 결과의 보강 정보로 위치 ([§Consequences](#consequences) 5).
- **modules.md 정합** — [modules.md ConfluenceModule row](../architecture/modules.md) 의 "SPACE list / page list / page version 조회 adapter" 책임과 직결 — 본 결정의 "page list API 순회" 가 그 "page list 조회" 책임의 구현 default. crawling vs hierarchy 가 "P4 ADR" 로 미뤄진 그 ADR 이 본 ADR 이며, List 기반을 default 로 박제하여 row 의 미결정을 해소한다.

### Decision §2 — 다중 SPACE enumerate + page 수집 경계: SPACE key allowlist 순회 + (page, version) 단위 raw-transient

- **지정 SPACE allowlist 순회** — 평가 대상 SPACE 는 **명시 지정된 SPACE key 집합 (allowlist)** 으로 한정한다 (README L31 "지정된 SPACE 들"). ConfluenceAdapter 는 전체 SPACE 자동 발견 (SPACE list 전수 crawl) 을 **하지 않고**, 설정으로 주어진 SPACE key 목록을 순회하며 각 SPACE 에 Decision §1 의 content list 순회를 적용한다. SPACE key 집합의 설정 형태 (env / DB config) 는 ConfluenceAdapter 코드 task 책임 — 본 ADR 은 "지정 allowlist 만 순회, 전수 발견 안 함" 의 경계만 박제.
- **(page, version) 수집 단위** — 수집의 최소 단위는 **page 1 개 + 그 version 메타** (REQ-015 의 "작성 / 업데이트 활동" — version 이 업데이트 기여를 식별) 다. [modules.md](../architecture/modules.md) 의 "page version 조회" 책임과 직결. page body raw 는 평가 파이프라인 입력으로만 transient 사용하고 **영속화하지 않는다** — [ADR-0006](ADR-0006-assessment-data-model.md) / REQ-059 raw 미저장 invariant 정합. 영속화 대상은 평가 결과 (점수 / contribution 메타 / page 식별자 / version / 작성자 attribution) 만.
- **raw-transient 경계** — page body 는 LLM 평가 호출 동안만 메모리에 존재하고 DB 에 저장되지 않는다. attribution (어느 Person 이 어느 page 의 어느 version 을 작성 / 업데이트) 만 결과에 남는다. 본 경계가 raw 미저장 invariant 를 탐색 단계에서부터 보장 — full crawling 대비 List 기반이 link 본문 파싱 불요로 이 경계 유지에 유리 (Decision §1 사유와 정합).

### Decision §3 — 권한 부족 (4xx) 탐색-제어: SPACE 단위 skip-and-continue (탐색 비-abort)

- **SPACE 단위 skip-and-continue 채택** — 지정 allowlist 의 일부 SPACE 에 read 권한이 부재하여 Confluence 가 4xx (401 / 403 / 404) 를 반환하면, ConfluenceAdapter 는 **그 SPACE 를 skip 하고 나머지 SPACE 탐색을 계속** 한다. 한 SPACE 의 권한 부족이 전체 탐색을 abort 시키지 **않는다** — 권한 있는 나머지 SPACE 의 평가는 정상 진행되어 부분 가용성 (partial availability) 을 보장.
- **PermissionDeniedEvent emit 위상** — skip 시 ConfluenceAdapter 는 4xx 를 catch 하여 **PermissionDeniedEvent 를 emit** 한다 (REQ-016 "AA 사용자·관리자가 인식·대응"). emit 자체는 [modules.md ConfluenceModule row](../architecture/modules.md) ("4xx catch → PermissionDeniedEvent emit") 책임과 직결. 본 ADR 은 그 emit 이 **탐색을 멈추지 않고** 발생함 (skip-and-continue) 의 탐색-제어 위상만 박제 — **PermissionDeniedRecord entity 의 실 schema (Prisma model + repository) 는 본 ADR scope 외** (후속 task, [p4-implementation-plan.md §2 T-0144 row](../architecture/p4-implementation-plan.md)).
- **abort 미채택 사유** — 한 SPACE 4xx 로 전체 탐색을 abort 하면 (i) 권한 있는 SPACE 의 평가까지 막혀 가용성 손실 (ii) 다중 SPACE 중 1 개 권한 누락이 흔한 운영 상황에서 평가 전면 중단은 과도 (iii) REQ-016 의 "인식·대응" 은 event 통지로 충족되지 abort 가 필요조건 아님. 따라서 skip-and-continue 로 가용성 보존 + event 로 가시성 확보.

### HITL 경계 (본 ADR 과 후속 task)

- **본 ADR 은 결정만** — Confluence 탐색 정책 (메커니즘 / 경계 / 4xx 제어) 의 **결정** 만 박제한다. `pnpm add` 0 / 외부 호출 0 / secret 0 — 본 task 는 production code 0 LOC (ADR doc + INDEX 1 row).
- **ConfluenceAdapter 실 코드는 후속 HITL 게이트 task** — 본 ADR 의 탐색 contract 를 구현하는 `ConfluenceAdapter` service (Confluence REST API SDK 또는 native `fetch` + **Confluence token 자격증명**) 는 후속 task 의 [CLAUDE.md §5](../../CLAUDE.md) "새 외부 dependency / 자격증명 필요" BLOCKED 게이트 대상이다 ([p4-implementation-plan.md §4 게이트 2](../architecture/p4-implementation-plan.md)). 본 ADR 은 그 게이트가 발화하기 **전** dependency-free 로 선행 박제 가능한 결정만 다룬다 — 탐색 메커니즘 (List) / 수집 경계 ((page, version) raw-transient) / 4xx 제어 (skip-and-continue) 은 모두 client 라이브러리 선택과 무관한 contract 결정.

## Consequences

### 양의 (positive)

1. **후속 ConfluenceAdapter task contract 명확** — Decision §1~3 으로 탐색 메커니즘 (List) / SPACE allowlist 순회 / (page, version) 단위 / 4xx skip-and-continue 가 사전 고정 → architect / implementer 의 탐색 환각 ↓, 일관된 contract 위 구현. crawling depth / cycle 방어 / link 파싱 로직 불요로 adapter 구현 표면 ↓.
2. **raw 미저장 invariant 탐색 단계 보장** — Decision §2 의 page body raw-transient 경계가 [ADR-0006](ADR-0006-assessment-data-model.md) / REQ-059 invariant 를 탐색 진입 단계부터 강제 → 평가 파이프라인 하류가 raw 누출 방어 부담 ↓. List 기반 선택 (link 본문 파싱 불요) 이 이 경계 유지에 구조적으로 유리.
3. **부분 가용성 (partial availability)** — Decision §3 의 SPACE 단위 skip-and-continue 로 1 SPACE 권한 누락이 전체 평가를 막지 않음 → 다중 SPACE 운영의 robustness. PermissionDeniedEvent 가 누락 SPACE 를 가시화 (REQ-016 인식·대응) 하면서도 가용성 보존.
4. **MVA 정합** — full crawling / hierarchy tree 순회 대비 평면 List 순회는 최소 복잡도 → [INDEX.md MVA 원칙](../architecture/INDEX.md) (over-design 회피) 정합. README L34 가 셋 다 허용하므로 가장 단순한 List 우선 선택이 정당.
5. **Hierarchy 보강 여지 박제** — Decision §1 상 Hierarchy 는 default 탐색 경로가 아니나, List API 가 반환하는 ancestors 정보를 평가 메타 (page 위치 / 계층 context) 로 활용 가능 → 향후 hierarchy 기반 평가 가중이 필요하면 List default 위에 보강 추가 (탐색 메커니즘 전환 ADR 불요, 메타 활용 확장).

### 음의 (negative) / trade-off

1. **List API page 누락 위험** — Decision §1 의 SPACE content list 가 일부 page type (blog / attachment / draft) 을 default 로 누락할 수 있음. mitigation: ConfluenceAdapter 코드 task 가 content type 필터 파라미터를 명시 (REQ-015 의 "문서 작성 / 업데이트" 대상 type 범위) — 본 ADR 은 메커니즘 class 만 박제, type 필터 구체는 코드 task.
2. **paging 순회 비용** — 대형 SPACE 의 전체 page 평면 순회는 paging round-trip N 회 → 호출량 ↑. mitigation: cursor / `limit` 최대화 + 증분 수집 (version 변경 page 만) 은 ConfluenceAdapter 코드 task 의 성능 최적화 책임 (본 ADR 탐색 메커니즘 결정과 독립).
3. **skip-and-continue 의 silent partial 위험** — Decision §3 상 권한 누락 SPACE 가 skip 되면 그 SPACE 기여가 평가에서 누락 → PermissionDeniedEvent 를 운영자가 무시하면 silent 누락. mitigation: REQ-016 의 user/admin audience 분리 통지 (후속 PermissionDeniedRecord task) 가 누락 SPACE 를 표면화 — event 가 영속 record + 통지로 외화되어야 silent 방지 (entity schema 는 본 ADR scope 외).

### 후속 task chain 박제 (ADR-first split 정합)

본 ADR (doc-only, pr-mode) 머지 후 후속 코드 chain — [CLAUDE.md §3.1 rule 3](../../CLAUDE.md) (ADR + 코드 split) 정합:

| 후속 task (잠정) | scope | dependency | BLOCKED risk |
| --- | --- | --- | --- |
| **ConfluenceAdapter scaffold** ([p4-plan T-0142 row](../architecture/p4-implementation-plan.md)) | `ConfluenceAdapter` service (SPACE allowlist 순회 + Decision §1 List 탐색 + (page, version) 조회 + 4xx catch → PermissionDeniedEvent emit, Decision §3 skip-and-continue) | 본 ADR-0013 머지 후 | **있음 — Confluence REST API SDK 또는 native `fetch` + Confluence token 자격증명 ([CLAUDE.md §5](../../CLAUDE.md) BLOCKED 게이트)** |
| **PermissionDeniedRecord entity** ([p4-plan T-0144 row](../architecture/p4-implementation-plan.md)) | PermissionDeniedRecord Prisma model + repository + 4xx event 영속화 + user/admin audience 분리 (REQ-016) | ConfluenceAdapter / GithubAdapter (HITL 게이트) 선행 | 없음 — entity + event 영속화, token 은 선행 task 게이트에서 처리 |

## Alternatives considered

| 대안 | 장점 | 단점 / 정합도 | 채택 여부 |
| --- | --- | --- | --- |
| **(1) page List 기반 + SPACE allowlist 순회 + 4xx skip-and-continue** (채택) | MVA 최소 복잡도 (평면 순회) / raw 미저장 invariant 에 구조적 유리 (link 파싱 불요) / 부분 가용성 (1 SPACE 권한 누락 흡수) / modules.md "page list 조회" 책임 직결 | List API 일부 page type 누락 위험 (type 필터로 mitigation) / paging round-trip 비용 / skip silent partial 위험 (event 통지로 mitigation) | **✓ 채택** |
| (2) full crawling (link 따라가며 재귀 수집) | README L34 "Crawling 을 해야 할 수 있다" 직접 충족 / link 그래프 전수 도달 | page body link 파싱 의존 → raw body 처리 결합 (raw 미저장 invariant 마찰) / SPACE 경계 이탈 위험 (외부 / 타 SPACE link) / 재귀 depth·cycle 방어 복잡 / README 가 "해야 할 수 있다" 로 허용은 하나 필요조건 아님 | 기각 — raw 결합 + SPACE 경계 이탈 + 복잡도, MVA 열세 |
| (3) page Hierarchy / directory tree 순회 (parent-child) | SPACE page 계층 구조 자연 반영 / 평가에 계층 context 활용 | 모든 page 가 tree 소속 아님 (orphan / 루트 직속 누락 위험) / ancestor·child 추가 round-trip / 평면 List 대비 순회 복잡 | 기각 (default 아님) — orphan 누락 + round-trip 증가. 단 List 가 반환하는 ancestors 를 메타 보강으로 활용 (Consequences 5) |
| (4) 전체 SPACE 자동 발견 (SPACE list 전수 crawl 후 평가) | 지정 누락 없이 전 SPACE cover / SPACE key 설정 불요 | README L31 "지정된 SPACE 들" 명시 한정과 어긋남 (평가 범위 폭증) / 권한 부족 SPACE 대량 4xx / 의도하지 않은 SPACE 평가로 결과 noise | 기각 — README "지정 SPACE" 한정 위배, Decision §2 allowlist 와 충돌 |
| (5) 권한 부족 4xx → 탐색 전면 abort | 부분 데이터로 평가하는 위험 제거 (all-or-nothing) | 1 SPACE 권한 누락이 권한 있는 전 SPACE 평가까지 차단 → 가용성 손실 / 다중 SPACE 중 1 누락 흔한 운영 상황에 과도 / REQ-016 "인식·대응" 은 event 통지로 충족, abort 필요조건 아님 | 기각 — 가용성 손실, Decision §3 skip-and-continue 열세 |

**향후 재검토 조건** (Alternatives 재평가 trigger): (i) 평가 정확도가 page 계층 context 를 요구하여 Hierarchy 순회 default 전환이 필요해지면 본 ADR supersede ADR. (ii) 지정 SPACE 내 link 그래프 기반 기여 (cross-page 참조 활동) 평가가 R-34 범위로 확장되면 crawling 보강 ADR. (iii) silent partial 누락이 운영상 빈발하면 Decision §3 을 "권한 누락 SPACE N% 초과 시 abort + 통지" 류 정책으로 강화하는 supersede ADR.

## References

- [docs/PLAN.md L84](../PLAN.md) — Phase P4 "Confluence SPACE 탐색 정책 (R-34) — Crawling 또는 page List/Hierarchy 기반 탐색 중 택. ADR 로 결정." (본 ADR 의 직접 motivation)
- [docs/requirements.md](../requirements.md) — REQ-015 (Confluence 지정 SPACE 평가) / REQ-016 (권한 부족 인식·통지) / REQ-017 (crawling vs hierarchy 탐색 정책, Constraint, "P4 ADR 필수") source of truth
- [README.md L31–34](../../README.md) — Confluence 지정 SPACE 문서 활동 + 권한 부족 인식·대응 + crawling/List/Hierarchy 탐색 허용 문구 (결정 대상 verbatim)
- [docs/architecture/modules.md](../architecture/modules.md) — ConfluenceModule row (SPACE list / page list / page version 조회 adapter, crawling vs hierarchy 정책은 P4 ADR, 4xx catch → PermissionDeniedEvent emit) — 책임 module + 트리거 source
- [docs/architecture/p4-implementation-plan.md §3 후보 (a)](../architecture/p4-implementation-plan.md) — Confluence SPACE 탐색 정책 ADR 후보 + §2 표 ConfluenceModule (T-0142 scaffold) / T-0143 placeholder (실 할당 T-0145) / T-0144 PermissionDeniedRecord row
- [docs/decisions/ADR-0006-assessment-data-model.md](ADR-0006-assessment-data-model.md) — raw 미저장 invariant (REQ-059) — Decision §2 page body raw-transient 경계 정합
- [docs/decisions/ADR-0003-deployment.md](ADR-0003-deployment.md) §4 — 외부 adapter direct egress (ConfluenceModule 외부 HTTPS 호출 정책)
- [docs/decisions/ADR-0002-db.md](ADR-0002-db.md) — PostgreSQL + Prisma (후속 PermissionDeniedRecord entity persistence baseline, 본 ADR scope 외)
- [docs/decisions/ADR-0011-difficulty-model-assignment.md](ADR-0011-difficulty-model-assignment.md) — ADR 템플릿 mirror (frontmatter 형식 + Context / Decision / Consequences / Alternatives 구조) + ADR-0007 미신설 / 번호 정합 박제
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — ADR 목록 row 추가 대상 (본 ADR-0013 row) + MVA 원칙
- [CLAUDE.md §1](../../CLAUDE.md) — "코드보다 ADR이 먼저다" (본 ADR-first split 정당화)
- [CLAUDE.md §3.1 rule 3](../../CLAUDE.md) — ADR + 코드 혼합 task split (본 ADR doc-only, ConfluenceAdapter 코드는 후속 task)
- [CLAUDE.md §5](../../CLAUDE.md) — 본 ADR 외부 dependency 0 / `pnpm add` 0 / 자격증명 0 → HITL 게이트 미발화 (후속 ConfluenceAdapter task 에서 발화)

Refs: T-0145, ADR-0002, ADR-0003, ADR-0006, ADR-0011, REQ-015, REQ-016, REQ-017
