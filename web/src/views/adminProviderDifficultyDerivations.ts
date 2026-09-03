// AdminView 의 provider · 난이도 파생 helper 축을 담는 모듈 — T-1880 순수 추출(PLAN 183 행
// god component 부채의 열여섯째 실분할). 직전 T-1879(경로 빌더 8 심볼)의 Out of Scope 가 다음
// slice 로 넘긴 바로 그 축이며, T-1876(adminMembershipDerivations — 파생 helper + row 타입 동반
// 이동)의 선례를 그대로 따른다.
//
// 본 모듈의 심볼은 AdminView 에서 **본문 한 줄도 바꾸지 않고** 옮겨온 것이다(동작 · 계약 · spec
// 무변경 — 선언 앞에 export 키워드만 붙였다). 각 선언 위의 주석 블록은 그 helper 가 지키는 보수적
// fallback 규약(index 합성 key · 빈 문자열 채움 · 선택 필드 생략 · 미지 키 무시)의 근거 정본이라
// 함께 옮겼다. 이동 대상은 AdminView 의 연속 블록 두 조각 — row 타입 2(498 행 ~ 518 행:
// LlmProviderRow · DifficultyMappingRow)와 상수 1 + helper 4(574 행 ~ 664 행: DIFFICULTY_KEYS ·
// deriveProviders · deriveProviderConfigs · deriveDifficultyMapping · mergeMapping) 이다.
// DIFFICULTY_KEYS 는 이동 전에도 AdminView 배럴에 없던 모듈-private 심볼이라 여기서도 export 하지
// 않는다(공개 표면 무변경 — adminMembershipDerivations 의 FALLBACK_MEMBER_NAME 선례 동형).
//
// 배치를 web/src/views/ 아래로 잡은 이유는 이동 블록이 전부 순수 함수라 남는 외부 의존이 표시용
// 타입 ProviderOption · Difficulty · LlmProviderConfigRow 셋뿐이기 때문이다. JSX 가 없으므로
// 확장자는 .ts 다(adminMembershipDerivations · adminResourcePathBuilders 선례 동형). 표시용 타입은
// 재선언하지 않고 각 정본 모듈에서 직접 가져온다(정본 1 개 유지 — drift 차단).
//
// AdminView 와의 방향: AdminView → 본 모듈(값 · 타입 의존) 의 **단방향** import 만 만든다. 본 모듈은
// AdminView 를 import 하지 않는다(역방향이 필요해지면 이동 범위를 잘못 잡았다는 신호 — 범위를 넓히지
// 말고 Follow-ups 로 남긴다). AdminView 파일 끝 export 배럴이 임포트한 값 4 개(deriveProviders ·
// deriveProviderConfigs · deriveDifficultyMapping · mergeMapping)와 타입 2 개(LlmProviderRow ·
// DifficultyMappingRow)를 이동 전 표면 그대로 re-export 하므로, 기존 계약 spec 의 './AdminView'
// import 경로는 무수정으로 산다(공개 표면 무변경).

import type {
  ProviderOption,
  Difficulty,
} from '../components/DifficultyModelSelector';
import type { LlmProviderConfigRow } from '../components/LlmProviderConfigList';

// LLM provider row 의 frontend-local 최소 타입 — backend sanitize view(api.md 114 6 필드)
// 중 DifficultyModelSelector 가 쓰는 id/provider/modelId 세 후보만 보수적으로 매핑한다.
// 모든 필드를 선택적으로 두어 누락/비정상 row 도 throw 없이 받는다(③a~④a frontend-local
// 최소 타입 convention 정합 — apiKey 등 잔여 필드는 무시).
export interface LlmProviderRow {
  id?: string;
  provider?: string;
  modelId?: string;
  // T-1134 — LlmProviderConfigList 파생용 선택 필드. backend sanitize view(api.md 114)의
  // endpointUrl 후보를 보수적으로 매핑한다(있으면 표시·없으면 생략). DifficultyModelSelector
  // 는 이 필드를 쓰지 않아 deriveProviders 동작은 불변이다.
  endpointUrl?: string;
}

// 난이도 매핑 row 의 frontend-local 최소 타입 — 슬롯 키(difficulty)와 할당된 provider config
// id(llmProviderConfigId) 두 후보만 보수적으로 매핑한다. 둘 다 선택적이라 누락/비정상 row 도
// throw 없이 받는다(빈 배열 seed 전·미지의 난이도 키 안전 처리는 deriveDifficultyMapping 책임).
export interface DifficultyMappingRow {
  difficulty?: string;
  llmProviderConfigId?: string | null;
}

