---
id: T-1441
title: deployment.md `## Secret / 자격증명 저장` 단락 (81 ~ 106 행 — 도입 문단 · `### 운영 환경 secret 주입 방식` · `### 개발 환경 .env 정책` · `### Secret 의 종류 (참고)` · `### Secret rotation 정책`) 의 검증 가능 claim ↔ 실 `deploy/env.prod.example` · `docker-compose.yml` · `deploy/*.service` · `.gitignore` · `package.json` · `src/` 대조 + T-1440 Follow-up 1 계승 + audit §12.39
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-029, REQ-043, REQ-051]
estimatedDiff: 210
estimatedFiles: 3
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1440]
touchesFiles:
  - docs/architecture/deployment.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1441-deployment-md-secret-section-vs-deploy-audit.md
plannerNote: "uc-doc-audit-resync 53 번째 slice — T-1440 Follow-up 1 (Secret 단락 ↔ deploy/env.prod.example) 1 순위 계승. doc-only 1.6x"
---

# T-1441 — deployment.md `## Secret / 자격증명 저장` 단락 ↔ 실 배포 자산 · env template · 의존성 목록 대조

## Why

[T-1440](T-1440-deployment-md-network-boundary-tail-vs-src-audit.md) 이 [deployment.md](../architecture/deployment.md) `## 외부 네트워크 boundary` 단락을 완결하면서 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.38`), 잔여 3 단락 중 **`## Secret / 자격증명 저장` 을 다음 slice 1 순위** 로 명시 이월했다 (T-1440 Follow-up 1). 근거는 이 단락이 env 변수 이름 · 주입 방식 · secret 종류 · rotation 정책을 열거해 **실 배포 자산 ([deploy/env.prod.example](../../deploy/env.prod.example) · `docker-compose.yml` · `deploy/assessment-agent-redeploy.service`) 과 행 단위로 직접 대조 가능** 하다는 것이다 — 잔여 3 단락 중 검증 가능 claim 밀도가 가장 높다.

본 slice 는 그 이월을 계승해 단락 1 개를 닫는다. 이 단락은 P1 T-A2 시점 blueprint 라 그 후 P3 ~ P7 에서 실제 배포 경로 (docker compose + systemd timer 재배포) 가 확정된 사실을 반영하지 못했을 가능성이 크다.

planner 사전 확인 — **아래는 전부 가설이며 전제가 아니다** (T-1437 Follow-up 4 · T-1440 AC 1 이 planner 기대를 실측으로 반증한 선례가 2 회 있다). executor 는 AC 1 에서 전부 재측정하고, **기대와 다르면 그 축의 편집을 중단** 한다. ① 85 행의 "`@nestjs/config` 의 `ConfigModule` 패턴 **채택**" 과 97 행의 "`ConfigModule.forRoot({ envFilePath, validationSchema })` 로 schema validation **강제**" 는 `@nestjs/config` 가 `package.json` 에 없고 `src/main.ts` 주석이 "의도적으로 도입하지 않음" 을 자인할 가능성이 있어 **거짓 또는 부분참 (ADR 결정은 실재하나 구현 미도입)** 쪽. ② 89 행의 systemd `EnvironmentFile=/etc/assessment-agent.env` 는 실 배포 자산이 docker compose + `deploy/assessment-agent-redeploy.service` (재배포 oneshot) 라 **경로 · 디렉티브가 어긋날** 가능성. ③ 95 행의 "`.env` 는 `.gitignore` 에 등록 (실제 등록은 P3 / P4 도입 task 가 처리)" 은 `.gitignore` 실측에서 이미 등록됐을 가능성 — 그러면 **시점 서술만 낡음**. ④ 96 행의 "본 task 는 `.env.example` 작성하지 않음 — 별도 task 가 작성" 은 `deploy/env.prod.example` 이 실재하므로 **낡은 시점 서술** 이되 **파일 이름이 `.env.example` 이 아니라는 차이** 도 함께 본다. ⑤ 101 행 `### Secret 의 종류` 의 6 종 열거는 실 template 의 key 집합과 어긋날 가능성 — 특히 **LLM 5 종 API key 가 env 가 아니라 DB `LlmProviderConfig` + `LLM_APIKEY_ENC_KEY` 경유** 일 수 있고, "JWT secret 또는 session secret" 은 `AUTH_JWT_SECRET` 으로 확정됐을 수 있다. ⑥ 105 행의 "구체 도입은 **P3 / P4 / P7 의 task 책임**" 은 현 phase 가 P4-complete / P5-in-progress 라 **시점 서술이 낡았을** 가능성. ⑦ 수동 rotation 방침 · vault 미도입은 **설계 가정** 이라 검증 불가 claim 일 가능성.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/deployment.md` — **207 행**. 다음 구간만 읽는다.
  - **81 ~ 106 행** (`## Secret / 자격증명 저장` heading + 도입 문단 + `### 운영 환경 secret 주입 방식` + `### 개발 환경 .env 정책` + `### Secret 의 종류 (참고)` + `### Secret rotation 정책`) — 본 slice 의 **주 편집 후보 구간**.
  - **1 ~ 4 행** (문서 성격 선언 blockquote — "본 문서는 P1 T-A2 의 산출물") — **무편집**, 판정의 최강 제약.
  - **181 ~ 184 행 · 203 ~ 207 행** (T-1439 · T-1440 이 삽입한 각주 blockquote) — **무편집, 읽기만**. 각주 화법 승계용 template.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **3848 행**. **`### 12.15`** (시점 기록 append-only 처리 방침 정본) · **`### 12.38`** (**3722** 행 — T-1440 판정표 화법 template + Follow-up 1 원문) · **`## 11. References` (3835 행)** — `§ 12.39` 삽입 위치 경계.
