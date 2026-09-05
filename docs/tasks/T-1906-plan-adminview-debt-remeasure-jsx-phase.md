---
id: T-1906
title: PLAN 184 행 AdminView 부채 11 차 실측 갱신 — hook 화 6 슬라이스 반영 + 9 축 전량 소진 확정 + 경로 2(JSX 섹션 분해) 전환 지목
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-049]
estimatedDiff: 20
estimatedFiles: 2
independentStream: adminview-god-component-debt
dependsOn: [T-1896]
touchesFiles:
  - docs/PLAN.md
  - docs/tasks/T-1906-plan-adminview-debt-remeasure-jsx-phase.md
created: 2026-09-06
plannerNote: "P5 PLAN 184 행 부채 bullet — hook 6 슬라이스(T-1891~T-1896) 미반영 stale(2,542 vs 실측 2,080) + 잔여 4 축 · 다음 대상 문단 전량 무효"
---

# T-1906 — PLAN 184 행 AdminView 부채 11 차 실측 갱신 + 경로 2 전환 지목

## Why

[docs/PLAN.md](../PLAN.md) `184 행` 의 🔴 오너 지시(2026-08-31) AdminView god component 부채 bullet 이 **직전 갱신([T-1890](T-1890-plan-adminview-debt-remeasure-hook-phase.md), 10 차, head `7011ba98` 실측) 이후 머지된 hook 화 6 슬라이스를 한 건도 반영하지 못한 stale 상태**다. 이 bullet 은 자기 안에 다음 슬라이스의 절단 좌표 · 목적지 · 파일 cap census 모수를 담아 후속 task 를 공급하는 유일한 지점이므로, 좌표가 무효인 채로 두면 다음 추출 슬라이스를 큐잉할 근거가 없다. 갱신 주기 자체가 이 bullet 의 설계(마지막 문장 "분할 진행에 따라 본 bullet 의 실측 LOC 을 갱신하고, 목표선(≤ 2,000 줄) 도달 시 `[x]`")다.

**issue-still-relevant pre-check (origin/main `8d47aa34` 실측)** — 본 갱신은 **미박제**이고, 갱신할 내용은 전부 검증 가능한 실측 drift 다:

- `grep -c "T-1891" docs/PLAN.md` ~ `grep -c "T-1896" docs/PLAN.md` 가 **전부 0** — 머지된 6 슬라이스(T-1891 · T-1892 사용자 관리 축 ⑧, T-1893 파트 축 ⑦, T-1894 · T-1895 인원 축 ②, T-1896 멤버십 축 ①)가 bullet 의 "진척 (2)" 목록에 없다. `useAdminParts` · `useAdminPersons` · `useAdminMemberships` 히트도 각 **0** 이다.
- `wc -l web/src/views/AdminView.tsx` = **2,080 줄**인데 bullet 표기는 **2,542 줄** (직전 실측 대비 **-462**). 선언 수는 bullet 박제 명령(`grep -cE '^(export )?(async )?(function|const|let|type|interface|class|enum) '`)으로 **7 개**인데 표기는 **5 개**다(T-1904 가 `SelectAdminSectionDeps` · `runSelectAdminSection` 을 추가).
- bullet 의 "**9 축 중 5 축 소진, 잔여 4 축**" 인벤토리가 무효다 — prelude 에 `useAdmin*(` 호출이 **9 개 전부**(`useAdminServiceIdentities` · `useAdminPersons` · `useAdminMemberships` · `useAdminLlmProviders` · `useAdminImportExport` · `useAdminSchedule` · `useAdminParts` · `useAdminCollectionTargets` · `useAdminUsers`) 존재하고 `web/src/views/useAdmin*.ts` 가 **9 모듈 + colocated spec 9** 로 실재한다. 잔여 축 좌표(① `430 행` ~ … · ② `465 행` ~ … · ⑦ `1082 행` ~ … · ⑧ `1170 행` ~ `1322 행`)와 "**다음 대상은 인벤토리 ⑧ 사용자 관리 축이며, 반드시 2 슬라이스로 나눈다**" 지목 문단은 T-1891 · T-1892 가 이미 완료해 **통째로 무효**다.
- **국면 전환이 실제로 일어났다** — bullet 이 예측했던 "잔여 4 축을 모두 hook 화하면 그 시점부터 JSX return 이 단일 최대 덩어리가 된다" 가 실현됐다. 현 실측 컴포넌트 본문 `472 행` ~ `1942 행`(1,471 줄) 중 prelude `472 행` ~ `1018 행` = **547 줄**(직전 1,090 → `-543`), JSX return `1019 행` ~ `1941 행` = **923 줄**(직전 907 → `+16`, T-1904 내비 마운트분). 비중이 prelude 55% : JSX 45% 에서 **37% : 63%** 로 역전됐다.
- 목표선까지 잔여가 **`-80 줄`**(2,080 → ≤ 2,000)로, bullet 이 적은 "산술 3 회" 도 무효다. 남은 수단은 bullet 자신이 규정한 **경로 2(JSX 섹션 → 하위 컴포넌트, `sizeExempt` 직행 불가 · cap 안에서 패널 1 개씩)** 뿐이다.
- `grep -c "AdminView 부채" docs/tasks/*.md` 상 동일 의도의 PENDING task 는 **0** 이다(T-1890 은 `status: DONE`).

