// AdminView 의 렌더 비의존 정적 표면(T-1882 순수 추출) — 문구 · DOM id 상수 군과 폼 옵션 ·
// in-flight 게이트 축을 담는 모듈. PLAN 183 행 god component 부채의 열일곱째 실분할이며, 본
// 모듈의 심볼은 AdminView.tsx 에서 **본문 한 줄도 바꾸지 않고** 선행 주석까지 통째로 옮겨온
// 것이다(동작 · 계약 · 값 무변경 — 각 선언 앞에 `export` 만 붙였다). 각 선언 위 주석 블록은 그
// 문구 · 옵션이 존재하는 이유의 정본이라 함께 옮겼다. 배치를 web/src/views/ 아래로 잡은 이유는
// 이동 블록의 상대 import 경로(`../components/...`)가 그대로 유효해 본문 재작성이 0 이 되기
// 때문이다. JSX 가 없으므로 확장자는 .ts 다.
//
// 소유 범위: 렌더에 의존하지 않는 정적 표면만 담는다 — (a) 섹션 heading · 빈 상태 · 권한 안내
// 문구, (b) aria-describedby 가 가리키는 DOM id, (c) <select> 옵션 배열과 그 항목 타입,
// (d) 진행 중 id 를 읽고 쓰는 gate 계약과 그 팩토리. 컴포넌트 계약에 밀착한 MeRow ·
// AdminViewProps · isAdminRole 은 AdminView 에 잔류한다(옮기면 역방향 import 위험).
//
// AdminView 와의 방향: AdminView → 본 모듈(값 의존) 의 **단방향** import 만 만든다. 본 모듈은
// AdminView 를 import 하지 않는다(역방향이 필요해지면 이동 범위를 잘못 잡았다는 신호 — 범위를
// 넓히지 말고 Follow-ups 로 남긴다). AdminView 파일 끝 export 배럴은 이동 전 공개 표면
// (resolveProviderSelectValue · LLM_PROVIDER_OPTIONS · createInFlightIdGate · InFlightIdGate)
// 을 그대로 re-export 하므로 기존 spec 의 `from './AdminView'` 는 무수정으로 산다.

import type { ReEvaluationWindow } from '../components/ReEvaluationTriggerPanel';
// T-1904 (REQ-080) — 섹션 탭 항목 계약 타입. T-1903 이 고정한 component 표면을 소비만 하며
// type-only 라 런타임 의존 0 이다(AdminView import 0 인 단방향 규약 유지).
import type { AdminSectionDescriptor } from '../components/AdminSectionNav';


// 인원 관리 섹션 heading 문구(T-1142) — 기존 패널들과 시각적으로 구분되는 별도 섹션의 제목.
// §12 한국어. aria-label 겸 <h2> 로 재사용해 보조기술이 섹션 경계를 인식하게 한다.
export const PERSON_HEADING = '인원 관리';

// 휴직 인원 포함 토글의 접근 가능한 이름(T-1804) — checkbox 의 aria-label 겸 시각 label 문구로
// 재사용해 보조기술과 눈으로 보는 사람이 같은 문구를 읽게 한다(§12 한국어).
export const PERSON_INCLUDE_INACTIVE_LABEL = '휴직 인원 포함';

// 그룹 관리 섹션 heading 문구(T-1146) — 그룹 생성 폼을 담는 별도 섹션의 제목(PERSON_HEADING 동형).
// §12 한국어. aria-label 겸 <h2> 로 재사용해 보조기술이 섹션 경계를 인식하게 한다.
export const GROUP_HEADING = '그룹 관리';

// 파트 관리 섹션 heading 문구(T-1152) — 파트 목록을 담는 별도 섹션의 제목(GROUP_HEADING 동형).
// §12 한국어. aria-label 겸 <h2> 로 재사용해 보조기술이 섹션 경계를 인식하게 한다.
export const PART_HEADING = '파트 관리';

