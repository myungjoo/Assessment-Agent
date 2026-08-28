// ADR-0058 §Follow-ups (d) 편집 UI 의 쓰기 축 1/2 — service identity 추가(POST) 입력 폼.
// `isPrimary` 입력 축을 의도적으로 두지 않는다: ADR-0058 §Decision 2 가 primary 전이를
// 전용 route (POST /identities/:identityId/primary) 하나로 단일화했고, backend DTO 는
// forbidNonWhitelisted 라 body 에 isPrimary 를 실으면 그 자체로 400 이 된다.
// 본 컴포넌트는 입력값·콜백·error/loading 플래그를 props 로만 받는 순수 presentational
// controlled component 다 — createServiceIdentity 호출·상태 보유·목록 갱신·AdminView
// 배선은 후속 slice 책임(Out of Scope). 직전 slice(SuperAdminSetupForm, ServiceIdentityList)
// 와 동일한 props/분기/named·default export convention 을 차용한다.

// 안내 문구·submit 게이팅이 인용하는 backend 규칙. 정본은 src/user/dto/create-service-identity.dto.ts
// 의 decorator (@IsNotEmpty + @MaxLength + @Matches) 이며, web 은 별도 package 라 import
// 대신 값만 동기한다(규칙 변경 시 backend DTO 와 본 상수를 함께 갱신해야 한다).
export const SERVICE_MAX_LENGTH = 64;
export const EXTERNAL_ID_MAX_LENGTH = 255;
export const SERVICE_PATTERN = /^[A-Za-z0-9._-]+$/;

// 조건 안내 문구의 고정 id — 대응 입력의 aria-describedby 가 이 값을 가리켜
// 스크린리더에서도 입력 전에 조건이 함께 읽힌다.
export const SERVICE_HINT_ID = 'service-identity-add-service-hint';
export const EXTERNAL_ID_HINT_ID = 'service-identity-add-external-id-hint';

// 안내 문구 본문 — 위 DTO 의 실제 규칙만 인용한다(없는 조건을 지어내면 사용자를 오도한다).
// service 후보 목록(활성 instance key) 제시는 ADR-0058 §Consequences (b) 로 배선 slice 승계라
// 여기서는 형식·길이만 안내한다.
export const SERVICE_HINT_TEXT = `서비스 키는 영문·숫자와 . _ - 만 쓸 수 있고 (공백 불가) 최대 ${SERVICE_MAX_LENGTH}자입니다.`;
export const EXTERNAL_ID_HINT_TEXT = `외부 식별자는 비워둘 수 없으며 최대 ${EXTERNAL_ID_MAX_LENGTH}자입니다. 형식 제한은 없습니다.`;

interface ServiceIdentityAddFormProps {
  // 수집 매칭 키 입력값 — controlled component 라 상위가 상태를 보유한다.
  service: string;
  // 해당 서비스에서의 계정 식별자 입력값 — controlled component 라 상위가 상태를 보유한다.
  externalId: string;
  // service 변경 콜백 — 입력 이벤트마다 새 값을 상위로 전달한다.
  onServiceChange: (value: string) => void;
  // externalId 변경 콜백 — 입력 이벤트마다 새 값을 상위로 전달한다.
  onExternalIdChange: (value: string) => void;
  // 제출 콜백 — submit 버튼이 enabled 일 때만 호출된다(폼 default 동작은 막는다).
  onSubmit: () => void;
  // 추가 요청 진행 중 플래그 — true 면 입력 충족 여부와 무관하게 submit 을 막는다(loading 우선 정책).
  loading?: boolean;
  // 추가 실패 등 에러 문구 — truthy 면 role="alert" 영역에 렌더, falsy 면 미렌더.
  error?: string;
}

// service identity 추가 폼. 입력 미완(빈/공백뿐) · 형식 위반 · 길이 초과 · loading 중에는
// submit 을 막아 backend 400 이 확정된 요청을 미리 차단한다(입력검증 분기).
// 에러는 role="alert" 로 외화하고, 조건 안내는 입력 전에도 항상 렌더되며 aria-describedby 로 연결된다.
function ServiceIdentityAddForm({
  service,
  externalId,
  onServiceChange,
  onExternalIdChange,
  onSubmit,
  loading,
  error,
}: ServiceIdentityAddFormProps) {
  // 입력 미완 판정 — 공백만 입력한 경우도 빈 입력으로 본다(trim 후 빈 문자열이면 미완).
  const inputIncomplete = service.trim() === '' || externalId.trim() === '';
  // 형식·길이 위반 판정 — backend DTO 의 @Matches/@MaxLength 와 같은 규칙을 그대로 적용한다.
  // 길이는 trim 전 원문 기준(backend 도 원문 길이를 본다).
  const serviceInvalid = !SERVICE_PATTERN.test(service) || service.length > SERVICE_MAX_LENGTH;
  const externalIdInvalid = externalId.length > EXTERNAL_ID_MAX_LENGTH;
  // loading 우선 정책 — 진행 중이면 입력이 모두 유효해도 submit 을 막는다.
  const submitDisabled = loading === true || inputIncomplete || serviceInvalid || externalIdInvalid;

  // 폼 default 제출(페이지 reload)을 막고, 막혀있지 않을 때만 콜백을 호출한다.
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!submitDisabled) {
      onSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* 추가 동선임을 알리는 제목 — 표시 축(ServiceIdentityList) 과 구분된다. */}
      <h3>service identity 추가</h3>

      {/* 에러가 있을 때만 alert 영역을 렌더 — 빈 에러가 자리를 차지하지 않게 한다. */}
      {error ? <div role="alert">{error}</div> : null}

      {/* 안내는 label 바깥에 둔다 — label 안에 넣으면 문구가 입력의 접근 가능 이름에 섞인다. */}
      <label>
        서비스
        <input
          type="text"
          name="service"
          value={service}
          onChange={(event) => onServiceChange(event.target.value)}
          aria-describedby={SERVICE_HINT_ID}
        />
      </label>
      {/* 입력 전에도 항상 보이는 service 조건 — 분기 없이 무조건 렌더한다(실패 후에도 사라지지 않는다). */}
      <p id={SERVICE_HINT_ID}>{SERVICE_HINT_TEXT}</p>

      <label>
        외부 식별자
        <input
          type="text"
          name="externalId"
          value={externalId}
          onChange={(event) => onExternalIdChange(event.target.value)}
          aria-describedby={EXTERNAL_ID_HINT_ID}
        />
      </label>
      {/* 입력 전에도 항상 보이는 externalId 조건 — 길이 상한은 위 상수에서만 온다(문구 하드코딩 0). */}
      <p id={EXTERNAL_ID_HINT_ID}>{EXTERNAL_ID_HINT_TEXT}</p>

      <button type="submit" disabled={submitDisabled}>
        {loading === true ? '추가 중…' : 'identity 추가'}
      </button>
    </form>
  );
}

export type { ServiceIdentityAddFormProps };
export default ServiceIdentityAddForm;