## Required Reading

- [docs/PLAN.md](../PLAN.md) `184 행` — 갱신 대상 bullet **한 줄 전체**. 특히 (i) 서두 LOC · 선언 수 · 측정 방법, (ii) "진척 (1) … 17 슬라이스(경로 종료)", (iii) "진척 (2) 본문 분해 = prelude 축 → custom hook 5 슬라이스(현 경로)", (iv) "구조 산술" · "본문 내부 분해" · "prelude 내부 구성" 3 문단, (v) "prelude 축 인벤토리 — 9 축 중 5 축 소진, 잔여 4 축", (vi) "순수 추출 3 조건 판정"(경로 1 충족 / 경로 2 미충족), (vii) "파일 cap 주의 — anchor census 방법" (i)~(iv), (viii) 마지막 "**후속**" 지목 문단.
- [docs/tasks/T-1890-plan-adminview-debt-remeasure-hook-phase.md](T-1890-plan-adminview-debt-remeasure-hook-phase.md) `§Acceptance Criteria` · `§Out of Scope` — 직전(10 차) 갱신의 형식 · 범위 선례. 본 task 는 그 형식을 그대로 잇는다.
- [docs/tasks/T-1896-adminview-membership-axis-hook-extract.md](T-1896-adminview-membership-axis-hook-extract.md) `§Follow-ups` — 마지막 hook 슬라이스가 남긴 다음 대상 관찰(있으면 지목 문단에 반영).
- [docs/tasks/T-1891-adminview-users-query-create-hook-extract.md](T-1891-adminview-users-query-create-hook-extract.md) · [T-1892](T-1892-adminview-users-role-access-hook-extract.md) · [T-1893](T-1893-adminview-parts-axis-hook-extract.md) · [T-1894](T-1894-adminview-persons-query-delete-hook-extract.md) · [T-1895](T-1895-adminview-persons-create-update-hook-merge.md) — 각 frontmatter `title` 과 본문의 순 감소 실측치(진척 목록에 건별 `-N 줄` 로 박제할 값의 출처).
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — 좌표 재실측 대상. **본문을 통독하지 말고** 아래 AC 의 측정 명령만 돌려 수치를 얻는다.
- [.claude/agents/planner.md](../../.claude/agents/planner.md) 의 cap-bend 표 "순수 추출 리팩터" 항목 — 경로 1 / 경로 2 판정 문단이 인용하는 (a)(b)(c) 3 조건의 정본.
- [CLAUDE.md](../../CLAUDE.md) `§3`(cap · 소비처 동반 의무) · `§12`(행 범위 표기 R1~R7).

