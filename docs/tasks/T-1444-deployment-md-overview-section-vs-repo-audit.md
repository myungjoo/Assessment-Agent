---
id: T-1444
title: deployment.md `## 개요` (5 ~ 13 행) 의 검증 가능 claim ↔ 실 `Dockerfile` · `docker-compose.yml` · `deploy/` · `docs/architecture/INDEX.md` · `components.md` · `ADR-0003` · `docs/ops/runbook.md` 대조 + T-1443 Follow-up 1 계승 + audit §12.42 (deployment.md 전 단락 대조 완결)
phase: P5
status: DONE
completedAt: 2026-08-04T07:50:00Z
commitMode: direct
coversReq: [REQ-029, REQ-047]
estimatedDiff: 200
estimatedFiles: 3
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1443]
touchesFiles:
  - docs/architecture/deployment.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1444-deployment-md-overview-section-vs-repo-audit.md
plannerNote: "uc-doc-audit-resync 56 번째 slice — T-1443 Follow-up 1 (`## 개요` = 잔여 마지막 단락) 계승. doc-only 1.6x, 닫으면 deployment.md 완결"
---

# T-1444 — deployment.md `## 개요` ↔ 실 배포 자산 · 참조 문서 대조 (deployment.md 마지막 단락)

## Why

[T-1443](T-1443-deployment-md-db-persistence-tail-vs-prisma-audit.md) 이 [deployment.md](../architecture/deployment.md) `## DB / Persistence` 후반부를 각주 1 블록으로 닫으면서 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.41`), **잔여 미대조 단락이 `## 개요` 1 개뿐** 임을 확인하고 이를 다음 slice 1 순위로 이월했다 (T-1443 Follow-up 1). 본 slice 를 닫으면 deployment.md 의 **전 단락 대조가 완결** 되고 uc-doc-audit-resync 의 deployment.md 축이 종료된다.

본 slice 는 `## 개요` 4 문단 (현 7 · 9 · 11 · 13 행) 을 대상으로, ① "구체적인 manifest (Dockerfile / docker-compose.yml / Kubernetes manifest 등) 는 다루지 않는다 — 그것은 P7 phase 의 운영 task 책임" 이라는 **범위 + 시점 claim ↔ 실 repo 배포 자산**, ② [INDEX.md](../architecture/INDEX.md) `MVA 원칙` · [components.md](../architecture/components.md) `T-0016 산출물` · [runbook.md](../ops/runbook.md) 3 개 **pointer 의 실재 여부**, ③ "[ADR-0003](../decisions/ADR-0003-deployment.md) (Deployment **4 결정**)" 의 **개수 claim ↔ 실 ADR heading**, ④ 문서 자기규정 ("ADR 이 결정의 source of truth, 본 문서는 view layer") 이 이후 slice 들이 실측한 doc↔code drift 와 어떻게 정합하는지를 대조한다.

planner 사전 확인 — **아래는 전부 가설이며 전제가 아니다** (T-1437 Follow-up 4 · T-1440 AC 1 · T-1441 가설 ④ · T-1442 가설 ⑧ · T-1443 가설 ② 가 planner 기대를 실측으로 반증한 선례가 5 회 있다). executor 는 AC 1 에서 전부 재측정하고, **기대와 다르면 그 축의 편집을 중단** 한다. ① 7 행의 "manifest 는 다루지 않는다" 는 **문서 자신의 범위 선언** 이라 참·거짓 대상이 아니지만, 붙어있는 "**그것은 P7 phase 의 운영 task 책임**" 은 시점 claim 이라 판정 대상 — planner 실측상 `Dockerfile` · `docker-compose.yml` 이 repo 루트에 **이미 실재** 하고 `deploy/` 에 systemd unit · `redeploy.sh` 등 배포 자산 15+ 개가 실재해 **"앞으로 P7 에서" 화법이 낡았을** 가능성이 높다 (반면 **Kubernetes manifest 는 부재** 로 보여 축이 갈릴 수 있다 — 자산별로 분리 판정해야 한다). ② 7 행 `INDEX.md 의 MVA 원칙` pointer 는 **참** 쪽 (planner grep 상 `docs/architecture/INDEX.md` 54 행에 `## MVA 원칙` 실재). ③ 11 행 "components.md (T-0016 의 산출물)" 은 **참** 쪽 (components.md 3 행 blockquote 가 `P1 T-A3 의 산출물 … T-0016` 로 자기선언). ④ 9 행 "ADR-0003 (Deployment **4 결정**)" 은 **참** 쪽 (ADR-0003 에 `### Decision §1` ~ `§4` 4 개 실재) — 다만 개수 claim 은 drift 하기 쉬우므로 실측 필수. ⑤ 13 행 runbook pointer 는 **참** 쪽 (`docs/ops/runbook.md` 실재) 이나 "배포·복구·trouble-shoot **실행 절차**" 라는 성격 claim 이 실 목차와 맞는지는 heading 수준에서 확인해야 한다. ⑥ 9 행 "ADR 이 결정의 source of truth 이고, 본 문서는 … 도식 / 텍스트 설명" 은 **자기규정** 이라 검증 불가 claim 으로 분류될 가능성이 크지만, T-1437 ~ T-1443 이 본 문서에서 실측한 drift 누적과의 긴장을 각주에서 1 구로 다룰 가치가 있다.

