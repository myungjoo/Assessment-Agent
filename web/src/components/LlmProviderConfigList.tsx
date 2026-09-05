// R-96 Admin LLM 모델 지정 UI — 등록된 LLM provider 설정을 읽기 전용 목록으로 표시하는
// 컴포넌트 (REQ-096, ADR-0040 §1). backend 의 provider API 는 이미 완결 (GET /api/llm/providers
// + POST/PATCH/DELETE) 이라, 본 컴포넌트는 그 위에 올라가는 순수 presentational controlled
// component 다 — sanitized provider view 목록·loading/error 를 props 로만 받아 렌더하며, 실제
// fetch(GET /api/llm/providers)·생성/수정/삭제 mutation·전역 상태·라우팅 배선은 후속 slice
// 책임 (Out of Scope). 직전 slice(GroupMemberList, DifficultyModelSelector 등) 와 동일한
// props/분기(loading 우선 → error → empty → populated)/named·default export convention 을 차용한다.

// provider 설정 행 — backend sanitize view(LlmProviderConfigView = Omit<LlmProviderConfig, "apiKey">)
// 와 정합한 비밀 미포함 형태. apiKey 는 view 타입 자체에 없으므로 props 에도 렌더에도 포함하지
// 않는다(secret 미노출 정책 — 타입 레벨 차단).
interface LlmProviderConfigRow {
  // provider config 식별자 — React key 이자 상위 mutation 콜백의 인자로 쓰인다.
  id: string;
  // provider 종류 라벨(예: openai/anthropic) — 목록 항목 주 라벨.
  provider: string;
  // 모델 식별자(예: gpt-4o, 선택) — 있으면 provider 와 함께 표시, 없으면 provider 만 표시한다.
  modelId?: string;
  // provider 엔드포인트 URL(선택) — 있으면 함께 표시, 없으면 throw 없이 생략한다.
  endpointUrl?: string;
  // 전역 기본 provider 여부(선택, T-1897) — backend view 의 파생 필드 isDefault(ADR-0062
  // §Decision 3) 를 그대로 받는다. true 인 행에만 "기본" 배지를 렌더하고, false/미전달이면
  // 배지를 생략한다(선택 필드 계약 — modelId/endpointUrl 동형).
  isDefault?: boolean;
}

// loading 중 노출할 기본 한국어 문구.
const LOADING_TEXT = '불러오는 중…';
// providers 가 빈 배열일 때 노출할 기본 한국어 문구 (emptyMessage 미전달/빈 문자열 시 fallback).
const DEFAULT_EMPTY_MESSAGE = '등록된 LLM provider 가 없습니다';
// provider 삭제 버튼 라벨 — onDelete 전달 시에만 각 행에 렌더한다(GroupMemberList REMOVE_LABEL 동형).
const DELETE_LABEL = '삭제';
// provider 수정 버튼 라벨(T-1137) — onEdit 전달 시에만 각 행에 렌더한다(DELETE_LABEL 동형).
const EDIT_LABEL = '수정';
// 기본 provider 지정 버튼 라벨(T-1900) — onSetDefault 전달 + 그 행이 아직 기본이 아닐 때만
// 렌더한다(EDIT_LABEL / DELETE_LABEL 상수 규약 동형 — 인라인 문자열 금지). 배지 라벨 '기본' 을
// 부분 문자열로 포함하지만 배지 판정은 data-testid 토큰 기반이라 오탐이 없다.
const SET_DEFAULT_LABEL = '기본으로 지정';
// 기본 provider 배지 라벨(T-1897) — row.isDefault === true 인 행에만 렌더한다(DELETE_LABEL /
// EDIT_LABEL 상수 규약 동형). 배지는 표시 전용이라 클릭 대상이 아니다(지정 행위는 별도 버튼 —
// SET_DEFAULT_LABEL, T-1900).
const DEFAULT_BADGE_LABEL = '기본';
// 기본 배지 조회용 test id — spec 이 라벨 문자열 대신 이 토큰으로 배지 개수를 세도록 고정한다
// ('기본' 두 글자는 다른 문구에도 흔히 섞여 오탐이 나기 쉽다).
const DEFAULT_BADGE_TESTID = 'llm-provider-default-badge';

interface LlmProviderConfigListProps {
  // 표시할 provider 목록 — controlled component 라 상위가 이미 fetch·정렬된 배열을 보유한다.
  providers: LlmProviderConfigRow[];
  // 조회 진행 중 플래그 — true 면 providers 유무와 무관하게 로딩 표시 우선(loading 우선 정책).
  loading?: boolean;
  // 에러 문구(선택) — loading 이 아니고 truthy 면 role="alert" 영역에 렌더, 없으면 미렌더.
  error?: string;
  // 빈 상태 문구(선택). 빈 문자열이면 기본 문구로 fallback(의미 없는 빈 메시지 방지).
  emptyMessage?: string;
  // provider 삭제 콜백(선택) — 주어졌을 때만 각 행에 삭제 버튼을 렌더하고 클릭 시 row.id 로 호출한다.
  // 미전달 시 버튼 미렌더(읽기 전용 하위 호환 — T-1134 마운트를 깨지 않는다). 실 DELETE 요청·
  // 재조회 배선은 상위 컨테이너 책임(GroupMemberList onRemove 와 동형 controlled 계약).
  onDelete?: (id: string) => void;
  // provider 수정 콜백(선택, T-1137) — 주어졌을 때만 각 행에 "수정" 버튼을 렌더하고 클릭 시 row.id
  // 로 호출한다(onDelete 와 동형). 미전달 시 버튼 미렌더(읽기 전용 하위 호환 — T-1134 마운트 보존).
  // 실 PATCH 요청·인라인 수정 폼·재조회 배선은 상위 컨테이너 책임(controlled 계약 — 목록은
  // 콜백만 호출하고 수정 폼을 모른다). apiKey 는 여전히 목록 어디에도 미노출.
  onEdit?: (id: string) => void;
  // 기본 provider 지정 콜백(선택, T-1900) — 주어졌을 때만, 그리고 그 행이 아직 기본이 아닐 때만
  // "기본으로 지정" 버튼을 렌더하고 클릭 시 row.id 로 호출한다(onEdit 와 동형). 미전달 시 버튼
  // 미렌더(읽기 전용 하위 호환 — T-1134 마운트 보존). 실 PUT 요청(/api/llm/providers/default)·
  // 재조회·낙관적 UI 배선은 상위 컨테이너 책임(controlled 계약 — 목록은 콜백만 호출하고 요청을
  // 모른다). 소비처 시그니처는 useAdminLlmProviders 의 handleSetDefaultProvider(T-1899) 와 정합.
  onSetDefault?: (id: string) => void;
}

