---
id: T-1437
title: deployment.md `## 배포 토폴로지` 단락 (50 ~ 76 행) 의 검증 가능 claim ↔ 실 `src/` · `package.json` · `pnpm-workspace.yaml` 대조 + T-1436 Follow-up 2 (조건부 mount 운영 문서화) closure + audit §12.35
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-004, REQ-047]
estimatedDiff: 200
estimatedFiles: 3
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1436]
touchesFiles:
  - docs/architecture/deployment.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1437-deployment-md-topology-section-vs-src-audit.md
completedAt: 2026-08-04T00:52:00Z
resultCommit: aaa7328d
plannerNote: "uc-doc-audit-resync 49 번째 slice — T-1436 Follow-up 2 (deployment.md 조건부 mount 미대조) closure + 문서 축을 directory.md → deployment.md 로 이월. doc-only 1.6x"
---

# T-1437 — deployment.md `## 배포 토폴로지` 단락 ↔ 실 코드 대조 + T-1436 web 운영 축 유보 closure

## Why

[T-1436](T-1436-directory-md-web-frontend-section-vs-src-audit.md) 이 [directory.md](../architecture/directory.md) 의 마지막 미대조 산문 단락을 닫으면서 **directory.md 6 축 전 구간 대조 완료** 를 선언했고 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.34`), 동시에 Follow-up 2 로 **"`web/dist/` 조건부 mount 의 운영 문서화 — [deployment.md](../architecture/deployment.md) 가 '빌드 없이 부팅하면 SPA 라우트 미등록' 을 명시하는지 미대조"** 를 남겼다. 본 slice 는 그 유보를 닫으면서 stream 의 대조 대상을 directory.md 에서 **deployment.md** 로 이월한다.

대상 구간은 deployment.md `## 배포 토폴로지 (Monolithic vs worker 분리)` (50 ~ 76 행) 다. 이 구간은 지금까지 audit 이 **REQ-032 / REQ-047 / REQ-048 pointer 로만 인용** 했을 뿐 (audit 66 · 81 · 82 · 148 ~ 150 행), 단락 본문의 구조 claim 이 실 코드와 대조된 적이 **한 번도 없다**. 그런데 이 단락은 `### process 1 개의 책임 범위` 6 bullet 로 "무엇이 한 process 안에서 shipped 인가" 를 열거하는 **운영 판단의 근거 문서** 라 stale 시 오도 비용이 크다.

planner 사전 확인 (executor 가 AC 1 에서 전부 재측정) — 최소 3 건의 검증 가능한 갈림이 있다. ① **65 행 Web UI 정적 serve** 의 "`web/dist/` SPA build 산출물을 mount" 는 무조건형 서술이나 실 `src/web/web.module.ts` 는 `resolveServeStaticOptions` 가 `existsSync(join(distPath, "index.html"))` 실패 시 **빈 배열** 을 반환해 **등록 0** 이 되는 조건부다 (T-1436 이 directory.md 쪽에서 `부분참` 으로 판정한 것과 동형 — 본 slice 는 그 판정을 운영 문서 쪽에서 승계·closure). ② **61 행 Scheduler** 의 "`@nestjs/schedule` 기반 in-process cron" 은 [Q-0026](../STATE.json) 이 "cron/scheduler 자동화(`@nestjs/schedule`)는 추후 미승인" 으로 남긴 미도입 영역이라 **미shipped (거짓 또는 부분참)** 후보다. ③ **56 행** 의 "`pnpm --filter web build` 류의 분리 스크립트" 는 root `package.json` 의 `build` 가 `nest build` 뿐이고 [pnpm-workspace.yaml](../../pnpm-workspace.yaml) 이 `packages: [web]` 을 선언 + `web/package.json` 이 `build` 를 가지므로 **참 (workspace filter 경로로 성립)** 후보다. 즉 본 축도 선행 slice 와 같이 `참 / 부분참 / 거짓` 으로 갈린다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/deployment.md` — **188 행**. 다음 구간만 읽는다.
  - **50 ~ 76 행** (`## 배포 토폴로지 (Monolithic vs worker 분리)` heading + 근거 pointer + 54 행 채택 선언 + 56 행 frontend 빌드 분리 + `### process 1 개의 책임 범위` 6 bullet (60 ~ 65 행) + `### REQ-047 충족 시나리오` + `### worker 분리 전환 시점` + 75 행 trade-off 문단) — 본 slice 의 **주 편집 후보 구간**.
  - **1 ~ 4 행** (문서 성격 선언 blockquote — "본 문서는 P1 T-A2 의 산출물" + [T-0399](T-0399-deployment-md-web-serve-static-doc-sync.md) 의 P6 doc-sync 승계) — **무편집**, 판정의 최강 제약. T-1436 과 같은 **blueprint ↔ 현재형 doc-sync 혼재** 성격이라 (A) in-place 가능성을 여는 핵심 논점이다.
  - **77 행 이후** (`## Secret / 자격증명 저장` 이하) — **무편집** 경계 확인용. 본 slice 는 `## 배포 토폴로지` 단락만 다룬다.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **3402 행**. **`### 12.15`** (시점 기록 append-only 처리 방침 정본) · **`### 12.34`** (**3275** 행 — T-1436 판정표 화법 template + 카운트 in-place / 서술 각주 **혼합 채택 선례** + Follow-up 2 원문) · **`## 11. References` (3389 행)** — `§ 12.35` 삽입 위치 경계.