**행 좌표 주의** — T-1443 각주가 `### 후속 진행` 말미에 들어가 deployment.md 는 현재 **226** 행이지만, 본 slice 범위 (`## 개요` heading **5** · 본문 **7 ~ 13** · 다음 heading `## DB / Persistence` **15**) 는 문서 앞머리라 **밀리지 않았다**. 그래도 AC 1 (i) 에서 재실측한다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/deployment.md` — **226 행**. 다음 구간만 읽는다.
  - **5 ~ 13 행** (`## 개요` heading + 본문 4 문단) — 본 slice 의 **주 편집 후보 구간**.
  - **1 ~ 4 행** (문서 성격 선언 blockquote — "본 문서는 P1 T-A2 의 산출물") — **무편집**, 판정의 최강 제약. pointer 실재 확인은 하되 손대지 않는다.
  - **15 ~ 45 행** (`## DB / Persistence` 도입 + T-1442 각주) — **무편집, 경계 확인 + 각주 화법 승계용** 으로만 읽는다.
  - **46 행 이후** — **무편집, 경계 확인만** (T-1437 ~ T-1443 이 이미 닫음).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **4178 행**. **`### 12.15`** (**1002** 행 — 시점 기록 append-only 처리 방침 정본) · **`### 12.41`** (**4059** 행 — T-1443 판정표 화법 template + Follow-up 1 원문) · **`## 11. References` (4165 행)** — `§ 12.42` 삽입 위치 경계. **그 밖의 절은 열지 않는다** (§7).