// 사용자 관리 섹션 heading 문구(T-1159) — 사용자 목록을 담는 별도 섹션의 제목(PART_HEADING 동형).
// §12 한국어. <h2> 로 렌더하며, 섹션 aria-label 은 다른 섹션과 구분되도록 "… 섹션" 접미를 붙인다.
export const USER_HEADING = '사용자 관리';

// 수집 대상 관리 섹션 heading 문구(T-1825) — 수집 대상 목록을 담는 별도 섹션의 제목
// (USER_HEADING 동형). §12 한국어. aria-label 겸 <h2> 로 재사용해 보조기술이 섹션 경계를
// 인식하게 한다.
export const COLLECTION_TARGET_HEADING = '수집 대상 관리';

// 수집 대상이 0 건일 때의 빈 상태 문구(T-1825, REQ-070) — "빈 상태에서 막히지 않게" 라는
// REQ-070 의도를 살려, 목록이 비어 있는 것이 오류가 아니라 아직 등록이 없다는 정상 상태임을
// 한국어로 명시한다(EMPTY_PART_PERSON_TEXT 동형 convention).
export const EMPTY_COLLECTION_TARGET_TEXT = '등록된 수집 대상이 없습니다';

// 사용자 추가 폼 조건 안내 <p> 의 고유 DOM id(T-1711, REQ-067) — 대응 입력의 aria-describedby 가
// 이 값을 가리켜 스크린리더에서도 입력 전에 조건이 함께 읽힌다. 문구 본문은 SuperAdmin 셋업 폼과
// 공유하지만 id 는 화면별로 분리한다(같은 문서에 동시 존재하지 않더라도 화면마다 고유 id 유지 —
// SuperAdminSetupForm 의 superadmin-setup-* id 와 값이 겹치지 않게 admin-create-user-* 접두).
export const CREATE_USER_EMAIL_HINT_ID = 'admin-create-user-email-hint';
export const CREATE_USER_PASSWORD_HINT_ID = 'admin-create-user-password-hint';

// 인스턴스 접근 대상 select 의 빈 선택지 라벨(T-1166). 같은 자리에 있던 부여·회수 안내 문구 2 종과
// 역할 변경 403 문구는 러너와 함께 adminUserMutationRunners 로 옮겼고(T-1873 순수 추출), markup 이
// 직접 소비하는 이 라벨만 잔류한다.
export const INSTANCE_ACCESS_NO_USER_LABEL = '사용자를 선택하세요'; // 대상 select 빈 선택지.

// 파트 선택 <select> 의 빈 선택지 라벨(T-1156) — selectedPartId 미선택 시 첫 옵션으로 노출한다
// (그룹의 NO_SELECTION_LABEL 동형이되 파트 전용 문구로 분리 — 두 select 를 화면·test 에서 구분).
export const PART_NO_SELECTION_LABEL = '파트를 선택하세요';

// 파트 미선택 시 소속 인원 목록 자리에 노출할 안내 문구(T-1156) — NO_GROUP_SELECTED_TEXT 동형.
// 미선택은 "조회 결과 0" 이 아니라 "아직 조회하지 않음"(useApiResource 미조회 idle)이므로 인원 0
// 문구와 구분되는 별도 안내를 쓴다(사용자가 다음 행동을 알 수 있게). §12 한국어.
export const NO_PART_SELECTED_TEXT = '파트를 선택하면 소속 인원을 표시합니다';

// 파트를 선택했으나 소속 인원이 0 인 경우의 빈 상태 문구(T-1156) — backend 는 Part 가 존재하고
// 인원이 0 이면 200 + 빈 배열을 반환한다(part.controller findPersons). 위 미선택 안내와 구분해,
// "조회는 했고 결과가 비었다" 를 명시한다. §12 한국어.
export const EMPTY_PART_PERSON_TEXT = '이 파트에 속한 인원이 없습니다';

