// P6 line120/README84 Admin "사용자(User)" 관리 UI 첫 slice — 3 등급(SuperAdmin / Admin /
// User) 사용자 목록을 읽기 전용으로 렌더하는 순수 presentational controlled component 다
// (REQ-044 사용자 추가·승급 · REQ-045 역할 표시). backend 는 이미 완결(GET /api/users Admin+
// 목록, POST /api/users 생성, PATCH /api/users/:id/role 승강)이나 web 목록 UI 가 부재했다.
// 실제 fetch(GET /api/users)·mount·생성 폼·역할 변경 콜백 배선은 후속 slice 책임(Out of Scope).
// 직전 PartList(T-1151)·GroupList(T-1147)·PersonList(T-1141) 와 동일한 props/분기
// (loading 우선 → error → empty → populated)/named·default export convention 을 차용한다.

// User 행 — backend 응답 shape(UserResponseDto: id/email/role/createdAt/updatedAt)를
// 보수적으로 수용한다. 본 slice 는 목록 표시에 필요한 3 필드만 취하며 모두 선택적이라 누락 row 도
// throw 없이 안전 렌더한다. hashedPassword 같은 secret 성 컬럼은 응답에 부재하므로 redaction
// 불요이며, 본 타입에도 두지 않아 실수로 렌더될 표면 자체를 없앤다.
interface UserRow {
  // User 식별자(선택) — React key 이자 후속 mutation 콜백(onChangeRole)의 인자 후보.
  // 누락 시 목록 index 를 key fallback 으로 쓴다.
  id?: string;
  // 사용자 email(선택) — 목록 항목 주 라벨. 누락 시 사람-친화 placeholder 로 표시한다.
  email?: string;
  // 역할 문자열(선택) — "SuperAdmin" / "Admin" / "User" 중 하나. 있으면 보조 라벨로 표시하고
  // 없으면 throw 없이 생략한다(본 slice 는 표시만 — 승급 동작은 후속 slice).
  role?: string;
}

// loading 중 노출할 기본 한국어 문구.
const LOADING_TEXT = '불러오는 중…';
// users 가 빈 배열일 때 노출할 기본 한국어 문구 (emptyMessage 미전달/빈 문자열 시 fallback).
const DEFAULT_EMPTY_MESSAGE = '등록된 사용자가 없습니다';
// email 이 누락된 사용자 행에 표시할 사람-친화 placeholder (throw 없이 안전 렌더).
const EMAIL_PLACEHOLDER = '(이메일 없음)';
// 승급(User → Admin) 버튼 라벨 — onChangeRole 전달 시에만 해당 행에 렌더한다(PartList EDIT_LABEL 동형).
const PROMOTE_LABEL = 'Admin 으로 승급';
// 강등(Admin → User) 버튼 라벨 — onChangeRole 전달 시에만 해당 행에 렌더한다(PROMOTE_LABEL 동형).
const DEMOTE_LABEL = 'User 로 강등';

// 현재 역할에서 노출할 역할 변경 액션 1건을 판정한다 — 'User' → 승급(Admin), 'Admin' → 강등(User).
// 'SuperAdmin' 은 backend self-demote 금지 정책상 노출하지 않고, role 누락·소문자 'admin' 같은
// 미지 값도 판정 불가라 보수적으로 null(버튼 미렌더) 을 반환한다. 대소문자 관대 처리는 하지 않는다.
function resolveRoleAction(
  role: string | undefined,
): { nextRole: string; label: string } | null {
  if (role === 'User') {
    return { nextRole: 'Admin', label: PROMOTE_LABEL };
  }
  if (role === 'Admin') {
    return { nextRole: 'User', label: DEMOTE_LABEL };
  }
  return null;
}

interface UserListProps {
  // 표시할 사용자 목록 — controlled component 라 상위가 이미 fetch·정렬된 배열을 보유한다.
  users: UserRow[];
  // 조회 진행 중 플래그 — true 면 users 유무와 무관하게 로딩 표시 우선(loading 우선 정책).
  loading?: boolean;
  // 에러 문구(선택) — loading 이 아니고 truthy 면 role="alert" 영역에 렌더, 없으면 미렌더.
  error?: string;
  // 빈 상태 문구(선택). 빈 문자열이면 기본 문구로 fallback(의미 없는 빈 메시지 방지).
  emptyMessage?: string;
  // 역할 변경 콜백(선택) — 주어졌을 때만 각 행에 역할 변경 버튼을 렌더하고 클릭 시
  // (row.id, 다음 역할) 로 호출한다. 미전달 시 버튼 미렌더(읽기 전용 하위 호환 — T-1159 마운트
  // 회귀 0, PartList onDelete 동형). 실 PATCH /api/users/:id/role 요청 · SuperAdmin gating ·
  // 진행/에러 상태는 상위 컨테이너 몫이라 presentational 책임(콜백 호출)만 진다.
  onChangeRole?: (id: string, nextRole: string) => void;
}

// 사용자 목록. 실 fetch·필터·전역 상태·생성/역할 변경 요청은 수행하지 않고 props 의 users 를
// 그대로 표시하며 onChangeRole 콜백만 호출하는 presentational 책임만 진다 — 실제 조회·생성·승급
// 배선은 backend·상위 컨테이너 몫이다(ADR-0041 Decision 1 presentational-first 경계).
// 로컬 state 를 두지 않는 stateless 컴포넌트 convention 도 그대로 유지한다.
function UserList({
  users,
  loading,
  error,
  emptyMessage,
  onChangeRole,
}: UserListProps) {
  // loading 우선 정책 — 진행 중이면 error·users 유무와 무관하게 로딩 표시만 렌더한다.
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
  if (users.length === 0) {
    const text = emptyMessage ? emptyMessage : DEFAULT_EMPTY_MESSAGE;
    return <div role="status">{text}</div>;
  }

  return (
    <ul>
      {users.map((row, index) => {
        // id 누락 row 는 목록 index 를 React key fallback 으로 쓴다(throw 없이 안전 렌더).
        const key = row.id ?? `user-${index}`;
        // email 누락 row 는 사람-친화 placeholder 로 표시한다(항상 주 라벨 영역을 렌더).
        const label = row.email ? row.email : EMAIL_PLACEHOLDER;
        // 역할은 있을 때만 보조 라벨로 표시한다(없으면 throw 없이 생략).
        const role = row.role;
        // 버튼 콜백은 row.id 를 요구한다 — id 없는 row 는 콜백 인자가 없으므로 버튼을 렌더하지 않는다.
        const rowId = row.id;
        // 현재 역할로 판정한 역할 변경 액션(없으면 null → 버튼 미렌더).
        const roleAction = resolveRoleAction(role);
        return (
          <li key={key}>
            {/* email 은 항상 표시한다(주 라벨, 누락 시 placeholder). */}
            <span>{label}</span>
            {/* 역할은 role 이 있을 때만 보조 라벨로 표시한다(없으면 생략). */}
            {role ? <span>{`역할 ${role}`}</span> : null}
            {/* onChangeRole + row.id + 판정된 액션이 모두 있을 때만 역할 변경 버튼 1개를 렌더하고
                클릭 시 (row.id, 다음 역할) 로 콜백을 호출한다. */}
            {onChangeRole && rowId && roleAction ? (
              <button
                type="button"
                onClick={() => onChangeRole(rowId, roleAction.nextRole)}
              >
                {roleAction.label}
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export type { UserRow, UserListProps };
export default UserList;
