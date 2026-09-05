// 수집 대상 관리 패널의 section 껍데기 + 목록 축(T-1907 — PLAN 184 행 경로 2 슬라이스 1/2).
// AdminView 안에 있던 <section> · <h2> · <CollectionTargetList> 3 요소를 마크업 그대로 옮겨 온
// controlled presentational component 다: 조회 · 훅 호출 · 상태 · 새 분기 0 이고 props 만 받는다
// (ADR-0041 §Decision 1 — 컴포넌트는 fetch 를 모른다). isAdmin gating 삼항은 호출부에 남겨 두고
// 여기서는 받은 콜백을 그대로 내려보내기만 한다(콜백이 undefined 면 목록이 그 컨트롤을 렌더하지
// 않는다 — 403 확정 컨트롤 미노출 계약 무변경). 오류 alert 3 종 · 등록 폼은 children 슬롯으로
// 통과시켜 이동 전과 동일한 DOM 순서를 보존한다(슬라이스 2/2 가 그 슬롯을 props 로 흡수한다).
import type { ReactNode } from 'react';
import CollectionTargetList, {
  type CollectionTargetRow,
  type CollectionTargetScopeField,
} from '../components/CollectionTargetList';
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
  // 목록 아래에 이어 붙는 오류 alert 3 종 · 등록 폼 슬롯(슬라이스 2/2 이관 대상).
  // 미전달이면 목록만 렌더한다 — 빈 자식으로도 section 은 정상 렌더된다.
  children?: ReactNode;
}

// 섹션 껍데기 + 목록. 분기가 하나도 없어 어떤 props 조합에서도 throw 하지 않는다
// (빈 목록 · 오류 · 로딩 분기는 전부 CollectionTargetList 안 종전 로직 그대로다).
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
  children,
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
      {children}
    </section>
  );
}

// export convention 은 같은 계열 presentational component(AdminSectionNav · CollectionTargetList)
// 승계 — props 타입은 named type export, 컴포넌트는 default export.
export type { AdminCollectionTargetsSectionProps };
export default AdminCollectionTargetsSection;