// 난이도 슬롯 고정 3 키 — deriveDifficultyMapping 의 기본 골격(미지의 키 무시 + 누락 슬롯 null).
const DIFFICULTY_KEYS: Difficulty[] = ['easy', 'medium', 'hard'];

// provider 응답 row 배열 → DifficultyModelSelector 의 ProviderOption[] 파생(순수 helper).
// rows 가 배열이 아니면 빈 배열을 반환한다(throw 없이). id/provider/modelId 누락 row 는
// 보수적 fallback — id 누락 row 는 index 기반 합성 key(`p<n>`), provider/modelId 누락은 빈
// 문자열로 채워 컴포넌트가 undefined 를 렌더하지 않게 한다(③a~④a 보수 매핑 convention).
export function deriveProviders(
  rows: LlmProviderRow[] | undefined,
): ProviderOption[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.map((row, index) => ({
    id: row.id ?? `p${index + 1}`,
    provider: row.provider ?? '',
    modelId: row.modelId ?? '',
  }));
}

// provider 응답 row 배열 → LlmProviderConfigList 의 LlmProviderConfigRow[] 파생(순수 helper,
// T-1134). deriveProviders 와 동형이되 sanitized 읽기 전용 view 계약에 맞춘다 — id/provider 는
// 필수 매핑(id 누락 row 는 index 기반 합성 key `p<n>` 로 React key 안정성 유지, provider 누락은
// 빈 문자열), modelId/endpointUrl 은 truthy 일 때만 매핑하고 누락/빈값이면 생략한다(선택 필드는
// undefined 로 두어 컴포넌트가 없을 때 렌더에서 자연 skip — throw 없음). secret apiKey 는 view
// 타입에 없어 매핑 대상이 아니다. rows 가 배열이 아니면(undefined/null/조회 전) 빈 배열을
// 반환한다(빈 상태 위임 — throw 없이).
export function deriveProviderConfigs(
  rows: LlmProviderRow[] | undefined,
): LlmProviderConfigRow[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.map((row, index) => {
    const config: LlmProviderConfigRow = {
      id: row.id ?? `p${index + 1}`,
      provider: row.provider ?? '',
    };
    // modelId/endpointUrl 은 있으면(truthy) 매핑, 없으면 키 자체를 생략한다(선택 필드 계약).
    if (row.modelId) {
      config.modelId = row.modelId;
    }
    if (row.endpointUrl) {
      config.endpointUrl = row.endpointUrl;
    }
    return config;
  });
}

// 난이도 매핑 응답 row 배열 → Record<Difficulty, string | null> 파생(순수 helper). 세 슬롯
// (easy/medium/hard) 을 키로 하고 기본값은 null(빈 배열 seed 전 안전 처리). 응답에 해당
// 슬롯이 있으면 그 llmProviderConfigId 를 채우되, 빈 문자열/누락은 null 로 보정한다. 미지의
// 난이도 키(예 'expert') 는 무시한다(세 슬롯 외 키는 골격에 없어 자연 skip — throw 없음).
// rows 가 배열이 아니어도 세 슬롯 모두 null 인 기본 매핑을 반환한다(throw 없이).
export function deriveDifficultyMapping(
  rows: DifficultyMappingRow[] | undefined,
): Record<Difficulty, string | null> {
  const mapping: Record<Difficulty, string | null> = {
    easy: null,
    medium: null,
    hard: null,
  };
  if (!Array.isArray(rows)) {
    return mapping;
  }
  for (const row of rows) {
    const key = row.difficulty as Difficulty | undefined;
    // 세 슬롯에 속한 키만 반영(미지의 난이도 키는 무시) — type-narrowing 후 안전 할당.
    if (key && DIFFICULTY_KEYS.includes(key)) {
      // 빈 문자열/누락 id 는 미할당(null)으로 보정 — placeholder fallback.
      mapping[key] = row.llmProviderConfigId ? row.llmProviderConfigId : null;
    }
  }
  return mapping;
}

// 서버 파생 매핑 위에 낙관적 override 를 덮는 순수 helper — ④c PATCH 발사 직후 재조회 도착
// 전까지 재지정한 슬롯이 즉시 새 provider 를 반영하도록 한다. override 의 각 슬롯값이 정의돼
// 있으면(undefined 가 아니면) base 를 덮고, undefined 슬롯은 base 를 유지한다(부분 override).
// override 가 비거나(아무 슬롯도 없음) 모두 undefined 면 base 와 동일한 새 객체를 반환한다.
export function mergeMapping(
  base: Record<Difficulty, string | null>,
  override: Partial<Record<Difficulty, string | null>>,
): Record<Difficulty, string | null> {
  const merged: Record<Difficulty, string | null> = { ...base };
  for (const key of DIFFICULTY_KEYS) {
    const value = override[key];
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  return merged;
}
