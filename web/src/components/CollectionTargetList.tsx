// ADR-0059 §Follow-ups (e) 화면 축의 첫 조각 — 등록된 수집 대상(CollectionTarget)을 사람이
// 눈으로 확인할 수 있게 표시하는 읽기 축 컴포넌트다. backend 5 route(T-1814~T-1817)와 오류
// 계약 e2e(T-1823)는 이미 완결됐으나 `web/` 전체에서 collection-target 을 언급하는 파일이
// 0 건이라, requirements.md `89 행` REQ-070(빈 상태에서 막히지 않게 하는 대상 인터페이스) ·
// `91 행` REQ-072(시스템 등록·편집)가 화면 부재로 PLANNED 에 묶여 있었다.
//
// 경계 — ServiceIdentityList / LlmProviderConfigList 선례를 그대로 승계한 controlled
// presentational component 다: fetch(`GET /api/collection-targets`) 호출 · 상태 보유 ·
// `useApiResource` 배선 · 편집 handler 는 일체 없고 props 만 받는다(조회 배선은 AdminView
// 컨테이너 책임). 정렬 · 필터 · 복제도 하지 않고 props 배열 순서를 그대로 보존한다.
// 등록 폼(T-1826) · 값 편집 폼(endpoint·orgs·repos·spaces)은 후속 slice 가 같은 섹션에 얹는다.
// 삭제 축(T-1828)과 활성/비활성 토글 축(T-1829)만 예외적으로 본 파일에 붙는데, 행 단위 진입점이라
// 목록 밖에 둘 자리가 없기 때문이다 — 그마저도 optional 콜백 호출뿐이라 presentational 경계는
// 그대로다(요청·진행 상태·오류 문구는 여전히 컨테이너 몫).

// row 타입은 별도 api client 모듈 없이 **본 파일에서 정의·named export** 한다
// (`LlmProviderConfigRow` 선례). 본 slice 는 조회 1 개뿐이라 `useApiResource` 로 충분하고,
// 소비처보다 앞선 client 모듈 신설은 CLAUDE.md §3 소비처 동반 의무가 막는다.
// 필드는 prisma/schema.prisma `690~707 행` 의 `CollectionTarget` 9 필드와 1:1 이다.
interface CollectionTargetRow {
  // 대상 식별자(cuid) — React key 이자 후속 편집 slice 의 mutation 인자.
  id: string;
  // 수집 대상 종류(예: GITHUB / CONFLUENCE) — 행의 분류 라벨.
  type: string;
  // 한 종류 안에서 유일한 instance key(@@unique([type, instanceKey])) — 행의 주 라벨.
  instanceKey: string;
  // 대상 시스템 endpoint URL.
  endpoint: string;
  // GITHUB 대상의 org 목록(선택) — CONFLUENCE 대상은 빈 배열이다.
  orgs?: string[];
  // GITHUB 대상의 repo 목록(선택) — CONFLUENCE 대상은 빈 배열이다.
  repos?: string[];
  // CONFLUENCE 대상의 space 목록(선택) — GITHUB 대상은 빈 배열이다.
  spaces?: string[];
  // 활성 여부 — false 면 수집에서 제외된 등록 해제 대기 행이다(schema 기본값 true).
  active?: boolean;
  // 생성/수정 시각(ISO 문자열, 선택) — 본 slice 는 표시하지 않지만 응답 계약 정합을 위해 둔다.
  createdAt?: string;
  updatedAt?: string;
}

