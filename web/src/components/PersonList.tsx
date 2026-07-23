// P6 line120 Admin "인원(Person)" 관리 UI 첫 slice — backend 의 Person API
// (GET /api/persons + POST/PATCH/DELETE, PersonService CRUD + deactivate/reactivate,
// PLAN P3 line53) 를 사람이 볼 수 있게 읽기 전용 목록으로 표시하는 컴포넌트
// (REQ-049 admin 인원 관리 · REQ-023 Person↔ServiceIdentity). backend 계약은 이미 완결
// 이라, 본 컴포넌트는 그 위에 올라가는 순수 presentational controlled component 다 —
// Person 목록·loading/error 를 props 로만 받아 렌더하며, 실제 fetch(GET /api/persons)·
// 필터·전역 상태·라우팅 배선은 후속 mount slice 책임 (Out of Scope). 직전
// LlmProviderConfigList(T-1133)·PermissionDeniedRecordList(T-1139) 와 동일한 props/분기
// (loading 우선 → error → empty → populated)/named·default export convention 을 차용한다.

// Person 행 — prisma model Person(id/fullName/email/active/createdAt/updatedAt/partId,
// schema.prisma L55~75) 와 정합. Person 은 민감 컬럼이 부재하므로(secret 없음) redaction
// 불요 — 모든 필드가 노출 가능하다. partId/createdAt 은 backend 응답 shape 다양성을
// 보수적으로 수용하기 위해 선택적으로 둔다(있을 때만 표시, 없으면 throw 없이 생략).
interface PersonRow {
  // Person 식별자 — React key. 상위 컨테이너의 mutation 콜백 인자로도 쓰인다.
  id: string;
  // 인원 이름 — 목록 항목 주 라벨. 항상 표시한다.
  fullName: string;
  // 인원 이메일(모델상 unique) — 항상 표시한다. Person 에는 secret 성 컬럼이 없다.
  email: string;
  // 활성 여부 — true 면 "활성", false 면 "휴직" 으로 사람-친화 한국어 표시한다.
  active: boolean;
  // 소속 파트 식별자(선택, nullable) — 있을 때만 표시, 없으면 throw 없이 생략한다.
  partId?: string | null;
  // 생성 시각(ISO 문자열, 선택) — 있을 때만 표시, 없으면 throw 없이 생략한다.
  createdAt?: string;
}

// loading 중 노출할 기본 한국어 문구.
const LOADING_TEXT = '불러오는 중…';
// persons 가 빈 배열일 때 노출할 기본 한국어 문구 (emptyMessage 미전달/빈 문자열 시 fallback).
const DEFAULT_EMPTY_MESSAGE = '등록된 인원이 없습니다';
// active 여부를 사람-친화 한국어로 표시할 라벨.
const ACTIVE_LABEL = '활성';
const INACTIVE_LABEL = '휴직';

interface PersonListProps {
  // 표시할 인원 목록 — controlled component 라 상위가 이미 fetch·정렬된 배열을 보유한다.
  persons: PersonRow[];
  // 조회 진행 중 플래그 — true 면 persons 유무와 무관하게 로딩 표시 우선(loading 우선 정책).
  loading?: boolean;
  // 에러 문구(선택) — loading 이 아니고 truthy 면 role="alert" 영역에 렌더, 없으면 미렌더.
  error?: string;
  // 빈 상태 문구(선택). 빈 문자열이면 기본 문구로 fallback(의미 없는 빈 메시지 방지).
  emptyMessage?: string;
}

// 인원 목록. 실 fetch·필터·전역 상태는 수행하지 않고 props 의 persons 를 그대로 표시하는
// presentational 책임만 진다 — 실제 조회·배선은 backend·상위 컨테이너 몫이다.
function PersonList({ persons, loading, error, emptyMessage }: PersonListProps) {
  // loading 우선 정책 — 진행 중이면 error·persons 유무와 무관하게 로딩 표시만 렌더한다.
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
  if (persons.length === 0) {
    const text = emptyMessage ? emptyMessage : DEFAULT_EMPTY_MESSAGE;
    return <div role="status">{text}</div>;
  }

  return (
    <ul>
      {persons.map((row) => (
        <li key={row.id}>
          {/* fullName 은 항상 표시한다(주 라벨). */}
          <span>{row.fullName}</span>
          {/* email 은 항상 표시한다(Person 에 secret 컬럼 없음). */}
          <span>{row.email}</span>
          {/* active 여부를 사람-친화 한국어로 표시한다(항상 표시). */}
          <span>{row.active ? ACTIVE_LABEL : INACTIVE_LABEL}</span>
          {/* partId 는 있을 때만 함께 표시한다(없으면 throw 없이 생략). */}
          {row.partId ? <span>{row.partId}</span> : null}
          {/* createdAt 은 있을 때만 함께 표시한다(없으면 throw 없이 생략). */}
          {row.createdAt ? <span>{row.createdAt}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export type { PersonRow, PersonListProps };
export default PersonList;
