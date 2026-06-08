// evaluation-dedup — 평가-side dedup 순수 도메인 함수 2 종
// (ADR-0032 Decision §4 "dedup + self-follow-up(R-30) 제외 위치 = 평가-side").
// 부수효과 0 / 외부 의존 0 / throw 0 / `@Injectable` 0 / Prisma 0 / LLM 호출 0 /
// 입력 배열 비변형. `import` 는 도메인 내 `EvaluationInput` 만.
//
// 책임 2 종(ADR-0032 §4 (b)):
//   1. dedupTemporalDuplicates — 시간적 중복 earlier-date 우선(R-21). 동일 활동이
//      서로 다른 timestamp 로 재등장하면(예: 2 월 결과물이 3 월 timestamp 로 재귀속)
//      earliest 1 건만 평가에 남긴다. 동일 활동 식별 키 = `unitId`
//      (= `<sourceType>:<instanceKey>:<externalId>` 합성 — 동일 활동을 가리킨다).
//   2. excludeSelfFollowUps — self-follow-up 제외(R-30). 같은 `document` 기여 단위
//      안에서 동일 author 의 후속 활동(self-follow-up)을 평가 카운트에서 제외하되
//      최초 기여(issue 생성)는 유지한다. "자기 issue + 자기 후속" 으로 기여 숫자만
//      부풀리는 abusing(R-26/40 인접)을 평가 단계에서 차단.
//
// 경계(ADR-0032 §4 / Out of Scope):
//   - 수집-side dedup(commit SHA earliest-wins / page-id+version latest-wins)과는
//     별도 layer 다. fork/rebase/meld 구조적 중복(R-9)은 수집-side commit-dedup
//     책임이라 본 함수 범위 밖.
//   - comment thread 미수집(ADR-0032 §4 (d)) 상태라 self-follow-up 검출은 issue
//     단위 author 동일성 휴리스틱이다 — comment-level 정밀 검출은 수집 mapper 확장
//     (ADR-0029 경계) 별도 Follow-up slice 로 deferred.
//   - REQ-032 raw-not-stored 정합: 본 함수는 `EvaluationInput` 의 typed surface 만
//     읽고 raw 본문을 도입하지 않는다.
//
// 패턴 mirror: 수집-side commit-dedup.ts(`isEarlier` Date.parse 우선 + NaN 사전식
// fallback + earliest-wins Map 누적 + firstSeenOrder 안정적 반환 순서 + 입력 비변형)
// + 평가-side evaluation-volume.ts(순수 함수 + 방어적 입력 처리 + JSDoc 확장 여지).

import type { EvaluationInput } from "./evaluation-input";

// isEarlier — a 의 timestamp 가 b 보다 더 이른지(엄격히 작은지) 판정한다. ISO-8601
// 문자열은 사전식 비교가 시간 순서와 일치하지만(동일 timezone Z 가정), 방어적으로
// Date.parse 수치 비교를 우선하고 파싱 불가(NaN) 시 문자열 비교로 fallback 한다
// (commit-dedup.ts 의 isEarlier 와 동형 — 비정상 timestamp 에서도 결정적 순서 유지).
function isEarlier(a: string, b: string): boolean {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) || Number.isNaN(tb)) {
    // 비-파싱 timestamp 는 사전식 문자열 비교로 결정적 순서를 유지한다.
    return a < b;
  }
  return ta < tb;
}

// dedupByEarliest — 키 산출 함수가 주어졌을 때, 같은 키의 활동 중 earliest timestamp
// 1 건만 유지한 새 배열을 반환하는 공통 내부 헬퍼. 동일 timestamp tie 면 먼저 등장한
// 항목을 유지하고(입력 순서 보존), 반환 순서는 각 키의 *최초 등장* 위치 기준으로
// 안정적·결정적이다(commit-dedup.ts 의 winners/firstSeenOrder 알고리즘 mirror).
//
// keyOf 가 `undefined` 를 반환하는 활동은 dedup 대상에서 제외하고 원래 위치에 그대로
// 보존한다(예: excludeSelfFollowUps 의 code 기여 — self-follow-up 부적용 분기).
function dedupByEarliest(
  inputs: EvaluationInput[],
  keyOf: (input: EvaluationInput) => string | undefined,
): EvaluationInput[] {
  // key → 유지 중인 활동. earlier timestamp 가 등장하면 교체한다.
  const winners = new Map<string, EvaluationInput>();
  // 반환 순서 안정화용 슬롯. dedup 대상은 키의 최초 등장 위치에 슬롯을 두고,
  // dedup 비대상(keyOf === undefined)은 자기 위치에 그대로 둔다.
  const slots: { key: string | undefined; passthrough?: EvaluationInput }[] =
    [];

  inputs.forEach((input) => {
    const key = keyOf(input);

    if (key === undefined) {
      // dedup 비대상 — 자기 위치에 그대로 통과시킨다.
      slots.push({ key: undefined, passthrough: input });
      return;
    }

    const current = winners.get(key);
    if (current === undefined) {
      // 첫 등장 — 채택하고 이 위치에 슬롯을 만든다.
      winners.set(key, input);
      slots.push({ key });
      return;
    }

    // 같은 키 재등장 — earlier timestamp 가 승리한다(earliest-wins). 동일/이후
    // timestamp 면 기존 항목(먼저 등장)을 유지한다(tie-break = 입력 순서 보존).
    // 슬롯은 최초 등장 위치에 이미 있으므로 새로 추가하지 않는다(반환 순서 안정).
    if (isEarlier(input.timestamp, current.timestamp)) {
      winners.set(key, input);
    }
  });

  // 슬롯을 순서대로 직렬화 — dedup 대상은 winner, 비대상은 passthrough.
  return slots.map((slot) =>
    slot.key === undefined
      ? (slot.passthrough as EvaluationInput)
      : (winners.get(slot.key) as EvaluationInput),
  );
}

