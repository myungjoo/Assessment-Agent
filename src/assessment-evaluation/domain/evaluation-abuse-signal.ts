// computeAbuseSignal — P5 abusing 방지 metric 의 결정적 순수 domain helper
// (R-26 코드 abusing: commit/PR 숫자만 늘리기 + R-40 문서 abusing: 의미 없는 기여
// 단순 반복). 한 author batch 의 `EvaluationInput[]` 에서 **반복 기반 부풀리기
// 신호**(다수 near-identical 저-volume 단위, code/document 별 차등)를 결정적으로
// 산출한다. 본 파일은 의존성 0 의 순수 함수만 둔다 — NestJS `@Injectable` / Prisma /
// LLM gateway import 0, throw 0, 부수효과 0(referential transparency, 입력 비변형).
// 동일 입력은 항상 동일 출력 — LLM 정성 평가와 분리해 독립 검증 가능하다(ADR-0032 §3
// "양은 metadata 기반 deterministic 수치, LLM 무관" 정신과 정합).
//
// 책임 경계(본 task = detection layer 만, Out of Scope):
//   - 본 helper 는 신호만 산출한다. advantage 중립화 / 감점 반영은 후속 scoring
//     service slice 가 본 신호를 소비해 처리한다(별도 task).
//   - 정성 abusing 판단(의미 있는 기여인지)은 LLM layer 책임 — 본 helper 무관.
//   - `evaluation-volume.ts`(volume 산출) / `evaluation-dedup.ts`(시간적 중복 ·
//     self-follow-up 제거)와 별도 layer 다. 본 helper 는 dedup 을 수행하지 않고
//     입력을 있는 그대로 받아 반복 신호를 측정한다(dedup 은 호출 전 단계의 책임).
//
// 패턴 mirror: evaluation-volume.ts(순수 함수 + 방어적 입력 처리 + 비유한 number
// 방어) + evaluation-dedup.ts(author/unitId 그룹핑 + 입력 비변형 + Map 누적).

import type { ContributionKind, EvaluationInput } from "./evaluation-input";
import { calculateEvaluationVolume } from "./evaluation-volume";

// LOW_VOLUME_THRESHOLD — volume 이 본 값 미만이면 "저-volume 단위"로 분류한다.
// 저-volume + 고반복 조합이 abusing 의 핵심 시그니처다(작은 단위를 숫자만 늘려
// 반복). v1 baseline = 3 (titleLength 3 글자 미만급 — evaluation-volume.ts 가
// titleLength 를 volume 으로 쓰는 현 규칙 기준의 휴리스틱 경계).
export const LOW_VOLUME_THRESHOLD = 3;

// SUSPECTED_REPETITION_RATIO — author 의 repetitionRatio 가 본 값 이상이고 단위가
// MIN_UNITS_FOR_SUSPICION 이상이면 abusing 으로 의심한다(suspected=true). 0~1 비율
// 경계 — v1 baseline = 0.5 (단위 절반 이상이 저-volume 반복이면 의심).
export const SUSPECTED_REPETITION_RATIO = 0.5;

// MIN_UNITS_FOR_SUSPICION — 단위 수가 본 값 미만이면(예: 단일 단위) 반복 abusing
// 판정 자체가 무의미하므로 suspected=false 로 고정한다(경계 보호). v1 baseline = 2.
export const MIN_UNITS_FOR_SUSPICION = 2;

// AbuseKindBreakdown — contributionKind(code/document) 1 종의 분해 신호.
export interface AbuseKindBreakdown {
  // 해당 kind 의 전체 단위 수.
  unitCount: number;
  // 해당 kind 중 저-volume(< LOW_VOLUME_THRESHOLD)으로 분류된 단위 수.
  lowVolumeUnitCount: number;
  // 해당 kind 중 반복(같은 unitId 또는 같은 volume 이 2 건 이상 등장)으로 분류된
  // 단위 수 — 반복 그룹에 속한 단위의 누적 카운트.
  repeatedUnitCount: number;
}

