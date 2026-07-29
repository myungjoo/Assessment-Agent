---
id: T-1306
title: api.md §5 합계 수치 재집계 — 56 → 72 endpoint · prefix 14 → 16 drift 교정 + 재집계 규칙 각주 박제
phase: P5
status: DONE
completedAt: 2026-07-29T11:05:00Z
commitMode: direct
coversReq: [REQ-030, REQ-032, REQ-040, REQ-045]
estimatedDiff: 22
estimatedFiles: 1
created: 2026-07-29
independentStream: p5-doc-drift-apimd
dependsOn: [T-1305]
touchesFiles:
  - docs/architecture/api.md
plannerNote: "doc-only enumerated-section x1.6 x inline-amend 0.4 = 약 22 LOC / 1 파일. T-1305 executor 이월 — 153 행 '약 56 endpoint' 가 실측 72 행과 16 행 어긋남"
---

# T-1306 — api.md §5 합계 수치 재집계 + 재집계 규칙 각주 박제

## Why

[T-1304](T-1304-api-doc-import-query-export-download-rows.md) 와 [T-1305](T-1305-api-doc-export-remaining-routes.md) 가 UC-07 그룹에 9 행을 신설하면서 §5 표는 커졌는데, 표 바로 아래 153 행의 **합계 문장은 갱신되지 않았다** — 현재 `**합계**: 약 56 endpoint / 14 resource prefix / 8 UC cover` 로 적혀 있으나 실측은 **72 행** 이다 (planner pre-check: `grep -cE '^\| (GET|POST|PATCH|PUT|DELETE) \|' docs/architecture/api.md` → 72). 16 행 (≈ 29%) 어긋난 수치라, 이 문장만 읽고 규모를 가늠하는 후속 slice·reviewer 는 실제보다 작은 API 표면을 전제하게 된다.

prefix 누계도 함께 뒤처졌다. 153 행의 누적 서술은 `prefix 13 → 14` (T-0414/T-0415 `/api/schedules`) 에서 멈춰 있는데, 그 사이 shipped 된 **`/api/assessment-collection`** (100 행 그룹 헤더, T-0271~T-0275) 과 **`/api/assessment-evaluation`** (102 행 그룹 헤더, T-0293) 두 prefix 가 누계에 반영된 적이 없다 → 실제 **16**. endpoint 신설 task 마다 이 문장이 조용히 뒤처지는 패턴이 반복됐으므로, 본 task 는 수치 교정에 더해 **재집계 방법 자체를 각주로 박제** 해 다음 신설 task 가 mechanical 하게 동기할 수 있게 한다.

코드 0 LOC · 기존 doc 1 파일의 문장 amend 만이라 §3.1 상 `direct` 이고 R-110/R-112 는 면제되며, 대신 grep 실측 ↔ 문서 수치 대조를 Acceptance Criteria 로 강제한다 (T-1304/T-1305 와 동일 검증 형태).

**estimate 근거** — 153 행 리드 수치 교정 + 말미 재집계 절 1 개 append ~20 LOC + 각주 1 줄 신설 ~15 LOC → base ~35, doc-only enumerated-section × 1.6 × inline-amend 0.4 = × 0.64 → **~22 LOC / 1 파일** (cap 안, `sizeExempt` 불요). 실제 diff 는 긴 단일 행 2 개 교체라 실측이 더 작을 수 있다.

## Required Reading

- [docs/architecture/api.md](../architecture/api.md) 153 행 — `**합계**: 약 56 endpoint / 14 resource prefix / 8 UC cover (...)` **단일 긴 행**. 괄호 안은 `T-NNNN 박제로 ... prefix N → M` 형태의 누적 history 절이 세미콜론으로 이어진 구조다. 본 task 는 **리드 수치 3 개 교정 + 말미 절 1 개 append** 만 하고 기존 history 절 문장은 0 수정.
- [docs/architecture/api.md](../architecture/api.md) 62~67 행 — §5 표 도입부와 헤더 행 (`| METHOD | path | UC | description | auth tier |` — **5 열**). 집계 대상 범위의 시작점. **0 수정**.
- [docs/architecture/api.md](../architecture/api.md) 68~151 행 — §5 표 본문. endpoint 행 (첫 셀이 METHOD) 과 그룹 헤더 행 (첫 셀이 `**...**`) 이 섞여 있다. 그룹 헤더는 68 / 76 / 91 / 100 / 102 / 105 / 110 / 115 / 123 / 138 / 142 / 145 의 **12 행** 으로 endpoint 가 아니다. **표 행은 신설·수정 0**.
- [docs/architecture/api.md](../architecture/api.md) 139~140 행 — `GET /api/me/permission-denied` 와 `GET /api/admin/permission-denied`. 둘 다 본문에 **conceptual placeholder (미구현)** 이라고 이미 박제돼 있다 (실제 shipped 는 141 행 `/api/permission-denied-records` 하나). 합계 표기 시 이 2 행의 성격을 어떻게 셀지가 본 task 의 판단 지점. **0 수정**.
- [docs/architecture/api.md](../architecture/api.md) 100 행 · 102 행 — `/api/assessment-collection` (ADR-0031) · `/api/assessment-evaluation` (ADR-0032) 그룹 헤더. 153 행 prefix 누계에 한 번도 반영된 적 없는 2 prefix 의 근거. **0 수정**.
- [docs/architecture/api.md](../architecture/api.md) 155 행 — 합계 문장 다음 단락 (`**Auth/RBAC chain 3/3 종결 ...**`). 신설 각주의 삽입 위치 (153 행과 155 행 사이) 판단용. **0 수정**.