// loading 중 노출할 기본 한국어 문구(선례와 동일 문구·U+2026 말줄임표).
const LOADING_TEXT = '불러오는 중…';
// targets 가 빈 배열일 때 노출할 기본 한국어 문구(emptyMessage 미전달/빈 문자열 시 fallback).
// REQ-070 의도(빈 상태에서 막히지 않게)를 살려 "없다" 는 사실을 명시적으로 알린다.
const DEFAULT_EMPTY_MESSAGE = '등록된 수집 대상이 없습니다';
// `active === false` 인 행에만 붙이는 비활성 표식 — 활성 행과 눈으로 구분되게 한다.
// 활성 행에는 표식을 붙이지 않아 목록에서 비활성이 몇 건인지 바로 셀 수 있다.
const INACTIVE_BADGE_TEXT = '비활성';
// `endpoint` 등 문자열 필드가 누락된 계약 위반 row 에서도 throw 없이 렌더하기 위한 placeholder.
const MISSING_FIELD_TEXT = '(없음)';
// 배열 3 종(orgs/repos/spaces)을 한 줄로 접어 표시할 때 쓰는 구분자.
const SCOPE_SEPARATOR = ', ';
// 수집 대상 삭제 버튼 라벨(T-1828) — onDelete 전달 시에만 각 행에 렌더한다(PersonList
// DELETE_LABEL 동형). 확인 대화상자 없이 즉시 콜백을 호출하는 것도 인원 축 선례 승계다.
const DELETE_LABEL = '삭제';
// 활성/비활성 토글 버튼 라벨 2 종(T-1829) — 라벨은 행의 **현재 상태** 에서 파생한다. 활성 행에는
// 다음에 일어날 동작(비활성화)을, 비활성 행에는 활성화를 보여줘 클릭 결과가 라벨과 같아진다.
// ADR-0059 §Decision 5 의 "일시 제외는 삭제가 아니라 active=false PATCH" 를 화면에 박제한 것이다.
const DEACTIVATE_LABEL = '비활성화';
const ACTIVATE_LABEL = '활성화';
// 값 편집(endpoint) 축 라벨 3 종 + 입력의 접근 가능한 이름(T-1831). 진입("편집") → 인라인
// 입력 → "저장"/"취소" 의 3 상태를 한 행 안에서 처리한다. 별도 컴포넌트 파일을 만들지 않는 이유는
// 행 단위 진입점이라 목록 밖에 자리가 없기 때문이다(삭제·토글 버튼 선례 동형 — task Out of Scope).
const EDIT_LABEL = '편집';
const SAVE_LABEL = '저장';
const CANCEL_LABEL = '취소';
// 입력에 라벨 요소를 따로 두지 않고 aria-label 로 이름을 준다 — 행 안 인라인이라 <label> 을 붙이면
// 행 레이아웃이 길어지고, 접근성상 필요한 것은 "이름이 있는가" 이지 시각 라벨 자체가 아니다.
const EDIT_INPUT_LABEL = 'endpoint 수정';

// 행의 활성 여부 판정(순수 함수) — `active` 필드가 누락돼도 schema 기본값(true) 대로 활성으로
// 본다. 즉 `false` 만 비활성이고 `true`·`undefined` 는 활성이다(INACTIVE_BADGE 분기와 동일 기준).
function isRowActive(row: { active?: boolean }): boolean {
  return row.active !== false;
}

// 문자열 필드 표시값(순수 함수) — 값이 없거나 빈 문자열이면 placeholder 로 대체한다. 타입상
// 필수인 필드라도 응답이 계약을 어기고 필드를 빠뜨릴 수 있으므로(런타임 사실), 목록은 throw
// 하지 않고 "값이 비었다" 는 사실을 눈에 보이게 표시만 한다(정상화는 backend · 편집 slice 책임).
function displayText(value?: string): string {
  return value ? value : MISSING_FIELD_TEXT;
}

// 배열 3 종을 사람이 읽는 한 줄로 접는다(순수 함수). `undefined` · 빈 배열이면 빈 문자열을
// 돌려주므로 호출부가 조건부로 미렌더할 수 있고, 어느 경우에도 throw 하지 않는다
// (type 별로 어느 배열이 비는지가 다르다 — GITHUB 은 spaces 가, CONFLUENCE 는 orgs/repos 가 빈다).
function formatScope(values?: string[]): string {
  if (!Array.isArray(values) || values.length === 0) {
    return '';
  }
  return values.join(SCOPE_SEPARATOR);
}

