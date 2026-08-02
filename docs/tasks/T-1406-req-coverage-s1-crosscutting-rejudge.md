---
id: T-1406
title: REQ-COVERAGE-AUDIT §12.5 S1 실판정 — cross-cutting 4 row (REQ-002 · 003 · 029 · 047) 재판정을 §12.6 으로 박제
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-001]
estimatedDiff: 160
estimatedFiles: 2
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1405]
touchesFiles:
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1406-req-coverage-s1-crosscutting-rejudge.md
plannerNote: "uc-doc-audit-resync 18 번째 slice — T-1405 §12.5 가 정의한 S1 (cross-cutting 4) 실판정 첫 집행, §12.6 append + cascade in-place, direct doc-only"
---

# T-1406 — S1 실판정: cross-cutting 4 row 재판정

## Why

[T-1405](T-1405-req-coverage-matrix-rejudge-scope-design.md) 가 `docs/use-cases/REQ-COVERAGE-AUDIT.md` 에 **§12 (251 ~ 324 행)** 를 신설해 유일 잔여 축 (`§3 매트릭스 66 row 분류 자체의 재판정`) 의 범위 (후보 **17 row**) · 판정 기준 (근거 3 종 + 2/3 임계) · cascade 6 지점 · 원자성 규약 · 3 slice 분할안 (S1 4 / S2 7 / S3 6) 을 박제했으나 **판정은 0 건** 이었다. 본 slice 는 그 설계의 **첫 집행 slice = S1** 으로, §12.5 표가 S1 에 배정한 **cross-cutting 전건 4 row (REQ-002 · 003 · 029 · 047 — §3 36 · 37 · 63 · 81 행)** 를 §12.2 기준으로 실판정한다.

S1 을 먼저 하는 이유는 §12.5 표가 근거 (iii) 대상이 architecture doc 3 종 + ADR-0002 라 **row 당 비용이 최대** 라고 산정했고, S1 · S2 는 서로 독립이라 순서가 무관한 반면 **S3 만 반드시 마지막** (L212 closure 가 앞 두 slice 결과를 인용) 이기 때문이다. 본 slice 는 L212 잔여 축 문구를 닫지 않는다 — 그것은 S3 소관이다.

## Required Reading