- `docs/architecture/INDEX.md` — **무편집, 읽기만**. `MVA 원칙` 절 실재 판정 입력. **heading grep 인용만**.
- `docs/architecture/components.md` — **무편집, 읽기만**. "T-0016 의 산출물" claim 판정 입력. **1 ~ 5 행 blockquote 만** 인용.
- `docs/decisions/ADR-0003-deployment.md` — **무편집, 읽기만**. "Deployment 4 결정" 개수 claim 판정 입력. **heading 목록만**. 본문 재판정 · status 변경 금지.
- `docs/ops/runbook.md` — **무편집, 읽기만**. "배포·복구·trouble-shoot 실행 절차" 성격 claim 판정 입력. **heading grep 인용만**.
- `docs/PLAN.md` — **무편집, 읽기만**. `## Phase P7` heading 존재 · 진행 표기만 확인 (7 행 시점 축 판정 입력). 본문 재판정 금지.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.42` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 편집을 중단** 하고 불성립 사실을 `§ 12.42` 에 기록한다 (Why 의 ① ~ ⑥ 은 가설일 뿐이다).
  - (i) **단락 원문 + 좌표 재확인**: `grep -n '^#\{1,3\} ' docs/architecture/deployment.md | head -6` 로 heading 좌표를 **먼저 실측** 한 뒤 (본 AC 의 `5 ~ 13 행` 도 stale 일 수 있다 — T-1436 ~ T-1443 선례) 해당 범위를 `sed -n` 으로 인용한다. 이어 **실측으로 참·거짓을 가릴 수 있는 claim** (파일 경로 · 문서 pointer · 절 이름 · 결정 개수 · phase 표기) 만 뽑아 열거하고, 순수 범위 선언 · 자기규정 (`본 문서는 … 를 박제한다` · `ADR 이 source of truth` 등) 은 **검증 불가 claim** 으로 분류해 판정 대상에서 제외한다. 이 이분 자체를 남긴다.
  - (ii) **manifest 자산 축 (7 행)**: `ls -1 Dockerfile docker-compose.yml 2>/dev/null` · `ls -1 deploy | head -12` · `ls -d k8s kubernetes helm chart 2>/dev/null || echo "none"` 로 실 자산을 인용해, "Dockerfile / docker-compose.yml / Kubernetes manifest 는 다루지 않는다" 의 **세 자산을 각각** `repo 에 실재 / 부재` 로 분리 판정한다. 문서가 다루지 않는 것과 repo 에 없는 것은 **다른 축** 임을 1 구로 구분한다.
  - (iii) **P7 시점 축 (7 행)**: `grep -n "^## Phase P7" docs/PLAN.md` + `python -c "import json,io;print(json.load(io.open('docs/STATE.json',encoding='utf-8'))['phase'])"` 로 P7 표기와 현 phase 를 대조하고, (ii) 의 자산 실재와 합쳐 "그것은 P7 phase 의 운영 task 책임" 이 **낡음 / 여전히 유효 / 자산별로 갈림** 중 무엇인지 판정한다.
  - (iv) **pointer 3 종 축 (7 · 11 · 13 행)**: `grep -n "MVA" docs/architecture/INDEX.md | head -4` · `sed -n '1,5p' docs/architecture/components.md` · `grep -n '^## ' docs/ops/runbook.md | head -10` 으로 세 pointer 의 대상 절 · 자기선언 · 목차를 인용해 각각 `참 / 부분참 / 거짓` 판정한다. runbook 은 "배포·복구·trouble-shoot 실행 절차" 라는 **성격 claim** 이 heading 으로 뒷받침되는지까지 본다.
  - (v) **ADR 개수 축 (9 행)**: `grep -n '^### Decision §' docs/decisions/ADR-0003-deployment.md` 로 Decision 절 개수를 세어 "Deployment 4 결정" 의 수치를 대조한다. 어긋나면 **수치 drift** 로 판정하되 **ADR 은 무편집** 이다.
  - (vi) **자기규정 축 (9 행)**: "ADR 이 결정의 source of truth 이고, 본 문서는 그 반영의 도식 / 텍스트 설명" 을 검증 불가 claim 으로 두되, T-1437 ~ T-1443 이 본 문서에서 실측한 **doc↔code drift 누적** (`§ 12.36` ~ `§ 12.41` 판정표의 거짓 · 부분참 건수를 audit 에서 그대로 인용) 과의 긴장을 1 구로 논증한다. 새로 재측정하지 말고 **기존 절의 수치를 인용만** 한다 (§7).
  - (vii) baseline — `wc -l` deployment.md **226** · audit **4178** · directory.md **203** · modules.md **259**, `grep -c '^## '` deployment.md **6** · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **41**.
- [ ] **AC 2 — 지점 판정표**: AC 1 이 뽑은 **검증 가능 claim** 각각에 대해 `in-place 수정` / `원문 보존 + 각주 부기` / `무편집` / `상위 slice 판정 승계` 중 하나를 판정한 표를 만든다. 각 row 는 **지점 (행) · claim 1 구 · 실측 결과 · 판정 (참 / 부분참 / 거짓) · 처리 · 근거 1 구** 6 컬럼.
  - 판정 기준 **3 축** 명시 — ① **문서 성격** (1 ~ 4 행 blockquote 의 P1 T-A2 blueprint 선언에 `§ 12.15` append-only 제약이 어느 강도로 걸리는가), ② `§ 12.15` **정합** (본 단락에 시점 marker 가 있는지 실측 grep 으로 근거를 둔다 — 7 행 "P7 phase 의 운영 task 책임" 이 그 marker 후보다), ③ **선례** (T-1430 ~ T-1435 · T-1437 ~ T-1443 의 "원문 보존 + 실측 각주" vs [T-1429](T-1429-api-md-module-vocab-and-uc-range-resync.md) 의 in-place 1:1 치환 vs [T-1436](T-1436-directory-md-web-frontend-section-vs-src-audit.md) 의 혼합 채택).
  - **시점 축 (P7 자산 책임) 과 pointer / 수치 축 (INDEX · components · runbook · ADR 4 결정) 의 처리를 분리 판정** 한다 — 두 축의 처리가 갈려도 무방하나 그 이유를 각각 1 구로 적는다.
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) **전 지점 in-place 동기**, (B) **원문 무편집 + `## 개요` 말미 각주 blockquote 1 개 신설** (T-1437 ~ T-1443 화법 승계), (C) **혼합** (수치 · pointer 만 in-place, 시점 축은 각주), (D) **전 지점 무편집 + audit 기록만**.
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` 정합, ② **오도 risk** (독자가 문서 첫 단락만 읽고 "이 repo 에는 Dockerfile / compose 가 아직 없다" 고 오인할 때의 비용 — 첫 단락이라 노출도가 가장 높다는 점을 논거로 쓴다), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 자동 기각 + split 제안 기록), ④ 선례 일관성.
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다. 각 지점은 AC 2 판정 결과를 따른다.
  - **각주 blockquote 는 `## 개요` 본문 말미 (현 13 행) 와 `## DB / Persistence` heading (현 15 행) 사이에 삽입** 한다 — T-1442 · T-1443 이 단락 말미에 각주를 둔 배치와 동형. **각주 blockquote 1 개 (≤ 6 행) + in-place 치환 (≤ 2 지점) 이내**, `wc -l` 증가 **+7 이내** (226 → ≤ 233).
  - **문구 · 파일 경로 · 절 이름 · 수치 · phase 표기는 AC 1 실측 출력과 1:1 일치** 해야 하며, 실측되지 않은 값 (존재하지 않는 manifest 경로, 임의 phase 배정, 없는 절 이름) 을 **새로 창작하지 않는다**.
  - **secret · connection string · 실 호스트명을 문서에 옮겨 적지 않는다** (CLAUDE.md §9).
  - **1 ~ 4 행 blockquote 무편집** · **15 행 이후 전 구간 무편집** (`## DB / Persistence` · `## 배포 토폴로지` · `## Secret / 자격증명 저장` · `## Scheduler 위치` · `## 외부 네트워크 boundary` 및 T-1437 ~ T-1443 각주 전부).
  - **새 pointer 추가 금지** — 본문에 이미 등재된 문서 (INDEX.md · ADR-0002 · ADR-0003 · components.md · runbook.md) 외의 문서를 새로 등재하지 않는다 (audit 쪽에만 기록).