// 현재 사용자 등급 조회 path — 고정 endpoint(GET /api/auth/me, api.md 71 User+, JwtAuthGuard
// 단독). 응답 5 필드 `{ id, email, role, createdAt, updatedAt }` 중 본 slice 는 role 만
// 소비한다(④h). User+ 라 인증된 사용자는 403 없이 자기 등급을 받는다(미인증은 AuthGate 가
// 이미 차단). 본 slice 가 추가하는 네 번째 useApiResource 호출의 path.
export const AUTH_ME_PATH = '/api/auth/me';

// 권한 부족 안내 문구(④h) — 비-Admin(또는 등급 불명/조회 중) 사용자에게 Admin 전용 패널 대신
// 보여줄 사람-친화 한국어 한 줄. role="status" 로 렌더해 보조기술이 상태로 인식하게 한다.
export const NOT_ADMIN_NOTICE_TEXT = 'Admin 권한이 필요한 기능입니다 (현재 등급으로는 표시되지 않습니다)';

// service identity 쓰기 축 전용 권한 안내 문구(T-1778) — ADR-0058 §Decision 4 가 추가 · 수정 ·
// 삭제 · primary 지정을 Admin+ 로 못 박았으므로, 비-Admin(또는 등급 불명/조회 중)에게는 쓰기
// 컨트롤 대신 이 한 줄만 보여준다(fail-closed). 위 NOT_ADMIN_NOTICE_TEXT 를 재사용하지 않는 것은
// 한 화면에 같은 문구가 두 번 뜨면 어느 패널 이야기인지 사람도 spec 도 구분할 수 없기 때문이다.
export const SERVICE_IDENTITY_NOT_ADMIN_NOTICE_TEXT =
  'service identity 편집은 Admin 권한이 필요합니다 (조회만 가능합니다)';

// export scope 선택 옵션 — frontend-local 보수 후보 목록(④g). api.md 122 가 scope 의 enum
// 값/기본값을 명시하지 않으므로, 빈 선택(전체 = query 미부착, ④f 동작 유지) + 의미 있는 보편
// 후보(평가 자료 export 의 자연스러운 범위 분할 — 평가 결과/문항/인원)를 둔다. backend 가
// 지원하는 확정 scope enum 정합(또는 동적 scope 목록 fetch)은 후속(Out of Scope — backend
// export controller 계약 확인 후). value 는 backend query 값, label 은 사람-친화 한국어.
export interface ScopeOption {
  // backend 에 부착할 scope query 값. 빈 문자열이면 query 미부착(전체).
  value: string;
  // <select> 옵션에 노출할 사람-친화 한국어 라벨.
  label: string;
}
export const EXPORT_SCOPE_OPTIONS: ScopeOption[] = [
  { value: '', label: '전체' },
  { value: 'assessments', label: '평가 결과' },
  { value: 'questions', label: '문항' },
  { value: 'persons', label: '인원' },
];

// LLM provider 생성·수정 폼의 <select> 옵션(T-1138) — canonical source 는 server 의
// `src/llm/llm-gateway.interface.ts` 의 `LlmProvider` enum 5 멤버(R-99~103,
// custom/azure_openai/anthropic/google_gemini/openai). web 은 별도 SPA 빌드라 server
// 코드를 import 하지 않고(Required Reading — 읽기 전용 참조), 동일 snake_case 식별자를
// frontend-local 상수로 재정의해 동기 유지한다. server enum 값이 바뀌면 본 배열도 함께
// 갱신해야 한다(수동 동기 — import 불가 trade-off). value 는 backend body 로 그대로 보낼
// canonical 식별자, label 은 사람-친화 표기. placeholder(빈 value) 는 컨테이너가 선두에
// 배치해 미선택 시 생성/수정 가드에 걸리게 한다(본 상수는 실 provider 만 담는다).
export interface LlmProviderOption {
  // backend 로 전송할 canonical provider 식별자(snake_case, LlmProvider enum 값 그대로).
  value: string;
  // <select> 옵션에 노출할 사람-친화 라벨.
  label: string;
}
export const LLM_PROVIDER_OPTIONS: LlmProviderOption[] = [
  { value: 'custom', label: 'custom (OpenAI 호환)' },
  { value: 'azure_openai', label: 'azure_openai (Azure OpenAI)' },
  { value: 'anthropic', label: 'anthropic (Anthropic)' },
  { value: 'google_gemini', label: 'google_gemini (Google Gemini)' },
  { value: 'openai', label: 'openai (OpenAI)' },
];
// provider <select> 의 placeholder(빈 value) 라벨 — 미선택 상태를 나타낸다. 선택 시 빈
// value 라 생성/수정 가드(trim 후 빈 문자열 차단)가 그대로 발화한다.
export const LLM_PROVIDER_PLACEHOLDER_LABEL = 'provider 선택';

