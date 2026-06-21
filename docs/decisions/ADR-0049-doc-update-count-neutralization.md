---
id: ADR-0049
title: "문서 update 횟수 중립화 — 점수 산출 alg 단계에서 update 횟수 축 제거 (동일 author + 동일 document N 회 update 를 1 event 로 합산, REQ-022)"
status: PROPOSED
date: 2026-06-21
relatedTask: [T-0572]
relatedReq: [REQ-022, REQ-021, REQ-012]
supersedes: null
augments: [ADR-0029, ADR-0033]
---

# ADR-0049 — 문서 update 횟수 중립화 정책 (REQ-022 / R-41)

> 본 ADR 은 **PROPOSED** — P5 evaluation pipeline 의 평가 metric 정책 중 [REQ-022](../requirements.md) ([README.md](../../README.md) L41 / R-41) "문서 작성 중 습관적으로 update 를 하여 중간 저장을 하여 update 횟수만 늘어나는 경우에 대해 advantage/disadvantage 둘 다 있어서는 안된다" 를 박제한다. 본 ADR 은 **평가 metric layer** 의 점수 산출 정책만 design-level 로 결정하며, impl chain (어느 helper / DTO / service 가 합산 logic 을 가지는가) 은 별도 후속 task 로 분해한다. [ADR-0029](ADR-0029-assessment-collection-orchestrator.md) (collection-layer dedup) 와 [ADR-0033](ADR-0033-evaluation-result-persistence.md) (Assessment persist 키) 를 보강(augment)한다 — 둘 다 수집·저장 layer 책임이고 본 ADR 은 직교한 metric layer 책임이다. PROPOSED → ACCEPTED flip 은 impl chain 첫 slice 머지 시 별도 direct task 가 수행한다.

## Context

### 트리거 — README L41 / REQ-022 가 P5 PLANNED 로만 남아 있다

[README.md](../../README.md) L41 은 "문서 작성 중 습관적으로 update 를 하여 중간 저장을 하여 update 횟수만 늘어나는 경우에 대해 advantage/disadvantage 둘 다 있어서는 안된다" 를 요구한다 (R-41). [requirements.md](../requirements.md) L41 의 [REQ-022](../requirements.md) ("문서 update 횟수 중립화 — advantage/disadvantage 둘 다 없음", FR / P5 / unit) 가 이를 표로 매핑하나 **PLANNED** 상태이며, 현재 어느 ADR 도 본 정책을 박제하지 않았다. Q-0045 옵션1 run-side 사슬(T-0556~T-0571)이 닫혀 chain 이 비었고 standing 게이트가 모두 외부 의존·미승인 상태이므로, cron 자율 진행이 가능한 forward-looking P5 metric 정책 ADR 을 우선 박제한다.

### Q (본 ADR 이 답하는 질문)

**"advantage·disadvantage 둘 다 없음 = 어떻게 점수 산출(metric) 단계에서 update 횟수의 영향을 제거하는가?"** — update 횟수가 점수에 **양(+)으로도 음(-)으로도** 기여하지 않아야 한다는 R-41 의 "둘 다 없음" 을 점수 산출 alg 의 어느 단계에서 어떤 단위로 구현할지 결정한다. positive 기여 금지(횟수 많다고 가산 금지)와 negative 기여 금지(횟수 많다고 감산/penalty 금지)를 동시에 만족하는 유일한 자연 해법은 **점수 산출 입력에서 update 횟수 축 자체를 제거**하는 것이다.

### 인접 ADR-0029 (collection-layer dedup) 와의 직교 단언

[ADR-0029](ADR-0029-assessment-collection-orchestrator.md) 는 **수집(collection) layer** 의 책임으로 commit SHA 기반 dedup (line 27 / 64 surface) — 같은 commit 이 여러 경로로 두 번 수집되는 것을 막는다. 본 ADR 은 **평가 metric layer** 의 책임으로, 정상적으로 수집된 N 개의 update event 가 점수 산출에 어떻게 반영되는가(=반영되지 않는가)를 결정한다. 즉 ADR-0029 는 "같은 변경을 두 번 세지 않는다"(수집 무결성)이고 본 ADR 은 "서로 다른 N 회의 정당한 update 를 점수에서 1 로 중립화한다"(metric 정책) — 두 결정은 다른 layer, 다른 surface, 직교다. [ADR-0033](ADR-0033-evaluation-result-persistence.md) 의 Assessment persist 키 `(period, periodStart, periodEnd)` 는 평가 결과의 **영속 시점** 정책이고, 본 ADR 의 update 횟수 합산은 **점수 산출 시점**의 입력 정규화로 영속 키와 직교한다(영속 키는 무변경).