- `deploy/env.prod.example` — **무편집, 읽기만**. 실 env key 집합 · 주석의 주입 절차 판정 입력 (본 slice 의 **핵심 대조 상대**).
- `docker-compose.yml` · `deploy/assessment-agent-redeploy.service` · `deploy/README.md` — **무편집, 읽기만**. 운영 주입 방식 축 (env_file / EnvironmentFile) 판정 입력. **필요한 부분만 grep** 으로 인용한다 (전문 read 금지 — §7).
- `.gitignore` · `package.json` — **무편집, 읽기만**. `.env` 등록 축 · `@nestjs/config` 의존성 축 판정 입력.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.39` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 편집을 중단** 하고 불성립 사실을 `§ 12.39` 에 기록한다 (Why 의 ① ~ ⑦ 은 가설일 뿐이다).
  - (i) **단락 원문 + 좌표 재확인**: `grep -n '^#\{1,3\} ' docs/architecture/deployment.md` 로 heading 좌표를 **먼저 실측** 한 뒤 (본 AC 의 `81 ~ 106 행` 도 stale 일 수 있다 — T-1436 ~ T-1439 선례) 해당 범위를 `sed -n` 으로 인용한다. 이어 **실측으로 참·거짓을 가릴 수 있는 claim** (패키지명 · env 변수명 · 파일 경로 · systemd 디렉티브 · phase 표기) 만 뽑아 열거하고, 순수 설계 가정 · 운영 권장 서술 (파일 권한 `0600` 권장 · 수동 rotation 방침 등) 은 **검증 불가 claim** 으로 분류해 판정 대상에서 제외한다. 이 이분 자체를 남긴다.
  - (ii) **`@nestjs/config` 축 (85 · 97 행)**: `grep -n '"@nestjs/' package.json` 로 의존성 목록을 인용하고, `grep -rn "@nestjs/config\|ConfigModule" src --include='*.ts' | grep -v spec | head -8` 로 실 사용 여부를 인용한다. hit 이 주석뿐이면 **"주석 hit 만 N" 임을 그대로 기록** 하고, 결정 (ADR-0003 §2) 은 실재하되 구현이 미도입인지 1 구로 판정한다. 판정은 `참 / 부분참 / 거짓` 중 하나.
  - (iii) **운영 주입 방식 축 (89 ~ 91 행)**: `grep -rn "EnvironmentFile\|env_file\|--env-file" docker-compose.yml deploy/ 2>/dev/null | head -8` 로 실 주입 디렉티브를 인용하고, `grep -n "ExecStart\|Environment=" deploy/assessment-agent-redeploy.service` 로 실 unit file 의 성격 (재배포 oneshot 인지 앱 실행 unit 인지) 을 인용해 대조한다. 문서가 적은 `/etc/assessment-agent.env` 경로가 실재 자산에 있는지 `ls /etc/assessment-agent.env 2>&1` 가 아니라 **repo 안 grep 결과로만** 판정한다 (배포 호스트 상태는 측정 대상이 아니다).
  - (iv) **`.env` 등록 · template 축 (95 ~ 96 행)**: `grep -n "env" .gitignore | head -10` 으로 등록 여부를 인용하고, `ls -1 .env.example deploy/env.prod.example 2>&1` 로 **어느 이름의 template 이 실재하는지** 인용한다. 문서의 "별도 task 가 작성" 이 이미 이행됐는지, 이행됐다면 **이름이 `.env.example` 이 아니라 `deploy/env.prod.example` 인 차이** 를 1 구로 판정한다.
  - (v) **Secret 종류 축 (101 행)**: `grep -n '^[A-Z_]\+=' deploy/env.prod.example` + `grep -n '^# [A-Z_]\+=' deploy/env.prod.example | head -20` 로 **active key 와 주석 처리된 optional key 를 구분해** 인용한다. 이어 `grep -rn "LLM_APIKEY_ENC_KEY\|AUTH_JWT_SECRET" src --include='*.ts' | grep -v spec | head -6` 으로 앱이 실제 읽는 env 이름을 인용해, 문서의 6 종 열거 (GitHub PAT / Confluence PAT / **LLM 5 종 API key** / `DATABASE_URL` / **JWT 또는 session secret**) 를 항목별로 대조한다. 특히 **LLM API key 가 env 경유인지 DB `LlmProviderConfig` 경유인지**, **GitHub / Confluence 자격이 env 에 있는지** 를 각각 1 구로 판정한다 (열거 6 항목의 개별 판정표 row 를 만든다).
  - (vi) **시점 서술 축 (95 · 96 · 105 행)**: `grep -n '"phase"' docs/STATE.json | head -2` 의 현 phase 값과 (iv) · (v) 실측을 대조해, "실제 등록은 P3 / P4 도입 task 가 처리" · "본 task 는 `.env.example` 작성하지 않음" · "구체 도입은 P3 / P4 / P7 의 task 책임" 이 **이미 지난 시점을 미래로 서술하는지** 판정한다. `§ 12.15` 의 시점 기록 append-only 방침이 이 축에 어느 강도로 걸리는지 1 구로 논증한다.
  - (vii) **pointer 유효성 축 (83 행)**: `grep -n '^## \|^### ' docs/decisions/ADR-0003-deployment.md | head -12` 로 인용된 **`§2 — env + @nestjs/config`** 절이 실재하는지 확인한다. **ADR 본문 재판정 · status 변경은 하지 않는다** (절 존재 = pointer 유효까지만).
  - (viii) baseline — `wc -l` deployment.md **207** · audit **3848** · directory.md **203** · modules.md **259**, `grep -c '^## '` deployment.md **6** · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **38**.
- [ ] **AC 2 — 지점 판정표**: AC 1 이 뽑은 **검증 가능 claim** 각각에 대해 `in-place 수정` / `원문 보존 + 각주 부기` / `무편집` / `상위 slice 판정 승계` 중 하나를 판정한 표를 만든다. 각 row 는 **지점 (행) · claim 1 구 · 실측 결과 · 판정 (참 / 부분참 / 거짓) · 처리 · 근거 1 구** 6 컬럼.
  - 판정 기준 **3 축** 명시 — ① **문서 성격** (1 ~ 4 행 blockquote 의 P1 T-A2 blueprint 선언에 `§ 12.15` append-only 제약이 어느 강도로 걸리는가), ② `§ 12.15` **정합** (본 단락에 시점 marker 가 있는지 실측 grep 으로 근거를 둔다 — 95 · 96 · 105 행이 그 marker 후보다), ③ **선례** (T-1430 ~ T-1435 · T-1437 ~ T-1440 의 "원문 보존 + 실측 각주" vs [T-1429](T-1429-api-md-module-vocab-and-uc-range-resync.md) 의 in-place 1:1 치환 vs [T-1436](T-1436-directory-md-web-frontend-section-vs-src-audit.md) 의 혼합 채택).
  - **`### Secret 의 종류` 열거 6 항목은 항목별 row 로 분리 판정** 한다 — 6 항목의 판정이 서로 갈릴 가능성이 높으므로 (예: `DATABASE_URL` 참 · LLM 5 종 부분참) 뭉뚱그리지 않는다.
  - **거짓 축 (의존성 · 주입 경로) 과 시점 축 (`.gitignore` 등록 · template 작성 · P3/P4/P7) 의 처리를 분리 판정** 한다 — 두 축의 처리가 갈려도 무방하나 그 이유를 각각 1 구로 적는다.
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) **전 지점 in-place 동기** (주입 방식 · secret 종류 재작성 포함), (B) **단락 원문 무편집 + 단락 말미 각주 blockquote 1 개 신설** (T-1437 ~ T-1440 화법 승계), (C) **혼합** (시점 서술만 in-place, 나머지는 각주), (D) **전 지점 무편집 + audit 기록만**.
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` 정합, ② **오도 risk** (독자가 본 단락을 배포 지시로 읽고 `@nestjs/config` 설정을 찾거나 `/etc/assessment-agent.env` 를 만들 때의 비용 — **secret 취급 문서라 risk 가중치가 특히 높다** 는 점을 1 구로 논증), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 자동 기각 + split 제안 기록), ④ 선례 일관성.
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다. 각 지점은 AC 2 판정 결과를 따른다.
  - **deployment.md 편집은 각주 blockquote 1 개 (≤ 5 행) + in-place 치환 (≤ 2 지점) 이내** — `wc -l` 증가 **+6 이내** (207 → ≤ 213).
  - **문구·env 변수명·파일 경로·패키지명은 AC 1 실측 출력과 1:1 일치** 해야 하며, 실측되지 않은 값 (존재하지 않는 env 이름, 미도입 vault, 배포 호스트의 실제 파일 경로) 을 **새로 창작하지 않는다**.
  - **secret 값 · placeholder 실값을 문서에 옮겨 적지 않는다** — 변수 **이름** 까지만 인용한다 (CLAUDE.md §9).
  - **1 ~ 4 행 blockquote 무편집** · **`## Secret / 자격증명 저장` 밖 전 구간 무편집** (`## 개요` · `## DB / Persistence` · `## 배포 토폴로지` · `## Scheduler 위치` · `## 외부 네트워크 boundary` 및 T-1437 ~ T-1440 각주).
  - **새 pointer 추가 금지** — ADR-0003 외의 문서를 본문에 새로 등재하지 않는다 (audit 쪽에만 기록).
