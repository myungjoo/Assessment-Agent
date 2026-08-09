---
id: T-1536
title: 실 DB perf cutover 잔여 read route 인벤토리를 부하계획 §5 item 5 에 박제
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 100
estimatedFiles: 2
created: 2026-08-08
createdAt: 2026-08-08T23:40:00Z
completedAt: 2026-08-09T00:50:00Z
independentStream: perf-realdb-slices
dependsOn: [T-1535]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
plannerNote: "P5 PLAN 142 행 R-92 조회 3s — slice 19 착수 전 잔여 cutover 후보를 route 단위로 인벤토리화. 'mock 잔존 30 개' 가 곧 '잔여 slice 30 개' 라는 오독을 A/B/C 분류로 차단. direct · 2 파일 약 100 LOC."
---

# T-1536 — 실 DB perf cutover 잔여 read route 인벤토리 박제

## Why

[docs/PLAN.md](../PLAN.md) `142 행` (P5 성능 검증 · R-92 "조회·시각화 3초 이내" / REQ-048) 의 실 DB
round-trip cutover 는 slice 1~18 (T-1500 ~ T-1535) 로 **endpoint 도메인 14 개 · 조회 route 27 개** 까지
도달했다. 그런데 그다음 slice 를 고를 때마다 **"무엇이 아직 안 재졌는가" 를 매번 처음부터 다시 조사**
해야 한다 — 현재 세 문서 어디에도 **잔여 route 의 명시 목록이 없기 때문** 이다. 지금 남아 있는 서술은
[test/perf/README.md](../../test/perf/README.md) `838~843 행` 의 "나머지 **mock 잔존 30 개**" 와 "남은
endpoint 의 실 DB cutover 는 endpoint 단위 후속 slice 로 이어간다" 뿐이다.

**이 서술은 오독되기 쉽다.** "mock 잔존 30 개" 는 `read glob 47 − 실 DB read 17 = 30` 이라는
**파일 계수** 일 뿐 **잔여 slice 30 개가 아니다**. 실제로 그 30 개 mock spec 중 상당수는 **그 route 가
이미 실 DB 로 측정된** 파일이다 — 예를 들어 `group-detail-read.perf-spec.ts` 가 겨냥한
`GET /api/groups/:id` 는 slice 2(`group-read-realdb.perf-spec.ts`) 가 이미 실측했고,
`import-modes-read` · `import-running-read` 두 mock 이 겨냥한 route 는 slice 12 가 한 파일로 함께
실측했다. 반대로 slice 18 의 `GET /api/groups/:id/members` 처럼 **mock 짝이 아예 없는데 미측정이던**
route 도 있었다 (T-1534 의 "계수 함정 ②"). 즉 **파일 계수와 route 잔여는 서로 다른 축** 인데 그 구분이
문서에 없다.

본 task 는 slice 19 착수 **전에** 그 잔여를 route 단위로 한 번 확정해 [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md)
`§ 5` item 5 의 `**잔여**` 절에 박제한다. 산출물은 **3 분류 인벤토리** 다 —
**(A)** mock spec 은 남아 있지만 그 route 는 **이미 실 DB 실측 완료** (해당 mock 은 잔여 slice 후보가
아니다), **(B)** mock spec 이 있고 route 도 **아직 미측정** (= 진짜 잔여 slice 후보),
**(C)** perf-spec 자체가 **없는데 미측정** 인 read route (slice 18 이 이 부류였다).
`A + B = 30` 이 `47 − 17 = 30` 과 산술적으로 맞물려야 하며, 이 등식이 곧 본 인벤토리의 자체 검산이다.

본 task 는 **doc-only `direct`** 다 — 새 측정 · 새 spec · production code 변경이 0 이고, slice 목록의
**정본은 여전히 [test/perf/README.md](../../test/perf/README.md)** 이며 본 task 는 그 파일을
**수정하지 않는다** (`test/` 는 `pr` 대상 — [CLAUDE.md](../../CLAUDE.md) §3.1 rule 3 mixed 금지).
인벤토리는 정본의 **복제가 아니라 plan 측 backlog** 이며, 그 사실을 본문에 1 구절로 명시한다.