### 인접 abusing 방지 set (REQ-012 / REQ-021) 과 본 REQ-022 의 위치 차이

[REQ-012](../requirements.md) (L31, 코드 abusing — commit/PR 숫자만 늘리기) 와 [REQ-021](../requirements.md) (L40, 문서 abusing — 의미 없는 기여의 단순 반복) 은 **악의(abuse) detect** 책임이다. 본 [REQ-022](../requirements.md) 는 그 부분집합이 아니라 **더 넓은 surface** 다 — 악의 없는 정상적 작업 습관(중간 저장을 위한 빈번한 save)까지 cover 한다. 개발자가 abuse 의도 없이 단지 작업 안전을 위해 자주 저장해도 그 update 횟수가 점수에 advantage / disadvantage 어느 쪽으로도 작용해선 안 된다. 따라서 REQ-022 는 abusing 방지 set(REQ-012/021)의 부분집합이 아니라, 그것과 부분 overlap 하되 더 넓은 "정상 습관 중립화" surface 를 갖는다(§Decision 3 가 경계를 명시).

## Decision

### Decision §1 — neutralization 단위: 점수 산출 alg 단계에서 update 횟수 축 제거 (동일 author + 동일 document 의 N 회 update → 1 contribution event 합산)

**채택: 한 문서(Confluence page 또는 GitHub document 변경)의 update 횟수가 metric 산출에 advantage / disadvantage 어느 쪽으로도 작용하지 않도록, 점수 산출 alg 의 입력 정규화 단계에서 update 횟수 축을 제거한다. 구체 형태로 "동일 author + 동일 document 의 N 회 update event 를 1 개의 contribution event 로 합산(collapse)" 을 채택한다 — 합산된 1 event 의 평가는 N 회의 update 가 누적한 최종 content delta(또는 의미 있는 변경 단위)에 대해 1 회 수행되며, N 값 자체(횟수)는 점수 산출 입력에서 배제된다.**

- **흐름**: 수집된 update event stream → 점수 산출 진입 시점에 `(author, documentKey)` 로 group-by → 각 group 을 1 contribution event 로 collapse → 평가 metric 은 collapse 된 event 에 대해서만 수행. update 횟수 N 은 group-by 의 cardinality 일 뿐 점수 함수의 인자로 흐르지 않는다.
- **"advantage 없음" 보장**: N 회 update 가 1 event 로 합산되므로 횟수를 늘려도 contribution event 수가 늘지 않는다 — 가산(boost) 경로가 구조적으로 차단된다.
- **"disadvantage 없음" 보장**: 합산은 penalty / 감산을 동반하지 않는다 — N 회 update 가 1 회 update 와 점수상 동등하게 취급되므로 "자주 저장했다는 이유로 손해" 가 발생하지 않는다.
- **Alternatives 3 종 trade-off 는 §Alternatives** (A 채택 / B positive metric 기각 / C penalty 기각).

### Decision §2 — boundary 명시: 적용 surface 는 "동일 author + 동일 document 의 N 회 update event" 1 종에 한정

**채택: §1 의 합산은 `(author, documentKey)` 키가 동일한 update event 에만 적용된다. `documentKey` = 동일 Confluence page (page id) 또는 동일 GitHub document path. 다른 author 가 같은 page 를 update 한 것은 별도 contribution event 로 cover 하며 합산 대상이 아니다.**

