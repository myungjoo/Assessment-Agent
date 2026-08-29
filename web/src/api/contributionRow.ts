// backend `GET /api/contributions` 응답 row → 기여 상세 표시 row 순수 매핑 helper —
// REQ-075 기여 상세 축 slice 1 (T-1790). 현행 DashboardView 의 컨테이너-로컬
// `ContributionRow`(web/src/views/DashboardView.tsx 186 행) 는 라벨을 `metricLabel` →
// `label`, 점수를 `score` → `contribution`, 근거를 `rationale` → `narrative` 순으로
// 읽는데, contribution.controller.ts 97~106 행 이 Prisma row 를 그대로 반환하므로 실제
// 필드는 prisma `model Contribution`(prisma/schema.prisma 329~349 행) 의 `sourceType` ·
// `sourceUrl` · `sourceRef` · `difficulty` · `contributionScore`(Decimal) · `volume` 이다.
// 겹치는 키가 `id` 하나뿐이라 **모든 기여 항목이 라벨 "지표 미상" · 점수 0 · 근거 없음**
// 으로 렌더된다. 본 모듈은 그 간극을 흡수하는 **매핑 규칙만** 담고, 실제 소비 배선
// (DashboardView 의 로컬 `ContributionRow` · `deriveContributionMetrics` 철거) 은 후속
// slice 책임이다(본 task Out of Scope — T-1727 · T-1789 선례).
//
// 순수성 계약(assessmentRow.ts · summaryRow.ts 관례 승계): fetch · React · useApiResource
// import 0 · module-level 가변 상태 0 · throw 0 · 입력 mutation 0. 어떤 비정상 입력
// (null · undefined · 배열 · 원시값 · Object.freeze 된 객체 · 타입 우회 값)도 값으로 흡수한다.

import { parseNumericField } from './assessmentRow';

// 라벨을 끝내 파생할 수 없을 때 쓰는 결정적 fallback 라벨. 빈 문자열을 두면 상세 패널의
// 항목 제목이 통째로 비어 행 구분이 불가능해지므로, DashboardView 의 `지표 미상` 관례를
// 따라 사람이 읽을 수 있는 값을 남긴다.
export const FALLBACK_CONTRIBUTION_LABEL = '기여 미상';

// `sourceType` 과 `sourceRef` 를 한 줄로 합성할 때 쓰는 구분자. 두 값 모두 짧은 토큰
// (예: `github-pr` · `#128`) 이라 공백 하나로 충분히 읽힌다.
const LABEL_SEPARATOR = ' ';

// 표시 행의 키 목록(선언 순서 = 아래 인터페이스 순서). drift guard spec 이 이 목록과
// 실제 매핑 결과의 Object.keys 를 함께 검사해, 한쪽만 고치는 실수를 fail 로 드러낸다.
export const CONTRIBUTION_DISPLAY_ROW_KEYS = [
  'id',
  'label',
  'sourceType',
  'sourceUrl',
  'sourceRef',
  'difficulty',
  'score',
  'volume',
] as const;

// 기여 상세 표시 행 1 개. `label` · `score` 두 축은 EvaluationDetailPanel 의
// `EvaluationMetricItem` 계약(web/src/components/EvaluationDetailPanel.tsx 31~42 행) 과
// 이름을 맞춰, 소비 배선이 점수 결손 행만 처리하면 그대로 항목으로 쓸 수 있게 한다.
export interface ContributionDisplayRow {
  // React key 이자 행 식별자. backend `id` 결손 시 index 기반 합성 key 를 쓴다.
  id: string;
  // 표시용 라벨 — `sourceType` · `sourceRef` 에서 파생한다(아래 toContributionLabel 규약).
  label: string;
  sourceType: string;
  // 외부 본문을 가리키는 pointer(본문 자체가 아님 — schema.prisma 325~327 행). 표시
  // 계층이 링크로 렌더할 수 있도록 원문을 그대로 보존한다.
  sourceUrl: string;
  sourceRef: string;
  difficulty: string;
  // contributionScore. Prisma `Decimal` 이라 JSON 직렬화 경로에 따라 `"12.5"` 문자열로도
  // `12.5` 숫자로도 도착한다 — parseNumericField 가 두 표현을 모두 수용한다. 파싱 실패 시
  // 0 으로 위장하지 않는다 — 0 점과 "값 없음" 은 의미가 전혀 달라서(T-1788 `value` 정책
  // 승계), 표시 계층이 "—" 로 렌더하거나 집계에서 제외할 수 있도록 null 을 그대로 넘긴다.
  score: number | null;
  // volume(Int). 결손 정책은 score 와 동일 — 0 회 기여와 "집계 없음" 은 다르다.
  volume: number | null;
}