- [ ] **AC 5 — audit `§ 12.39` 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 `## 11. References` (3835 행) **직전** 에 `### 12.39 …` 절을 **순수 append** 한다 (기존 절 수정 0). 구성 — 본 절의 위치 · 계보 1 문단 / AC 1 실측 (명령 + 출력) / AC 2 지점 판정표 (열거 6 항목 row 포함) / AC 3 처리 판정표 / AC 4 반영 결과 + 무편집 경계 / **T-1440 Follow-up 1 closure 선언 + `## Secret / 자격증명 저장` 단락 closure 선언** / **deployment.md 잔여 미대조 갱신** (단락 2 — `## DB / Persistence` · `## 개요`) / 파생 영향 (목록만) / 불변 검산 / 한계. **절 전체 ≤ 115 행** (cap 준수 — 초과 시 실측 인용을 요약형으로 압축).
  - `###` 레벨이라 `grep -c '^## '` **12 불변** · `grep -c '^| REQ-'` **66 불변** · `grep -c '^### 12\.'` **38 → 39**.
- [ ] **AC 6 — 불변 검산**: 다음을 실행해 출력을 `§ 12.39` 에 인용한다. `wc -l` deployment.md (207 → ≤ 213) · audit (3848 → +115 이내) · directory.md (**203 불변**) · modules.md (**259 불변**), `git diff -U0 -- docs/architecture/deployment.md | grep '^@@'` 로 **hunk 개수 · 위치** 를 보이고 AC 4 허용 구간 밖 hunk **0** 을 실증, `git diff --numstat` 으로 **순수 삭제 0** (삭제 행이 있으면 in-place 치환의 짝임을 1 구로 설명), `git status --porcelain src/ test/ prisma/ web/ deploy/ docker-compose.yml .gitignore package.json` **빈 출력** (코드·배포자산·의존성 무변경), `git status --porcelain` 이 **3 파일** 임을 확인.
- [ ] **AC 7 — 파생 영향 기록 (목록만, 본 slice 편집 금지)**: `§ 12.39` 말미에 후속 slice 대상을 목록으로 남긴다. 최소 포함 — (1) **deployment.md 잔여 미대조 단락 2** 중 `## DB / Persistence` 를 **다음 slice 1 순위** 로 지정 + 근거 1 구 (ADR-0002 · `prisma/` · migration 자산과 직접 대조 가능), (2) `## 개요` 우선순위, (3) **`@nestjs/config` 미도입 사실의 다른 문서 전수 sweep** — 같은 채택 서술이 [ADR-0003](../decisions/ADR-0003-deployment.md) · [T-0015](T-0015-adr-0003-deployment-rest.md) 등에 있는지는 본 slice 범위 밖이며 별도 slice 소관 (ADR 재판정은 owner 게이트), (4) **`deploy/README.md` ↔ deployment.md 배포 절차 정합** (두 문서가 같은 주제를 각자 서술 — 정본 지정 판정 필요), (5) REQ 번호 체계 잔재 전수 sweep (`§ 12.38` Follow-up 3 미소진), (6) UC-09 `§ 5` sequence participant 병기 (23 회째 이월), (7) 정본 [modules.md](../architecture/modules.md) "WebModule 의 frontend 분리" 단락 카운트 claim 대조 (`§ 12.34` Follow-up 1 미소진 — ADR 게이트), (8) 행 번호 → anchor 좌표계 이행 (17 회째), (9) 산문 tally ↔ 실측 CI drift-guard spec (`pr` mode 소관).
- [ ] **AC 8 — R-110 / R-112 면제 근거 명시**: 본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 **N/A** 임을 `§ 12.39` 에 1 구로 명시한다.
- [ ] **AC 9 — 언어 · 링크 규약**: 추가 문장은 모두 한국어 (§12), 문서 간 참조는 상대경로 markdown 링크, 수치는 실측 출력과 1:1 일치.

