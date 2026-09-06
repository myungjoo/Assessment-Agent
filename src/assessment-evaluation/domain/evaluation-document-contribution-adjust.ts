// applyDocumentContributionUplift — P5 문서 축 조직 기여 신호 소비측 결정적 순수
// domain helper (README 39 행 / REQ-020 "문서를 통해 큰 기여 → 더 높은 점수" 축).
// T-1923 `computeDocumentContributionSignal` 이 산출한 문서 축 신호를 소비해,
// 문서 축 notable author 의 평가 단위 `contribution` 등급을 결정적으로 상향한다.
//
// mirror 정본: evaluation-notable-contribution-adjust.ts 의 T-1921
// `applyNotableContributionUplift`. 규칙 · 방어 · 멱등 · 단조 · 입력 비변형 정책은
// 그 파일의 서술이 정본이므로 여기서 재진술하지 않는다. **역할 차이는 소비 신호
// 하나뿐** — 코드 축 `NotableContributionSignal`(codeUnitCount 기반) 대신 문서 축
// `DocumentContributionSignal`(documentUnitCount 기반)을 읽는다. 즉 코드 기여로
// notable 인 author 가 아니라 **문서 기여로 notable 인 author** 를 상향한다.
//
// 책임 경계: detection layer(`evaluation-document-contribution-signal.ts`) 재구현 0
// (신호는 single-source 로 소비만), `narrative` / `difficulty` / `volume` /
// `unitId` 무변경(필드 직교 — 코멘트 상향은 별도 slice), 의존성 0 의 순수 함수만
// 둔다(NestJS / Prisma / LLM import 0, 부수효과 0).

import type {
  DocumentContributionEntry,
  DocumentContributionSignal,
} from "./evaluation-document-contribution-signal";
import { CONTRIBUTION_QUALITY_FLOOR_LEVEL } from "./evaluation-quality-adjust";
import {
  isContributionLevel,
  type ContributionLevel,
  type EvaluationResult,
} from "./evaluation-result";

// DOCUMENT_CONTRIBUTION_UPLIFT_LEVEL — 문서 축 notable author 단위 `contribution`
// 상향 목표 등급 single-source. 한 등급씩 올리는 step 방식은 재적용 시 계속 올라
// **비멱등**이라 고정 목표 등급으로 강제한다. `CONTRIBUTION_QUALITY_FLOOR_LEVEL`
// (단조 하한) 의 대칭 상한이며, 코드 축 `NOTABLE_CONTRIBUTION_UPLIFT_LEVEL` 과
// 같은 v1 = `"high"` 로 두 축의 상향 강도를 대칭으로 맞춘다. LLM 무관 상수.
export const DOCUMENT_CONTRIBUTION_UPLIFT_LEVEL: ContributionLevel = "high";

// DocumentContributionAdjustEntry — applyDocumentContributionUplift 의 입력/출력
// 단위. 코드 축 `NotableContributionAdjustEntry` 와 동형 shape — caller 가 result
// 와 그 단위의 author(= `EvaluationInput.author`)를 함께 전달하고, 출력도 같은
// shape · 같은 순서로 반환해 매핑 재사용을 보장한다.
export interface DocumentContributionAdjustEntry {
  // 평가 단위 author 의 외부 식별자. `signal.byAuthor` 의 `author` 와 매칭해 문서
  // 축 notable 대상 여부를 조회한다.
  author: string;
  // 조정 대상 평가 결과 1 건. 본 helper 는 `contribution` 만 검토 / 상향하고
  // 나머지 필드(`unitId` / `narrative` / `difficulty` / `volume`)는 전사한다.
  result: EvaluationResult;
}

/**
 * 문서 축 기여 신호(`DocumentContributionSignal`)를 소비해, 문서 축 notable author
 * 의 **모든** 단위 `contribution` 을 `DOCUMENT_CONTRIBUTION_UPLIFT_LEVEL`(= `"high"`)
 * 로 결정적 상향한 새 entries 배열을 반환한다(README 39 행 / REQ-020 "더 높은 점수"
 * 축, T-1921 코드 축 uplift 의 문서 축 mirror).
 *
 * 적용 규칙(결정적 · 단조 비하향 · 멱등 · LLM 무관): (1) author 미매칭 /
 * (2) `notable === false` → 무변경 passthrough. (3) `notable === true` 라도 현재
 * 등급이 `"zero"` 면 **무변경**(quality floor 하한 우선 — 본 helper 는 하한을
 * 되돌리지 않는다). (4) `"low"` / `"medium"` → `"high"` 상향. (5) 이미 `"high"` →
 * 값 동일(멱등). (6) 등급이 enum 외(`isContributionLevel` false) → 보수적 무변경.
 *
 * 방어(흡수 정책): 빈 `entries` → 빈 배열, 빈 `signal.byAuthor` → 전 단위 무변경
 * 복제, author 미매칭 → 그 단위 무변경 복제. 입력 `entries` / 원소 / `result` /
 * `signal` 비변형 — 새 배열 · 새 객체만 반환(Object.freeze 입력 통과), 길이 ·
 * 순서 보존.
 *
 * throw(명시적 계약 위반만): `entries` 또는 `signal` 이 null/undefined 인 경우의
 * 한국어 `TypeError` 2 개뿐.
 *
 * @param entries 조정 대상 단위 배열(`{ author, result }[]`). 변형하지 않는다.
 * @param signal computeDocumentContributionSignal 산출 신호. 변형하지 않는다.
 * @returns 같은 길이 · 같은 순서의 새 entries 배열.
 */
export function applyDocumentContributionUplift(
  entries: DocumentContributionAdjustEntry[],
  signal: DocumentContributionSignal,
): DocumentContributionAdjustEntry[] {
  if (entries === null || entries === undefined) {
    throw new TypeError("entries 는 null 또는 undefined 일 수 없습니다.");
  }
  if (signal === null || signal === undefined) {
    throw new TypeError("signal 은 null 또는 undefined 일 수 없습니다.");
  }

  // author → DocumentContributionEntry 색인. byAuthor 가 빈 배열이어도 빈 Map 이
  // 되어 전 단위 미매칭(무변경)으로 흡수된다.
  const byAuthor = new Map<string, DocumentContributionEntry>(
    signal.byAuthor.map((entry) => [entry.author, entry]),
  );

  return entries.map((entry) => {
    const authorSignal = byAuthor.get(entry.author);
    const current = entry.result.contribution;
    // 규칙 3·6 — `"zero"`(하한 우선) 와 enum 외 값은 상향 대상에서 제외한다.
    const upliftable =
      authorSignal !== undefined &&
      authorSignal.notable &&
      isContributionLevel(current) &&
      current !== CONTRIBUTION_QUALITY_FLOOR_LEVEL;

    // 입력 비변형 — 항상 새 객체로 복제한다(contribution 만 갱신, 나머지 전사).
    return {
      author: entry.author,
      result: {
        ...entry.result,
        contribution: upliftable ? DOCUMENT_CONTRIBUTION_UPLIFT_LEVEL : current,
      },
    };
  });
}