## Acceptance Criteria

- [ ] `docs/PLAN.md` `184 행` bullet 의 **서두 실측치를 갱신**한다 — 제목의 `2,542 줄` 과 본문 "**2,542 줄 · top-level 선언 5 개**(2026-09-04 head `7011ba98` 실측)" 를 `wc -l web/src/views/AdminView.tsx` 와 `grep -cE '^(export )?(async )?(function|const|let|type|interface|class|enum) ' web/src/views/AdminView.tsx` **재실행 결과**(착수 시점 head sha 명기)로 대체하고, 최초 기록(6,087 줄 · 149 개) 대비 누적 감소를 다시 계산해 적는다. **측정 방법 2 문장은 그대로 보존**한다(다음 갱신의 비교 가능성).
- [ ] "**진척 (2)**" 문단에 **머지된 6 슬라이스를 추가**한다 — [T-1891](T-1891-adminview-users-query-create-hook-extract.md) · [T-1892](T-1892-adminview-users-role-access-hook-extract.md)(⑧ 사용자 관리 축 → [useAdminUsers.ts](../../web/src/views/useAdminUsers.ts)) · [T-1893](T-1893-adminview-parts-axis-hook-extract.md)(⑦ 파트 축 → [useAdminParts.ts](../../web/src/views/useAdminParts.ts)) · [T-1894](T-1894-adminview-persons-query-delete-hook-extract.md) · [T-1895](T-1895-adminview-persons-create-update-hook-merge.md)(② 인원 축 → [useAdminPersons.ts](../../web/src/views/useAdminPersons.ts)) · [T-1896](T-1896-adminview-membership-axis-hook-extract.md)(① 그룹 · 멤버십 축 → [useAdminMemberships.ts](../../web/src/views/useAdminMemberships.ts)). 각 건의 순 감소 `-N 줄` 은 **해당 task 파일에서 인용**하고, 기존 5 건과 합쳐 **11 건의 궤적 · 합계 · 건당 평균**을 다시 산술한다(직전 표기 "합 `-908 줄`, 건당 평균 `-182`" 를 11 건 기준으로 대체).
- [ ] "**prelude 축 인벤토리 — 9 축 중 5 축 소진, 잔여 4 축**" 문단을 **9 축 전량 소진**으로 대체한다 — 잔여 4 축(① · ② · ⑦ · ⑧)의 무효 좌표를 삭제하고 목적지 hook 모듈만 남긴다. 소진 확정 근거로 `grep -cE 'useAdmin[A-Za-z]+\(' <prelude>` 결과와 `ls web/src/views/useAdmin*.ts` 의 모듈 수를 명기한다. 즉 **경로 1(prelude 축 → custom hook)은 T-1896 으로 종료**임을 진척 (1) 의 "T-1882 로 종료" 와 같은 형식으로 박제한다.
- [ ] "**구조 산술**" · "**본문 내부 분해**" 두 문단의 좌표를 **재실측값으로 교체**하고, 네 구역 합 + 구분 빈 행 = 실측 LOC 로 **정합 검산 문장을 유지**한다. 구역 경계는 bullet 이 못박은 대로 **빈 행 기준**(`grep -n '^$'`)으로 잡는다. 참고 실측(head `8d47aa34`): 헤더 · import `1 행` ~ `385 행` · 잔여 top-level 타입 · helper `387 행` ~ `467 행` · 컴포넌트(선행 doc 주석 `469 행` ~ `471 행` 포함) `469 행` ~ `1942 행` · 배럴 재수출 `1944 행` ~ `2080 행`, 구분 빈 행 `386 행` · `468 행` · `1943 행` — **착수 시점에 반드시 재확인**한다.
- [ ] "**국면**" 서술을 실측으로 갱신한다 — prelude 대 JSX 비중(참고 실측 547 : 923 = 37% : 63%)을 적고, bullet 이 예측했던 "JSX return 이 단일 최대 덩어리가 된다" 가 **실현됐음**을 명시한다. 목표선(≤ 2,000 줄)까지의 잔여를 다시 계산해(참고 실측 `-80 줄`) "산술 3 회" 문장을 대체한다.
- [ ] "**prelude 내부 구성**" 문단의 4 지표를 bullet 이 박제한 측정 명령(`sed -n '<start>,<end>p' … > /tmp/prelude` 후 `grep -c 'useState'` · `grep -c 'useApiResource'` · `grep -cE 'const handle[A-Z]'` · `grep -cE 'useMemo|useEffect|useCallback'`)으로 **재측정해 교체**한다. prelude 좌표는 이번 갱신 기준으로 다시 잡는다(측정 방법 문장은 보존).
- [ ] 마지막 "**후속**" 지목 문단을 **경로 2(JSX 섹션 → 하위 컴포넌트) 전환**으로 다시 쓴다 — 무효가 된 "다음 대상은 인벤토리 ⑧ 사용자 관리 축이며, 반드시 2 슬라이스로 나눈다" 및 그 분할 근거 · 절단 · 목적지 · 기대 감소 서술을 삭제하고, **JSX return 안의 패널 인벤토리를 실측 좌표로 열거**한다(참고 실측: 루트 `<section aria-label="Admin 관리">` `1020 행`, 내부 패널 앵커 `1330 행` 사용자 관리 · `1458 행` 인원 · `1665 행` 그룹 · `1752 행` 파트 · `1863 행` 수집 대상 — `grep -nE '^\s*<section' web/src/views/AdminView.tsx` 로 재확인). 그중 **다음 1 슬라이스로 뽑을 패널 1 개를 지목**하고 목적지 파일명 · 예상 순 감소 · 예상 파일 수를 적는다.
- [ ] 지목 문단에 **경로 2 의 제약 3 종을 그대로 잇는다** — (1) 순수 추출 3 조건 **미충족**이므로 `sizeExempt` 직행 불가, cap(≤ 300 LOC / ≤ 5 파일) 안에서 진행, (2) 신설 컴포넌트와 AdminView 마운트 배선을 **같은 슬라이스**에 넣어 [CLAUDE.md](../../CLAUDE.md) `§3` 소비처 동반 의무 충족, (3) 파일 cap census 를 `grep -rl "AdminView.tsx" web/src --include=*.test.*` 로 재실행해 `touchesFiles` 에 합산. **census 모수 표기(현 bullet `16 파일`)를 재실행 결과로 갱신**한다(참고 실측 `13 파일`).
- [ ] "순수 추출 3 조건 판정" 문단은 **경로 1 이 종료됐음을 반영**하되(과거형 정리), 경로 2 미충족 판정과 그 근거는 **삭제하지 않고 보존**한다 — 다음 슬라이스의 `sizeExempt` 금지 근거가 이 문단이다.
- [ ] bullet 마커는 `[ ]` 를 **유지**한다 — 실측 LOC 이 목표선 ≤ 2,000 줄에 아직 닿지 않았으면 승격 금지이며, 그 판단 근거(현 LOC 대 목표선)를 한 구절로 명시한다. 재실측 결과가 ≤ 2,000 이면 그때만 `[x]` 로 승격하고 근거를 적는다.
- [ ] `docs/PLAN.md` 의 **다른 행 변경 0** — `git diff --stat` 이 `docs/PLAN.md` 1 파일이고, `git diff -U0 docs/PLAN.md` 의 hunk 가 `184 행` bullet(과 그 줄 하나)에만 걸린다. 다른 bullet · 부채 항목 · 마커 변경 0.
- [ ] `git status --porcelain` 이 `docs/PLAN.md` 와 본 task 파일 **2 개만** 보여준다(코드 · spec · 워크플로 · 다른 문서 변경 0).
- [ ] 신규 · 갱신 문장의 행 범위 표기가 [CLAUDE.md](../../CLAUDE.md) `§12` R1~R7 을 따른다(구분자 `~`, 단일 행은 `184 행`, `L` prefix 0). 기존 표기의 소급 치환은 하지 않는다.
- [ ] 새로 추가한 상대 경로 링크(`tasks/T-1891-…` ~ `tasks/T-1896-…`, `../web/src/views/useAdmin*.ts`)의 대상 파일이 실재함을 확인한다.
- [ ] 분기 없음 · 코드 변경 0 — doc-only `direct` task 이므로 [CLAUDE.md](../../CLAUDE.md) `§3.2` R-112 의 test 항목(happy / error / 분기 / negative / coverage)은 **해당 없음**이고 R-110 tester 면제 대상이다.