- [ ] **AC 5 — audit `§ 12.42` 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 `## 11. References` (4165 행) **직전** 에 `### 12.42 …` 절을 **순수 append** 한다 (기존 절 수정 0). 구성 — 본 절의 위치 · 계보 1 문단 / AC 1 실측 (명령 + 출력) / AC 2 지점 판정표 / AC 3 처리 판정표 / AC 4 반영 결과 + 무편집 경계 / **T-1443 Follow-up 1 closure 선언 + deployment.md 전 단락 대조 완결 선언** (`## 개요` · `## DB / Persistence` · `## 배포 토폴로지` · `## Secret / 자격증명 저장` · `## Scheduler 위치` · `## 외부 네트워크 boundary` 6 단락을 어느 slice 가 닫았는지 1 줄 매핑표) / **다음 문서 축 후보** / 파생 영향 (목록만) / 불변 검산 / 한계. **절 전체 ≤ 110 행** (cap 준수 — 초과 시 실측 인용을 요약형으로 압축).
  - `###` 레벨이라 `grep -c '^## '` **12 불변** · `grep -c '^| REQ-'` **66 불변** · `grep -c '^### 12\.'` **41 → 42**.
- [ ] **AC 6 — 불변 검산**: 다음을 실행해 출력을 `§ 12.42` 에 인용한다. `wc -l` deployment.md (226 → ≤ 233) · audit (4178 → +110 이내) · directory.md (**203 불변**) · modules.md (**259 불변**), `git diff -U0 -- docs/architecture/deployment.md | grep '^@@'` 로 **hunk 개수 · 위치** 를 보이고 AC 4 허용 구간 밖 hunk **0** 을 실증, `git diff --numstat` 으로 **순수 삭제 0** (삭제 행이 있으면 in-place 치환의 짝임을 1 구로 설명), `git status --porcelain src/ test/ prisma/ web/ deploy/ docker-compose.yml Dockerfile .github/ package.json README.md .claude/ docs/decisions/ docs/ops/` **빈 출력** (코드 · 스키마 · 배포자산 · CI · 의존성 · ADR · runbook 무변경), `git status --porcelain` 이 **3 파일** 임을 확인.
- [ ] **AC 7 — 파생 영향 기록 (목록만, 본 slice 편집 금지)**: `§ 12.42` 말미에 후속 slice 대상을 목록으로 남긴다. 최소 포함 — (1) **deployment.md 축 종료 선언 + 다음 문서 축 후보 1 순위** (예: [components.md](../architecture/components.md) 미대조 단락 또는 [INDEX.md](../architecture/INDEX.md)) + 선정 근거 1 구, (2) reviewer 규약 미이행 (`.claude/agents/reviewer.md` 에 REQ-032 항목 0 hit — `§ 12.41` FU2 미소진, 별도 direct task 소관), (3) `deploy/README.md` ↔ deployment.md ↔ runbook 3 자 정합 (`§ 12.41` FU3 미소진), (4) README 행 번호 pointer drift 전수 sweep, (5) `@nestjs/config` 미도입 전수 sweep (`§ 12.39` FU3, ADR 게이트), (6) REQ 번호 체계 잔재 전수 sweep (`§ 12.38` FU3 미소진), (7) `CLAUDE.md` §1 pointer 부정확 (T-1442 FU3 미소진), (8) UC-09 `§ 5` sequence participant 병기 (26 회째 이월), (9) 정본 [modules.md](../architecture/modules.md) 카운트 claim 대조 (`§ 12.34` FU1 미소진 — ADR 게이트), (10) 행 번호 → anchor 좌표계 이행 (20 회째), (11) 산문 tally ↔ 실측 CI drift-guard spec (`pr` mode 소관).
- [ ] **AC 8 — R-110 / R-112 면제 근거 명시**: 본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 **N/A** 임을 `§ 12.42` 에 1 구로 명시한다.
- [ ] **AC 9 — 언어 · 링크 규약**: 추가 문장은 모두 한국어 (§12), 문서 간 참조는 상대경로 markdown 링크, 수치는 실측 출력과 1:1 일치.

