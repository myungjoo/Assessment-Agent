---
id: T-1440
title: deployment.md `## 외부 네트워크 boundary` 후반부 (186 ~ 202 행 — `### 권한 부족 (REQ-020) 감지 흐름` · `### 운영 호스트 가정`) 의 검증 가능 claim ↔ 실 `src/github/` · `src/confluence/` · `prisma/schema.prisma` · `docs/requirements.md` 대조 + T-1439 Follow-up 1 계승 + audit §12.38
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-008, REQ-016, REQ-020]
estimatedDiff: 200
estimatedFiles: 3
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1439]
touchesFiles:
  - docs/architecture/deployment.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1440-deployment-md-network-boundary-tail-vs-src-audit.md
plannerNote: "uc-doc-audit-resync 52 번째 slice — T-1439 Follow-up 1 (boundary 후반부) 1 순위 계승, 단락 완결. doc-only 1.6x"
---

# T-1440 — deployment.md `## 외부 네트워크 boundary` 후반부 ↔ 실 adapter · 영속 model · requirements 번호 체계 대조

## Why

[T-1439](T-1439-deployment-md-network-boundary-section-vs-src-audit.md) 가 [deployment.md](../architecture/deployment.md) `## 외부 네트워크 boundary` 의 **전반부** (도입 문단 · `### 접근 대상 목록` · `### 지원 LLM 환경` · `### TLS / 사내 인증서 처리`) 만 닫고 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.37`), **후반부 2 절을 다음 slice 1 순위** 로 명시 이월했다 (T-1439 Follow-up 1). 본 slice 가 그 이월을 계승해 단락을 **완결** 한다.

이월 근거는 T-1439 실측 (v) 가 `axios` · `undici` · `HttpModule` · `ProxyAgent` 의 `src/` 전체 **0 hit** 를 이미 확인했다는 것이다 — 그런데 후반부 code-block 은 그 세 라이브러리를 transport 로 적어 두었으므로 **어긋날 가능성이 크다**. 후반부는 그 밖에도 이벤트 / 알림 심볼 · 영속 model · REQ 번호 · phase 시점 서술을 열거해 대조 가능 claim 밀도가 높다.

planner 사전 확인 — **아래는 전부 가설이며 전제가 아니다** (T-1437 Follow-up 4 의 박제: planner 기대가 실측에 반증된 선례가 있다). executor 는 AC 1 에서 전부 재측정하고, **기대와 다르면 그 축의 편집을 중단** 한다. ① code-block 190 행의 `axios / undici / NestJS HttpModule` 은 T-1439 실측과 정면 충돌하므로 **거짓** 쪽 — 실제로는 `globalThis.fetch` 주입. ② 192 ~ 193 행의 `PermissionDeniedEvent emit (NestJS EventEmitter)` → `NotificationService` 는 `EventEmitter` · `NotificationService` 심볼이 `src/` 에서 잡히지 않을 가능성이 있고, 대신 `prisma/schema.prisma` 의 `PermissionDeniedRecord` **영속 record 경로** 가 실재할 가능성 — 그러면 "event → notify" 서술은 **부분참 (감지·기록은 실재, emit/서비스 경유는 형태 상이)**. ③ 186 행 heading 의 `(REQ-020)` 은 [requirements.md](../requirements.md) 현 번호 체계에서 **조직 기여 큰 인원 → 높은 점수** 이고 권한 부족은 **REQ-008 (GitHub) · REQ-016 (Confluence)** 라 **옛 번호 체계 잔재** 일 가능성 — requirements.md 의 REQ-020 row 자체가 그 잔재를 자인하고 있는지도 함께 본다. ④ 196 · 202 행의 "**P4 phase 의 도입 task 책임**" · "**P4 / P7 의 task 책임**" 은 REQ-008 / REQ-016 이 이미 `DONE` 이고 현 phase 가 P4-complete / P5-in-progress 라 **시점 서술이 낡았을** 가능성. ⑤ `### 운영 호스트 가정` 은 corporate network 전제 · cloud 이전 시 ADR 필요라는 **설계 가정** 이라 대부분 **검증 불가 claim** 이고, 검증 가능한 것은 [ADR-0003](../decisions/ADR-0003-deployment.md) pointer 실재뿐일 가능성.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/deployment.md` — **202 행**. 다음 구간만 읽는다.
  - **186 ~ 202 행** (`### 권한 부족 (REQ-020) 감지 흐름` heading + code-block + 196 행 시점 서술 + `### 운영 호스트 가정` + 202 행 마무리 문장) — 본 slice 의 **주 편집 후보 구간**.
  - **151 ~ 185 행** (`## 외부 네트워크 boundary` 전반부 + T-1439 가 181 ~ 184 행에 삽입한 각주 blockquote) — **무편집, 읽기만**. 각주 화법 승계 + 중복 각주 회피 판정 입력 (T-1439 각주가 이미 확정한 사실은 **재측정 없이 승계** 해도 되나, 승계임을 명시한다).
  - **1 ~ 4 행** (문서 성격 선언 blockquote — "본 문서는 P1 T-A2 의 산출물") — **무편집**, 판정의 최강 제약.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **3735 행**. **`### 12.15`** (시점 기록 append-only 처리 방침 정본) · **`### 12.37`** (**3610** 행 — T-1439 판정표 화법 template + 각주 1 블록 채택 선례 + Follow-up 1 원문) · **`## 11. References` (3722 행)** — `§ 12.38` 삽입 위치 경계.
