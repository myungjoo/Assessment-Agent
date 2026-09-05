// 수집 대상 관리 패널 전체(T-1907 슬라이스 1/2 + T-1908 슬라이스 2/2 — PLAN 184 행 경로 2).
// AdminView 안에 있던 <section> · <h2> · <CollectionTargetList> · 오류 alert 3 종 · 등록 폼을
// 마크업 그대로 옮겨 온 controlled presentational component 다: 조회 · 훅 호출 · 상태 · 새 분기
// 0 이고 props 만 받는다(ADR-0041 §Decision 1 — 컴포넌트는 fetch 를 모른다). isAdmin gating
// 삼항은 호출부에 남겨 두고 여기서는 받은 콜백을 그대로 내려보내기만 한다(콜백이 undefined 면
// 목록이 그 컨트롤을, 등록 폼은 폼 자체를 렌더하지 않는다 — 403 확정 컨트롤 미노출 계약 무변경).
// 슬라이스 1/2 가 임시로 열어 둔 children 슬롯은 소비처 0 이 되어 함께 제거했다.
import CollectionTargetList, {
  type CollectionTargetRow,
  type CollectionTargetScopeField,
} from '../components/CollectionTargetList';
import CollectionTargetAddForm from '../components/CollectionTargetAddForm';
import {
  ADMIN_SECTION_COLLECTION_TARGETS_ID,
  COLLECTION_TARGET_HEADING,
  EMPTY_COLLECTION_TARGET_TEXT,
} from './adminViewConstants';

interface AdminCollectionTargetsSectionProps {
  // 목록 축 14 props — 이름 · optional 여부를 CollectionTargetListProps 와 1:1 로 맞춘다
  // (변환 · 기본값 부여 0 — 받은 값을 그대로 통과시켜야 이동 전후 렌더가 같다).
  targets: CollectionTargetRow[];
  loading?: boolean;
  error?: string;
  onDelete?: (id: string) => void;
  onToggleActive?: (id: string, nextActive: boolean) => void;
  onEditStart?: (id: string, currentEndpoint: string) => void;
  editingId?: string;
  editEndpoint?: string;
  onEditEndpointChange?: (next: string) => void;
  onEditSubmit?: (id: string) => void;
  onEditCancel?: () => void;
  editBusy?: boolean;
  editScopes?: { orgs?: string; repos?: string; spaces?: string };
  onEditScopeChange?: (field: CollectionTargetScopeField, next: string) => void;
  // 오류 alert 3 축(T-1828 · T-1829 · T-1831) — 삭제 · 토글 · 편집 저장은 서로 다른 동작이라
  // 같은 자리를 공유하지 않고 각자 독립 alert 로 렌더한다. falsy 면 미렌더다.
  deleteError?: string;
  toggleError?: string;
  updateError?: string;
  // 등록 폼 축 — 값 · 변경 콜백은 CollectionTargetAddFormProps 와 1:1 이고 그대로 통과시킨다.
  createType: string;
  createInstanceKey: string;
  createEndpoint: string;
  onCreateTypeChange: (value: string) => void;
  onCreateInstanceKeyChange: (value: string) => void;
  onCreateEndpointChange: (value: string) => void;
  // 등록 제출 콜백 — 미전달이면 폼 자체를 렌더하지 않는다(호출부의 isAdmin 삼항이 gating 정본).
  onCreateSubmit?: () => void;
  createLoading?: boolean;
  createError?: string;
}

// 섹션 껍데기 + 목록 + 오류 alert 3 종 + 등록 폼. 분기는 값 truthy 여부 4 개(alert 3 · 폼 1)
// 뿐이라 어떤 props 조합에서도 throw 하지 않는다(빈 목록 · 오류 · 로딩 분기는 전부
// CollectionTargetList 안 종전 로직 그대로다).
function AdminCollectionTargetsSection({
  targets,
  loading,
  error,
  onDelete,
  onToggleActive,
  onEditStart,
  editingId,
  editEndpoint,
  onEditEndpointChange,
  onEditSubmit,
  onEditCancel,
  editBusy,
  editScopes,
  onEditScopeChange,
  deleteError,
  toggleError,
  updateError,
  createType,
  createInstanceKey,
  createEndpoint,
  onCreateTypeChange,
  onCreateInstanceKeyChange,
  onCreateEndpointChange,
  onCreateSubmit,
  createLoading,
  createError,
}: AdminCollectionTargetsSectionProps) {
  return (
    <section
      id={ADMIN_SECTION_COLLECTION_TARGETS_ID}
      aria-label={COLLECTION_TARGET_HEADING}
    >
      <h2>{COLLECTION_TARGET_HEADING}</h2>
      <CollectionTargetList
        targets={targets}
        loading={loading}
        error={error}
        // 빈 상태 문구는 prop 이 아니라 상수를 직접 넘긴다 — 호출부마다 다른 문구가 새지 않게
        // 이 섹션의 정본을 컴포넌트가 소유한다(이동 전 AdminView 가 넘기던 값과 같은 상수).
        emptyMessage={EMPTY_COLLECTION_TARGET_TEXT}
        onDelete={onDelete}
        onToggleActive={onToggleActive}
        onEditStart={onEditStart}
        editingId={editingId}
        editEndpoint={editEndpoint}
        onEditEndpointChange={onEditEndpointChange}
        onEditSubmit={onEditSubmit}
        onEditCancel={onEditCancel}
        editBusy={editBusy}
        editScopes={editScopes}
        onEditScopeChange={onEditScopeChange}
      />
      {/* 삭제 · 토글 · 편집 저장 실패 문구는 각각 독립 alert 다(같은 자리를 쓰면 어느 동작이
          실패했는지 구분되지 않는다). 값이 없으면 미렌더라 정상 화면에 빈 alert 는 없다. */}
      {deleteError ? <div role="alert">{deleteError}</div> : null}
      {toggleError ? <div role="alert">{toggleError}</div> : null}
      {updateError ? <div role="alert">{updateError}</div> : null}
      {/* 등록 폼(T-1826, ADR-0059 §Follow-ups (e) 편집 축) — POST 가 `@Roles("Admin")` 편집
          tier 라 호출부가 Admin 일 때만 onCreateSubmit 을 내려보낸다. 위 목록은 GET 이
          `@Roles("User")` 라 gating 바깥에 그대로 둔다 — 읽기 축 회귀 0. */}
      {onCreateSubmit ? (
        <CollectionTargetAddForm
          type={createType}
          instanceKey={createInstanceKey}
          endpoint={createEndpoint}
          onTypeChange={onCreateTypeChange}
          onInstanceKeyChange={onCreateInstanceKeyChange}
          onEndpointChange={onCreateEndpointChange}
          onSubmit={onCreateSubmit}
          loading={createLoading}
          error={createError}
        />
      ) : null}
    </section>
  );
}

// export convention 은 같은 계열 presentational component(AdminSectionNav · CollectionTargetList)
// 승계 — props 타입은 named type export, 컴포넌트는 default export.
export type { AdminCollectionTargetsSectionProps };
export default AdminCollectionTargetsSection;