## Acceptance Criteria

- [ ] **실측 선행** — 편집 전 `grep -cE '^\| (GET|POST|PATCH|PUT|DELETE) \|' docs/architecture/api.md` 를 실행해 endpoint 행 수를 직접 확인한다. planner 실측치는 **72** 이며, 다르면 (본 task 큐잉 후 표가 또 바뀐 경우) **실측치를 정본으로 삼고** 그 값으로 아래 항목을 진행한다.
- [ ] **리드 수치 3 개 교정** — 153 행의 `약 56 endpoint / 14 resource prefix / 8 UC cover` 를 실측 기반으로 교체한다: endpoint 는 **표 행 72** 이되 그 중 `conceptual placeholder` 2 행 (`GET /api/me/permission-denied` · `GET /api/admin/permission-denied`) 은 미구현이라는 사실을 같은 문장에서 **한 절로 명시** (예: `72 endpoint 행 (그 중 conceptual placeholder 2 행은 미구현 — shipped 기준 70)`). prefix 는 **16**, UC cover 는 **8 그대로 불변** (UC-01~UC-08 변동 없음). `약` 같은 어림 표현은 제거한다 — 본 문장은 이제 grep 으로 검증 가능한 수치다.
- [ ] **prefix 16 의 근거 절 append** — 153 행 괄호 안 history 의 **맨 끝** 에 세미콜론으로 이어 붙여 한 절을 추가한다: T-1306 재집계로 `/api/assessment-collection` (T-0271~T-0275, ADR-0031) 과 `/api/assessment-evaluation` (T-0293, ADR-0032) 두 prefix 가 누계에 미반영이었음을 바로잡아 **prefix 14 → 16**, endpoint 표기는 **56 → 72** (T-1304/T-1305 의 UC-07 9 행 신설분 포함, 표기 지연분 일괄 흡수) 라는 사실. 기존 history 절 문장은 **0 수정** — append 만.
- [ ] **재집계 규칙 각주 1 줄 신설** — 153 행과 155 행 사이에 각주 단락 1 개를 새로 넣어 **집계 규칙 3 항** 을 박제한다: (1) endpoint 1 개 = §5 표 안 첫 셀이 METHOD 인 행 1 개 — 재집계 명령은 `grep -cE '^\| (GET|POST|PATCH|PUT|DELETE) \|' docs/architecture/api.md`; (2) 그룹 헤더 행 (첫 셀 `**...**`, 현재 12 행) 은 endpoint 가 아니며 prefix 는 그 헤더가 선언하는 path prefix 기준으로 센다 (한 헤더가 2~3 prefix 를 묶는 경우 있음 — UC-04 헤더가 `/api/auth` + `/api/users` 를 묶는 식); (3) `conceptual placeholder` 로 표시된 미구현 행은 표 행 수에는 포함하되 shipped 수에서는 제외 표기. **이 각주가 본 task 의 재발 방지 장치** — 다음 endpoint 신설 task 는 이 명령 1 줄로 합계를 동기하면 된다.
- [ ] **표 무결 · 다른 행 0 수정** — §5 표 (66~151 행) 의 어떤 행도 신설·삭제·수정하지 않는다. 편집 후 `grep -cE '^\| (GET|POST|PATCH|PUT|DELETE) \|' docs/architecture/api.md` 가 편집 전과 **동일한 값** 이어야 한다 (본 task 는 표를 건드리지 않으므로).
- [ ] **grep 대조 3 종 통과** (R-110/R-112 면제의 대체 검증):
  1. `grep -n "합계" docs/architecture/api.md` 결과 행에 `56` 과 `14 resource prefix` 문자열이 **더 이상 없고**, 실측 endpoint 수 (72) 와 `16` 이 있다.
  2. `grep -c "grep -cE" docs/architecture/api.md` ≥ 1 — 신설 각주에 재집계 명령이 박제됐다.
  3. 신설 각주에 적은 그룹 헤더 수 (12) 가 실제와 일치 — §5 표 범위 (66~151 행) 안에서 첫 셀이 `**` 로 시작하는 행을 세어 대조 (§4 auth tier 표 · §6 status code 표의 bold 행은 §5 밖이라 제외해야 한다 — 파일 전체 `grep -cE '^\| \*\*'` 는 25 가 나오므로 그 값을 그대로 쓰면 오답).