/**
 * 시간적 중복을 earlier-date 우선으로 제거한다(R-21, ADR-0032 §4 (b)-1).
 *
 * 동일 활동이 서로 다른 timestamp 로 재등장할 때(예: 2 월 결과물이 3 월 timestamp 로
 * 재귀속) earliest `timestamp` 1 건만 유지한다. 동일 활동의 식별 키 = `unitId`
 * (= `<sourceType>:<instanceKey>:<externalId>` 합성이므로 동일 활동을 가리킨다).
 *
 * 정책:
 *   - 같은 `unitId` 가 여럿이면 earliest-wins(가장 이른 timestamp 1 건만 유지).
 *   - timestamp tie 면 먼저 등장한 항목을 유지한다(입력 순서 보존 — 안정적·결정적
 *     tie-break).
 *   - 파싱 불가 timestamp 는 `isEarlier` 의 사전식 fallback 으로 결정적 순서를 유지.
 *   - 반환 순서는 각 키의 최초 등장 위치 기준으로 안정적이다.
 *   - 입력 배열을 변형하지 않고 새 배열을 반환한다(부수효과 0).
 *
 * commit-dedup.ts 의 earliest-wins(`isEarlier` + Map 누적 + firstSeenOrder) 알고리즘을
 * 평가-side `unitId` 키 위에서 재사용한다.
 *
 * @param inputs 평가 입력 배열(`EvaluationInput[]`). 변형하지 않는다.
 * @returns 동일 `unitId` 의 시간적 중복이 earliest 1 건으로 정리된 새 배열.
 */
export function dedupTemporalDuplicates(
  inputs: EvaluationInput[],
): EvaluationInput[] {
  return dedupByEarliest(inputs, (input) => input.unitId);
}

/**
 * self-follow-up 을 평가 카운트에서 제외한다(R-30, ADR-0032 §4 (b)-2).
 *
 * 같은 `document` 기여 단위(issue) 안에서 동일 author 의 후속 활동(self-follow-up)을
 * 제외하되, 최초 기여(issue 생성)는 유지한다. "자기 document 단위 + 자기 후속" 으로
 * 기여 숫자만 부풀리는 케이스를 차단한다(R-26/40 abusing 인접).
 *
 * issue 단위 휴리스틱(ADR-0032 §4 (d) comment 미수집 한계 반영):
 *   - 검출 대상은 `contributionKind === "document"` 활동만. code 기여는 self-follow-up
 *     개념이 부적용(ADR §4 의 'issue' 맥락)이라 그대로 보존한다.
 *   - 그룹 키 = `unitId` + `author`(공백 구분 — 동일 활동의 베이스 식별자 `unitId` +
 *     self 식별 기준 `author`). 같은 그룹 키의 document 활동이 2 건 이상이면 earliest
 *     timestamp 1 건(최초 기여)만 유지하고 나머지 동일-author 후속은 제외한다.
 *     `unitId` 는 `:` 합성이라 공백을 포함하지 않으므로 author 경계와 충돌하지 않는다.
 *   - **그룹 키 산출 규칙(v1 박제)**: 본 v1 은 `unitId` 를 그룹 키 베이스로 사용한다
 *     (동일 issue 의 재등장 단위가 동일 `unitId` 인 전제). comment 가 별도 `unitId` 로
 *     수집되는 미래 확장 시, 그룹 키를 issue-base(같은 issue 의 여러 unit 을 묶는 키)로
 *     좁히는 정밀화는 수집 mapper 확장(ADR-0029 경계) 별도 Follow-up slice 로 deferred.
 *   - 다른 author 의 동일 베이스 단위는 self 가 아니므로 모두 보존(author 동일성 false).
 *   - 입력 배열 비변형, 반환 순서 안정적(최초 등장 위치 기준), 결정적.
 *
 * 확장 여지(ADR-0032 §4 (d)): comment thread 미수집 상태라 self-follow-up 검출은 issue
 * 단위 author 동일성 휴리스틱이다 — comment-level 정밀 검출은 수집 mapper 확장 별도
 * Follow-up slice 로 deferred. fork/rebase/meld 구조적 중복(R-9)은 수집-side
 * commit-dedup 책임이라 본 함수 범위 밖.
 *
 * @param inputs 평가 입력 배열(`EvaluationInput[]`). 변형하지 않는다.
 * @returns self-follow-up 후속이 제외된(최초 기여만 남은) 새 배열.
 */
export function excludeSelfFollowUps(
  inputs: EvaluationInput[],
): EvaluationInput[] {
  return dedupByEarliest(inputs, (input) => {
    // code 기여는 self-follow-up 부적용 — dedup 대상에서 제외(자기 위치 보존).
    if (input.contributionKind !== "document") {
      return undefined;
    }
    // 그룹 키 = unitId + author(공백 구분). unitId 는 `:` 합성이라 공백을
    // 포함하지 않으므로 author 경계와 충돌하지 않는다.
    return `${input.unitId} ${input.author}`;
  });
}