## Out of Scope

- **코드 · 스키마 · 배포 자산 변경 절대 금지** — `src/` · `test/` · `prisma/` · `web/` · `scripts/` · `deploy/` · `docker-compose.yml` · `Dockerfile` · `.gitignore` · `package.json` 은 diff 에 등장하면 안 된다. 특히 `@nestjs/config` 의존성 추가, `ConfigModule` 배선, `.env.example` 신설, env key 추가는 **어떤 경우에도 하지 않는다** (문서를 실제에 맞출 뿐, 실제를 문서에 맞추지 않는다). 새 dependency 는 CLAUDE.md §5 BLOCKED 사유이기도 하다.
- **secret 값 노출 금지** — `deploy/env.prod.example` 의 placeholder 라도 값 문자열을 audit / deployment.md 에 옮겨 적지 않는다. 변수 **이름** 까지만 (§9).
- **배포 호스트 상태 측정 금지** — `/etc/assessment-agent.env` 실재 여부 등 repo 밖 파일시스템은 판정 대상이 아니다. repo 안 자산만 근거로 삼는다.
- **테스트 · 빌드 · docker 실행 금지** — `pnpm build` · `pnpm test` · `docker compose` 어느 것도 실행하지 않는다 (측정만).
- **[deploy/README.md](../../deploy/README.md) 편집 금지** — 정합 판정 필요 사실은 파생 영향 목록에만 남긴다.
- **deployment.md 의 `## Secret / 자격증명 저장` 밖 단락 편집 금지** — 잔여 2 단락 (`## DB / Persistence` · `## 개요`) 과 T-1437 ~ T-1440 각주는 무편집.
- **ADR-0003 본문 재판정 · status 변경 금지** — `§2` 절 존재 확인까지만. 결정 자체 (env + `@nestjs/config`) 의 번복은 owner 게이트.
- **정본 [modules.md](../architecture/modules.md) · [directory.md](../architecture/directory.md) · [api.md](../architecture/api.md) 편집 금지** — 본 slice 는 deployment.md Secret 축만 닫는다.
- **다른 문서로의 cascade 금지** — [components.md](../architecture/components.md) · [data-model.md](../architecture/data-model.md) · `docs/architecture/INDEX.md` · [INDEX.md](../use-cases/INDEX.md) · `UC-01` ~ `UC-09` · ADR · [PLAN.md](../PLAN.md) · [requirements.md](../requirements.md) 는 무편집.
- **행 번호 → anchor 좌표계 이행 금지** — 파생 영향 목록에만 남긴다 (17 회째 이월).
- **CI drift-guard spec 작성 금지** — `pr` mode 소관이라 본 direct task 에서 진행하면 §3.1 위반.
- **audit 기존 절 (`§ 12.1` ~ `§ 12.38`) 수정 금지** — `§ 12.39` 순수 append 만.