// provider <select> 의 controlled value 를 결정하는 순수 helper(T-1138). 인자가 5-provider
// 목록(LLM_PROVIDER_OPTIONS)의 값 중 하나면 그대로(그 option 선택), 아니면 빈 문자열(placeholder
// fallback)을 반환한다. 수정 폼이 편집 대상 row 의 provider 값으로 prefill 될 때, 지원 목록에
// 없는 레거시/비정상 값(예: 과거 free-text 로 저장된 값)이면 placeholder 로 안전 fallback 하기
// 위한 분기 로직을 JSX 밖으로 분리해 jsdom 없이 직접 단위 검증할 수 있게 한다(deriveProviders /
// buildExportPath 등 순수 helper convention 정합). 생성 폼은 providerInput 이 항상 select 로만
// 세팅돼 이 helper 없이도 안전하나, 계약 일관성을 위해 동일 helper 로 좁힐 수 있다.
export function resolveProviderSelectValue(value: string | undefined): string {
  if (value && LLM_PROVIDER_OPTIONS.some((option) => option.value === value)) {
    return value;
  }
  return '';
}

// 재수집 window 후보 목록(frontend-local 상수, T-0886 — EXPORT_SCOPE_OPTIONS 동형). 선택 가능한
// 최근 N일 재수집 기간(예: 최근 1일/1주/30일). backend 는 body.days 로 받는다(RecentDeletionDto 의
// 선택 양수 정수 days). days 는 backend body 값이자 panel selectedDays 매칭 값, label 은 사람-친화
// 한국어. api 계약에 window enum 이 없으므로(days 자유 정수) 보편 후보를 frontend-local 로 둔다.
export const REEVAL_WINDOW_OPTIONS: ReEvaluationWindow[] = [
  { days: 1, label: '최근 1일' },
  { days: 7, label: '최근 1주' },
  { days: 30, label: '최근 30일' },
];
// 재평가 person 선택 <select> 의 빈 선택지 라벨 — selectedPersonId 미선택 시 첫 옵션으로 노출한다.
export const NO_PERSON_SELECTION_LABEL = '인원을 선택하세요';

// 그룹 미선택 시 멤버 패널에 노출할 안내 문구 — 그룹을 고르면 그 멤버가 표시됨을 안내한다.
export const NO_GROUP_SELECTED_TEXT = '그룹을 선택하면 인원이 표시됩니다';
// 그룹 선택 <select> 의 빈 선택지 라벨 — selectedGroupId 미선택 시 첫 옵션으로 노출한다.
export const NO_SELECTION_LABEL = '그룹을 선택하세요';
// 선택 그룹에 멤버가 없을 때 GroupMemberList 에 내려보낼 빈 상태 문구.
export const EMPTY_MEMBER_TEXT = '이 그룹에 속한 인원이 없습니다';
// 그룹 이름 누락 시 <select> 옵션에 노출할 fallback 라벨.
export const FALLBACK_GROUP_NAME = '이름 없는 그룹';