- `src/github/github-adapter.service.ts` · `src/confluence/confluence-adapter.service.ts` — **무편집, 읽기만**. 4xx catch → 권한 부족 처리 경로 판정 입력.
- `prisma/schema.prisma` — **무편집, 읽기만**. `PermissionDeniedRecord` 영속 model 실재 축 판정 입력.
- `docs/requirements.md` — **무편집, 읽기만**. REQ-008 · REQ-016 · REQ-020 3 row 만. 번호 체계 축 판정 입력.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.38` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 편집을 중단** 하고 불성립 사실을 `§ 12.38` 에 기록한다 (Why 의 ① ~ ⑤ 는 가설일 뿐이다).
  - (i) **단락 원문 + 좌표 재확인**: `grep -n '^#\{1,3\} ' docs/architecture/deployment.md` 로 heading 좌표를 **먼저 실측** 한 뒤 (본 AC 의 `186 ~ 202 행` 도 stale 일 수 있다 — T-1436 · T-1437 · T-1438 · T-1439 선례) 해당 범위를 `sed -n` 으로 인용한다. 이어 **실측으로 참·거짓을 가릴 수 있는 claim** (심볼명 · 라이브러리명 · model 명 · REQ 번호 · phase 표기) 만 뽑아 열거하고, 순수 설계 가정 · 운영 전제 서술은 **검증 불가 claim** 으로 분류해 판정 대상에서 제외한다. 이 이분 자체를 남긴다.
  - (ii) **transport 축 (code-block 190 행)**: `grep -rn "axios\|undici\|HttpModule\|ProxyAgent" src --include='*.ts' | grep -v spec | head -8` 를 **본 slice 에서 다시** 실행해 출력을 인용한다 (T-1439 결과 승계가 아니라 재측정 — 승계와 재측정 중 어느 쪽을 택했는지 1 구로 명시). 이어 `grep -rn "globalThis.fetch" src/github src/confluence --include='*.ts' | grep -v spec | head -6` 로 실 transport 를 인용해 대조한다. 판정은 `참 / 부분참 / 거짓` 중 하나.
  - (iii) **이벤트 · 알림 심볼 축 (code-block 192 ~ 193 행)**: `grep -rn "PermissionDeniedEvent\|NotificationService\|EventEmitter" src --include='*.ts' | grep -v spec | head -10` 로 세 심볼의 실재 여부를 인용한다. hit 0 이면 **"0 hit" 를 그대로 기록** 하고, 대체 경로를 `grep -rn "PermissionDenied" src/github src/confluence --include='*.ts' | grep -v spec | head -8` + `grep -n "model PermissionDeniedRecord" -A 12 prisma/schema.prisma` 로 인용해 **실제 흐름이 event emit 인지 record 영속인지** 1 구로 판정한다.
  - (iv) **REQ 번호 체계 축 (heading 186 행)**: `grep -n "^| REQ-008 \|^| REQ-016 \|^| REQ-020 " docs/requirements.md | cut -c1-160` 로 3 row 의 **제목 컬럼과 status** 를 인용해, heading 의 `(REQ-020)` 이 현 번호 체계에서 무엇을 가리키는지 대조한다. 권한 부족이 REQ-008 / REQ-016 으로 확인되면 heading 의 REQ 번호는 **거짓 (옛 번호 체계 잔재)** 로 판정한다. 단 **requirements.md 는 편집하지 않는다**.
  - (v) **시점 서술 축 (196 · 202 행)**: (iv) 가 인용한 REQ-008 · REQ-016 의 status 토큰과 `grep -n '"phase"' docs/STATE.json | head -2` 의 현 phase 값을 대조해, "P4 phase 의 도입 task 책임" · "P4 / P7 의 task 책임" 이 **이미 지난 시점을 미래로 서술하는지** 판정한다. `§ 12.15` 의 시점 기록 append-only 방침이 이 축에 어느 강도로 걸리는지 1 구로 논증한다.
  - (vi) **pointer 유효성 축 (`### 운영 호스트 가정`)**: `ls docs/decisions/ADR-0003-deployment.md 2>&1` 로 인용 근거 파일 실재를 확인한다. **ADR 본문 재판정 · status 변경은 하지 않는다** (파일 존재 = pointer 유효까지만).
  - (vii) baseline — `wc -l` deployment.md **202** · audit **3735** · directory.md **203** · modules.md **259**, `grep -c '^## '` deployment.md **6** · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **37**.
