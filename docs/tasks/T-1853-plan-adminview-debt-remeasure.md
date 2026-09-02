---
id: T-1853
title: PLAN 183 행 AdminView 부채 bullet 실측 갱신 + 다음 추출 대상 교체
phase: P6
status: PENDING
commitMode: direct
coversReq: []
independentStream: adminview-god-component-refactor
dependsOn: [T-1852]
touchesFiles:
  - docs/PLAN.md
estimatedDiff: 30
estimatedFiles: 1
created: 2026-09-02
ownerDirective: "2026-08-31 오너 지시 (4) — AdminView.tsx god component 부채 추적"
plannerNote: "P6 / PLAN 183 행 부채 bullet 의 T-1852 Follow-up — 실측 LOC · 진척 · 다음 추출 대상 좌표를 head 기준으로 되맞춘다 (direct, doc-only)"
---

# T-1853 — PLAN 183 행 AdminView 부채 bullet 실측 갱신 + 다음 추출 대상 교체

## Why

[T-1852](T-1852-adminview-service-identity-runners-extract.md) `Follow-ups` 가 남긴 유일한 항목이자, [PLAN.md](../PLAN.md) `183 행` bullet 자신이 명시한 의무다 — "분할 진행에 따라 본 bullet 의 실측 LOC 을 갱신하고, 목표선(예: ≤ 2,000 줄) 도달 시 `[x]`". 이 bullet 은 AdminView god component 부채의 **유일한 추적 지점**이므로, 수치와 다음 대상 좌표가 낡으면 다음 planner 가 **이미 안착한 대상을 다시 겨냥**하는 drift 가 난다 (실제로 현재 bullet 의 "1 차 대상 = ServiceIdentity 행별 액션 helper 군 (`2300~2560 행` 5 함수)" 은 이미 3 슬라이스 전에 안착한 문구이고, T-1852 Follow-up 이 적어둔 다음 대상 좌표 `2093~2238 행` 역시 추출 후 head 에서는 사용자 생성 / 인스턴스 접근 블록을 가리키는 **빗나간 좌표**다).

**planner issue-still-relevant pre-check (origin/main `af2abcaf` 실측)** — 미안착이 맞다: ① `git grep -c "6,087" origin/main -- docs/PLAN.md` = `1` (낡은 수치가 그대로 살아있음). ② `git grep -n "2300~2560" origin/main -- docs/PLAN.md` 이 `183 행` 을 그대로 반환 (1 차 대상 문구 미교체). ③ `git log --oneline -5 origin/main -- docs/PLAN.md` 의 최근 5 건 중 `183 행` 을 건드린 commit 0 건 (전부 `130 행` / `133 행` REQ 재판정 동기). 따라서 본 갱신은 main 에 부분조차 안착하지 않았다.

**갱신할 실측 (origin/main `af2abcaf` 기준, 본 task 는 head 에서 재측정해 기입한다)** — `wc -l web/src/views/AdminView.tsx` = **6,053** (bullet 이 적은 6,087 대비 `-34`). 반면 top-level 선언은 `grep -cE '^(export )?(async )?(function|const|let|type|interface|class|enum) '` 기준 **167** 이다. 즉 순수 추출 3 슬라이스가 빠져나갔음에도 순 감소는 34 줄에 그쳤고 선언 수는 되레 늘었다 — **append 속도가 extract 속도를 여전히 앞선다**는 것이 이번 갱신이 박제할 핵심 사실이다.

## Required Reading

- [docs/PLAN.md](../PLAN.md) `183 행` — 갱신 대상 bullet 전문. 본 task 는 **이 한 줄만** 고친다.
- [docs/tasks/T-1852-adminview-service-identity-runners-extract.md](T-1852-adminview-service-identity-runners-extract.md) `## Follow-ups` + `## 완료 기록 (2026-09-02)` — 셋째 실분할의 실측 (`+268/-215`, `6253 → 6053`, 역방향 import 해소) 근거.
- [docs/tasks/T-1830-adminview-collection-target-runners-extract.md](T-1830-adminview-collection-target-runners-extract.md) frontmatter — 둘째 실분할 (`adminCollectionTargetRunners.ts`) 의 task ID / 대상 확인용.
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) — 실측 전용. `1893~2077 행` (CreateGroupDeps ~ runCreatePart 끝) · `2426~2584 행` (DeleteGroupDeps ~ buildDeletePartBumpRefresh 끝) · `2723~2907 행` (UpdateGroupDeps ~ runUpdatePart 끝) 세 블록의 경계만 확인한다. **본 task 에서 이 파일을 수정하지 않는다.**

## Acceptance Criteria

