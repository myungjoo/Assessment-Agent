// ADR-0059 §Follow-ups (e) 편집 축의 첫 조각 — 수집 대상(CollectionTarget) 등록(POST) 입력 폼.
// 직전 T-1825 가 읽기 축(CollectionTargetList + AdminView 마운트)만 열어 화면에는 "등록된
// 수집 대상이 없습니다" 를 볼 수단만 있고 새로 등록할 수단이 0 이었다 — requirements.md
// `89 행` REQ-070 이 요구한 "빈 상태에서 막히지 않는다" 가 실제로는 미충족이었던 지점이다.
//
// 경계 — ServiceIdentityAddForm 선례를 그대로 승계한 controlled presentational component 다:
// fetch 호출 · 상태 보유 · useApiResource 배선은 일체 없고 값 · 변경 콜백 · onSubmit ·
// loading · error 를 props 로만 받는다(ADR-0041 §Decision 1 — 컴포넌트는 fetch 를 모른다).
//
// 입력 축이 `type` · `instanceKey` · `endpoint` 3 개뿐인 이유 — backend
// CreateCollectionTargetDto 의 나머지 4 필드(`orgs` · `repos` · `spaces` · `active`)는 전부
// `@IsOptional` 이라 미전달 시 DB default 로 위임되고, 배열 입력 UI(구분자 파싱 · 중복 제거)는
// 본 slice 의 cap 을 넘긴다(Out of Scope). `id` · `createdAt` · `updatedAt` · token 계열은
// 애초에 DTO 허용 축이 아니라 실으면 forbidNonWhitelisted 가 400 을 낸다(ADR-0059 §Decision 2
// credential 경계) — 본 폼에는 그 입력 자체가 없다.

// 안내 문구 · submit 게이팅이 인용하는 backend 규칙. 정본은
// src/assessment-collection/dto/create-collection-target.dto.ts 의 decorator(@IsIn +
// @IsNotEmpty + @MaxLength)이며, web 은 별도 package 라 import 대신 값만 동기한다
// (규칙 변경 시 backend DTO 와 본 상수를 함께 갱신해야 한다).
export const COLLECTION_TARGET_TYPES = ['GITHUB', 'CONFLUENCE'] as const;
export const INSTANCE_KEY_MAX_LENGTH = 255;
export const ENDPOINT_MAX_LENGTH = 255;

// 조건 안내 문구의 고정 id — 대응 입력의 aria-describedby 가 이 값을 가리켜 스크린리더에서도
// 입력 전에 조건이 함께 읽힌다(ServiceIdentityAddForm 동형 convention).
export const TYPE_HINT_ID = 'collection-target-add-type-hint';
export const INSTANCE_KEY_HINT_ID = 'collection-target-add-instance-key-hint';
export const ENDPOINT_HINT_ID = 'collection-target-add-endpoint-hint';

// 안내 문구 본문 — 위 DTO 의 실제 규칙만 인용한다(없는 조건을 지어내면 사용자를 오도한다).
// endpoint 는 backend 가 URL 정규식을 두지 않고 길이 상한만 걸므로 형식 강제를 말하지 않고
// 두 type 의 표기 관례만 안내한다(ADR-0059 §Decision 4 endpoint 행).
export const TYPE_HINT_TEXT = `대상 종류는 ${COLLECTION_TARGET_TYPES.join(' 또는 ')} 중 하나입니다.`;
export const INSTANCE_KEY_HINT_TEXT = `instance key 는 비워둘 수 없으며 최대 ${INSTANCE_KEY_MAX_LENGTH}자입니다. 같은 종류 안에서 유일해야 합니다.`;
export const ENDPOINT_HINT_TEXT = `endpoint 는 비워둘 수 없으며 최대 ${ENDPOINT_MAX_LENGTH}자입니다. GITHUB 은 host, CONFLUENCE 는 REST base URL 을 적습니다.`;