## Required Reading

- [test/perf/README.md](../../test/perf/README.md) `## 실 DB round-trip baseline (slice 목록)` 의
  slice 1~18 bullet 과 그 뒤 `- **잔여**` bullet (`838~843 행` 부근) — 어떤 route 가 어느 slice 에서
  실측됐는지의 **정본**. **수정 금지 · 인용만**.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§ 5` item 5 —
  갱신 대상 1. `135 행` "실 DB round-trip 실측이 slice 18 까지 도달", `382 행` 부근 셈법 문장,
  `389~390 행` 계산식(`read 47 개 − 실 DB read 17 개`), `398~406 행` 부근 규모 민감도 잔여 목록,
  그리고 그 뒤의 `**잔여**` 구절 — **본 인벤토리는 이 잔여 구절 끝에 새 소절로 append** 한다.
- [docs/PLAN.md](../PLAN.md) `142 행` — 갱신 대상 2. 잔여 서술("실측 범위가 endpoint 14 개(조회
  route 27) 뿐") 뒤에 **부하계획 인벤토리로의 pointer 1 문장만** 덧붙인다.
- [docs/tasks/T-1534-perf-realdb-slice18-group-members-read.md](T-1534-perf-realdb-slice18-group-members-read.md)
  `## Why` 의 **계수 함정 ②** (mock 짝 부재 route) — 본 인벤토리 분류 (C) 의 실존 선례.
- [docs/tasks/T-1535-perf-realdb-slice18-doc-sync.md](T-1535-perf-realdb-slice18-doc-sync.md) —
  직전 direct doc task 의 구조 · **완료 선언 금지 · checkbox `[ ]` 유지 · `IN_PROGRESS` 유지** 원칙의
  mirror.
- [src/import/import.controller.ts](../../src/import/import.controller.ts) `@Get("running")` ·
  `@Get("modes")` · `@Get(":id")` (`350` / `367` / `382 행` 부근) — 분류 (B) 판정의 실측 예시
  (slice 12 는 앞의 둘만 쟀고 `:id` 는 미측정). **수정 금지 · 읽기만**.
- [src/app.controller.ts](../../src/app.controller.ts) `@Get()` (`15 행` 부근) — 실측 도메인에 아직
  없는 `AppController` 의 root read route. **수정 금지 · 읽기만**.

## Acceptance Criteria

- [ ] **AC 1 — 계수 실측 (편집 전).** `ls test/perf/*.perf-spec.ts | wc -l` ·
  `ls test/perf/*read*.perf-spec.ts | wc -l` · `ls test/perf/*realdb*.perf-spec.ts | wc -l` ·
  `ls test/perf/*read*realdb*.perf-spec.ts | wc -l` 을 실행해 각각 **52** · **47** · **18** · **17**
  임을 확인한다. 문서에 쓰는 개수는 이 실측값만 쓴다 (추정 금지). 값이 다르면 문서가 아니라 본 AC 의
  전제를 고친다.
- [ ] **AC 2 — mock-only read spec 30 개 목록 확정.** `ls test/perf/*read*.perf-spec.ts | grep -v realdb`
  로 **30 개** 파일명을 뽑고, 각 파일이 겨냥하는 **HTTP method + path** 를 해당 spec 의 상단 주석
  (또는 상수 선언부) 에서 읽어 1:1 로 짝짓는다. 30 개 전부가 인벤토리에 등장해야 하며 누락·중복 0 을
  확인한다.
- [ ] **AC 3 — 3 분류 인벤토리 작성.** AC 2 의 30 개를 다음으로 분류해 표(또는 bullet) 로 적는다 —
  **(A) route 실측 완료 (mock 잔존)**: 그 route 를 실측한 **slice 번호와 realdb spec 파일명** 을 함께
  적는다. **(B) route 미측정 (진짜 잔여 slice 후보)**: mock spec 파일명 + route 를 적는다.
  분류 근거는 [test/perf/README.md](../../test/perf/README.md) 의 slice 1~18 bullet 과 각 realdb spec
  헤더의 route 서술이며, **추측 금지 — 근거를 못 찾으면 (B) 로 보수 분류하고 그 사실을 1 구절로 표기**
  한다. 각 항목은 한 줄을 넘기지 않는다.