- `src/web/web.module.ts` — **무편집, 읽기만**. `WEB_DIST_PATH` · `API_EXCLUDE_PATTERN` · `resolveServeStaticOptions` 의 `existsSync(index.html)` 분기 · `imports` 의 `.map` 등록 0 경로.
- `package.json` (root) · `pnpm-workspace.yaml` · `web/package.json` — **무편집, 읽기만**. build script 축 판정 입력.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.35` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 편집을 중단** 하고 불성립 사실을 `§ 12.35` 에 기록한다.
  - (i) **단락 원문 전수 + 좌표 재확인**: `grep -n '^#\{1,3\} ' docs/architecture/deployment.md` 로 heading 좌표를 **먼저 실측** 한 뒤 (T-1436 이 frontmatter 좌표 stale 을 실측으로 잡은 선례 — 본 AC 의 `50 ~ 76 행` 도 stale 일 수 있다) 해당 범위를 `sed -n` 으로 인용한다. 이어 **실측으로 참·거짓을 가릴 수 있는 claim** (기술 스택 · 모듈 존재 · script 존재 · shipped 여부 · 조건부 여부) 만 뽑아 열거하고, 순수 설계 의도 · trade-off 서술 (예: 75 행 "배포가 backend 재시작과 묶인다") 은 **검증 불가 claim** 으로 분류해 판정 대상에서 제외한다. 이 이분 자체를 남긴다.
  - (ii) **책임 범위 6 bullet 축 (60 ~ 65 행)**: bullet 마다 근거 1 개씩만 실측한다. `ls src/` 1 회 + `grep -rn "@nestjs/schedule" package.json src/ --include='*.ts' --include='*.json' | head` + `grep -n "serve-static\|@nestjs/schedule" package.json` 로 — HTTP API (controller layer) · Scheduler (`@nestjs/schedule` in-process cron) · 평가 파이프라인 · LLM gateway (5 provider) · GitHub / Confluence adapter · Web UI 정적 serve 6 종의 **shipped 여부** 를 판정한다. 기대 — Scheduler bullet 은 dependency **미등재** 로 `거짓` 또는 `미shipped 부분참`, 나머지 5 종은 대응 디렉토리 실재로 `참` 계열.
  - (iii) **serve-static 조건부 축 (T-1436 Follow-up 2 closure)**: `grep -n "existsSync\|resolveServeStaticOptions\|API_EXCLUDE_PATTERN\|WEB_DIST_PATH" src/web/web.module.ts` 출력을 인용해 — 65 행의 mount 서술이 **`web/dist/index.html` 존재 시에만 등록되는 조건부** 인지 판정한다. 조건부가 확인되면 65 행 무조건 서술을 **`부분참`** 으로 분류하고, deployment.md 가 "빌드 없이 부팅하면 SPA 라우트 미등록" 을 **명시하는가** 를 `sed -n '50,76p' ... | grep -n "부재\|미등록\|없으면\|조건"` 1 회로 확인해 **미명시 사실** 을 1 구로 남긴다 (이것이 Follow-up 2 의 직접 답).
  - (iv) **build script 분리 축 (56 행)**: `grep -n '"build"' package.json web/package.json` + `cat pnpm-workspace.yaml` 출력을 인용해 — root `build` = `nest build` 불변 **참**, `web/` 별도 패키지 `build` 존재 **참**, `pnpm --filter web build` 경로 성립 여부를 판정한다. **빌드 실행 금지** (`pnpm build` · `pnpm --filter web build` 어느 것도 실행하지 않는다 — 측정만).
  - (v) **pointer 유효성 축**: `ls docs/decisions/ADR-0003-deployment.md docs/decisions/ADR-0040-frontend-stack.md docs/tasks/T-0399-*.md docs/tasks/T-0354-*.md 2>&1` 로 단락이 인용한 근거 파일 실재를 확인한다. **ADR 본문 재판정은 하지 않는다** (파일 존재 = pointer 유효까지만).
  - (vi) baseline — `wc -l` deployment.md **188** · audit **3402** · directory.md **203** · modules.md **259**, `grep -c '^## '` deployment.md 실측값 기록 · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **34**.
- [ ] **AC 2 — 지점 판정표**: AC 1 이 뽑은 **검증 가능 claim** 각각에 대해 `in-place 수정` / `원문 보존 + 각주 부기` / `무편집` / `상위 slice 판정 승계` 중 하나를 판정한 표를 만든다. 각 row 는 **지점 (행) · claim 1 구 · 실측 결과 · 판정 (참 / 부분참 / 거짓) · 처리 · 근거 1 구** 6 컬럼.
  - 판정 기준 **3 축** 명시 — ① **문서 성격** (1 ~ 4 행 blockquote 가 선언하듯 본 문서는 **P1 T-A2 blueprint 이면서 65 행만 T-0399 의 P6 현재형 doc-sync** 인 혼재 — 두 성격에 `§ 12.15` append-only 제약이 같은 강도로 걸리는지), ② `§ 12.15` **정합**, ③ **선례** (T-1430 ~ T-1435 의 "원문 보존 + 실측 각주" 5 연속 vs [T-1429](T-1429-api-md-module-vocab-and-uc-range-resync.md) 의 in-place 1:1 치환 vs [T-1436](T-1436-directory-md-web-frontend-section-vs-src-audit.md) 의 **혼합 채택**).
  - **미shipped 축 (Scheduler) 과 조건부 축 (serve-static) 의 처리를 분리 판정** 한다 — 전자는 [Q-0026](../STATE.json) 의 **미승인 = 의도된 미도입** 이라 blueprint 서술로서 성립할 여지가 있고, 후자는 **shipped 코드의 실 동작과 문서 서술의 어긋남** 이라 성격이 다르다. 한 slice 안에서 두 처리가 갈려도 무방하나 그 이유를 반드시 1 구로 적는다.
  - **중복 각주 회피 판정** 을 포함 — 조건부 mount 의 **directory.md 쪽 판정은 `§ 12.34` 에 이미 박제** 됐으므로 본 slice 는 반복하지 않고 참조 + 운영 문서 축만 추가한다.
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) **전 지점 in-place 동기** (65 행 조건부 명시 + 61 행 미shipped 표기), (B) **단락 원문 무편집 + 단락 말미 각주 blockquote 1 개 신설** (선행 5 slice 화법), (C) **혼합** (조건부 mount 만 in-place 또는 각주 1 종, 나머지는 각주 승계), (D) **전 지점 무편집 + audit 기록만**.
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` 정합 (본 단락에 시점 marker 가 있는가 — 실측 grep 으로 근거를 둔다), ② **운영 오도 risk** (운영자가 "부팅하면 SPA 가 뜬다" 로 읽는가 — 본 문서는 운영 판단 근거라 risk 가중치가 directory.md 보다 높다는 점을 1 구로 논증), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 자동 기각 + split 제안 기록), ④ 선례 일관성.
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다. 각 지점은 AC 2 판정 결과를 따른다.
  - **deployment.md 편집은 각주 blockquote 1 개 (≤ 3 행) + in-place 치환 (≤ 3 지점) 이내** — `wc -l` 증가 **+4 이내** (188 → ≤ 192).
  - **문구·파일명·경로는 AC 1 실측 출력과 1:1 일치** 해야 하며, 실측되지 않은 동작 (예: dist 부재 시 반환 status code, 재빌드 절차) 을 **새로 창작하지 않는다**.
  - **`## Secret / 자격증명 저장` (77 행) 이하 전 구간 무편집** · **1 ~ 4 행 blockquote 무편집** · **`### REQ-047 충족 시나리오` 무편집** (REQ-047 는 P7 perf test 소관 — audit 81 · 149 행이 이미 cover).
  - **새 pointer 추가 금지** — ADR-0003 · ADR-0040 · T-0399 · T-0354 는 이미 등재돼 있다.