- **근거(REQ-022 의 자연 해석)**: R-41 의 "습관적 중간 저장" 은 **한 사람이 자기 작업 중** 자주 저장하는 행위다. 따라서 중립화 대상은 동일 author 의 반복 update 로 한정하는 것이 자연스럽다. 서로 다른 author 의 동일 page 기여는 각자 독립적 contribution 이므로 합산하면 안 된다(한 사람의 기여를 다른 사람의 기여로 흡수해 버리는 오류).
- **`documentKey` 정의**: Confluence = page id (space + title 이 아니라 안정적 id), GitHub = repository-relative document path. 두 source 의 키 형태가 달라도 "동일 문서" 의 식별 단위라는 의미는 동일하다 — impl chain 이 source 별 key normalization 을 책임진다(§Decision 4).
- **out of boundary**: 동일 author 가 **서로 다른 document** 를 update 한 것은 당연히 별개 event(합산 0). 동일 document 를 **다른 author** 가 update 한 것도 별개 event. 합산은 두 키가 **모두 같을 때만** 발생한다.

### Decision §3 — REQ-021 (문서 abusing) 과의 경계 및 적용 순서

**채택: REQ-021(문서 abusing — 동일 내용 paste-only 반복 등 악의적 단순 반복 detect)과 본 REQ-022(악의 무관한 update 횟수 중립화)는 cover 범위가 부분 overlap 가능하나 서로 다른 책임이다. 점수 산출 단계에서 적용 순서는 "§1 의 neutralization(횟수 합산)이 먼저 적용된 뒤, REQ-021 의 abusing detect 가 나중에 적용" 으로 박제한다.**

- **순서의 근거**: 먼저 §1 이 동일 author + 동일 document 의 N 회 update 를 1 event 로 collapse 하면, 그 collapse 된 1 event 의 **content 가 의미 있는 변경인가 / 단순 paste-only 반복인가** 를 REQ-021 의 abusing detect 가 평가한다. 순서를 뒤집으면(abusing detect 가 먼저) detect 로직이 횟수에 오염된 입력(N 회 분리된 event)을 보게 되어 "반복 자체" 와 "악의적 반복" 을 혼동할 위험이 있다 — 중립화가 먼저여야 abusing detect 가 횟수-중립적 입력 위에서 순수하게 content 만 평가한다.
- **경계 단언**: REQ-021 은 collapse 후에도 남는 "의미 없는 내용의 반복 기여(예: 같은 텍스트를 매번 paste 만)" 를 zero/low contribution 으로 판정하는 책임이고, REQ-022 는 그 판정 이전에 횟수 축을 제거하는 책임이다. 두 결정은 같은 metric pipeline 의 다른 stage 이며, REQ-021 본 결정 자체는 본 ADR 범위 밖(별도 ADR — Out of scope).

### Decision §4 — impl chain 위임 / design-level 박제만

**채택: 본 ADR 은 design-level 정책만 박제한다. §1 의 `(author, documentKey)` group-by + collapse 합산 logic 을 어느 helper / DTO / service 가 갖는지의 impl chain 은 별도 후속 task 로 분해한다.**

- **첫 impl slice candidate (1 줄 명시)**: `src/assessment-evaluation/dto/aggregate-document-updates.ts` 같은 **순수 helper**(`@Injectable` 0 / Prisma import 0) — update event 배열을 입력받아 `(author, documentKey)` 로 group-by 후 collapse 된 contribution event 배열을 반환하는 pure function 이 첫 slice 후보다(R-112 4 종 + negative cases 충분 cover: happy / 단일 event / 다중 author 동일 page 미합산 / 빈 입력 / key 누락 등).
- **layer 위치 미박제**: helper / service 위치 및 호출 시점(수집 직후 vs 점수 산출 직전)의 택1 은 첫 impl slice task 책임 — 본 ADR 은 "점수 산출 입력 정규화 단계" 라는 의미만 박제하고 코드 위치를 선점하지 않는다.

## Alternatives considered

### A. 점수 산출 단계에서 update 횟수 축 제거 — 동일 author + 동일 document N 회 → 1 event 합산 (채택)

본 ADR 의 채택안(§Decision 1). update 횟수가 점수 함수의 인자로 흐르지 않으므로 advantage(가산)·disadvantage(감산) 양쪽이 구조적으로 동시 차단된다. trade-off: collapse 시 `(author, documentKey)` join logic 의 정합 비용(§Consequences negative)이 발생하나, R-41 의 "둘 다 없음" 을 만족하는 가장 직접적이고 검증 가능한 해법이다. 합산된 1 event 의 평가는 최종 content delta 기준이라 "실제로 무엇을 기여했는가" 의 질 평가(README L36~39)와 정합한다.