- `docs/use-cases/REQ-COVERAGE-AUDIT.md` **251 ~ 324 행 (§12 전체)** — 본 slice 의 집행 규약 정본. 특히 **§12.2 (276 ~ 290 행)** 의 근거 3 종 표 + **2 종 이상 어긋날 때만 분류 변경 · 1 종이면 `기록만`** 임계, **§12.3 (292 ~ 305 행)** cascade 6 지점 표와 각 지점의 현재 값 · 트리거 조건, **§12.4 (307 ~ 312 행)** 의 `(a) ~ (d) 원자 · (e) · (f) 분리 허용` 규약, **§12.5 (314 ~ 324 행)** 의 S1 행. 이 4 개 소절이 본 slice 의 판정·cascade 를 전부 규정한다.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` **20 ~ 27 행 (§2 분류 정책)** — 4 enum 정의. **재정의 금지 · 참조만**. 특히 24 행 "UC envelope 안에 있으면 uc-covered" 와 25 행 "다수 UC 가 공유하는 횡단 관심사 · 단일 UC 의 coversReq 에 박제하기 부적합" 의 경계가 본 slice 판정의 핵심 축이다. **read-only**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` **36 · 37 · 63 · 81 행 (판정 대상 4 row)** — REQ-002 (FR / components.md Web UI + modules.md WebModule) · REQ-003 (FR / UC-01 생성 + UC-02 표시) · REQ-029 (NFR / ADR-0002 + components.md DB Persistence) · REQ-047 (NFR / deployment.md §REQ-047 + P7 perf test). 5 컬럼 셀 값 전체.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` **106 ~ 117 행 (§4)** · **119 ~ 127 행 (§5)** — cascade (b) · (c) · (d) 의 현재 값. **107 행이 UC-02 bullet 의 `envelope-cover: REQ-003 (표시)` 를 이미 나열** 하고 있고 **124 행 §5 비고 셀이 4 건 ID 를 열거** 한다 — 판정 시 반드시 대조할 지점.
- `docs/requirements.md` **21 · 22 · 48 · 66 행** — 근거 (iii) 원문. **kind 컬럼과 지시 원문 컬럼만** 보면 된다 — REQ-003 (22 행) · REQ-047 (66 행) 의 status 서술은 수천 자 규모라 **통독 금지**, 필요 시 앞 200 자만 참고.
- `docs/architecture/components.md` · `docs/architecture/modules.md` · `docs/architecture/deployment.md` · `docs/decisions/ADR-0002-db.md` — 근거 (iii) 의 "지목 파일이 실재하며 그 REQ 를 실제로 다루는지" 확인용. **전문 통독 금지** — 각 파일에 `grep -n "REQ-002\|REQ-003\|REQ-029\|REQ-047"` 1 회 + hit 주변 절 제목만 확인한다. **read-only**.
- `docs/use-cases/UC-02-assessment-view.md` frontmatter — REQ-003 의 근거 (i) 확인용 (`coversReq` / `adjacentReq` 에 REQ-003 이 있는지). 8 UC 전수 확인은 `grep -n "REQ-002\|REQ-003\|REQ-029\|REQ-047" docs/use-cases/UC-0*.md` **1 회** 로 갈음한다. **read-only**.

## Acceptance Criteria

- [ ] **삽입 위치·형식 (선행 항목)** — 판정 기록을 `### 12.6 S1 실판정 — cross-cutting 4 row (T-1406)` 로 **§12.5 마지막 행 (현 324 행) 뒤, `## 11. References` (현 326 행) 앞** 에 삽입한다. `###` 이므로 `## ` heading count 는 불변이다. 이 위치 제약과 근거 (325 행 이전 행 번호 전건 불변 → L212 · 115 행 참조 보호) 를 완료 기록 첫머리에 2 줄 이내로 박제한다.
- [ ] **(1) row 별 근거 3 종 실측** — REQ-002 · 003 · 029 · 047 **각각** 에 대해 §12.2 표의 근거 (i) UC frontmatter · (ii) UC 본문 §5 / §6 / §8 hit · (iii) `docs/requirements.md` 원문 + cover 위치 셀 실재 를 실측하고, row 당 **(i) / (ii) / (iii) 각 1 줄 + 어긋남 여부 (일치 / 어긋남)** 를 §12.6 안에 표 또는 bullet 으로 적는다. 실측에 쓴 grep 명령은 **row 별이 아니라 축별로 묶어 총 4 회 이내** 로 제한하고 명령 원문을 박제한다 (context 보호).
- [ ] **(2) 임계 적용 + 분류 판정** — row 마다 어긋남 종수를 세어 §12.2 임계를 기계적으로 적용한다: **2 종 이상 → 분류 변경**, **1 종 → `기록만` (분류 무수정)**, **0 종 → 무수정**. 각 row 의 최종 판정을 `유지` / `기록만` / `변경 (X → Y)` 중 하나로 명시하고 **어긋남 종수를 숫자로** 병기한다. 임계를 벗어난 재량 판정 금지 — 판단이 갈리면 보수적으로 `유지` 또는 `기록만` 을 택하고 그 이유를 1 줄 적는다.
- [ ] **(3) REQ-003 주의 지점 명시 판정** — §3 37 행은 REQ-003 을 `cross-cutting` 으로, §4 **107 행** 은 같은 REQ 를 UC-02 의 `envelope-cover: REQ-003 (표시)` 로 이미 나열한다. 이 두 서술의 관계 (모순인가, §2 24 행 · 25 행 경계 안에서 양립하는가) 를 **명시적으로 1 개 판정** 으로 적는다. 근거 3 종 임계를 그대로 적용하며, 양립으로 판정하면 그 근거를 (T-1395 가 §4 117 행 blockquote 에서 쓴 "나열 기준 차이 ≠ 모순" 화법과 동형으로) 2 줄 이내로 적는다.
- [ ] **(4) cascade 집행 또는 미발동 명시** — 4 row 판정 결과 **분류값 변경이 0 건이면** §12.3 6 지점 전부 미발동임을 `cascade (a) ~ (f) 발동 대상 없음` 한 줄로 박제한다 (T-1400 ~ T-1403 선례 화법). **1 건이라도 변경되면** §12.4 원자성 규약대로 **(a) → (b) → (c) → (d) 를 본 slice 안에서 함께** 갱신하고, (e) INDEX.md 110 행 · (f) PLAN.md 36 행 은 건드리지 않은 채 Follow-ups 에 남긴다. cascade 편집은 **in-place 셀·수치 치환만** 허용 — 행 삽입·삭제 금지 (행 번호 invariant 보호). 갱신한 지점 목록과 before → after 값을 표로 박제한다.
- [ ] **(5) cascade 7 번째 지점 기록** — cascade (c) 의 `15` 항 (envelope 잔차) 이 움직이면 §4 **117 행 blockquote** 의 `15` · `13` · `차이 2 건` 서술도 stale 해진다. 이 사실을 §12.6 안에 **cascade 7 번째 후보 지점 발견** 으로 1 ~ 2 줄 기록한다. **§12.3 표 자체는 수정 금지** (append-only 규약 — 표에 row 를 끼우면 §12.4 · §12.5 행 번호가 밀린다). 본 slice 에서 15 항이 실제로 움직였다면 117 행도 (c) 의 부속으로 같이 in-place 갱신하고 그 사실을 명시한다.
- [ ] **(6) S1 종합 판정 + 잔여 명시** — §12.6 말미에 S1 4 row 의 판정 분포 (`유지 N / 기록만 N / 변경 N`) 를 한 줄로 요약하고, **후보 17 중 4 완료 · 잔여 13 (S2 7 + S3 6)** 임을 명시한다. **L212 잔여 축 문구는 건드리지 않는다** — closure 는 S3 소관임을 1 줄로 못박는다.
- [ ] **불변 검산 6 값** — 편집 후 실측해 완료 기록에 표로 적는다: (a) `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` = **66** 불변, (b) `grep -c "^## "` = **12** 불변 (`###` 추가이므로), (c) `grep -n "미검증 축"` 첫 hit = **212** 불변 · 총 hit **10** 불변, (d) `grep -c "212 행"` = **9** 불변 (§12.6 본문은 `L212` 회피 표기를 쓴다 — T-1405 선례), (e) `sed -n '115p'` 의 정합식이 **여전히 115 행** 이며 합이 **66**, (f) §5 표 (121 ~ 127 행) 의 count 4 값 합계가 **66** · percentage 합계가 **100 %**. cascade 가 발동해 (e) · (f) 의 내부 값이 바뀐 경우 **바뀐 값과 재검산 결과** 를 적되 합계 66 · 100 % 는 반드시 유지한다.
- [ ] **hunk 국한 검증 (R-112 대체, doc-only)** — 코드 변경 0 이므로 unit test 대신 `git diff -U0 docs/use-cases/REQ-COVERAGE-AUDIT.md | grep '^@@'` 의 hunk 헤더 전량을 박제한다. cascade 미발동이면 hunk 는 **삽입 1 개뿐** (`@@ -324,0 +325,N @@` 형태) 이고 1 ~ 324 행 hunk **0** · `git diff --numstat` 삭제 열 **0** 이어야 한다. cascade 발동 시에는 추가 hunk 가 **전부 1:1 치환** (`-N` 과 `+N` 이 같은 행 수) 임을 numstat 과 hunk 헤더로 보인다. `git status --porcelain` 이 위 `touchesFiles` 2 개 외 변경 파일 **0** 임도 적는다. 표 row 를 치환한 경우 그 row 의 **`|` 필드 수가 편집 전후 동일 (5 컬럼 → 파이프 6 개)** 임을 실측해 박제한다 ([T-1370](T-1370-requirements-fork-rebase-dedup-status-rejudge.md) · [T-1375](T-1375-requirements-org-document-contribution-score-status-rejudge.md) 표 파손 사고 재발 방지).
- [ ] **한계 명시** — 완료 기록에 "한계 —" 절을 두고 최소 4 건을 열거한다: (1) S2 · S3 13 row 미판정, (2) INDEX.md 110 행 · PLAN.md 36 행 미동기 (cascade (e) · (f) 는 Follow-up 소관), (3) 표기 비일관 3 건 (§3 83 행 `(cover)` · 79 행 `(인접)` · UC §10 표 `§5 step N` 편차) 미정정, (4) 근거 (iii) 의 architecture doc 확인은 `grep` hit + 절 제목 수준의 정적 실측이라 그 문서가 REQ 를 **충분히** 다루는지의 질적 평가는 하지 않았다.