// AuthorAbuseSignal — 한 author 의 abusing 신호 집계.
export interface AuthorAbuseSignal {
  // author 외부 식별자.
  author: string;
  // 이 author 의 전체 단위 수.
  unitCount: number;
  // 저-volume(< LOW_VOLUME_THRESHOLD) 단위 수.
  lowVolumeUnitCount: number;
  // 반복 비율(0~1) — (저-volume 이면서 반복 그룹에 속한 단위 수) / unitCount.
  // byAuthor 에 등장하는 author 는 항상 unitCount ≥ 1 이라 분모 0 은 발생하지 않는다.
  repetitionRatio: number;
  // abusing 의심 여부 — unitCount ≥ MIN_UNITS_FOR_SUSPICION 이고 repetitionRatio
  // ≥ SUSPECTED_REPETITION_RATIO 이면 true.
  suspected: boolean;
  // contributionKind(code/document) 별 분해.
  byKind: Record<ContributionKind, AbuseKindBreakdown>;
}

// AbuseSignal — computeAbuseSignal 의 산출 타입. author 별 신호 배열 + batch 차원의
// 의심 여부(author 중 1 명이라도 suspected 면 true).
export interface AbuseSignal {
  // 평가 대상 전체 단위 수(입력 배열 길이).
  totalUnitCount: number;
  // author 별 신호. author 의 최초 등장 순서 기준으로 안정적·결정적 정렬.
  byAuthor: AuthorAbuseSignal[];
  // batch 차원 의심 여부 — byAuthor 중 1 명이라도 suspected=true 면 true.
  suspected: boolean;
}

// emptyBreakdown — kind 분해의 0 초기값.
function emptyBreakdown(): AbuseKindBreakdown {
  return { unitCount: 0, lowVolumeUnitCount: 0, repeatedUnitCount: 0 };
}

// 내부 author 누적 상태. byKind 는 code/document 둘 다 0 으로 초기화한다.
interface AuthorAccumulator {
  author: string;
  // 단위별 (volume, kind, unitId) 신호. 반복 그룹 판정에 쓰인다.
  units: { volume: number; kind: ContributionKind; unitId: string }[];
  byKind: Record<ContributionKind, AbuseKindBreakdown>;
}

/**
 * 한 batch 의 평가 입력에서 반복 기반 abusing 신호를 결정적으로 산출한다
 * (R-26 코드 abusing + R-40 문서 abusing detection layer).
 *
 * 알고리즘(결정적·LLM 무관):
 *   1. 입력을 author 별로 그룹핑한다(최초 등장 순서 보존).
 *   2. 각 단위의 volume 을 `calculateEvaluationVolume` 로 산출하고
 *      LOW_VOLUME_THRESHOLD 미만이면 저-volume 으로 분류한다.
 *   3. author 안에서 "반복 그룹" 을 식별한다 — 같은 `unitId` 가 2 건 이상이거나
 *      (code/document 동일), 같은 (kind, volume) 조합이 2 건 이상인 단위는 반복으로
 *      본다. 반복 그룹에 속하면서 저-volume 인 단위 수를 repetitionRatio 의 분자로
 *      쓴다(저-volume × 반복 = abusing 시그니처).
 *   4. repetitionRatio = (저-volume 반복 단위 수) / unitCount(분모 ≥ 1 보장).
 *   5. suspected = unitCount ≥ MIN_UNITS_FOR_SUSPICION 이고 repetitionRatio ≥
 *      SUSPECTED_REPETITION_RATIO.
 *   6. contributionKind(code/document) 별로 unitCount / lowVolumeUnitCount /
 *      repeatedUnitCount 를 분해해 code abusing 과 document abusing 을 구분한다.
 *
 * 방어:
 *   - 빈 배열 → totalUnitCount 0, byAuthor [], suspected false.
 *   - metadata 누락 / 비-number titleLength / 비정상 timestamp 등은
 *     `calculateEvaluationVolume`(throw 0, fallback 0)이 흡수한다 — volume 0 은
 *     저-volume 으로 분류되어 신호에 반영되되 throw 는 발생하지 않는다.
 *   - 입력 배열·원소를 변형하지 않고 새 객체만 반환한다(부수효과 0).
 *
 * @param inputs 평가 입력 배열(`EvaluationInput[]`). 변형하지 않는다.
 * @returns author 별 + batch 차원 abusing 신호(`AbuseSignal`).
 */
