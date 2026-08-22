---
id: T-1650
title: 133 로그인 fixture + drift guard 박제를 정본 문서 3 곳에 doc-sync
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-047]
independentStream: r91-load-k6
dependsOn: [T-1648, T-1649]
touchesFiles:
  - docs/ops/realdata-scale-devset.md
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
estimatedDiff: 55
estimatedFiles: 3
created: 2026-08-22
plannerNote: R-91 chain 31/N — T-1649 Follow-ups 의 doc-sync 축: fixture+guard 머지 사실이 정본 3 곳에 0 회 반영 (direct, 3 파일)
---

# T-1650 — 133 로그인 fixture + drift guard 박제를 정본 문서에 반영

## Why

T-1648(main `c95b7dec`, PR #1317)이 실 devset 133 로그인을 기계 판독 fixture(`test/load/realdata-devset-logins.json`) + 검증 로더로 박제했고, T-1649(main `87cdb828`, PR #1318)가 정본 markdown 표 ↔ fixture drift guard 를 신설했다. 그런데 이 두 사실이 **정본 문서 어디에도 0 회 반영돼 있지 않다** — `grep -c "T-1648\|T-1649"` 가 `docs/ops/realdata-scale-devset.md` · `docs/ops/load-resilience-test-plan.md` · `docs/PLAN.md` 셋 다 `0` 이다. 특히 devset 정본 문서를 읽고 표를 고치는 사람이 fixture 동시 갱신 의무를 알 길이 없어, guard 가 `pnpm test` 에서 실패할 때 그 이유를 문서에서 찾지 못한다.

본 slice 는 T-1649 Follow-ups 의 두 번째 축(doc-sync)만 집행한다. 부하계획 `§5` item 5 의 **잔여 ① 실 dataset seed** 는 여전히 잔여지만, 그 축이 "0 진척"이 아니라 "입력 데이터 + 이중 정본 안전장치까지 확보, 잔여는 seed 실행 경로"로 좁혀진 사실을 반영한다. seed 실행 경로 자체(workflow step 또는 k6 setup)는 다음 slice 다.

PLAN `144 행` 오너 지시(R-91 k6 최우선) chain 의 연속이다.

## Required Reading

- [docs/ops/realdata-scale-devset.md](../ops/realdata-scale-devset.md) — `6 행` `## ✅ 규모` 절, `12 행` seed 방식 문단, `14 행` `## A.` 표, `52 행` `## B.` 표, `157 행` `## 재생성(refresh) 명령`. 본 task 가 새 소절을 넣을 위치 후보는 `## 재생성(refresh) 명령` **직전**.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§5` item 5 — `409~413 행` 의 **잔여 ①** 서술(현재 "잔여로 남는 축은 실 dataset seed"), `435~437 행` 의 "본 item 의 잔여는 위 ① … 1 개뿐" 문장. 이 두 곳이 갱신 대상.
- [docs/PLAN.md](../PLAN.md) `141 행` — R-91 성능 검증 하위 bullet. 말미에 진척 한 문장 추가 대상. `140 행` checkbox 는 **`[ ]` 유지**(실 수집 왕복 미검증이므로).
- [test/helpers/realdata-devset-logins.ts](../../test/helpers/realdata-devset-logins.ts) — T-1648 로더의 public symbol 3 종(`parseDevsetLogins` / `loadRealdataDevsetLogins` / `resolveRealdataDevsetLogins`)과 33/100/133 상수. 문서에 적을 사실 확인용(파일 수정 금지).
- [test/helpers/realdata-devset-logins-doc-consistency.ts](../../test/helpers/realdata-devset-logins-doc-consistency.ts) — T-1649 guard 의 public symbol 3 종(`parseDevsetLoginsDoc` / `loadRealdataDevsetLoginsDoc` / `assertDevsetLoginsFixtureMatchesDoc`)과 에러 정책(구조 결손 `TypeError` / 값 정합 위반 `RangeError`). 문서에 적을 사실 확인용(파일 수정 금지).
- [docs/progress/journal-2026-08-22.md](../progress/journal-2026-08-22.md) 의 T-1648 · T-1649 fire 항목 — 머지 commit sha · PR 번호 · test 수의 1 차 출처.

## Acceptance Criteria

- [ ] `docs/ops/realdata-scale-devset.md` 에 **소절 1 개 신설**(`## 재생성(refresh) 명령` 직전, 제목은 `## 기계 판독 사본 · drift guard` 류) — 다음 3 사실을 담는다:
  - `§A` 33 명 + `§B` 100 명 = 133 로그인의 기계 판독 사본이 `test/load/realdata-devset-logins.json` 에 있고, 로더는 `test/helpers/realdata-devset-logins.ts`(T-1648, main `c95b7dec`, PR #1317)라는 것.
  - `test/helpers/realdata-devset-logins-doc-consistency.ts`(T-1649, main `87cdb828`, PR #1318)가 **본 문서의 `§A`/`§B` 표를 직접 파싱해** fixture 와 대조하며, colocated spec 이 `pnpm test` 에서 돌아 CI 게이트에 걸린다는 것.
  - **편집 규칙 한 줄** — 본 문서의 표를 고치면 fixture JSON 도 같은 commit 에서 고쳐야 하고, 안 하면 `pnpm test` 가 실패한다는 것.
- [ ] `docs/ops/load-resilience-test-plan.md` `§5` item 5 의 **잔여 ①** 서술 갱신 — "실 dataset seed" 축이 (a) 입력 데이터(133 로그인 fixture) 와 (b) 이중 정본 drift guard 까지 확보됐고 **잔여는 seed 실행 경로**(133 `Person` + 각자 github `ServiceIdentity` 적재 → 실 수집 왕복)임을 T-1648 · T-1649 의 commit sha · PR 번호와 함께 명시. 잔여 ① 자체는 **해소로 표기하지 않는다**(seed 실행 0).
- [ ] 같은 item 5 의 "본 item 의 잔여는 위 ① … 1 개뿐" 문장이 위 갱신과 모순되지 않게 정합(잔여 개수 1 개는 유지, 그 내용이 좁혀졌음을 반영).
- [ ] `docs/PLAN.md` `141 행` 말미에 fixture + guard 박제 사실 한 문장 추가. `140 행` checkbox 는 `[ ]` 유지(변경 금지).
- [ ] **수치 · 임계 무변경 검증** — `§3` 표의 임계 숫자(p95 ≤ 900ms · error rate < 1%), `§3.1` 1~6 회차 실측 기록, ADR-0057 `D4` 외삽 산식 서술은 **문자 그대로 보존**. `git diff` 로 해당 영역 변경 0 확인.
- [ ] **코드 · 데이터 무변경 검증** — `git diff --name-only` 결과가 위 3 개 `docs/` 파일뿐이고 `src/` · `test/` · `.github/workflows/` · `package.json` · `test/load/realdata-devset-logins.json` 변경이 0 인지 확인.
- [ ] 문서에 적은 commit sha · PR 번호 · symbol 이름이 실제와 일치하는지 대조(`git log --oneline | grep -E "c95b7dec|87cdb828"`, Required Reading 의 helper 파일 export 목록).

분기 없음 · 코드 변경 0 — 본 task 는 `commitMode: direct` doc-only 이므로 CLAUDE.md `§3.2` R-112 의 unit test 4 항목은 적용 대상이 아니다(생산 코드 심볼 추가 0). 기존 guard spec 이 이미 fixture ↔ 문서 정합을 CI 에서 강제하고 있고, 본 task 는 그 표 자체를 건드리지 않으므로 회귀 위험도 0 이다.

## Out of Scope

- seed 실행 경로 구현(workflow step · k6 `setup()` · seed 스크립트) — 다음 slice.
- `test/load/realdata-devset-logins.json` 의 로그인 가감 · 재정렬 · 수치 수정.
- `test/helpers/realdata-devset-logins*.ts` 및 그 spec 수정.
- `§3` 표 임계 숫자 재산정, `§3.1` 회차 기록 추가(새 k6 run dispatch 금지).
- `docs/PLAN.md` `140 행` checkbox flip.
- ADR 신설 · 수정.
- `docs/ops/realdata-scale-devset.md` 의 `§A`/`§B` 표 본문 및 `## 재생성(refresh) 명령` 블록 수정.

## Suggested Sub-agents

`implementer` (doc-only 편집) → 검증은 `git diff` + grep 대조로 자체 수행. tester 미호출(direct doc-only, CLAUDE.md `§3.2` R-110 면제).

## Follow-ups

- seed slice: 133 로그인 fixture 를 소비해 `Person` + github `ServiceIdentity` 를 부하 테스트용 DB 에 적재하는 실행 경로.
- REQ-047 상태 전이 doc-sync(실 수집 왕복 검증 이후).