## Out of Scope

- **§3 매트릭스에서 REQ-002 · 003 · 029 · 047 이외 row 의 어떤 셀 수정** — 금지. S2 · S3 배정 13 row 를 미리 판정하지 않는다.
- **L212 (§10 잔여 축 bullet) 문구 수정** — 금지. `유일 잔여 축` closure 는 S3 소관이다.
- **§12.1 ~ §12.5 (251 ~ 324 행) 의 어떤 행 수정** — 금지. 본 slice 산출물은 §12.6 append 1 지점 (+ 발동 시 cascade in-place 치환) 뿐이다. cascade 7 번째 지점도 §12.3 표가 아니라 §12.6 본문에 기록한다.
- **§9 · §10 의 어떤 행 수정 · §10 말미 bullet append** — 금지 (append-only 규약상 각 시점 판정 보존, §12.3 305 행이 명시).
- **`docs/use-cases/INDEX.md` 110 행 · `docs/PLAN.md` 36 행 동기화** — 금지 (cascade (e) · (f), T-1404 Follow-up 3 소관).
- **`docs/use-cases/UC-0*.md` · `docs/requirements.md` · `docs/architecture/*` · `docs/decisions/*` · `src/` · `web/` 수정** — 전부 read-only.
- **§2 4 enum 재정의 · 새 분류값 신설** — 금지 (§12.2 가 참조만 허용).
- **새 ADR 신설 · `docs/architecture/*` 신규 파일 추가** — 금지 (commitMode 가 pr 로 바뀌어 본 slice 판정과 충돌).
- **References (§11) 항목 추가 · Refs 줄 변경** — 금지.