// 버튼 라벨 — 진행 중에는 loading 문구로 바뀐다(말줄임표는 U+2026, "..." 3 점 아님).
export const SUBMIT_TEXT = '수집 대상 등록';
export const SUBMIT_LOADING_TEXT = '등록 중…';

// submit 게이팅 판정에 필요한 최소 입력(순수 함수 인자) — 컴포넌트 props 의 부분 집합이라
// 컴포넌트 없이도 분기를 단위 검증할 수 있다.
interface CollectionTargetSubmitGate {
  type: string;
  instanceKey: string;
  endpoint: string;
  loading?: boolean;
}

// submit 차단 여부(순수 함수) — 화면에서 먼저 차단해 backend 400 이 확정된 요청을 네트워크
// 전에 막는다. 판정 순서가 아니라 논리합이라 어느 축이 깨져도 결과는 같고, `loading` 은
// 입력이 모두 유효해도 우선 차단한다(loading 우선 정책 — 이중 POST 방지).
// 길이는 trim 전 원문 기준(backend @MaxLength 도 원문 길이를 본다).
export function isCollectionTargetSubmitDisabled({
  type,
  instanceKey,
  endpoint,
  loading,
}: CollectionTargetSubmitGate): boolean {
  // loading 우선 — 진행 중이면 나머지 판정과 무관하게 막는다.
  if (loading === true) {
    return true;
  }
  // 입력 미완 — 공백만 입력한 경우도 빈 입력으로 본다(trim 후 빈 문자열이면 미완).
  if (instanceKey.trim() === '' || endpoint.trim() === '') {
    return true;
  }
  // type 은 <select> 2 option 이지만 상위가 임의 문자열을 내려보낼 수 있으므로 값도 검증한다
  // (@IsIn 위반이 그대로 400 이 되는 것을 화면에서 먼저 차단 — 대소문자도 구분).
  if (!(COLLECTION_TARGET_TYPES as readonly string[]).includes(type)) {
    return true;
  }
  // 길이 상한 위반 — @MaxLength(255) 두 축.
  return (
    instanceKey.length > INSTANCE_KEY_MAX_LENGTH ||
    endpoint.length > ENDPOINT_MAX_LENGTH
  );
}

// form submit 이벤트 핸들러 팩토리(순수 함수) — 브라우저 기본 제출(페이지 reload)을 무조건
// 막고, 차단 상태가 아닐 때만 onSubmit 을 호출한다. disabled 버튼을 우회해 submit 이벤트가
// 직접 발생하는 경로(Enter 키 · 스크립트 requestSubmit)에서도 미발사를 보장하는 이중 방어다.
// 컴포넌트 밖으로 뽑은 이유는 본 repo 의 web spec 이 jsdom 없이 renderToStaticMarkup 만
// 쓰기 때문이다 — 이벤트를 발화할 수 없으므로 핸들러 자체를 순수 함수로 직접 검증한다.
export function createCollectionTargetSubmitHandler(options: {
  submitDisabled: boolean;
  onSubmit: () => void;
}): (event: { preventDefault: () => void }) => void {
  return (event) => {
    event.preventDefault();
    if (!options.submitDisabled) {
      options.onSubmit();
    }
  };
}

interface CollectionTargetAddFormProps {
  // 대상 종류 입력값(GITHUB / CONFLUENCE) — controlled component 라 상위가 상태를 보유한다.
  type: string;
  // instance key 입력값 — controlled component 라 상위가 상태를 보유한다.
  instanceKey: string;
  // endpoint 입력값 — controlled component 라 상위가 상태를 보유한다.
  endpoint: string;
  // type 변경 콜백 — <select> 변경마다 새 값을 상위로 전달한다.
  onTypeChange: (value: string) => void;
  // instanceKey 변경 콜백 — 입력 이벤트마다 새 값을 상위로 전달한다.
  onInstanceKeyChange: (value: string) => void;
  // endpoint 변경 콜백 — 입력 이벤트마다 새 값을 상위로 전달한다.
  onEndpointChange: (value: string) => void;
  // 제출 콜백 — submit 이 차단되지 않았을 때만 호출된다(폼 default 동작은 항상 막는다).
  onSubmit: () => void;
  // 등록 요청 진행 중 플래그 — true 면 입력 충족 여부와 무관하게 submit 을 막는다.
  loading?: boolean;
  // 등록 실패 등 에러 문구 — truthy 면 role="alert" 영역에 렌더, falsy 면 미렌더.
  error?: string;
}