// LLM provider 설정 목록. 실 fetch·생성/수정/삭제 로직은 수행하지 않고 props 의 providers 를
// 그대로 표시하며 onDelete 콜백만 호출하는 presentational 책임만 진다 — 실제 삭제 요청·전역
// 상태는 상위 컨테이너가 수행한다.
function LlmProviderConfigList({
  providers,
  loading,
  error,
  emptyMessage,
  onDelete,
  onEdit,
  onSetDefault,
}: LlmProviderConfigListProps) {
  // loading 우선 정책 — 진행 중이면 error·providers 유무와 무관하게 로딩 표시만 렌더한다.
  if (loading === true) {
    return <div role="status">{LOADING_TEXT}</div>;
  }

  // 에러 분기 — loading 이 아니고 error 가 truthy 면 목록 대신 alert 영역만 렌더한다.
  // (빈 문자열 error 는 falsy 라 본 분기로 진입하지 않는다 — 경계값.)
  if (error) {
    return <div role="alert">{error}</div>;
  }

  // 빈 데이터 분기 — 의미 없는 빈 목록 대신 빈 상태 메시지를 렌더한다.
  // 빈 문자열 emptyMessage 는 기본 문구로 fallback 한다(빈 메시지 방지 정책).
  if (providers.length === 0) {
    const text = emptyMessage ? emptyMessage : DEFAULT_EMPTY_MESSAGE;
    return <div role="status">{text}</div>;
  }

  return (
    <ul>
      {providers.map((row) => (
        <li key={row.id}>
          {/* provider 는 항상 표시한다(주 라벨). */}
          <span>{row.provider}</span>
          {/* isDefault === true 인 행에만 "기본" 배지를 주 라벨 옆에 렌더한다(T-1897). 엄격
              boolean 비교라 false/undefined/비-boolean 은 배지 없음. backend 불변식(true 인 row
              는 0 또는 1 개) 위반 응답이 와도 web 은 교정하지 않고 각 해당 행에 그대로 렌더한다 —
              화면이 응답을 있는 그대로 비추게 두는 편이 이상을 숨기는 것보다 낫다. */}
          {row.isDefault === true ? (
            <span data-testid={DEFAULT_BADGE_TESTID}>{DEFAULT_BADGE_LABEL}</span>
          ) : null}
          {/* modelId 는 있을 때만 함께 표시한다(없으면 throw 없이 생략). */}
          {row.modelId ? <span>{row.modelId}</span> : null}
          {/* endpointUrl 은 있을 때만 함께 표시한다(없으면 throw 없이 생략). */}
          {row.endpointUrl ? <span>{row.endpointUrl}</span> : null}
          {/* onEdit 가 주어졌을 때만 수정 버튼을 렌더하고 클릭 시 row.id 로 콜백 호출(T-1137). */}
          {onEdit ? (
            <button type="button" onClick={() => onEdit(row.id)}>
              {EDIT_LABEL}
            </button>
          ) : null}
          {/* onDelete 가 주어졌을 때만 삭제 버튼을 렌더하고 클릭 시 row.id 로 콜백 호출. */}
          {onDelete ? (
            <button type="button" onClick={() => onDelete(row.id)}>
              {DELETE_LABEL}
            </button>
          ) : null}
          {/* onSetDefault 가 주어졌고 그 행이 아직 기본이 아닐 때만 "기본으로 지정" 버튼을
              렌더하고 클릭 시 row.id 로 콜백 호출(T-1900). 이미 기본인 행은 배지만 남기고 버튼을
              내려 무의미한 재지정을 차단한다. 렌더 순서를 기존 수정→삭제 **뒤**(마지막)로 둔 것은
              기존 두 버튼의 상대 순서와 그 순서를 단언하는 기존 spec 기대값을 한 줄도 바꾸지
              않기 위함이다. isDefault 비교는 배지와 같은 엄격 boolean(!== true)이라 비-boolean
              값은 비-default 로 취급된다. */}
          {onSetDefault && row.isDefault !== true ? (
            <button type="button" onClick={() => onSetDefault(row.id)}>
              {SET_DEFAULT_LABEL}
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export type { LlmProviderConfigRow, LlmProviderConfigListProps };
export default LlmProviderConfigList;
