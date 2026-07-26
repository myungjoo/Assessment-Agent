// REQ-046 / REQ-047 Admin 패널 인원·그룹 첫 building block — 한 그룹에 속한 인원(멤버)
// 목록 표시 컴포넌트 (ADR-0040 §1). backend 의 그룹/멤버 API 는 이미 완결이라, 본
// 컴포넌트는 그 위에 올라가는 순수 presentational controlled component 다 — 멤버 목록·
// loading/error·제거 콜백을 props 로만 받아 렌더하며, 실제 fetch(GET /api/groups/:id/members)·
// 멤버 추가/제거 API 호출·낙관적 업데이트·전역 상태·라우팅 배선은 후속 slice 책임
// (Out of Scope). 직전 slice(EvaluationResultTable, DifficultyModelSelector,
// SuperAdminSetupForm 등) 와 동일한 props/분기/named·default export convention 을 차용한다.
//
// T-1237: 멤버 추가(onAdd) presentational slice 를 T-1130(remove) 의 거울상으로 신설한다 —
// onAdd 콜백 prop + 추가 후보 select + "추가" 버튼. 실제 POST(/api/groups/:id/members)·
// 낙관적 업데이트·후보 파생(persons − 현재 members)·재조회 nonce 는 컨테이너(AdminView)
// 책임이라 본 slice 의 Out of Scope 다 — 여기서는 로컬 select 선택값만 useState 로 controlled 한다.

import { useState } from 'react';

// 멤버 옵션 — backend sanitize view 와 정합한 비밀 미포함 형태(password/secret 등 제외).
interface Member {
  // 멤버 식별자 — React key 이자 onRemove 콜백 인자로 쓴다. 추가 후보로 쓰일 때는 personId 로 전달.
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
// 멤버 추가 버튼 라벨 — onAdd 전달 시에만 추가 form 에 렌더한다.
const ADD_LABEL = '추가';
// 추가 후보 select 의 미선택(placeholder) 옵션 라벨 — value 는 빈 문자열이라 추가를 트리거하지 않는다.
const ADD_PLACEHOLDER = '추가할 인원 선택';
// 추가 후보가 0개일 때 노출할 한국어 안내 — select 를 disabled 로 두고 함께 표시한다(throw 없이 안전 표시).
const NO_CANDIDATES_TEXT = '추가할 인원이 없습니다';
// 추가 후보 검색 입력의 aria-label — 대량 후보(수백 인원) 시 부분일치로 옵션을 좁히는 검색 입력.
const SEARCH_LABEL = '추가 후보 검색';
// 원본 후보는 ≥1개이나 필터 결과가 0개일 때 노출할 한국어 안내(검색어 미매칭) — throw 없이 안전 표시.
const NO_RESULTS_TEXT = '검색 결과 없음';

// 추가 버튼 비활성 판정(순수) — 후보 미선택(빈 personId)이거나 후보가 0개면 비활성이다.
// 잘못된 빈 personId 전송·빈 후보 상태의 오발사를 렌더 단계에서 원천 차단한다.
function isAddDisabled(selectedPersonId: string, candidateCount: number): boolean {
  return selectedPersonId === '' || candidateCount === 0;
}

// 후보 필터링(순수) — filterText 를 trim + toLowerCase 한 질의어로 각 후보의 name(및 존재 시
// role)에 대해 case-insensitive 부분일치(includes)한 후보만 남긴 배열을 반환한다. 질의어가
// 빈 문자열/공백뿐이면 필터를 적용하지 않고 후보 전체를 그대로 반환한다. candidates 가 배열이
// 아니면(undefined 등) 빈 배열을 반환한다(throw 없음 — isAddDisabled/submitAdd 와 동형 방어).
// 대량 후보(수백 인원) 시 특정 인원 선택 사용성을 위한 client-side 단순 부분일치 1종이다.
function filterCandidates(
  candidates: Member[] | undefined,
  filterText: string,
): Member[] {
  // 비배열 방어 — undefined/비배열이면 빈 배열 반환(throw 없이 안전).
  if (!Array.isArray(candidates)) {
    return [];
  }
  // 질의어 정규화 — 앞뒤 공백 제거 후 소문자화. 빈 질의어면 필터 미적용(후보 전체 반환).
  const query = filterText.trim().toLowerCase();
  if (query === '') {
    return candidates;
  }
  // name(항상) 또는 role(존재 시)에 질의어가 부분일치하면 남긴다(case-insensitive).
  return candidates.filter((candidate) => {
    if (candidate.name.toLowerCase().includes(query)) {
      return true;
    }
    if (candidate.role && candidate.role.toLowerCase().includes(query)) {
      return true;
    }
    return false;
  });
}

// 추가 제출 로직(순수) — 선택된 personId 가 비어있지 않고 onAdd 가 주어졌을 때만 정확히
// 그 personId 로 콜백을 1회 호출한다. 빈 선택/onAdd 미전달 시에는 아무 것도 하지 않는다
// (빈 personId 전송 차단). form 의 onSubmit·버튼 onClick 이 본 함수에 위임한다.
function submitAdd(
  selectedPersonId: string,
  onAdd?: (personId: string) => void,
): void {
  if (selectedPersonId !== '' && onAdd) {
    onAdd(selectedPersonId);
  }
}

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
  // 멤버 추가 콜백(선택) — 주어졌을 때만 추가 form(후보 select + "추가" 버튼)을 렌더하고,
  // 선택된 후보의 personId 로 호출한다. 실 POST·낙관적 업데이트는 상위 컨테이너 책임.
  onAdd?: (personId: string) => void;
  // 추가 가능한 인원 후보 목록(선택) — 컨테이너가 persons − 현재 members 로 파생해 주입한다.
  // 본 slice 는 받은 그대로 select 옵션으로 렌더만 하며(정렬·중복 제거는 컨테이너 책임), 빈 배열이면
  // 안내 문구 + disabled select 로 안전 표시한다.
  addCandidates?: Member[];
}

