// ADR-0058 §Follow-ups (d) 편집 UI 의 쓰기 축 3/3 — identity 행 1 개의 편집 · 삭제 · primary
// 지정 액션 버튼 축이다. 본 컴포넌트는 `deleteServiceIdentity` · `setPrimaryServiceIdentity`
// 등 client 함수를 호출하지 않는다 — 실제 호출 · 상태 보유 · 목록 재조회 · AdminView 배선은
// 후속 배선 slice 책임이라, 여기서는 어떤 버튼이 언제 사용 가능한지의 판정만 담는다. 직전
// 겹(ServiceIdentityAddForm · ServiceIdentityEditForm) 의 props-only controlled component
// convention(내부 useState · fetch 0, loading 우선 disable, role="alert" 에러 영역, 문구
// 상수 export, named + default export)을 그대로 승계한다.

// row 타입은 재선언하지 않고 client 계약을 그대로 재사용한다 — 같은 형태를 두 곳에 정의하면
// 한쪽만 갱신되는 drift 가 생긴다(ServiceIdentityList 선례 승계).
import type { ServiceIdentityRow } from '../api/serviceIdentity';

// 버튼 라벨 상수 — 각 컴포넌트의 문구는 서로 독립이어야 하므로 다른 컴포넌트에서 import 하지
// 않고 자체 정의한다(Out of Scope 명시).
export const EDIT_TEXT = 'identity 수정';
export const DELETE_TEXT = 'identity 삭제';
export const DELETE_CONFIRM_TEXT = '삭제 확정';
export const DELETE_CANCEL_TEXT = '삭제 취소';
export const SET_PRIMARY_TEXT = 'primary 로 지정';

// `isPrimary === true` 인 행에 붙이는 primary 식별 표식 — ADR-0058 §Decision 2 의 "1 인원 1
// primary" invariant 를 행에서 바로 확인하게 한다(ServiceIdentityList 의 표식과 동형 문구).
export const PRIMARY_BADGE_TEXT = 'primary';

// primary 행을 지울 때만 노출하는 안내 — 마지막 primary 가 사라지면 backend 가 잔여 identity
// 중 하나를 자동 승격하는데(ADR-0058 §Decision 2), 그 대상이 사용자 의도와 다를 수 있어
// (§Consequences (c)) 확인 단계에서 미리 알린다.
export const PRIMARY_DELETE_HINT_TEXT =
  '이 identity 는 primary 입니다 — 지우면 backend 가 남은 identity 중 하나를 자동으로 primary 로 승격합니다.';

// 삭제 확인 문구 — 어떤 행을 지우는지 알 수 있도록 service 와 externalId 를 함께 노출한다.
export function buildDeleteConfirmText(service: string, externalId: string): string {
  return `${service} / ${externalId} 항목을 지웁니다. 이 동작은 되돌릴 수 없습니다.`;
}

interface ServiceIdentityRowActionsProps {
  // 액션 대상 identity 행 — 표시(service · externalId)와 분기(isPrimary) 양쪽에 쓰인다.
  identity: ServiceIdentityRow;
  // 편집 동선 진입 콜백 — 수정 폼 노출은 상위(배선 slice) 책임이다.
  onEdit: () => void;
  // 삭제 요청 콜백 — 즉시 삭제가 아니라 확인 단계로의 전이를 상위에 알린다.
  onDeleteRequest: () => void;
  // 삭제 확정 · 취소 콜백 — 확인 단계에서만 노출되는 버튼에 배선된다.
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  // primary 지정 콜백 — 이미 primary 인 행에서는 버튼이 disabled 라 호출되지 않는다.
  onSetPrimary: () => void;
  // 삭제 확인 단계 플래그 — true 면 삭제 버튼 대신 확인 문구 + 확정 · 취소 버튼을 렌더한다.
  confirmingDelete?: boolean;
  // 요청 진행 중 플래그 — true 면 다른 어떤 분기보다 우선해 모든 버튼을 막는다.
  loading?: boolean;
  // 액션 실패 등 에러 문구 — truthy 면 role="alert" 영역에 렌더, falsy 면 미렌더.
  error?: string;
}

// identity 행의 액션 버튼 묶음. 분기는 (1) loading 우선 disable, (2) confirmingDelete 로
// 삭제 버튼 ↔ 확인 문구 + 확정 · 취소 전환, (3) isPrimary 로 표식 · primary 버튼 게이팅 셋이다.
function ServiceIdentityRowActions({
  identity,
  onEdit,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
  onSetPrimary,
  confirmingDelete,
  loading,
  error,
}: ServiceIdentityRowActionsProps) {
  // loading 우선 정책 — 진행 중이면 확인 단계 여부 · primary 여부와 무관하게 전부 막는다.
  const busy = loading === true;
  // 이미 primary 인 행의 재지정은 idempotent 지만 결과가 바뀌지 않는 요청이라 UI 에서 미리
  // 차단한다(ADR-0058 §Decision 1).
  const setPrimaryDisabled = busy || identity.isPrimary === true;
  // 확인 단계에서는 삭제 버튼을 다시 렌더하지 않아 2 중 삭제 경로를 막는다.
  const confirming = confirmingDelete === true;

  return (
    <div>
      {/* 에러가 있을 때만 alert 영역을 렌더 — 빈 에러가 자리를 차지하지 않게 한다. */}
      {error ? <div role="alert">{error}</div> : null}

      {/* 어떤 행의 액션인지 식별할 수 있도록 service · externalId 를 항상 표시한다. */}
      <span>{identity.service}</span>
      <span>{identity.externalId}</span>
      {/* primary 표식은 해당 행에만 — 버튼 라벨에도 'primary' 가 들어가므로 표식은 별도 span 이다. */}
      {identity.isPrimary === true ? (
        <span className="primary-badge">{PRIMARY_BADGE_TEXT}</span>
      ) : null}

      <button type="button" name="edit" onClick={onEdit} disabled={busy}>
        {EDIT_TEXT}
      </button>

      {confirming ? (
        <div role="group">
          <p>{buildDeleteConfirmText(identity.service, identity.externalId)}</p>
          {/* 자동 승격 안내는 primary 행을 지울 때만 의미가 있다. */}
          {identity.isPrimary === true ? <p>{PRIMARY_DELETE_HINT_TEXT}</p> : null}
          <button type="button" name="delete-confirm" onClick={onDeleteConfirm} disabled={busy}>
            {DELETE_CONFIRM_TEXT}
          </button>
          <button type="button" name="delete-cancel" onClick={onDeleteCancel} disabled={busy}>
            {DELETE_CANCEL_TEXT}
          </button>
        </div>
      ) : (
        <button type="button" name="delete" onClick={onDeleteRequest} disabled={busy}>
          {DELETE_TEXT}
        </button>
      )}

      <button type="button" name="set-primary" onClick={onSetPrimary} disabled={setPrimaryDisabled}>
        {SET_PRIMARY_TEXT}
      </button>
    </div>
  );
}

export type { ServiceIdentityRowActionsProps };
export default ServiceIdentityRowActions;