- [ ] **AC 2 — 지점 판정표**: AC 1 이 뽑은 **검증 가능 claim** 각각에 대해 `in-place 수정` / `원문 보존 + 각주 부기` / `무편집` / `상위 slice 판정 승계` 중 하나를 판정한 표를 만든다. 각 row 는 **지점 (행) · claim 1 구 · 실측 결과 · 판정 (참 / 부분참 / 거짓) · 처리 · 근거 1 구** 6 컬럼.
  - 판정 기준 **3 축** 명시 — ① **문서 성격** (1 ~ 4 행 blockquote 의 P1 T-A2 blueprint 선언에 `§ 12.15` append-only 제약이 어느 강도로 걸리는가), ② `§ 12.15` **정합** (본 단락 후반부에 시점 marker 가 있는지 실측 grep 으로 근거를 둔다 — 196 · 202 행이 그 marker 후보다), ③ **선례** (T-1430 ~ T-1435 · T-1437 ~ T-1439 의 "원문 보존 + 실측 각주" vs [T-1429](T-1429-api-md-module-vocab-and-uc-range-resync.md) 의 in-place 1:1 치환 vs [T-1436](T-1436-directory-md-web-frontend-section-vs-src-audit.md) 의 혼합 채택).
  - **code-block 안 claim 의 처리를 별도 판정** 한다 — 188 ~ 194 행은 fenced code-block 이라 각주로 부기할 때 **블록 안을 고칠지 블록 밖에서 부인할지** 가 산문과 다르다. 어느 쪽을 택하든 **1 구로 논증** 하고, 블록 안을 고치는 경우 흐름도 전체 정합 (앞뒤 화살표 단계) 이 깨지지 않음을 함께 보인다.
  - **거짓 축 (transport · REQ 번호) 과 부분참 축 (event / notify) 과 시점 축 (P4 / P7) 의 처리를 분리 판정** 한다 — 세 축의 처리가 갈려도 무방하나 그 이유를 각각 1 구로 적는다.
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) **전 지점 in-place 동기** (code-block 재작성 포함), (B) **단락 원문 무편집 + 후반부 말미 각주 blockquote 1 개 신설** (T-1437 ~ T-1439 화법 승계), (C) **혼합** (code-block 은 각주, heading 의 REQ 번호만 in-place), (D) **전 지점 무편집 + audit 기록만**.
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` 정합, ② **오도 risk** (독자가 code-block 을 실 구현 지도로 읽고 `axios` / `NotificationService` 를 찾으러 갈 때의 비용 — 본 문서는 배포 지시 문서라 risk 가중치가 높다는 점을 1 구로 논증), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 자동 기각 + split 제안 기록), ④ 선례 일관성.
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다. 각 지점은 AC 2 판정 결과를 따른다.
  - **deployment.md 편집은 각주 blockquote 1 개 (≤ 4 행) + in-place 치환 (≤ 2 지점) 이내** — `wc -l` 증가 **+5 이내** (202 → ≤ 207).
  - **문구·심볼·model·REQ 번호는 AC 1 실측 출력과 1:1 일치** 해야 하며, 실측되지 않은 동작 (예: 존재하지 않는 알림 채널, 미구현 event bus) 을 **새로 창작하지 않는다**.
  - **1 ~ 4 행 blockquote 무편집** · **151 ~ 185 행 (전반부 + T-1439 각주) 무편집** · **`## 외부 네트워크 boundary` 밖 전 구간 무편집** (`## 개요` · `## DB / Persistence` · `## 배포 토폴로지` · `## Secret / 자격증명 저장` · `## Scheduler 위치`).
  - **새 pointer 추가 금지** — ADR-0003 외의 문서를 본문에 새로 등재하지 않는다 (audit 쪽에만 기록).