## Suggested Sub-agents

`implementer` 단독 (doc-only, 코드 0 LOC — architect · tester 불요. §3.2 direct-mode 면제).

## 결과 요약

- **채택안 = (B) 원문 무편집 + 단락 말미 각주 blockquote 1 블록 (5 행)**. AC 3 의 (A) · (C) · (D) 는 각각 치환 지점 8 (`≤ 2` 초과) · 시점 축의 새 phase 배정 창작 필요 · secret 미주입 기동 risk 로 기각.
- **판정 합계 — 검증 가능 19 row = 참 6 · 부분참 5 · 거짓 8**, 검증 불가 5 (파일 권한 `0600` 권장 · 전용 user 권장 · 수동 rotation 방침 · vault 전망 · reviewer 점검 규범) 는 대상 제외. 거짓 8 = 주입 경로 2 (89 · 91) · 배선 1 (97) · 열거 2 (101-c LLM key · 101-f session secret) · 시점 3 (95 · 96 · 105).
- **planner 가설 검증 결과** — ① `@nestjs/config` 미도입 = **부분참 / 거짓** 확정 (dep 미등재 · `src/` hit 7 전부 주석 · `main.ts` 2 행 자인 · `process.env` 24 곳), ② systemd 경로 어긋남 = **거짓** 확정 (실 경로는 compose `env_file: - .env`, unit 은 재배포 oneshot), ③ `.gitignore` 이미 등록 = 확인 (15 ~ 17 행), ④ **가설 일부 반증** — `.env.example` 이 repo 루트에 **실재 · tracked (20 행)** 라 "commit 해 schema 공유" 는 참이고 낡은 것은 "본 task 는 작성하지 않음" 시점 서술뿐, ⑤ LLM key 는 env 아닌 **DB `LlmProviderConfig.apiKey`** (거짓) · JWT 는 `AUTH_JWT_SECRET` (+ refresh) 로 참, ⑥ 105 행 phase 서술 낡음 확인, ⑦ rotation 방침은 검증 불가 분류.
- **불변 검산** — deployment.md 207 → **213** (+6/-0, hunk 1 = `@@ -106,0 +107,6 @@`) · audit 3848 → **3962** (+114, `§ 12.39` 114 행) · directory.md **203** · modules.md **259** 불변 · `^## ` 6 / 12 불변 · `^| REQ-` **66** 불변 · `^### 12\.` 38 → **39** · `src/` · `deploy/` · `docker-compose.yml` · `.gitignore` · `package.json` 무변경 · 변경 **3 파일**.
- **R-110 / R-112** — `commitMode: direct` doc-only (production code 0 LOC · 분기 0) 라 CLAUDE.md §3.2 면제, `pnpm build` · `pnpm test` · `docker compose` 미실행 (측정은 전부 read-only).

