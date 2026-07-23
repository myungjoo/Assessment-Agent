// R-20/R-33 권한 부족 audit 표면화 UI — backend 의 권한 거부 record audit
// (GET /api/permission-denied-records, ADR-0022/0023) 를 사람이 볼 수 있게 읽기 전용 목록으로
// 표시하는 컴포넌트 (REQ-008 user audience · REQ-016 admin audience). backend 계약은 이미 완결
// (T-0214 박제, service-layer audience 차등) 이라, 본 컴포넌트는 그 위에 올라가는 순수
// presentational controlled component 다 — record view 목록·loading/error 를 props 로만 받아
// 렌더하며, 실제 fetch(GET /api/permission-denied-records)·필터(instanceRef/provider/httpStatus)·
// 전역 상태·라우팅 배선은 후속 slice 책임 (Out of Scope). 직전 LLM provider CRUD slice
// (LlmProviderConfigList 등) 와 동일한 props/분기(loading 우선 → error → empty → populated)/
// named·default export convention 을 차용한다.

// 권한 부족 record 행 — backend record view(provider/instanceRef/resourceRef/principal/httpStatus/
// reason/createdAt, ADR-0023 §5) 와 정합. secret 컬럼은 view 자체에 부재하므로(redaction 불요)
// props 에도 렌더에도 포함하지 않는다.
interface PermissionDeniedRecordRow {
  // record 식별자 — React key. backend view 에는 명시 컬럼이 아닐 수 있으나 목록 key 안정성을 위해
  // 상위 컨테이너가 부여한다(정렬/재조회에도 안정적 key 보장).
  id: string;
  // 권한 부족이 발생한 provider 종류(github/confluence 등) — 목록 항목 주 라벨.
  provider: string;
  // 대상 instance 참조(예: 저장소/스페이스 식별) — 항상 표시한다.
  instanceRef: string;
  // 접근이 거부된 resource 참조 — 항상 표시한다.
  resourceRef: string;
  // HTTP status code(예: 403/404) — number 타입. 항상 표시한다.
  httpStatus: number;
  // 거부 사유 문구 — null/생략 가능(백엔드가 사유를 채우지 않는 이벤트). 없으면 throw 없이 생략한다.
  reason?: string | null;
  // record 생성 시각(ISO 문자열) — 항상 표시한다.
  createdAt: string;
  // 권한 부족을 유발한 주체 — 현 이벤트는 항상 null/생략(ADR-0022 §1). nullable 이라 있을 때만 표시.
  principal?: string | null;
}

// loading 중 노출할 기본 한국어 문구.
const LOADING_TEXT = '불러오는 중…';
// records 가 빈 배열일 때 노출할 기본 한국어 문구 (emptyMessage 미전달/빈 문자열 시 fallback).
const DEFAULT_EMPTY_MESSAGE = '권한 부족 record 가 없습니다';

interface PermissionDeniedRecordListProps {
  // 표시할 권한 부족 record 목록 — controlled component 라 상위가 이미 fetch·정렬된 배열을 보유한다.
  records: PermissionDeniedRecordRow[];
  // 조회 진행 중 플래그 — true 면 records 유무와 무관하게 로딩 표시 우선(loading 우선 정책).
  loading?: boolean;
  // 에러 문구(선택) — loading 이 아니고 truthy 면 role="alert" 영역에 렌더, 없으면 미렌더.
  error?: string;
  // 빈 상태 문구(선택). 빈 문자열이면 기본 문구로 fallback(의미 없는 빈 메시지 방지).
  emptyMessage?: string;
}

// 권한 부족 record 목록. 실 fetch·필터·전역 상태는 수행하지 않고 props 의 records 를 그대로
// 표시하는 presentational 책임만 진다 — 실제 조회·audience 차등은 backend·상위 컨테이너 몫이다.
function PermissionDeniedRecordList({
  records,
  loading,
  error,
  emptyMessage,
}: PermissionDeniedRecordListProps) {
  // loading 우선 정책 — 진행 중이면 error·records 유무와 무관하게 로딩 표시만 렌더한다.
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
  if (records.length === 0) {
    const text = emptyMessage ? emptyMessage : DEFAULT_EMPTY_MESSAGE;
    return <div role="status">{text}</div>;
  }

  return (
    <ul>
      {records.map((row) => (
        <li key={row.id}>
          {/* provider 는 항상 표시한다(주 라벨). */}
          <span>{row.provider}</span>
          {/* instanceRef/resourceRef 는 항상 표시한다. */}
          <span>{row.instanceRef}</span>
          <span>{row.resourceRef}</span>
          {/* httpStatus 는 number 라 문자열로 렌더한다(항상 표시). */}
          <span>{row.httpStatus}</span>
          {/* createdAt 은 항상 표시한다. */}
          <span>{row.createdAt}</span>
          {/* reason 은 null/생략 가능 — 있을 때만 표시하고 없으면 throw 없이 생략한다. */}
          {row.reason ? <span>{row.reason}</span> : null}
          {/* principal 은 현 이벤트에서 항상 null/생략(ADR-0022 §1) — 있을 때만 표시한다. */}
          {row.principal ? <span>{row.principal}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export type { PermissionDeniedRecordRow, PermissionDeniedRecordListProps };
export default PermissionDeniedRecordList;