- [ ] **AC 5 — audit `§ 12.38` 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 `## 11. References` (3722 행) **직전** 에 `### 12.38 …` 절을 **순수 append** 한다 (기존 절 수정 0). 구성 — 본 절의 위치 · 계보 1 문단 / AC 1 실측 (명령 + 출력) / AC 2 지점 판정표 / AC 3 처리 판정표 / AC 4 반영 결과 + 무편집 경계 / **T-1439 Follow-up 1 closure 선언 + `## 외부 네트워크 boundary` 단락 전체 closure 선언** (전반부 `§ 12.37` + 후반부 본 절로 완결임을 명시) / **deployment.md 잔여 미대조 갱신** (단락 3 — `## Secret / 자격증명 저장` · `## DB / Persistence` · `## 개요`) / 파생 영향 (목록만) / 불변 검산 / 한계. **절 전체 ≤ 115 행** (cap 준수 — 초과 시 실측 인용을 요약형으로 압축).
  - `###` 레벨이라 `grep -c '^## '` **12 불변** · `grep -c '^| REQ-'` **66 불변** · `grep -c '^### 12\.'` **37 → 38**.
- [ ] **AC 6 — 불변 검산**: 다음을 실행해 출력을 `§ 12.38` 에 인용한다. `wc -l` deployment.md (202 → ≤ 207) · audit (3735 → +115 이내) · directory.md (**203 불변**) · modules.md (**259 불변**), `git diff -U0 -- docs/architecture/deployment.md | grep '^@@'` 로 **hunk 개수 · 위치** 를 보이고 AC 4 허용 구간 밖 hunk **0** 을 실증, `git diff --numstat` 으로 **순수 삭제 0** (삭제 행이 있으면 in-place 치환의 짝임을 1 구로 설명), `git status --porcelain src/ test/ prisma/ web/ deploy/ docs/requirements.md package.json` **빈 출력** (코드·스키마·requirements 무변경), `git status --porcelain` 이 **3 파일** 임을 확인.
- [ ] **AC 7 — 파생 영향 기록 (목록만, 본 slice 편집 금지)**: `§ 12.38` 말미에 후속 slice 대상을 목록으로 남긴다. 최소 포함 — (1) **deployment.md 잔여 미대조 단락 3** 중 `## Secret / 자격증명 저장` 을 **다음 slice 1 순위** 로 지정 + 근거 1 구 (env 주입 방식이 `deploy/env.prod.example` 과 직접 대조 가능해 claim 밀도가 높다), (2) 나머지 2 단락 (`## DB / Persistence` → `## 개요`) 우선순위, (3) **REQ 번호 체계 잔재의 전수 sweep** — `docs/` 전체에서 권한 부족을 `REQ-020` 으로 지칭하는 다른 지점 (ADR-0003 · T-0015 등) 이 있는지는 본 slice 범위 밖이며 별도 slice 소관, (4) UC-08 `§ 5` 권한 부족 흐름 ↔ 실 emitter / record 정합 (본 slice 판정 승계 여지), (5) UC-09 `§ 5` sequence participant 병기 (22 회째 이월), (6) 정본 [modules.md](../architecture/modules.md) "WebModule 의 frontend 분리" 단락 카운트 claim 대조 (`§ 12.34` Follow-up 1 미소진 — ADR 게이트), (7) 행 번호 → anchor 좌표계 이행 (16 회째), (8) 산문 tally ↔ 실측 CI drift-guard spec (`pr` mode 소관).
- [ ] **AC 8 — R-110 / R-112 면제 근거 명시**: 본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 **N/A** 임을 `§ 12.38` 에 1 구로 명시한다.
- [ ] **AC 9 — 언어 · 링크 규약**: 추가 문장은 모두 한국어 (§12), 문서 간 참조는 상대경로 markdown 링크, 수치는 실측 출력과 1:1 일치.

