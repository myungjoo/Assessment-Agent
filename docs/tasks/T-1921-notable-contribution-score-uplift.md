---
id: T-1921
title: Apply deterministic contribution uplift for notable contributors
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-011]
independentStream: evaluation-scoring-domain
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.ts
  - src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.spec.ts
  - src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts
  - src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts
estimatedDiff: 285
estimatedFiles: 4
created: 2026-09-06
plannerNote: P5 REQ-011 — 중요기여 식별은 있는데 "더 높은 점수" 부여 축이 없다; uplift helper + pipeline 6 단계 배선 (pre-check 6c26c3ca)
---

# T-1921 — 중요기여 author 의 contribution 등급 결정적 상향

## Why

[README.md](../../README.md) `25 행` 은 "보다 더 중요한 기여, 보다 더 어렵고 남들이 못할 일을 한 개발자를 식별하여 **더 높은 점수**와 더 높은 평가 코멘트" 를 요구하고, [requirements.md](../requirements.md) `30 행` REQ-011 은 그래서 `IN_PROGRESS (중요·어려운 기여 식별 축 · pipeline wiring 축 실재 / README 25 행 뒷절의 "더 높은 점수" 부여 축 부재)` 다. 식별(`computeNotableContributionSignal`) 과 소비(`applyNotableContributionAnnotation`) 는 이미 main 에 있지만 소비측이 바꾸는 필드는 `narrative` 하나뿐이고, 그 파일 `30~32 행` 주석이 "volume / contribution 같은 정량·등급 필드를 손대지 않고 narrative 에 marker 만 접두 — **점수 반영은 별도 task**" 로 스스로 미구현을 자인한다. 본 task 가 그 "별도 task" 다 — 중요기여 author 의 `contribution` 등급을 결정적으로 상향해 REQ-011 의 마지막 축을 채운다.

**issue-still-relevant pre-check (origin/main `6c26c3ca` 실측)** — 재큐잉이 아니다. ① `git grep -iE "uplift|등급 상향" origin/main -- "src/**/*.ts"` 의 non-spec hit 는 [`evaluation-quality-adjust.ts`](../../src/assessment-evaluation/domain/evaluation-quality-adjust.ts) `60 행` · `110 행` **주석 2 건뿐**이고 둘 다 "등급 상향은 본 helper 의 책임이 아니다" 라는 **부재 선언**이라 구현 심볼 0 이다. ② 5-adjuster composer [`evaluation-adjustments-pipeline.ts`](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) `225~233 행` 의 마지막 step 은 여전히 `applyNotableContributionAnnotation(...).map((entry) => entry.result)` 이라 상향 step 이 배선돼 있지 않다. ③ `docs/tasks/` 최신 25 건에 uplift 계열 task 0 (직전 arc T-1915~T-1920 은 전부 REQ-037 reset 축). → 부분 안착조차 없음.

**경쟁 축 배제 근거** — PLAN `157 행` R-91(k6 실 scale 부하)은 배포기기 PAT · LLM 자격증명 게이트에 걸려 cron 이 자율 집행할 수 없고, PLAN `158 행` R-92 는 오너가 **신규 per-route perf baseline slice 큐잉을 금지**했다. 그래서 두 축 모두 본 turn 후보에서 제외했다. 직전 T-1920 의 `Follow-ups (a)`(응답에 `deletedContributions` 노출)는 스스로 "응답 계약 변경(ADR 급 결정)" 이라 적었고 판단 자체가 별건이라 본 turn 에서 선택하지 않았다.

## Required Reading

- [src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.ts](../../src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.ts) — 확장 대상. `78 행` marker 상수 · `85~92 행` `NotableContributionAdjustEntry` · `130~174 행` `applyNotableContributionAnnotation` 의 방어/멱등/비파괴 관행.
- [src/assessment-evaluation/domain/evaluation-quality-adjust.ts](../../src/assessment-evaluation/domain/evaluation-quality-adjust.ts) — **등급 강제 helper 의 정본 패턴**(`CONTRIBUTION_QUALITY_FLOOR_LEVEL` 상수 + author Map 색인 + 새 객체 복제 + null/undefined 만 한국어 `TypeError`). 본 task 는 이 floor 의 대칭 ceiling 이다.
- [src/assessment-evaluation/domain/evaluation-notable-contribution-signal.ts](../../src/assessment-evaluation/domain/evaluation-notable-contribution-signal.ts) `73~94 행` — `NotableContributionEntry`(`author` / `codeUnitCount` / `notable`) · `NotableContributionSignal` shape. **detection layer 는 변경하지 않는다.**
- [src/assessment-evaluation/domain/evaluation-result.ts](../../src/assessment-evaluation/domain/evaluation-result.ts) `31 행` `ContributionLevel` · `37~42 행` `CONTRIBUTION_LEVELS` · `47 행` `isContributionLevel`.
- [src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) `196~233 행` — (1)~(5) step + flatten. 본 task 는 (5) 뒤 · flatten 앞에 (6) 을 넣는다.
- 기존 colocated spec 2 개(추가 대상): [evaluation-notable-contribution-adjust.spec.ts](../../src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.spec.ts) · [evaluation-adjustments-pipeline.spec.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts)(`83~517 행` describe 골격).

## 설계 (구현 전 확정 — ADR 불요)