## Suggested Sub-agents

`implementer` (근거 3 종 축별 grep ≤ 4 회 → row 4 건 임계 판정 → §12.6 append → cascade 발동 시 in-place 치환 → 불변 6 값 · hunk · 파이프 필드 수 검산) → 별도 tester 불요 (direct doc-only, R-110 면제 — 코드 변경 0). 단 실측 grep 명령과 hunk / numstat 출력은 반드시 완료 기록에 박제한다.

## Follow-ups

1. **S2 실판정 slice** — infrastructure 7 (REQ-001 · 017 · 056 ~ 060) 재판정. 본 slice 와 동형으로 §12.7 append + cascade 는 §12.3 · §12.4 그대로. S1 · S2 는 독립이라 선후 무관.
2. **cascade 7 번째 지점의 §12.3 표 반영** — §4 117 행 blockquote 가 (c) `15` 항의 부속임을 본 slice 가 §12.6 본문에 기록했으나 §12.3 표에는 넣지 못했다 (append-only 행 번호 invariant). S3 이후 행 번호 제약이 풀리는 시점의 정리 후보.
3. **cover 위치 셀 종류 규약 정리 (선택)** — REQ-003 의 `기록만` 사유 (cross-cutting 의 cover 위치가 architecture doc / ADR 이 아니라 UC 2 개) 가 §2 25 행 문구의 예시 범위 문제인지 실제 표기 오류인지는 §2 를 건드려야 결론난다. 분류값과 무관하므로 S1 ~ S3 와 독립.