// 문자열 축 fallback — 결손·비문자열은 빈 문자열로 흡수한다(표시 계층이 공백을 렌더).
function toDisplayString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

// 라벨 후보 1 개를 정규화한다. 문자열이 아니거나 공백만 있으면 `null`(결손) 이다 —
// 공백만 있는 라벨은 사람에게 빈 라벨과 구분되지 않기 때문이다.
function toLabelPart(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * 기여 라벨 1 개를 파생한다.
 *
 * 4 분기: 둘 다 존재하면 `"{sourceType} {sourceRef}"`, `sourceType` 만 있으면 그 값,
 * `sourceRef` 만 있으면 그 값, 둘 다 결손이면 `FALLBACK_CONTRIBUTION_LABEL`.
 * 문자열이 아닌 입력(숫자 · 객체 · null 등) 과 공백만 있는 문자열은 결손으로 간주한다(throw 0).
 */
export function toContributionLabel(sourceType: unknown, sourceRef: unknown): string {
  const type = toLabelPart(sourceType);
  const ref = toLabelPart(sourceRef);
  if (type !== null && ref !== null) {
    return `${type}${LABEL_SEPARATOR}${ref}`;
  }
  if (type !== null) {
    return type;
  }
  if (ref !== null) {
    return ref;
  }
  return FALLBACK_CONTRIBUTION_LABEL;
}

// `id` 결손 행의 합성 key 를 만든다. 배열 순번이 그대로 key 가 되도록 `c{index+1}` 규약
// (DashboardView 의 기존 합성 key 규약 승계). 호출측이 정수 순번을 준다는 전제지만,
// 타입 우회로 비정상 index(NaN · Infinity · 소수 · 음수) 가 들어와도 `cNaN` 같은 값이
// key 로 새지 않도록 0 번째로 흡수한다(throw 0).
function toSyntheticId(index: number): string {
  if (!Number.isFinite(index) || index < 0) {
    return 'c1';
  }
  return `c${Math.trunc(index) + 1}`;
}

/**
 * backend 응답 row 1 개를 기여 상세 표시 행으로 매핑한다.
 *
 * 매핑 불가(비-객체 · `null` · 배열)면 `null` 을 반환한다. `id` 결손(비문자열이거나
 * 공백뿐) 은 행을 버리지 않고 `index` 기반 합성 key 로 흡수한다 — 상세 패널은 목록
 * 전체를 보여줘야 해서 식별자 하나 때문에 항목을 감추면 오히려 정보가 사라지기 때문이다
 * (assessmentRow · summaryRow 의 표 행 정책과 의도적으로 다르다). 그 외 문자열 필드
 * 결손은 `''`, 숫자 필드 결손은 `null` 로 흡수한다. 수치 해석은 assessmentRow 의
 * `parseNumericField` 를 재사용한다(로직 복제 0). 입력 객체는 읽기만 한다(mutation 0).
 */
export function toContributionDisplayRow(
  raw: unknown,
  index: number,
): ContributionDisplayRow | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const source = raw as Record<string, unknown>;
  const rawId = source.id;
  const id =
    typeof rawId === 'string' && rawId.trim() !== '' ? rawId : toSyntheticId(index);
  return {
    id,
    label: toContributionLabel(source.sourceType, source.sourceRef),
    sourceType: toDisplayString(source.sourceType),
    sourceUrl: toDisplayString(source.sourceUrl),
    sourceRef: toDisplayString(source.sourceRef),
    difficulty: toDisplayString(source.difficulty),
    score: parseNumericField(source.contributionScore),
    volume: parseNumericField(source.volume),
  };
}

/**
 * `GET /api/contributions` 응답 전체를 기여 상세 표시 행 배열로 매핑한다.
 *
 * 배열이 아니면(`null` · `undefined` · 객체 · 문자열 등) 빈 배열이다 — 호출측이 응답
 * 도착 전/오류 응답에서도 분기 없이 `.map` 할 수 있게 하기 위함이다. 매핑에 실패한
 * 원소만 제외하고 나머지 원소는 원본 순서대로 보존한다(부분 결손이 전체를 지우지 않는다).
 * 합성 key 는 **원본 배열의 index** 로 만들어, 앞선 원소가 걸러져도 같은 행이 같은 key 를
 * 유지하도록 한다(정렬은 하지 않는다 — 본 slice Out of Scope).
 */
export function deriveContributionDisplayRows(raw: unknown): ContributionDisplayRow[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const rows: ContributionDisplayRow[] = [];
  raw.forEach((entry, index) => {
    const mapped = toContributionDisplayRow(entry, index);
    if (mapped !== null) {
      rows.push(mapped);
    }
  });
  return rows;
}