- [ ] **AC 4 — (C) 분류 (perf-spec 부재 미측정 route).** `grep -rn "@Get(" src/**/*.controller.ts`
  로 조회 route 를 훑어, AC 2 의 30 개와 실측 완료 27 route 어디에도 없는 read route 를 **(C)** 로
  별도 나열한다 (예: `AppController` 의 `GET /`). slice 18 의 `GET /api/groups/:id/members` 가
  **본 부류였다가 해소된 선례** 임을 1 구절로 병기한다. 이 절은 **완전 열거를 주장하지 않고**
  "현 시점 확인분" 임을 명시한다 (controller 가 늘면 다시 조사해야 하므로).
- [ ] **AC 5 — 자체 검산 등식 박제.** 인벤토리 끝에 `A + B = 30` 과 `read 47 − 실 DB read 17 = 30`
  이 **같은 30 을 가리키는 서로 다른 셈** 임을 1~2 문장으로 적고, 실제 A · B 개수를 숫자로 명시한다.
  두 셈이 어긋나면 문서가 아니라 분류를 고친다.
- [ ] **AC 6 — 오독 차단 문장.** `**잔여**` 절에 **"mock 잔존 30 개 ≠ 잔여 slice 30 개"** 를 명시적으로
  적는다 — 30 은 **파일 계수** 이고 실제 잔여 cutover 후보는 **(B) + (C)** 라는 점, 그리고 (A) 부류의
  mock spec 은 **retire 여부가 별도 판단** (본 task 는 판단하지 않음) 이라는 점을 각각 1 구절로 남긴다.
- [ ] **AC 7 — 정본 경계 명시.** 인벤토리 머리말에 slice 목록의 **정본은
  [test/perf/README.md](../../test/perf/README.md)** 이고 본 절은 **plan 측 backlog (파생)** 이며
  둘이 어긋나면 **정본이 이긴다** 는 문장을 1 줄 넣는다. 본 task 는 `test/perf/README.md` 를
  **수정하지 않는다**.
- [ ] **AC 8 — PLAN `142 행` pointer 1 문장.** PLAN 잔여 서술 뒤에 "잔여 cutover 후보의 route 단위
  인벤토리는 [부하계획](ops/load-resilience-test-plan.md) `§ 5` item 5 잔여 절에 있다" 취지의
  **1 문장 pointer 만** 덧붙인다. **계수(perf-spec 52 / read 47 / 실 DB 18 / read 17 / 도메인 14 /
  조회 route 27) 를 바꾸지 않고**, slice 1~18 서술도 손대지 않는다.
- [ ] **AC 9 — 완료 선언 0 검산.** diff 에서 (a) PLAN `140 행` checkbox 가 `[ ]` 그대로,
  (b) 부하계획 `§ 5` item 5 가 여전히 **미완** 으로 읽히는지 (baseline 관찰 전용 · `writeBaselineFile`
  미사용 · 임계 fix 미착수 서술 삭제 0) 두 지점을 각각 확인한다. 인벤토리가 생겼다고 잔여가 줄어든
  것처럼 읽히면 문장을 되돌린다.
- [ ] **AC 10 — 잔여 축 보존.** 갱신 후에도 부하계획에 다음 4 잔여가 살아 있어야 한다 —
  (a) mock 잔존 read perf-spec **30 개 불변**, (b) 규모 민감도는 `:id/persons` 한 route 한정이고 다른
  endpoint 는 미측정, (c) baseline 파일 확정 · 임계 fix 미완, (d) 시각화(web) 렌더 측정 축 부재 +
  REQ-047 실 scale 부하 미검증. 하나라도 삭제됐으면 되돌린다.
- [ ] **AC 11 — REQ-047 오독 차단 · REQ 재판정 0.** 인벤토리 어디에도 본 task 가 REQ-047 (100~200명 /
  50~100 repo / ~1000 confluence page / 1h) 을 진전시킨 것으로 읽히는 표현을 쓰지 않는다.
  [docs/requirements.md](../requirements.md) 는 **수정하지 않는다** (REQ-048 재판정은 slice 실측이
  있을 때만 — 본 task 는 측정 0).