## Out of Scope

- **코드 · 스키마 · 배포 config 변경 절대 금지** — `src/` · `test/` · `prisma/` · `web/` · `scripts/` · `deploy/` · `package.json` 은 diff 에 등장하면 안 된다. 특히 `NotificationService` 신설, `EventEmitter` 도입, `PermissionDeniedRecord` 컬럼 추가는 **어떤 경우에도 하지 않는다** (문서를 코드에 맞출 뿐, 코드를 문서에 맞추지 않는다).
- **[requirements.md](../requirements.md) 편집 금지** — heading 의 `(REQ-020)` 이 옛 번호 체계 잔재로 판정돼도 requirements.md 쪽 row 를 고치거나 새 REQ 를 부여하지 않는다 (REQ 신설 · 재번호는 owner 게이트). deployment.md 쪽 표기 처리와 audit 기록까지만.
- **테스트 · 빌드 실행 금지** — `pnpm build` · `pnpm test` 어느 것도 실행하지 않는다 (측정만).
- **단락 전반부 (151 ~ 185 행) 재편집 금지** — `§ 12.37` 이 이미 닫았다. 중복 각주를 새로 달지 않는다.
- **deployment.md 의 `## 외부 네트워크 boundary` 밖 단락 편집 금지** — 잔여 3 단락은 파생 영향 목록에만 남긴다.
- **정본 [modules.md](../architecture/modules.md) · [directory.md](../architecture/directory.md) · [api.md](../architecture/api.md) 편집 금지** — 본 slice 는 deployment.md 후반부 축만 닫는다.
- **ADR-0003 본문 재판정 · status 변경 금지** — 파일 존재 확인까지만.
- **`docs/` 전체 REQ 번호 잔재 sweep 금지** — ADR-0003 · T-0015 등 다른 문서의 `REQ-020` 표기는 파생 영향 목록에만 남긴다 (별도 slice).
- **다른 문서로의 cascade 금지** — [components.md](../architecture/components.md) · [data-model.md](../architecture/data-model.md) · `docs/architecture/INDEX.md` · [INDEX.md](../use-cases/INDEX.md) · `UC-01` ~ `UC-09` · ADR · [PLAN.md](../PLAN.md) 는 무편집.
- **행 번호 → anchor 좌표계 이행 금지** — 파생 영향 목록에만 남긴다 (16 회째 이월).
- **CI drift-guard spec 작성 금지** — `pr` mode 소관이라 본 direct task 에서 진행하면 §3.1 위반.
- **audit 기존 절 (`§ 12.1` ~ `§ 12.37`) 수정 금지** — `§ 12.38` 순수 append 만.

## Suggested Sub-agents

`implementer` 단독 (doc-only, 코드 0 LOC — architect · tester 불요. §3.2 direct-mode 면제).

## 결과 요약