export function computeAbuseSignal(inputs: EvaluationInput[]): AbuseSignal {
  // author → 누적 상태. 최초 등장 순서 보존을 위해 order 배열을 병행한다.
  const accumulators = new Map<string, AuthorAccumulator>();
  const authorOrder: string[] = [];

  inputs.forEach((input) => {
    let acc = accumulators.get(input.author);
    if (acc === undefined) {
      acc = {
        author: input.author,
        units: [],
        byKind: { code: emptyBreakdown(), document: emptyBreakdown() },
      };
      accumulators.set(input.author, acc);
      authorOrder.push(input.author);
    }

    const volume = calculateEvaluationVolume(input);
    acc.units.push({
      volume,
      kind: input.contributionKind,
      unitId: input.unitId,
    });
  });

  const byAuthor = authorOrder.map((author) => {
    // Map 채움 직후 같은 키로 항상 존재 — non-null 단언 안전.
    const acc = accumulators.get(author) as AuthorAccumulator;
    return summarizeAuthor(acc);
  });

  const suspected = byAuthor.some((a) => a.suspected);

  return {
    totalUnitCount: inputs.length,
    byAuthor,
    suspected,
  };
}

// summarizeAuthor — 한 author 누적 상태를 AuthorAbuseSignal 로 축약한다(순수).
function summarizeAuthor(acc: AuthorAccumulator): AuthorAbuseSignal {
  const unitCount = acc.units.length;

  // 반복 그룹 식별용 카운트 — unitId 빈도 + (kind, volume) 빈도.
  const unitIdCounts = new Map<string, number>();
  const kindVolumeCounts = new Map<string, number>();
  acc.units.forEach((u) => {
    unitIdCounts.set(u.unitId, (unitIdCounts.get(u.unitId) ?? 0) + 1);
    const kv = `${u.kind}#${u.volume}`;
    kindVolumeCounts.set(kv, (kindVolumeCounts.get(kv) ?? 0) + 1);
  });
  // unitIdCounts / kindVolumeCounts 는 위 forEach 가 acc.units 의 모든 unitId /
  // (kind, volume) 키를 채운다. 아래 조회는 같은 acc.units 를 순회하므로 키가 항상
  // 존재한다 — count 헬퍼로 non-null 을 좁혀 dead-branch(`?? 0`) 없이 읽는다.
  const countOf = (m: Map<string, number>, key: string): number =>
    m.get(key) as number;

  let lowVolumeUnitCount = 0;
  let lowVolumeRepeatedCount = 0;

  acc.units.forEach((u) => {
    const breakdown = acc.byKind[u.kind];
    breakdown.unitCount += 1;

    const isLowVolume = u.volume < LOW_VOLUME_THRESHOLD;
    if (isLowVolume) {
      lowVolumeUnitCount += 1;
      breakdown.lowVolumeUnitCount += 1;
    }

    // 반복 = 같은 unitId 가 2+ 건이거나 같은 (kind, volume) 가 2+ 건.
    const repeatedById = countOf(unitIdCounts, u.unitId) >= 2;
    const repeatedByKindVolume =
      countOf(kindVolumeCounts, `${u.kind}#${u.volume}`) >= 2;
    const isRepeated = repeatedById || repeatedByKindVolume;

    if (isRepeated) {
      breakdown.repeatedUnitCount += 1;
      if (isLowVolume) {
        lowVolumeRepeatedCount += 1;
      }
    }
  });

  // unitCount 는 항상 ≥ 1 — accumulator 는 단위가 1 건 이상 push 될 때만 생성되므로
  // 분모 0 은 구조적으로 발생하지 않는다(빈 batch 는 byAuthor 자체가 비어 있음).
  const repetitionRatio = lowVolumeRepeatedCount / unitCount;

  const suspected =
    unitCount >= MIN_UNITS_FOR_SUSPICION &&
    repetitionRatio >= SUSPECTED_REPETITION_RATIO;

  return {
    author: acc.author,
    unitCount,
    lowVolumeUnitCount,
    repetitionRatio,
    suspected,
    byKind: acc.byKind,
  };
}