// 그룹 인원 목록. 멤버 추가/제거 실 로직은 수행하지 않고 props 의 members 를 그대로
// 표시하며 onRemove/onAdd 콜백만 호출하는 presentational 책임만 진다 — 실제 추가/제거 요청·
// 낙관적 업데이트는 상위 컨테이너가 수행한다.
function GroupMemberList({
  members,
  loading,
  error,
  emptyMessage,
  onRemove,
  onAdd,
  addCandidates,
}: GroupMemberListProps) {
  // 추가 후보 select 의 선택값 — 로컬 useState 로 controlled. 초기값은 미선택(placeholder).
  // 데이터 fetch state 는 두지 않는다(순수 controlled 유지 — ADR-0040 §1, ADR-0041 §5).
  const [selectedPersonId, setSelectedPersonId] = useState('');

  // 추가 후보 검색어 — 로컬 useState 로 controlled. 초기값은 빈 문자열(필터 미적용 → 후보 전체).
  // 필터는 옵션 렌더만 좁히며(원본 candidates 는 후보 유무 판정에 그대로 사용), 순수 controlled 를 유지한다.
  const [filterText, setFilterText] = useState('');

  // 후보 배열 정규화 — 미전달이면 빈 배열로 취급(빈 후보 안전 표시 경로로 진입).
  const candidates = addCandidates ?? [];

  // loading 우선 정책 — 진행 중이면 error·members·추가 form 유무와 무관하게 로딩 표시만 렌더한다.
  if (loading === true) {
    return <div role="status">{LOADING_TEXT}</div>;
  }

  // 에러 분기 — loading 이 아니고 error 가 truthy 면 목록·추가 form 대신 alert 영역만 렌더한다.
  // (빈 문자열 error 는 falsy 라 본 분기로 진입하지 않는다 — 경계값.)
  if (error) {
    return <div role="alert">{error}</div>;
  }

  // 추가 form 영역 — onAdd 가 주어졌을 때만 렌더한다(미전달 시 null → 기존 렌더와 byte 동등).
  // 후보 0개면 안내 문구 + disabled select 로 안전 표시하고, 미선택이면 추가 버튼을 disabled 로 둔다.
  // 옵션 소스 — 필터 결과로 좁힌 후보. 원본 candidates 는 후보 유무 판정(빈 후보 안내·select
  // disabled·추가 버튼 disabled)에 그대로 쓰고, <option> 렌더만 filtered 를 사용한다.
  const filtered = filterCandidates(candidates, filterText);
  // 검색 결과 없음 분기 — 원본 후보는 ≥1개이나 필터 결과가 0개일 때만 안내(빈 후보 안내와 구분).
  const showNoResults = candidates.length > 0 && filtered.length === 0;

  const addForm = onAdd ? (
    <form
      onSubmit={(event) => {
        // 폼 default 제출(페이지 reload)을 막고 추가 제출 로직에 위임한다.
        event.preventDefault();
        submitAdd(selectedPersonId, onAdd);
      }}
    >
      {/* 후보가 0개면 한국어 안내를 함께 표시한다(select 도 disabled — 이중 안전 표시). */}
      {candidates.length === 0 ? <span>{NO_CANDIDATES_TEXT}</span> : null}
      {/* 추가 후보 검색 입력 — 이름/역할 부분일치로 옵션을 좁힌다(대량 후보 사용성). onAdd
          있을 때만(addForm 안) 렌더되므로 onAdd 미전달 렌더는 byte 동등을 유지한다. */}
      <input
        type="search"
        aria-label={SEARCH_LABEL}
        value={filterText}
        onChange={(event) => setFilterText(event.target.value)}
      />
      {/* 필터 결과가 0개(원본 후보는 있음)면 한국어 안내를 표시하고 select 는 placeholder 만
          남긴다(throw 없이 안전 표시). 미선택 유지로 추가 버튼은 disabled 다. */}
      {showNoResults ? <span>{NO_RESULTS_TEXT}</span> : null}
      <select
        name="addCandidate"
        value={selectedPersonId}
        disabled={candidates.length === 0}
        onChange={(event) => setSelectedPersonId(event.target.value)}
      >
        {/* 미선택 placeholder 옵션 — value 는 빈 문자열이라 추가를 트리거하지 않는다. */}
        <option value="">{ADD_PLACEHOLDER}</option>
        {filtered.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {/* 이름은 항상, role 은 있을 때만 괄호로 함께 표시(없으면 이름만). */}
            {candidate.role ? `${candidate.name} (${candidate.role})` : candidate.name}
          </option>
        ))}
      </select>
      <button type="submit" disabled={isAddDisabled(selectedPersonId, candidates.length)}>
        {ADD_LABEL}
      </button>
    </form>
  ) : null;

  // 빈 데이터 분기 — 의미 없는 빈 목록 대신 빈 상태 메시지를 렌더한다.
  // 빈 문자열 emptyMessage 는 기본 문구로 fallback 한다(빈 메시지 방지 정책).
  // onAdd 가 있으면 빈 상태에서도(첫 멤버 추가 가능) 빈 상태 메시지와 추가 form 을 함께 렌더한다.
  if (members.length === 0) {
    const text = emptyMessage ? emptyMessage : DEFAULT_EMPTY_MESSAGE;
    const emptyStatus = <div role="status">{text}</div>;
    // onAdd 미전달 시 기존 렌더와 byte 동등하도록 wrapper 없이 그대로 반환한다(후회귀 방지).
    if (!onAdd) {
      return emptyStatus;
    }
    return (
      <div>
        {emptyStatus}
        {addForm}
      </div>
    );
  }

  // 멤버 목록 — onAdd 미전달 시 기존과 byte 동등한 <ul> 만, 전달 시 목록 + 추가 form 을 함께 렌더한다.
  const list = (
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

  if (!onAdd) {
    return list;
  }
  return (
    <div>
      {list}
      {addForm}
    </div>
  );
}

export { isAddDisabled, submitAdd, filterCandidates };
export type { Member, GroupMemberListProps };
export default GroupMemberList;
