// REQ-046 / REQ-047 Admin 패널 인원·그룹 첫 building block — 한 그룹에 속한 인원(멤버)
// 목록 표시 컴포넌트 (ADR-0040 §1). backend 의 그룹/멤버 API 는 이미 완결이라, 본
// 컴포넌트는 그 위에 올라가는 순수 presentational controlled component 다 — 멤버 목록·
// loading/error·제거 콜백을 props 로만 받아 렌더하며, 실제 fetch(GET /api/groups/:id/members)·
// 멤버 추가/제거 API 호출·낙관적 업데이트·전역 상태·라우팅 배선은 후속 slice 책임
// (Out of Scope). 직전 slice(EvaluationResultTable, DifficultyModelSelector,
// SuperAdminSetupForm 등) 와 동일한 props/분기/named·default export convention 을 차용한다.

// 멤버 옵션 — backend sanitize view 와 정합한 비밀 미포함 형태(password/secret 등 제외).
interface Member {
  // 멤버 식별자 — React key 이자 onRemove 콜백 인자로 쓴다.
  id: string;
  // 멤버 표시 이름 — 목록 항목 주 라벨.
  name: string;
  // 멤버 역할 라벨(선택) — 있으면 이름과 함께 표시, 없으면 이름만 표시한다.
  role?: string;
}

// loading 중 노출할 기본 한국어 문구.
const LOADING_TEXT = '불러오는 중…';
// members 가 빈 배열일 때 노출할 기본 한국어 문구 (emptyMessage 미전달/빈 문자열 시 fallback).
const DEFAULT_EMPTY_MESSAGE = '표시할 인원이 없습니다';
// 멤버 제거 버튼 라벨 — onRemove 전달 시에만 각 행에 렌더한다.
const REMOVE_LABEL = '제거';

interface GroupMemberListProps {
  // 표시할 멤버 목록 — controlled component 라 상위가 이미 fetch·정렬된 배열을 보유한다.
  members: Member[];
  // 조회 진행 중 플래그 — true 면 members 유무와 무관하게 로딩 표시 우선(loading 우선 정책).
  loading?: boolean;
  // 에러 문구(선택) — loading 이 아니고 truthy 면 role="alert" 영역에 렌더, 없으면 미렌더.
  error?: string;
  // 빈 상태 문구(선택). 빈 문자열이면 기본 문구로 fallback(의미 없는 빈 메시지 방지).
  emptyMessage?: string;
  // 멤버 제거 콜백(선택) — 주어졌을 때만 각 행에 제거 버튼을 렌더하고 클릭 시 호출한다.
  onRemove?: (memberId: string) => void;
}

// 그룹 인원 목록. 멤버 추가/제거 실 로직은 수행하지 않고 props 의 members 를 그대로
// 표시하며 onRemove 콜백만 호출하는 presentational 책임만 진다 — 실제 제거 요청·낙관적
// 업데이트는 상위 컨테이너가 수행한다.
function GroupMemberList({
  members,
  loading,
  error,
  emptyMessage,
  onRemove,
}: GroupMemberListProps) {
  // loading 우선 정책 — 진행 중이면 error·members 유무와 무관하게 로딩 표시만 렌더한다.
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
  if (members.length === 0) {
    const text = emptyMessage ? emptyMessage : DEFAULT_EMPTY_MESSAGE;
    return <div role="status">{text}</div>;
  }

  return (
    <ul>
      {members.map((member) => (
        <li key={member.id}>
          {/* 이름은 항상, role 은 있을 때만 함께 표시한다(없으면 throw 없이 name 만). */}
          <span>{member.name}</span>
          {member.role ? <span>{member.role}</span> : null}
          {/* onRemove 가 주어졌을 때만 제거 버튼을 렌더하고 클릭 시 member.id 로 콜백 호출. */}
          {onRemove ? (
            <button type="button" onClick={() => onRemove(member.id)}>
              {REMOVE_LABEL}
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export type { Member, GroupMemberListProps };
export default GroupMemberList;
