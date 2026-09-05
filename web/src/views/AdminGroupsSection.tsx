// 그룹 관리 패널의 section 껍데기 + 목록 축(T-1909 슬라이스 1/2 — PLAN 184 행 경로 2).
// AdminView 안에 있던 <section> · <h2> · <GroupList> 를 마크업 그대로 옮겨 온 controlled
// presentational component 다: 조회 · 훅 호출 · 자체 state · 새 분기 0 이고 props 만 받는다
// (ADR-0041 §Decision 1 — 컴포넌트는 fetch 를 모른다). 생성 폼 · 인라인 수정 폼은 아직
// 호출부가 소유하므로 children 슬롯으로 그대로 통과시킨다(슬라이스 2/2 가 props 로 흡수).
import type { ReactNode } from 'react';
import GroupList, { type GroupRow } from '../components/GroupList';
import { ADMIN_SECTION_GROUPS_ID, GROUP_HEADING } from './adminViewConstants';

interface AdminGroupsSectionProps {
  // 목록 축 5 props — 이름 · optional 여부를 GroupListProps 와 1:1 로 맞춘다(변환 · 기본값
  // 부여 0 — 받은 값을 그대로 통과시켜야 이동 전후 렌더가 같다).
  groups: GroupRow[];
  loading?: boolean;
  error?: string;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  // 생성 폼 · 인라인 수정 폼 슬롯(슬라이스 2/2 가 props 로 흡수할 때까지 호출부 소유) —
  // 미전달이면 아무것도 렌더하지 않는다(빈 자식도 안전).
  children?: ReactNode;
}

// 섹션 껍데기 + children 슬롯 + 목록. 자체 분기 0 이라 어떤 props 조합에서도 throw 하지
// 않는다(로딩 우선 · 오류 · 빈 목록 분기는 전부 GroupList 안 종전 로직 그대로다).
function AdminGroupsSection({
  groups,
  loading,
  error,
  onDelete,
  onEdit,
  children,
}: AdminGroupsSectionProps) {
  return (
    <section id={ADMIN_SECTION_GROUPS_ID} aria-label={GROUP_HEADING}>
      <h2>{GROUP_HEADING}</h2>
      {/* children 은 <h2> 뒤 · <GroupList> 앞 — 이동 전 JSX 순서 그대로여야 DOM 이 같다. */}
      {children}
      {/* emptyMessage 는 넘기지 않는다 — 이동 전처럼 GroupList 기본 문구로 fallback 한다. */}
      <GroupList
        groups={groups}
        loading={loading}
        error={error}
        onDelete={onDelete}
        onEdit={onEdit}
      />
    </section>
  );
}

// export convention 은 직전 슬라이스(AdminCollectionTargetsSection) 승계 — props 타입은
// named type export, 컴포넌트는 default export.
export type { AdminGroupsSectionProps };
export default AdminGroupsSection;
