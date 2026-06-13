// R-96 Admin LLM 모델 지정 UI — 난이도(easy/medium/hard) 슬롯별 provider 선택 폼
// (REQ-049/REQ-050/REQ-051, ADR-0040 §1). backend 는 이미 완결 (GET /api/llm/providers,
// GET/PATCH /api/llm/difficulty-mappings/:difficulty) 이라, 본 컴포넌트는 그 위에 올라가는
// 순수 presentational controlled component 다 — provider 목록·현재 슬롯 매핑·변경 콜백·
// loading/error 를 props 로만 받아 렌더하며, 실제 fetch·실 PATCH 요청·전역 상태·라우팅
// 배선은 후속 slice 책임 (Out of Scope). 직전 slice(LoginForm, EvaluationResultTable,
// EvaluationGuardBanner) 와 동일한 props/분기/named·default export convention 을 차용한다.

// provider 선택 옵션 — backend sanitize view 와 정합한 비밀 미포함 형태(apiKey 제외).
interface ProviderOption {
  // provider config 식별자 — <option> 의 value 이자 mapping 값과 매칭된다.
  id: string;
  // provider 종류 라벨(예: openai/anthropic) — option 표시에 함께 쓴다.
  provider: string;
  // 모델 식별자(예: gpt-4o) — option 표시 주 라벨로 쓴다.
  modelId: string;
}

// 평가 난이도 슬롯 — 3 슬롯 고정.
type Difficulty = 'easy' | 'medium' | 'hard';

// 렌더할 난이도 슬롯 정의 — 각 슬롯의 키와 한국어 라벨 매핑(렌더 순서 고정).
const DIFFICULTY_SLOTS: { key: Difficulty; label: string }[] = [
  { key: 'easy', label: '쉬움' },
  { key: 'medium', label: '보통' },
  { key: 'hard', label: '어려움' },
];

// loading 중 노출할 기본 한국어 문구.
const LOADING_TEXT = '불러오는 중…';
// provider 0개(빈 목록)일 때 노출할 기본 한국어 문구 — 선택할 옵션이 없으므로 슬롯 폼 대신 렌더.
const EMPTY_PROVIDERS_TEXT = '등록된 LLM provider 가 없습니다';
// 미할당(null) 슬롯의 placeholder 옵션 라벨 — value 는 빈 문자열.
const UNASSIGNED_LABEL = '선택 안 함';

interface DifficultyModelSelectorProps {
  // 선택 가능한 provider 목록 — controlled component 라 상위가 보유한다(빈 배열이면 빈 상태).
  providers: ProviderOption[];
  // 난이도 슬롯별 현재 할당된 providerId 매핑 — 미할당 슬롯은 null.
  mapping: Record<Difficulty, string | null>;
  // 슬롯 선택 변경 콜백 — placeholder("선택 안 함") 가 아닌 provider 가 선택됐을 때만 호출한다.
  onAssign: (difficulty: Difficulty, providerId: string) => void;
  // 목록 조회 진행 중 플래그 — true 면 providers 유무와 무관하게 로딩 표시 우선(loading 우선 정책).
  loading?: boolean;
  // 저장 실패 등 에러 문구 — truthy 면 role="alert" 영역에 렌더, 없으면 미렌더.
  error?: string;
}

// 난이도별 LLM 모델 선택 폼. provider 목록·현재 매핑을 표시하고 변경 콜백만 호출하는
// presentational 책임만 진다 — 실제 매핑 저장/낙관적 업데이트는 상위 컨테이너가 수행한다.
function DifficultyModelSelector({
  providers,
  mapping,
  onAssign,
  loading,
  error,
}: DifficultyModelSelectorProps) {
  // loading 우선 정책 — 진행 중이면 providers 유무와 무관하게 로딩 표시만 렌더한다.
  if (loading === true) {
    return <div role="status">{LOADING_TEXT}</div>;
  }

  // 빈 목록 분기 — 선택할 provider 가 없으므로 슬롯 <select> 대신 빈 상태 메시지를 렌더한다.
  // (mapping 에 잔존 할당이 있더라도 선택 가능한 옵션이 없어 빈 상태를 우선한다.)
  if (providers.length === 0) {
    return <div role="status">{EMPTY_PROVIDERS_TEXT}</div>;
  }

  // <select> 변경 핸들러 — placeholder(빈 value) 선택은 무시하고, provider 선택 시에만 콜백 호출.
  const handleChange = (
    difficulty: Difficulty,
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const providerId = event.target.value;
    if (providerId !== '') {
      onAssign(difficulty, providerId);
    }
  };

  return (
    <div>
      {/* 에러가 있을 때만 alert 영역을 렌더 — 빈 에러가 자리를 차지하지 않게 한다. */}
      {error ? <div role="alert">{error}</div> : null}

      {DIFFICULTY_SLOTS.map((slot) => (
        <label key={slot.key}>
          {slot.label}
          <select
            name={slot.key}
            // controlled — 현재 매핑값을 반영하되 미할당(null)·미지의 id 는 placeholder 로 fallback.
            value={mapping[slot.key] ?? ''}
            onChange={(event) => handleChange(slot.key, event)}
          >
            {/* 미할당 placeholder 옵션 — value 는 빈 문자열이라 콜백을 트리거하지 않는다. */}
            <option value="">{UNASSIGNED_LABEL}</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.modelId} ({provider.provider})
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

export type { ProviderOption, Difficulty, DifficultyModelSelectorProps };
export default DifficultyModelSelector;
