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
}

// loading 중 노출할 기본 한국어 문구.
const LOADING_TEXT = '불러오는 중…';
// providers 가 빈 배열일 때 노출할 기본 한국어 문구 (emptyMessage 미전달/빈 문자열 시 fallback).
const DEFAULT_EMPTY_MESSAGE = '등록된 LLM provider 가 없습니다';

interface LlmProviderConfigListProps {
  // 표시할 provider 목록 — controlled component 라 상위가 이미 fetch·정렬된 배열을 보유한다.
  providers: LlmProviderConfigRow[];
  // 조회 진행 중 플래그 — true 면 providers 유무와 무관하게 로딩 표시 우선(loading 우선 정책).
  loading?: boolean;
  // 에러 문구(선택) — loading 이 아니고 truthy 면 role="alert" 영역에 렌더, 없으면 미렌더.
  error?: string;
  // 빈 상태 문구(선택). 빈 문자열이면 기본 문구로 fallback(의미 없는 빈 메시지 방지).
  emptyMessage?: string;
}

// LLM provider 설정 목록. 실 fetch·생성/수정/삭제 로직은 수행하지 않고 props 의 providers 를
// 그대로 표시하는 presentational 책임만 진다 — 실제 요청·전역 상태는 상위 컨테이너가 수행한다.
function LlmProviderConfigList({
  providers,
  loading,
  error,
  emptyMessage,
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
          {/* modelId 는 있을 때만 함께 표시한다(없으면 throw 없이 생략). */}
          {row.modelId ? <span>{row.modelId}</span> : null}
          {/* endpointUrl 은 있을 때만 함께 표시한다(없으면 throw 없이 생략). */}
          {row.endpointUrl ? <span>{row.endpointUrl}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export type { LlmProviderConfigRow, LlmProviderConfigListProps };
export default LlmProviderConfigList;
