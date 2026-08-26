// REQ-074 (PLAN 131 행 ① 대시보드 인원 선택 UI) 첫 slice — 대시보드 화면 안에서 평가 대상
// 인원을 직접 고르는 선택 컨트롤. 현재 AppShell 은 <DashboardView /> 를 무-prop 으로 마운트해
// personId 가 영원히 미선택이라 DashboardView 의 안내문("평가 대상을 선택하면 결과가 표시됩니다")
// 에서 더 나아갈 수단이 화면에 0 이다 — 본 컴포넌트가 그 빈자리를 채울 선택 수단이다.
//
// ADR-0041 Decision 1 경계를 지켜 순수 presentational controlled component 로만 만든다 —
// 인원 목록·현재 선택·변경 콜백·loading/error 를 props 로만 받아 렌더하며, 실제
// fetch(GET /api/persons)·useApiResource·전역 상태·DashboardView 상태 lift-up·AppShell 배선은
// 후속 slice 책임(Out of Scope). DifficultyModelSelector(T-1132)·PersonList(T-1141) 와 동일한
// props/분기(loading 우선 → error → empty → populated)/named + default export convention 을
// 차용하고, 이벤트를 발화할 수 없는 정적 렌더 환경에서 콜백을 검증하기 위해 GroupMemberList 의
// 순수 export 함수(submitAdd 계열) 선례를 따라 선택 제출 로직을 순수 함수로 분리한다.

// 선택 후보 인원 — PersonList 의 PersonRow(id/fullName/email/active/partId/createdAt) 의
// 부분집합. Person 에는 secret 성 컬럼이 없어 redaction 불요다. email/active 는 backend 응답
// shape 다양성을 보수적으로 수용하기 위해 선택적으로 둔다(없어도 throw 없이 렌더).
interface SelectablePerson {
  // Person 식별자 — <option> 의 value 이자 onSelect 콜백 인자, React key.
  id: string;
  // 인원 이름 — option 의 주 라벨. 항상 표시한다.
  fullName: string;
  // 인원 이메일(선택) — 있으면 동명이인 식별을 위해 이름과 함께 표시한다.
  email?: string;
  // 활성 여부(선택) — false 인 인원만 후보에서 제외한다. undefined 면 포함(보수적 수용).
  active?: boolean;
}

// loading 중 노출할 기본 한국어 문구 (기존 컴포넌트와 동일 토큰 — 말줄임표는 U+2026 …).
const LOADING_TEXT = '불러오는 중…';
// 선택 가능한 인원이 0 명일 때 노출할 한국어 빈 상태 문구.
const EMPTY_PERSONS_TEXT = '선택 가능한 평가 대상 인원이 없습니다';
// 미선택 placeholder 옵션 라벨 — value 는 빈 문자열이라 "선택 해제" 를 의미한다.
const PLACEHOLDER_LABEL = '평가 대상을 선택하세요';
// 선택 컨트롤의 사람-친화 라벨 — <label> 텍스트로 렌더한다.
const FIELD_LABEL = '평가 대상 인원';

interface DashboardPersonSelectorProps {
  // 선택 후보 인원 목록 — controlled component 라 상위가 이미 조회한 배열을 보유한다.
  persons: SelectablePerson[];
  // 현재 선택된 personId(선택) — 미선택이면 undefined/빈 문자열이라 placeholder 가 선택된다.
  selectedId?: string;
  // 선택 변경 콜백 — trim 된 personId 로 호출한다. 빈 문자열은 "선택 해제" 로 그대로 전달한다.
  onSelect: (personId: string) => void;
  // 목록 조회 진행 중 플래그 — true 면 persons 유무와 무관하게 로딩 표시 우선(loading 우선 정책).
  loading?: boolean;
  // 조회 실패 등 에러 문구(선택) — truthy 면 role="alert" 로 먼저 렌더하되 아래 선택 수단을
  // 삼키지 않는다(에러가 선택 수단을 없애면 REQ-074 "선택 수단 없는 상태 금지" 위반).
  error?: string;
}

