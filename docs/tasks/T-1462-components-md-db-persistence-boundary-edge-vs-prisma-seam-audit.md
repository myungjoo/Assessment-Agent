---
id: T-1462
title: components.md `## Component diagram` mermaid **`%% DB persistence boundary` edge 1 개** (86 행) ↔ 실 `src/persistence` Prisma connection seam 대조 — `§ 12.59` 파생 영향 (1) 집행 + edge 축 23/23 마감 + audit §12.60
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 220
estimatedFiles: 3
created: 2026-08-05
independentStream: uc-doc-audit-resync
dependsOn: [T-1461]
touchesFiles:
  - docs/architecture/components.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1462-components-md-db-persistence-boundary-edge-vs-prisma-seam-audit.md
plannerNote: "uc-doc-audit-resync 74 번째 slice — §12.59 파생 영향 (1) 집행. 마지막 edge 그룹 1 개 → edge 축 23/23 마감. doc-only 1.6x"
---

# T-1462 — components.md mermaid `%% DB persistence boundary` edge 1 개 ↔ 실 Prisma connection seam 대조 (edge 축 최종 slice)

## Why

[T-1461](T-1461-components-md-user-facing-flow-edges-vs-web-frontend-audit.md) 이 `%% User-facing flow` **2** edge 를 2/2 마감하면서 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.59`) 파생 영향 **(1)** 에서 **다음 대조 1 순위를 `%% DB persistence boundary` 1 개 (86 행) 로 명시 지목** 하고 **"다음 대조가 edge 축의 마지막 그룹"** 임을 함께 박제했다. 본 slice 는 그 지목을 그대로 승계한다 — 닫으면 mermaid edge **23 중 23 판정 완료** 로 **6 edge 그룹이 전부 마감** 되고, edge 축 자체가 종료된다 (`§ 12.53` node 축 · `§ 12.44` ~ `§ 12.50` 표 row 축에 이어 세 번째 축 마감).

본 slice 는 앞 5 그룹과 **측정 축이 또 한 번 다르다**. `§ 12.54` ~ `§ 12.58` 은 in-process 호출 또는 server-side HTTP outbound, `§ 12.59` 는 브라우저 outbound 였으나 본 edge 는 **process 경계를 넘는 유일한 non-HTTP 결선** (TCP/libpq) 이라 앞 절들이 세워 온 **주입 `fetchFn` 단일 지점** 정의도, `§ 12.59` 가 신설한 **브라우저 outbound seam** 정의도 **둘 다 쓸 수 없다**. AC 1 (iv) 에서 **DB connection seam** 정의를 실측 hit 위치로 새로 세운 뒤 그 위에서만 판정한다 (정의를 세우는 것과 판정을 창작하는 것은 다르다).

planner 사전 확인 — **아래는 전부 가설이며 전제가 아니다** (T-1440 AC 1 이후 planner 기대가 실측에 반증·정정된 선례가 23 회 있고, 직전 T-1461 에서도 `edge 65 는 label 만 어긋날 것` 이라는 기대가 **조건부 결선 (dist 부재 시 등록 0)** 이라는 더 강한 사실로 뒤집혔다). executor 는 AC 1 에서 전부 재측정하고 **기대와 다르면 그 축의 판정을 실측대로 뒤집는다**. ① **86** 행 `db_persistence -- "TCP 5432<br/>(Prisma client)" --> postgres` — 결선 자체는 유력하나 planner 예비 grep 에서 `src/**` 의 `5432` 리터럴 hit 이 **0** 이고 hit 은 전부 `.env.example` · `.github/workflows/ci.yml` · `docker-compose.yml` · `test/helpers/` 였다 → label 의 **`TCP 5432`** 는 코드 사실이 아니라 **배포 · 로컬 환경 층의 사실** 일 가능성이 크다 (`§ 12.59` 가 `HTTPS` 를 배포 층 사실로 뒤집은 것과 **동형**). ② label 의 **`(Prisma client)`** — `prisma/schema.prisma` **7 ~ 12** 행이 "Prisma 7.x 는 `datasource.url` 을 schema 가 아니라 adapter 로 inject" · "`@prisma/adapter-pg` 가 `DATABASE_URL` 을 읽어 **pg Pool** 을 구성" 이라고 자기선언하므로 실 wire 를 여는 주체가 Prisma client 가 아니라 **pg Pool** 일 가능성 (표기 정밀도 축). ③ `db_persistence` node label 의 **`Prisma + repository`** 외연 — 예비 grep 에서 `PrismaClient` 를 포함한 spec 제외 파일이 **10** 개 (`src/persistence/prisma.service.ts` 외에 `src/export` · `src/import` · `src/llm` · `src/user` 계열) 로 관측돼, repository 층을 경유하지 않고 **service 가 직접** Prisma 를 잡는 결선이 있다면 node 외연이 부분참이 된다. ④ ③ 이 참이면 edge 1 개가 실 connection **1** (pool singleton) 을 공유하는 **N 개 호출 지점** 의 축약 표기가 되어 `§ 12.57` `1 : 2 : 3` · `§ 12.58` `5 : 1 : 4` · `§ 12.59` `2 : 1 : 1` 과 **동형 사고** 다. ⑤ `postgres` node 의 **`PostgreSQL 16+`** version claim ↔ 실 `docker-compose.yml` · CI service image tag 정합. ⑥ label 이 **connection pool · TLS(sslmode) · migration 채널** 을 은닉할 가능성. ⑦ 대응 `## Contracts` row 는 **277** 행 **1** 개 (`Prisma client (TCP 5432, libpq protocol)` · `connection pool singleton`) 로 edge 1 과 **1:1** 이나 그 판정은 **파생 영향 (3) 소관** 이라 본 slice 는 **좌표와 문구 인용까지만** 한다.

**행 좌표 주의** — components.md 는 T-1461 각주 +7 행으로 **294** 행이고, heading 은 `## 개요` **5** · `## Deployment 컨텍스트` **22** · `## Component diagram` **28** · `## Component table` **115** · `## GitHub Adapter …` **226** · `## Contracts` **258** · `## References` **284** 다. mermaid 블록 **30 ~ 106** (edge 그룹 주석 **32 · 48 · 61 · 64 · 68 · 75 · 79 · 85 · 88 · 99**), 표 본체 **117 ~ 126**, 각주 **15 블록** (말미 블록 **218 ~ 224**), `## Contracts` 표 data row **264 ~ 280** 이다. AC 1 (i) 에서 재실측한다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/components.md` — **294 행**. 다음 구간만 읽는다.
  - **85 ~ 86 행** (`%% DB persistence boundary` 그룹 전 구간) — **본 slice 의 판정 대상**.
  - **58 행** (`db_persistence` node) · **62 행** (`postgres` node) · **61 행** (`%% External DB …` 주석) — **무편집, 대조용**. 출발 / 도착 node id 와 label 확인까지만 (`§ 12.53` 이 node 집합 축을 닫았다).
  - **108 ~ 113 행** (`다이어그램 표기` bullet) — 인용만. 재판정 금지.
  - **121 ~ 122 행 부근 표 `DB Persistence` row** — **무편집**, 책임 · contract 문구 인용까지만 (좌표는 AC 1 (i) 로 실측). **row 본문 재판정 금지** (`§ 12.44` ~ `§ 12.50` 소관).
  - **184 ~ 188 행 부근 `§ 12.53` node 각주 블록** — **무편집**, node 외연 표기 선례 1 구 인용용 (좌표는 실측).
  - **218 ~ 224 행** (T-1461 각주 블록) — **무편집**. 각주군 말미 좌표 확인 + **seam 정의를 승계하지 않는 이유** (브라우저 outbound seam 정의라 TCP 축에 적용 불가) 1 구 대비용.
  - **277 행** (`## Contracts` 표의 `DB Persistence | PostgreSQL` row) — **무편집**, 문구 인용까지만 (특히 `Prisma client (TCP 5432, libpq protocol)` · `connection pool singleton` 어구). **`## Contracts` 표 재판정 금지** (파생 영향 (3)).
  - **그 밖 전 구간** — **무편집, heading 좌표 확인만**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **5731 행**. **`### 12.15`** (append-only 처리 방침 정본) · **`### 12.59`** (파생 영향 **(1)** 원문 + AC 1 (iv) seam 정의 신설 선례 + (viii) 계수 규칙 + 한계 2) · **`## 11. References`** — `§ 12.60` 삽입 위치 경계. **`§ 12.44` · `§ 12.53` · `§ 12.55` 본문은 열지 않는다** — 필요한 판정은 components.md 각주 1 구 인용으로 갈음한다 (§7 context 절약).
- `src/persistence/prisma.service.ts` — **무편집, read-only**. AC 1 (iv) grep 이 가리키는 **1 ~ 2 행 인용까지만**. **파일 통독 금지**.
- `prisma/schema.prisma` — **무편집, read-only**. `datasource` 블록과 **7 ~ 12 행 주석** 1 구 인용까지만.
- `docker-compose.yml` — **무편집, read-only**. postgres image tag 1 행 인용까지만.
- `docs/PLAN.md` — **175 행. 무편집, 읽기만**. 미완 bullet 좌표 확인용 `grep` 만.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §7 (context 절약) · §9 (secret 금지) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.60` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 판정을 실측대로 뒤집는다** (Why 의 ① ~ ⑦ 은 가설일 뿐이다).
  - (i) **좌표 재확인**: `grep -n '^#\{1,3\} ' docs/architecture/components.md` 로 heading 좌표를 **먼저 실측** 한다 (본 AC 의 `28` · `115` · `226` · `258` · `284` 도 stale 일 수 있다 — T-1436 ~ T-1461 선례). 이어 `grep -n '^\s*%%\|^```' docs/architecture/components.md` 로 mermaid 블록 경계와 edge 그룹 주석 좌표를 확정한다.
  - (ii) **edge 그룹 재확인 (그룹 진척 수치)**: `grep -nE '^\s+[a-z_]+ -- ' docs/architecture/components.md | wc -l` 로 전체 edge 수를 세고 `§ 12.54` 의 산출식 (**23** = 2 + 5 + 2 + 4 + 1 + 9) 이 **여전히 성립하는지** 1 구로 확인한다. 이어 본 slice 대상이 **86 행 1 개뿐** 이며 본 slice 종료 시 db-boundary 그룹 **1/1 마감** · **전체 edge 23 중 23 판정 완료 · 잔여 0 · 6 그룹 전부 마감 = edge 축 종료** 임을 수치로 명시한다.
  - (iii) **대상 edge 원문 인용**: `sed -n '85,86p' docs/architecture/components.md` (좌표는 (i) 실측값으로 교체) 로 그룹 주석 + edge 1 행을 그대로 인용하고, **출발 node · 도착 node · label 문자열** 을 3 컬럼으로 분해한다. node 정의는 `sed -n '58p;61,62p'` 로 병기한다.
  - (iv) **DB connection seam 정의 (본 slice 의 선결 측정 — 승계 불가, 신설)**: `§ 12.57` · `§ 12.58` 의 **주입 `fetchFn` 단일 지점** 정의도 `§ 12.59` 가 신설한 **브라우저 outbound seam** 정의도 **HTTP 축이라 TCP/libpq 결선에 적용 불가** 임을 components.md 각주 (T-1460 · T-1461 블록) 1 구 인용과 함께 밝히고, 본 절이 쓸 정의를 **실측 hit 위치로** 세운다 — 근거 명령 ⓐ `grep -rn 'new PrismaClient\|PrismaClient(' src --include=*.ts | grep -v spec`, ⓑ `grep -rn 'adapter-pg\|PrismaPg\|new Pool' src prisma --include=*.ts | grep -v spec`, ⓒ `grep -rn '\$connect\|\$disconnect\|OnModuleInit' src/persistence/prisma.service.ts` 로 **실제 connection 을 여는 지점이 몇 파일 · 몇 행** 인지 세고, 단일 지점으로 수렴하는지 (수렴하면 그 지점을 seam 으로) 분산인지 (분산이면 그 사실을 정의에 명시) 를 수치로 가른다. **정의를 창작하지 않는다 — hit 분포가 정의를 결정한다.**
  - (v) **결선 실측 (본 slice 의 축)**: 다음을 각각 1 명령으로 실행해 hit 수와 대표 행을 인용한다 — ⓐ `grep -rn '5432' src --include=*.ts | grep -v spec` (label 의 **포트 리터럴** 이 production code 에 있는지 — hit 0 이면 어느 층의 사실인지 (v) ⓔ 로 잇는다), ⓑ `grep -rn 'PrismaService' src --include=*.ts | grep -v spec | wc -l` + 파일 단위 `... | cut -d: -f1 | sort -u` (node 외연 `Prisma + repository` ↔ 실 호출 지점 분포), ⓒ `grep -rn 'repository\|Repository' src --include=*.ts | grep -v spec | cut -d: -f1 | sort -u | head -15` (**repository 층이 실재하는지** — hit 0 이면 node label 의 `+ repository` 가 거짓 축이 된다), ⓓ `grep -n 'provider\|url\|datasource' prisma/schema.prisma | head -10` + `sed -n '7,12p' prisma/schema.prisma` (실 wire 주체가 Prisma client 인지 pg Pool 인지), ⓔ `grep -rn '5432\|DATABASE_URL' docker-compose.yml .env.example | head -10` (포트 · 접속 정보가 박제된 **실제 층**). **파일 통독 금지** — 위 5 명령의 출력과 필요한 1 ~ 2 행 인용까지만 쓴다. **실 password · 접속 문자열 값은 옮겨 적지 않는다** (§9 — 변수명 · 옵션명 · image tag · 포트 숫자까지만이며 `.env.example` 의 placeholder 라도 credential 형태 문자열은 인용하지 않는다).
  - (vi) **`PostgreSQL 16+` version claim 대조**: `grep -n 'image:' docker-compose.yml | head -5` + `grep -n 'postgres:' .github/workflows/ci.yml | head -5` 로 실 image tag 를 세어 node label 의 **`16+`** 표기가 참인지 가른다 (tag 가 16 미만 또는 서로 다른 major 면 그 사실을 수치로 명시한다).
  - (vii) **중복 claim · 좌표 stale 확인 (판정은 이월)**: `grep -n '^| DB Persistence ' docs/architecture/components.md` 로 `## Component table` row 와 `## Contracts` row (**277** 행 기대) 좌표를 실측해 본 slice 의 1 edge 와 **어떻게 대응하는지** (1:1 인지) 를 수치로 보이고, `Prisma client (TCP 5432, libpq protocol)` · `connection pool singleton` 어구를 **인용만** 한다. 이어 `grep -n '\*\*[0-9]\{2,3\}\*\* 행' docs/architecture/components.md | head -25` + (i) 실측으로 **자기 좌표 stale 이 남아 있는지** 를 가른다 (T-1460 이 4 지점 · T-1461 이 6 지점 정정했다). **`## Contracts` 표의 참 / 거짓 판정은 하지 않는다** — 파생 영향 (3) 소관임을 1 구로 명시한다.
  - (viii) **삽입 파급 실측 (AC 3 입력)**: 신규 각주를 ⓐ `## Component diagram` 절 안 (mermaid 블록 직후) 에 넣을 때 / ⓑ 각주군 말미 (**224** 행 뒤) 에 넣을 때 **각각 밀리는 자기 참조 좌표가 몇 지점인지** 를 **수치 2 개** 로 제시한다 (`§ 12.55` (viii) → `§ 12.59` (viii) 로 이어진 계수 규칙 = components.md 자기 좌표 토큰만 세고 외부 파일 좌표는 제외, 범위 토큰 `A ~ B` 는 1 지점 — 그 규칙을 그대로 승계하고 승계 사실을 1 구로 명시). `§ 12.58` · `§ 12.59` 가 **2 회 연속** in-place 정정 기대치를 1 지점씩 초과했으므로 본 절은 (viii) ⓑ 수치를 **AC 4 의 상한 근거로 그대로** 쓴다.
  - (ix) **baseline** — `wc -l` components.md **294** · audit **5731** · ADR-0003 **173** · requirements.md **97** · deployment.md **232** · directory.md **203** · modules.md **259** · PLAN.md **175**, `grep -c '^## '` components.md **7** · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **59**, components.md `grep -c '^> '` **88**.
- [ ] **AC 2 — 판정표**: AC 1 이 실측한 **축** 마다 `참 / 부분참 / 거짓` 을 판정한 표를 만든다. 각 row 는 **축 1 구 · 실측 근거 (행 번호 포함) · 판정 · 근거 1 구** 4 컬럼이다. 최소 축 6 개 — ① `db_persistence --> postgres` **결선** (**86** 행, AC 1 (iv) ⓐⓑⓒ), ② label 의 **`TCP 5432`** 포트 표기 ((v) ⓐ + ⓔ — 코드 리터럴 유무와 실제 층), ③ label 의 **`(Prisma client)`** 표기 정밀도 ((v) ⓓ — 실 wire 주체가 Prisma client 인지 `@prisma/adapter-pg` 의 pg Pool 인지), ④ **`db_persistence` node label 의 `Prisma + repository` 외연** ↔ 실 호출 지점 분포 ((v) ⓑⓒ — repository 층 실재 여부 포함), ⑤ **`postgres` node 의 `PostgreSQL 16+` version claim** ((vi)), ⑥ label 이 **connection pool · TLS(sslmode) · migration 채널** 을 은닉하는지 ((iv) ⓒ + (v) ⓓⓔ).
  - edge 1 개가 실 결선 대비 **몇 중 표기** 인지를 `§ 12.57` 의 `1 : 2 : 3` · `§ 12.58` 의 `5 : 1 : 4` · `§ 12.59` 의 `2 : 1 : 1` 과 **같은 형식** (edge N : 실 connection M : 호출 지점 K) 으로 수치화한다.
  - **판정은 (iv) 의 DB connection seam 정의 위에서만 유효** 함을 표 아래 1 구로 명시하고, **그 정의가 앞 절들의 승계가 아니라 본 절 신설** 임을 함께 밝힌다.
  - **user-facing 2 · egress 9 · orchestration 5 · scheduler 2 · worker 4 재판정 금지** (`§ 12.54` ~ `§ 12.59` 소관) · **node 축 재판정 금지** (`§ 12.53`) · **표 row 본문 재판정 금지** (`§ 12.44` ~ `§ 12.50`).
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) **현행 유지 + 무편집** (audit `§ 12.60` 기록만), (B) **각주군 말미 append** — 각주 구간 **끝 (현 224 행 뒤)** 에 blockquote **1 블록 (≤ 6 행)** 을 신설해 edge 판정을 병기하고, AC 1 (vii) · (viii) 이 stale 로 확정한 좌표만 in-place 정정 (**≤ 7 지점** — `§ 12.59` 실측 6 지점 + 신규 각주 자기참조 증가분 1 을 반영한 상한), (C) **`## Component diagram` 절 안 각주 삽입** (mermaid 블록 직후) + 밀린 좌표 전수 정정, (D) **mermaid edge · label · node 텍스트 in-place 수정**.
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` **append-only 정합** (**(D) 는 이 축에서 먼저 판정**), ② **좌표 drift 파급** (AC 1 (viii) 의 수치 2 개를 그대로 근거로), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 **자동 기각 + split 제안을 파생 영향에 기록**), ④ **탐색성** (다이어그램 독자가 판정 근거에 닿는 경로 길이).
  - **AC 2 축 ① ~ ⑥ 중 하나라도 `거짓` 이면 (A) 는 자동 기각**. **전 축이 `참` 이어도 (A) 를 자동 채택하지 않는다** — 탐색성 (축 ④) 을 함께 재고 결론을 1 구로 남긴다.
  - **mermaid edge 를 지우거나 병합하거나 label · node 텍스트를 고쳐 쓰는 선택지는 채택하지 않는다** — 처리는 **각주 병기** 로 한다. **코드 (`src/` · `prisma/` · `docker-compose.yml`) 를 고쳐 label 을 참으로 만드는 처리도 금지** — `pr` task 소관이다.
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다.
  - **(A) 채택 시** — components.md **무편집** (`git status --porcelain docs/architecture/components.md` **빈 출력**) 이며, 유지 근거를 `§ 12.60` 에 남긴다.
  - **(B) 채택 시** — 신규 blockquote 는 **마지막 각주 블록 뒤 · `## GitHub Adapter …` heading 직전** 에 삽입하고 **≤ 6 행 + 앞 빈 줄 1 행**, in-place 정정은 **AC 1 (vii) · (viii) 이 stale 로 확정한 지점만 ≤ 7 지점** (숫자 1 개씩 치환, **문장 재작성 금지**). `wc -l` 증가 **+7 이내** (294 → ≤ 301). 실측이 상한을 또 넘으면 **넘긴 수치와 원인을 `§ 12.60` 에 1 구로 남기고 실측대로 전부 정정** 한다 (5 만 고치고 stale 을 남기지 않는다 — `§ 12.59` 선례).
  - **(C) · (D) 채택 시** — 변경 파일 3 · diff ≤ 300 LOC 를 **먼저 검산** 하고, 초과하거나 정정 지점이 **8 지점 이상** 이면 채택을 철회해 (B) 로 내린 뒤 그 사실을 `§ 12.60` 에 1 구로 남긴다.
  - **삽입으로 heading 좌표가 다시 밀리면 편집 후 `grep -n '^## ' docs/architecture/components.md` 로 재측정해 반영** 한다 (`§ 12.51` `175` → `§ 12.58` `219` → `§ 12.59` `226` 으로 이어진 재-drift 의 **10 회째** 재현 여부를 1 구로 기록).
  - **문구 · 행 번호 · 절 번호 · task ID 는 AC 1 실측 출력과 1:1 일치** 해야 하며, 실측되지 않은 값을 **새로 창작하지 않는다**.
  - **mermaid 블록 (30 ~ 106 행) · `다이어그램 표기` bullet (108 ~ 113 행) · 표 본체 (117 ~ 126 행) · 1 ~ 4 행 blockquote · `## 개요` 각주 (16 ~ 20 행) · 안내 blockquote (128 ~ 131 행) · 각주 15 블록의 판정 문장 · 226 행 이후 전 구간 무편집**. 허용되는 in-place 는 **stale 숫자 치환뿐** 이다.
  - **secret · password · 실 접속 문자열을 문서에 옮겨 적지 않는다** (CLAUDE.md §9 — 변수 **이름** (`DATABASE_URL`) · 옵션명 · image tag · 포트 숫자까지만 허용하며 placeholder credential 도 인용 금지).
- [ ] **AC 5 — audit `§ 12.60` 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 `## 11. References` **직전** 에 `### 12.60 …` 절을 **순수 append** 한다 (기존 절 수정 0). 구성 — 본 절의 위치 · 계보 1 문단 (**`§ 12.59` 파생 영향 (1) 이 지목한 1 순위 = db boundary 1, 본 절로 6 그룹 전부 마감 · edge 축 23/23 종료** 명시 + **seam 정의가 승계가 아니라 신설** 임을 명시) / AC 1 실측 (명령 + 출력) / AC 2 판정표 / AC 3 처리 판정표 / AC 4 반영 결과 + 무편집 경계 / **edge 축 종료 선언 1 구 (6 그룹 × 판정 결과 요약 1 행 표 — 각 그룹의 절 번호와 참/부분참/거짓 개수만)** / 파생 영향 (목록만) / 불변 검산 / 한계. **절 전체 ≤ 100 행** (초과 시 실측 인용을 요약형으로 압축하고 압축 사실을 한계에 명시).
  - `###` 레벨이라 `grep -c '^## '` **12 불변** · `grep -c '^| REQ-'` **66 불변** · `grep -c '^### 12\.'` **59 → 60**.
- [ ] **AC 6 — 불변 검산**: 다음을 실행해 출력을 `§ 12.60` 에 인용한다. `wc -l` components.md (294 → ≤ 301) · audit (5731 → +100 이내) · **ADR-0003 173 불변** · requirements.md (**97 불변**) · deployment.md (**232 불변**) · directory.md (**203 불변**) · modules.md (**259 불변**) · PLAN.md (**175 불변**), `git diff -U0 -- docs/architecture/components.md | grep '^@@'` 로 **hunk 개수 · 위치** 를 보이고 AC 4 허용 구간 밖 hunk **0** 을 실증 (무편집 채택 시 **hunk 0**), `git diff --numstat` 으로 **순수 삭제 0** (삭제 행이 있으면 stale 숫자 치환의 짝임을 1 구로 설명), `git status --porcelain src/ test/ web/ prisma/ deploy/ docker-compose.yml Dockerfile .github/ package.json README.md .claude/ docs/decisions/ docs/ops/ docs/PLAN.md docs/requirements.md docs/architecture/modules.md` **빈 출력** (특히 **`prisma/` · `docker-compose.yml` 무편집** 을 1 구로 명시), `git status --porcelain` 전체가 **3 파일 이내**.
- [ ] **AC 7 — 파생 영향 기록 (목록만, 본 slice 편집 금지)**: `§ 12.60` 말미에 후속 slice 대상을 목록으로 남긴다. **edge 축이 종료되므로 (1) 번 자리는 잔여 edge 가 아니라 다음 축의 1 순위 지목** 이다. 최소 포함 — (1) **다음 축 1 순위 지목** — `## Contracts` 표 ↔ 실 계약 표면 대조 (본 절 (vii) 이 `DB Persistence` row **1** 개 좌표를 보태 `§ 12.55` **5** · `§ 12.56` **4** · `§ 12.57` **2** · `§ 12.58` **1** · `§ 12.59` **2** 와 합쳐 **누적 15 row 좌표** 확보 — data row 총 개수를 AC 1 (vii) 로 실측해 **cover 율** 을 수치로 병기하고, 남은 축 후보 중 왜 이것이 1 순위인지 1 구) / (2) `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` 본문 ↔ 코드 대조 (`§ 12.48` FU4 미소진) / (3) row pointer 셀 보강 2 건 (`Scheduler` = `ADR-0042` 미등재 `§ 12.50` FU2 · `Confluence Adapter` `§ 12.49` FU2) / (4) LLM · GitHub adapter ADR pointer 미등재 (`§ 12.47` FU5 · `§ 12.48` FU3) / (5) `@nestjs/config` 미도입 전수 sweep (`§ 12.39` FU3, ADR 게이트) / (6) reviewer 규약 미이행 (`§ 12.41` FU2) / (7) `deploy/README.md` ↔ deployment.md ↔ runbook 3 자 정합 (`§ 12.41` FU3) / (8) README 행 번호 pointer drift 전수 sweep / (9) REQ 번호 체계 잔재 sweep (`§ 12.38` FU3) / (10) `CLAUDE.md` §1 pointer 부정확 (T-1442 FU3) / (11) UC-09 `§ 5` sequence participant 병기 (**50 회째 이월**) / (12) modules.md 카운트 claim 대조 (`§ 12.34` FU1, ADR 게이트) / (13) **행 번호 → anchor 좌표계 이행** (**44 회째 이월** — 본 절 AC 4 의 재-drift 10 회째 재현 여부와 in-place 정정 초과 연속 횟수를 근거로 보탠다) / (14) 각주 heading 참조 anchor 이행 축소 scope (`§ 12.51` FU19 미소진) / (15) `§ 12.44` 한계 "mutation 러너 26 개" 정의 미확정 / (16) **`Scheduler` cron → 평가 pipeline 미결선** (`§ 12.50` FU18 — 코드 소관, `pr` task 로만) / (17) `ADR-0003` "단일 DB 인스턴스" 좌표 부재 (`§ 12.46` FU16 — 본 절 축 ① · ⑤ 가 실 instance 수 근거를 보탰다면 1 구 병기) / (18) **`Web UI` node 의 process subgraph 소속 표기** (`§ 12.53` FU19 · `§ 12.59` 가 층 외연 거짓 확정) / (19) **node 외연 정의의 문서 미박제** (`§ 12.55` FU20 · `§ 12.56` FU20 · `§ 12.59` FU20 — 본 절이 `db_persistence` 외연 (`Prisma + repository`) 을 실측했다면 보탠다) / (20) modules.md **200** 행 1:N 매핑 ↔ 디렉토리 외연 상충 해소 (`§ 12.56` FU21 미소진) / (21) 가변 instance 수 ↔ 문서의 고정 표기 정합 (`§ 12.57` FU22 · `§ 12.58` FU22 미소진) / (22) `worker --> backend_api` 미표기 결선 (`§ 12.56` FU23 미소진) / (23) dev / prod 2 모드의 다이어그램 미분리 (`§ 12.59` FU24 미소진) / (24) **(C) 후보 split 제안** (기각이 cap 사유였을 때만) / (25) **`PostgreSQL 16+` version claim 정정** (본 절 축 ⑤ 가 거짓 · 부분참으로 나온 경우에만).
- [ ] **AC 8 — R-110 / R-112 면제 근거 명시**: 본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 **N/A** 임을 `§ 12.60` 에 1 구로 명시한다.
- [ ] **AC 9 — 언어 · 링크 규약**: 추가 문장은 모두 한국어 (§12), 문서 간 참조는 상대경로 markdown 링크, 수치는 실측 출력과 1:1 일치.

## Out of Scope

- **코드 · schema · 배포 자산 · CI · agent 정의 변경 절대 금지** — `src/` · `web/` · `test/` · `prisma/` · `scripts/` · `deploy/` · `docker-compose.yml` · `Dockerfile` · `.github/workflows/` · `package.json` · `.claude/agents/` 는 diff 에 등장하면 안 된다 (`grep` 열람은 read-only 라 허용). **label 을 참으로 만들려고 `prisma/schema.prisma` 또는 `docker-compose.yml` 을 고치는 시도 금지**.
- **DB 접속 · query 실행 · migration 실행 금지** — `psql` · `prisma migrate` · `prisma db push` · `pnpm test:e2e` · docker compose 기동 어느 것도 하지 않는다. 측정은 전부 read-only `grep` · `sed` · `ls` · `wc` · `git` 이며, 실 password · 접속 문자열은 문서에 옮겨 적지 않는다 (§9).
- **mermaid 블록 (30 ~ 106 행) 편집 금지** — edge 삭제 · 추가 · 병합 · label 수정 · node 텍스트 수정 어느 것도 하지 않는다. 판정은 각주 병기로만 남긴다.
- **db-boundary 외 edge 그룹 (user-facing · orchestration · scheduler · worker pipeline · external egress) 재판정 금지** — user-facing 2 는 `§ 12.59`, egress 9 는 `§ 12.57` · `§ 12.58`, orchestration 5 는 `§ 12.55`, worker 4 는 `§ 12.56`, scheduler 2 는 `§ 12.54` 가 이미 닫았다 (좌표 · 인용까지만).
- **node 집합 · 이름 · 카운트 · 소속 재판정 금지** — `§ 12.53` 이 이미 닫았다. 본 slice 의 축 ④ ⑤ 는 **`db_persistence` · `postgres` node label 의 claim ↔ 코드 사실** 정합 축일 뿐 node 집합 재판정이 아니다.
- **`## Component table` 8 row 의 본문 (책임 · contract · REQ · pointer) 재판정 · 편집 금지** — `§ 12.44` ~ `§ 12.50` 이 이미 닫았다.
- **`## Contracts` 표 (258 행 이후) 판정 · 편집 금지** — 대응 row **좌표와 문구 인용** 까지만이며, 참 / 거짓 판정은 파생 영향 (1) 소관이다.
- **Prisma schema 모델 · migration 이력 · repository 구현 품질 대조 금지** — 본 slice 는 **process 경계 결선과 그 label** 축 한정이며, schema 내용 · 인덱스 · N+1 · transaction 경계는 열지 않는다.
- **DB 보안 · 계정 권한 · TLS 정책 자체 판정 금지** — label 이 pool · TLS 를 **은닉하는지** 만 보고 (축 ⑥), sslmode 정책 · 계정 권한 모델 · 백업 정책은 열지 않는다 (§9 및 별도 ops 문서 소관).
- **`## GitHub Adapter — 3 instance 묶음 vs 분리 결정` sub-section (226 행 이후) 본문 대조 금지** — 파생 영향 (2) 소관이다.
- **각주 15 블록의 판정 내용 재검토 · 재작성 · 삭제 · 이관 금지** — 좌표 확인 · 1 구 인용 · AC 4 가 허용한 stale 숫자 치환 (≤ 7 지점) 까지만.
- **audit 기존 절 (`§ 12.1` ~ `§ 12.59`) 수정 금지** — 판정은 `§ 12.60` 순수 append 로만 세운다 (`§ 12.15`).
- **[modules.md](../architecture/modules.md) · `docs/PLAN.md` · `docs/requirements.md` · `docs/decisions/**` 편집 금지** — 좌표 확인용 grep 인용까지만 (특히 ADR-0002 · ADR-0003 무편집).
- **components.md 전면 anchor 좌표계 이행 실행 금지** — 파생 영향 (13) · (14) 소관이다.
- **다른 문서로의 cascade 금지** — [use-cases/INDEX.md](../use-cases/INDEX.md) · `UC-01` ~ `UC-09` · [INDEX.md](../architecture/INDEX.md) · [deployment.md](../architecture/deployment.md) · [directory.md](../architecture/directory.md) · [api.md](../architecture/api.md) · [README.md](../../README.md) 는 무편집.
- **빌드 · 테스트 · 설치 실행 금지** — `pnpm install` · `pnpm build` · `pnpm test` 어느 것도 실행하지 않는다.
- **CI drift-guard spec 작성 금지** — `pr` mode 소관이라 본 direct task 에서 진행하면 §3.1 위반.

## Suggested Sub-agents

`implementer` 단독 (doc-only, 코드 0 LOC — architect · tester 불요. §3.2 direct-mode 면제).

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append 한다.)