- [ ] **AC 5 — audit `§ 12.35` 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 `## 11. References` (3389 행) **직전** 에 `### 12.35 …` 절을 **순수 append** 한다 (기존 절 수정 0). 구성 — 본 절의 위치 · 계보 1 문단 / AC 1 실측 (명령 + 출력) / AC 2 지점 판정표 / AC 3 처리 판정표 / AC 4 반영 결과 + 무편집 경계 / **T-1436 Follow-up 2 (조건부 mount 운영 문서화) closure 선언** / **대조 대상 문서 이월 선언** (directory.md 6 축 완료 → deployment.md 진입, 남은 미대조 단락 목록) / 파생 영향 (목록만) / 불변 검산 / 한계. **절 전체 ≤ 115 행** (cap 준수 — 초과 시 실측 인용을 요약형으로 압축).
  - `###` 레벨이라 `grep -c '^## '` **12 불변** · `grep -c '^| REQ-'` **66 불변** · `grep -c '^### 12\.'` **34 → 35**.
- [ ] **AC 6 — 불변 검산**: 다음을 실행해 출력을 `§ 12.35` 에 인용한다. `wc -l` deployment.md (188 → ≤ 192) · audit (3402 → +115 이내) · directory.md (**203 불변**) · modules.md (**259 불변**), `git diff -U0 -- docs/architecture/deployment.md | grep '^@@'` 로 **hunk 개수 · 위치** 를 보이고 AC 4 허용 구간 밖 hunk **0** 을 실증, `git diff --numstat` 으로 **순수 삭제 0** (삭제 행이 있으면 in-place 치환의 짝임을 1 구로 설명), `git status --porcelain src/ test/ prisma/ web/ package.json` **빈 출력** (코드 무변경), `git status --porcelain` 이 **3 파일** 임을 확인.
- [ ] **AC 7 — 파생 영향 기록 (목록만, 본 slice 편집 금지)**: `§ 12.35` 말미에 후속 slice 대상을 목록으로 남긴다. 최소 포함 — (1) UC-09 `§ 5` sequence participant 병기 (19 회째 이월), (2) 정본 [modules.md](../architecture/modules.md) "WebModule 의 frontend 분리" 단락 카운트 claim 대조 (`§ 12.34` Follow-up 1 미소진 — ADR 게이트), (3) 행 번호 → anchor 좌표계 이행 (13 회째), (4) 산문 tally ↔ 실측 CI drift-guard spec (`pr` mode 소관), (5) deployment.md 잔여 미대조 단락 (`## Secret / 자격증명 저장` · `## Scheduler 위치` · `## 외부 네트워크 boundary` — 특히 `### cron 주기 설정 흐름 (REQ-039)` 는 본 slice 의 Scheduler 판정과 직결), (6) `§ 12.34` 파생 영향 중 미소진 항목.
- [ ] **AC 8 — R-110 / R-112 면제 근거 명시**: 본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 **N/A** 임을 `§ 12.35` 에 1 구로 명시한다.
- [ ] **AC 9 — 언어 · 링크 규약**: 추가 문장은 모두 한국어 (§12), 문서 간 참조는 상대경로 markdown 링크, 수치는 실측 출력과 1:1 일치.

