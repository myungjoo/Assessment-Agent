---
id: T-1491
title: 범위 표기 규약 축 S3 batch 12 — `L` 축 ADR 3 파일 (`ADR-0008` · `ADR-0046` · `ADR-0015`) R5·R4 정규화 + 기판정 면제 좌표 재방문 (res judicata) · 동일 좌표 2 형태 반복 · `§` prefix 좌표 판정 (audit §12.89)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 110
estimatedFiles: 5
created: 2026-08-05
independentStream: uc-doc-audit-resync
dependsOn: [T-1490]
touchesFiles:
  - docs/decisions/ADR-0008-auth-credential-type.md
  - docs/decisions/ADR-0046-export-dump-materialization-storage.md
  - docs/decisions/ADR-0015-llm-live-integration-test-contract.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1491-range-notation-s3-adr-batch12-lprefix.md
plannerNote: "uc-doc-audit-resync 103 번째 slice — §12.88 파생 (1) 1 순위 S3 batch 12. `L` 잔존 4 ADR 중 3 파일 4 행 / 5 좌표, direct 5 파일"
---

# T-1491 — 범위 표기 규약 축 S3 batch 12 — `L` 축 ADR 3 파일 (`ADR-0008` · `ADR-0046` · `ADR-0015`) `R5` · `R4` 정규화

## Why

[REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.88` (S3 batch 11) 의 **파생 영향 (1)** 이 **1 순위** 로 지목한 **S3 batch 12 = `L` 잔존 4 ADR 중 `ADR-0008` (1 행 / 2 좌표 · `R7` 면제 좌표 보유) · `ADR-0046` (2 행 / 2 좌표) · `ADR-0015` (1 행 / 1 좌표)** 를 집행한다. `§ 12.83` AC 6 이 en dash 축 마감을 선언했으므로 후보는 여전히 **`L` 축 단일 축** 이며, 규범 정본은 `§ 12.76` 조문 `R1` ~ `R7`, 판정 선례는 `§ 12.80` 대조표 #4 (`ADR-0008`:149 `R7` 면제 — 본 축 유일 실발동) · #8 (코드 파일 좌표) · `§ 12.82` AC 3 ③ (판정 기준은 표기가 놓인 문서) · `§ 12.84` AC 3 ② (묶음당 단위어 1 회) · `§ 12.85` AC 3 ① (좌표 자신의 `~` 도 좌표로 계수) · 한계 4 (부착 3 규칙) · `§ 12.86` AC 3 ① (식별자 범위 3 분해) · 한계 5 (반복 label 일관성 grep 미검출) · `§ 12.87` AC 3 ① (label 전체 좌표) · `§ 12.88` AC 1 ② (축이 다르면 재방문은 한정 소급 위반 아님) · AC 3 ② (`R7` 면제 불성립 판별) 을 승계한다.

본 slice 가 새로 여는 판정 축은 셋이다 — (가) **기판정 면제 좌표의 재방문 (res judicata)**: `ADR-0008`:149 는 `§ 12.80` (batch 3) 이 **같은 축 (`R5`)** 에서 이미 심리해 `R7` 면제로 확정한 유일한 좌표다. `§ 12.88` AC 1 ② 가 정당화한 재방문은 **축이 다른** 경우 (`ADR-0002` 의 `R1` → `R5`) 였으므로, **같은 축에서 이미 면제된 좌표를 다시 여는 것** 은 새 판정이며, 그 결론이 `L` 축 "마감" 의 정의 자체를 좌우한다 (면제 유지 시 `grep -lE 'L[0-9]+'` 는 영구히 `ADR-0008` 을 반환 → `§ 12.83` 한계 1 의 en dash 축 문제와 동형으로 마감이 절 기록에 의존). (나) **동일 좌표의 2 형태 반복 첫 실발현**: `ADR-0046` 의 `L171` 은 `:26` 에서 **링크 label 안** (`[data-model.md L171](...)`), `:136` 에서 **비링크 bare 좌표** (`§2 ExportJob/ImportJob / L171 artifact 저장소 deferred`) 로 형태를 달리해 2 회 등장한다 — `§ 12.86` 한계 5 (반복 label 일관성은 grep 으로 검출되지 않는다) 가 처음으로 실제 후보에서 발현하며, 두 형태의 단위어 부착이 서로 달라도 되는지가 쟁점이다. (다) **`§` prefix 좌표 + 코드 파일 좌표 4 번째 선례**: `ADR-0046`:47 의 `export-dump.ts` `§44~51` 은 **`§` 를 prefix 로 쓴 코드 파일 좌표 범위** 로 `R5` 문언 (`L` prefix 금지) 밖이지만, census 3 분해에서 **좌표 `~`** 로 계수되면 그 파일의 `R5` 존치 조건을 무너뜨린다 — "규율 대상 아님" 과 "좌표로 계수함" 이 양립하는지가 첫 판정이며, `ADR-0015`:80 (`llm-http-gateway.service.ts L198`) 은 코드 파일 좌표의 **4 번째** 선례다.

`CLAUDE.md` §3.1 **rule 5** (기존 `docs/decisions/*` 본문의 **비-결정 수정** = `direct`) 의 **열두 번째** 적용 선례이며, 편집 대상은 `L` prefix 제거 + 단위어 부착에 한정되고 ADR 의 결정 실질은 무편집이다.

## Required Reading

- [docs/use-cases/REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) — `§ 12.76` (정본 조문 `R1` ~ `R7` · 특히 `R4` · `R5` 존치 조건 · `R6` · `R7` · AC 3 ③ 한정 소급) · `§ 12.80` 전문 (7034 행~ · **대조표 #4 = `ADR-0008`:149 `R7` 면제 확정** · #8 코드 파일 좌표) · `§ 12.83` 한계 1 (마감이 절 기록에 의존하는 구조) · `§ 12.86` 한계 5 (반복 label) · `§ 12.87` AC 3 ① (label 전체 좌표) · `§ 12.88` 전문 (7476 행~ · 특히 AC 1 ②④ · AC 3 ①②③ · AC 6 잔존 목록 · 한계 3 · 6 · 파생 영향 (1)). 신설 절은 파일 **끝** (`## 11. References` 직전) 에 append.
- [docs/decisions/ADR-0008-auth-credential-type.md](../decisions/ADR-0008-auth-credential-type.md) — planner 실측 후보 **1 행 / 2 좌표** (`:149` 의 `L60` + `L230` — `§ 12.80` 면제분), raw `~` **5** (좌표 **4** = 179 ~ 182 행 batch 3 정정분 · 수량 **1** = `:24` 의 `~5~6 task`), en dash **0**, 총 **197 행** · 링크 **35** · `## ` heading **5**.
- [docs/decisions/ADR-0046-export-dump-materialization-storage.md](../decisions/ADR-0046-export-dump-materialization-storage.md) — planner 실측 후보 **2 행 / 2 좌표** (`:26` 링크 label 안 `data-model.md L171` · `:136` References bullet 의 bare `/ L171 artifact 저장소`), raw `~` **1** (`:47` 의 `export-dump.ts §44~51` = **`§` prefix 코드 파일 좌표**), en dash **0**, 총 **151 행** · 링크 **64** · `## ` heading **8**.
- [docs/decisions/ADR-0015-llm-live-integration-test-contract.md](../decisions/ADR-0015-llm-live-integration-test-contract.md) — planner 실측 후보 **1 행 / 1 좌표** (`:80` 링크 label 안 코드 파일 좌표 `llm-http-gateway.service.ts L198`), raw `~` **0**, en dash **0**, 총 **129 행** · 링크 **34** · `## ` heading **5**.
- [CLAUDE.md](../../CLAUDE.md) — §3 (cap 300 LOC · 5 파일) · §3.1 rule 5 (비-결정 doc 수정 = `direct`) · §12 정본 pointer 소절.

## Acceptance Criteria

- [ ] **AC 1 — 대상 선정 · 한정 소급 · 동일 축 재방문 · mode · cap 판정.** audit 신설 절 `§ 12.89` 안에 ① 선정 근거 (`§ 12.88` 파생 (1) 1 순위 · 잔존 4 중 **3 파일** 편성 이유 · `ADR-0047` 을 batch 13 으로 미룬 5 파일 cap 근거), ② 한정 소급 준수 (AC 2 census 가 파일 · 행 단위로 특정 → `§ 12.76` AC 3 ③ 충족 · **전면 일괄 치환 금지** 재확인) 과 **동일 축 재방문 정당성** (`ADR-0008` 은 `§ 12.80` 이 **같은 `R5` 축** 에서 이미 심리한 파일이라 `§ 12.88` AC 1 ② 의 "축이 다르면" 논거가 **그대로는 적용되지 않음** 을 인정하고, 재방문 근거를 별도로 세울 것 — 잔존 좌표가 **미판정분이 아니라 면제분** 이라는 사실을 근거에 명시), ③ mode 근거 (`CLAUDE.md` §3.1 rule 5 **열두 번째 선례** · 선례 `§ 12.78` ~ `§ 12.88` 열거), ④ **cap 가드** (확정 정정 좌표 수가 **70 초과** 면 파일 하나를 batch 13 으로 이월하고 판단 결과를 명시 · `§ 12.87` · `§ 12.88` AC 1 ④ 승계) 를 각각 **1 문단씩** 박제.
- [ ] **AC 2 — 후보 census 재실측 (집계 1 구).** 3 파일에 대해 `grep -nE 'L[0-9]+' <file>` (행 단위) · `grep -oE 'L[0-9]+' <file> | wc -l` (좌표 단위) · raw `grep -oE '[0-9] *~ *[0-9]' <file> | wc -l` 을 실행해 값을 절 안에 기록하고, Required Reading 의 planner 기준값 (**1 / 2** · **2 / 2** · **1 / 1**) 과의 **차이를 명시** (차이 0 이면 "차이 0"). `§ 12.80` AC 2 의 "행 수 ≠ 좌표 수 · 행 단위 grep 은 하한" 승계를 1 문장으로 재확인하고, 본 batch 총 격차 (**5 − 4 = 1**) 가 `§ 12.88` 의 **6** 대비 최소 수준인 이유 (한 행 다좌표가 `ADR-0008`:149 **1 행 (2 좌표)** 뿐) 를 1 문장으로 대조. 후보 총량 (**4 행 / 5 좌표**) 이 본 축 **최소 batch** 임도 1 구로 기록.
- [ ] **AC 3 — 판정 3 종 독립 결론.** ① **기판정 면제 좌표의 재방문 (res judicata) 첫 판정** — `ADR-0008`:149 의 `L60` + `L230` 에 대해 (가) `§ 12.80` 대조표 #4 의 면제 판정을 **유지할지 재심할지** 를 먼저 확정하고 (`R7` 문언 + `§ 12.88` AC 3 ② 의 면제 성립 test 를 동일 기준으로 재적용해 결론이 뒤집히는지 확인 — 결론이 같으면 "재심 결과 유지", 다르면 근거를 명시해 정정), (나) 면제 유지로 결론날 경우 그 좌표가 **영구 잔존** 함을 인정하고 `L` 축 **"마감" 의 조작적 정의** 를 `grep -lE 'L[0-9]+' docs/decisions/ADR-*.md` **0** 이 아니라 "**면제 확정분만 잔존**" 으로 재정의해 1 문장으로 박제 (`§ 12.83` 한계 1 의 en dash 축 동형 구조 명시 — 자동 검출로는 마감 여부를 구분할 수 없다), (다) 동일 좌표를 **두 slice 가 두 번 심리** 한 비용을 한계로 이관하고 재방문 방지 수단 (면제 확정분 목록의 절 내 명시) 을 1 문장 제안. ② **동일 좌표 2 형태 반복 첫 판정** — `ADR-0046` 의 `L171` 이 `:26` **링크 label 안** 과 `:136` **비링크 bare 좌표** 로 나타나는 두 형태에 대해 **원 표기 → 정정 표기** 를 각각 제시하고, 단위어 부착이 두 형태에서 **동일해야 하는지** 를 `§ 12.85` 한계 4 의 부착 3 규칙 + `§ 12.87` AC 3 ① (label 전체 좌표) 로 판정한 뒤, `:136` 의 `§2 ExportJob/ImportJob / L171` 처럼 **슬래시로 비좌표 토큰과 병기** 된 경우 부착 위치를 어디로 잡는지 (`§ 12.88` AC 3 ① 의 "묶음 경계" 판단 승계) 를 1 문장으로 확정. 두 정정 결과가 **같은 좌표를 가리킨다는 사실이 독자에게 보존** 되는지도 1 문장 검산. ③ **`§` prefix 좌표 판정 + `R5` 존치 조건 파일별 판정** — 3 파일의 raw `~` 실측치를 `§ 12.86` AC 3 ① 의 **좌표 / 수량 / 식별자 3 분해** 로 나눠 표 또는 열거로 제시하되, `ADR-0046`:47 의 `export-dump.ts` `§44~51` 에 대해 (가) `R5` 는 `L` prefix 만 규율하므로 **정정 대상이 아님** 을 확정하고, (나) 그럼에도 3 분해에서 **좌표 `~` 로 계수** 되는지 (계수하면 `ADR-0046` 존치 **불성립**) 를 결론내며, (다) "규율 대상 아님 + 좌표로 계수함" 이 모순이 아닌 이유 (존치 조건은 `R5` 위반 여부가 아니라 **파일에 `~` 좌표 표기가 이미 있는지** 를 묻는다) 를 1 문단으로 박제하고, `§` prefix 좌표의 조문화 필요성을 `R8` 묶음으로 이월. 이어 (라) `ADR-0008` (좌표 `~` **4** → 불성립) · (마) `ADR-0015` (`~` **0** → 형식상 **성립** → `§ 12.83` AC 3 ③ 재량 논거 또는 `§ 12.82` AC 3 ① 자기 소멸 논거 중 어느 경로로 정정에 이르는지 확정) 를 각각 1 구로 결론.
- [ ] **AC 4 — 대조표.** 후보 행 전량 (3 파일 합계 **4 행**) 을 `# / 파일 / 행 / 원 표기 / 판정 / 근거 조문` **6 컬럼** 표로 박제 (유형이 같으면 행 압축 허용 · 압축 시 행·좌표 수를 셀 안에 표기). `R6` · `R7` · `R4` 면제 판별 건수와 `L` 제거로 인한 **조사 보정 건수** 를 1 구로 명시하고, 이미 `~` 를 쓰는 좌표 (`R1` 이미 준수 · `R5` 만 적용) 와 단일 행 좌표 (`R4` 병용) 의 수를 구분해 적는다. `R7` 면제 유지분 (`ADR-0008`:149) 은 판정 셀에 **면제 (재심 후 유지 / 정정)** 를 명시하고 근거 조문에 `R7` + `§ 12.80` 대조표 #4 를 함께 단다.
- [ ] **AC 5 — 무편집 검산.** `git diff --numstat` 로 실제 편집한 파일의 **추가 행 수 = 삭제 행 수** 임을 보이고 (면제 유지 파일은 `numstat` 에 나타나지 않음을 명시), hunk 가 `## Decision` · `## Consequences` · `## Alternatives` 구간에 떨어지면 `§ 12.83` AC 5 · `§ 12.88` AC 5 의 "rule 5 경계는 **구간이 아니라 결정 실질**" 판정을 승계해 비-결정 수정임을 1 문장으로 확인 (문장 · 수치 · 링크 URL 무변경 — 링크 label 안 좌표 정정이 **URL 을 건드리지 않았음** 을 링크 수 불변으로 명시). frontmatter (`status` · `date`) hunk **0**. 정정 후 재실측으로 **행 수 (197 · 151 · 129) · 링크 수 (35 · 64 · 34) · `## ` heading 수 (5 · 8 · 5) 불변** 과 `L` prefix **잔존 수** 를 파일별로 적고, 잔존 수가 면제 · 이월 판정분과 **동수** 인지 대조.
- [ ] **AC 6 — `L` 축 잔여 갱신 + 마감 경로 확정.** `grep -lE 'L[0-9]+' docs/decisions/ADR-*.md | wc -l` 과 비-ADR 대상 `grep -lE 'L[0-9]+' docs/architecture/*.md .claude/agents/*.md | wc -l` 을 정정 후 실행해 **`L` 잔존 파일 수** 를 갱신 기록하고 `§ 12.88` AC 6 의 값 (ADR **4** · 비-ADR **14**) 과 대조. 감소분이 **실제 정정 파일 수** 와 일치하는지 확인하고, 불일치하면 원인 (AC 3 ① 면제 유지 잔존) 을 명시한다. 이어 잔존 ADR 목록을 좌표 수와 함께 열거하고, **batch 13 = `ADR-0047` (1 행 / 1 좌표) 단독** 이 `L` 축 ADR **마감 slice** 가 되는지를 AC 3 ① (나) 의 재정의된 마감 기준으로 1 문장 판단한다 (면제 잔존 파일이 남으면 "grep 0 마감" 은 도달 불가임을 명시).
- [ ] **AC 7 — 자기 준수 · 범위 검산 1 구.** 신규 추가분 대상 자기 준수 grep (`grep -nE '[0-9]+ *– *[0-9]+|L[0-9]+'` 를 신설 절 · task 파일 대상으로) hit 수를 적고 전량이 **원 표기 인용 (`R6` 예외)** 임을 확인. `wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md` 전후 값으로 신설 절이 **≤ 60 행** 임을, `git diff --stat` 으로 **≤ 300 LOC · ≤ 5 파일** 임을, `git status --short` 로 `README.md` · `CLAUDE.md` · `docs/requirements.md` · `docs/PLAN.md` · `docs/architecture/` · 다른 `docs/decisions/*` · `.claude/agents/` · `docs/LOOP.md` · `src/` · `prisma/` 변경 **0** 임을 검산. audit 파일 fence **짝수** · 신설 표 **6 컬럼 균일** · heading 순번 `12.88` → `12.89` **연속** 도 확인. doc-only 라 `pnpm test` 불요 (`CLAUDE.md` §3.2 direct doc-only 면제).
- [ ] **AC 8 — 진척 · 한계 · 파생 영향.** 절 말미에 진척 1 문단 (batch 12 결과 수치 · 처리 좌표 수 · 면제 · 이월 여부 · `L` 잔존 ADR 추이 · 병기 변형 누적 수 · 마감 정의 재정의 사실), 한계 **4 개 이상** (좌표 값 정확성 미검증 승계 · census 행 단위 하한 · 회색지대 조문 부재 (현 **5 종** + 식별자 범위 + 병기 변형 + label 전체 좌표 · 약칭화 + 7 연결 체인 · 자기 참조 좌표 + **`§` prefix 좌표 신규**) · 단위어 부착 규칙의 비조문성 · **면제 확정분의 재심 비용과 마감 자동 검출 불가** · 반복 좌표 일관성의 grep 미검출 · FU14 anchor 흡수 관계 등), 파생 영향 **목록만** (다음 1 순위 = batch 13 `ADR-0047` 단독 = `L` 축 ADR 마감 · 비-ADR 14 파일 정규화 · `R5` 개정 판단 · `R8` 조문화 우선순위 · batch 상한을 파일 수 → 좌표 수로 재설계) 을 박제. **파생 항목은 본 slice 에서 착수 금지**.

## Out of Scope

- 본 3 ADR **밖** 의 파일 편집 — `L` 잔존 나머지 ADR (`ADR-0047`) · 비-ADR (`directory.md` · `integrator.md` · `reviewer.md` · `race-patterns.md` · `p3-*.md` 등 14 파일) 정규화는 batch 13 이후.
- **en dash 축 재개** — `§ 12.83` AC 6 이 마감을 선언했으므로 잔존 좌표는 재판정하지 않는다.
- **`§` prefix 좌표의 실제 정정** — `ADR-0046`:47 의 `§44~51` 은 AC 3 ③ 에서 **판정만** 하고 편집하지 않는다 (`R5` 문언 밖 · 조문화는 `R8` 이월).
- **좌표가 가리키는 대상 파일 (`docs/architecture/data-model.md` · `src/llm/llm-http-gateway.service.ts` · `test/e2e/users.e2e-spec.ts`) 의 편집** — 본 slice 는 ADR 안 표기 형식만 고친다. 대상 행 번호가 실제로 맞는지도 검증하지 않는다 (`§ 12.74` 판정 승계).
- `§ 12.80` 절 **본문의 소급 수정** — 대조표 #4 의 면제 판정을 재심하더라도 `§ 12.80` 은 편집하지 않고 신설 절 `§ 12.89` 안에서만 결론을 박제한다 (기록 보존).
- `§ 12.76` **조문 본문 편집** — `R5` 존치 조건 개정 · 예시 목록 갱신 · 단위어 부착 규칙 · 식별자 범위 · `§` prefix 좌표 규정의 조문화는 `§ 12.79` 파생 (3) + `§ 12.85` 한계 3 · 4 + `§ 12.88` 파생 (3) 이월 유지 (별도 slice).
- **`R8` 조문화** (회색지대 + 병기 변형 + 저자 test) · `R2` · `R3` 병합 재설계 · FU14 anchor 좌표계 이행 — 관계 언급만, 착수 금지.
- ADR 의 `## Decision` · `## Consequences` · `## Alternatives` 실질 · frontmatter `status` · `date` 변경, 링크 URL 변경 (label · 괄호 안 좌표만 정정).
- `docs/STATE.json` · `docs/progress/journal-*.md` 편집 (driver bookkeeping 몫) · `src/` · `prisma/` · `.github/workflows/` 일체.

## Suggested Sub-agents

`implementer` 단독 (doc-only · ADR 3 파일 in-place 정정 + audit 절 신설 1). 코드 변경 0 이므로 `tester` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Follow-ups

- **batch 13 = `L` 축 ADR 마감 slice** — 잔존 `ADR-0047` (1 행 / 1 좌표 · `:138` 의 `data-model.md L171`) 단독이라 파일 수 · 좌표 수 모두 최소다. `ADR-0046`:26 · `:136` 과 **같은 좌표 (`L171`) 를 서로 다른 ADR 이 가리키는** 구조라, 본 slice 의 AC 3 ② 판정을 batch 13 이 **문서 간에도** 일관 적용할지 판단이 필요하다.
- **비-ADR `L` 축 14 파일** — `R5` 존치 예시 목록 (`p3-implementation-plan.md` · `reviewer.md`) 과 정면 충돌이라 `§ 12.76 R5` 개정 판단 slice 를 **선행** 시킬지 순서 판단 필요 (`§ 12.88` Follow-up 승계).
- **면제 확정분 registry** — AC 3 ① (다) 가 제안할 "면제 확정 좌표 목록" 을 audit 안 한 곳에 모아두면 후속 batch 의 재심 비용과 마감 판정 혼선을 함께 줄일 수 있다 (`R8` 조문화 slice 와 묶을 후보).