## 완료 기록 (2026-08-03)

**삽입 위치 제약 (선행 항목)** — 판정 기록을 `### 12.6 S1 실판정 — cross-cutting 4 row (T-1406)` 로 **§12.5 마지막 행 (구 324 행) 뒤 · `## 11. References` (구 326 행) 앞** 에만 삽입했고 `###` 이라 `## ` heading count 는 12 그대로다. 근거: 325 행 이전 행 번호가 전건 불변이어야 §10 의 L212 잔여 축 bullet 참조와 §4 115 행 정합식 참조가 깨지지 않는다.

**(1) row 별 근거 3 종 실측** — 축별 grep 4 회 (row 별 아님) 로 갈음했다:

```
$ grep -n "REQ-002\|REQ-003\|REQ-029\|REQ-047" docs/use-cases/UC-0*.md                                   # (i) + (ii) → hit 0
$ grep -n "REQ-002\|REQ-003\|REQ-029\|REQ-047" docs/architecture/components.md docs/architecture/modules.md docs/architecture/deployment.md docs/decisions/ADR-0002-db.md   # (iii) 지목 doc
$ grep -n "Web UI\|WebModule\|DB Persistence" docs/architecture/components.md docs/architecture/modules.md   # ID hit 0 인 REQ-002 · 029 의 지목 대상 실재
$ awk 'NR==21||NR==22||NR==48||NR==66' docs/requirements.md                                               # (iii) 원문 kind
```

핵심 실측: 8 UC 전건에서 4 REQ 의 ID hit **0** (→ (i) · (ii) 는 4 row 전건이 `cross-cutting` 과 일치), components.md 113 · 116 행 (`Web UI` · `DB Persistence`) · modules.md 43 · 196 행 (`WebModule`) · deployment.md 67 행 (`### REQ-047 (1 h 처리) 충족 시나리오`) · ADR-0002 27 · 61 행 (REQ-029) 전부 실재, requirements.md kind 4 값 (`FR` / `FR` / `NFR` / `NFR`) 이 §3 셀과 전건 일치.

**(2) 임계 적용 + 분류 판정** — §12.2 288 행 임계 기계 적용: REQ-002 **어긋남 0 → 유지**, REQ-003 **1 → 기록만** (cover 위치 셀이 UC 2 개를 지목 — §2 25 행 예시 장소 밖 표기 경계), REQ-029 **0 → 유지**, REQ-047 **0 → 유지**. 변경 **0 건**. requirements.md status 컬럼 (`IN_PROGRESS` / `DONE` / `PLANNED`) 은 구현 진척 축이라 분류 전이 근거로 쓰지 않았다.

**(3) REQ-003 주의 지점 판정** — §3 37 행 `cross-cutting` 과 §4 107 행 `envelope-cover: REQ-003 (표시)` 는 **모순 아님 — 양립** 으로 1 개 판정을 박제했다. §4 는 UC → REQ 역방향 view (그 UC 가 덮는 부분), §3 은 REQ → cover 정방향 view (REQ 전체를 무엇이 덮는가) 라 나열 기준이 다르며 (T-1395 의 §4 117 행 화법과 동형), REQ-003 3 축 중 UC-02 envelope 안은 표시 축뿐이라 단일 UC 로 전체가 덮이지 않는 것이 곧 §2 25 행 요건이다. 이 축 어긋남 **0** → 무수정.