// 진행 중인 id 를 읽고 쓰는 gate(T-1165). 위 러너에 주입되는 changingId 의 "출처" 만 바꾸는
// 장치이며 러너 본체·ChangeRoleDeps 계약은 무변경이다.
export interface InFlightIdGate {
  // 가드가 참조할 현재 진행 id — 호출 시점 값(render 시점 캡처 값이 아니다).
  read: () => string | undefined;
  // 진행 id 갱신 — ref 동기 반영이 먼저, 렌더 표면 state 갱신이 뒤다(순서가 계약).
  write: (next: string | undefined) => void;
}

// (a) 결함: 진행 id 를 useState 로만 들면 setState 가 비동기 re-render 뒤에야 새 closure 를
// 만들어, 첫 클릭 직후 re-render 전에 들어온 두 번째 클릭이 여전히 stale 한 undefined 를 읽고
// PATCH 를 2회 발사한다(단일 in-flight 정책이 새는 창).
// (b) 그래서 가드 읽기는 ref(동기 반영), 렌더 표면은 state(리렌더 트리거)로 이중 보관한다 — ref 는
// 렌더를 트리거하지 않아 state 를 대체할 수 없고, state 는 동기 반영이 안 돼 가드를 대체할 수 없다.
export function createInFlightIdGate(
  ref: { current: string | undefined },
  setState: (next: string | undefined) => void,
): InFlightIdGate {
  return {
    // 항상 ref 의 현재 값을 그대로 돌려준다(같은 tick 의 두 번째 호출도 방금 켜진 값을 본다).
    read: () => ref.current,
    // ref 를 먼저 동기 갱신해야 위 창이 닫힌다. setState 는 진행 표면 렌더용으로 뒤이어 호출한다.
    write: (next: string | undefined) => {
      ref.current = next;
      setState(next);
    },
  };
}

// T-1904 (REQ-080) — AdminView 섹션 anchor DOM id 5 종. AdminSectionNav 의 항목 id 이자 대상
// <section> 의 id 로 **양쪽에서 같은 상수** 를 쓰게 해 두 곳이 어긋날 여지를 없앤다. 값은
// admin-section-* 접두 규약을 따른다(CREATE_USER_*_HINT_ID 동형 — 화면별 접두로 충돌 회피).
export const ADMIN_SECTION_USERS_ID = 'admin-section-users';
export const ADMIN_SECTION_PERSONS_ID = 'admin-section-persons';
export const ADMIN_SECTION_GROUPS_ID = 'admin-section-groups';
export const ADMIN_SECTION_PARTS_ID = 'admin-section-parts';
export const ADMIN_SECTION_COLLECTION_TARGETS_ID = 'admin-section-collection-targets';

// 섹션 탭 목록 조립(순수, T-1904) — 라벨은 위 heading 상수를 **재사용** 해 탭 문구와 <h2> 문구가
// 구조적으로 같은 값이 되게 한다(새 문구 상수 0 = drift 원천 0). 반환 순서는 AdminView 실제 렌더
// 순서(사용자 → 인원 → 그룹 → 파트 → 수집 대상)와 같다. isAdmin === false 이면 사용자 섹션이
// gating 안쪽에만 마운트돼 DOM 에 없으므로 그 탭을 빼 죽은 탭을 만들지 않는다(fail-closed).
export function buildAdminSectionDescriptors(
  isAdmin: boolean,
): AdminSectionDescriptor[] {
  const always = [
    { id: ADMIN_SECTION_PERSONS_ID, label: PERSON_HEADING },
    { id: ADMIN_SECTION_GROUPS_ID, label: GROUP_HEADING },
    { id: ADMIN_SECTION_PARTS_ID, label: PART_HEADING },
    { id: ADMIN_SECTION_COLLECTION_TARGETS_ID, label: COLLECTION_TARGET_HEADING },
  ];
  return isAdmin
    ? [{ id: ADMIN_SECTION_USERS_ID, label: USER_HEADING }, ...always]
    : always;
}