## Follow-ups

1. **`## DB / Persistence` (15 ~ 49 행) = 다음 slice 1 순위** — ADR-0002 · `prisma/schema.prisma` · `prisma/migrations/` 와 직접 대조 가능. 이후 `## 개요` (5 ~ 14 행) 를 닫으면 deployment.md 전 단락 대조 완결.
2. **`@nestjs/config` 미도입 사실의 다른 문서 전수 sweep** — ADR-0003 §2 · T-0015 등의 동일 "채택" 서술은 ADR 재판정 owner 게이트 소관 (본 slice 범위 밖).
3. **`deploy/README.md` ↔ deployment.md 배포 절차 정합** — 같은 주제를 두 문서가 각자 서술, 정본 지정 판정 필요.
4. **`deploy/env.prod.example` 의 Confluence key 부재** — template 결손인지 의도인지 미판정 (`deploy/` 소관, 본 slice 무편집).
5. 이월 — REQ 번호 체계 전수 sweep (`§ 12.38` Follow-up 3) · UC-09 `§ 5` participant 병기 (23 회째) · modules.md 카운트 claim 대조 (`§ 12.34` Follow-up 1) · 행 번호 → anchor 좌표계 이행 (17 회째, 본 각주로 `## Scheduler 위치` 이후 좌표 **+6** 이동) · 산문 tally drift-guard spec (`pr` mode 소관).