기존 `applyContributionQualityFloor`(하한 강제) 의 **대칭 상한**으로 설계한다. 새 ADR 을 만들지 않는다 — ADR-0032 §3 의 "품질 분류축 = LLM 정성 + 결정적 신호" 정신과 정합이고, 확장 지점이 기존 파일 주석이 이미 예고한 "별도 task" 이기 때문이다.

- 신규 상수 `NOTABLE_CONTRIBUTION_UPLIFT_LEVEL: ContributionLevel = "high"` — 상향 목표 등급 single-source. 한 등급씩 올리는 step 방식은 **비멱등**이라 쓰지 않는다(파이프라인 재적용 시 계속 오름).
- 신규 순수 함수 `applyNotableContributionUplift(entries: NotableContributionAdjustEntry[], signal: NotableContributionSignal): NotableContributionAdjustEntry[]` — 같은 파일에 추가하고 entry 타입은 재사용한다(신규 타입 0).
- 적용 규칙(결정적 · 단조 비하향 · 멱등 · LLM 무관):
  1. author 미매칭 → 무변경 passthrough(항상 새 객체 복제).
  2. `notable === false` → 무변경 passthrough.
  3. `notable === true` 이고 현재 등급이 `"zero"` → **무변경**. quality floor(step 3) 가 내린 하한을 되돌리지 않는다 — 신호 충돌 시 하한 우선.
  4. `notable === true` 이고 현재 등급이 `"low"` / `"medium"` → `"high"` 로 상향.
  5. `notable === true` 이고 이미 `"high"` → 값 동일(멱등, 새 객체 복제).
  6. 등급 값이 enum 외(`isContributionLevel` false, layer 경계 침입) → 보수적 무변경 passthrough.
- author-level 전파(= annotation 과 동형, `unitId` 매칭 없음). 입력 `entries` 길이 · 순서 보존, 입력 비변형.
- throw 는 `entries` / `signal` 이 null 또는 undefined 인 경우의 한국어 `TypeError` 2 건뿐. 그 외(빈 배열 · 빈 `byAuthor` · 미매칭)는 흡수.
- 배선: pipeline 에 step **(6) uplift** 를 (5) annotation 뒤 · flatten 앞에 넣는다. quality floor(3) 보다 뒤여야 규칙 3 의 "하한 우선" 이 실제로 성립한다 — 이 순서 근거를 코드 주석 1~2 줄로 남긴다.

## Acceptance Criteria

- [ ] `applyNotableContributionUplift` happy-path 1+ — `notable=true` author 의 `"low"` · `"medium"` 단위가 `"high"` 로 상향되고, 같은 author 의 **모든** 단위에 적용된다.
- [ ] error path 1+ — `entries` 가 null/undefined 일 때, `signal` 이 null/undefined 일 때 각각 한국어 메시지 `TypeError` 를 던진다(2 케이스).
- [ ] 분기별 1+ — 위 설계 규칙 1~6 의 6 분기 각각에 대응하는 `it` 존재(미매칭 / notable=false / zero 보존 / low·medium 상향 / high 멱등 / enum 외 무변경).
- [ ] negative case 를 예외 분기마다 1+ — ① quality floor 로 `"zero"` 가 된 단위가 상향되지 않음 ② `notable=false` author 무변경 ③ signal 에 없는 author 무변경 ④ 빈 `entries` → 빈 배열 ⑤ 빈 `signal.byAuthor` → 전 단위 무변경 ⑥ `difficulty` / `volume` / `narrative` / `unitId` 가 전사되어 변하지 않음 ⑦ 입력 `entries` · `result` 비변형(`Object.freeze` 통과 + 원본 스냅샷 동일).
- [ ] 멱등 1+ — 같은 입력에 2 회 연속 적용한 결과가 1 회 적용 결과와 같다.
- [ ] pipeline spec 1+ — 6-adjuster 순서에서 중요기여 author 단위가 `narrative` marker 접두와 `contribution === "high"` 를 **동시에** 만족한다. 추가로 quality floor 대상 단위는 같은 batch 에서 `"zero"` 로 남는다(하한 우선) 1 케이스.
- [ ] spec 은 colocated 위치에만 쓴다 — `src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.spec.ts` 와 `src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts` 에 describe 추가(신규 spec 파일 신설 0).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 함수는 statement/branch/function 100% 목표.
- [ ] diff ≤ 300 LOC · 파일 ≤ 5 개 유지(주석 산문은 요약 수준으로 제한, 초과 예상 시 산문부터 줄인다 — test 를 줄이지 않는다).

## Out of Scope

- detection layer(`evaluation-notable-contribution-signal.ts`) 및 `NOTABLE_RELATIVE_CEILING` 값 변경 — 식별 기준은 그대로 둔다.
- `difficulty` · `volume` · `narrative` 필드 변경, 기존 `applyNotableContributionAnnotation` 의 동작 변경.
- `prisma/schema.prisma` 에 notable 전용 컬럼 추가, 응답 계약 변경(T-1920 `Follow-ups (a)` 는 별건).
- `docs/requirements.md` REQ-011 재판정 · PLAN checkbox 승격 — CLAUDE.md `§3.1` 에 따라 본 slice 머지 **후** 별도 1 회.
- 새 ADR 신설, orchestrator 배선 변경(composer 단일 진입은 그대로).
- REQ-019 / REQ-020 의 상향 축(다른 신호) 은 건드리지 않는다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음)