- **AC 1 실측** — 후반부 좌표는 **186 ~ 202 행** 으로 AC 표기와 일치 (stale 아님). 검증 가능 claim **13** · 검증 불가 **4** 로 이분했다. planner 가설 ① ③ ④ 는 실측으로 성립, ② 는 **반증** — `PermissionDeniedEvent` 는 `src/` **32 hit** 로 실재하고 `PermissionDeniedEmitter` port + DI token (`PERMISSION_DENIED_EMITTER` · `CONFLUENCE_PERMISSION_DENIED_EMITTER`) 으로 emit 되나, `NestJS EventEmitter` (0 hit · dep 미등재) 도 `NotificationService` (0 hit) 도 없고 종착점은 `prisma/schema.prisma` 513 행 `model PermissionDeniedRecord` **영속** 이다. transport 는 재측정으로 `axios` · `undici` · `HttpModule` · `ProxyAgent` **0 hit** 확인 (실 transport `globalThis.fetch`).
- **AC 2 판정** — 검증 가능 **13 = 참 4 · 부분참 3 · 거짓 6**. 거짓 내역은 심볼 / 라이브러리 4 (189 · 190 · 192 · 193) · REQ 번호 1 (186) · 시점 낡음 1 (196).
- **AC 3 채택** — **(B) 단락 후반부 원문 무편집 + 후반부 말미 각주 blockquote 1 블록**. (A) 는 치환 6 지점 + 창작 필요, (C) 는 heading 의 `(REQ-020)` 이 ADR-0003 88 행 표기의 전사라 한쪽만 치환 시 정본과 어긋남, (D) 는 배포 지시 문서의 오도 risk 로 각각 기각.
- **AC 4 ~ 6 반영** — deployment.md `+5/-0` (202 → **207**, hunk 1 · 허용 구간 안 · 순수 삭제 0), audit `§ 12.38` 순수 append `+113/-0` (3735 → **3848**), `grep -c '^## '` deployment.md 6 · audit 12 불변 · `^| REQ-` 66 불변 · `^### 12\.` 37 → **38**. `src/` · `test/` · `prisma/` · `web/` · `deploy/` · `docs/requirements.md` · `package.json` 무변경, 변경 파일 **3**.
- **AC 5 closure** — T-1439 Follow-up 1 을 닫고 `## 외부 네트워크 boundary` 단락 전체 (전반부 `§ 12.37` + 후반부 `§ 12.38`) 를 완결 선언했다. deployment.md 잔여 미대조는 **3 단락** (`## Secret / 자격증명 저장` · `## DB / Persistence` · `## 개요`).
- **AC 8** — `commitMode: direct` doc-only (production code 0 LOC · 분기 0) 라 R-110 tester 호출 · R-112 4 항목 · `pnpm test:cov` 는 N/A (`§ 12.38` 에 명시). 측정은 전부 read-only.

## Follow-ups

1. **`## Secret / 자격증명 저장` ↔ `deploy/env.prod.example` 대조 (다음 slice 1 순위)** — 81 ~ 106 행의 env 주입 방식 · secret 종류 · rotation 정책이 행 단위로 직접 대조 가능해 잔여 3 중 claim 밀도가 가장 높다.
2. **deployment.md 잔여 2 단락** — `## DB / Persistence` (ADR-0002 · `prisma/` 대조) → `## 개요`.
3. **REQ 번호 체계 잔재 전수 sweep** — 권한 부족을 `REQ-020` 으로 지칭하는 [ADR-0003](../decisions/ADR-0003-deployment.md) 88 행 · [T-0015](T-0015-adr-0003-deployment-rest.md) 126 행 등. 문서 쌍 단위 처리 + REQ 재번호 owner 게이트라 별도 slice.
4. **UC-08 `§ 5` 권한 부족 흐름 ↔ 실 emitter / record 정합** — 본 slice 의 심볼 판정 승계 여지.
5. **UC-09 `§ 5` sequence participant 병기** — 22 회째 이월.
6. **정본 [modules.md](../architecture/modules.md) "WebModule 의 frontend 분리" 카운트 claim 대조** — `§ 12.34` Follow-up 1 미소진 (ADR 게이트).
7. **행 번호 → anchor 좌표계 이행** — 16 회째 이월.
8. **산문 tally ↔ 실측 CI drift-guard spec** — `pr` mode 소관.