// 수집 대상 등록 폼. 입력 미완(빈/공백뿐) · 허용 밖 type · 길이 초과 · loading 중에는 submit
// 을 막아 backend 400 이 확정된 요청을 미리 차단한다(입력검증 분기). 에러는 role="alert" 로
// 외화하고, 조건 안내는 입력 전에도 항상 렌더되며 aria-describedby 로 각 입력에 연결된다.
function CollectionTargetAddForm({
  type,
  instanceKey,
  endpoint,
  onTypeChange,
  onInstanceKeyChange,
  onEndpointChange,
  onSubmit,
  loading,
  error,
}: CollectionTargetAddFormProps) {
  const submitDisabled = isCollectionTargetSubmitDisabled({
    type,
    instanceKey,
    endpoint,
    loading,
  });
  const handleSubmit = createCollectionTargetSubmitHandler({
    submitDisabled,
    onSubmit,
  });

  return (
    <form onSubmit={handleSubmit}>
      {/* 등록 동선임을 알리는 제목 — 표시 축(CollectionTargetList) 과 구분된다. */}
      <h3>수집 대상 등록</h3>

      {/* 에러가 있을 때만 alert 영역을 렌더 — 빈 에러가 자리를 차지하지 않게 한다. */}
      {error ? <div role="alert">{error}</div> : null}

      {/* 안내는 label 바깥에 둔다 — label 안에 넣으면 문구가 입력의 접근 가능 이름에 섞인다. */}
      <label>
        대상 종류
        <select
          name="type"
          value={type}
          onChange={(event) => onTypeChange(event.target.value)}
          aria-describedby={TYPE_HINT_ID}
        >
          {/* option 은 허용 literal 상수에서만 파생한다(문구 하드코딩 0 — DTO @IsIn 과 동기). */}
          {COLLECTION_TARGET_TYPES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      {/* 입력 전에도 항상 보이는 type 조건 — 분기 없이 무조건 렌더한다. */}
      <p id={TYPE_HINT_ID}>{TYPE_HINT_TEXT}</p>

      <label>
        instance key
        <input
          type="text"
          name="instanceKey"
          value={instanceKey}
          onChange={(event) => onInstanceKeyChange(event.target.value)}
          aria-describedby={INSTANCE_KEY_HINT_ID}
        />
      </label>
      {/* 길이 상한은 위 상수에서만 온다(문구 하드코딩 0). */}
      <p id={INSTANCE_KEY_HINT_ID}>{INSTANCE_KEY_HINT_TEXT}</p>

      <label>
        endpoint
        <input
          type="text"
          name="endpoint"
          value={endpoint}
          onChange={(event) => onEndpointChange(event.target.value)}
          aria-describedby={ENDPOINT_HINT_ID}
        />
      </label>
      {/* 실패 후에도 사라지지 않는 endpoint 조건 — 분기 없이 무조건 렌더한다. */}
      <p id={ENDPOINT_HINT_ID}>{ENDPOINT_HINT_TEXT}</p>

      <button type="submit" disabled={submitDisabled}>
        {loading === true ? SUBMIT_LOADING_TEXT : SUBMIT_TEXT}
      </button>
    </form>
  );
}

export type { CollectionTargetAddFormProps, CollectionTargetSubmitGate };
export { CollectionTargetAddForm };
export default CollectionTargetAddForm;