## Out of Scope

- 코드 · spec 변경 일체(`web/` · `src/` · `test/` · 워크플로 · `package.json`) — 실제 JSX 패널 추출은 본 갱신이 지목할 **다음 `pr` 슬라이스**의 몫이다.
- 다음 슬라이스 task 파일 생성 — 한 호출 1 task 원칙상 planner 의 다음 turn 소관이다. 본 task 는 **지목까지만** 한다.
- `docs/PLAN.md` 의 다른 bullet(`182 행` 소비처 동반 의무 · `183 행` REQ 재판정 왕복 · `185 행` PLAN 분리 검토 등) 실측 갱신 · 마커 승격.
- `docs/requirements.md` REQ status 재판정 — 본 부채는 REQ 완료 판정 축이 아니고, [CLAUDE.md](../../CLAUDE.md) `§3.1` rule 6 상 구현 슬라이스 머지 후 REQ 당 1 회 원칙에도 걸리지 않는다.
- `docs/architecture/modules.md` `240 행` · `docs/architecture/directory.md` `184 행` 의 `web/src/components/` 개수 표기 drift — [T-1905](T-1905-req080-section-nav-rejudge-plan-promote.md) `§Follow-ups` 가 이미 별도 `direct` slice 로 접어 둔 항목이다.
- AdminView 의 배럴 재수출(`1944 행` ~ `2080 행`, 137 줄) 축소 · import 블록(`1 행` ~ `385 행`) 정리 제안을 새 잔여로 적는 것 — 관측된 상쇄 요인은 이미 bullet 에 서술돼 있고, 새 작업 축 신설은 오너 지시 밖이다.
- 선언 수 최초값 149 의 소급 재측정 · 재해석(bullet 이 이미 "지표일 뿐 동일 방법 비교 아님" 으로 못박았다).