### B. update 횟수 = positive metric — 횟수가 많을수록 가산 (현 default 가정, 명시 기각)

update event 수를 contribution 점수에 양으로 반영하는 안(예: "더 자주 기여한 사람이 더 활발") — 별도 정책이 없을 때 빠지기 쉬운 naive default. 기각 — R-41 의 "advantage 둘 다 있어서는 안된다" 를 정면 위반한다. 습관적 중간 저장만으로 점수가 오르면 평가가 작업 습관(저장 빈도)에 의해 왜곡되고, "내용 없이 save 만 반복" 하는 행위가 보상받아 abusing(REQ-021) surface 를 오히려 키운다. 본 ADR 의 §1 이 정확히 이 경로를 구조적으로 차단한다.

### C. update 횟수 = penalty — 횟수가 많을수록 감산 (의도된 disadvantage, REQ-022 위반이라 기각)

"중간 저장 남발 = noise" 로 보고 update 횟수에 비례해 점수를 감산하는 안 — abusing 억제 의도. 기각 — R-41 은 advantage 뿐 아니라 **disadvantage 도 둘 다 없어야** 한다고 명시하므로, penalty 는 REQ-022 정면 위반이다. 게다가 정상적 작업 습관(작업 안전을 위한 빈번한 저장)을 처벌하면 평가가 도구 사용 습관을 검열하는 셈이 되어 불공정하다 — 실제 기여 질이 동일한 두 사람이 저장 빈도만으로 점수가 갈린다. abusing 억제는 REQ-021 의 content 기반 detect(§Decision 3 순서)가 담당하지 횟수 penalty 가 담당하지 않는다.

### D. update interval 임계 기반 합산 — 짧은 간격 update 만 1 event 로 묶음 (미채택)

update 간 시간 간격이 임계(예: 10 분) 미만이면 "중간 저장" 으로 보고 합산, 임계 초과면 별도 event 로 보는 안 — "의미 있는 재방문 작업" 과 "연속 중간 저장" 을 구분하려는 의도. 미채택 — (1) 임계값 자체가 임의적(자의적 magic number)이라 평가 reproducibility 를 약화시키고, (2) 느리게 저장하는 사람과 빠르게 저장하는 사람을 다르게 취급해 또 다른 disadvantage 를 도입(R-41 위반 risk), (3) "동일 author + 동일 document" 라는 명확한 키(§Decision 2)가 interval 보다 단순하고 검증 가능하다. 향후 평가 정밀도 개선이 필요하면 별도 ADR 의 검토 대상으로 둔다.

## Consequences

### 긍정

- **REQ-022 명시 cover**: R-41 의 "advantage/disadvantage 둘 다 없음" 이 점수 산출 입력에서 update 횟수 축을 제거하는 단일 정책(§1)으로 구조적으로 보장된다 — 가산·감산 양쪽 경로가 동시에 차단되어 검증(unit test)이 명확하다.
- **impl chain 의 명확한 boundary**: §Decision 2 의 `(author, documentKey)` 키와 §Decision 4 의 순수 helper candidate 가 첫 impl slice 의 입력·출력·테스트 surface 를 명확히 박제해, 후속 task 가 cap(≤300 LOC / 5 파일) 안에서 닫힌다. abusing detect(REQ-021)와의 적용 순서(§3)도 사전에 박제되어 pipeline stage 충돌이 없다.

### 부정 / trade-off

- **author + page 키 join logic 의 정합 비용**: impl 시 Confluence page id 와 GitHub document path 라는 이질적 source 의 `documentKey` 를 author 와 함께 정규화·group-by 하는 join logic 이 필요하다 — source 별 key normalization 의 정합(같은 문서를 다른 키로 오인하거나, 다른 문서를 같은 키로 합치는 오류)이 first impl slice 의 핵심 negative test surface 다. mitigation: §Decision 4 의 순수 helper 로 분리해 unit test 로 happy / 다중 author 미합산 / key 누락 / 빈 입력 등 경계를 충분 cover 하면 join 정합 비용이 1 slice 안에서 검증·격리된다.

## doc-only marker