- [ ] **R-110/R-112 면제 근거 명시** — 본 task 는 코드 0 LOC / test 0 건이라 tester 호출 불요. 위 grep 3 종 결과를 commit body trail 의 `notes` 에 1~2 줄로 박제 (§11 길이 제한 준수).
- [ ] **direct commit 절차** — main 에서 `git push HEAD:main` (feature branch · PR 생성 0, [LOOP.md](../LOOP.md) §4 push source/target 매칭). commit subject 는 `docs(api): …(T-1306)` 형태.
- [ ] **언어 규율 (§12)** — 문서 본문 · commit 본문은 한국어, route · 명령어 · 타입명 · enum 값은 영어 그대로.

## Out of Scope

- **코드 · test 수정 0** — `src/**`, `test/**` 어느 파일도 건드리지 않는다 (§3.1 rule 3 — 섞으면 direct/pr 혼합 위반).
- **집계 자동화 script · CI step 신설 0** — 본 task 는 각주에 **명령 문자열만** 박제한다. `scripts/` 신설이나 `scripts/daily-test.sh` leg 추가는 금지 — leg 추가는 drift-guard smoke spec 3 종 (T-0791/T-0944/T-0947) 동반 수정으로 6 파일이 되어 5 파일 cap 이 깨진 Q-0054 선례가 있다. 자동화가 필요하다고 판단되면 Follow-ups 에만 적는다.
- **§5 표 행 신설·수정 0** — 미문서화 endpoint 가 더 보이더라도 본 task 에서 행을 추가하지 않는다 (Follow-ups 로). 본 task 는 **합계 문장과 각주 2 곳** 만 만진다.
- **conceptual placeholder 2 행의 구현·삭제 판단 0** — `/api/me/permission-denied` · `/api/admin/permission-denied` 를 표에서 뺄지 구현할지는 제품 판단 (Follow-ups). 본 task 는 **현재 사실을 세는 방식만** 정한다.
- **§7 traceability 표 (179~192 행) 수정 0** — 합계와 무관하다.
- **다른 문서 동기 0** — `docs/architecture/modules.md` · `directory.md` · `PLAN.md` 의 endpoint 수 언급이 있더라도 본 task 범위 밖 (Follow-ups).
- **기존 history 절 재서술 0** — 153 행 괄호 안 `T-NNNN 박제로 ...` 절들은 과거 기록이라 손대지 않는다. 리드 수치 교정 + 말미 append 만.

## Suggested Sub-agents

`implementer` (doc-only — tester 미호출, R-110 면제 근거는 Acceptance Criteria 에 명시)

## Follow-ups

- (본 task 발 가능) 다른 문서 (`docs/architecture/modules.md` · `directory.md` · `docs/PLAN.md`) 에 남아 있는 endpoint 수 언급의 동일 drift 점검 — 존재 여부부터 grep 으로 확인 후 slice 판단.
- (본 task 발 가능) `conceptual placeholder` 2 행 (`GET /api/me/permission-denied` · `GET /api/admin/permission-denied`) 의 처분 — 구현할지 표에서 제거하고 `/api/permission-denied-records` 로 일원화할지 제품 판단 대상.
- (T-1304 이월) UC-07 §5 mermaid sequence 에 preview step (import dry-run + export scope preview) 반영 — autonumber 재정렬 동반이라 별도 slice.
- (T-1305 이월) export preview 2 종 (`describe-scope` · `preview-selection`) 의 잘못된 scope 조합이 **500** 으로 나가는 현재 동작의 4xx 매핑 여부 판단 — 사용자 대면 status 결정이라 제품 판단 대상 (T-1291 이월 `RangeError` 항목과 함께 묶어 처리 가능).
- (유지) **부분 dump + REPLACE 의 비선별 entity 삭제** — "Group 만 담긴 파일" 을 REPLACE 로 올리면 Person·Assessment 까지 증발한다. preview + mode echo 로 실행 전 정보는 갖춰졌으나 차단/경고 여부는 제품 결정 — 사람 판단 대상.
- (유지, 3c-3d3) 크기 상한 413 e2e — 50 MiB 초과 업로드. supertest 의 multer mid-stream abort 표면화를 먼저 국소 확인 후 flaky 하면 포기 선택지를 planner 에 보고.
- (T-1290 round 1 MINOR A 이월) `ExportSelection` 의 `selected` / `excluded` 를 `readonly TRecord[]` 로 좁혀 배열 공변 unsoundness 를 닫는 slice — 소비처 4 곳 동반 수정 필요.
- (T-1291 이월) `selectExportRecords` 의 `RangeError` (손상 job row) 가 download 경로에서 **500** 으로 나간다 — 사용자 대면 status (409/422) 매핑 여부 판단 필요.
- (미해결 정책, T-1287 이월) `LlmProviderConfig` 왕복 불가 — export 가 `apiKey` 를 제외 (ADR-0047 secret deny) 하는데 schema 의 `apiKey` 는 not-null 이라 복원 `$transaction` 이 통째로 실패할 것으로 예상. **secret 처리 결정이라 §5 사람 결정 대상**.
- (관측, 이월) UC-07 §8 (b)(e) 의 Export / Import Audit log row 영속화 0 — 범용 `AuditLog` model 부재. schema migration 이라 §5 사람 결정 대상.