## Suggested Sub-agents

`implementer` (문서 편집만 — `direct` doc-only 라 tester 미호출, [CLAUDE.md](../../CLAUDE.md) `§3.2` R-110 면제)

## Follow-ups

- **JSX 수집 대상 패널 추출 `pr` 슬라이스** — [docs/PLAN.md](../PLAN.md) `184 행` 이 지목한 경로 2 첫 슬라이스. `web/src/views/AdminView.tsx` `1863 행` ~ `1939 행`(77 줄, `<section id={ADMIN_SECTION_COLLECTION_TARGETS_ID}>`)을 신규 `web/src/views/AdminCollectionTargetsSection.tsx` 로 옮기고 AdminView 에 마운트 배선을 같은 슬라이스에 포함한다(`sizeExempt` 금지, 예상 순 감소 `-60 줄`, 예상 3 파일). planner 다음 turn 에서 큐잉.
- **목표선 재역행 관찰** — T-1896 직후 1,998 줄로 목표선 ≤ 2,000 에 닿았으나 T-1901(`+12`) · T-1904(`+70`) 기능 증분이 2,080 으로 되올렸다. 경로 2 로 `-80` 을 회수해도 같은 역행이 반복될 수 있으므로, 승격 판정은 항상 **갱신 시점 실측**으로만 한다(bullet 마지막 문장에 박제).