interface CollectionTargetListProps {
  // 표시할 수집 대상 목록 — controlled component 라 상위가 이미 조회한 배열을 그대로 넘긴다.
  targets: CollectionTargetRow[];
  // 조회 진행 중 플래그 — true 면 error·targets 유무와 무관하게 로딩 표시 우선.
  loading?: boolean;
  // 에러 문구(선택) — loading 이 아니고 truthy 면 role="alert" 영역에 렌더, 없으면 미렌더.
  error?: string;
  // 빈 상태 문구(선택). 빈 문자열이면 기본 문구로 fallback(의미 없는 빈 메시지 방지).
  emptyMessage?: string;
  // 수집 대상 삭제 콜백(선택, T-1828) — 주어졌을 때만 각 행에 삭제 버튼을 렌더하고 클릭 시
  // row.id 로 호출한다. 미전달 시 버튼 미렌더(읽기 전용 하위 호환 — T-1825 마운트가 글자
  // 그대로 보존된다. PersonList onDelete 동형). 실 DELETE 요청 · in-flight · 오류 문구 ·
  // 확인 대화상자는 상위 컨테이너 몫이라 본 컴포넌트는 presentational 책임(콜백 호출)만 진다.
  onDelete?: (id: string) => void;
  // 활성/비활성 토글 콜백(선택, T-1829) — 주어졌을 때만 각 행에 토글 버튼을 렌더하고 클릭 시
  // `(row.id, 다음 상태)` 로 호출한다. **다음 상태를 함께 넘기는 것** 이 계약의 핵심이다 —
  // 호출부(컨테이너 러너)가 현재 상태를 다시 계산하지 않아도 PATCH body 를 그대로 만들 수 있고,
  // 목록이 보고 있는 행 상태와 요청이 어긋날 여지가 없다. 미전달 시 버튼 미렌더(하위 호환 —
  // non-Admin 마운트). 실 PATCH · in-flight · 오류 문구는 상위 컨테이너 몫이다(onDelete 동형).
  onToggleActive?: (id: string, nextActive: boolean) => void;
  // ── 값 편집(endpoint) 축 controlled props (선택, T-1831) ──────────────────────
  // 전부 optional 이라 하나도 주지 않으면 렌더·동작이 종전과 글자 그대로 같다(선행 slice 회귀 0).
  // 편집 진입 콜백 — 주어졌을 때만 각 행에 "편집" 버튼을 렌더하고, 클릭 시 `(row.id, 현재
  // endpoint)` 2 인자로 호출한다. **현재 값을 함께 넘기는 것** 이 계약의 핵심이다(onToggleActive
  // 의 "다음 상태 동봉" 과 동형) — 컨테이너가 목록을 다시 뒤져 prefill 값을 계산하지 않아도 되고,
  // 화면이 보고 있는 값과 편집 시작 값이 어긋날 여지가 없다.
  onEditStart?: (id: string, currentEndpoint: string) => void;
  // 현재 편집 중인 행 id — 이 값과 `row.id` 가 같은 행에서만 인라인 폼을 렌더한다(그 외 행은
  // 종전대로 "편집" 버튼). 컨테이너 소유 state 라 목록은 값을 보관하지 않는다.
  editingId?: string;
  // 편집 입력의 controlled 값 — 컨테이너 state 를 그대로 표시한다(목록은 입력을 보관하지 않는다).
  editEndpoint?: string;
  // 입력 변경 콜백 — 변경된 문자열을 그대로 넘긴다(trim·검증은 컨테이너 러너 몫).
  onEditEndpointChange?: (next: string) => void;
  // 저장 콜백 — 클릭 시 `row.id` 로 호출한다(실 PATCH·진행 상태·오류 문구는 컨테이너 몫).
  onEditSubmit?: (id: string) => void;
  // 취소 콜백 — 편집 state 를 비우는 것은 컨테이너 책임이라 인자 없이 호출한다.
  onEditCancel?: () => void;
  // 저장 in-flight 플래그 — true 면 저장 버튼을 disabled 로 두어 이중 발사를 화면에서도 막는다
  // (러너의 in-flight 가드와 이중 방어). 취소는 잠그지 않는다(막힌 사용자가 빠져나갈 길 보존).
  editBusy?: boolean;
}