## Out of Scope

- **코드 · 스키마 · 배포 자산 · CI · agent 정의 변경 절대 금지** — `src/` · `test/` · `prisma/` · `web/` · `scripts/` · `deploy/` · `docker-compose.yml` · `Dockerfile` · `.github/workflows/` · `package.json` · `.claude/agents/` 는 diff 에 등장하면 안 된다. **Kubernetes manifest 를 새로 만들지 않는다** (문서를 실제에 맞출 뿐, 실제를 문서에 맞추지 않는다).
- **`## DB / Persistence` 이하 전 구간 (15 행 이후) 편집 금지** — T-1437 ~ T-1443 이 이미 닫았다. 그 각주의 문구 · 수치도 손대지 않는다.
- **1 ~ 4 행 blockquote 편집 금지** — pointer 실재 확인까지만. 문서 성격 선언은 판정의 제약이지 편집 대상이 아니다.
- **ADR-0003 · ADR-0002 본문 재판정 · status 변경 금지** — Decision 절 개수 확인까지만.
- **[docs/ops/runbook.md](../ops/runbook.md) · [components.md](../architecture/components.md) · [INDEX.md](../architecture/INDEX.md) 편집 금지** — 정합 판정 필요 사실은 파생 영향 목록에만 남긴다.
- **`docs/PLAN.md` 편집 금지** — P7 표기 확인까지만. phase 상태 갱신은 driver 소관.
- **빌드 · 배포 · DB 접속 실행 금지** — `docker compose up` · `docker build` · `pnpm build` · `pnpm test` · `prisma migrate` 어느 것도 실행하지 않는다 (측정은 전부 read-only grep / ls / sed).
- **배포 호스트 상태 측정 금지** — repo 밖 파일시스템 · 실 서버 · 실 container 는 판정 대상이 아니다.
- **정본 [modules.md](../architecture/modules.md) · [directory.md](../architecture/directory.md) · [api.md](../architecture/api.md) · [data-model.md](../architecture/data-model.md) 편집 금지** — 본 slice 는 deployment.md `## 개요` 만 닫는다.
- **다른 문서로의 cascade 금지** — `docs/architecture/INDEX.md` · [INDEX.md](../use-cases/INDEX.md) · `UC-01` ~ `UC-09` · ADR · [PLAN.md](../PLAN.md) · [requirements.md](../requirements.md) 는 무편집.
- **행 번호 → anchor 좌표계 이행 금지** — 파생 영향 목록에만 남긴다 (20 회째 이월).
- **CI drift-guard spec 작성 금지** — `pr` mode 소관이라 본 direct task 에서 진행하면 §3.1 위반.
- **audit 기존 절 (`§ 12.1` ~ `§ 12.41`) 수정 금지** — `§ 12.42` 순수 append 만.