## Out of Scope

- **코드 변경 절대 금지** — `src/` · `test/` · `prisma/` · `web/` · `scripts/` · `package.json` · `pnpm-workspace.yaml` 은 diff 에 등장하면 안 된다. 특히 `@nestjs/schedule` 도입 (Q-0026 미승인 — §5 dependency 게이트), `resolveServeStaticOptions` 수정, `pnpm build` · `pnpm --filter web build` 실행은 **어떤 경우에도 하지 않는다** (문서를 코드에 맞출 뿐, 코드를 문서에 맞추지 않는다).
- **deployment.md 의 `## 배포 토폴로지` 밖 단락 편집 금지** — `## 개요` · `## DB / Persistence` · `## Secret / 자격증명 저장` · `## Scheduler 위치` · `## 외부 네트워크 boundary` 는 무편집 (파생 영향 목록에만 남긴다).
- **`### REQ-047 충족 시나리오` 재판정 금지** — perf NFR 은 P7 perf test 소관이며 audit 81 · 149 행이 이미 cover.
- **정본 [modules.md](../architecture/modules.md) · [directory.md](../architecture/directory.md) 편집 금지** — 본 slice 는 deployment.md 축만 닫는다 (directory.md 는 `§ 12.34` 로 이미 완료).
- **ADR-0003 · ADR-0040 · ADR-0041 본문 재판정 · status 변경 금지** — 파일 존재 확인까지만.
- **다른 문서로의 cascade 금지** — [components.md](../architecture/components.md) · [api.md](../architecture/api.md) · [data-model.md](../architecture/data-model.md) · `docs/architecture/INDEX.md` · [INDEX.md](../use-cases/INDEX.md) · `UC-01` ~ `UC-09` · ADR · [PLAN.md](../PLAN.md) · [requirements.md](../requirements.md) 는 무편집.
- **행 번호 → anchor 좌표계 이행 금지** — 파생 영향 목록에만 남긴다 (13 회째 이월).
- **CI drift-guard spec 작성 금지** — `pr` mode 소관이라 본 direct task 에서 진행하면 §3.1 위반.
- **audit 기존 절 (`§ 12.1` ~ `§ 12.34`) 수정 금지** — `§ 12.35` 순수 append 만.