**본 task(T-0572)는 ADR 1 파일 신설 외 production code / spec / schema / config / dependency 변경 0 인 doc-only ADR 이다.** 따라서 [README.md](../../README.md) R-110 / R-111 / R-112 / R-113 / R-114 의 test·CI 의무는 **본 task 적용 0** (production code 변경 0) 이다. PR CI 의 lint/build/test 는 spec 변경 0 으로 통상 green 통과하며, reviewer 는 CI green + 본 ADR 본문 정합성 + 인접 ADR(0029/0033/0035)와의 직교 단언을 확인한다. 본 ADR 은 production code 변경 0 이라 분기가 없어 R-112 (4) negative cases 충분 cover 항목도 적용 0 이다(분기 없음 명시). 새 dependency 추가 0 / 새 schema migration 0 / 새 credential·env 0 — [CLAUDE.md §5](../../CLAUDE.md) BLOCKED 게이트 어느 축도 미발화.

## Out of scope

본 ADR 은 **결정(원칙)만 박제**한다 — 다음은 후속 task / 별도 ADR 책임:

- **impl chain 실구현 (helper / DTO / service / spec / module 등록)** — §Decision 4 의 `aggregate-document-updates.ts` 같은 순수 helper candidate + R-112 4 종 spec. 별도 후속 task 분해(≤300 LOC / 5 파일).
- **REQ-021 (문서 abusing detect) 의 결정 자체** — 본 ADR 은 경계(§Decision 3)와 적용 순서만 박제하고 REQ-021 본 결정(content 기반 paste-only 반복 detect alg)은 별도 ADR.
- **REQ-012 (코드 abusing) 의 결정** — 본 ADR 은 인접 augments 표기만, 본 결정은 별도 ADR.
- **PLAN.md / requirements.md / STATE.json doc-sync** — REQ-022 PLANNED → ADR-0049 PROPOSED 링크 표기. 본 task 머지 후 별도 doc-only direct task.
- **ADR status PROPOSED → ACCEPTED flip** — impl chain 첫 slice 머지 시 별도 direct task 가 ACCEPTED flip.
- **[ADR-0035](ADR-0035-aggregate-summary-evaluation.md) 의 일/주/월 요약 boundary 와의 합산 단위 연계** — 일/주/월 요약 평가의 시간 boundary 가 update event 합산 단위에 미치는 영향(예: 주 경계를 넘는 update 의 group-by 처리)의 정밀 결정은 본 ADR §1 의 design-level 박제 이후 별도 검토(인접 단언만, 본 결정 밖).

## References

- [README.md](../../README.md) L36~41 — 평가 목표 (R-40 abusing 방지 / R-41 update 횟수 중립화 원 표현)
- [docs/requirements.md](../requirements.md) L31 / 40 / 41 — REQ-012 (코드 abusing) / REQ-021 (문서 abusing) / REQ-022 (update 횟수 중립화) 매핑
- [docs/PLAN.md](../PLAN.md) Phase P5 bullet 102 (R-41 인용) — 본 ADR 의 PLAN surface
- [docs/decisions/ADR-0029-assessment-collection-orchestrator.md](ADR-0029-assessment-collection-orchestrator.md) line 27 / 64 — collection-layer dedup (본 ADR 과 직교 단언 근거)
- [docs/decisions/ADR-0033-evaluation-result-persistence.md](ADR-0033-evaluation-result-persistence.md) — Assessment persist 키 (영속 시점 vs 점수 산출 시점 직교)
- [docs/decisions/ADR-0035-aggregate-summary-evaluation.md](ADR-0035-aggregate-summary-evaluation.md) — 일/주/월 요약 boundary (합산 단위 연계, 인접 단언)
- [docs/decisions/ADR-0048-default-model-id-source.md](ADR-0048-default-model-id-source.md) — 가장 최근 평가-layer ADR (frontmatter / Decision 분해 / Alternatives 표기 스타일 참고)
- [CLAUDE.md §3.1 / §5](../../CLAUDE.md) — ADR-first(rule 4) / BLOCKED 게이트(새 dep / 새 credential / schema migration — 본 ADR 채택안은 어느 축도 미발화)

Refs: ADR-0049, REQ-022, REQ-021, REQ-012, T-0572