## Suggested Sub-agents

`implementer` 단독 (doc-only, 코드 0 LOC — architect · tester 불요. §3.2 direct-mode 면제).

## Follow-ups

1. **다음 문서 축 1 순위 = [components.md](../architecture/components.md)** — 본 slice 로 [deployment.md](../architecture/deployment.md) 6 단락 전부가 대조 완결돼 uc-doc-audit-resync 의 deployment.md 축이 종료됐다. components.md 는 3 행 blockquote 가 스스로 밝히듯 **P1 T-A3 blueprint 원본** 이라 같은 "구현 이전 서술 ↔ shipped 코드" drift 표면을 갖고, 8 component table + contract 표로 **검증 가능 claim 밀도가 높아** `§ 12.35` ~ `§ 12.42` 의 판정 template 을 그대로 적용할 수 있다. 차순위는 [INDEX.md](../architecture/INDEX.md) (`MVA 원칙` · 문서 목록 pointer 축).
2. **reviewer 규약 미이행** — `.claude/agents/reviewer.md` 에 REQ-032 항목 0 hit (`§ 12.41` FU2 미소진). `.claude/` 소관 별도 direct task.
3. **`deploy/README.md` ↔ deployment.md ↔ [runbook.md](../ops/runbook.md) 3 자 정합** — `§ 12.41` FU4 미소진. 본 slice 가 `deploy/` 15 개 자산을 인용하며 접점을 재확인했으나 정본 지정 판정은 미착수.
4. **README 행 번호 pointer drift 전수 sweep** — `§ 12.41` FU3 미소진.
5. **`@nestjs/config` 미도입 전수 sweep** — `§ 12.39` FU3 미소진 (ADR 게이트).
6. **REQ 번호 체계 잔재 전수 sweep** — `§ 12.38` FU3 미소진 (owner 게이트).
7. **`CLAUDE.md` §1 pointer 부정확** — `§ 12.40` FU3 미소진 (§3.1 별개 소관).
8. **UC-09 `§ 5` sequence participant 병기** — 26 회째 이월.
9. **정본 [modules.md](../architecture/modules.md) 카운트 claim 대조** — `§ 12.34` FU1 미소진 (**259 행 불변**, ADR 게이트).
10. **행 번호 → anchor 좌표계 이행** — 20 회째 이월. 본 slice 각주가 deployment.md 15 행 이후를 +6 민 것이 근거를 보탠다.
11. **산문 tally ↔ 실측 CI drift-guard spec** — `pr` mode 소관 (`deploy/` **15** · docker 언급 **7** · ADR-0003 Decision **4** 는 자산 · heading 1 건 변경으로 즉시 낡는다).