## Suggested Sub-agents

`implementer` 단독 (doc-only, 코드 0 LOC — architect · tester 불요. §3.2 direct-mode 면제).

## Follow-ups

1. **`## Scheduler 위치` 단락 ↔ 실 `src/scheduling/` 대조 (다음 slice 1 순위)** — 본 slice 실측 (ii) 가 `@Cron(` **0 hit** (선언형 cron job 0, 등록은 `SchedulerRegistry` 동적형) 을 잡았으므로, `### cron 주기 설정 흐름 (REQ-039)` · `### Manual trigger 흐름 (REQ-040)` · `### 동시 실행 방지` 가 실 `cron-schedule.service.ts` · `cron-schedule.controller.ts` 와 맞는지 대조가 필요하다.
2. **deployment.md 잔여 미대조 단락 4** — `## 외부 네트워크 boundary` · `## Secret / 자격증명 저장` · `## DB / Persistence` · `## 개요` (`§ 12.35` 대조 대상 문서 이월 선언 참조).
3. **정본 [modules.md](../architecture/modules.md) "WebModule 의 frontend 분리" 단락 카운트 claim 대조** — `§ 12.34` Follow-up 1 미소진 (정본 편집은 ADR 게이트).
4. **planner 기대 검증 절차의 일반화** — 본 slice 에서 planner 사전 기대 ② (Scheduler 미shipped) 가 실측에 반증됐다. task 정의서의 "planner 사전 확인" 문단은 **가설** 이지 전제가 아님을 planner prompt 쪽에도 1 구로 박제할지 검토.
5. **행 번호 → anchor 좌표계 이행** (13 회째 이월) — 본 slice 의 각주 4 행 삽입으로 `## Secret / 자격증명 저장` 이 77 → **81** 행으로 밀려 후속 task 좌표가 다시 낡는다.
