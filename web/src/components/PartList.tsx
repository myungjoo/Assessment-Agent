// P6 line120/README85 Admin "파트(Part)" 관리 UI 첫 slice — 파트는 인원이 1개에만 속하는
// 조직도 단일소속 분류(REQ-028)로, backend Part CRUD(GET/POST/PATCH/DELETE /api/parts)는
// 이미 완결이나 web 목록 카드 UI 가 부재했다. 본 컴포넌트는 그 위에 올라가는 첫 building block
// 으로, Part 목록을 읽기 전용으로 렌더하는 순수 presentational controlled component 다
// (REQ-028 파트 분류 · REQ-049 admin 파트 관리). 실제 fetch(GET /api/parts)·필터·전역 상태·
// 라우팅·mutation 배선은 후속 mount/create/delete/edit slice 책임(Out of Scope). 직전
// GroupList(T-1147)·PersonList(T-1141)·LlmProviderConfigList(T-1133) 와 동일한 props/분기
// (loading 우선 → error → empty → populated)/named·default export convention 을 차용한다.

// Part 행 — backend 응답 shape(id/name/persons, prisma model Part L114~122)를 보수적으로
// 수용한다. id/name 은 선택적이라 누락 row 도 throw 없이 안전 렌더하며, persons 는 소속 인원
// 배열을 unknown[] 로 열어두어 인원 수 부가 표시에만 쓴다. Group 과 달리 Part 는 멤버 배열
// 후보가 persons 하나뿐(단일소속 도메인)이라 members 키를 두지 않는다. Part 는 secret 성 컬럼이
// 부재하므로 redaction 불요.
interface PartRow {
  // Part 식별자(선택) — React key 이자 상위 mutation 콜백(onDelete/onEdit)의 인자로 쓰인다.
  // 누락 시 목록 index 를 key fallback 으로 쓴다.
  id?: string;
  // 파트 이름(선택) — 목록 항목 주 라벨. 누락 시 사람-친화 placeholder 로 표시한다.
  name?: string;
  // 소속 인원 배열(선택) — 있으면 인원 수 부가 표시에 쓴다(응답 persons 키 정합).
  persons?: unknown[];
}

// loading 중 노출할 기본 한국어 문구.
const LOADING_TEXT = '불러오는 중…';
// parts 가 빈 배열일 때 노출할 기본 한국어 문구 (emptyMessage 미전달/빈 문자열 시 fallback).
const DEFAULT_EMPTY_MESSAGE = '등록된 파트가 없습니다';
// name 이 누락된 파트 행에 표시할 사람-친화 placeholder (throw 없이 안전 렌더).
const NAME_PLACEHOLDER = '(이름 없음)';
// 파트 삭제 버튼 라벨 — onDelete 전달 시에만 각 행에 렌더한다(GroupList DELETE_LABEL 동형).
const DELETE_LABEL = '삭제';
// 파트 수정 버튼 라벨 — onEdit 전달 시에만 각 행에 렌더한다(DELETE_LABEL 동형).
const EDIT_LABEL = '수정';

interface PartListProps {
  // 표시할 파트 목록 — controlled component 라 상위가 이미 fetch·정렬된 배열을 보유한다.
  parts: PartRow[];
  // 조회 진행 중 플래그 — true 면 parts 유무와 무관하게 로딩 표시 우선(loading 우선 정책).
  loading?: boolean;
  // 에러 문구(선택) — loading 이 아니고 truthy 면 role="alert" 영역에 렌더, 없으면 미렌더.
  error?: string;
  // 빈 상태 문구(선택). 빈 문자열이면 기본 문구로 fallback(의미 없는 빈 메시지 방지).
  emptyMessage?: string;
  // 파트 삭제 콜백(선택) — 주어졌을 때만 각 행에 삭제 버튼을 렌더하고 클릭 시 row.id 로 호출한다.
  // 미전달 시 버튼 미렌더(읽기 전용 하위 호환 — 후속 마운트 slice 보존, GroupList onDelete 동형).
  // 실 DELETE 요청·전역 상태는 상위 컨테이너 몫이라 presentational 책임(콜백 호출)만 진다.
  onDelete?: (id: string) => void;
  // 파트 수정 콜백(선택) — 주어졌을 때만 각 행에 수정 버튼을 렌더하고 클릭 시 row.id 로 호출한다.
  // 미전달 시 버튼 미렌더(읽기 전용 하위 호환 — onDelete 동형).
  // 실 PATCH 요청·인라인 수정 폼·전역 상태는 상위 컨테이너 몫이라 presentational 책임(콜백 호출)만 진다.
  onEdit?: (id: string) => void;
}

// 파트 목록. 실 fetch·필터·전역 상태·수정/삭제 요청은 수행하지 않고 props 의 parts 를 그대로
// 표시하며 onDelete/onEdit 콜백만 호출하는 presentational 책임만 진다 — 실제 조회·수정·삭제·
// 배선은 backend·상위 컨테이너 몫이다.
function PartList({ parts, loading, error, emptyMessage, onDelete, onEdit }: PartListProps) {
  // loading 우선 정책 — 진행 중이면 error·parts 유무와 무관하게 로딩 표시만 렌더한다.
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
  if (parts.length === 0) {
    const text = emptyMessage ? emptyMessage : DEFAULT_EMPTY_MESSAGE;
    return <div role="status">{text}</div>;
  }

  return (
    <ul>
      {parts.map((row, index) => {
        // id 누락 row 는 목록 index 를 React key fallback 으로 쓴다(throw 없이 안전 렌더).
        const key = row.id ?? `part-${index}`;
        // name 누락 row 는 사람-친화 placeholder 로 표시한다(항상 이름 영역을 렌더).
        const label = row.name ? row.name : NAME_PLACEHOLDER;
        // 소속 인원 수는 persons 가 있을 때만 부가 표시한다(없으면 throw 없이 생략).
        const personSource = row.persons;
        // 버튼 콜백은 row.id 를 요구한다 — id 없는 row 는 콜백 인자가 없으므로 버튼을 렌더하지 않는다.
        const rowId = row.id;
        return (
          <li key={key}>
            {/* part name 은 항상 표시한다(주 라벨, 누락 시 placeholder). */}
            <span>{label}</span>
            {/* 인원 수는 persons 가 있을 때만 부가 표시한다(없으면 throw 없이 생략). */}
            {personSource ? <span>{`인원 ${personSource.length}명`}</span> : null}
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

export type { PartRow, PartListProps };
export default PartList;
