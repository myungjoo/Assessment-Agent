// 그룹 관리 패널 전체(T-1909 슬라이스 1/2 + T-1910 슬라이스 2/2 — PLAN 184 행 경로 2).
// AdminView 안에 있던 <section> · <h2> · 생성 폼 · 인라인 수정 폼 · <GroupList> 를 마크업 그대로
// 옮겨 온 controlled presentational component 다: 조회 · 훅 호출 · 자체 state · 새 분기 0 이고
// props 만 받는다(ADR-0041 §Decision 1 — 컴포넌트는 fetch 를 모른다). 그룹 상태 · mutation
// 핸들러는 전부 호출부(AdminView) 잔존이고 여기서는 받은 값 · 콜백을 그대로 통과시킨다.
// 슬라이스 1/2 가 임시로 열어 둔 children 슬롯은 소비처 0 이 되어 함께 제거했다.
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
  // 생성 폼 축 5(T-1146) — 값 · 변경 · 제출은 호출부 소유 상태와 1:1 이다. createError 가 falsy
  // 면 alert 는 미렌더고, createLoading 은 입력 · 버튼 비활성화로 이중 제출을 억제한다.
  createName: string;
  onCreateNameChange: (next: string) => void;
  onCreateSubmit: () => void;
  createLoading?: boolean;
  createError?: string;
  // 인라인 수정 폼 축 7(T-1150) — GroupList 각 행의 "수정"(onEdit)이 편집 대상 id 를 세팅하면
  // editingId !== null 이 되어 본 폼이 렌더된다. name 단일 controlled input 은 호출부가
  // 클릭한 row 의 현재 name 으로 prefill 하고, "그룹 수정"이 PATCH 를 발사한다(낙관 갱신 없음).
  // editLoading 중엔 입력 · 버튼을 잠가 이중 PATCH 를 막고, "취소"는 발사 없이 편집을 닫는다.
  // 실패 문구(editError)는 생성 · 삭제 error 와 별도 자리에서 role="alert" 로 표시한다.
  editingId: string | null;
  editName: string;
  onEditNameChange: (next: string) => void;
  onEditSubmit: () => void;
  onEditCancel: () => void;
  editLoading?: boolean;
  editError?: string;
}

// 섹션 껍데기 + 생성 폼 + 인라인 수정 폼 + 목록. 분기는 editingId null 여부 1 개와 값 truthy
// 여부(alert 2 · disabled 4) 뿐이라 어떤 props 조합에서도 throw 하지 않는다(로딩 우선 · 오류 ·
// 빈 목록 분기는 전부 GroupList 안 종전 로직 그대로다).
function AdminGroupsSection({
  groups,
  loading,
  error,
  onDelete,
  onEdit,
  createName,
  onCreateNameChange,
  onCreateSubmit,
  createLoading,
  createError,
  editingId,
  editName,
  onEditNameChange,
  onEditSubmit,
  onEditCancel,
  editLoading,
  editError,
}: AdminGroupsSectionProps) {
  return (
    <section id={ADMIN_SECTION_GROUPS_ID} aria-label={GROUP_HEADING}>
      <h2>{GROUP_HEADING}</h2>
      {/* 폼 2 종은 <h2> 뒤 · <GroupList> 앞 — 이동 전 JSX 순서 그대로여야 DOM 이 같다. */}
      <div>
        <input
          aria-label="추가할 그룹 이름"
          type="text"
          value={createName}
          onChange={(event) => onCreateNameChange(event.target.value)}
          disabled={createLoading}
        />
        <button
          type="button"
          onClick={onCreateSubmit}
          disabled={createLoading || !createName.trim()}
        >
          그룹 추가
        </button>
        {createError ? <p role="alert">{createError}</p> : null}
      </div>
      {editingId !== null ? (
        <div>
          <input
            aria-label="수정할 그룹 이름"
            type="text"
            value={editName}
            onChange={(event) => onEditNameChange(event.target.value)}
            disabled={editLoading}
          />
          <button
            type="button"
            onClick={onEditSubmit}
            disabled={editLoading || !editName.trim()}
          >
            그룹 수정
          </button>
          <button type="button" onClick={onEditCancel} disabled={editLoading}>
            취소
          </button>
          {editError ? <p role="alert">{editError}</p> : null}
        </div>
      ) : null}
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
