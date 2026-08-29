// ADR-0058 §Follow-ups (d) AdminView 편집 UI 의 첫 web slice — 인원별 ServiceIdentity 목록을
// 사람이 눈으로 확인할 수 있게 표시하는 읽기 축 컴포넌트다. backend 5 route(T-1748~T-1756)와
// client 5 함수(T-1759~T-1761, `../api/serviceIdentity`)는 이미 완결됐으나 `web/src/components/`
// 에 ServiceIdentity 를 그리는 컴포넌트가 0 건이라, (d) 전체(목록 + 추가·수정·삭제·primary 편집
// 동선 + AdminView 배선 + RBAC gating)를 CLAUDE.md §3 cap(≤300 LOC / ≤5 파일) 안에서 절단한
// 첫 겹으로 **표시 축만** 신설한다.
//
// 경계 — PermissionDeniedRecordList / LlmProviderConfigList 선례를 그대로 승계한 controlled
// presentational component 다: fetch(`fetchServiceIdentities`) 호출 · 상태 보유 ·
// `useApiResource` 배선 · 편집 handler 는 일체 없고 props 만 받는다(후속 slice 책임).
// 정렬 · 필터 · 복제도 하지 않고 props 배열 순서를 그대로 보존한다.

// row 타입은 재선언하지 않고 client 계약을 그대로 재사용한다 — 같은 형태를 두 곳에 정의하면
// backend 스키마가 움직일 때 한쪽만 갱신되는 drift 가 생긴다(AssessmentResultTable.tsx `16 행`
// 의 `import type { AssessmentDisplayRow }` 선례 승계).
import type { ServiceIdentityRow } from '../api/serviceIdentity';
// slot 반환 타입 — 이미 설치된 react 의 type 만 가져오므로 새 dependency 0 이고,
// `import type` 이라 런타임 import 도 생성되지 않는다.
import type { ReactNode } from 'react';

// loading 중 노출할 기본 한국어 문구(선례와 동일 문구·U+2026 말줄임표).
const LOADING_TEXT = '불러오는 중…';
// identities 가 빈 배열일 때 노출할 기본 한국어 문구(emptyMessage 미전달/빈 문자열 시 fallback).
const DEFAULT_EMPTY_MESSAGE = '등록된 service identity 가 없습니다';
// `isPrimary === true` 인 행에만 붙이는 primary 식별 표식 — ADR-0058 §Decision 2 의
// "1 인원 1 primary" invariant 를 사람이 목록에서 바로 확인할 수 있게 하는 라벨이다.
const PRIMARY_BADGE_TEXT = 'primary';

interface ServiceIdentityListProps {
  // 표시할 identity 목록 — controlled component 라 상위가 이미 조회한 배열을 그대로 넘긴다.
  identities: ServiceIdentityRow[];
  // 조회 진행 중 플래그 — true 면 error·identities 유무와 무관하게 로딩 표시 우선.
  loading?: boolean;
  // 에러 문구(선택) — loading 이 아니고 truthy 면 role="alert" 영역에 렌더, 없으면 미렌더.
  error?: string;
  // 빈 상태 문구(선택). 빈 문자열이면 기본 문구로 fallback(의미 없는 빈 메시지 방지).
  emptyMessage?: string;
  // 행별 액션 slot(선택) — 주어졌을 때만 [4] populated 분기의 각 <li> 안, 기존 표시 컬럼
  // 뒤에 그 반환 노드를 렌더한다. 액션 콜백·플래그를 개별 prop 으로 늘어놓는 대신 행 객체를
  // 넘겨 노드를 받는 slot 하나만 두는 이유는 `ServiceIdentityRowActionsProps`(9 props)가 두
  // 곳에 복제돼 drift 나는 것을 막기 위해서다 — 조립은 상위 컨테이너 책임이다.
  // 미전달 시 아무것도 렌더하지 않아 기존 호출부(T-1766 AdminView 읽기 축) markup 회귀가 0 이다
  // (UserList `onChangeRole` optional 콜백 하위 호환 convention 승계).
  // 본 컴포넌트는 반환 노드를 검사·가공·캐싱하지 않고 받은 그대로 그 행에 렌더하며, slot 이
  // throw 하면 삼키지 않고 상위로 전파한다(error boundary 흉내 금지 — 판정은 상위 책임).
  renderRowActions?: (identity: ServiceIdentityRow) => ReactNode;
}