// 선택 후보 필터링(순수) — active 가 명시적으로 false 인 인원만 제외하고 나머지는 입력 순서를
// 보존해 반환한다. active 가 undefined 면 backend 응답 shape 다양성을 보수적으로 수용해
// 포함한다(PersonList 의 선택 필드 정책 동형). persons 가 배열이 아니면(undefined 등) 빈 배열을
// 반환한다(throw 없이 안전 — GroupMemberList 의 filterCandidates 동형 방어).
// Array.prototype.filter 는 새 배열을 만들므로 원본 배열을 mutate 하지 않는다.
function filterSelectablePersons(
  persons: SelectablePerson[] | undefined,
): SelectablePerson[] {
  if (!Array.isArray(persons)) {
    return [];
  }
  return persons.filter((person) => person.active !== false);
}

// 선택 제출 로직(순수) — value 를 trim 한 뒤 onSelect 가 함수일 때만 정확히 1 회 호출하고,
// 실제로 호출했으면 true, 콜백 미전달(undefined 등)이면 false 를 반환한다. 빈 문자열도
// "선택 해제" 로 간주해 그대로 전달한다 — 안내문 상태로 되돌아가는 것은 상위 컨테이너의
// 정당한 상태이므로 여기서 막지 않는다. <select> 의 onChange 가 본 함수에 위임한다
// (정적 렌더 환경에서 콜백 계약을 검증할 수 있게 렌더에서 분리 — GroupMemberList 선례).
function submitSelection(
  value: string,
  onSelect?: (personId: string) => void,
): boolean {
  const personId = value.trim();
  if (typeof onSelect !== 'function') {
    return false;
  }
  onSelect(personId);
  return true;
}

// 대시보드 평가 대상 인원 선택 컨트롤. 후보 목록·현재 선택을 표시하고 변경 콜백만 호출하는
// presentational 책임만 진다 — 실제 조회/선택 상태 보관은 상위 컨테이너가 수행한다.
function DashboardPersonSelector({
  persons,
  selectedId,
  onSelect,
  loading,
  error,
}: DashboardPersonSelectorProps) {
  // loading 우선 정책 — 진행 중이면 persons/error 유무와 무관하게 로딩 표시만 렌더한다.
  if (loading === true) {
    return <div role="status">{LOADING_TEXT}</div>;
  }

  // 후보 파생 — 휴직(active === false) 인원은 평가 대상으로 고를 수 없으므로 제외한다.
  const selectablePersons = filterSelectablePersons(persons);

  return (
    <div>
      {/* 에러는 먼저 알리되 아래 선택 수단을 삼키지 않는다(REQ-074). 빈 error 는 미렌더. */}
      {error ? <div role="alert">{error}</div> : null}

      {selectablePersons.length === 0 ? (
        // 빈 상태 — 고를 후보가 없으므로 <select> 대신 안내 문구만 렌더한다.
        <div role="status">{EMPTY_PERSONS_TEXT}</div>
      ) : (
        <label>
          {FIELD_LABEL}
          <select
            name="personId"
            // controlled — 미선택/미지의 selectedId 는 throw 없이 placeholder 로 fallback 한다.
            value={selectedId ?? ''}
            onChange={(event) => submitSelection(event.target.value, onSelect)}
          >
            {/* 미선택 placeholder — value 는 빈 문자열이라 선택 해제로 전달된다. */}
            <option value="">{PLACEHOLDER_LABEL}</option>
            {selectablePersons.map((person) => (
              <option key={person.id} value={person.id}>
                {/* email 이 없거나 빈 문자열이면 이름만 — undefined·() 같은 깨진 라벨 방지. */}
                {person.email ? `${person.fullName} (${person.email})` : person.fullName}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

export { filterSelectablePersons, submitSelection };
export type { SelectablePerson, DashboardPersonSelectorProps };
export default DashboardPersonSelector;