**(4) cascade 집행 여부** — 분류값 변경 0 건이라 **`cascade (a) ~ (f) 발동 대상 없음`** 을 §12.6 에 박제했다 (T-1400 ~ T-1403 선례 화법). §3 · §4 106 ~ 117 행 · §5 121 ~ 127 행 어느 셀도 치환하지 않았고 INDEX.md · PLAN.md 도 열지 않았다.

**(5) cascade 7 번째 지점** — (c) `15` 항이 움직이면 §4 117 행 blockquote 의 `15` · `13` · `차이 2 건` 도 stale 해진다는 사실을 §12.6 에 **후보 지점 발견 (본 slice 미발동)** 으로 기록했다. §12.3 표는 append-only 규약대로 무수정이며, 본 slice 는 `15` 항 무변이라 117 행도 무수정이다.

**(6) S1 종합 + 잔여** — **유지 3 / 기록만 1 / 변경 0**, 후보 **17 중 4 완료 · 잔여 13** (S2 7 + S3 6). §10 잔여 축 bullet (L212) 문구는 손대지 않았고 closure 가 S3 소관임을 §12.6 말미에 명시했다.

**불변 검산 6 값** (편집 후 실측, 괄호 안이 요구치):

| # | 항목 | 값 |
| --- | --- | --- |
| (a) | `grep -c "^\| REQ-"` | **66** (66 불변) |
| (b) | `grep -c "^## "` | **12** (12 불변 — `###` 추가) |
| (c) | `grep -n "미검증 축"` 첫 hit / 총 hit | **212** / **10** (212 / 10 불변) |
| (d) | `grep -c "212 행"` | **9** (9 불변) |
| (e) | `sed -n '115p'` | `33 + 15 + 4 + 13 + 1 = 66` 이 **여전히 115 행**, 합 **66** |
| (f) | §5 표 (121 ~ 127 행) | count `48 / 4 / 13 / 1` = **66** · 합계 row `**66**` · `**100 %**` 불변 |

(c) · (d) 불변은 §12.6 본문이 두 검산 대상 문자열을 쓰지 않고 회피 표기 (`L212` · `잔여 축`) 를 쓴 T-1405 선례 승계 결과다.

**hunk 국한 검증 (R-112 대체, doc-only)** — 코드 변경 0. hunk 헤더 전량:

```
$ git diff -U0 docs/use-cases/REQ-COVERAGE-AUDIT.md | grep '^@@'
@@ -325,0 +326,85 @@
$ git diff --numstat
85      0       docs/use-cases/REQ-COVERAGE-AUDIT.md
```

삽입 hunk **1 개뿐** · 1 ~ 325 행 hunk **0** · 삭제 열 **0**. (AC 가 예시한 `@@ -324,0 +325,N @@` 대비 anchor 가 1 행 뒤인 것은 삽입 블록이 빈 줄로 시작해 git 이 기존 325 행 빈 줄 뒤로 정렬했기 때문이며, §12.5 와 §11 사이 삽입이라는 사실은 동일하다.) 표 row 치환 **0 건** 이라 `|` 필드 수 변화 대상 자체가 없다 (§3 매트릭스 66 row 및 §5 표 전건 무수정 — (a) · (f) 검산이 이를 이중 확인). `git status --porcelain` 은 `docs/use-cases/REQ-COVERAGE-AUDIT.md` + 본 task 파일 **2 개** 외 변경 0.

**한계** — (1) S2 · S3 배정 13 row 미판정, (2) cascade (e) INDEX.md 110 행 · (f) PLAN.md 36 행 미동기 (분류 변경 0 이라 불요였으나 정합 확인도 미수행), (3) 표기 비일관 3 건 (§3 83 행 `(cover)` · 79 행 `(인접)` · UC §10 표 `§5 step N` 편차) 미정정, (4) 근거 (iii) 의 architecture doc 확인은 grep hit + 절 제목 / 표 row 실재 수준의 정적 실측이라 그 문서가 REQ 를 **충분히** 다루는지의 질적 평가는 하지 않았다.
