// P6 line120 Admin "그룹(Group)" 관리 UI 첫 slice — 그룹은 재평가/멤버 관리용 <select>
// 드롭다운과 생성 폼(T-1146)으로만 등장할 뿐 목록 카드 UI 가 부재했다. 본 컴포넌트는 그
// 위에 올라가는 첫 building block 으로, Group 목록을 읽기 전용으로 렌더하는 순수
// presentational controlled component 다 (REQ-028 임의 Group 등록 · REQ-049 admin 그룹 관리).
// backend 의 Group API(GET /api/groups 등)는 이미 완결이라, 본 컴포넌트는 group 목록·
// loading/error 를 props 로만 받아 렌더하며, 실제 fetch(GET /api/groups)·필터·전역 상태·
// 라우팅·mutation 배선은 후속 mount/delete/edit slice 책임 (Out of Scope). 직전
// PersonList(T-1141)·LlmProviderConfigList(T-1133) 와 동일한 props/분기(loading 우선 →
// error → empty → populated)/named·default export convention 을 차용한다.

// Group 행 — AdminView 의 기존 GroupRow(id?/name?/members?/persons?, AdminView.tsx L327~332)
// 및 backend 응답 shape 다양성을 보수적으로 수용한다. id/name 은 선택적이라 누락 row 도
// throw 없이 안전 렌더하며, members/persons 는 멤버 배열 후보 두 키를 unknown[] 로 열어두어
// (AdminView 의 GroupMemberRow[] 도 unknown[] 에 대입 가능) 멤버 수 부가 표시에만 쓴다.
// Group 은 secret 성 컬럼이 부재하므로 redaction 불요.
interface GroupRow {
  // Group 식별자(선택) — React key 이자 상위 mutation 콜백(onDelete/onEdit)의 인자로 쓰인다.
  // 누락 시 목록 index 를 key fallback 으로 쓴다.
  id?: string;
  // 그룹 이름(선택) — 목록 항목 주 라벨. 누락 시 사람-친화 placeholder 로 표시한다.
  name?: string;
  // 멤버 배열 후보 1(선택) — 있으면 멤버 수 부가 표시에 쓴다(AdminView members 우선 규칙 정합).
  members?: unknown[];
  // 멤버 배열 후보 2(선택) — members 부재 시 대체로 멤버 수 표시에 쓴다(응답 키 다양성 수용).
  persons?: unknown[];
}

// loading 중 노출할 기본 한국어 문구.
const LOADING_TEXT = '불러오는 중…';
// groups 가 빈 배열일 때 노출할 기본 한국어 문구 (emptyMessage 미전달/빈 문자열 시 fallback).
const DEFAULT_EMPTY_MESSAGE = '등록된 그룹이 없습니다';
// name 이 누락된 그룹 행에 표시할 사람-친화 placeholder (throw 없이 안전 렌더).
const NAME_PLACEHOLDER = '(이름 없음)';
// 그룹 삭제 버튼 라벨 — onDelete 전달 시에만 각 행에 렌더한다(PersonList DELETE_LABEL 동형).
const DELETE_LABEL = '삭제';
// 그룹 수정 버튼 라벨 — onEdit 전달 시에만 각 행에 렌더한다(DELETE_LABEL 동형).
const EDIT_LABEL = '수정';

interface GroupListProps {
  // 표시할 그룹 목록 — controlled component 라 상위가 이미 fetch·정렬된 배열을 보유한다.
  groups: GroupRow[];
  // 조회 진행 중 플래그 — true 면 groups 유무와 무관하게 로딩 표시 우선(loading 우선 정책).
  loading?: boolean;
  // 에러 문구(선택) — loading 이 아니고 truthy 면 role="alert" 영역에 렌더, 없으면 미렌더.
  error?: string;
  // 빈 상태 문구(선택). 빈 문자열이면 기본 문구로 fallback(의미 없는 빈 메시지 방지).
  emptyMessage?: string;
  // 그룹 삭제 콜백(선택) — 주어졌을 때만 각 행에 삭제 버튼을 렌더하고 클릭 시 row.id 로 호출한다.
  // 미전달 시 버튼 미렌더(읽기 전용 하위 호환 — 후속 마운트 slice 보존, PersonList onDelete 동형).
  // 실 DELETE 요청·전역 상태는 상위 컨테이너 몫이라 presentational 책임(콜백 호출)만 진다.
  onDelete?: (id: string) => void;
  // 그룹 수정 콜백(선택) — 주어졌을 때만 각 행에 수정 버튼을 렌더하고 클릭 시 row.id 로 호출한다.
  // 미전달 시 버튼 미렌더(읽기 전용 하위 호환 — onDelete 동형).
  // 실 PATCH 요청·인라인 수정 폼·전역 상태는 상위 컨테이너 몫이라 presentational 책임(콜백 호출)만 진다.
  onEdit?: (id: string) => void;
}

// 그룹 목록. 실 fetch·필터·전역 상태·수정/삭제 요청은 수행하지 않고 props 의 groups 를 그대로
// 표시하며 onDelete/onEdit 콜백만 호출하는 presentational 책임만 진다 — 실제 조회·수정·삭제·
// 배선은 backend·상위 컨테이너 몫이다.
function GroupList({ groups, loading, error, emptyMessage, onDelete, onEdit }: GroupListProps) {
  // loading 우선 정책 — 진행 중이면 error·groups 유무와 무관하게 로딩 표시만 렌더한다.
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
  if (groups.length === 0) {
    const text = emptyMessage ? emptyMessage : DEFAULT_EMPTY_MESSAGE;
    return <div role="status">{text}</div>;
  }

  return (
    <ul>
      {groups.map((row, index) => {
        // id 누락 row 는 목록 index 를 React key fallback 으로 쓴다(throw 없이 안전 렌더).
        const key = row.id ?? `group-${index}`;
        // name 누락 row 는 사람-친화 placeholder 로 표시한다(항상 이름 영역을 렌더).
        const label = row.name ? row.name : NAME_PLACEHOLDER;
        // 멤버 수 후보 — members 우선, 없으면 persons(AdminView 멤버 배열 매핑 규칙 정합).
        // 둘 다 없으면 부가 표시를 생략한다(presentational only — 과도한 로직 금지).
        const memberSource = row.members ?? row.persons;
        // 버튼 콜백은 row.id 를 요구한다 — id 없는 row 는 콜백 인자가 없으므로 버튼을 렌더하지 않는다.
        const rowId = row.id;
        return (
          <li key={key}>
            {/* group name 은 항상 표시한다(주 라벨, 누락 시 placeholder). */}
            <span>{label}</span>
            {/* 멤버 수는 members/persons 가 있을 때만 부가 표시한다(없으면 throw 없이 생략). */}
            {memberSource ? <span>{`멤버 ${memberSource.length}명`}</span> : null}
            {/* onEdit + row.id 가 있을 때만 수정 버튼을 렌더하고 클릭 시 row.id 로 콜백 호출. */}
            {onEdit && rowId ? (
              <button type="button" onClick={() => onEdit(rowId)}>
                {EDIT_LABEL}
              </button>
            ) : null}
            {/* onDelete + row.id 가 있을 때만 삭제 버튼을 렌더하고 클릭 시 row.id 로 콜백 호출. */}
            {onDelete && rowId ? (
              <button type="button" onClick={() => onDelete(rowId)}>
                {DELETE_LABEL}
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export type { GroupRow, GroupListProps };
export default GroupList;