- [ ] **AC 12 — 범위 표기 규약 + 크기 검산.** 새로 추가하는 행 좌표 표기는 [CLAUDE.md](../../CLAUDE.md)
  §12 "범위 좌표 표기" (`§ 12.76` `R1` · `R4` · `R5 (§ 12.91 개정)`) 를 따른다 — 구분자 `~`, 단일 행은
  `142 행`, `L` prefix 금지, **기존 행 소급 치환 금지**. 마지막에 `git diff --stat` 이
  **2 파일 / ≤ 300 LOC** 임을 확인한다 (코드 변경 0 이라 test 는 불요).

## Out of Scope

- **코드 · spec 변경 일체** (`test/` · `src/` · `prisma/`) — 본 task 는 doc-only `direct` 다.
  [test/perf/README.md](../../test/perf/README.md) 도 **수정하지 않는다** (정본 — 인용만).
- **perf slice 19 착수** — 본 task 는 후보를 **적기만** 하고 어느 route 를 다음 slice 로 할지
  **결정하지도 측정하지도 않는다**. 우선순위 부여는 planner 의 다음 호출 몫이다.
- **(A) 부류 mock perf-spec 의 retire · 삭제 · 통합** — 실 DB 짝이 생긴 mock spec 을 지울지 남길지는
  별도 판단 (`test/` 변경이라 `pr`). Follow-ups 에만 적는다.
- **REQ-048 status flip · PLAN `140 행` checkbox 체크 · 부하계획 item 5 완료 선언** — 잔여 축
  (실 scale 부하 · baseline 확정 · 임계 fix · web 렌더 측정) 이 살아 있으므로 금지 (AC 9 · AC 10).
- **[docs/requirements.md](../requirements.md) 편집** (AC 11) · **REQ-047 행 수정**.
- **임계값 · baseline 정책 변경** — `DEFAULT_P95_MAX_MS = 3000` 및 "baseline 후 fix" 서술 불변.
- **write / trigger route 의 인벤토리화** — 본 task 의 범위는 **read (조회) route** 뿐이다.
  write route 부하 측정은 §5 의 다른 item 소관이며 그 사실만 1 구절로 적고 목록화하지 않는다.
- **`docs/architecture/*` · ADR 신설 · ADR-0054 status flip · 새 dependency** — §3.1 상 `pr` 이거나
  §5 BLOCKED 게이트 대상.
- **행 좌표 표기 소급 정규화** — 기존 표기는 그대로 둔다 (AC 12).

## Suggested Sub-agents

`implementer` (architect · tester 불요 — 새 결정 0, 코드 변경 0 의 doc-only 인벤토리).

## 결과 (2026-08-09T00:50Z DONE)

- 2 파일 `+81/-1` direct commit `17c72384` 로 main 반영. AC 1~12 전원 `ok`.
- 부하계획 `§ 5` item 5 잔여 절 뒤에 **route 단위 3 분류 인벤토리** append —
  (A) 실측 완료 · mock 잔존 **26** (표) / (B) mock 짝 없는 미측정 **4** / (C) perf-spec 부재 미측정 **0**.
- 자체 검산 병기: `A + B = 26 + 4 = 30` ↔ `read 47 - 실 DB read 17 = 30` (계수 무모순).
- 오독 차단 박제: **"mock 잔존 30 개 != 잔여 slice 30 개"** — (A) 부류는 route 가 이미 실측됐고
  spec retire 여부는 별도 판단(`test/` 라 `pr`)임을 명시.
- 정본 경계 명시: 계수 정본은 [test/perf/README.md](../../test/perf/README.md), 본 절은 **파생 backlog** —
  정본 수정 0 (`§3.1` direct·pr mixed 회피).
- `docs/PLAN.md` `142 행` 에는 pointer 1 문장만 추가 — 계수 · slice 서술 **불변**, `140 행` `[ ]` 유지
  (완료 선언 0, 잔여 축 4 종 보존).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
