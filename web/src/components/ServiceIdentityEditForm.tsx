// ADR-0058 §Follow-ups (d) 편집 UI 의 쓰기 축 2/3 — service identity 수정(PATCH) 입력 폼.
// 입력 축을 `externalId` 하나로 좁힌 근거:
//   - `service` — @@unique([personId, service]) 의 구성 요소이자 수집 매칭 키라 갱신하면
//     identity 의 정체성이 바뀐다. ADR-0058 §Decision 3 대로 DELETE 후 POST 로 표현하므로
//     여기서는 편집 가능한 input 이 아니라 읽기 전용 텍스트로만 보여준다.
//   - `isPrimary` — ADR-0058 §Decision 2 가 primary 전이를 전용 route 하나로 단일화했다.
//     backend UpdateServiceIdentityDto 에는 필드가 없고 forbidNonWhitelisted 라 body 에
//     실으면 그대로 400 이다. 그래서 본 폼에 입력 축을 두지 않는다.
// 본 컴포넌트는 입력값·콜백·error/loading 플래그를 props 로만 받는 순수 presentational
// controlled component 다 — updateServiceIdentity 호출·상태 보유·목록 갱신·AdminView
// 배선은 후속 slice 책임(Out of Scope). 직전 겹(ServiceIdentityAddForm) 과 동일한
// props/분기/named·default export convention 을 차용한다.

// 안내 문구·submit 게이팅이 인용하는 backend 규칙. 정본은 src/user/dto/update-service-identity.dto.ts
// 의 decorator (@IsString + @IsNotEmpty + @MaxLength(255)) 이며, web 은 별도 package 라
// import 대신 값만 동기한다(규칙 변경 시 backend DTO 와 본 상수를 함께 갱신해야 한다).
export const EXTERNAL_ID_MAX_LENGTH = 255;

// 조건 안내 문구의 고정 id — 대응 입력의 aria-describedby 가 이 값을 가리켜 스크린리더에서도
// 입력 전에 조건이 함께 읽힌다. 추가 폼과 한 화면에 공존해도 충돌하지 않도록 `-edit-` 로 구분한다.
export const EXTERNAL_ID_HINT_ID = 'service-identity-edit-external-id-hint';
export const SERVICE_LOCKED_HINT_ID = 'service-identity-edit-service-locked-hint';

// 안내 문구 본문 — 위 DTO 의 실제 규칙만 인용한다(없는 조건을 지어내면 사용자를 오도한다).
export const EXTERNAL_ID_HINT_TEXT = `외부 식별자는 비워둘 수 없으며 최대 ${EXTERNAL_ID_MAX_LENGTH}자입니다. 형식 제한은 없습니다.`;
// service 가 편집 불가인 이유를 사용자 언어로 노출한다(ADR-0058 §Decision 3).
export const SERVICE_LOCKED_HINT_TEXT =
  '서비스 키는 수정할 수 없습니다 — service 변경은 이 identity 를 삭제한 뒤 다시 추가해 표현합니다.';

interface ServiceIdentityEditFormProps {
  // 수정 대상 identity 의 서비스 키 — 읽기 전용 표시 축이라 변경 콜백이 없다.
  service: string;
  // 수정 전 원래 externalId — "변경 0" 판정 기준이라 입력값과 별도로 받는다.
  initialExternalId: string;
  // externalId 입력값 — controlled component 라 상위가 상태를 보유한다.
  externalId: string;
  // externalId 변경 콜백 — 입력 이벤트마다 새 값을 상위로 전달한다.
  onExternalIdChange: (value: string) => void;
  // 제출 콜백 — submit 버튼이 enabled 일 때만 호출된다(폼 default 동작은 막는다).
  onSubmit: () => void;
  // 취소 콜백 — 수정 동선에서 빠져나갈 때 상위가 편집 상태를 접는다.
  onCancel: () => void;
  // 수정 요청 진행 중 플래그 — true 면 입력 충족 여부와 무관하게 submit 을 막는다(loading 우선 정책).
  loading?: boolean;
  // 수정 실패 등 에러 문구 — truthy 면 role="alert" 영역에 렌더, falsy 면 미렌더.
  error?: string;
}

// service identity 수정 폼. 입력 미완(빈/공백뿐) · 길이 초과 · 변경 0 · loading 중에는
// submit 을 막아 backend 400 이 확정되거나 무의미한 PATCH 요청을 미리 차단한다(입력검증 분기).
// 에러는 role="alert" 로 외화하고, 조건 안내는 입력 전에도 항상 렌더되며 aria-describedby 로 연결된다.
function ServiceIdentityEditForm({
  service,
  initialExternalId,
  externalId,
  onExternalIdChange,
  onSubmit,
  onCancel,
  loading,
  error,
}: ServiceIdentityEditFormProps) {
  // 입력 미완 판정 — 공백만 입력한 경우도 빈 입력으로 본다(trim 후 빈 문자열이면 미완).
  const inputIncomplete = externalId.trim() === '';
  // 길이 위반 판정 — backend DTO 의 @MaxLength 와 같은 규칙을 trim 전 원문 기준으로 적용한다.
  const externalIdInvalid = externalId.length > EXTERNAL_ID_MAX_LENGTH;
  // 변경 0 판정 — 원문 그대로 비교한다. PATCH 는 전달된 값을 그대로 저장하므로 trim 비교를 하면
  // 판정과 실제 저장값이 어긋난다(앞뒤 공백만 다른 값도 "변경" 이다).
  const unchanged = externalId === initialExternalId;
  // loading 우선 정책 — 진행 중이면 입력이 모두 유효해도 submit 을 막는다.
  const submitDisabled = loading === true || inputIncomplete || externalIdInvalid || unchanged;
  // 취소는 submit 게이팅과 독립 — 진행 중일 때만 막고, 입력이 무효해도 언제든 빠져나갈 수 있다.
  const cancelDisabled = loading === true;
  // 폼 default 제출(페이지 reload)을 막고, 막혀있지 않을 때만 콜백을 호출한다.
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!submitDisabled) {
      onSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* 수정 동선임을 알리는 제목 — 추가 축(ServiceIdentityAddForm) 과 구분된다. */}
      <h3>service identity 수정</h3>

      {/* 에러가 있을 때만 alert 영역을 렌더 — 빈 에러가 자리를 차지하지 않게 한다. */}
      {error ? <div role="alert">{error}</div> : null}

      {/* service 는 편집 불가 축이라 input 이 아니라 텍스트로만 렌더한다(ADR-0058 §Decision 3). */}
      <p>
        서비스 <strong>{service}</strong>
      </p>
      <p id={SERVICE_LOCKED_HINT_ID}>{SERVICE_LOCKED_HINT_TEXT}</p>

      {/* 안내는 label 바깥에 둔다 — label 안에 넣으면 문구가 입력의 접근 가능 이름에 섞인다. */}
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
        {loading === true ? '수정 중…' : 'identity 수정'}
      </button>
      <button type="button" onClick={onCancel} disabled={cancelDisabled}>
        취소
      </button>
    </form>
  );
}

export type { ServiceIdentityEditFormProps };
export default ServiceIdentityEditForm;