- [ ] [docs/PLAN.md](../PLAN.md) `183 행` bullet 의 제목 수치 (`— 6,087 줄`) 와 본문 첫 문장의 `**6,087 줄 · top-level 선언 149 개**` 를 **head 에서 재측정한 값**으로 교체한다. 측정 방법을 함께 박제해 다음 갱신이 비교 가능하도록 한다 — LOC 은 `wc -l web/src/views/AdminView.tsx`, 선언 수는 `grep -cE '^(export )?(async )?(function|const|let|type|interface|class|enum) ' web/src/views/AdminView.tsx`. 최초 값 149 는 측정 방법이 기록되지 않았으므로 **선언 수 증감은 지표(indicative)일 뿐 동일 방법 비교가 아님**을 한 구절로 명시한다.
- [ ] 같은 bullet 에 **진척 3 슬라이스**를 한 문장으로 박제한다 — [adminServiceIdentityRowActions.tsx](../../web/src/views/adminServiceIdentityRowActions.tsx) (행 액션 helper 군, 선행) · [T-1830](T-1830-adminview-collection-target-runners-extract.md) [adminCollectionTargetRunners.ts](../../web/src/views/adminCollectionTargetRunners.ts) (수집 대상 러너 군) · [T-1852](T-1852-adminview-service-identity-runners-extract.md) [adminServiceIdentityRunners.ts](../../web/src/views/adminServiceIdentityRunners.ts) (ServiceIdentity 러너 군, `-200 줄` + 역방향 import 해소).
- [ ] **순 감소가 34 줄에 그쳤다는 사실**과 그 해석 (append 속도 > extract 속도 — 목표선 ≤ 2,000 줄 도달에는 추출 지속이 필요) 을 1 개 구절로 박제한다. 수치를 적기만 하고 해석을 빼지 않는다.
- [ ] 낡은 **1 차 대상 문구** ("1 차 대상은 ServiceIdentity 행별 액션 helper 군(현 `AdminView.tsx` 2300~2560 행 5 함수)") 를 다음 대상으로 교체한다 — **그룹/파트 mutation 러너 군** (deps interface 6 + async 러너 6 + 파트 삭제 helper 2), 좌표는 head 재측정값으로 하되 pre-check 기준으로 `1893~2077 행` (create 축) · `2426~2584 행` (delete 축) · `2723~2907 행` (update 축) 의 **비연속 3 블록**이며 합계 약 530 줄임을 명시한다. T-1852 Follow-up 이 적었던 `2093~2238 행` 좌표는 추출 후 head 에서 빗나가므로 채택하지 않는다.
- [ ] bullet 의 체크박스는 `- [ ]` 로 유지한다 (목표선 ≤ 2,000 줄 미도달).
- [ ] `git diff --stat` 이 **`docs/PLAN.md` 1 파일만** 보여준다 (본 task 파일과 driver 의 `STATE.json` / journal bookkeeping 제외). `web/` · `src/` · `.claude/` 무변경.
- [ ] 갱신된 bullet 안의 모든 상대 링크가 `docs/` 기준으로 유효하다 — 최소한 새로 추가한 링크에 대해 `ls docs/tasks/T-1830-*.md docs/tasks/T-1852-*.md web/src/views/adminCollectionTargetRunners.ts web/src/views/adminServiceIdentityRunners.ts web/src/views/adminServiceIdentityRowActions.tsx` 가 전부 성공한다.
- [ ] [CLAUDE.md](../../CLAUDE.md) `§12` 언어 정책 준수 — 본문 한국어, 경로 · 명령어 · 식별자는 영어. 행 범위 표기는 `§ 12.76 R1` · `R4` 대로 물결 `~` 하나를 쓰고 `L` prefix 를 쓰지 않는다.

**R-112 해당 없음** — 본 task 는 `commitMode: direct` doc-only 이며 production code 를 0 LOC 변경한다. 따라서 [CLAUDE.md](../../CLAUDE.md) `§3.2` R-110 의 "direct-mode doc-only commit 만 본 규칙 면제" 조항에 해당해 tester 호출과 happy / error / branch / negative test 항목은 적용되지 않는다.

## Out of Scope

- `web/src/views/AdminView.tsx` 또는 그 어떤 `web/` · `src/` 파일의 실제 코드 변경 — 다음 추출 슬라이스 (`pr`) 의 몫이다. 본 task 는 좌표를 **기록만** 한다.
- 그룹/파트 mutation 러너 군의 실제 추출 (신설 모듈 · 경계 spec 작성). 본 task 는 대상 지목까지만.
- `docs/PLAN.md` 의 다른 bullet (`133 행` 전역 CSS 잔여 · `181 행` · `182 행` 등) 수정. `183 행` 한 줄만 건드린다.
- `docs/requirements.md` REQ status 재판정 — [CLAUDE.md](../../CLAUDE.md) `§3.1` 판정 규칙 6 대로 구현 슬라이스 머지 후 별도 판단이며, 본 task 는 REQ 를 다루지 않는다 (`coversReq: []`).
- `modules.md` 문서 12 종 vs `src/` 실측 15 종 drift 동기 — 별개 주제이며 별도 task.
- 새 ADR 작성 또는 기존 ADR 수정.

## Suggested Sub-agents

`implementer` (단독 — doc-only 1 파일 inline-amend, architect · tester 불요)

## Follow-ups

- 다음 실분할 (`pr`) — 그룹/파트 mutation 러너 군 (deps interface 6 + async 러너 6 + 파트 삭제 helper 2) 을 신설 `web/src/views/adminGroupPartRunners.ts` 로 순수 추출. [T-1830](T-1830-adminview-collection-target-runners-extract.md) · [T-1852](T-1852-adminview-service-identity-runners-extract.md) 선례 그대로 본문 무변경 이동 + AdminView 재수출로 기존 spec 무수정 통과, `sizeExempt: pure-extraction` (파일 수 cap ≤ 5 는 준수).