// 수집 대상 목록. 분기 순서는 선례와 동일하게 loading → error → empty → populated 로 고정한다
// (각 분기 근거는 아래 주석 참조).
function CollectionTargetList({
  targets,
  loading,
  error,
  emptyMessage,
  onDelete,
  onToggleActive,
  onEditStart,
  editingId,
  editEndpoint,
  onEditEndpointChange,
  onEditSubmit,
  onEditCancel,
  editBusy,
}: CollectionTargetListProps) {
  // [1] loading 우선 — 조회가 진행 중이면 직전 error 나 잔여 targets 가 남아 있어도 그것을
  // 현재 사실처럼 보여줘선 안 되므로 로딩 표시만 렌더한다.
  if (loading === true) {
    return <div role="status">{LOADING_TEXT}</div>;
  }

  // [2] error — 조회가 실패했으면 "대상이 없음"과 "불러오지 못함"을 구분해야 하므로 목록 대신
  // alert 영역만 렌더한다. 빈 문자열 error 는 falsy 라 본 분기로 진입하지 않는다(경계값).
  if (error) {
    return <div role="alert">{error}</div>;
  }

  // [3] empty — 조회는 성공했으나 행이 0 개인 정상 상태다(controller 계약상 row 0 개면 빈 배열).
  // 빈 <ul> 대신 안내 문구를 렌더하고, 빈 문자열 emptyMessage 는 기본 문구로 fallback 한다.
  if (targets.length === 0) {
    const text = emptyMessage ? emptyMessage : DEFAULT_EMPTY_MESSAGE;
    return <div role="status">{text}</div>;
  }

  // [4] populated — props 배열 순서를 그대로 보존해 행마다 type·instanceKey·endpoint·active
  // 4 축을 표시한다. 배열 3 종은 값이 있을 때만 접어 덧붙인다.
  return (
    <ul>
      {targets.map((row) => {
        const orgs = formatScope(row.orgs);
        const repos = formatScope(row.repos);
        const spaces = formatScope(row.spaces);
        // 행의 현재 활성 여부(T-1829) — 비활성 표식 분기와 토글 라벨·다음 상태가 **같은 기준**을
        // 쓰도록 한 번만 계산한다(표식은 비활성인데 라벨은 활성인 어긋남 0).
        const active = isRowActive(row);
        // 이 행이 편집 중인가(T-1831) — `editingId` 가 없거나 다른 행을 가리키면 false 라
        // 폼은 정확히 한 행에만 뜬다. 편집 진입점(onEditStart) 이 없어도 편집 중일 수는 있어
        // 두 조건을 독립으로 둔다(컨테이너가 진입점을 내리는 조건과 폼 표시 조건은 별개).
        const editingRow = editingId !== undefined && editingId === row.id;
        return (
          <li key={row.id}>
            {/* type 은 대상 분류라 항상 표시한다. */}
            <span>{displayText(row.type)}</span>
            {/* instanceKey 는 종류 안에서 유일한 주 라벨이라 항상 표시한다. */}
            <span>{displayText(row.instanceKey)}</span>
            {/* endpoint 누락 row 도 throw 없이 placeholder 로 렌더한다(입력 정상화는 backend
                DTO · 편집 slice 책임 — 목록은 받은 값을 판정하지 않는다). */}
            <span>{displayText(row.endpoint)}</span>
            {/* 배열 3 종은 해당 type 에서만 채워지므로 비어 있으면 아예 렌더하지 않는다 —
                빈 라벨이 모든 행에 붙어 목록이 시끄러워지는 것을 막는다. */}
            {orgs ? <span>{orgs}</span> : null}
            {repos ? <span>{repos}</span> : null}
            {spaces ? <span>{spaces}</span> : null}
            {/* active === false 인 행에만 비활성 표식을 붙인다 — true/누락 행은 활성으로 본다
                (schema 기본값 true 정합). 본 컴포넌트는 값을 교정하지 않고 그대로 반영한다. */}
            {active ? null : <span>{INACTIVE_BADGE_TEXT}</span>}
            {/* onToggleActive 가 주어졌을 때만 활성/비활성 토글 버튼을 렌더한다(T-1829). 라벨은
                현재 상태에서 파생하고, 콜백에는 **다음 상태**(현재의 반대)를 함께 넘긴다 —
                컨테이너 러너가 PATCH `{ active: nextActive }` 를 그대로 조립할 수 있게 하려는
                것이다. 삭제 버튼 앞에 두어 되돌릴 수 있는 동작이 파괴적 동작보다 먼저 오게 한다. */}
            {/* 값 편집 축(T-1831) — 편집 중인 행에는 인라인 입력 + 저장/취소를, 그 외 행에는
                onEditStart 가 주어졌을 때만 "편집" 버튼을 렌더한다. 진입 버튼과 폼이 한 행에
                동시에 뜨지 않도록 삼항으로 배타 분기한다. 요청·진행 상태·오류 문구는 여전히
                컨테이너 몫이라 여기서는 controlled 값 표시와 콜백 호출만 한다. */}
            {editingRow ? (
              <>
                <input
                  aria-label={EDIT_INPUT_LABEL}
                  value={editEndpoint ?? ''}
                  onChange={(e) => onEditEndpointChange?.(e.target.value)}
                />
                {/* 저장 — editBusy 면 disabled 로 이중 발사를 화면에서도 막는다. */}
                <button
                  type="button"
                  disabled={editBusy === true}
                  onClick={() => onEditSubmit?.(row.id)}
                >
                  {SAVE_LABEL}
                </button>
                {/* 취소 — 진행 중에도 잠그지 않는다(사용자가 빠져나갈 길 보존). */}
                <button type="button" onClick={() => onEditCancel?.()}>
                  {CANCEL_LABEL}
                </button>
              </>
            ) : onEditStart ? (
              /* 편집 진입 — 현재 endpoint 를 함께 넘겨 컨테이너가 prefill 을 다시 계산하지
                 않게 한다(onToggleActive 의 "다음 상태 동봉" 계약과 동형). */
              <button
                type="button"
                onClick={() => onEditStart(row.id, row.endpoint)}
              >
                {EDIT_LABEL}
              </button>
            ) : null}
            {onToggleActive ? (
              <button
                type="button"
                onClick={() => onToggleActive(row.id, !active)}
              >
                {active ? DEACTIVATE_LABEL : ACTIVATE_LABEL}
              </button>
            ) : null}
            {/* onDelete 가 주어졌을 때만 삭제 버튼을 렌더하고 클릭 시 row.id 로 콜백 호출한다
                (T-1828). 확인 대화상자 · 요청 · 진행 상태는 일체 갖지 않는다 — 상위 컨테이너의
                러너가 in-flight 가드와 오류 표면화를 책임진다(파일 머리 경계 서술과 정합). */}
            {onDelete ? (
              <button type="button" onClick={() => onDelete(row.id)}>
                {DELETE_LABEL}
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

// export convention 은 LlmProviderConfigList 승계 — row 타입 정본과 props 타입은 named type
// export, 컴포넌트는 default export.
export type { CollectionTargetRow, CollectionTargetListProps };
export default CollectionTargetList;