// 인원의 service identity 목록. 분기 순서는 선례와 동일하게 loading → error → empty → populated
// 로 고정한다(각 분기 근거는 아래 주석 참조).
function ServiceIdentityList({
  identities,
  loading,
  error,
  emptyMessage,
  renderRowActions,
}: ServiceIdentityListProps) {
  // [1] loading 우선 — 조회가 진행 중이면 직전 error 나 잔여 identities 가 남아 있어도 그것을
  // 현재 사실처럼 보여줘선 안 되므로 로딩 표시만 렌더한다.
  if (loading === true) {
    return <div role="status">{LOADING_TEXT}</div>;
  }

  // [2] error — 조회가 실패했으면 "identity 가 없음"과 "불러오지 못함"을 구분해야 하므로 목록
  // 대신 alert 영역만 렌더한다. 빈 문자열 error 는 falsy 라 본 분기로 진입하지 않는다(경계값).
  if (error) {
    return <div role="alert">{error}</div>;
  }

  // [3] empty — 조회는 성공했으나 행이 0 개인 정상 상태다(client 계약상 빈 배열은 예외가 아니다).
  // 빈 <ul> 대신 안내 문구를 렌더하고, 빈 문자열 emptyMessage 는 기본 문구로 fallback 한다.
  if (identities.length === 0) {
    const text = emptyMessage ? emptyMessage : DEFAULT_EMPTY_MESSAGE;
    return <div role="status">{text}</div>;
  }

  // [4] populated — props 배열 순서를 그대로 보존해 행마다 service·externalId 를 표시한다.
  return (
    <ul>
      {identities.map((row) => (
        <li key={row.id}>
          {/* service(instance key)는 행의 주 라벨이라 항상 표시한다. */}
          <span>{row.service}</span>
          {/* externalId 는 해당 service 에서의 계정 식별자라 항상 표시한다. 빈 문자열이어도
              throw 없이 빈 span 으로 렌더한다(입력 정상화는 backend·편집 slice 책임). */}
          <span>{row.externalId}</span>
          {/* primary 표식은 isPrimary === true 인 행에만 붙인다 — false/누락 행에는 렌더하지
              않아 목록에서 primary 가 몇 건인지 눈으로 셀 수 있게 한다(ADR-0058 §Decision 2).
              단 본 컴포넌트는 invariant 를 강제하지 않는다: primary 가 0 건이거나 2 건 이상인
              계약 위반 입력이 와도 throw 하지 않고 받은 그대로 렌더한다. */}
          {row.isPrimary === true ? <span>{PRIMARY_BADGE_TEXT}</span> : null}
          {/* 행별 액션 slot — 표시 컬럼 뒤, 같은 <li> 안에 그려야 "어느 행에 대한 액션인지"가
              시각적으로 귀속된다(<ul> 밖 별도 목록으로 빼면 대상 오인 삭제가 난다).
              행마다 정확히 1 회, identities 배열 순서대로 그 행 객체로 호출하며 배열을
              복제·정렬·필터하지 않는 기존 계약은 그대로다. 위 [1]~[3] 분기는 map 이전에
              return 하므로 loading·error·empty 에서는 slot 이 한 번도 호출되지 않는다. */}
          {renderRowActions ? renderRowActions(row) : null}
        </li>
      ))}
    </ul>
  );
}

// export convention 은 PermissionDeniedRecordList / LlmProviderConfigList 승계 — props 타입은
// named type export, 컴포넌트는 default export. row 타입은 client 정본을 재수출하지 않는다.
export type { ServiceIdentityListProps };
export default ServiceIdentityList;
