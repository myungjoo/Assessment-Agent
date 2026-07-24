// P6 composition wiring ④a (T-0385, ADR-0041 Decision 1·3·5) — Admin 화면 컨테이너 shell.
// controlled lift-up: 본 컨테이너가 데이터(GET /api/groups)·loading/error·선택 그룹 상태를
// useState/useApiResource 로 소유하고, presentational GroupMemberList 는 props 로만 소비한다
// — 컴포넌트 수정 0 (ADR-0041 Decision 1 경계). 새 dependency 0 — react hooks +
// 기존 useApiResource(apiClient fetch) 경유만 (ADR-0040 §5 게이트, axios/react-query 미도입).
//
// 책임 경계(④a): 그룹 목록 조회(GET /api/groups, User+, api.md 81) + 그룹 선택 <select> +
// 선택 그룹의 멤버 파생 → GroupMemberList 첫 패널 배선까지. 나머지 4 패널
// (DifficultyModelSelector·ReEvaluationTriggerPanel·DataImportExportPanel·SchedulePanel)
// 배선 + 멤버 추가/제거 mutation(onRemove) + Admin+ RBAC gating UI 는 ④b/④c Out of Scope.
//
// 멤버 데이터 출처(api.md 81 응답 형태 확인 결과): api.md 는 GET /api/groups 를 "임의 group
// 목록(REQ-028)" 으로만 기술하고 group row 가 멤버 배열을 포함하는지 명시하지 않는다. 따라서
// 본 slice 는 group row 에 members 필드가 "있으면" 그것을 client-side 로 파생해 표시하고,
// 없으면 빈 배열(빈 상태) 로 안전 표시한다 — 별도 GET /api/groups/:id/members 신규 fetch 는
// ④b Out of Scope(본 컨테이너는 useApiResource 를 그룹 목록 조회에 단 한 번만 호출한다).

import { useCallback, useMemo, useRef, useState } from 'react';
import { useApiResource, toErrorMessage } from '../api/useApiResource';
import { request, requestRaw, ApiError } from '../api/apiClient';
import type { RequestOptions } from '../api/apiClient';
import GroupMemberList from '../components/GroupMemberList';
import type { Member } from '../components/GroupMemberList';
import DifficultyModelSelector from '../components/DifficultyModelSelector';
import type {
  ProviderOption,
  Difficulty,
} from '../components/DifficultyModelSelector';
// P6 wiring ④d (T-0388) — 세 번째 패널 DataImportExportPanel export 배선. presentational
// 컴포넌트는 수정 0 으로 named import 만(ADR-0041 Decision 1 — 패널은 fetch 를 모른다).
import DataImportExportPanel from '../components/DataImportExportPanel';
import type { DataImportExportPanelProps } from '../components/DataImportExportPanel';
// T-1134 — R-96 LLM provider 관리 UI 마운트. 직전 slice(T-1133)가 신설한 순수 presentational
// LlmProviderConfigList 를 Admin+ 패널에 배선한다. 컴포넌트 수정 0 으로 default import + named
// type 만(ADR-0041 Decision 1 — 패널은 fetch 를 모른다). 기존 providerData 재사용(새 fetch 0).
import LlmProviderConfigList from '../components/LlmProviderConfigList';
import type { LlmProviderConfigRow } from '../components/LlmProviderConfigList';
// T-0885 — P6 deferred wiring 재개(PLAN line120/123). 다섯 번째 패널 SchedulePanel export
// 배선. presentational 컴포넌트는 수정 0 으로 default import 만(ADR-0041 Decision 1 — 패널은
// fetch 를 모른다). backend 계약(P7 @Controller("api/schedules"), ADR-0042)이 shipped 되어
// defer 사유 해소.
import SchedulePanel from '../components/SchedulePanel';
// T-0886 — P6 deferred wiring 완결(PLAN line120/123). 여섯 번째 패널 ReEvaluationTriggerPanel
// export 배선. presentational 컴포넌트는 수정 0 으로 default import 만(ADR-0041 Decision 1 —
// 패널은 fetch 를 모른다). backend 계약(POST /api/schedules/recent-deletion/:personId, Admin+,
// ADR-0038 reeval chain / RecentDeletionController)이 shipped 되어 defer 사유 해소. T-0885
// (SchedulePanel) 의 짝.
import ReEvaluationTriggerPanel from '../components/ReEvaluationTriggerPanel';
import type { ReEvaluationWindow } from '../components/ReEvaluationTriggerPanel';
// T-1142 — P6 line120 Admin "인원(Person)" 관리 UI 마운트. 직전 slice(T-1141)가 신설한 순수
// presentational PersonList 를 AdminView 에 배선한다. 컴포넌트 수정 0 으로 default import +
// named type(PersonRow)만(ADR-0041 Decision 1 — 패널은 fetch 를 모른다). 실 fetch(GET
// /api/persons)는 아래 useApiResource 로 컨테이너가 소유하고, data/loading/error 를 props 로만
// 내려보낸다(T-1140 DashboardView 마운트 패턴 mirror — 읽기 전용, mutation/nonce 불요).
import PersonList from '../components/PersonList';
import type { PersonRow } from '../components/PersonList';
// 그룹 목록 마운트 대상(T-1148, T-1147 presentational) — default export 만 가져온다. GroupList 도
// 자체 GroupRow 를 named export 하지만 여기서는 import 하지 않고 AdminView 로컬 GroupRow(L327)를
// 그대로 props 로 넘긴다(구조적 타입 호환 — 중복 식별자·이름 충돌 회피, task Required Reading).
import GroupList from '../components/GroupList';
// 파트 목록 마운트 대상(T-1152, T-1151 presentational) — default PartList 와 named PartRow 타입을
// 함께 가져온다. AdminView 에는 로컬 PartRow 가 없어(파트 미조회) GroupRow 때와 달리 이름 충돌이
// 없으므로 named PartRow 를 그대로 조회 제네릭·props 타입에 재사용한다(task Required Reading).
import PartList from '../components/PartList';
import type { PartRow } from '../components/PartList';
// 사용자 목록 마운트 대상(T-1159, T-1158 presentational) — default UserList 와 named UserRow 타입을
// 함께 가져온다. AdminView 에는 로컬 UserRow 가 없어(사용자 미조회) 이름 충돌이 없으므로 named
// UserRow 를 그대로 조회 제네릭·props 타입에 재사용한다(PartRow 차용 convention 동형).
import UserList from '../components/UserList';
import type { UserRow } from '../components/UserList';

// 그룹 목록 조회 path — 고정 endpoint(GET /api/groups, api.md 81 User+). personId 같은
// 필수 query 가 없어 무조건 조회한다(미인증은 AuthGate 가 이미 차단). DashboardView 의
// path 파생 helper 규약과 정합하게 상수로 둔다(조건부 가드 불요 — null 분기 없음).
const GROUPS_PATH = '/api/groups';

// 인원(Person) 목록 조회 base path — 고정 endpoint(GET /api/persons, active 인원 Person[] 반환,
// PersonController T-0036). personId 같은 필수 query 가 없어 무조건 조회한다(미인증은 AuthGate
// 가 이미 차단). T-1143 부터 인원 생성 POST 성공 시 권위 재조회를 유발해야 하므로, 고정 상수
// 대신 buildPersonsPath(refreshNonce) nonce-aware 빌더의 base 로 쓴다(buildProvidersPath 동형).
const PERSONS_PATH = '/api/persons';

// 인원 관리 섹션 heading 문구(T-1142) — 기존 패널들과 시각적으로 구분되는 별도 섹션의 제목.
// §12 한국어. aria-label 겸 <h2> 로 재사용해 보조기술이 섹션 경계를 인식하게 한다.
const PERSON_HEADING = '인원 관리';

// 그룹 관리 섹션 heading 문구(T-1146) — 그룹 생성 폼을 담는 별도 섹션의 제목(PERSON_HEADING 동형).
// §12 한국어. aria-label 겸 <h2> 로 재사용해 보조기술이 섹션 경계를 인식하게 한다.
const GROUP_HEADING = '그룹 관리';

// 파트 조회 path — 고정 endpoint(GET /api/parts, part.controller @Get() 파트 배열 반환). 그룹과
// 달리 AdminView 는 파트를 전혀 조회하지 않아 재사용할 fetch 가 없으므로 신규 상수로 둔다. 파트
// 생성 slice 가 아직 없어 refresh nonce 빌더 없이 단순 상수 path 로 조회한다(SCHEDULES_PATH 동형 —
// nonce-aware buildPartsPath 전환은 후속 create slice 책임). personId 같은 필수 query 없음.
const PARTS_PATH = '/api/parts';

// 파트 관리 섹션 heading 문구(T-1152) — 파트 목록을 담는 별도 섹션의 제목(GROUP_HEADING 동형).
// §12 한국어. aria-label 겸 <h2> 로 재사용해 보조기술이 섹션 경계를 인식하게 한다.
const PART_HEADING = '파트 관리';

// 사용자 조회 path(T-1159) — 고정 endpoint(GET /api/users, user.controller @Get() 이 Admin+ RBAC
// 로 UserResponseDto[] 를 envelope 없이 직반환). AdminView 는 사용자를 전혀 조회하지 않아 재사용할
// fetch 가 없으므로 신규 상수로 둔다. 생성·역할 변경 slice 가 아직 없어 refresh nonce 빌더 없이
// 단순 상수 path 로 조회한다(PARTS_PATH 동형 — nonce-aware buildUsersPath 전환은 후속 mutation
// slice 책임). personId 같은 필수 query 없음.
const USERS_PATH = '/api/users';

// 사용자 관리 섹션 heading 문구(T-1159) — 사용자 목록을 담는 별도 섹션의 제목(PART_HEADING 동형).
// §12 한국어. <h2> 로 렌더하며, 섹션 aria-label 은 다른 섹션과 구분되도록 "… 섹션" 접미를 붙인다.
const USER_HEADING = '사용자 관리';

// 사용자 생성 409(중복 이메일) 전용 문구(T-1160 — PART_DUPLICATE_ERROR mirror. User.email @unique).
const USER_DUPLICATE_ERROR = '이미 존재하는 이메일입니다';

// 역할 변경 403(권한 부족) 전용 문구(T-1162 — USER_DUPLICATE_ERROR 동형). PATCH /api/users/:id/role
// 은 @Roles("SuperAdmin") 이라 비-SuperAdmin actor 는 403 이 확정이다. UI 는 SuperAdmin 에게만
// 콜백을 내려 사전 차단하지만(gating), 등급 stale·backend self-demote 금지 같은 잔여 403 은
// "HTTP 403: …" 일반 문구 대신 원인이 분명한 전용 문구로 표면화한다. §12 한국어.
const USER_ROLE_FORBIDDEN_ERROR = '역할을 변경할 권한이 없습니다';

// 파트 생성 409(중복 이름) 전용 사람-친화 문구(T-1153) — Part.name 은 prisma schema 에서 @unique
// 라 중복 이름 POST 시 PartService.create 가 Prisma P2002 → ConflictException(409) 으로 변환한다.
// 그룹(Group.name @unique 미정의라 409 없음)과 달리 파트는 이 409 를 일반 error 문구("HTTP 409:
// …")가 아니라 원인이 분명한 전용 문구로 표면화해, 사용자가 중복 이름임을 즉시 알고 다른 이름으로
// 재시도하게 한다. §12 한국어. runCreatePart 의 catch 분기가 409 판정 시 이 상수를 error state 로 쓴다.
const PART_DUPLICATE_ERROR = '이미 존재하는 파트 이름입니다';

// 파트 선택 <select> 의 빈 선택지 라벨(T-1156) — selectedPartId 미선택 시 첫 옵션으로 노출한다
// (그룹의 NO_SELECTION_LABEL 동형이되 파트 전용 문구로 분리 — 두 select 를 화면·test 에서 구분).
const PART_NO_SELECTION_LABEL = '파트를 선택하세요';

// 파트 미선택 시 소속 인원 목록 자리에 노출할 안내 문구(T-1156) — NO_GROUP_SELECTED_TEXT 동형.
// 미선택은 "조회 결과 0" 이 아니라 "아직 조회하지 않음"(useApiResource 미조회 idle)이므로 인원 0
// 문구와 구분되는 별도 안내를 쓴다(사용자가 다음 행동을 알 수 있게). §12 한국어.
const NO_PART_SELECTED_TEXT = '파트를 선택하면 소속 인원을 표시합니다';

// 파트를 선택했으나 소속 인원이 0 인 경우의 빈 상태 문구(T-1156) — backend 는 Part 가 존재하고
// 인원이 0 이면 200 + 빈 배열을 반환한다(part.controller findPersons). 위 미선택 안내와 구분해,
// "조회는 했고 결과가 비었다" 를 명시한다. §12 한국어.
const EMPTY_PART_PERSON_TEXT = '이 파트에 속한 인원이 없습니다';

// 현재 사용자 등급 조회 path — 고정 endpoint(GET /api/auth/me, api.md 71 User+, JwtAuthGuard
// 단독). 응답 5 필드 `{ id, email, role, createdAt, updatedAt }` 중 본 slice 는 role 만
// 소비한다(④h). User+ 라 인증된 사용자는 403 없이 자기 등급을 받는다(미인증은 AuthGate 가
// 이미 차단). 본 slice 가 추가하는 네 번째 useApiResource 호출의 path.
const AUTH_ME_PATH = '/api/auth/me';

// 권한 부족 안내 문구(④h) — 비-Admin(또는 등급 불명/조회 중) 사용자에게 Admin 전용 패널 대신
// 보여줄 사람-친화 한국어 한 줄. role="status" 로 렌더해 보조기술이 상태로 인식하게 한다.
const NOT_ADMIN_NOTICE_TEXT = 'Admin 권한이 필요한 기능입니다 (현재 등급으로는 표시되지 않습니다)';

// LLM provider 목록 조회 path — 고정 endpoint(GET /api/llm/providers, api.md 114 Admin+,
// sanitize view 6 필드 id/provider/endpointUrl/modelId/createdAt/updatedAt). Admin+ 라
// User 등급은 403 — 그 403 은 LLM_ERROR_FALLBACK 경로로 error props 안전 표시(throw 없음).
const LLM_PROVIDERS_PATH = '/api/llm/providers';
// 난이도 슬롯 매핑 조회 path — 고정 endpoint(GET /api/llm/difficulty-mappings, api.md 119
// Admin+, 3 난이도 슬롯 배열, 빈 배열 seed 전 정상). Admin+ 라 User 등급은 403.
const LLM_MAPPINGS_PATH = '/api/llm/difficulty-mappings';

// 평가 자료 export path — 고정 endpoint(GET /api/admin/export, api.md 122 Admin+, raw 미포함
// REQ-032·REQ-030). ④g(T-0391)부터 scope 선택 UI 의 선택값을 buildExportPath 로 `?scope=`
// query 에 부착한다 — 빈 선택(전체) 시에는 query 없이 본 상수 그대로 호출(④f 동작 유지 =
// backend 기본 scope 위임). Admin+ 라 User 등급은 403 — 그 403 은 runExport 의 catch 가 error
// props 로 안전 표시(throw 없음).
const ADMIN_EXPORT_PATH = '/api/admin/export';

// export scope 선택 query 키(api.md 122 의 `scope` query). buildExportPath 가 선택값을 이
// 키로 부착한다(`?scope=<선택값>`). backend 가 다른 키를 요구하면 후속 정정(api.md 122 명시 키).
const EXPORT_SCOPE_QUERY_KEY = 'scope';

// export scope 선택 옵션 — frontend-local 보수 후보 목록(④g). api.md 122 가 scope 의 enum
// 값/기본값을 명시하지 않으므로, 빈 선택(전체 = query 미부착, ④f 동작 유지) + 의미 있는 보편
// 후보(평가 자료 export 의 자연스러운 범위 분할 — 평가 결과/문항/인원)를 둔다. backend 가
// 지원하는 확정 scope enum 정합(또는 동적 scope 목록 fetch)은 후속(Out of Scope — backend
// export controller 계약 확인 후). value 는 backend query 값, label 은 사람-친화 한국어.
interface ScopeOption {
  // backend 에 부착할 scope query 값. 빈 문자열이면 query 미부착(전체).
  value: string;
  // <select> 옵션에 노출할 사람-친화 한국어 라벨.
  label: string;
}
const EXPORT_SCOPE_OPTIONS: ScopeOption[] = [
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
interface LlmProviderOption {
  // backend 로 전송할 canonical provider 식별자(snake_case, LlmProvider enum 값 그대로).
  value: string;
  // <select> 옵션에 노출할 사람-친화 라벨.
  label: string;
}
const LLM_PROVIDER_OPTIONS: LlmProviderOption[] = [
  { value: 'custom', label: 'custom (OpenAI 호환)' },
  { value: 'azure_openai', label: 'azure_openai (Azure OpenAI)' },
  { value: 'anthropic', label: 'anthropic (Anthropic)' },
  { value: 'google_gemini', label: 'google_gemini (Google Gemini)' },
  { value: 'openai', label: 'openai (OpenAI)' },
];
// provider <select> 의 placeholder(빈 value) 라벨 — 미선택 상태를 나타낸다. 선택 시 빈
// value 라 생성/수정 가드(trim 후 빈 문자열 차단)가 그대로 발화한다.
const LLM_PROVIDER_PLACEHOLDER_LABEL = 'provider 선택';

// provider <select> 의 controlled value 를 결정하는 순수 helper(T-1138). 인자가 5-provider
// 목록(LLM_PROVIDER_OPTIONS)의 값 중 하나면 그대로(그 option 선택), 아니면 빈 문자열(placeholder
// fallback)을 반환한다. 수정 폼이 편집 대상 row 의 provider 값으로 prefill 될 때, 지원 목록에
// 없는 레거시/비정상 값(예: 과거 free-text 로 저장된 값)이면 placeholder 로 안전 fallback 하기
// 위한 분기 로직을 JSX 밖으로 분리해 jsdom 없이 직접 단위 검증할 수 있게 한다(deriveProviders /
// buildExportPath 등 순수 helper convention 정합). 생성 폼은 providerInput 이 항상 select 로만
// 세팅돼 이 helper 없이도 안전하나, 계약 일관성을 위해 동일 helper 로 좁힐 수 있다.
function resolveProviderSelectValue(value: string | undefined): string {
  if (value && LLM_PROVIDER_OPTIONS.some((option) => option.value === value)) {
    return value;
  }
  return '';
}

// export 성공 시 DataImportExportPanel 의 message props 로 내려보낼 사람-친화 완료 안내.
// ④f(T-0390)부터 응답 Blob 을 실제 파일로 저장(다운로드 트리거)하므로 message 의 의미가
// "호출 성공"에서 "파일 저장 완료"로 강화된다(데이터 건수/scope 요약은 응답 형태 미확정이라
// 단순 완료 문구로 둔다 — 다운로드 자체는 부수효과 deps 가 수행).
const EXPORT_DONE_TEXT = '내보내기 완료';

// export 응답에 Content-Disposition filename 이 없을 때 쓸 기본 파일명(④f). backend 가
// Content-Disposition 헤더를 내려주면 그 filename 을 우선하고, 없으면 본 fallback 을 쓴다.
// api.md 122 가 export 형식을 명시하지 않으므로(형식은 backend 가 Content-Type 으로 결정)
// 확장자는 가장 보편적인 .json 으로 둔다 — 형식 협상/확장자 결정은 후속 slice(Out of Scope).
const DEFAULT_EXPORT_FILENAME = 'export.json';

// export scope 선택값 → export 호출 path 빌더(순수 helper, ④g). scope 가 truthy 면
// `${ADMIN_EXPORT_PATH}?scope=${encodeURIComponent(scope)}` 로 query 를 부착하고, 빈/falsy
// scope(전체 선택) 면 query 없는 ADMIN_EXPORT_PATH 상수를 그대로 반환한다(④f 동작 유지 —
// backend 기본 scope 위임). buildMappingsPath 의 순수 path-빌더 convention 정합(jsdom 없이
// 직접 검증). encodeURIComponent 로 공백/특수문자가 든 scope 값도 query 가 깨지지 않게 안전
// 인코딩한다(비정상 문자 방어). runExport 가 이 helper 결과를 getRaw 에 넘긴다.
function buildExportPath(scope: string | undefined): string {
  if (!scope) {
    return ADMIN_EXPORT_PATH;
  }
  return `${ADMIN_EXPORT_PATH}?${EXPORT_SCOPE_QUERY_KEY}=${encodeURIComponent(scope)}`;
}

// Content-Disposition 헤더에서 filename 을 추출하는 순수 helper(④f). RFC 6266 의 두 형태를
// 보수적으로 받는다: (1) filename*=UTF-8''<percent-encoded>(우선 — 비-ASCII 안전), (2) 일반
// filename="..." 또는 filename=.... 따옴표·앞뒤 공백을 벗기고, 빈/누락이면 undefined 를 낸다
// (호출측이 DEFAULT_EXPORT_FILENAME 로 fallback). header 가 null/빈 문자열이어도 throw 없이
// undefined 를 반환한다(안전 파싱 — 비정상 헤더에 다운로드가 깨지지 않도록).
function parseFilename(disposition: string | null): string | undefined {
  if (!disposition) {
    return undefined;
  }
  // (1) filename*=UTF-8''... (RFC 5987 ext-value) 우선 — percent-decode 시도.
  const extMatch = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(disposition);
  if (extMatch && extMatch[1]) {
    const raw = extMatch[1].trim();
    try {
      const decoded = decodeURIComponent(raw);
      if (decoded) {
        return decoded;
      }
    } catch {
      // 잘못된 percent-encoding — 일반 filename 분기로 fallthrough(throw 없이).
    }
  }
  // (2) 일반 filename="..." 또는 filename=... — 따옴표/공백 제거.
  const match = /filename=("?)([^";]+)\1/i.exec(disposition);
  if (match && match[2]) {
    const name = match[2].trim();
    return name || undefined;
  }
  return undefined;
}

// 평가 자료 import path — 고정 endpoint(POST /api/admin/import, api.md 123 Admin+, multipart
// file upload). Admin+ 라 User 등급은 403 — 그 403 은 runImport 의 catch 가 error props 로 안전
// 표시(throw 없음). backup/restore(api.md 124·125) 는 본 slice Out of Scope(import 만).
const ADMIN_IMPORT_PATH = '/api/admin/import';

// import multipart FormData 의 file field 이름 — api.md 123 이 multipart field 키를 명시하지
// 않으므로 가장 표준적인 'file' 을 쓴다(NestJS FileInterceptor 의 기본 field 명 관례 정합).
// backend import controller 가 다른 키를 요구하면 후속 정정한다(현 src/ 에 미구현 — ④d export
// 와 동일하게 api.md 계약 기준 선배선). 컴포넌트/apiClient 수정 0 — native FormData body.
const IMPORT_FILE_FIELD = 'file';

// import 성공 시 DataImportExportPanel 의 message props 로 내려보낼 사람-친화 안내.
// POST 응답이 기대 shape(ImportJob) 가 아닐 때의 안전 fallback 문구로도 쓰인다(응답 형태 변화·
// 비정상 응답 방어 — formatImportJobDetail 참조). 상세 소비는 T-1132 에서 도입.
const IMPORT_DONE_TEXT = '가져오기 완료';

// import 성공 시 POST /api/admin/import 응답(ImportJob) 을 사람-친화 한국어 상세 문구로 합성하는
// 순수 helper(T-1132). backend @Post() 은 생성된 ImportJob(id / status(PENDING) / mode) 을
// 그대로 반환하므로(src/import/import.controller.ts L109~120) 그 job 을 소비해 실제 상태를 표면화한다.
// job 은 즉시 완료가 아니라 PENDING(비동기 큐잉) 이므로 정적 "가져오기 완료" 대신 상태를 명시한다.
// apiClient.request 반환 타입은 unknown 이라 응답 형태가 보장되지 않으므로 방어적 narrowing 필수 —
// 기대 shape(최소 id string) 가 아니면(null · 비객체 · id 부재) 정적 IMPORT_DONE_TEXT 로 안전
// fallback(throw · '[object Object]' 노출 0). status · mode 는 string 일 때만 노출(누락 시 생략).
function formatImportJobDetail(job: unknown): string {
  // 비객체(null · undefined · string · number 등) → 소비 불가, 완료 문구 fallback.
  if (typeof job !== 'object' || job === null) {
    return IMPORT_DONE_TEXT;
  }
  const record = job as Record<string, unknown>;
  // 최소 식별자 id(비어있지 않은 string) 부재 → 상세 합성 불가, fallback.
  if (typeof record.id !== 'string' || record.id.length === 0) {
    return IMPORT_DONE_TEXT;
  }
  // id 는 필수, status · mode 는 있을 때만 덧붙인다(부분 정보라도 안전 표시 — 누락 필드 생략).
  const parts: string[] = [`job ${record.id}`];
  if (typeof record.status === 'string' && record.status.length > 0) {
    parts.push(`상태 ${record.status}`);
  }
  if (typeof record.mode === 'string' && record.mode.length > 0) {
    parts.push(`모드 ${record.mode}`);
  }
  return `가져오기 요청됨 — ${parts.join(', ')}`;
}

// 스케줄 조회/upsert path — 고정 endpoint(GET/PUT /api/schedules, ADR-0042 Admin+). GET 은
// 등록된 schedule name string[] 을 반환하고, PUT 은 `{ name, cronExpression }` body 로 이름
// 붙은 cron 주기를 등록/교체한다(T-0885). Admin+ 라 User 등급은 403 — 그 403 은 error props
// 로 안전 표시(throw 없음). personId 같은 필수 query 가 없어 무조건 조회한다.
const SCHEDULES_PATH = '/api/schedules';
// manual trigger path — 고정 endpoint(POST /api/schedules/trigger, ADR-0042 Admin+, 202
// Accepted, body 없음). cron 주기와 무관하게 즉시 1회 평가를 발화하는 수동 trigger(R-73).
const SCHEDULE_TRIGGER_PATH = '/api/schedules/trigger';
// PUT body 에 공급할 단일 default schedule name 상수(T-0885). SchedulePanel 은 cronExpression
// 만 노출하고 name 은 노출하지 않으므로, 본 컨테이너가 단일 default name 1 개를 upsert 대상으로
// 고정한다(다중-named schedule 관리 UI 는 Out of Scope / Follow-up).
const DEFAULT_SCHEDULE_NAME = 'daily-evaluation';
// apply(PUT) 성공 시 SchedulePanel 의 message props 로 내려보낼 사람-친화 완료 안내.
const APPLY_DONE_TEXT = '스케줄 주기를 적용했습니다';
// manual trigger(POST) 성공 시 message props 로 내려보낼 사람-친화 완료 안내.
const TRIGGER_DONE_TEXT = '수동 실행을 시작했습니다';
// 스케줄 목록 조회(GET) 진행 중 표시할 안내 문구 — busy(적용/실행 in-flight)가 아닌 정상
// 상태에서 message props 로 내려보낸다(초기 loading 안전 표시 — crash 없이).
const SCHEDULE_LOADING_TEXT = '스케줄 정보를 불러오는 중…';
// 등록된 스케줄이 0 건일 때 표시할 빈 상태 안내 문구(GET 이 빈 배열 반환 — seed 전 정상).
const NO_SCHEDULE_TEXT = '등록된 스케줄이 없습니다';
// 등록 스케줄 목록을 message 로 요약할 때 붙일 접두 문구(예: "등록된 스케줄: daily-evaluation").
const SCHEDULE_LIST_PREFIX = '등록된 스케줄: ';

// 재수집 window 후보 목록(frontend-local 상수, T-0886 — EXPORT_SCOPE_OPTIONS 동형). 선택 가능한
// 최근 N일 재수집 기간(예: 최근 1일/1주/30일). backend 는 body.days 로 받는다(RecentDeletionDto 의
// 선택 양수 정수 days). days 는 backend body 값이자 panel selectedDays 매칭 값, label 은 사람-친화
// 한국어. api 계약에 window enum 이 없으므로(days 자유 정수) 보편 후보를 frontend-local 로 둔다.
const REEVAL_WINDOW_OPTIONS: ReEvaluationWindow[] = [
  { days: 1, label: '최근 1일' },
  { days: 7, label: '최근 1주' },
  { days: 30, label: '최근 30일' },
];
// 재평가 person 선택 <select> 의 빈 선택지 라벨 — selectedPersonId 미선택 시 첫 옵션으로 노출한다.
const NO_PERSON_SELECTION_LABEL = '인원을 선택하세요';

// 그룹 미선택 시 멤버 패널에 노출할 안내 문구 — 그룹을 고르면 그 멤버가 표시됨을 안내한다.
const NO_GROUP_SELECTED_TEXT = '그룹을 선택하면 인원이 표시됩니다';
// 그룹 선택 <select> 의 빈 선택지 라벨 — selectedGroupId 미선택 시 첫 옵션으로 노출한다.
const NO_SELECTION_LABEL = '그룹을 선택하세요';
// 선택 그룹에 멤버가 없을 때 GroupMemberList 에 내려보낼 빈 상태 문구.
const EMPTY_MEMBER_TEXT = '이 그룹에 속한 인원이 없습니다';
// 이름 누락 멤버 row 의 fallback 라벨 — 의미 없는 빈 이름 방지(파생 단계 보수).
const FALLBACK_MEMBER_NAME = '이름 미상';
// 그룹 이름 누락 시 <select> 옵션에 노출할 fallback 라벨.
const FALLBACK_GROUP_NAME = '이름 없는 그룹';

// 멤버 row 의 frontend-local 최소 타입 — backend DTO 전수 공유는 Out of Scope(후속 별도
// 결정). id/name/role 세 후보 필드만 보수적으로 매핑한다. 모든 필드를 선택적으로 두어
// 누락/비정상 row 도 throw 없이 받는다(③a~③b-2 의 frontend-local 최소 타입 convention 정합).
interface GroupMemberRow {
  id?: string;
  name?: string;
  // 표시 이름 후보 — name 우선, 없으면 fullName 을 이름으로 쓴다(backend 가 fullName 을 쓰는
  // 경우 대비). 둘 다 누락이면 fallback 라벨.
  fullName?: string;
  // 역할 라벨 후보(선택) — 있으면 GroupMemberList 가 이름과 함께 표시한다.
  role?: string;
}

// 그룹 row 의 frontend-local 최소 타입 — id/name + 멤버 배열 후보 두 필드(members/persons)만
// 보수적으로 매핑한다. 모든 필드를 선택적으로 두어 누락/비정상 row 도 throw 없이 받는다.
// 멤버 배열은 members 우선, 없으면 persons 를 쓴다(backend 응답 키가 무엇이든 보수적으로
// 받기 위함 — api.md 81 이 키를 명시하지 않으므로). 둘 다 없으면 멤버 빈 배열(④b 에서 fetch).
interface GroupRow {
  id?: string;
  name?: string;
  members?: GroupMemberRow[];
  persons?: GroupMemberRow[];
}

// 멤버십 row 의 frontend-local 최소 타입(T-1129) — 신 endpoint(GET /api/groups/:id/members,
// T-1128 findMembershipsByGroupId)가 반환하는 raw PersonGroupMembership row 의 세 후보 필드만
// 보수적으로 매핑한다. id = membershipId(후속 ④c remove mutation 의 DELETE :id/members/:membershipId
// 인자), personId = 표시명을 기존 그룹 응답 person 에서 매칭할 키. 모든 필드를 선택적으로 두어
// 누락/비정상 row 도 throw 없이 받는다(createdAt 등 잔여 필드는 무시).
interface MembershipRow {
  id?: string;
  personId?: string;
  groupId?: string;
}

// LLM provider row 의 frontend-local 최소 타입 — backend sanitize view(api.md 114 6 필드)
// 중 DifficultyModelSelector 가 쓰는 id/provider/modelId 세 후보만 보수적으로 매핑한다.
// 모든 필드를 선택적으로 두어 누락/비정상 row 도 throw 없이 받는다(③a~④a frontend-local
// 최소 타입 convention 정합 — apiKey 등 잔여 필드는 무시).
interface LlmProviderRow {
  id?: string;
  provider?: string;
  modelId?: string;
  // T-1134 — LlmProviderConfigList 파생용 선택 필드. backend sanitize view(api.md 114)의
  // endpointUrl 후보를 보수적으로 매핑한다(있으면 표시·없으면 생략). DifficultyModelSelector
  // 는 이 필드를 쓰지 않아 deriveProviders 동작은 불변이다.
  endpointUrl?: string;
}

// 난이도 매핑 row 의 frontend-local 최소 타입 — 슬롯 키(difficulty)와 할당된 provider config
// id(llmProviderConfigId) 두 후보만 보수적으로 매핑한다. 둘 다 선택적이라 누락/비정상 row 도
// throw 없이 받는다(빈 배열 seed 전·미지의 난이도 키 안전 처리는 deriveDifficultyMapping 책임).
interface DifficultyMappingRow {
  difficulty?: string;
  llmProviderConfigId?: string | null;
}

// GET /api/auth/me 응답의 frontend-local 최소 타입(④h) — api.md 71 의 5 필드 중 본 slice 가
// 등급 파생에 쓰는 role 후보만 보수적으로 매핑한다. role 을 선택적으로 두어 누락/비정상 응답
// (role 없음/null)도 throw 없이 수용한다(③a~④g 의 frontend-local 최소 타입 convention 정합 —
// id/email/createdAt/updatedAt 등 잔여 필드는 무시). 등급 파생은 isAdminRole 이 책임진다.
interface MeRow {
  role?: string | null;
}

interface AdminViewProps {
  // 초기 선택 그룹 id(선택) — renderToStaticMarkup 정적 검증을 위해 초기값 주입을 허용한다
  // (③a~③b-3 의 initial* 주입 패턴 정합). 미주입 시 그룹 미선택(빈 멤버 안내) 으로 시작한다.
  initialSelectedGroupId?: string;
  // 초기 cron 식 입력값(선택, T-0885) — 위 initialSelectedGroupId 와 동일한 정적 검증용 초기값
  // 주입 affordance. 미주입 시 빈 cron 입력으로 시작한다(controlled lift-up — 컨테이너 소유).
  initialCronExpression?: string;
  // 초기 스케줄 busy 상태(선택, T-0885) — apply/trigger in-flight 시 SchedulePanel 이 진행 표시로
  // 컨트롤을 억제하는 분기를 정적 렌더로 검증하기 위한 초기값 주입 affordance. 미주입 시 false.
  initialScheduleBusy?: boolean;
  // 초기 선택 person id(선택, T-0886) — 정적 렌더 검증용 초기값 주입 affordance(initialSelectedGroupId
  // 동형). 미주입 시 person 미선택으로 시작한다(controlled lift-up — 컨테이너 소유).
  initialSelectedPersonId?: string;
  // 초기 선택 재수집 window days(선택, T-0886) — 정적 렌더 검증용. 미주입 시 0(windows 미매칭 →
  // ReEvaluationTriggerPanel 이 placeholder 로 fallback + 트리거 버튼 비활성 — 경계값 안전).
  initialSelectedDays?: number;
  // 초기 재평가 submitting 상태(선택, T-0886) — 재평가 in-flight 시 패널이 진행 표시로 컨트롤을
  // 억제하는 분기를 정적 렌더로 검증하기 위한 초기값 주입 affordance. 미주입 시 false.
  initialReevalSubmitting?: boolean;
  // 초기 선택 파트 id(선택, T-1156) — 정적 렌더 검증용 초기값 주입 affordance(initialSelectedGroupId
  // 동형). 미주입 시 파트 미선택으로 시작해 소속 인원을 조회하지 않는다(조건부 조회 idle).
  initialSelectedPartId?: string;
}

// 등급 문자열 → Admin+ 여부 파생(순수 helper, ④h). backend role enum(api.md 71 —
// "SuperAdmin"/"Admin"/"User")과 정확히 대소문자까지 매칭한다. role === 'Admin' ||
// role === 'SuperAdmin' 이면 true, 그 외("User")/undefined/null/빈값/조회 전/소문자 같은
// enum 불일치는 모두 false 다(fail-closed — 등급이 불명확하면 Admin 권한을 부여하지 않는다).
// 조회 실패·응답 누락·loading 중에도 role 이 Admin/SuperAdmin 으로 확정되지 않으므로 false 로
// 안전하게 떨어진다(비-Admin 에게 Admin 패널을 노출하지 않는 안전 기본값).
function isAdminRole(role: string | null | undefined): boolean {
  return role === 'Admin' || role === 'SuperAdmin';
}

// 그룹 row 배열에서 id 로 선택 그룹을 찾는다(순수 helper). rows 가 배열이 아니거나 미발견
// (stale 선택 — 선택 id 가 목록에 없음) 이면 undefined 를 반환한다(throw 없이).
function findGroup(
  groups: GroupRow[] | undefined,
  selectedGroupId: string | undefined,
): GroupRow | undefined {
  if (!Array.isArray(groups) || !selectedGroupId) {
    return undefined;
  }
  return groups.find((group) => group.id === selectedGroupId);
}

// 선택 그룹 → GroupMemberList 의 Member[] 파생(순수 helper). groups 미도착(undefined)/빈
// 배열/선택 미발견(stale)/멤버 미포함이면 빈 배열을 반환한다(빈 상태 위임 — throw 없이).
// 멤버 배열은 group.members 우선, 없으면 group.persons 를 쓴다(키 다양성 보수 수용). id
// 누락 row 는 index 기반 합성 key 로, name 누락 row 는 fallback 라벨로 안전 매핑한다.
// 그룹 응답이 멤버를 포함하지 않으면 빈 배열 — 별도 GET /api/groups/:id/members fetch 는
// ④b Out of Scope(본 컨테이너는 그룹 목록 조회만 한다).
function deriveMembers(
  groups: GroupRow[] | undefined,
  selectedGroupId: string | undefined,
): Member[] {
  const group = findGroup(groups, selectedGroupId);
  if (!group) {
    return [];
  }
  const rawMembers = group.members ?? group.persons;
  if (!Array.isArray(rawMembers)) {
    return [];
  }
  return rawMembers.map((member, index) => {
    const name = member.name ?? member.fullName ?? FALLBACK_MEMBER_NAME;
    return {
      id: member.id ?? `m${index + 1}`,
      name: name || FALLBACK_MEMBER_NAME,
      role: member.role,
    };
  });
}

// 선택 그룹의 멤버십 조회 path 빌더(순수 helper, T-1129 → T-1130 nonce 확장) — GET
// /api/groups/:id/members(T-1128, api.md 82). 선택 그룹이 있을 때만 path 를 만들고, 미선택
// (빈/falsy)이면 null 을 반환해 useApiResource 의 조건부 조회(path=null → 미조회, idle)를
// 유발한다(personId 미선택 시 미조회 convention 정합 — useApiResource.ts 9~11). groupId 는
// encodeURIComponent 로 안전 인코딩해 비정상 문자가 든 id 도 path 가 깨지지 않게 한다
// (buildExportPath/buildRecentDeletionPath 의 안전 인코딩 convention 정합).
// T-1130: ④c remove mutation 성공 후 멤버십 재조회를 유발하기 위해 cache-busting nonce(`_r`)를
// 받는다(buildMappingsPath 동형). nonce 0(초기 조회)이면 query 없는 깨끗한 path 를 그대로 쓰고
// (불필요 query 회피), 1+ 면 `?_r=<nonce>` 를 부착해 useApiResource 의 path-변경 재조회를 낸다.
// `_r` 은 backend GET 핸들러가 @Query 를 받지 않아 무시한다(api.md 82 — 부수효과 0). 선택 그룹
// 변경 refetch(path 변경)는 selectedGroupId 변화가 그대로 유지한다.
function buildGroupMembersPath(
  selectedGroupId: string | undefined,
  refreshNonce = 0,
): string | null {
  if (!selectedGroupId) {
    return null;
  }
  const base = `/api/groups/${encodeURIComponent(selectedGroupId)}/members`;
  if (refreshNonce <= 0) {
    return base;
  }
  return `${base}?_r=${refreshNonce}`;
}

// 멤버십 응답 + 선택 그룹 → GroupMemberList 의 Member[] 파생(순수 helper, T-1129). raw membership
// row 배열에서 Member[] 를 만들되, 각 Member.id 를 membership 의 id(membershipId)로 설정한다 —
// 후속 ④c remove mutation(DELETE :id/members/:membershipId)의 인자를 노출하기 위함. 표시명은 기존
// 그룹 응답의 person(group.members ?? group.persons, id = personId)에서 membership.personId 매칭으로
// 채우고, 매칭 부재/이름 누락/빈 이름이면 FALLBACK_MEMBER_NAME 으로 안전 fallback 한다(backend person
// include shape 변경은 Out of Scope). memberships 가 배열이 아니면 빈 배열(빈 상태 위임 — throw 없이).
// id 누락 membership 은 index 기반 합성 key 로 안전 매핑해 React key 안정성을 유지한다(deriveMembers 동형).
function deriveMembersFromMemberships(
  memberships: MembershipRow[] | undefined,
  group: GroupRow | undefined,
): Member[] {
  if (!Array.isArray(memberships)) {
    return [];
  }
  const rawPersons = group?.members ?? group?.persons;
  const persons = Array.isArray(rawPersons) ? rawPersons : [];
  return memberships.map((membership, index) => {
    const person = membership.personId
      ? persons.find((candidate) => candidate.id === membership.personId)
      : undefined;
    const name = person?.name ?? person?.fullName ?? FALLBACK_MEMBER_NAME;
    return {
      id: membership.id ?? `m${index + 1}`,
      name: name || FALLBACK_MEMBER_NAME,
      role: person?.role,
    };
  });
}

// 난이도 슬롯 고정 3 키 — deriveDifficultyMapping 의 기본 골격(미지의 키 무시 + 누락 슬롯 null).
const DIFFICULTY_KEYS: Difficulty[] = ['easy', 'medium', 'hard'];

// provider 응답 row 배열 → DifficultyModelSelector 의 ProviderOption[] 파생(순수 helper).
// rows 가 배열이 아니면 빈 배열을 반환한다(throw 없이). id/provider/modelId 누락 row 는
// 보수적 fallback — id 누락 row 는 index 기반 합성 key(`p<n>`), provider/modelId 누락은 빈
// 문자열로 채워 컴포넌트가 undefined 를 렌더하지 않게 한다(③a~④a 보수 매핑 convention).
function deriveProviders(rows: LlmProviderRow[] | undefined): ProviderOption[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.map((row, index) => ({
    id: row.id ?? `p${index + 1}`,
    provider: row.provider ?? '',
    modelId: row.modelId ?? '',
  }));
}

// provider 응답 row 배열 → LlmProviderConfigList 의 LlmProviderConfigRow[] 파생(순수 helper,
// T-1134). deriveProviders 와 동형이되 sanitized 읽기 전용 view 계약에 맞춘다 — id/provider 는
// 필수 매핑(id 누락 row 는 index 기반 합성 key `p<n>` 로 React key 안정성 유지, provider 누락은
// 빈 문자열), modelId/endpointUrl 은 truthy 일 때만 매핑하고 누락/빈값이면 생략한다(선택 필드는
// undefined 로 두어 컴포넌트가 없을 때 렌더에서 자연 skip — throw 없음). secret apiKey 는 view
// 타입에 없어 매핑 대상이 아니다. rows 가 배열이 아니면(undefined/null/조회 전) 빈 배열을
// 반환한다(빈 상태 위임 — throw 없이).
function deriveProviderConfigs(
  rows: LlmProviderRow[] | undefined,
): LlmProviderConfigRow[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.map((row, index) => {
    const config: LlmProviderConfigRow = {
      id: row.id ?? `p${index + 1}`,
      provider: row.provider ?? '',
    };
    // modelId/endpointUrl 은 있으면(truthy) 매핑, 없으면 키 자체를 생략한다(선택 필드 계약).
    if (row.modelId) {
      config.modelId = row.modelId;
    }
    if (row.endpointUrl) {
      config.endpointUrl = row.endpointUrl;
    }
    return config;
  });
}

// 난이도 매핑 응답 row 배열 → Record<Difficulty, string | null> 파생(순수 helper). 세 슬롯
// (easy/medium/hard) 을 키로 하고 기본값은 null(빈 배열 seed 전 안전 처리). 응답에 해당
// 슬롯이 있으면 그 llmProviderConfigId 를 채우되, 빈 문자열/누락은 null 로 보정한다. 미지의
// 난이도 키(예 'expert') 는 무시한다(세 슬롯 외 키는 골격에 없어 자연 skip — throw 없음).
// rows 가 배열이 아니어도 세 슬롯 모두 null 인 기본 매핑을 반환한다(throw 없이).
function deriveDifficultyMapping(
  rows: DifficultyMappingRow[] | undefined,
): Record<Difficulty, string | null> {
  const mapping: Record<Difficulty, string | null> = {
    easy: null,
    medium: null,
    hard: null,
  };
  if (!Array.isArray(rows)) {
    return mapping;
  }
  for (const row of rows) {
    const key = row.difficulty as Difficulty | undefined;
    // 세 슬롯에 속한 키만 반영(미지의 난이도 키는 무시) — type-narrowing 후 안전 할당.
    if (key && DIFFICULTY_KEYS.includes(key)) {
      // 빈 문자열/누락 id 는 미할당(null)으로 보정 — placeholder fallback.
      mapping[key] = row.llmProviderConfigId ? row.llmProviderConfigId : null;
    }
  }
  return mapping;
}

// 난이도 슬롯 매핑 조회 path 빌더(순수 helper) — ④c PATCH 성공 시 GET 재조회를 유발하기 위해
// 컨테이너의 refreshNonce 를 cache-busting query(`_r`)로 실어 path 문자열을 변화시킨다.
// useApiResource 는 path 변경 시에만 재조회하므로(수정 0 — read-only hook), nonce 증가가 곧
// 재조회 트리거다. nonce 0(초기 조회)이면 query 없는 깨끗한 path 를 그대로 쓴다(불필요 query
// 회피). `_r` 은 backend GET 핸들러가 @Query 를 받지 않아 무시한다(api.md 119 — 부수효과 0).
function buildMappingsPath(refreshNonce: number): string {
  if (refreshNonce <= 0) {
    return LLM_MAPPINGS_PATH;
  }
  return `${LLM_MAPPINGS_PATH}?_r=${refreshNonce}`;
}

// provider 목록 조회 path 빌더(순수 helper, T-1135 — buildMappingsPath 동형) — 삭제 DELETE 성공
// 시 GET /api/llm/providers 재조회를 유발하기 위해 컨테이너의 refreshNonce 를 cache-busting
// query(`_r`)로 실어 path 문자열을 변화시킨다. useApiResource 는 path 변경 시에만 재조회하므로
// (수정 0 — read-only hook), nonce 증가가 곧 재조회 트리거다. nonce 0(초기 조회)이면 query 없는
// 깨끗한 base path 를 그대로 쓴다(불필요 query 회피 — T-1134 초기 마운트 path 와 동일 유지).
// `_r` 은 backend GET 핸들러가 @Query 를 받지 않아 무시한다(api.md 114 — 부수효과 0).
function buildProvidersPath(refreshNonce: number): string {
  if (refreshNonce <= 0) {
    return LLM_PROVIDERS_PATH;
  }
  return `${LLM_PROVIDERS_PATH}?_r=${refreshNonce}`;
}

// 인원 목록 조회 path 빌더(순수 helper, T-1143 — buildProvidersPath 동형) — 인원 생성 POST
// (/api/persons) 성공 시 GET /api/persons 재조회를 유발하기 위해 컨테이너의 personsRefreshNonce 를
// cache-busting query(`_r`)로 실어 path 문자열을 변화시킨다. useApiResource 는 path 변경 시에만
// 재조회하므로(read-only hook 수정 0), nonce 증가가 곧 재조회 트리거다. nonce 0(초기 조회)이면
// query 없는 깨끗한 base path 를 그대로 쓴다(T-1142 마운트 path 와 동일 유지 — 회귀 0). `_r` 은
// backend GET 핸들러가 @Query 를 받지 않아 무시한다(api.md — 부수효과 0).
function buildPersonsPath(refreshNonce: number): string {
  if (refreshNonce <= 0) {
    return PERSONS_PATH;
  }
  return `${PERSONS_PATH}?_r=${refreshNonce}`;
}

// 그룹 목록 조회 path 빌더(순수 helper, T-1146 — buildPersonsPath 동형) — 그룹 생성 POST
// (/api/groups) 성공 시 GET /api/groups 재조회를 유발하기 위해 컨테이너의 groupsRefreshNonce 를
// cache-busting query(`_r`)로 실어 path 문자열을 변화시킨다. useApiResource 는 path 변경 시에만
// 재조회하므로(read-only hook 수정 0), nonce 증가가 곧 재조회 트리거다. nonce 0(초기 조회)이면
// query 없는 깨끗한 base path(GROUPS_PATH — T-1129 이전 마운트 path 와 동일 유지, 회귀 0)를 그대로
// 쓴다. `_r` 은 backend GET 핸들러가 @Query 를 받지 않아 무시한다(api.md — 부수효과 0).
function buildGroupsPath(refreshNonce: number): string {
  if (refreshNonce <= 0) {
    return GROUPS_PATH;
  }
  return `${GROUPS_PATH}?_r=${refreshNonce}`;
}

// 파트 목록 조회 path 빌더(순수 helper, T-1153 — buildGroupsPath 동형) — 파트 생성 POST
// (/api/parts) 성공 시 GET /api/parts 재조회를 유발하기 위해 컨테이너의 partsRefreshNonce 를
// cache-busting query(`_r`)로 실어 path 문자열을 변화시킨다. useApiResource 는 path 변경 시에만
// 재조회하므로(read-only hook 수정 0), nonce 증가가 곧 재조회 트리거다. nonce 0(초기 조회)이면
// query 없는 깨끗한 base path(PARTS_PATH — T-1152 마운트 path 와 동일 유지, 회귀 0)를 그대로 쓴다.
// `_r` 은 backend GET 핸들러가 @Query 를 받지 않아 무시한다(part.controller @Get() — 부수효과 0).
function buildPartsPath(refreshNonce: number): string {
  if (refreshNonce <= 0) {
    return PARTS_PATH;
  }
  return `${PARTS_PATH}?_r=${refreshNonce}`;
}

// 사용자 목록 조회 path 빌더(T-1160 — buildPartsPath 동형. nonce 를 `_r` 로 실어 재조회를 내되,
// backend 는 @Query 미수신이라 부수효과 0. nonce 0 이면 T-1159 초기 조회와 같은 base path).
function buildUsersPath(refreshNonce: number): string {
  if (refreshNonce <= 0) {
    return USERS_PATH;
  }
  return `${USERS_PATH}?_r=${refreshNonce}`;
}

// 선택 파트의 소속 인원 조회 path 빌더(순수 helper, T-1156 — buildGroupMembersPath 동형) — GET
// /api/parts/:id/persons(part.controller findPersons, Part 부재 시 404 / 인원 0 이면 200 + 빈 배열).
// 선택 파트가 있을 때만 path 를 만들고, 미선택(빈/falsy)이면 null 을 반환해 useApiResource 의
// 조건부 조회(path=null → 미조회, idle)를 유발한다(useApiResource.ts 9~11 convention 정합) —
// 미선택 상태에서 `/api/parts//persons` 같은 깨진 path 로 404 를 유발하지 않기 위한 컨테이너 가드다.
// partId 는 encodeURIComponent 로 안전 인코딩해 비정상 문자가 든 id 도 path 가 깨지지 않게 한다.
// nonce 0(초기 조회)이면 query 없는 깨끗한 base path 를 쓰고, 1+ 면 `?_r=<nonce>` 를 부착해
// useApiResource 의 path-변경 재조회를 낸다(파트 CRUD 성공 후 소속 인원도 함께 권위 재조회).
// `_r` 은 backend GET 핸들러가 @Query 를 받지 않아 무시한다(부수효과 0). 선택 파트 변경 refetch
// (path 변경)는 selectedPartId 변화가 그대로 유지한다.
function buildPartPersonsPath(
  selectedPartId: string | undefined,
  refreshNonce = 0,
): string | null {
  if (!selectedPartId) {
    return null;
  }
  const base = `/api/parts/${encodeURIComponent(selectedPartId)}/persons`;
  if (refreshNonce <= 0) {
    return base;
  }
  return `${base}?_r=${refreshNonce}`;
}

// 서버 파생 매핑 위에 낙관적 override 를 덮는 순수 helper — ④c PATCH 발사 직후 재조회 도착
// 전까지 재지정한 슬롯이 즉시 새 provider 를 반영하도록 한다. override 의 각 슬롯값이 정의돼
// 있으면(undefined 가 아니면) base 를 덮고, undefined 슬롯은 base 를 유지한다(부분 override).
// override 가 비거나(아무 슬롯도 없음) 모두 undefined 면 base 와 동일한 새 객체를 반환한다.
function mergeMapping(
  base: Record<Difficulty, string | null>,
  override: Partial<Record<Difficulty, string | null>>,
): Record<Difficulty, string | null> {
  const merged: Record<Difficulty, string | null> = { ...base };
  for (const key of DIFFICULTY_KEYS) {
    const value = override[key];
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  return merged;
}

// onAssign 의 PATCH + state-전이 로직을 캡슐화한 순수 async 러너(④c, 테스트 가능성 —
// jsdom/렌더러 없이 mutation 본체를 직접 검증한다. useApiResource 의 runFetch 가 effect
// 본체를 분리해 jsdom 없이 검증한 convention 정합). 컨테이너의 handleAssign 은 이 러너에
// 현재 in-flight 여부(assigning)와 상태 setter 들을 주입해 호출만 한다. 동작:
//  - 빈/falsy providerId → 미발사(잘못된 body 회피).
//  - assigning(이전 mutation 미완) → 미발사(이중 PATCH·state 경합 차단).
//  - 발사 시 낙관 반영 + 진행 on + error 비움 → PATCH → 성공(재조회 트리거 + override 비움) /
//    실패(override 롤백 + 문구 표면화) → 진행 off(공통).
interface AssignDeps {
  // PATCH 발사 primitive — apiClient.request 를 주입한다(테스트는 mock 주입).
  patch: (path: string, options: RequestOptions) => Promise<unknown>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입).
  describeError: (e: unknown) => string;
  // 현재 mutation in-flight 여부 — true 면 미발사(동시 재호출 가드).
  assigning: boolean;
  setAssigning: (next: boolean) => void;
  setAssignError: (next: string | undefined) => void;
  setOptimistic: (
    updater: (
      prev: Partial<Record<Difficulty, string | null>>,
    ) => Partial<Record<Difficulty, string | null>>,
  ) => void;
  // 권위 재조회 트리거 — refreshNonce 를 +1 한다(path 변경 유발).
  bumpRefresh: () => void;
}

async function runAssign(
  difficulty: Difficulty,
  providerId: string,
  deps: AssignDeps,
): Promise<void> {
  // 비정상 호출 가드 — 빈/falsy providerId 는 PATCH 미발사(잘못된 body 회피).
  if (!providerId) {
    return;
  }
  // 동시 재호출 가드 — 이전 mutation 미완 중이면 미발사(이중 PATCH·state 경합 차단).
  if (deps.assigning) {
    return;
  }
  deps.setAssigning(true);
  deps.setAssignError(undefined);
  deps.setOptimistic((prev) => ({ ...prev, [difficulty]: providerId }));
  try {
    await deps.patch(`${LLM_MAPPINGS_PATH}/${difficulty}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ llmProviderConfigId: providerId }),
    });
    // 성공 — 권위 재조회 트리거 + 낙관 override 비움(서버 데이터로 대체).
    deps.setOptimistic(() => ({}));
    deps.bumpRefresh();
  } catch (e) {
    // 실패 — 낙관 override 롤백 + 사람-친화 문구 표면화(throw 없이 error props 로).
    deps.setOptimistic(() => ({}));
    deps.setAssignError(deps.describeError(e));
  } finally {
    deps.setAssigning(false);
  }
}

// 가상 <a download> 클릭으로 실제 파일 저장을 수행하는 부수효과 추상화(④f). DOM/URL primitive
// (createObjectURL/revokeObjectURL/anchor 생성·클릭)을 주입 가능한 한 객체로 묶어 jsdom 없이
// 직접 검증한다(④c~④e 의 *Deps 주입 convention 정합 — 테스트는 mock 주입, 런타임은 기본
// 브라우저 구현 주입). triggerDownload 는 blob → objectURL → anchor click → revokeObjectURL
// 정리까지 한 단위로 수행하되, click 도중 예외가 나도 revokeObjectURL 정리가 누락되지 않도록
// finally 로 자원을 회수한다(자원 누수 방지).
interface DownloadDeps {
  // Blob → object URL 생성(런타임 기본: URL.createObjectURL). 다운로드 anchor 의 href.
  createObjectURL: (blob: Blob) => string;
  // object URL 해제(런타임 기본: URL.revokeObjectURL). 다운로드 트리거 후 자원 회수.
  revokeObjectURL: (url: string) => void;
  // anchor 생성·download 속성 설정·DOM 부착·click·제거를 수행하는 부수효과(런타임 기본:
  // document.createElement('a') + body append/click/remove). 테스트는 호출만 단언한다.
  clickAnchor: (url: string, filename: string) => void;
}

// blob 을 가상 <a download> 클릭으로 저장하는 순수 부수효과 러너(④f). createObjectURL 로
// object URL 을 만들고 clickAnchor 로 다운로드를 트리거한 뒤, 성공·예외 어느 경우든 finally 로
// revokeObjectURL 정리를 보장한다(createObjectURL 후 click 예외 시에도 URL 누수 없음).
function triggerDownload(
  blob: Blob,
  filename: string,
  deps: DownloadDeps,
): void {
  const url = deps.createObjectURL(blob);
  try {
    deps.clickAnchor(url, filename);
  } finally {
    // click 성공·실패 무관하게 object URL 정리(자원 누수 방지).
    deps.revokeObjectURL(url);
  }
}

// onExport 의 GET + Blob 다운로드 + state-전이 로직을 캡슐화한 순수 async 러너(④f — ④d 의
// runExport 를 확장. jsdom/렌더러 없이 export·다운로드 본체를 직접 검증한다 — *Deps 주입).
// 컨테이너의 handleExport 는 이 러너에 현재 in-flight 여부(exporting)와 상태 setter·부수효과
// deps 를 주입해 호출만 한다. 동작:
//  - exporting(이전 export 미완) → 미발사(이중 GET·중복 다운로드 차단 — runAssign assigning 가드 동형).
//  - 발사 시 진행 on + 이전 error·message 비움 → GET <path>(raw) → 성공 시 response.blob()
//    → Content-Disposition filename(없으면 기본명) → triggerDownload(파일 저장) + 완료 message 설정 /
//    실패(error 문구 표면화 — throw 없이) → 진행 off(공통).
// ④g: 호출 path 를 인자(path)로 주입받도록 확장한다(고정 ADMIN_EXPORT_PATH 상수 직접 참조 제거).
// 이유: scope 선택값을 컨테이너가 buildExportPath 로 path 에 반영해 주입하므로, 러너는 어느
// scope 든 무관하게 주어진 path 로 GET 만 발사한다(scope 결정 책임은 컨테이너 — 관심사 분리).
// path 를 ExportDeps 에 두지 않고 별도 인자로 둔 이유: deps 는 setter/부수효과(불변 의존)이고
// path 는 호출마다 달라지는 입력값이라(runAssign(difficulty, providerId, deps) 의 입력 인자
// 분리 convention 정합) 인자화가 회귀·가독성 면에서 적다.
interface ExportDeps extends DownloadDeps {
  // export GET 발사 primitive — apiClient.requestRaw 를 주입한다(raw Response 반환 — body
  // 미소비라 blob() 가능). 테스트는 mock 주입.
  getRaw: (path: string, options?: RequestOptions) => Promise<Response>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입).
  describeError: (e: unknown) => string;
  // 현재 export in-flight 여부 — true 면 미발사(동시 재호출 가드).
  exporting: boolean;
  setExporting: (next: boolean) => void;
  setExportError: (next: string | undefined) => void;
  setExportMessage: (next: string | undefined) => void;
}

async function runExport(path: string, deps: ExportDeps): Promise<void> {
  // 동시 재호출 가드 — 이전 export 미완 중이면 미발사(이중 GET·중복 다운로드 차단).
  if (deps.exporting) {
    return;
  }
  deps.setExporting(true);
  // 재발화 시작 시 직전 error·message 를 비운다(실패 후 재시도 시 직전 error 정리 + 직전 완료
  // 안내 정리 — 새 export 의 진행 표시만 남도록).
  deps.setExportError(undefined);
  deps.setExportMessage(undefined);
  try {
    // GET <path> — raw Response 수신(옵션 생략 = 기본 GET). path 는 컨테이너가 buildExportPath
    // 로 scope 를 반영해 주입한다(scope 미선택 시 ADMIN_EXPORT_PATH 그대로 = ④f 동작). raw
    // 반환이라 body 를 미소비 → response.blob() 으로 이진/임의 형식을 그대로 받는다.
    const response = await deps.getRaw(path);
    // 응답 본문을 Blob 으로 — 형식(Content-Type)은 backend 결정, 빈/0-byte body 도 빈 Blob 으로
    // 안전 수용(throw 없이). 파일명은 Content-Disposition 의 filename 우선, 없으면 기본명 fallback.
    const blob = await response.blob();
    const filename =
      parseFilename(response.headers.get('content-disposition')) ??
      DEFAULT_EXPORT_FILENAME;
    // 실제 파일 저장 — createObjectURL → 가상 <a download> 클릭 → revokeObjectURL 정리.
    triggerDownload(blob, filename, deps);
    // 성공 — 파일 저장 완료 안내를 message 로 표면화(DataImportExportPanel 의 정상 message 분기).
    deps.setExportMessage(EXPORT_DONE_TEXT);
  } catch (e) {
    // 실패 — 사람-친화 문구를 error props 로 안전 표시(throw 없이). 403 Admin+ 미만 / 404 /
    // 비-2xx / 네트워크 0 모두 ApiError.status → toErrorMessage 파생으로 표면화. 다운로드 부수효과
    // 는 try 블록의 GET 성공 후에만 진입하므로 실패 시 createObjectURL 등은 호출되지 않는다.
    deps.setExportError(deps.describeError(e));
  } finally {
    deps.setExporting(false);
  }
}

// 런타임 기본 DownloadDeps — 브라우저 표준 URL/DOM API 로 구현(④f). 컨테이너 handleExport 가
// 주입한다. createObjectURL/revokeObjectURL 는 URL 정적 메서드, clickAnchor 는 document 로
// 가상 <a download> 를 만들어 클릭·정리한다(브라우저 표준 — file-saver 등 새 dependency 0).
const browserDownloadDeps: DownloadDeps = {
  createObjectURL: (blob) => URL.createObjectURL(blob),
  revokeObjectURL: (url) => URL.revokeObjectURL(url),
  clickAnchor: (url, filename) => {
    // 가상 <a download> 생성 — href 에 object URL, download 속성에 파일명을 실어 클릭하면
    // 브라우저가 파일을 저장한다. 일부 브라우저는 anchor 가 DOM 에 부착돼야 click 이 동작하므로
    // body 에 append 후 click, 즉시 remove 한다(보이지 않게 — 즉시 제거).
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  },
};

// onImportFile 의 POST(multipart) + state-전이 로직을 캡슐화한 순수 async 러너(④e — ④d
// runExport 캡슐화 패턴 차용. jsdom/렌더러 없이 import 본체를 직접 검증한다 — ExportDeps 와
// 동형의 ImportDeps 주입). 컨테이너의 handleImport 는 이 러너에 현재 in-flight 여부(importing)와
// 상태 setter 들을 주입해 호출만 한다. 동작:
//  - 빈/falsy file → 미발사(빈 선택 방어 — DataImportExportPanel.handleFileChange 도 falsy file
//    시 미호출이나 러너 자체도 방어해 직접 호출/비정상 입력에 안전).
//  - importing(이전 import 미완) → 미발사(이중 POST·state 경합 차단 — runExport 의 exporting 가드 동형).
//  - 발사 시 진행 on + 이전 error·message 비움 → FormData 에 file append → POST /api/admin/import →
//    성공(완료 message 설정) / 실패(error 문구 표면화 — throw 없이) → 진행 off(공통).
interface ImportDeps {
  // import POST 발사 primitive — apiClient.request 를 주입한다(테스트는 mock 주입).
  post: (path: string, options: RequestOptions) => Promise<unknown>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입).
  describeError: (e: unknown) => string;
  // 현재 import in-flight 여부 — true 면 미발사(동시 재호출 가드).
  importing: boolean;
  setImporting: (next: boolean) => void;
  setImportError: (next: string | undefined) => void;
  setImportMessage: (next: string | undefined) => void;
}

async function runImport(file: File, deps: ImportDeps): Promise<void> {
  // 비정상 호출 가드 — 빈/falsy file 은 POST 미발사(빈 선택 방어 — 잘못된 body 회피).
  if (!file) {
    return;
  }
  // 동시 재호출 가드 — 이전 import 미완 중이면 미발사(이중 POST·state 경합 차단).
  if (deps.importing) {
    return;
  }
  deps.setImporting(true);
  // 재발화 시작 시 직전 error·message 를 비운다(실패 후 재시도 시 직전 error 정리 + 직전 완료
  // 안내 정리 — 새 import 의 진행 표시만 남도록, runExport 의 시작 정리 동형).
  deps.setImportError(undefined);
  deps.setImportMessage(undefined);
  try {
    // 선택 File 을 multipart FormData 로 동봉 — body 가 FormData 면 브라우저가 multipart
    // Content-Type boundary 를 자동 설정하므로 수동 헤더 미지정(boundary 누락 방지). apiClient
    // .request 가 RequestInit.body 를 native 수용 → apiClient.ts 수정 0.
    const formData = new FormData();
    formData.append(IMPORT_FILE_FIELD, file);
    // POST /api/admin/import — multipart body. 응답은 생성된 ImportJob(id / status(PENDING) /
    // mode) 이므로(import.controller.ts L109~120) 그 job 을 소비해 상세 문구로 합성한다(T-1132).
    const job = await deps.post(ADMIN_IMPORT_PATH, { method: 'POST', body: formData });
    // 성공 — 응답 ImportJob 을 사람-친화 상세 문구로 합성해 message 로 표면화한다(방어적 narrowing —
    // 기대 shape 아니면 IMPORT_DONE_TEXT 로 안전 fallback). job 은 PENDING 이라 "완료" 대신 상태 명시.
    deps.setImportMessage(formatImportJobDetail(job));
  } catch (e) {
    // 실패 — 사람-친화 문구를 error props 로 안전 표시(throw 없이). 403 Admin+ 미만 / 400 잘못된
    // 파일 / 404 / 비-2xx / 네트워크 0 모두 ApiError.status → toErrorMessage 파생으로 표면화.
    deps.setImportError(deps.describeError(e));
  } finally {
    deps.setImporting(false);
  }
}

// SchedulePanel 의 apply(PUT)·manual trigger(POST) mutation + state-전이 로직에 주입하는 deps
// (T-0885 — ④c runAssign / ④e runImport 의 *Deps 주입 convention 차용. jsdom/렌더러 없이
// mutation 본체를 직접 검증한다). apply·trigger 는 SchedulePanel 의 단일 busy 슬롯을 공유하므로
// (패널이 busy=true 면 두 컨트롤 모두 억제) 하나의 busy 플래그·error·message setter 를 공유한다.
interface ScheduleMutationDeps {
  // mutation 발사 primitive — apiClient.request 를 주입한다(테스트는 mock 주입).
  request: (path: string, options: RequestOptions) => Promise<unknown>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입).
  describeError: (e: unknown) => string;
  // 현재 apply/trigger in-flight 여부 — true 면 미발사(동시 재호출·이중 발사 가드).
  busy: boolean;
  setBusy: (next: boolean) => void;
  setError: (next: string | undefined) => void;
  setMessage: (next: string | undefined) => void;
}

// onApply 의 PUT /api/schedules + state-전이 로직을 캡슐화한 순수 async 러너(T-0885 — runImport
// 캡슐화 패턴 차용). 컨테이너의 handleApply 는 이 러너에 현재 cron 입력값과 in-flight 여부(busy)·
// 상태 setter 를 주입해 호출만 한다. 동작:
//  - 빈/falsy cronExpression → 미발사(빈 값으로 apply 시 잘못된 body·400 회피 — 발사 억제 택1).
//  - busy(이전 apply/trigger 미완) → 미발사(이중 PUT·state 경합 차단 — runImport importing 가드 동형).
//  - 발사 시 진행 on + 이전 error·message 비움 → PUT `{ name: <default 상수>, cronExpression }` →
//    성공(완료 message 설정) / 실패(error 문구 표면화 — throw 없이) → 진행 off(공통).
async function runApply(
  cronExpression: string,
  deps: ScheduleMutationDeps,
): Promise<void> {
  // 비정상 호출 가드 — 빈/falsy cron 식은 PUT 미발사(잘못된 body 회피 — 발사 억제 구현 택1).
  if (!cronExpression) {
    return;
  }
  // 동시 재호출 가드 — 이전 apply/trigger 미완 중이면 미발사(이중 PUT·state 경합 차단).
  if (deps.busy) {
    return;
  }
  deps.setBusy(true);
  // 재발화 시작 시 직전 error·message 를 비운다(실패 후 재시도 시 직전 error 정리 + 직전 완료
  // 안내 정리 — 새 apply 의 진행 표시만 남도록, runImport 의 시작 정리 동형).
  deps.setError(undefined);
  deps.setMessage(undefined);
  try {
    // PUT /api/schedules — 단일 default schedule name + 현재 cron 입력값을 body 로 전송. name 은
    // SchedulePanel 이 노출하지 않으므로 컨테이너가 default 상수를 공급한다(다중-named 관리는 후속).
    await deps.request(SCHEDULES_PATH, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: DEFAULT_SCHEDULE_NAME,
        cronExpression,
      }),
    });
    // 성공 — 사람-친화 완료 안내를 message 로 표면화(SchedulePanel 의 정상 message 분기).
    deps.setMessage(APPLY_DONE_TEXT);
  } catch (e) {
    // 실패 — 사람-친화 문구를 error props 로 안전 표시(throw 없이). 403 Admin+ 미만 / 400 유효하지
    // 않은 cron 식·빈 name / 404 / 비-2xx / 네트워크 0 모두 ApiError.status → toErrorMessage 파생.
    deps.setError(deps.describeError(e));
  } finally {
    deps.setBusy(false);
  }
}

// onManualTrigger 의 POST /api/schedules/trigger + state-전이 로직을 캡슐화한 순수 async 러너
// (T-0885 — runApply 동형, body 없는 202 Accepted fire-and-forget). 컨테이너의 handleTrigger 는
// 이 러너에 in-flight 여부(busy)·상태 setter 를 주입해 호출만 한다. 동작:
//  - busy(이전 apply/trigger 미완) → 미발사(이중 POST·state 경합 차단).
//  - 발사 시 진행 on + 이전 error·message 비움 → POST(body 없음) → 성공(완료 message 설정) /
//    실패(error 문구 표면화 — throw 없이) → 진행 off(공통).
async function runTrigger(deps: ScheduleMutationDeps): Promise<void> {
  // 동시 재호출 가드 — 이전 apply/trigger 미완 중이면 미발사(이중 POST·state 경합 차단).
  if (deps.busy) {
    return;
  }
  deps.setBusy(true);
  deps.setError(undefined);
  deps.setMessage(undefined);
  try {
    // POST /api/schedules/trigger — body 없는 fire-and-forget(202 Accepted). 응답 body 를
    // 소비하지 않으므로 성공 사실만 확인한다(수동 실행 시작 안내).
    await deps.request(SCHEDULE_TRIGGER_PATH, { method: 'POST' });
    // 성공 — 사람-친화 완료 안내를 message 로 표면화.
    deps.setMessage(TRIGGER_DONE_TEXT);
  } catch (e) {
    // 실패 — 사람-친화 문구를 error props 로 안전 표시(throw 없이). 403 / 404 / 비-2xx / 네트워크 0 모두.
    deps.setError(deps.describeError(e));
  } finally {
    deps.setBusy(false);
  }
}

// 등록 schedule name 목록 → SchedulePanel 의 message props 로 내려보낼 안내 문구 파생(순수
// helper, T-0885). 사용자 조작 결과(mutationMessage: apply/trigger 완료 안내)가 있으면 그것을
// 우선하고(최신 피드백), 없으면 GET 상태를 파생한다: loading 중이면 로딩 안내, 등록 0 건이면
// 빈 상태 안내, 1+ 건이면 이름 목록 요약("등록된 스케줄: a, b"). 비배열/undefined 입력도 빈
// 배열로 간주해 throw 없이 빈 상태 안내를 낸다(안전 처리).
function deriveScheduleMessage(
  names: string[] | undefined,
  loading: boolean,
  mutationMessage: string | undefined,
): string {
  if (mutationMessage) {
    return mutationMessage;
  }
  if (loading) {
    return SCHEDULE_LOADING_TEXT;
  }
  if (!Array.isArray(names) || names.length === 0) {
    return NO_SCHEDULE_TEXT;
  }
  return `${SCHEDULE_LIST_PREFIX}${names.join(', ')}`;
}

// 재평가(최근 N일 delete→재수집) 트리거 path 빌더(순수 helper, T-0886) — POST
// /api/schedules/recent-deletion/:personId(Admin+, ADR-0038 reeval chain / RecentDeletionController).
// 선택 personId 를 path param 으로 부착한다. encodeURIComponent 로 비정상 문자가 든 personId 도
// path 가 깨지지 않게 안전 인코딩한다(buildExportPath 의 안전 인코딩 convention 정합).
function buildRecentDeletionPath(personId: string): string {
  return `${SCHEDULES_PATH}/recent-deletion/${encodeURIComponent(personId)}`;
}

// onTrigger 의 재평가 POST + state-전이 로직에 주입하는 deps(T-0886 — runImport/runTrigger 의
// *Deps 주입 convention 차용. jsdom/렌더러 없이 mutation 본체를 직접 검증한다). ReEvaluationTriggerPanel
// 은 submitting 우선/error 분기를 이미 박제하므로 컨테이너는 단일 submitting·error setter 만 공유한다.
interface ReEvaluationDeps {
  // 재평가 POST 발사 primitive — apiClient.request 를 주입한다(테스트는 mock 주입).
  post: (path: string, options: RequestOptions) => Promise<unknown>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입).
  describeError: (e: unknown) => string;
  // 현재 재평가 in-flight 여부 — true 면 미발사(동시 재호출·이중 발사 가드).
  submitting: boolean;
  setSubmitting: (next: boolean) => void;
  setError: (next: string | undefined) => void;
}

// onTrigger 의 POST /api/schedules/recent-deletion/:personId + state-전이 로직을 캡슐화한 순수
// async 러너(T-0886 — runTrigger 캡슐화 패턴 차용). 컨테이너의 handleReevalTrigger 는 이 러너에
// 선택 personId·window days·in-flight 여부(submitting)·상태 setter 를 주입해 호출만 한다. 동작:
//  - 빈/falsy personId(인원 미선택) → 미발사(발사 억제 — path param 누락·잘못된 요청 방어, 택1 구현).
//  - submitting(이전 재평가 미완) → 미발사(이중 POST·state 경합 차단 — runTrigger busy 가드 동형).
//  - 발사 시 진행 on + 이전 error 비움 → POST { instants: [], days } → 성공(error 없음 유지) /
//    실패(error 문구 표면화 — throw 없이) → 진행 off(공통).
// body 의 instants 는 빈 배열([])로 고정한다(RecentDeletionDto 가 빈 배열 허용 — no-op 정상 경로).
// 선택 person 의 최근 N일 실제 instant 자동 도출은 Out of Scope(별도 GET 필요 — Follow-up).
async function runReEvaluate(
  personId: string,
  days: number,
  deps: ReEvaluationDeps,
): Promise<void> {
  // 비정상 호출 가드 — 빈/falsy personId(인원 미선택)는 POST 미발사(path param 누락 방어 — 발사 억제).
  if (!personId) {
    return;
  }
  // 동시 재호출 가드 — 이전 재평가 미완 중이면 미발사(이중 POST·state 경합 차단).
  if (deps.submitting) {
    return;
  }
  deps.setSubmitting(true);
  // 재발화 시작 시 직전 error 를 비운다(실패 후 재시도 시 직전 error 정리 — 새 재평가 진행만 남도록).
  deps.setError(undefined);
  try {
    // POST /api/schedules/recent-deletion/:personId — 선택 window 의 days 를 body.days 로,
    // instants 는 빈 배열([])로 공급한다(DTO 빈 배열 허용 no-op — instant 자동 도출은 후속). 202
    // Accepted fire-and-forget. 응답 body(deletedCount/recollected)는 소비하지 않으므로(건수 표시
    // 는 후속) 성공 사실만 확인한다.
    await deps.post(buildRecentDeletionPath(personId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instants: [], days }),
    });
    // 성공 — 방금 비운 error(undefined)를 유지한다(패널이 정상 트리거 폼을 렌더 — 완료 문구 소비
    // 상태). 성공 message props 는 panel 계약에 없어(submitting/error/confirmText 만) 별도 설정 불요.
  } catch (e) {
    // 실패 — 사람-친화 문구를 error props 로 안전 표시(throw 없이). 403 Admin+ 미만 / 400 잘못된
    // body / 404 / 비-2xx / 네트워크 0 모두 ApiError.status → toErrorMessage 파생으로 표면화.
    deps.setError(deps.describeError(e));
  } finally {
    deps.setSubmitting(false);
  }
}

// onRemove 의 멤버 제거 DELETE + state-전이 로직에 주입하는 deps(T-1130 — ④c runAssign /
// ④e runImport 의 *Deps 주입 convention 차용. jsdom/렌더러 없이 mutation 본체를 직접 검증한다).
// 컨테이너의 handleRemove 는 이 러너에 선택 groupId·현재 in-flight 여부(removing)·상태 setter·
// 재조회 트리거를 주입해 호출만 한다.
interface RemoveDeps {
  // DELETE 발사 primitive — apiClient.request 를 주입한다(테스트는 mock 주입).
  remove: (path: string, options: RequestOptions) => Promise<unknown>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입).
  describeError: (e: unknown) => string;
  // 선택 그룹 id — DELETE path 의 :id param. encodeURIComponent 로 안전 인코딩된다.
  groupId: string;
  // 현재 remove in-flight 여부 — true 면 미발사(이중 DELETE·경합 가드).
  removing: boolean;
  setRemoving: (next: boolean) => void;
  setRemoveError: (next: string | undefined) => void;
  // 권위 멤버십 재조회 트리거 — membersRefreshNonce 를 +1 한다(path 변경 유발).
  bumpRefresh: () => void;
}

// onRemove 의 DELETE /api/groups/:id/members/:membershipId + state-전이 로직을 캡슐화한 순수
// async 러너(T-1130 — runAssign/runImport 캡슐화 패턴 차용). backend DELETE(group.controller.ts
// 198~205, 204 No Content, service removeMember(membershipId) — row 부재 시 P2025→NotFoundException)
// 를 발사한다. 컨테이너의 handleRemove 는 이 러너에 deps 를 주입해 호출만 한다. 동작:
//  - 빈/falsy membershipId → 미발사(잘못된 path·불필요 DELETE 회피).
//  - removing(이전 mutation 미완) → 미발사(이중 DELETE·state 경합 차단 — runAssign assigning 가드 동형).
//  - 발사 시 진행 on + 직전 error 비움 → DELETE(groupId·membershipId 는 encodeURIComponent 안전
//    인코딩) → 성공(멤버십 재조회 트리거) / 실패(사람-친화 문구 표면화 — throw 없이) → 진행 off(공통).
async function runRemove(
  membershipId: string,
  deps: RemoveDeps,
): Promise<void> {
  // 비정상 호출 가드 — 빈/falsy membershipId 는 DELETE 미발사(잘못된 path·불필요 요청 회피).
  if (!membershipId) {
    return;
  }
  // 동시 재호출 가드 — 이전 remove 미완 중이면 미발사(이중 DELETE·state 경합 차단).
  if (deps.removing) {
    return;
  }
  deps.setRemoving(true);
  // 재발화 시작 시 직전 error 를 비운다(실패 후 재시도 시 직전 error 정리 — 새 remove 진행만 남도록).
  deps.setRemoveError(undefined);
  try {
    // DELETE /api/groups/:id/members/:membershipId — 204 No Content. groupId·membershipId 모두
    // encodeURIComponent 로 안전 인코딩(비정상 문자가 든 id 도 path 가 깨지지 않게). 응답 body 를
    // 소비하지 않으므로(No Content) 성공 사실만 확인한다.
    await deps.remove(
      `/api/groups/${encodeURIComponent(deps.groupId)}/members/${encodeURIComponent(membershipId)}`,
      { method: 'DELETE' },
    );
    // 성공 — 권위 멤버십 재조회 트리거(재조회로 제거된 행이 목록에서 사라진다 — 낙관 override 없음).
    deps.bumpRefresh();
  } catch (e) {
    // 실패 — 사람-친화 문구를 error props 로 안전 표시(throw 없이). 404 NotFound(row 부재) /
    // 403 Admin+ 미만 / 비-2xx / 네트워크 0 모두 ApiError.status → toErrorMessage 파생으로 표면화.
    // 재조회 nonce 는 bump 하지 않는다(실패 시 목록 그대로 유지).
    deps.setRemoveError(deps.describeError(e));
  } finally {
    deps.setRemoving(false);
  }
}

// provider 삭제 DELETE + state-전이 로직에 주입하는 deps(T-1135 — runRemove 의 RemoveDeps 를
// 1:1 mirror. jsdom/렌더러 없이 mutation 본체를 직접 검증한다). RemoveDeps 와 달리 path param 이
// provider id 하나뿐이라 groupId 는 없다(DELETE /api/llm/providers/:id 는 단일 세그먼트). 컨테이너의
// handleDeleteProvider 는 이 러너에 현재 in-flight 여부(deleting)·상태 setter·재조회 트리거를 주입해
// 호출만 한다.
interface DeleteProviderDeps {
  // DELETE 발사 primitive — apiClient.request 를 주입한다(테스트는 mock 주입).
  remove: (path: string, options: RequestOptions) => Promise<unknown>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입).
  describeError: (e: unknown) => string;
  // 현재 삭제 in-flight 여부 — true 면 미발사(이중 DELETE·경합 가드).
  deleting: boolean;
  setDeleting: (next: boolean) => void;
  setDeleteError: (next: string | undefined) => void;
  // 권위 provider 재조회 트리거 — providersRefreshNonce 를 +1 한다(path 변경 유발).
  bumpRefresh: () => void;
}

// provider 삭제 DELETE /api/llm/providers/:id + state-전이 로직을 캡슐화한 순수 async 러너(T-1135 —
// runRemove 캡슐화 패턴 1:1 mirror). backend DELETE(llm.controller, 204 No Content, config row 부재
// 시 P2025→NotFoundException, in-use 시 409, Admin+ 미만 403)를 발사한다. 컨테이너의
// handleDeleteProvider 는 이 러너에 deps 를 주입해 호출만 한다. 동작:
//  - 빈/공백/falsy id → 미발사(잘못된 path·불필요 DELETE 회피 — trim 후 빈 문자열도 차단).
//  - deleting(이전 mutation 미완) → 미발사(이중 DELETE·state 경합 차단 — runRemove removing 가드 동형).
//  - 발사 시 진행 on + 직전 error 비움 → DELETE(id 는 encodeURIComponent 안전 인코딩) → 성공(provider
//    재조회 트리거) / 실패(사람-친화 문구 표면화 — throw 없이) → 진행 off(공통).
async function runDeleteProvider(
  id: string,
  deps: DeleteProviderDeps,
): Promise<void> {
  // 비정상 호출 가드 — 빈/공백/falsy id 는 DELETE 미발사(잘못된 path·불필요 요청 회피). 공백만
  // 든 id 도 trim 후 빈 문자열이면 차단해(경계값) 무의미한 `/api/llm/providers/%20` 발사를 막는다.
  if (!id || id.trim() === '') {
    return;
  }
  // 동시 재호출 가드 — 이전 삭제 미완 중이면 미발사(이중 DELETE·state 경합 차단).
  if (deps.deleting) {
    return;
  }
  deps.setDeleting(true);
  // 재발화 시작 시 직전 error 를 비운다(실패 후 재시도 시 직전 error 정리 — 새 삭제 진행만 남도록).
  deps.setDeleteError(undefined);
  try {
    // DELETE /api/llm/providers/:id — 204 No Content. id 는 encodeURIComponent 로 안전 인코딩(비정상
    // 문자가 든 id 도 path 가 깨지지 않게). 응답 body 를 소비하지 않으므로 성공 사실만 확인한다.
    await deps.remove(`${LLM_PROVIDERS_PATH}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    // 성공 — 권위 provider 재조회 트리거(재조회로 삭제된 행이 목록에서 사라진다 — 낙관 제거 없음).
    deps.bumpRefresh();
  } catch (e) {
    // 실패 — 사람-친화 문구를 error props 로 안전 표시(throw 없이). 404 NotFound(row 부재) / 409
    // in-use / 403 Admin+ 미만 / 비-2xx / 네트워크 0 모두 ApiError.status → toErrorMessage 파생으로
    // 표면화. 재조회 nonce 는 bump 하지 않는다(실패 시 목록 그대로 유지).
    deps.setDeleteError(deps.describeError(e));
  } finally {
    deps.setDeleting(false);
  }
}

// 멤버 추가 POST + state-전이 로직에 주입하는 deps(T-1131 — runRemove 의 RemoveDeps 를 1:1 mirror.
// jsdom/렌더러 없이 mutation 본체를 직접 검증한다). 컨테이너의 handleAdd 는 이 러너에 선택
// groupId·입력 personId·현재 in-flight 여부(adding)·상태 setter·재조회 트리거·입력 초기화를
// 주입해 호출만 한다.
interface AddDeps {
  // POST 발사 primitive — apiClient.request 를 주입한다(테스트는 mock 주입).
  add: (path: string, options: RequestOptions) => Promise<unknown>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입).
  describeError: (e: unknown) => string;
  // 선택 그룹 id — POST path 의 :id param. encodeURIComponent 로 안전 인코딩된다.
  groupId: string;
  // 현재 add in-flight 여부 — true 면 미발사(이중 POST·경합 가드).
  adding: boolean;
  setAdding: (next: boolean) => void;
  setAddError: (next: string | undefined) => void;
  // 권위 멤버십 재조회 트리거 — membersRefreshNonce 를 +1 한다(path 변경 유발).
  bumpRefresh: () => void;
  // 성공 후 personId 입력 초기화 트리거(빈 값으로 되돌림 — 연속 추가 편의).
  resetInput: () => void;
}

// 멤버 추가 POST /api/groups/:id/members(body `{ personId }`) + state-전이 로직을 캡슐화한 순수
// async 러너(T-1131 — runRemove mirror). backend addMember(group.controller.ts, 201 Created,
// AddMemberDto `{ personId }`, @@unique([personId, groupId]) 위반 시 P2002→409) 를 발사한다.
// 컨테이너의 handleAdd 는 이 러너에 deps 를 주입해 호출만 한다. 동작:
//  - 빈/공백만 personId → 미발사(잘못된 body·400 회피 — trim 후 falsy 면 억제).
//  - 선택 그룹 미선택(빈 groupId) → 미발사(잘못된 path·불필요 POST 회피).
//  - adding(이전 mutation 미완) → 미발사(이중 POST·state 경합 차단 — runRemove removing 가드 동형).
//  - 발사 시 진행 on + 직전 error 비움 → POST(groupId 는 encodeURIComponent 안전 인코딩, body 는
//    trim 된 personId) → 성공(멤버십 재조회 트리거 + 입력 초기화) / 실패(사람-친화 문구 표면화 —
//    throw 없이) → 진행 off(공통).
async function runAdd(personId: string, deps: AddDeps): Promise<void> {
  // 빈/공백 방어 — 앞뒤 공백을 제거한 뒤 비어 있으면 POST 미발사(잘못된 body·400 회피).
  const trimmed = personId?.trim();
  if (!trimmed) {
    return;
  }
  // 그룹 미선택 가드 — 선택 그룹이 없으면 path 의 :id 가 비므로 미발사(불필요 POST·잘못된 path 회피).
  if (!deps.groupId) {
    return;
  }
  // 동시 재호출 가드 — 이전 add 미완 중이면 미발사(이중 POST·state 경합 차단).
  if (deps.adding) {
    return;
  }
  deps.setAdding(true);
  // 재발화 시작 시 직전 error 를 비운다(실패 후 재시도 시 직전 error 정리 — 새 add 진행만 남도록).
  deps.setAddError(undefined);
  try {
    // POST /api/groups/:id/members — 201 Created. groupId 는 encodeURIComponent 로 안전 인코딩하고,
    // body 는 trim 된 personId 를 JSON 으로 전송한다(runApply 의 JSON body 발사 convention 동형).
    await deps.add(`/api/groups/${encodeURIComponent(deps.groupId)}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId: trimmed }),
    });
    // 성공 — 권위 멤버십 재조회 트리거(재조회로 추가된 행이 목록에 나타난다 — 낙관 override 없음) +
    // 입력 초기화(연속 추가 시 직전 값 잔존 방지).
    deps.bumpRefresh();
    deps.resetInput();
  } catch (e) {
    // 실패 — 사람-친화 문구를 error props 로 안전 표시(throw 없이). 409 중복 멤버(@@unique) /
    // 403 Admin+ 미만 / 404 group 부재 / 400 빈 personId / 비-2xx / 네트워크 0 모두 ApiError.status
    // → toErrorMessage 파생으로 표면화. 재조회 nonce·입력은 건드리지 않는다(실패 시 입력 유지).
    deps.setAddError(deps.describeError(e));
  } finally {
    deps.setAdding(false);
  }
}

// provider 생성 POST 4 필드 묶음(T-1136) — 컨테이너의 4 controlled input 값을 러너에 한 덩어리로
// 넘긴다. 러너가 각 필드를 trim 해 빈/공백 가드에 쓰고, 유효 시 body 로 JSON 직렬화한다. secret
// apiKey 는 생성 body 전송만 담당하며 응답·목록·error 어디에도 재노출되지 않는다.
interface CreateProviderFields {
  provider: string;
  endpointUrl: string;
  apiKey: string;
  modelId: string;
}

// provider 생성 POST + state-전이 로직에 주입하는 deps(T-1136 — runAdd 의 AddDeps 를 mirror.
// jsdom/렌더러 없이 mutation 본체를 직접 검증한다). 컨테이너의 handleCreateProvider 는 이 러너에
// 4 입력값(CreateProviderFields)·현재 in-flight 여부(creating)·상태 setter·재조회 트리거·입력
// 초기화를 주입해 호출만 한다. path param 이 없어(POST /api/llm/providers) groupId 는 없다.
interface CreateProviderDeps {
  // POST 발사 primitive — apiClient.request 를 주입한다(테스트는 mock 주입).
  create: (path: string, options: RequestOptions) => Promise<unknown>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입).
  describeError: (e: unknown) => string;
  // 현재 create in-flight 여부 — true 면 미발사(이중 POST·경합 가드).
  creating: boolean;
  setCreating: (next: boolean) => void;
  setCreateError: (next: string | undefined) => void;
  // 권위 provider 재조회 트리거 — providersRefreshNonce 를 +1 한다(path 변경 유발).
  bumpRefresh: () => void;
  // 성공 후 4 입력 초기화 트리거(빈 값으로 되돌림 — 연속 생성 편의 + secret apiKey 잔존 방지).
  resetInput: () => void;
}

// provider 생성 POST /api/llm/providers(body `{ provider, endpointUrl, apiKey, modelId }`) +
// state-전이 로직을 캡슐화한 순수 async 러너(T-1136 — runAdd mirror). backend createProvider
// (llm.controller, 201 Created, CreateLlmProviderDto 4 필드, isLlmProvider 미지원 provider →
// 400, 중복 → 409, Admin+ 미만 403)를 발사한다. 컨테이너의 handleCreateProvider 는 이 러너에
// deps 를 주입해 호출만 한다. 동작:
//  - 4 필드 중 하나라도 빈/공백만 → 미발사(잘못된 body·400 회피 — 각 필드 trim 후 falsy 면 억제).
//  - creating(이전 mutation 미완) → 미발사(이중 POST·state 경합 차단 — runAdd adding 가드 동형).
//  - 발사 시 진행 on + 직전 error 비움 → POST(trim 된 4 필드 JSON body) → 성공(provider 재조회
//    트리거 + 입력 초기화) / 실패(사람-친화 문구 표면화 — throw 없이) → 진행 off(공통).
async function runCreateProvider(
  fields: CreateProviderFields,
  deps: CreateProviderDeps,
): Promise<void> {
  // 필수 4 필드 빈/공백 방어 — 각 필드 앞뒤 공백 제거 후 하나라도 비면 POST 미발사(잘못된 body·
  // 400 회피). secret apiKey 도 동일하게 trim 후 빈값이면 차단한다(무의미한 생성 요청 억제).
  const provider = fields.provider?.trim();
  const endpointUrl = fields.endpointUrl?.trim();
  const apiKey = fields.apiKey?.trim();
  const modelId = fields.modelId?.trim();
  if (!provider || !endpointUrl || !apiKey || !modelId) {
    return;
  }
  // 동시 재호출 가드 — 이전 create 미완 중이면 미발사(이중 POST·state 경합 차단).
  if (deps.creating) {
    return;
  }
  deps.setCreating(true);
  // 재발화 시작 시 직전 error 를 비운다(실패 후 재시도 시 직전 error 정리 — 새 create 진행만 남도록).
  deps.setCreateError(undefined);
  try {
    // POST /api/llm/providers — 201 Created. trim 된 4 필드를 JSON body 로 전송한다(runAdd 의
    // JSON body 발사 convention 동형). apiKey 는 생성 시점 평문 전송만 담당하고 응답을 소비하지
    // 않으므로(성공 사실만 확인) 목록·error 어디에도 재노출되지 않는다.
    await deps.create(LLM_PROVIDERS_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, endpointUrl, apiKey, modelId }),
    });
    // 성공 — 권위 provider 재조회 트리거(재조회로 생성된 행이 목록에 나타난다 — 낙관 추가 없음) +
    // 입력 초기화(연속 생성 시 직전 값·secret apiKey 잔존 방지).
    deps.bumpRefresh();
    deps.resetInput();
  } catch (e) {
    // 실패 — 사람-친화 문구를 error state 로 안전 표시(throw 없이). 400 검증 실패(미지원 provider·
    // 빈 필드) / 409 중복 / 403 Admin+ 미만 / 비-2xx / 네트워크 0 모두 ApiError.status →
    // toErrorMessage 파생으로 표면화. 재조회 nonce·입력은 건드리지 않는다(실패 시 입력 유지).
    deps.setCreateError(deps.describeError(e));
  } finally {
    deps.setCreating(false);
  }
}

// 인원 생성 POST 2 필드 묶음(T-1143) — 컨테이너의 2 controlled input(fullName/email) 값을 러너에
// 한 덩어리로 넘긴다. 러너가 각 필드를 trim 해 빈/공백 가드에 쓰고, 유효 시 body 로 JSON 직렬화한다.
// active 는 Prisma default(true)라 body 에서 제외한다(CreatePersonDto 2 필드만 — src/user/dto).
interface CreatePersonFields {
  fullName: string;
  email: string;
}

// 인원 생성 POST + state-전이 로직에 주입하는 deps(T-1143 — runCreateProvider 의 CreateProviderDeps
// 를 mirror. jsdom/렌더러 없이 mutation 본체를 직접 검증한다). 컨테이너의 handleCreatePerson 은 이
// 러너에 2 입력값(CreatePersonFields)·현재 in-flight 여부(creating)·상태 setter·재조회 트리거·입력
// 초기화를 주입해 호출만 한다. path param 이 없어(POST /api/persons) id 는 없다.
interface CreatePersonDeps {
  // POST 발사 primitive — apiClient.request 를 주입한다(테스트는 mock 주입).
  create: (path: string, options: RequestOptions) => Promise<unknown>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입).
  describeError: (e: unknown) => string;
  // 현재 create in-flight 여부 — true 면 미발사(이중 POST·경합 가드).
  creating: boolean;
  setCreating: (next: boolean) => void;
  setCreateError: (next: string | undefined) => void;
  // 권위 인원 재조회 트리거 — personsRefreshNonce 를 +1 한다(path 변경 유발).
  bumpRefresh: () => void;
  // 성공 후 2 입력 초기화 트리거(빈 값으로 되돌림 — 연속 생성 편의).
  resetInput: () => void;
}

// 인원 생성 POST /api/persons(body `{ fullName, email }`) + state-전이 로직을 캡슐화한 순수 async
// 러너(T-1143 — runCreateProvider mirror). backend create(person.controller, 201 Created,
// CreatePersonDto 2 필드, email 중복 → 409 Conflict, 검증 실패 → 400)를 발사한다. 컨테이너의
// handleCreatePerson 은 이 러너에 deps 를 주입해 호출만 한다. 동작:
//  - 2 필드 중 하나라도 빈/공백만 → 미발사(잘못된 body·400 회피 — 각 필드 trim 후 falsy 면 억제).
//  - creating(이전 mutation 미완) → 미발사(이중 POST·state 경합 차단 — runCreateProvider 가드 동형).
//  - 발사 시 진행 on + 직전 error 비움 → POST(trim 된 2 필드 JSON body) → 성공(인원 재조회
//    트리거 + 입력 초기화) / 실패(사람-친화 문구 표면화 — throw 없이) → 진행 off(공통).
async function runCreatePerson(
  fields: CreatePersonFields,
  deps: CreatePersonDeps,
): Promise<void> {
  // 필수 2 필드 빈/공백 방어 — 각 필드 앞뒤 공백 제거 후 하나라도 비면 POST 미발사(잘못된 body·
  // 400 회피). fullName/email 어느 쪽이든 trim 후 빈 값이면 차단한다(무의미한 생성 요청 억제).
  const fullName = fields.fullName?.trim();
  const email = fields.email?.trim();
  if (!fullName || !email) {
    return;
  }
  // 동시 재호출 가드 — 이전 create 미완 중이면 미발사(이중 POST·state 경합 차단).
  if (deps.creating) {
    return;
  }
  deps.setCreating(true);
  // 재발화 시작 시 직전 error 를 비운다(실패 후 재시도 시 직전 error 정리 — 새 create 진행만 남도록).
  deps.setCreateError(undefined);
  try {
    // POST /api/persons — 201 Created. trim 된 2 필드를 JSON body 로 전송한다(runCreateProvider 의
    // JSON body 발사 convention 동형). active 는 backend Prisma default(true)가 채우므로 미포함.
    await deps.create(PERSONS_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email }),
    });
    // 성공 — 권위 인원 재조회 트리거(재조회로 생성된 행이 목록에 나타난다 — 낙관 추가 없음) +
    // 입력 초기화(연속 생성 시 직전 값 잔존 방지).
    deps.bumpRefresh();
    deps.resetInput();
  } catch (e) {
    // 실패 — 사람-친화 문구를 error state 로 안전 표시(throw 없이). 400 검증 실패(빈/잘못된 email)
    // / 409 email 중복 / 비-2xx / 네트워크 0 모두 ApiError.status → toErrorMessage 파생으로
    // 표면화. 재조회 nonce·입력은 건드리지 않는다(실패 시 입력 유지 — 재시도 편의).
    deps.setCreateError(deps.describeError(e));
  } finally {
    deps.setCreating(false);
  }
}

// 그룹 생성 POST + state-전이 로직에 주입하는 deps(T-1146 — runCreatePerson 의 CreatePersonDeps 를
// mirror. jsdom/렌더러 없이 mutation 본체를 직접 검증한다). 컨테이너의 handleCreateGroup 은 이 러너에
// 현재 입력 name·in-flight 여부(creating)·상태 setter·재조회 트리거·입력 초기화를 주입해 호출만 한다.
// 그룹 생성 payload 는 name 단일 필드(CreateGroupDto — src/user/dto/create-group.dto.ts)라 인원 생성의
// 2 필드 대신 name 하나만 다룬다. Group.name 은 @unique 미정의라 409 특수 분기 없이 일반 error 표면화.
interface CreateGroupDeps {
  // POST 발사 primitive — apiClient.request 를 주입한다(테스트는 mock 주입).
  create: (path: string, options: RequestOptions) => Promise<unknown>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입).
  describeError: (e: unknown) => string;
  // 현재 create in-flight 여부 — true 면 미발사(이중 POST·경합 가드).
  creating: boolean;
  setCreating: (next: boolean) => void;
  setCreateError: (next: string | undefined) => void;
  // 권위 그룹 재조회 트리거 — groupsRefreshNonce 를 +1 한다(path 변경 유발).
  bumpRefresh: () => void;
  // 성공 후 name 입력 초기화 트리거(빈 값으로 되돌림 — 연속 생성 편의).
  resetInput: () => void;
}

// 그룹 생성 POST /api/groups(body `{ name }`) + state-전이 로직을 캡슐화한 순수 async 러너(T-1146 —
// runCreatePerson mirror). backend create(group.controller, 201 Created, CreateGroupDto name 단일
// 필드, 검증 실패 → 400. Group.name @unique 미정의라 409 는 거의 없음 — raw forward)를 발사한다.
// 컨테이너의 handleCreateGroup 은 이 러너에 deps 를 주입해 호출만 한다. 동작:
//  - name 이 빈/공백만 → 미발사(잘못된 body·400 회피 — trim 후 falsy 면 억제).
//  - creating(이전 mutation 미완) → 미발사(이중 POST·state 경합 차단 — runCreatePerson 가드 동형).
//  - 발사 시 진행 on + 직전 error 비움 → POST(trim 된 name JSON body) → 성공(그룹 재조회 트리거 +
//    입력 초기화) / 실패(사람-친화 문구 표면화 — throw 없이) → 진행 off(공통).
async function runCreateGroup(
  name: string,
  deps: CreateGroupDeps,
): Promise<void> {
  // 필수 name 빈/공백 방어 — 앞뒤 공백 제거 후 비면 POST 미발사(잘못된 body·400 회피). 공백만 든
  // 입력도 trim 후 빈 문자열이면 차단해(경계값) 무의미한 생성 요청을 억제한다.
  const trimmed = name?.trim();
  if (!trimmed) {
    return;
  }
  // 동시 재호출 가드 — 이전 create 미완 중이면 미발사(이중 POST·state 경합 차단).
  if (deps.creating) {
    return;
  }
  deps.setCreating(true);
  // 재발화 시작 시 직전 error 를 비운다(실패 후 재시도 시 직전 error 정리 — 새 create 진행만 남도록).
  deps.setCreateError(undefined);
  try {
    // POST /api/groups — 201 Created. trim 된 name 을 JSON body 로 전송한다(runCreatePerson 의 JSON
    // body 발사 convention 동형). CreateGroupDto 는 name 단일 필드라 다른 필드는 미포함.
    await deps.create(GROUPS_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    // 성공 — 권위 그룹 재조회 트리거(재조회로 생성된 그룹이 select 옵션에 나타난다 — 낙관 추가 없음) +
    // 입력 초기화(연속 생성 시 직전 값 잔존 방지).
    deps.bumpRefresh();
    deps.resetInput();
  } catch (e) {
    // 실패 — 사람-친화 문구를 error state 로 안전 표시(throw 없이). 400 검증 실패(빈 name) / 드문 409
    // / 비-2xx / 네트워크 0 모두 ApiError.status → toErrorMessage 파생으로 표면화. Group.name 은
    // @unique 미정의라 409 특수 분기 없이 일반 error 로 표면화한다. 재조회 nonce·입력은 유지(재시도 편의).
    deps.setCreateError(deps.describeError(e));
  } finally {
    deps.setCreating(false);
  }
}

// 파트 생성 POST + state-전이 로직에 주입하는 deps(T-1153 — runCreateGroup 의 CreateGroupDeps 를
// mirror. jsdom/렌더러 없이 mutation 본체를 직접 검증한다). 컨테이너의 handleCreatePart 는 이 러너에
// 현재 입력 name·in-flight 여부(creating)·상태 setter·재조회 트리거·입력 초기화를 주입해 호출만 한다.
// 파트 생성 payload 는 name 단일 필드(CreatePartDto — src/user/dto/create-part.dto.ts)라 그룹과 동형.
// 단, Part.name 은 @unique(prisma schema)라 서버가 중복 이름에 409(ConflictException) 를 던지므로,
// 그룹과 달리 409 를 전용 문구로 구분 표면화한다. 그 409 판정은 isConflict 로 주입받아(테스트는 mock
// 주입, 런타임은 ApiError.status===409 검사 주입) 러너를 순수하게 유지한다(describeError 주입 convention 동형).
interface CreatePartDeps {
  // POST 발사 primitive — apiClient.request 를 주입한다(테스트는 mock 주입).
  create: (path: string, options: RequestOptions) => Promise<unknown>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입). 비-409 에러에 쓴다.
  describeError: (e: unknown) => string;
  // throw 표면이 409(중복 이름) 인지 판정 — true 면 PART_DUPLICATE_ERROR 전용 문구를 쓴다.
  // 런타임은 `(e) => e instanceof ApiError && e.status === 409` 주입(순수 판정 분리 — 테스트 용이).
  isConflict: (e: unknown) => boolean;
  // 현재 create in-flight 여부 — true 면 미발사(이중 POST·경합 가드).
  creating: boolean;
  setCreating: (next: boolean) => void;
  setCreateError: (next: string | undefined) => void;
  // 권위 파트 재조회 트리거 — partsRefreshNonce 를 +1 한다(path 변경 유발).
  bumpRefresh: () => void;
  // 성공 후 name 입력 초기화 트리거(빈 값으로 되돌림 — 연속 생성 편의).
  resetInput: () => void;
}

// 파트 생성 POST /api/parts(body `{ name }`) + state-전이 로직을 캡슐화한 순수 async 러너(T-1153 —
// runCreateGroup mirror). backend create(part.controller @Post(), 201 Created, CreatePartDto name
// 단일 필드, 검증 실패 → 400. Part.name @unique 라 중복 이름 → P2002 → ConflictException 409)를
// 발사한다. 컨테이너의 handleCreatePart 는 이 러너에 deps 를 주입해 호출만 한다. 동작:
//  - name 이 빈/공백만 → 미발사(잘못된 body·400 회피 — trim 후 falsy 면 억제).
//  - creating(이전 mutation 미완) → 미발사(이중 POST·state 경합 차단 — runCreateGroup 가드 동형).
//  - 발사 시 진행 on + 직전 error 비움 → POST(trim 된 name JSON body) → 성공(파트 재조회 트리거 +
//    입력 초기화) / 실패 → 진행 off(공통).
//  - 실패가 409(중복 이름)면 PART_DUPLICATE_ERROR 전용 문구, 그 외(400·403·네트워크·비-2xx)는
//    describeError 파생 일반 문구를 error state 로 표면화한다(throw 없이). 재조회 nonce·입력은 유지(재시도 편의).
async function runCreatePart(
  name: string,
  deps: CreatePartDeps,
): Promise<void> {
  // 필수 name 빈/공백 방어 — 앞뒤 공백 제거 후 비면 POST 미발사(잘못된 body·400 회피). 공백만 든
  // 입력도 trim 후 빈 문자열이면 차단해(경계값) 무의미한 생성 요청을 억제한다(runCreateGroup 동형).
  const trimmed = name?.trim();
  if (!trimmed) {
    return;
  }
  // 동시 재호출 가드 — 이전 create 미완 중이면 미발사(이중 POST·state 경합 차단).
  if (deps.creating) {
    return;
  }
  deps.setCreating(true);
  // 재발화 시작 시 직전 error 를 비운다(실패 후 재시도 시 직전 error 정리 — 새 create 진행만 남도록).
  // 이 초기 비움 덕에 409 중복 후 재입력·재시도 시 직전 중복 문구도 함께 정리된다(negative cover).
  deps.setCreateError(undefined);
  try {
    // POST /api/parts — 201 Created. trim 된 name 을 JSON body 로 전송한다(runCreateGroup 의 JSON
    // body 발사 convention 동형). CreatePartDto 는 name 단일 필드라 다른 필드는 미포함.
    await deps.create(PARTS_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    // 성공 — 권위 파트 재조회 트리거(재조회로 생성된 파트가 목록에 나타난다 — 낙관 추가 없음) +
    // 입력 초기화(연속 생성 시 직전 값 잔존 방지).
    deps.bumpRefresh();
    deps.resetInput();
  } catch (e) {
    // 실패 — throw 없이 error state 로 안전 표시. 409(Part.name @unique 위반 → ConflictException)면
    // 원인이 분명한 전용 중복 문구를, 그 외(400 검증 실패·403 Admin+ 미만·비-2xx·네트워크 0)는
    // describeError 파생 일반 문구를 쓴다. 그룹(409 없음)과 달리 파트는 409 를 명시 분기한다.
    if (deps.isConflict(e)) {
      deps.setCreateError(PART_DUPLICATE_ERROR);
    } else {
      deps.setCreateError(deps.describeError(e));
    }
  } finally {
    deps.setCreating(false);
  }
}

// 사용자 생성 POST + state-전이 deps(T-1160 — 위 CreatePartDeps 1:1 mirror, 필드 의미는 그쪽 주석).
interface CreateUserDeps {
  create: (path: string, options: RequestOptions) => Promise<unknown>;
  describeError: (e: unknown) => string;
  isConflict: (e: unknown) => boolean;
  creating: boolean;
  setCreating: (next: boolean) => void;
  setCreateError: (next: string | undefined) => void;
  bumpRefresh: () => void;
  resetInput: () => void;
}

// 사용자 생성 POST /api/users(body `{ email, password }`) + state-전이를 캡슐화한 순수 async 러너
// (T-1160 — 위 runCreatePart mirror). backend(user.controller @Post(), guard 없는 Public tier, 201
// Created, AddUserDto 검증 실패 → 400, email 중복 → 409)를 발사한다. 동작: 빈 입력·in-flight 면
// 미발사 / 발사 시 진행 on + 직전 error 비움 / 성공 시 재조회 bump + 입력 초기화 / 실패는 throw
// 없이 error state(409 전용 문구, 그 외 describeError 파생, 입력·nonce 유지) / off 는 finally 공통.
async function runCreateUser(
  email: string,
  password: string,
  deps: CreateUserDeps,
): Promise<void> {
  // 발사 억제 가드(no-op — 상태 전이 0). password 는 공백도 유효 문자라 빈 문자열만 차단한다.
  const trimmedEmail = email?.trim();
  if (!trimmedEmail || !password || deps.creating) {
    return;
  }
  deps.setCreating(true);
  deps.setCreateError(undefined);
  try {
    await deps.create(USERS_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmedEmail, password }),
    });
    deps.bumpRefresh();
    deps.resetInput();
  } catch (e) {
    if (deps.isConflict(e)) {
      deps.setCreateError(USER_DUPLICATE_ERROR);
    } else {
      deps.setCreateError(deps.describeError(e));
    }
  } finally {
    deps.setCreating(false);
  }
}

// 사용자 역할 변경 PATCH + state-전이 deps(T-1162 — 위 CreateUserDeps 1:1 mirror, 필드 의미는 그쪽
// 주석). 생성과 달리 입력 폼이 없어 resetInput 이 없고, 409(중복) 대신 403(권한 부족)을 분기한다.
interface ChangeRoleDeps {
  patch: (path: string, options: RequestOptions) => Promise<unknown>;
  describeError: (e: unknown) => string;
  isForbidden: (e: unknown) => boolean;
  // 현재 PATCH 진행 중인 사용자 id(T-1164 — 기존 boolean `changing` 을 대체). undefined 는 "진행
  // 없음" 을 뜻하며, truthy 면 그 id 의 역할 변경 요청이 in-flight 라는 사실을 그대로 표현한다.
  changingId: string | undefined;
  // 진행 중인 사용자 id setter — 발사 시작 시 대상 id, 종료 시 undefined("진행 없음")를 넣는다.
  setChangingId: (next: string | undefined) => void;
  setChangeError: (next: string | undefined) => void;
  bumpRefresh: () => void;
}

// 사용자 역할 변경 PATCH /api/users/:id/role(body `{ role }`) + state-전이를 캡슐화한 순수 async
// 러너(T-1162 — 위 runCreateUser mirror). backend(user.controller @Patch(":id/role"), @Roles
// ("SuperAdmin"), ChangeRoleDto 검증 실패 → 400, 비-SuperAdmin·self-demote → 403, 대상 부재 →
// 404, 응답 UserResponseDto)를 발사한다. 동작: 빈 인자·in-flight 면 미발사 / 발사 시 진행 on +
// 직전 error 비움 / 성공 시 재조회 bump(낙관 갱신 금지 — 권위 재조회) / 실패는 throw 없이 error
// state(403 전용 문구, 그 외 describeError 파생) / off 는 finally 공통.
async function runChangeRole(
  id: string,
  nextRole: string,
  deps: ChangeRoleDeps,
): Promise<void> {
  // 발사 억제 가드(no-op — 상태 전이 0). id·nextRole 이 빈 값이면 `/api/users//role` 같은 깨진
  // path 나 400 확정 body 를 만들지 않는다.
  const trimmedId = id?.trim();
  const trimmedRole = nextRole?.trim();
  // 단일 in-flight 정책 — 진행 중인 id 가 무엇이든(다른 사용자 행이어도) 새 발사는 no-op.
  if (!trimmedId || !trimmedRole || deps.changingId) {
    return;
  }
  // 진행 id 로는 trim 하지 않은 원본 id 를 박제한다(T-1164) — UserList 는 `row.id === changingRoleId`
  // 원본 동등 비교로 진행 행을 찾으므로 trim 값을 넣으면 진행 표시가 매칭되지 않는다. 아래 PATCH
  // path 의 encodeURIComponent(trimmedId) 와 값이 의도적으로 다를 수 있다(각각 별개 계약).
  deps.setChangingId(id);
  deps.setChangeError(undefined);
  try {
    // id 는 encodeURIComponent 로 안전 인코딩(비정상 문자가 든 id 도 path 가 깨지지 않게).
    await deps.patch(`${USERS_PATH}/${encodeURIComponent(trimmedId)}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: trimmedRole }),
    });
    // 권위 재조회 — 응답 body 로 목록을 낙관 갱신하지 않고 nonce bump 로 GET 을 다시 발사한다.
    deps.bumpRefresh();
  } catch (e) {
    if (deps.isForbidden(e)) {
      deps.setChangeError(USER_ROLE_FORBIDDEN_ERROR);
    } else {
      deps.setChangeError(deps.describeError(e));
    }
  } finally {
    // 성공·실패 무관하게 진행 id 를 비운다(진행 표시 영구 잔류 0 — 기존 setChanging(false) 동형).
    deps.setChangingId(undefined);
  }
}

// 진행 중인 id 를 읽고 쓰는 gate(T-1165). 위 러너에 주입되는 changingId 의 "출처" 만 바꾸는
// 장치이며 러너 본체·ChangeRoleDeps 계약은 무변경이다.
interface InFlightIdGate {
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
function createInFlightIdGate(
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

// 인원 삭제 DELETE + state-전이 로직에 주입하는 deps(T-1144 — runDeleteProvider 의 DeleteProviderDeps
// 를 1:1 mirror. jsdom/렌더러 없이 mutation 본체를 직접 검증한다). path param 이 person id 하나뿐이라
// (DELETE /api/persons/:id 는 단일 세그먼트) groupId 는 없다. 컨테이너의 handleDeletePerson 은 이 러너에
// 현재 in-flight 여부(deleting)·상태 setter·재조회 트리거를 주입해 호출만 한다.
interface DeletePersonDeps {
  // DELETE 발사 primitive — apiClient.request 를 주입한다(테스트는 mock 주입).
  remove: (path: string, options: RequestOptions) => Promise<unknown>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입).
  describeError: (e: unknown) => string;
  // 현재 삭제 in-flight 여부 — true 면 미발사(이중 DELETE·경합 가드).
  deleting: boolean;
  setDeleting: (next: boolean) => void;
  setDeleteError: (next: string | undefined) => void;
  // 권위 인원 재조회 트리거 — personsRefreshNonce 를 +1 한다(path 변경 유발).
  bumpRefresh: () => void;
}

// 인원 삭제 DELETE /api/persons/:id + state-전이 로직을 캡슐화한 순수 async 러너(T-1144 —
// runDeleteProvider 캡슐화 패턴 1:1 mirror). backend DELETE(person.controller, 204 No Content, row
// 부재 시 P2025→404, Admin+ 미만 403)를 발사한다. 컨테이너의 handleDeletePerson 은 이 러너에 deps 를
// 주입해 호출만 한다. 동작:
//  - 빈/공백/falsy id → 미발사(잘못된 path·불필요 DELETE 회피 — trim 후 빈 문자열도 차단).
//  - deleting(이전 mutation 미완) → 미발사(이중 DELETE·state 경합 차단 — runDeleteProvider 가드 동형).
//  - 발사 시 진행 on + 직전 error 비움 → DELETE(id 는 encodeURIComponent 안전 인코딩) → 성공(인원
//    재조회 트리거) / 실패(사람-친화 문구 표면화 — throw 없이) → 진행 off(공통).
async function runDeletePerson(
  id: string,
  deps: DeletePersonDeps,
): Promise<void> {
  // 비정상 호출 가드 — 빈/공백/falsy id 는 DELETE 미발사(잘못된 path·불필요 요청 회피). 공백만
  // 든 id 도 trim 후 빈 문자열이면 차단해(경계값) 무의미한 `/api/persons/%20` 발사를 막는다.
  if (!id || id.trim() === '') {
    return;
  }
  // 동시 재호출 가드 — 이전 삭제 미완 중이면 미발사(이중 DELETE·state 경합 차단).
  if (deps.deleting) {
    return;
  }
  deps.setDeleting(true);
  // 재발화 시작 시 직전 error 를 비운다(실패 후 재시도 시 직전 error 정리 — 새 삭제 진행만 남도록).
  deps.setDeleteError(undefined);
  try {
    // DELETE /api/persons/:id — 204 No Content. id 는 encodeURIComponent 로 안전 인코딩(비정상
    // 문자가 든 id 도 path 가 깨지지 않게). 응답 body 를 소비하지 않으므로 성공 사실만 확인한다.
    await deps.remove(`${PERSONS_PATH}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    // 성공 — 권위 인원 재조회 트리거(재조회로 삭제된 행이 목록에서 사라진다 — 낙관 제거 없음).
    deps.bumpRefresh();
  } catch (e) {
    // 실패 — 사람-친화 문구를 error props 로 안전 표시(throw 없이). 404 NotFound(row 부재) / 403
    // Admin+ 미만 / 비-2xx / 네트워크 0 모두 ApiError.status → toErrorMessage 파생으로 표면화.
    // 재조회 nonce 는 bump 하지 않는다(실패 시 목록 그대로 유지).
    deps.setDeleteError(deps.describeError(e));
  } finally {
    deps.setDeleting(false);
  }
}

// 그룹 삭제 DELETE + state-전이 로직에 주입하는 deps(T-1149 — runDeletePerson 의 DeletePersonDeps 를
// 1:1 mirror. jsdom/렌더러 없이 mutation 본체를 직접 검증한다). path param 이 group id 하나뿐이라
// (DELETE /api/groups/:id 는 단일 세그먼트) 별도 필드는 없다. 컨테이너의 handleDeleteGroup 은 이 러너에
// 현재 in-flight 여부(deleting)·상태 setter·재조회 트리거를 주입해 호출만 한다.
interface DeleteGroupDeps {
  // DELETE 발사 primitive — apiClient.request 를 주입한다(테스트는 mock 주입).
  remove: (path: string, options: RequestOptions) => Promise<unknown>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입).
  describeError: (e: unknown) => string;
  // 현재 삭제 in-flight 여부 — true 면 미발사(이중 DELETE·경합 가드).
  deleting: boolean;
  setDeleting: (next: boolean) => void;
  setDeleteError: (next: string | undefined) => void;
  // 권위 그룹 재조회 트리거 — groupsRefreshNonce 를 +1 한다(path 변경 유발).
  bumpRefresh: () => void;
}

// 그룹 삭제 DELETE /api/groups/:id + state-전이 로직을 캡슐화한 순수 async 러너(T-1149 —
// runDeletePerson 캡슐화 패턴 1:1 mirror). backend DELETE(group.controller @Delete(":id") L187, 204
// No Content, row 부재 시 404, Admin+ 미만 403)를 발사한다. 컨테이너의 handleDeleteGroup 은 이 러너에
// deps 를 주입해 호출만 한다. 동작:
//  - 빈/공백/falsy id → 미발사(잘못된 path·불필요 DELETE 회피 — trim 후 빈 문자열도 차단).
//  - deleting(이전 mutation 미완) → 미발사(이중 DELETE·state 경합 차단 — runDeletePerson 가드 동형).
//  - 발사 시 진행 on + 직전 error 비움 → DELETE(id 는 encodeURIComponent 안전 인코딩) → 성공(그룹
//    재조회 트리거) / 실패(사람-친화 문구 표면화 — throw 없이) → 진행 off(공통).
async function runDeleteGroup(
  id: string,
  deps: DeleteGroupDeps,
): Promise<void> {
  // 비정상 호출 가드 — 빈/공백/falsy id 는 DELETE 미발사(잘못된 path·불필요 요청 회피). 공백만
  // 든 id 도 trim 후 빈 문자열이면 차단해(경계값) 무의미한 `/api/groups/%20` 발사를 막는다.
  if (!id || id.trim() === '') {
    return;
  }
  // 동시 재호출 가드 — 이전 삭제 미완 중이면 미발사(이중 DELETE·state 경합 차단).
  if (deps.deleting) {
    return;
  }
  deps.setDeleting(true);
  // 재발화 시작 시 직전 error 를 비운다(실패 후 재시도 시 직전 error 정리 — 새 삭제 진행만 남도록).
  deps.setDeleteError(undefined);
  try {
    // DELETE /api/groups/:id — 204 No Content. id 는 encodeURIComponent 로 안전 인코딩(비정상
    // 문자가 든 id 도 path 가 깨지지 않게). 응답 body 를 소비하지 않으므로 성공 사실만 확인한다.
    await deps.remove(`${GROUPS_PATH}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    // 성공 — 권위 그룹 재조회 트리거(재조회로 삭제된 행이 목록에서 사라진다 — 낙관 제거 없음).
    deps.bumpRefresh();
  } catch (e) {
    // 실패 — 사람-친화 문구를 error props 로 안전 표시(throw 없이). 404 NotFound(row 부재) / 403
    // Admin+ 미만 / 비-2xx / 네트워크 0 모두 ApiError.status → toErrorMessage 파생으로 표면화.
    // 재조회 nonce 는 bump 하지 않는다(실패 시 목록 그대로 유지).
    deps.setDeleteError(deps.describeError(e));
  } finally {
    deps.setDeleting(false);
  }
}

// 파트 삭제 DELETE + state-전이 로직에 주입하는 deps(T-1154 — runDeleteGroup 의 DeleteGroupDeps 를
// 1:1 mirror. jsdom/렌더러 없이 mutation 본체를 직접 검증한다). path param 이 part id 하나뿐이라
// (DELETE /api/parts/:id 는 단일 세그먼트) 별도 필드는 없다. 컨테이너의 handleDeletePart 는 이 러너에
// 현재 in-flight 여부(deleting)·상태 setter·재조회 트리거를 주입해 호출만 한다.
interface DeletePartDeps {
  // DELETE 발사 primitive — apiClient.request 를 주입한다(테스트는 mock 주입).
  remove: (path: string, options: RequestOptions) => Promise<unknown>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입).
  describeError: (e: unknown) => string;
  // 현재 삭제 in-flight 여부 — true 면 미발사(이중 DELETE·경합 가드).
  deleting: boolean;
  setDeleting: (next: boolean) => void;
  setDeleteError: (next: string | undefined) => void;
  // 권위 파트 재조회 트리거 — partsRefreshNonce 를 +1 한다(path 변경 유발).
  bumpRefresh: () => void;
}

// 파트 삭제 DELETE /api/parts/:id + state-전이 로직을 캡슐화한 순수 async 러너(T-1154 —
// runDeleteGroup 캡슐화 패턴 1:1 mirror). backend DELETE(part.controller @Delete(":id") L131, 204
// No Content, row 부재 시 404, Admin+ 미만 403)를 발사한다. 컨테이너의 handleDeletePart 는 이 러너에
// deps 를 주입해 호출만 한다. 동작:
//  - 빈/공백/falsy id → 미발사(잘못된 path·불필요 DELETE 회피 — trim 후 빈 문자열도 차단).
//  - deleting(이전 mutation 미완) → 미발사(이중 DELETE·state 경합 차단 — runDeleteGroup 가드 동형).
//  - 발사 시 진행 on + 직전 error 비움 → DELETE(id 는 encodeURIComponent 안전 인코딩) → 성공(파트
//    재조회 트리거) / 실패(사람-친화 문구 표면화 — throw 없이) → 진행 off(공통).
async function runDeletePart(
  id: string,
  deps: DeletePartDeps,
): Promise<void> {
  // 비정상 호출 가드 — 빈/공백/falsy id 는 DELETE 미발사(잘못된 path·불필요 요청 회피). 공백만
  // 든 id 도 trim 후 빈 문자열이면 차단해(경계값) 무의미한 `/api/parts/%20` 발사를 막는다.
  if (!id || id.trim() === '') {
    return;
  }
  // 동시 재호출 가드 — 이전 삭제 미완 중이면 미발사(이중 DELETE·state 경합 차단).
  if (deps.deleting) {
    return;
  }
  deps.setDeleting(true);
  // 재발화 시작 시 직전 error 를 비운다(실패 후 재시도 시 직전 error 정리 — 새 삭제 진행만 남도록).
  deps.setDeleteError(undefined);
  try {
    // DELETE /api/parts/:id — 204 No Content. id 는 encodeURIComponent 로 안전 인코딩(비정상
    // 문자가 든 id 도 path 가 깨지지 않게). 응답 body 를 소비하지 않으므로 성공 사실만 확인한다.
    await deps.remove(`${PARTS_PATH}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    // 성공 — 권위 파트 재조회 트리거(재조회로 삭제된 행이 목록에서 사라진다 — 낙관 제거 없음).
    deps.bumpRefresh();
  } catch (e) {
    // 실패 — 사람-친화 문구를 error props 로 안전 표시(throw 없이). 404 NotFound(row 부재) / 403
    // Admin+ 미만 / 비-2xx / 네트워크 0 모두 ApiError.status → toErrorMessage 파생으로 표면화.
    // 재조회 nonce 는 bump 하지 않는다(실패 시 목록 그대로 유지).
    deps.setDeleteError(deps.describeError(e));
  } finally {
    deps.setDeleting(false);
  }
}

// 파트 삭제 성공 후의 선택 파트 id 를 결정하는 순수 helper(T-1157) — 삭제된 파트가 현재 선택
// 중이었으면 선택을 해제(빈 문자열)하고, 아니면 현재 선택을 그대로 유지한다. 컨테이너의
// handleDeletePart 가 성공 경로 전용 bumpRefresh 안에서 functional setState 로 호출한다. 선택이
// 잔존하면 (a) buildPartPersonsPath 가 사라진 파트의 /api/parts/<deletedId>/persons 를 재조회해
// 404 문구가 소속 인원 패널에 표시되고 (b) <select value={selectedPartId}> 가 없는 option 을
// 가리켜 표시값과 state 가 불일치한다 — 본 helper 가 그 비정상 시퀀스를 정상화한다.
// 빈 문자열·공백·undefined-like 입력에서도 throw 하지 않는다(경계 방어): current 가 falsy 면
// 빈 문자열로, deletedId 가 falsy 거나 공백뿐이면(비정상 호출) 현재 선택을 보존한 채 안전 반환한다
// — 공백 판정은 runDeletePart 의 미발사 가드(`id.trim() === ''`)와 같은 의미로 맞춘다(T-1157 round 2
// reviewer MINOR (1): 두 함수의 공백 의미 불일치 해소).
function resolveSelectedPartIdAfterDelete(
  current: string,
  deletedId: string,
): string {
  const cur = current ?? '';
  const deleted = deletedId?.trim() ?? '';
  // 삭제 대상 id 가 비었으면(비정상) 선택을 건드리지 않는다 — 의도치 않은 선택 해제 회피.
  if (!deleted) {
    return cur;
  }
  return cur === deleted ? '' : cur;
}

// 파트 삭제 성공 경로 전용 bumpRefresh 콜백을 조립하는 순수 factory(T-1157 round 2 — reviewer
// MAJOR (1) 해소). 컨테이너 handleDeletePart 가 runDeletePart 에 주입하는 콜백의 본문을 인라인
// 화살표가 아니라 본 함수로 뽑아, test 가 fake setter 2 개를 주입해 "실물 배선"(파트 재조회 nonce
// +1 + 선택 전이)을 직접 호출·단언할 수 있게 한다. 두 setter 는 functional updater 로만 호출해
// 최신 state 를 읽는다(stale closure 회피 — selectedPartId 를 useCallback deps 에 넣지 않는다).
// 본 콜백은 runDeletePart 의 성공 경로에서만 호출되므로(T-1154 계약) 실패 시 선택 유지는 자동
// 보장된다.
function buildDeletePartBumpRefresh(
  setRefreshNonce: (updater: (prev: number) => number) => void,
  setSelected: (updater: (prev: string) => string) => void,
  deletedId: string,
): () => void {
  return () => {
    setRefreshNonce((n) => n + 1);
    setSelected((cur) => resolveSelectedPartIdAfterDelete(cur, deletedId));
  };
}

// 인원 수정 3 필드 묶음(T-1145) — 컨테이너의 인라인 수정 폼 3 controlled input(fullName/email/active)
// 값이자 편집 시작 시점의 원본 스냅샷 타입. buildPersonPatch 가 input 과 original 을 비교해 "변경된
// 필드만" 담긴 부분 갱신 body(PersonPatch)를 만든다. active 는 boolean(soft deactivate/reactivate,
// UpdatePersonDto), fullName/email 은 string(trim 후 비교).
interface PersonPatchInput {
  fullName: string;
  email: string;
  active: boolean;
}

// 인원 부분 갱신 body(T-1145) — UpdatePersonDto(fullName?/email?/active? 전부 optional, 부재=미변경)
// 정합. buildPersonPatch 가 "변경된 필드만" 채운다(부재 필드는 backend 가 미변경 semantics).
interface PersonPatch {
  fullName?: string;
  email?: string;
  active?: boolean;
}

// 편집 입력값 + 편집 시작 원본 스냅샷 → "변경된 필드만" 담긴 PersonPatch 파생(순수 helper, T-1145).
// runUpdateProvider 가 러너 안에서 body 를 조립하는 것과 달리, 인원 수정은 "원본 대비 변경분만" 이라
// 원본 비교가 필요해 조립 로직을 JSX·러너 밖 순수 helper 로 분리한다(buildExportPath 등 순수 helper
// convention 정합 — jsdom 없이 직접 단위 검증). 동작:
//  - fullName/email 은 앞뒤 공백 제거(trim) 후, 비어있지 않고(공백-only 입력은 제외 — DTO @IsNotEmpty·
//    @IsEmail 위반 방지) 원본(trim)과 다를 때만 담는다(미변경 필드는 부재 → backend 미변경).
//  - active 는 boolean 이라 falsy 체크가 불가(false 도 유효 값)하므로 원본과 명시 비교해 다를 때만 담는다.
// 결과 patch 가 비면(변경 없음) 러너의 빈 body 가드가 PATCH 를 억제한다.
function buildPersonPatch(
  input: PersonPatchInput,
  original: PersonPatchInput,
): PersonPatch {
  const patch: PersonPatch = {};
  const fullName = input.fullName?.trim();
  const originalFullName = original.fullName?.trim();
  // fullName: 비어있지 않고(공백-only 제외) 원본과 다를 때만 포함(빈 값 덮어쓰기 방지 — @IsNotEmpty).
  if (fullName && fullName !== originalFullName) {
    patch.fullName = fullName;
  }
  const email = input.email?.trim();
  const originalEmail = original.email?.trim();
  // email: 비어있지 않고(공백-only 제외) 원본과 다를 때만 포함(빈 값·비정상 email 발사 방지 — @IsEmail).
  if (email && email !== originalEmail) {
    patch.email = email;
  }
  // active: boolean 이라 명시 비교 — 원본과 다를 때만 포함(false 도 유효 값이라 falsy 체크 불가).
  if (input.active !== original.active) {
    patch.active = input.active;
  }
  return patch;
}

// 인원 수정 PATCH + state-전이 로직에 주입하는 deps(T-1145 — runUpdateProvider 의 UpdateProviderDeps
// 를 mirror. jsdom/렌더러 없이 mutation 본체를 직접 검증한다). 컨테이너의 handleUpdatePerson 은 이
// 러너에 편집 대상 id·이미 조립된 부분 갱신 patch·현재 in-flight 여부(updating)·상태 setter·재조회
// 트리거·편집 종료를 주입해 호출만 한다. runUpdateProvider 와 달리 body 조립은 buildPersonPatch 가
// 러너 밖에서 수행하므로(원본 비교 필요), 러너는 이미 만들어진 patch 를 받아 발사·전이만 책임진다.
interface UpdatePersonDeps {
  // PATCH 발사 primitive — apiClient.request 를 주입한다(테스트는 mock 주입).
  update: (path: string, options: RequestOptions) => Promise<unknown>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입).
  describeError: (e: unknown) => string;
  // 현재 update in-flight 여부 — true 면 미발사(이중 PATCH·경합 가드).
  updating: boolean;
  setUpdating: (next: boolean) => void;
  setUpdateError: (next: string | undefined) => void;
  // 권위 인원 재조회 트리거 — personsRefreshNonce 를 +1 한다(path 변경 유발).
  bumpRefresh: () => void;
  // 성공 후 편집 상태 종료 트리거(편집 대상 id·폼 입력을 비워 인라인 폼을 닫는다).
  closeEdit: () => void;
}

// 인원 수정 PATCH /api/persons/:id(body 는 변경 필드만) + state-전이 로직을 캡슐화한 순수 async
// 러너(T-1145 — runUpdateProvider mirror). backend PATCH(person.controller @Patch(":id"),
// UpdatePersonDto 3 필드 전부 optional — 부재=미변경·명시=교체, active 유무로 deactivate/reactivate/
// update 분기, 검증 실패 → 400, email 중복 → 409, 미존재 → 404, Admin+ 미만 403)를 발사한다.
// 컨테이너의 handleUpdatePerson 은 이 러너에 deps 를 주입해 호출만 한다. 동작:
//  - 빈/공백/falsy id → 미발사(잘못된 path·불필요 PATCH 회피 — trim 후 빈 문자열도 차단).
//  - updating(이전 mutation 미완) → 미발사(이중 PATCH·state 경합 차단 — runUpdateProvider updating 가드 동형).
//  - 변경 필드 0(빈 patch) → 미발사(빈 body PATCH 회피 — 무의미한 요청 억제. buildPersonPatch 가
//    변경 없음/공백-only 를 빈 patch 로 만든다).
//  - 발사 시 진행 on + 직전 error 비움 → PATCH(id 는 encodeURIComponent 안전 인코딩, body 는 변경
//    필드만) → 성공(인원 재조회 트리거 + 편집 종료) / 실패(사람-친화 문구 표면화 — throw 없이) →
//    진행 off(공통).
async function runUpdatePerson(
  id: string,
  patch: PersonPatch,
  deps: UpdatePersonDeps,
): Promise<void> {
  // 비정상 호출 가드 — 빈/공백/falsy id 는 PATCH 미발사(잘못된 path·불필요 요청 회피). 공백만
  // 든 id 도 trim 후 빈 문자열이면 차단해(경계값) 무의미한 발사를 막는다.
  if (!id || id.trim() === '') {
    return;
  }
  // 동시 재호출 가드 — 이전 update 미완 중이면 미발사(이중 PATCH·state 경합 차단).
  if (deps.updating) {
    return;
  }
  // 변경 필드 0 가드 — patch 가 비면 미발사(빈 body PATCH 회피 — 무의미한 요청 억제). buildPersonPatch
  // 가 변경 없음/공백-only 입력을 빈 patch 로 만드므로, 그 경우 여기서 no-op 로 떨어진다.
  if (Object.keys(patch).length === 0) {
    return;
  }
  deps.setUpdating(true);
  // 재발화 시작 시 직전 error 를 비운다(실패 후 재시도 시 직전 error 정리 — 새 update 진행만 남도록).
  deps.setUpdateError(undefined);
  try {
    // PATCH /api/persons/:id — id 는 encodeURIComponent 로 안전 인코딩(비정상 문자가 든 id 도 path
    // 가 깨지지 않게). body 는 변경 필드만 JSON 직렬화한다(runUpdateProvider JSON body 발사 convention
    // 동형). 응답 body 를 소비하지 않으므로 성공 사실만 확인한다.
    await deps.update(`${PERSONS_PATH}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    // 성공 — 권위 인원 재조회 트리거(재조회로 수정된 행이 목록에 반영된다 — 낙관 갱신 없음) +
    // 편집 상태 종료(인라인 폼 닫힘 + 폼 입력 잔존 방지).
    deps.bumpRefresh();
    deps.closeEdit();
  } catch (e) {
    // 실패 — 사람-친화 문구를 error state 로 안전 표시(throw 없이). 400 검증 실패(빈/잘못된 email) /
    // 403 Admin+ 미만 / 404 미존재 / 409 email 중복 / 비-2xx / 네트워크 0 모두 ApiError.status →
    // toErrorMessage 파생으로 표면화. 재조회 nonce·편집 상태는 건드리지 않는다(실패 시 편집 유지).
    deps.setUpdateError(deps.describeError(e));
  } finally {
    deps.setUpdating(false);
  }
}

// 그룹 수정 PATCH + state-전이 로직에 주입하는 deps(T-1150 — runUpdatePerson 의 UpdatePersonDeps 를
// mirror. jsdom/렌더러 없이 mutation 본체를 직접 검증한다). 컨테이너의 handleUpdateGroup 은 이 러너에
// 편집 대상 id·현재 입력 name·편집 시작 원본 name·현재 in-flight 여부(updating)·상태 setter·재조회
// 트리거·편집 종료를 주입해 호출만 한다. 그룹은 편집 필드가 name 하나뿐이라(UpdateGroupDto 의 name
// 단일 partial update — src/user/dto/update-group.dto.ts) buildPersonPatch 같은 다필드 diff 헬퍼가
// 불요하고, 러너 안에서 trim·미변경 비교로 발사 여부를 직접 판정한다.
interface UpdateGroupDeps {
  // PATCH 발사 primitive — apiClient.request 를 주입한다(테스트는 mock 주입).
  update: (path: string, options: RequestOptions) => Promise<unknown>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입).
  describeError: (e: unknown) => string;
  // 현재 update in-flight 여부 — true 면 미발사(이중 PATCH·경합 가드).
  updating: boolean;
  setUpdating: (next: boolean) => void;
  setUpdateError: (next: string | undefined) => void;
  // 권위 그룹 재조회 트리거 — groupsRefreshNonce 를 +1 한다(path 변경 유발).
  bumpRefresh: () => void;
  // 성공 후 편집 상태 종료 트리거(편집 대상 id·폼 입력을 비워 인라인 폼을 닫는다).
  closeEdit: () => void;
}

// 그룹 수정 PATCH /api/groups/:id(body `{ name }`) + state-전이 로직을 캡슐화한 순수 async 러너
// (T-1150 — runUpdatePerson mirror). backend PATCH(group.controller @Patch(":id") L176, UpdateGroupDto
// name 단일 partial update — 부재=미변경·명시=교체, 검증 실패(빈/비정상 name) → 400, 미존재 → 404,
// Admin+ 미만 403)를 발사한다. 컨테이너의 handleUpdateGroup 은 이 러너에 deps 를 주입해 호출만 한다.
// 그룹은 name 단일 필드라 원본 비교(미변경 skip)를 러너 안에서 직접 수행한다(다필드 diff 헬퍼 불요).
// 동작:
//  - 빈/공백/falsy id → 미발사(잘못된 path·불필요 PATCH 회피 — trim 후 빈 문자열도 차단).
//  - updating(이전 mutation 미완) → 미발사(이중 PATCH·state 경합 차단 — runUpdatePerson updating 가드 동형).
//  - 빈/공백-only name → 미발사(빈 body·400 회피 — @IsNotEmpty 위반 방지, trim 후 falsy 면 억제).
//  - 미변경 name(trim 후 원본과 동일) → 미발사(무의미한 요청 억제 — buildPersonPatch 의 미변경 skip 동형).
//  - 발사 시 진행 on + 직전 error 비움 → PATCH(id 는 encodeURIComponent 안전 인코딩, body 는 trim 된
//    name) → 성공(그룹 재조회 트리거 + 편집 종료) / 실패(사람-친화 문구 표면화 — throw 없이) →
//    진행 off(공통).
async function runUpdateGroup(
  id: string,
  name: string,
  originalName: string,
  deps: UpdateGroupDeps,
): Promise<void> {
  // 비정상 호출 가드 — 빈/공백/falsy id 는 PATCH 미발사(잘못된 path·불필요 요청 회피). 공백만
  // 든 id 도 trim 후 빈 문자열이면 차단해(경계값) 무의미한 발사를 막는다.
  if (!id || id.trim() === '') {
    return;
  }
  // 동시 재호출 가드 — 이전 update 미완 중이면 미발사(이중 PATCH·state 경합 차단).
  if (deps.updating) {
    return;
  }
  // 빈/공백-only name 가드 — trim 후 비면 미발사(빈 body·400 회피 — @IsNotEmpty). 공백만 든 입력도
  // trim 후 빈 문자열이면 차단한다(경계값).
  const trimmed = name?.trim();
  if (!trimmed) {
    return;
  }
  // 미변경 name 가드 — trim 후 원본과 동일하면 미발사(무의미한 PATCH 억제 — buildPersonPatch 의
  // "변경된 필드만" skip 동형). 원본도 trim 해 앞뒤 공백만 덧댄 입력을 미변경으로 취급한다.
  if (trimmed === originalName?.trim()) {
    return;
  }
  deps.setUpdating(true);
  // 재발화 시작 시 직전 error 를 비운다(실패 후 재시도 시 직전 error 정리 — 새 update 진행만 남도록).
  deps.setUpdateError(undefined);
  try {
    // PATCH /api/groups/:id — id 는 encodeURIComponent 로 안전 인코딩(비정상 문자가 든 id 도 path
    // 가 깨지지 않게). body 는 trim 된 name 을 JSON 직렬화한다(runUpdatePerson JSON body 발사
    // convention 동형). 응답 body 를 소비하지 않으므로 성공 사실만 확인한다.
    await deps.update(`${GROUPS_PATH}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    // 성공 — 권위 그룹 재조회 트리거(재조회로 수정된 행이 목록에 반영된다 — 낙관 갱신 없음) +
    // 편집 상태 종료(인라인 폼 닫힘 + 폼 입력 잔존 방지).
    deps.bumpRefresh();
    deps.closeEdit();
  } catch (e) {
    // 실패 — 사람-친화 문구를 error state 로 안전 표시(throw 없이). 400 검증 실패(빈/비정상 name) /
    // 403 Admin+ 미만 / 404 미존재 / 비-2xx / 네트워크 0 모두 ApiError.status → toErrorMessage
    // 파생으로 표면화. 재조회 nonce·편집 상태는 건드리지 않는다(실패 시 편집 유지).
    deps.setUpdateError(deps.describeError(e));
  } finally {
    deps.setUpdating(false);
  }
}

// 파트 수정 PATCH + state-전이 로직에 주입하는 deps(T-1155 — runUpdateGroup 의 UpdateGroupDeps 를
// mirror + runCreatePart 의 isConflict 주입 결합. jsdom/렌더러 없이 mutation 본체를 직접 검증한다).
// 컨테이너의 handleUpdatePart 는 이 러너에 편집 대상 id·현재 입력 name·편집 시작 원본 name·현재
// in-flight 여부(updating)·상태 setter·재조회 트리거·편집 종료를 주입해 호출만 한다. 파트도 편집
// 필드가 name 하나뿐이라(UpdatePartDto 의 name 단일 partial update — src/user/dto/update-part.dto.ts)
// buildPersonPatch 같은 다필드 diff 헬퍼가 불요하다. 그룹과의 유일한 차이는 Part.name 이
// @unique(prisma schema L108)라 rename 이 기존 파트명과 충돌하면 서버가 409(ConflictException)를
// 던진다는 점 — 그 409 판정을 isConflict 로 주입받아(테스트는 mock 주입, 런타임은 ApiError.status===409
// 검사 주입) 전용 문구로 구분 표면화한다(runCreatePart 의 409 패턴 재사용).
interface UpdatePartDeps {
  // PATCH 발사 primitive — apiClient.request 를 주입한다(테스트는 mock 주입).
  update: (path: string, options: RequestOptions) => Promise<unknown>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입). 비-409 에러에 쓴다.
  describeError: (e: unknown) => string;
  // throw 표면이 409(중복 이름) 인지 판정 — true 면 PART_DUPLICATE_ERROR 전용 문구를 쓴다.
  // 런타임은 `(e) => e instanceof ApiError && e.status === 409` 주입(순수 판정 분리 — 테스트 용이).
  isConflict: (e: unknown) => boolean;
  // 현재 update in-flight 여부 — true 면 미발사(이중 PATCH·경합 가드).
  updating: boolean;
  setUpdating: (next: boolean) => void;
  setUpdateError: (next: string | undefined) => void;
  // 권위 파트 재조회 트리거 — partsRefreshNonce 를 +1 한다(path 변경 유발).
  bumpRefresh: () => void;
  // 성공 후 편집 상태 종료 트리거(편집 대상 id·폼 입력을 비워 인라인 폼을 닫는다).
  closeEdit: () => void;
}

// 파트 수정 PATCH /api/parts/:id(body `{ name }`) + state-전이 로직을 캡슐화한 순수 async 러너
// (T-1155 — runUpdateGroup 1:1 mirror + runCreatePart 의 409 전용 문구 분기 결합). backend
// PATCH(part.controller @Patch(":id") L121, UpdatePartDto name 단일 partial update — 부재=미변경·
// 명시=교체, 검증 실패(빈/비정상 name) → 400, 미존재 → 404, 동명 파트 존재 → P2002 → 409)를
// 발사한다. 컨테이너의 handleUpdatePart 는 이 러너에 deps 를 주입해 호출만 한다. 동작:
//  - 빈/공백/falsy id → 미발사(잘못된 path·불필요 PATCH 회피 — trim 후 빈 문자열도 차단).
//  - updating(이전 mutation 미완) → 미발사(이중 PATCH·state 경합 차단 — runUpdateGroup 가드 동형).
//  - 빈/공백-only name → 미발사(빈 body·400 회피 — @IsNotEmpty 위반 방지, trim 후 falsy 면 억제).
//  - 미변경 name(trim 후 원본과 동일) → 미발사(무의미한 요청 억제 — runUpdateGroup 동형).
//  - 발사 시 진행 on + 직전 error 비움 → PATCH(id 는 encodeURIComponent 안전 인코딩, body 는 trim 된
//    name) → 성공(파트 재조회 트리거 + 편집 종료) / 실패 → 진행 off(공통).
//  - 실패가 409(중복 이름)면 PART_DUPLICATE_ERROR 전용 문구, 그 외(400·403·404·네트워크·비-2xx)는
//    describeError 파생 일반 문구를 error state 로 표면화한다(throw 없이). 재조회 nonce·편집 상태는
//    건드리지 않는다(실패 시 편집·목록 유지 — 다른 이름으로 재시도 편의).
async function runUpdatePart(
  id: string,
  name: string,
  originalName: string,
  deps: UpdatePartDeps,
): Promise<void> {
  // 비정상 호출 가드 — 빈/공백/falsy id 는 PATCH 미발사(잘못된 path·불필요 요청 회피). 공백만
  // 든 id 도 trim 후 빈 문자열이면 차단해(경계값) 무의미한 `/api/parts/%20` 발사를 막는다.
  if (!id || id.trim() === '') {
    return;
  }
  // 동시 재호출 가드 — 이전 update 미완 중이면 미발사(이중 PATCH·state 경합 차단).
  if (deps.updating) {
    return;
  }
  // 빈/공백-only name 가드 — trim 후 비면 미발사(빈 body·400 회피 — @IsNotEmpty). 공백만 든 입력도
  // trim 후 빈 문자열이면 차단한다(경계값).
  const trimmed = name?.trim();
  if (!trimmed) {
    return;
  }
  // 미변경 name 가드 — trim 후 원본과 동일하면 미발사(무의미한 PATCH 억제 + 자기 자신과의 409 유발
  // 회피). 원본도 trim 해 앞뒤 공백만 덧댄 입력을 미변경으로 취급한다.
  if (trimmed === originalName?.trim()) {
    return;
  }
  deps.setUpdating(true);
  // 재발화 시작 시 직전 error 를 비운다(실패 후 재시도 시 직전 error 정리 — 새 update 진행만 남도록).
  // 이 초기 비움 덕에 409 중복 후 다른 이름으로 재시도 시 직전 중복 문구도 함께 정리된다(negative cover).
  deps.setUpdateError(undefined);
  try {
    // PATCH /api/parts/:id — id 는 encodeURIComponent 로 안전 인코딩(비정상 문자가 든 id 도 path
    // 가 깨지지 않게). body 는 trim 된 name 을 JSON 직렬화한다(runUpdateGroup convention 동형).
    // UpdatePartDto 는 name 단일 필드라 다른 필드는 미포함. 응답 body 는 소비하지 않는다.
    await deps.update(`${PARTS_PATH}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    // 성공 — 권위 파트 재조회 트리거(재조회로 수정된 행이 목록에 반영된다 — 낙관 갱신 없음) +
    // 편집 상태 종료(인라인 폼 닫힘 + 폼 입력 잔존 방지).
    deps.bumpRefresh();
    deps.closeEdit();
  } catch (e) {
    // 실패 — throw 없이 error state 로 안전 표시. 409(Part.name @unique 위반 → ConflictException)면
    // 원인이 분명한 전용 중복 문구를, 그 외(400 검증 실패·403 Admin+ 미만·404 미존재·비-2xx·
    // 네트워크 0)는 describeError 파생 일반 문구를 쓴다. 그룹(409 없음)과 달리 파트는 409 를 명시
    // 분기한다. 재조회 nonce·편집 상태는 건드리지 않는다(실패 시 편집 유지).
    if (deps.isConflict(e)) {
      deps.setUpdateError(PART_DUPLICATE_ERROR);
    } else {
      deps.setUpdateError(deps.describeError(e));
    }
  } finally {
    deps.setUpdating(false);
  }
}

// provider 수정 PATCH 4 필드 묶음(T-1137) — 컨테이너의 인라인 수정 폼 4 controlled input 값을
// 러너에 한 덩어리로 넘긴다. 러너가 각 필드를 trim 해 "명시된 필드만"(빈/공백 제외) body 로
// JSON 직렬화한다(부분 갱신 semantics — 부재 필드는 backend 가 미변경). secret apiKey 는
// read never-back 이라 빈 값으로 시작하고, 사용자가 입력했을 때만 body 에 포함해 기존 ciphertext
// 를 교체한다(빈 apiKey 는 body 에서 제외 → 기존 값 유지). apiKey 는 응답·목록·error 어디에도
// 재노출되지 않는다.
interface UpdateProviderFields {
  provider: string;
  endpointUrl: string;
  apiKey: string;
  modelId: string;
}

// provider 수정 PATCH + state-전이 로직에 주입하는 deps(T-1137 — runCreateProvider 의
// CreateProviderDeps 를 mirror. jsdom/렌더러 없이 mutation 본체를 직접 검증한다). 컨테이너의
// handleUpdateProvider 는 이 러너에 4 입력값(UpdateProviderFields)·편집 대상 id·현재 in-flight
// 여부(updating)·상태 setter·재조회 트리거·편집 종료를 주입해 호출만 한다. runCreateProvider 와
// 달리 path param 이 provider id 하나(PATCH /api/llm/providers/:id)라 id 를 받고, 성공 후
// resetInput 대신 closeEdit(편집 상태 종료)를 호출한다.
interface UpdateProviderDeps {
  // PATCH 발사 primitive — apiClient.request 를 주입한다(테스트는 mock 주입).
  update: (path: string, options: RequestOptions) => Promise<unknown>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입).
  describeError: (e: unknown) => string;
  // 편집 대상 provider id — PATCH path 의 :id param. encodeURIComponent 로 안전 인코딩된다.
  id: string;
  // 현재 update in-flight 여부 — true 면 미발사(이중 PATCH·경합 가드).
  updating: boolean;
  setUpdating: (next: boolean) => void;
  setUpdateError: (next: string | undefined) => void;
  // 권위 provider 재조회 트리거 — providersRefreshNonce 를 +1 한다(path 변경 유발).
  bumpRefresh: () => void;
  // 성공 후 편집 상태 종료 트리거(편집 대상 id·폼 입력을 비워 인라인 폼을 닫는다).
  closeEdit: () => void;
}

// provider 수정 PATCH /api/llm/providers/:id(body 는 변경 필드만) + state-전이 로직을 캡슐화한
// 순수 async 러너(T-1137 — runCreateProvider mirror). backend PATCH(llm.controller,
// UpdateLlmProviderConfigDto 4 필드 전부 optional — 부재=미변경·명시=교체, 미지원 provider →
// 400, 미존재 → 404, Admin+ 미만 403)를 발사한다. 컨테이너의 handleUpdateProvider 는 이 러너에
// deps 를 주입해 호출만 한다. 동작:
//  - 빈/공백/falsy id → 미발사(잘못된 path·불필요 PATCH 회피 — trim 후 빈 문자열도 차단).
//  - updating(이전 mutation 미완) → 미발사(이중 PATCH·state 경합 차단 — runCreateProvider creating 가드 동형).
//  - 변경 필드 0(4 필드 전부 빈/공백) → 미발사(빈 body PATCH 회피 — 무의미한 요청 억제).
//  - 발사 시 진행 on + 직전 error 비움 → PATCH(id 는 encodeURIComponent 안전 인코딩, body 는
//    trim 후 비어있지 않은 필드만) → 성공(provider 재조회 트리거 + 편집 종료) / 실패(사람-친화
//    문구 표면화 — throw 없이) → 진행 off(공통).
async function runUpdateProvider(
  fields: UpdateProviderFields,
  deps: UpdateProviderDeps,
): Promise<void> {
  // 비정상 호출 가드 — 빈/공백/falsy id 는 PATCH 미발사(잘못된 path·불필요 요청 회피). 공백만
  // 든 id 도 trim 후 빈 문자열이면 차단해(경계값) 무의미한 발사를 막는다.
  if (!deps.id || deps.id.trim() === '') {
    return;
  }
  // 동시 재호출 가드 — 이전 update 미완 중이면 미발사(이중 PATCH·state 경합 차단).
  if (deps.updating) {
    return;
  }
  // 부분 갱신 body 조립 — 각 필드 앞뒤 공백 제거 후 비어있지 않은 필드만 담는다("명시된 필드만"
  // 발사 = 부재 필드는 backend 가 미변경). secret apiKey 도 trim 후 비어있을 때만 제외해(빈 값
  // 시작 → 기존 ciphertext 유지) 사용자가 입력했을 때만 교체한다.
  const body: Record<string, string> = {};
  const provider = fields.provider?.trim();
  const endpointUrl = fields.endpointUrl?.trim();
  const apiKey = fields.apiKey?.trim();
  const modelId = fields.modelId?.trim();
  if (provider) {
    body.provider = provider;
  }
  if (endpointUrl) {
    body.endpointUrl = endpointUrl;
  }
  if (apiKey) {
    body.apiKey = apiKey;
  }
  if (modelId) {
    body.modelId = modelId;
  }
  // 변경 필드 0 가드 — 담긴 필드가 하나도 없으면 미발사(빈 body PATCH 회피 — 무의미한 요청 억제).
  if (Object.keys(body).length === 0) {
    return;
  }
  deps.setUpdating(true);
  // 재발화 시작 시 직전 error 를 비운다(실패 후 재시도 시 직전 error 정리 — 새 update 진행만 남도록).
  deps.setUpdateError(undefined);
  try {
    // PATCH /api/llm/providers/:id — id 는 encodeURIComponent 로 안전 인코딩(비정상 문자가 든 id
    // 도 path 가 깨지지 않게). body 는 변경 필드만 JSON 직렬화한다(runCreateProvider JSON body
    // 발사 convention 동형). apiKey 는 교체 시점 평문 전송만 담당하고 응답을 소비하지 않으므로
    // (성공 사실만 확인) 목록·error 어디에도 재노출되지 않는다.
    await deps.update(`${LLM_PROVIDERS_PATH}/${encodeURIComponent(deps.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    // 성공 — 권위 provider 재조회 트리거(재조회로 수정된 행이 목록에 반영된다 — 낙관 갱신 없음) +
    // 편집 상태 종료(인라인 폼 닫힘 + 폼 입력·secret apiKey 잔존 방지).
    deps.bumpRefresh();
    deps.closeEdit();
  } catch (e) {
    // 실패 — 사람-친화 문구를 error state 로 안전 표시(throw 없이). 400 검증 실패(미지원 provider·
    // 빈 필드) / 403 Admin+ 미만 / 404 미존재 / 비-2xx / 네트워크 0 모두 ApiError.status →
    // toErrorMessage 파생으로 표면화. 재조회 nonce·편집 상태는 건드리지 않는다(실패 시 편집 유지).
    deps.setUpdateError(deps.describeError(e));
  } finally {
    deps.setUpdating(false);
  }
}

// Admin 화면 컨테이너. useApiResource 로 GET /api/groups 결과를 소유하고, 선택 그룹 상태를
// useState 로 보유해 선택 그룹의 멤버를 client-side 파생 후 GroupMemberList 에 props 로
// 내려보낸다(controlled lift-up — GroupMemberList 는 fetch 를 모른다, ADR-0041 Decision 1).
function AdminView({
  initialSelectedGroupId = '',
  initialCronExpression = '',
  initialScheduleBusy = false,
  initialSelectedPersonId = '',
  initialSelectedDays = 0,
  initialReevalSubmitting = false,
  initialSelectedPartId = '',
}: AdminViewProps) {
  // 선택 그룹 상태 — controlled lift-up(컨테이너 소유). <select> 선택이 이 값을 갱신한다.
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    initialSelectedGroupId,
  );

  // 그룹 목록 조회 — useApiResource 로 그룹 <select> 옵션의 원천을 조회한다(④a 책임 경계).
  // T-1129 부터 GroupMemberList 의 loading/error 는 그룹 조회가 아니라 선택 그룹 멤버십 조회
  // (아래 useApiResource<MembershipRow[]>)가 소유하므로, 그룹 조회의 loading/error 는 별도로
  // 구독하지 않고 data 만 소비한다(그룹 조회 실패 시 옵션 빈 목록으로 안전 표시 — 그룹 조회
  // 실패 표면화는 본 slice Out of Scope).
  // 그룹 재조회 nonce(T-1146) — 그룹 생성 POST 성공 시 이 값을 +1 해 groups path 를 변화시켜
  // useApiResource 재조회를 유발한다(read-only hook 수정 0 경로 — personsRefreshNonce 동형).
  // nonce 0 초기 마운트는 base path(GROUPS_PATH) 그대로다(T-1129 이전 마운트와 동일 — 회귀 0).
  const [groupsRefreshNonce, setGroupsRefreshNonce] = useState<number>(0);

  // 그룹 목록 조회 path(T-1146) — nonce-aware 빌더로 전환(buildGroupsPath). nonce 0 이면 base
  // path, 생성 성공 후 nonce 증가가 `_r` query 로 재조회를 낸다(buildPersonsPath mirror).
  const groupsPath = useMemo(
    () => buildGroupsPath(groupsRefreshNonce),
    [groupsRefreshNonce],
  );

  // 그룹 목록 조회(T-1146 select·생성 폼 원천, T-1148 목록 카드 마운트로 loading/error 재사용).
  // 기존엔 data 만 소비했으나, 본 slice 가 GroupList 를 마운트하며 새 useApiResource 호출을
  // 추가하지 않고(double-fetch 회피) 같은 조회의 loading/error 를 함께 destructure 해 GroupList
  // props 로 내려보낸다. 변수명에 group prefix 를 붙여 인원/멤버십/LLM 조회 상태와 섞이지 않게
  // 분리한다(personLoading/personError 동형). select 드롭다운·파생은 그대로 data 만 소비한다.
  const {
    data,
    loading: groupLoading,
    error: groupError,
  } = useApiResource<GroupRow[]>(groupsPath);

  // 현재 사용자 등급 조회(④h) — useApiResource 네 번째 호출(GET /api/auth/me, User+). 응답
  // role 만 소비해 Admin+ 여부를 파생한다. 조회 실패/loading/응답 누락은 모두 isAdmin=false
  // 로 fail-closed 처리되므로(아래 useMemo), error 를 별도 표시하지 않고 gating 안내로 흡수한다
  // — Admin 패널 의존 endpoint 가 Admin+(403)라 비-Admin 에게는 패널 자체를 숨기면 충분하다.
  const { data: meData, loading: meLoading } =
    useApiResource<MeRow>(AUTH_ME_PATH);

  // 인원 재조회 nonce(T-1143) — 인원 생성 POST 성공 시 이 값을 +1 해 persons path 를 변화시켜
  // useApiResource 재조회를 유발한다(read-only hook 수정 0 경로 — providersRefreshNonce 동형).
  // nonce 0 초기 마운트는 base path 그대로다(T-1142 마운트와 동일 — 회귀 0).
  const [personsRefreshNonce, setPersonsRefreshNonce] = useState<number>(0);

  // 인원 목록 조회 path(T-1143) — nonce-aware 빌더로 전환(buildPersonsPath). nonce 0 이면
  // base path(T-1142 마운트와 동일), 생성 성공 후 nonce 증가가 `_r` query 로 재조회를 낸다.
  const personsPath = useMemo(
    () => buildPersonsPath(personsRefreshNonce),
    [personsRefreshNonce],
  );

  // 인원 목록 조회(T-1142, T-1143 nonce 전환) — useApiResource 로 GET /api/persons(active 인원
  // Person[])를 조회한다. 컨테이너가 인원 목록 상태를 소유하고, 그 data/loading/error 를
  // presentational PersonList 에 props 로만 내려보낸다(ADR-0041 Decision 1 — 패널은 fetch 를
  // 모른다). 변수명에 person prefix 를 붙여 그룹/멤버십/LLM 조회의 loading/error 와 섞이지 않게
  // 분리한다(T-1140 permissionDenied prefix 동형).
  const {
    data: personData,
    loading: personLoading,
    error: personError,
  } = useApiResource<PersonRow[]>(personsPath);

  // 인원 생성 2 controlled input 상태(T-1143) — 컨테이너 소유. "추가" 클릭 시 handleCreatePerson
  // 이 POST body 의 2 필드(fullName/email)로 공급하고, 성공 후 모두 빈 값으로 되돌린다(연속 생성
  // 편의). runCreateProvider 의 providerInput 패턴 mirror.
  const [fullNameInput, setFullNameInput] = useState<string>('');
  const [emailInput, setEmailInput] = useState<string>('');

  // 인원 생성 mutation in-flight 플래그(T-1143) — POST 진행 중 true. 진행 표시(입력·버튼 비활성)와
  // 동시 재호출 가드(이전 mutation 미완 중 재발사 차단)에 함께 쓴다(creatingProvider 동형).
  const [creatingPerson, setCreatingPerson] = useState<boolean>(false);

  // 인원 생성 mutation 실패 문구(T-1143) — POST 실패 시 사람-친화 문구(toErrorMessage 파생)를
  // 보관해 폼 하단에 안전 표시한다(throw 없음). 성공/재시도 시작 시 비운다.
  const [createPersonError, setCreatePersonError] = useState<
    string | undefined
  >(undefined);

  // 인원 생성 실 mutation 핸들러(T-1143) — 인원 생성 POST(/api/persons, body 2 필드)를 컨테이너
  // 내부 async 로 발사한다(handleCreateProvider 정합). 빈/공백 필드·이전 mutation 미완(creatingPerson)
  // 발사 억제 + 성공(인원 재조회 + 2 입력 초기화)/실패(error 안전 표시, throw 없음) 전이는
  // runCreatePerson 이 캡슐화한다. 2 입력값·creatingPerson 을 deps 의존성에 포함해 stale 없이 최신
  // 입력·가드 상태로 발사한다.
  const handleCreatePerson = useCallback(
    () =>
      runCreatePerson(
        {
          fullName: fullNameInput,
          email: emailInput,
        },
        {
          create: request,
          describeError: toErrorMessage,
          creating: creatingPerson,
          setCreating: setCreatingPerson,
          setCreateError: setCreatePersonError,
          bumpRefresh: () => setPersonsRefreshNonce((n) => n + 1),
          resetInput: () => {
            setFullNameInput('');
            setEmailInput('');
          },
        },
      ),
    [fullNameInput, emailInput, creatingPerson],
  );

  // 그룹 생성 controlled input 상태(T-1146) — 컨테이너 소유. "그룹 추가" 클릭 시 handleCreateGroup
  // 이 POST body 의 name 필드로 공급하고, 성공 후 빈 값으로 되돌린다(연속 생성 편의). 인원 생성의
  // fullNameInput 패턴 mirror(그룹은 name 단일 필드).
  const [groupNameInput, setGroupNameInput] = useState<string>('');

  // 그룹 생성 mutation in-flight 플래그(T-1146) — POST 진행 중 true. 진행 표시(입력·버튼 비활성)와
  // 동시 재호출 가드(이전 mutation 미완 중 재발사 차단)에 함께 쓴다(creatingPerson 동형).
  const [creatingGroup, setCreatingGroup] = useState<boolean>(false);

  // 그룹 생성 mutation 실패 문구(T-1146) — POST 실패 시 사람-친화 문구(toErrorMessage 파생)를
  // 보관해 폼 하단에 안전 표시한다(throw 없음). 성공/재시도 시작 시 비운다.
  const [createGroupError, setCreateGroupError] = useState<string | undefined>(
    undefined,
  );

  // 그룹 생성 실 mutation 핸들러(T-1146) — 그룹 생성 POST(/api/groups, body `{ name }`)를 컨테이너
  // 내부 async 로 발사한다(handleCreatePerson 정합). 빈/공백 name·이전 mutation 미완(creatingGroup)
  // 발사 억제 + 성공(그룹 재조회 + 입력 초기화)/실패(error 안전 표시, throw 없음) 전이는 runCreateGroup
  // 이 캡슐화한다. 입력값·creatingGroup 을 deps 의존성에 포함해 stale 없이 최신 입력·가드 상태로 발사한다.
  const handleCreateGroup = useCallback(
    () =>
      runCreateGroup(groupNameInput, {
        create: request,
        describeError: toErrorMessage,
        creating: creatingGroup,
        setCreating: setCreatingGroup,
        setCreateError: setCreateGroupError,
        bumpRefresh: () => setGroupsRefreshNonce((n) => n + 1),
        resetInput: () => setGroupNameInput(''),
      }),
    [groupNameInput, creatingGroup],
  );

  // 인원 삭제 mutation in-flight 플래그(T-1144) — DELETE 진행 중 true. 진행 표시(loading 우선)와
  // 동시 재호출 가드(이전 mutation 미완 중 재호출 차단)에 함께 쓴다(deletingProvider 동형).
  const [deletingPerson, setDeletingPerson] = useState<boolean>(false);

  // 인원 삭제 mutation 실패 문구(T-1144) — DELETE 실패 시 사람-친화 문구(toErrorMessage 파생)를
  // 보관해 목록 패널의 error props 로 안전 표시한다(throw 없음). 성공/재시도 시작 시 비운다.
  const [deletePersonError, setDeletePersonError] = useState<
    string | undefined
  >(undefined);

  // onDelete 실 mutation 핸들러(T-1144) — 인원 삭제 DELETE(/api/persons/:id)를 컨테이너 내부 async
  // 로 발사한다(신규 mutation hook 미작성 — runDeleteProvider 정합). 빈/공백/falsy id·이전 mutation
  // 미완(deletingPerson) 발사 억제 + 성공(인원 재조회 트리거)/실패(error 안전 표시, throw 없음) 전이는
  // runDeletePerson 이 캡슐화한다. deletingPerson 을 deps 의존성에 포함해 stale 없이 최신 가드 상태로
  // 발사한다.
  const handleDeletePerson = useCallback(
    (id: string) =>
      runDeletePerson(id, {
        remove: request,
        describeError: toErrorMessage,
        deleting: deletingPerson,
        setDeleting: setDeletingPerson,
        setDeleteError: setDeletePersonError,
        bumpRefresh: () => setPersonsRefreshNonce((n) => n + 1),
      }),
    [deletingPerson],
  );

  // 그룹 삭제 mutation in-flight 플래그(T-1149) — DELETE 진행 중 true. 진행 표시(loading 우선)와
  // 동시 재호출 가드(이전 mutation 미완 중 재호출 차단)에 함께 쓴다(deletingPerson 동형).
  const [deletingGroup, setDeletingGroup] = useState<boolean>(false);

  // 그룹 삭제 mutation 실패 문구(T-1149) — DELETE 실패 시 사람-친화 문구(toErrorMessage 파생)를
  // 보관해 목록 패널의 error props 로 안전 표시한다(throw 없음). 성공/재시도 시작 시 비운다.
  const [deleteGroupError, setDeleteGroupError] = useState<string | undefined>(
    undefined,
  );

  // onDelete 실 mutation 핸들러(T-1149) — 그룹 삭제 DELETE(/api/groups/:id)를 컨테이너 내부 async
  // 로 발사한다(신규 mutation hook 미작성 — runDeletePerson 정합). 빈/공백/falsy id·이전 mutation
  // 미완(deletingGroup) 발사 억제 + 성공(그룹 재조회 트리거)/실패(error 안전 표시, throw 없음) 전이는
  // runDeleteGroup 이 캡슐화한다. deletingGroup 을 deps 의존성에 포함해 stale 없이 최신 가드 상태로
  // 발사한다.
  const handleDeleteGroup = useCallback(
    (id: string) =>
      runDeleteGroup(id, {
        remove: request,
        describeError: toErrorMessage,
        deleting: deletingGroup,
        setDeleting: setDeletingGroup,
        setDeleteError: setDeleteGroupError,
        bumpRefresh: () => setGroupsRefreshNonce((n) => n + 1),
      }),
    [deletingGroup],
  );

  // 편집 대상 group id(T-1150) — null 이면 편집 안 함(인라인 수정 폼 미렌더). GroupList 각 행의
  // "수정" 버튼 클릭 시 해당 row.id 로 채우고, 성공/취소 시 null 로 되돌린다. 편집 폼 렌더 분기
  // 기준값(editingPersonId 동형).
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  // 그룹 수정 name controlled input 상태(T-1150) — 컨테이너 소유. "수정" 클릭 시 해당 row 의 현재
  // name 으로 prefill 한다(그룹은 편집 필드가 name 하나뿐 — 인원의 3 입력 대비 단순). handleUpdateGroup
  // 이 편집 시작 원본 name(editGroupOriginalName)과 함께 러너에 넘겨 미변경 skip 을 판정한다.
  const [editGroupNameInput, setEditGroupNameInput] = useState<string>('');

  // 편집 시작 시점의 원본 name 스냅샷(T-1150) — runUpdateGroup 이 현재 입력과 비교해 미변경이면
  // 발사를 억제하는 데 쓴다(buildPersonPatch 의 원본 스냅샷 역할을 name 단일 필드로 축소). "수정"
  // 클릭 시 클릭한 row 의 현재 name 으로 채우고, 편집 종료 시 빈 문자열로 되돌린다.
  const [editGroupOriginalName, setEditGroupOriginalName] = useState<string>('');

  // 그룹 수정 mutation in-flight 플래그(T-1150) — PATCH 진행 중 true. 진행 표시(입력·버튼 비활성)와
  // 동시 재호출 가드(이전 mutation 미완 중 재발사 차단)에 함께 쓴다(updatingPerson 동형).
  const [updatingGroup, setUpdatingGroup] = useState<boolean>(false);

  // 그룹 수정 mutation 실패 문구(T-1150) — PATCH 실패 시 사람-친화 문구(toErrorMessage 파생)를 보관해
  // 편집 폼 하단에 안전 표시한다(throw 없음, 생성/삭제 error 와 별도 문구). 성공/재시도/편집 시작 시 비운다.
  const [updateGroupError, setUpdateGroupError] = useState<string | undefined>(
    undefined,
  );

  // 편집 폼 닫기(편집 상태 종료) helper(T-1150) — 편집 대상 id·name 입력·원본 스냅샷을 모두 기본값으로
  // 되돌린다. 성공 후 closeEdit·취소 버튼 두 경로가 공유한다(resetEditPersonForm 동형).
  const resetEditGroupForm = useCallback(() => {
    setEditingGroupId(null);
    setEditGroupNameInput('');
    setEditGroupOriginalName('');
  }, []);

  // "수정" 버튼 클릭 핸들러(T-1150) — GroupList.onEdit 로 내려보낸다. 클릭한 row 의 현재 name 으로 폼을
  // prefill 하고(data 에서 id 매칭) 원본 name 스냅샷도 함께 세팅한다(미변경 판정 기준). 직전 수정
  // error 도 비워 새 편집 세션을 깨끗이 시작한다(handleEditPerson 동형).
  const handleEditGroup = useCallback(
    (id: string) => {
      const row = (data ?? []).find((group) => group.id === id);
      const name = row?.name ?? '';
      setEditingGroupId(id);
      setEditGroupNameInput(name);
      setEditGroupOriginalName(name);
      setUpdateGroupError(undefined);
    },
    [data],
  );

  // 편집 취소 핸들러(T-1150) — 인라인 폼을 닫고 입력·error 를 비운다(발사 없이 편집 상태만 종료).
  // 진행 중(updatingGroup)일 때는 취소를 억제해 PATCH 완료 전 폼이 사라지지 않게 한다(버튼 disabled +
  // 핸들러 가드 이중, handleCancelEditPerson 동형).
  const handleCancelEditGroup = useCallback(() => {
    if (updatingGroup) {
      return;
    }
    resetEditGroupForm();
    setUpdateGroupError(undefined);
  }, [updatingGroup, resetEditGroupForm]);

  // 그룹 수정 실 mutation 핸들러(T-1150) — 그룹 수정 PATCH(/api/groups/:id, body `{ name }`)를 컨테이너
  // 내부 async 로 발사한다(handleUpdatePerson 정합). 빈/falsy id·이전 mutation 미완(updatingGroup)·빈·
  // 공백 name·미변경 name 발사 억제 + 성공(그룹 재조회 + 편집 종료)/실패(error 안전 표시, throw 없음)
  // 전이는 runUpdateGroup 이 캡슐화한다. 입력 name·원본·편집 대상 id·updatingGroup 을 deps 의존성에
  // 포함해 stale 없이 최신 입력·가드 상태로 발사한다.
  const handleUpdateGroup = useCallback(
    () =>
      runUpdateGroup(
        editingGroupId ?? '',
        editGroupNameInput,
        editGroupOriginalName,
        {
          update: request,
          describeError: toErrorMessage,
          updating: updatingGroup,
          setUpdating: setUpdatingGroup,
          setUpdateError: setUpdateGroupError,
          bumpRefresh: () => setGroupsRefreshNonce((n) => n + 1),
          closeEdit: resetEditGroupForm,
        },
      ),
    [
      editingGroupId,
      editGroupNameInput,
      editGroupOriginalName,
      updatingGroup,
      resetEditGroupForm,
    ],
  );

  // 편집 대상 person id(T-1145) — null 이면 편집 안 함(인라인 수정 폼 미렌더). PersonList 각 행의
  // "수정" 버튼 클릭 시 해당 row.id 로 채우고, 성공/취소 시 null 로 되돌린다. 편집 폼 렌더 분기 기준값
  // (editingProviderId 동형).
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);

  // 인원 수정 3 controlled input 상태(T-1145) — 컨테이너 소유. "수정" 클릭 시 해당 row 의 현재 값으로
  // prefill 한다(fullName/email 은 text, active 는 boolean — <select> 활성/휴직). handleUpdatePerson 이
  // buildPersonPatch 로 변경 필드만 PATCH body 로 공급한다(editProviderInput 패턴 mirror).
  const [editFullNameInput, setEditFullNameInput] = useState<string>('');
  const [editEmailInput, setEditEmailInput] = useState<string>('');
  const [editActiveInput, setEditActiveInput] = useState<boolean>(true);

  // 편집 시작 시점의 원본 스냅샷(T-1145) — buildPersonPatch 가 현재 입력과 비교해 "변경된 필드만"
  // 파생하는 데 쓴다. "수정" 클릭 시 클릭한 row 의 현재 값으로 채우고, 편집 종료 시 기본값으로 되돌린다.
  const [editPersonOriginal, setEditPersonOriginal] = useState<PersonPatchInput>(
    { fullName: '', email: '', active: true },
  );

  // 인원 수정 mutation in-flight 플래그(T-1145) — PATCH 진행 중 true. 진행 표시(입력·버튼 비활성)와
  // 동시 재호출 가드(이전 mutation 미완 중 재발사 차단)에 함께 쓴다(updatingProvider 동형).
  const [updatingPerson, setUpdatingPerson] = useState<boolean>(false);

  // 인원 수정 mutation 실패 문구(T-1145) — PATCH 실패 시 사람-친화 문구(toErrorMessage 파생)를 보관해
  // 편집 폼 하단에 안전 표시한다(throw 없음, 생성/삭제 error 와 별도 문구). 성공/재시도/편집 시작 시 비운다.
  const [updatePersonError, setUpdatePersonError] = useState<
    string | undefined
  >(undefined);

  // 편집 폼 닫기(편집 상태 종료) helper(T-1145) — 편집 대상 id·3 입력·원본 스냅샷을 모두 기본값으로
  // 되돌린다. 성공 후 closeEdit·취소 버튼 두 경로가 공유한다(resetEditProviderForm 동형).
  const resetEditPersonForm = useCallback(() => {
    setEditingPersonId(null);
    setEditFullNameInput('');
    setEditEmailInput('');
    setEditActiveInput(true);
    setEditPersonOriginal({ fullName: '', email: '', active: true });
  }, []);

  // "수정" 버튼 클릭 핸들러(T-1145) — PersonList.onEdit 로 내려보낸다. 클릭한 row 의 현재 값으로 폼을
  // prefill 하고(personData 에서 id 매칭) 원본 스냅샷도 함께 세팅한다(변경분 파생 기준). 직전 수정
  // error 도 비워 새 편집 세션을 깨끗이 시작한다(handleEditProvider 동형).
  const handleEditPerson = useCallback(
    (id: string) => {
      const row = (personData ?? []).find((person) => person.id === id);
      const fullName = row?.fullName ?? '';
      const email = row?.email ?? '';
      const active = row?.active ?? true;
      setEditingPersonId(id);
      setEditFullNameInput(fullName);
      setEditEmailInput(email);
      setEditActiveInput(active);
      setEditPersonOriginal({ fullName, email, active });
      setUpdatePersonError(undefined);
    },
    [personData],
  );

  // 편집 취소 핸들러(T-1145) — 인라인 폼을 닫고 입력·error 를 비운다(발사 없이 편집 상태만 종료).
  // 진행 중(updatingPerson)일 때는 취소를 억제해 PATCH 완료 전 폼이 사라지지 않게 한다(버튼 disabled +
  // 핸들러 가드 이중, handleCancelEditProvider 동형).
  const handleCancelEditPerson = useCallback(() => {
    if (updatingPerson) {
      return;
    }
    resetEditPersonForm();
    setUpdatePersonError(undefined);
  }, [updatingPerson, resetEditPersonForm]);

  // 인원 수정 실 mutation 핸들러(T-1145) — 인원 수정 PATCH(/api/persons/:id, body 는 변경 필드만)를
  // 컨테이너 내부 async 로 발사한다(handleUpdateProvider 정합). buildPersonPatch 로 원본 대비 변경분만
  // 조립하고, 빈/falsy id·이전 mutation 미완(updatingPerson)·변경 필드 0 발사 억제 + 성공(인원 재조회 +
  // 편집 종료)/실패(error 안전 표시, throw 없음) 전이는 runUpdatePerson 이 캡슐화한다. 3 입력값·원본·
  // 편집 대상 id·updatingPerson 을 deps 의존성에 포함해 stale 없이 최신 입력·가드 상태로 발사한다.
  const handleUpdatePerson = useCallback(
    () =>
      runUpdatePerson(
        editingPersonId ?? '',
        buildPersonPatch(
          {
            fullName: editFullNameInput,
            email: editEmailInput,
            active: editActiveInput,
          },
          editPersonOriginal,
        ),
        {
          update: request,
          describeError: toErrorMessage,
          updating: updatingPerson,
          setUpdating: setUpdatingPerson,
          setUpdateError: setUpdatePersonError,
          bumpRefresh: () => setPersonsRefreshNonce((n) => n + 1),
          closeEdit: resetEditPersonForm,
        },
      ),
    [
      editingPersonId,
      editFullNameInput,
      editEmailInput,
      editActiveInput,
      editPersonOriginal,
      updatingPerson,
      resetEditPersonForm,
    ],
  );

  // Admin+ 여부 파생(④h) — me 응답의 role 을 isAdminRole 로 판정한다. role 이 Admin/SuperAdmin
  // 으로 확정될 때만 true 이고, 조회 전(meData undefined)/loading/실패/role 누락/비-Admin 은 모두
  // false 다(fail-closed). loading 중에도 false 라 등급 확정 전에는 Admin 패널이 노출되지 않는다
  // (깜빡임 최소 — 안정화 후 노출). meLoading 은 의존성에 포함하되 false 분기를 바꾸지 않는다
  // (loading→확정 전이 시 재계산 트리거 — stale-Admin 노출 방지).
  const isAdmin = useMemo(
    () => !meLoading && isAdminRole(meData?.role),
    [meData, meLoading],
  );

  // SuperAdmin 여부 파생(T-1162 — 위 isAdmin 동형, 판정만 최상위 등급 정확 매칭). PATCH
  // /api/users/:id/role 이 @Roles("SuperAdmin") 이므로 이 파생이 true 일 때만 역할 변경 콜백을
  // UserList 로 내려 확정 403 요청을 사전 차단한다. loading / 조회 실패 / meData 부재 / role
  // 누락 / 'superadmin' 같은 enum 불일치는 모두 false(fail-closed — 대소문자 관대 처리 없음).
  const isSuperAdmin = useMemo(
    () => !meLoading && meData?.role === 'SuperAdmin',
    [meData, meLoading],
  );

  // 표시용 그룹 목록 — data 미도착이면 빈 배열로 간주한다(<select> 옵션·파생의 안전 기준).
  const groups = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  // 선택 그룹의 멤버 파생(client-side, id = personId) — T-1129 부터 GroupMemberList 는 아래 신
  // endpoint fetch 결과(groupMembers, id = membershipId)를 쓰므로, 본 client-side 파생은 재평가
  // 인원 선택 <select> 의 personOptions 전용으로 남는다(재평가 POST 는 personId 를 path param 으로
  // 쓰므로 membershipId 부적합). 미선택/미발견/멤버 미포함이면 빈 배열.
  const members = useMemo(
    () => deriveMembers(groups, selectedGroupId || undefined),
    [groups, selectedGroupId],
  );

  // 멤버십 재조회 nonce(T-1130) — ④c remove DELETE 성공 시 이 값을 +1 해 groupMembersPath 를
  // 변화시켜 useApiResource 재조회를 유발한다(read-only hook 수정 0 경로 — buildMappingsPath 동형).
  const [membersRefreshNonce, setMembersRefreshNonce] = useState<number>(0);

  // remove mutation in-flight 플래그(T-1130) — DELETE 진행 중 true. 진행 표시(loading 우선)와
  // 동시 재호출 가드(이전 mutation 미완 중 재호출 차단)에 함께 쓴다(④c assigning 동형).
  const [removing, setRemoving] = useState<boolean>(false);

  // remove mutation 실패 문구(T-1130) — DELETE 실패 시 사람-친화 문구(toErrorMessage 파생)를
  // 보관해 error props 로 안전 표시한다(throw 없음). 성공/재시도 시작 시 비운다(④c assignError 동형).
  const [removeError, setRemoveError] = useState<string | undefined>(undefined);

  // 선택 그룹의 멤버십 조회 path(T-1129 → T-1130 nonce) — 선택이 있을 때만 조건부 path 를 만든다
  // (미선택 시 null → useApiResource 미조회 idle). 선택 변경 시 path 가 달라져 자동 refetch
  // (path-change refetch)하고, remove 성공 시 membersRefreshNonce 증가가 `_r` query 로 재조회를 낸다.
  const groupMembersPath = useMemo(
    () => buildGroupMembersPath(selectedGroupId || undefined, membersRefreshNonce),
    [selectedGroupId, membersRefreshNonce],
  );

  // 선택 그룹의 멤버십 조회(T-1129) — useApiResource 로 신 endpoint(GET /api/groups/:id/members,
  // T-1128 findMembershipsByGroupId)를 조건부 fetch 한다. loading/error 는 컨테이너가 받아
  // GroupMemberList 의 대응 props 로 내려보낸다(ADR-0041 Decision 1 — 패널은 fetch 를 모른다).
  const {
    data: membershipData,
    loading: membersLoading,
    error: membersError,
  } = useApiResource<MembershipRow[]>(groupMembersPath);

  // 멤버십 응답 → GroupMemberList 의 Member[] 파생(T-1129) — 각 Member.id 를 membershipId 로
  // 설정하고, 표시명은 선택 그룹 응답의 person(personId 매칭)에서 채운다. 미선택/미도착/비정상이면 빈 배열.
  const groupMembers = useMemo(
    () =>
      deriveMembersFromMemberships(
        membershipData,
        findGroup(groups, selectedGroupId || undefined),
      ),
    [membershipData, groups, selectedGroupId],
  );

  // onRemove 실 mutation 핸들러(T-1130) — 멤버 제거 DELETE(/api/groups/:id/members/:membershipId)
  // 를 컨테이너 내부 async 로 발사한다(신규 mutation hook 미작성 — ④c runAssign 정합). 빈/falsy
  // membershipId·이전 mutation 미완(removing) 발사 억제 + 성공(멤버십 재조회 트리거)/실패(error props
  // 안전 표시, throw 없음) 전이는 runRemove 가 캡슐화한다. selectedGroupId(DELETE path param)·removing
  // 을 deps 의존성에 포함해 stale 없이 최신 그룹·가드 상태로 발사한다.
  const handleRemove = useCallback(
    (membershipId: string) =>
      runRemove(membershipId, {
        remove: request,
        describeError: toErrorMessage,
        groupId: selectedGroupId,
        removing,
        setRemoving,
        setRemoveError,
        bumpRefresh: () => setMembersRefreshNonce((n) => n + 1),
      }),
    [selectedGroupId, removing],
  );

  // 추가할 멤버 personId 입력 상태(T-1131) — controlled input(컨테이너 소유). "추가" 클릭 시
  // handleAdd 가 POST body 의 personId 로 공급하고, 성공 후 빈 값으로 되돌린다(연속 추가 편의).
  const [personIdInput, setPersonIdInput] = useState<string>('');

  // add mutation in-flight 플래그(T-1131) — POST 진행 중 true. 진행 표시(입력·버튼 비활성)와
  // 동시 재호출 가드(이전 mutation 미완 중 재호출 차단)에 함께 쓴다(remove removing 동형).
  const [adding, setAdding] = useState<boolean>(false);

  // add mutation 실패 문구(T-1131) — POST 실패 시 사람-친화 문구(toErrorMessage 파생)를 보관해
  // 입력 하단에 안전 표시한다(throw 없음). 성공/재시도 시작 시 비운다(remove removeError 동형).
  const [addError, setAddError] = useState<string | undefined>(undefined);

  // 멤버 추가 실 mutation 핸들러(T-1131) — 멤버 추가 POST(/api/groups/:id/members, body
  // `{ personId }`)를 컨테이너 내부 async 로 발사한다(handleRemove 정합). 빈/공백 personId·그룹
  // 미선택·이전 mutation 미완(adding) 발사 억제 + 성공(멤버십 재조회 + 입력 초기화)/실패(error 안전
  // 표시, throw 없음) 전이는 runAdd 가 캡슐화한다. personIdInput(POST body)·selectedGroupId(POST
  // path param)·adding 을 deps 의존성에 포함해 stale 없이 최신 입력·그룹·가드 상태로 발사한다.
  const handleAdd = useCallback(
    () =>
      runAdd(personIdInput, {
        add: request,
        describeError: toErrorMessage,
        groupId: selectedGroupId,
        adding,
        setAdding,
        setAddError,
        bumpRefresh: () => setMembersRefreshNonce((n) => n + 1),
        resetInput: () => setPersonIdInput(''),
      }),
    [personIdInput, selectedGroupId, adding],
  );

  // provider 재조회 nonce(T-1135) — LlmProviderConfigList.onDelete DELETE 성공 시 이 값을 +1 해
  // providers path 를 변화시켜 useApiResource 재조회를 유발한다(read-only hook 수정 0 경로 —
  // buildMappingsPath/membersRefreshNonce 동형). nonce 0 초기 마운트는 base path 그대로다.
  const [providersRefreshNonce, setProvidersRefreshNonce] = useState<number>(0);

  // provider 목록 조회 path(T-1135) — nonce-aware 빌더로 전환(buildProvidersPath). nonce 0 이면
  // base path(T-1134 마운트와 동일), 삭제 성공 후 nonce 증가가 `_r` query 로 재조회를 낸다.
  const providersPath = useMemo(
    () => buildProvidersPath(providersRefreshNonce),
    [providersRefreshNonce],
  );

  // LLM provider 목록 조회(④b 두 번째 패널) — useApiResource 추가 호출(④a 의 그룹 조회 +
  // 본 slice 두 번 = 총 세 번). loading/error 는 컨테이너가 받아 DifficultyModelSelector 의
  // props 로 내려보낸다(Decision 1 — 패널은 fetch 를 모른다). Admin+ 라 User 는 403→error.
  const {
    data: providerData,
    loading: providersLoading,
    error: providersError,
  } = useApiResource<LlmProviderRow[]>(providersPath);

  // provider 삭제 mutation in-flight 플래그(T-1135) — DELETE 진행 중 true. 진행 표시(loading 우선)와
  // 동시 재호출 가드(이전 mutation 미완 중 재호출 차단)에 함께 쓴다(remove removing 동형).
  const [deletingProvider, setDeletingProvider] = useState<boolean>(false);

  // provider 삭제 mutation 실패 문구(T-1135) — DELETE 실패 시 사람-친화 문구(toErrorMessage 파생)를
  // 보관해 목록 패널의 error props 로 안전 표시한다(throw 없음). 성공/재시도 시작 시 비운다.
  const [deleteProviderError, setDeleteProviderError] = useState<
    string | undefined
  >(undefined);

  // onDelete 실 mutation 핸들러(T-1135) — provider 삭제 DELETE(/api/llm/providers/:id)를 컨테이너
  // 내부 async 로 발사한다(신규 mutation hook 미작성 — runRemove 정합). 빈/공백/falsy id·이전
  // mutation 미완(deletingProvider) 발사 억제 + 성공(provider 재조회 트리거)/실패(error 안전 표시,
  // throw 없음) 전이는 runDeleteProvider 가 캡슐화한다. deletingProvider 를 deps 의존성에 포함해
  // stale 없이 최신 가드 상태로 발사한다.
  const handleDeleteProvider = useCallback(
    (id: string) =>
      runDeleteProvider(id, {
        remove: request,
        describeError: toErrorMessage,
        deleting: deletingProvider,
        setDeleting: setDeletingProvider,
        setDeleteError: setDeleteProviderError,
        bumpRefresh: () => setProvidersRefreshNonce((n) => n + 1),
      }),
    [deletingProvider],
  );

  // provider 생성 4 controlled input 상태(T-1136) — 컨테이너 소유. "추가" 클릭 시
  // handleCreateProvider 가 POST body 의 4 필드로 공급하고, 성공 후 모두 빈 값으로 되돌린다
  // (연속 생성 편의 + secret apiKey 잔존 방지). runAdd 의 personIdInput 패턴 mirror.
  const [providerInput, setProviderInput] = useState<string>('');
  const [endpointUrlInput, setEndpointUrlInput] = useState<string>('');
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [modelIdInput, setModelIdInput] = useState<string>('');

  // provider 생성 mutation in-flight 플래그(T-1136) — POST 진행 중 true. 진행 표시(입력·버튼
  // 비활성)와 동시 재호출 가드(이전 mutation 미완 중 재발사 차단)에 함께 쓴다(adding 동형).
  const [creatingProvider, setCreatingProvider] = useState<boolean>(false);

  // provider 생성 mutation 실패 문구(T-1136) — POST 실패 시 사람-친화 문구(toErrorMessage 파생)를
  // 보관해 폼 하단에 안전 표시한다(throw 없음, 삭제 error 와 별도 문구). 성공/재시도 시작 시 비운다.
  const [createProviderError, setCreateProviderError] = useState<
    string | undefined
  >(undefined);

  // provider 생성 실 mutation 핸들러(T-1136) — provider 생성 POST(/api/llm/providers, body 4 필드)를
  // 컨테이너 내부 async 로 발사한다(handleAdd 정합). 빈/공백 필드·이전 mutation 미완(creatingProvider)
  // 발사 억제 + 성공(provider 재조회 + 4 입력 초기화)/실패(error 안전 표시, throw 없음) 전이는
  // runCreateProvider 가 캡슐화한다. 4 입력값·creatingProvider 를 deps 의존성에 포함해 stale 없이
  // 최신 입력·가드 상태로 발사한다. 재조회는 기존 setProvidersRefreshNonce 를 재사용한다(신규 nonce 0).
  const handleCreateProvider = useCallback(
    () =>
      runCreateProvider(
        {
          provider: providerInput,
          endpointUrl: endpointUrlInput,
          apiKey: apiKeyInput,
          modelId: modelIdInput,
        },
        {
          create: request,
          describeError: toErrorMessage,
          creating: creatingProvider,
          setCreating: setCreatingProvider,
          setCreateError: setCreateProviderError,
          bumpRefresh: () => setProvidersRefreshNonce((n) => n + 1),
          resetInput: () => {
            setProviderInput('');
            setEndpointUrlInput('');
            setApiKeyInput('');
            setModelIdInput('');
          },
        },
      ),
    [
      providerInput,
      endpointUrlInput,
      apiKeyInput,
      modelIdInput,
      creatingProvider,
    ],
  );

  // 재조회 nonce(④c) — DifficultyModelSelector.onAssign PATCH 성공 시 이 값을 +1 해
  // mappings path 를 변화시켜 useApiResource 재조회를 유발한다(read-only hook 수정 0 경로).
  const [refreshNonce, setRefreshNonce] = useState<number>(0);

  // 낙관적 override(④c) — PATCH 발사 직후 재조회 도착 전까지 재지정 슬롯을 즉시 반영한다.
  // 성공 후 재조회 트리거와 함께 비우고(권위 데이터로 대체), 실패 시 롤백(비움)한다.
  const [optimisticMapping, setOptimisticMapping] = useState<
    Partial<Record<Difficulty, string | null>>
  >({});

  // mutation in-flight 플래그(④c) — PATCH 진행 중 true. 진행 표시(loading 우선)와 동시 재호출
  // 가드(이전 mutation 미완 중 재호출 차단)에 함께 쓴다.
  const [assigning, setAssigning] = useState<boolean>(false);

  // mutation 실패 문구(④c) — PATCH 실패 시 사람-친화 문구(toErrorMessage 파생)를 보관해
  // error props 로 안전 표시한다(throw 없음). 성공/재시도 시작 시 비운다.
  const [assignError, setAssignError] = useState<string | undefined>(undefined);

  // 난이도 슬롯 매핑 조회(④b) — provider 와 같은 thin fetch hook 으로 추가 조회한다. path 는
  // refreshNonce 를 cache-busting query 로 실어(④c) PATCH 성공 시 nonce 증가가 재조회를 낸다.
  const mappingsPath = useMemo(
    () => buildMappingsPath(refreshNonce),
    [refreshNonce],
  );
  const {
    data: mappingData,
    loading: mappingsLoading,
    error: mappingsError,
  } = useApiResource<DifficultyMappingRow[]>(mappingsPath);

  // provider 응답 → ProviderOption[] 파생(순수 helper). data 미도착이면 빈 배열(빈 상태).
  const providers = useMemo(
    () => deriveProviders(providerData),
    [providerData],
  );

  // provider 응답 → LlmProviderConfigList 의 읽기 전용 view 파생(T-1134). 같은 providerData 를
  // 재사용해(새 fetch 0) sanitized LlmProviderConfigRow[] 로 매핑, props 로만 내려보낸다.
  const providerConfigs = useMemo(
    () => deriveProviderConfigs(providerData),
    [providerData],
  );

  // 편집 대상 provider id(T-1137) — null 이면 편집 안 함(인라인 수정 폼 미렌더). "수정" 버튼
  // 클릭 시 해당 row.id 로 채우고, 성공/취소 시 null 로 되돌린다. 편집 폼 렌더 분기의 기준값.
  const [editingProviderId, setEditingProviderId] = useState<string | null>(
    null,
  );

  // provider 수정 4 controlled input 상태(T-1137) — 컨테이너 소유. "수정" 클릭 시 해당 row 의
  // 현재 값으로 prefill 하되, apiKey 는 read never-back 이라 빈 값으로 시작한다(placeholder 로
  // "변경 시에만 입력" 안내). handleUpdateProvider 가 PATCH body 의 변경 필드로 공급한다.
  const [editProviderInput, setEditProviderInput] = useState<string>('');
  const [editEndpointUrlInput, setEditEndpointUrlInput] = useState<string>('');
  const [editApiKeyInput, setEditApiKeyInput] = useState<string>('');
  const [editModelIdInput, setEditModelIdInput] = useState<string>('');

  // provider 수정 mutation in-flight 플래그(T-1137) — PATCH 진행 중 true. 진행 표시(입력·버튼
  // 비활성)와 동시 재호출 가드(이전 mutation 미완 중 재발사 차단)에 함께 쓴다(creatingProvider 동형).
  const [updatingProvider, setUpdatingProvider] = useState<boolean>(false);

  // provider 수정 mutation 실패 문구(T-1137) — PATCH 실패 시 사람-친화 문구(toErrorMessage 파생)를
  // 보관해 편집 폼 하단에 안전 표시한다(throw 없음, 삭제/생성 error 와 별도 문구). 성공/재시도/편집
  // 시작 시 비운다.
  const [updateProviderError, setUpdateProviderError] = useState<
    string | undefined
  >(undefined);

  // 편집 폼 닫기(편집 상태 종료) helper(T-1137) — 편집 대상 id·4 입력을 모두 비운다(secret apiKey
  // 잔존 방지). 성공 후 closeEdit·취소 버튼 두 경로가 공유한다.
  const resetEditProviderForm = useCallback(() => {
    setEditingProviderId(null);
    setEditProviderInput('');
    setEditEndpointUrlInput('');
    setEditApiKeyInput('');
    setEditModelIdInput('');
  }, []);

  // "수정" 버튼 클릭 핸들러(T-1137) — LlmProviderConfigList.onEdit 로 내려보낸다. 클릭한 row 의
  // 현재 값으로 폼을 prefill 하되(providerConfigs 에서 id 매칭), apiKey 는 read never-back 이라
  // 빈 값으로 시작한다(placeholder 안내). 직전 수정 error 도 비워 새 편집 세션을 깨끗이 시작한다.
  const handleEditProvider = useCallback(
    (id: string) => {
      const row = providerConfigs.find((config) => config.id === id);
      setEditingProviderId(id);
      setEditProviderInput(row?.provider ?? '');
      setEditEndpointUrlInput(row?.endpointUrl ?? '');
      // apiKey 는 목록에 미노출(read never-back)이라 현재 값을 알 수 없으므로 빈 값으로 시작한다.
      setEditApiKeyInput('');
      setEditModelIdInput(row?.modelId ?? '');
      setUpdateProviderError(undefined);
    },
    [providerConfigs],
  );

  // 편집 취소 핸들러(T-1137) — 인라인 폼을 닫고 입력·error 를 비운다(발사 없이 편집 상태만 종료).
  // 진행 중(updatingProvider)일 때는 취소를 억제해 PATCH 완료 전 폼이 사라지지 않게 한다(가드는
  // 버튼 disabled + 핸들러 가드 이중).
  const handleCancelEditProvider = useCallback(() => {
    if (updatingProvider) {
      return;
    }
    resetEditProviderForm();
    setUpdateProviderError(undefined);
  }, [updatingProvider, resetEditProviderForm]);

  // provider 수정 실 mutation 핸들러(T-1137) — provider 수정 PATCH(/api/llm/providers/:id, body 는
  // 변경 필드만)를 컨테이너 내부 async 로 발사한다(handleCreateProvider 정합). 빈/falsy id·이전
  // mutation 미완(updatingProvider)·변경 필드 0 발사 억제 + 성공(provider 재조회 + 편집 종료)/실패
  // (error 안전 표시, throw 없음) 전이는 runUpdateProvider 가 캡슐화한다. 4 입력값·편집 대상 id·
  // updatingProvider 를 deps 의존성에 포함해 stale 없이 최신 입력·가드 상태로 발사한다. 재조회는
  // 기존 setProvidersRefreshNonce 를 재사용한다(신규 nonce 0).
  const handleUpdateProvider = useCallback(
    () =>
      runUpdateProvider(
        {
          provider: editProviderInput,
          endpointUrl: editEndpointUrlInput,
          apiKey: editApiKeyInput,
          modelId: editModelIdInput,
        },
        {
          update: request,
          describeError: toErrorMessage,
          id: editingProviderId ?? '',
          updating: updatingProvider,
          setUpdating: setUpdatingProvider,
          setUpdateError: setUpdateProviderError,
          bumpRefresh: () => setProvidersRefreshNonce((n) => n + 1),
          closeEdit: resetEditProviderForm,
        },
      ),
    [
      editProviderInput,
      editEndpointUrlInput,
      editApiKeyInput,
      editModelIdInput,
      editingProviderId,
      updatingProvider,
      resetEditProviderForm,
    ],
  );

  // 난이도 매핑 응답 → Record<Difficulty, string | null> 파생 + 낙관적 override 병합(④c).
  // 서버 권위 매핑 위에 진행 중인 재지정 슬롯을 즉시 덮어, 재조회 도착 전에도 새 provider 가
  // DifficultyModelSelector 의 mapping props 로 내려가도록 한다(낙관 반영). override 가 비면
  // 서버 매핑 그대로다(merge 결과는 base 와 동일한 새 객체).
  const difficultyMapping = useMemo(
    () => mergeMapping(deriveDifficultyMapping(mappingData), optimisticMapping),
    [mappingData, optimisticMapping],
  );

  // loading 합성 — 두 LLM 읽기 조회 또는 mutation(assigning) 중 하나라도 진행 중이면 true.
  // mutation in-flight 도 loading 우선으로 표시해(④c) 패널이 진행 중을 노출한다(ADR-0041
  // Decision 1 경계 — 읽기 loading 과 mutation loading 을 패널 단일 loading props 로 합성).
  const llmLoading = providersLoading || mappingsLoading || assigning;

  // error 합성 — mutation 실패(assignError)를 최우선 노출한다(④c — 방금 사용자가 한 재지정의
  // 실패가 가장 최신·근본적 피드백). 없으면 provider 조회 error, 없으면 mapping 조회 error.
  // 둘 다 없으면 undefined. Admin+ 미만 403 도 이 경로로 error props 안전 표시(throw 없음).
  const llmError = assignError ?? providersError ?? mappingsError;

  // onAssign 실 mutation 핸들러(④c) — 슬롯 재지정 PATCH(/api/llm/difficulty-mappings/:difficulty)
  // 를 컨테이너 내부 async 로 발사한다(신규 mutation hook 미작성 — cap·범위 정합). 동작:
  //  1) 빈/비정상 providerId 면 미발사(잘못된 body 전송 회피).
  //  2) 이전 mutation 미완(assigning) 중 재호출이면 미발사(이중 호출·state 깨짐 차단).
  //  3) 낙관 반영(슬롯 즉시 새 provider) + 진행 표시 on + 이전 error 비움.
  //  4) PATCH 성공 → refreshNonce +1(권위 재조회 트리거) + 낙관 override 비움(권위 데이터로 대체).
  //  5) PATCH 실패 → 낙관 override 롤백(비움) + toErrorMessage 문구를 error props 로 안전 표시
  //     (throw 없음 — 미지원 난이도 400 / config·슬롯 부재 404 / Admin+ 미만 403 / 네트워크 0 모두).
  //  6) 마지막에 진행 표시 off(성공·실패 공통).
  const handleAssign = useCallback(
    (difficulty: Difficulty, providerId: string) =>
      runAssign(difficulty, providerId, {
        patch: request,
        describeError: toErrorMessage,
        assigning,
        setAssigning,
        setAssignError,
        setOptimistic: setOptimisticMapping,
        bumpRefresh: () => setRefreshNonce((n) => n + 1),
      }),
    [assigning],
  );

  // export in-flight 플래그(④d) — export GET 진행 중 true. 진행 표시(busy)와 동시 재호출 가드
  // (이전 export 미완 중 재호출 차단)에 함께 쓴다(④c assigning 동형).
  const [exporting, setExporting] = useState<boolean>(false);

  // export 완료 안내 문구(④d) — export 성공 시 사람-친화 완료 안내를 보관해 message props 로
  // 표시한다. 재발화 시작·실패 시 비운다.
  const [exportMessage, setExportMessage] = useState<string | undefined>(
    undefined,
  );

  // export 실패 문구(④d) — export 실패 시 사람-친화 문구(toErrorMessage 파생)를 보관해 error
  // props 로 안전 표시한다(throw 없음). 재발화 시작 시 비운다.
  const [exportError, setExportError] = useState<string | undefined>(undefined);

  // export scope 선택 상태(④g) — controlled lift-up(컨테이너 소유). 컨테이너가 직접 렌더하는
  // scope <select> 가 이 값을 갱신하고, handleExport 가 buildExportPath 로 path 에 반영한다.
  // 빈 문자열(전체) 이 초기값 = scope query 미부착(④f 동작 유지). DataImportExportPanel 은 scope
  // 를 모른다(ADR-0041 Decision 1 — scope 선택은 컨테이너 책임, 패널 props 계약 불변).
  const [selectedScope, setSelectedScope] = useState<string>('');

  // onExport 실 핸들러(④d, ④g 확장) — export GET 을 컨테이너 내부 async 로 발사한다
  // (신규 fetch hook 미작성 — ④c runAssign 정합, useApiResource 는 read-on-mount 라 클릭 발화에
  // 부적합). 동작:
  //  1) 이전 export 미완(exporting) 중 재호출이면 미발사(이중 호출·state 깨짐 차단).
  //  2) 진행 표시 on + 직전 error·message 비움(실패 후 재시도 시 직전 error 정리).
  //  3) GET 성공 → response.blob() → Content-Disposition filename(없으면 기본명) → 가상 <a download>
  //     클릭으로 실제 파일 저장(createObjectURL/revokeObjectURL/anchor 부수효과 deps 주입) → 완료 message.
  //  4) GET 실패 → toErrorMessage 문구를 error props 로 안전 표시(403/404/비-2xx/네트워크 0 모두, throw 없음).
  //  5) 마지막에 진행 표시 off(성공·실패 공통).
  // ④g: buildExportPath(selectedScope) 로 현재 scope 선택값을 path 에 반영해 주입한다(scope
  // 미선택 시 ADMIN_EXPORT_PATH 그대로 = ④f 동작). selectedScope 를 deps 의존성에 포함해 변경된
  // scope 가 stale 없이 반영되도록 한다(이전 선택값 캡처 방지).
  const handleExport = useCallback(
    () =>
      runExport(buildExportPath(selectedScope), {
        getRaw: requestRaw,
        describeError: toErrorMessage,
        exporting,
        setExporting,
        setExportError,
        setExportMessage,
        // 브라우저 표준 URL/DOM 부수효과 — 런타임 기본 구현 주입(테스트는 mock 주입).
        ...browserDownloadDeps,
      }),
    [exporting, selectedScope],
  );

  // scope 선택 변경(④g) — scope <select> 가 선택값을 컨테이너 상태로 올린다(빈 값 = 전체 =
  // query 미부착). 그룹 선택 handleSelectChange 동형. DataImportExportPanel 은 모른다(Decision 1).
  const handleScopeChange = (event: { target: { value: string } }) => {
    setSelectedScope(event.target.value);
  };

  // import in-flight 플래그(④e) — import POST 진행 중 true. 진행 표시(busy)와 동시 재호출 가드
  // (이전 import 미완 중 재호출 차단)에 함께 쓴다(④d exporting 동형).
  const [importing, setImporting] = useState<boolean>(false);

  // import 완료 안내 문구(④e) — import 성공 시 사람-친화 완료 안내를 보관해 message props 로
  // 표시한다. 재발화 시작·실패 시 비운다(④d exportMessage 동형).
  const [importMessage, setImportMessage] = useState<string | undefined>(
    undefined,
  );

  // import 실패 문구(④e) — import 실패 시 사람-친화 문구(toErrorMessage 파생)를 보관해 error
  // props 로 안전 표시한다(throw 없음). 재발화 시작 시 비운다(④d exportError 동형).
  const [importError, setImportError] = useState<string | undefined>(undefined);

  // onImportFile 실 핸들러(④e) — import POST(/api/admin/import, multipart) 를 컨테이너 내부
  // async 로 발사한다(신규 fetch hook 미작성 — ④d runExport 정합, useApiResource 는 read-on-mount
  // 라 파일 선택 발화에 부적합). 동작:
  //  1) 빈/falsy file 또는 이전 import 미완(importing) 중 재호출이면 미발사(빈 선택 방어 +
  //     이중 호출·state 깨짐 차단).
  //  2) 진행 표시 on + 직전 error·message 비움(실패 후 재시도 시 직전 error 정리).
  //  3) FormData 에 file append → POST 성공 → 완료 안내(message) 표면화.
  //  4) POST 실패 → toErrorMessage 문구를 error props 로 안전 표시(403/400/404/비-2xx/네트워크 0 모두, throw 없음).
  //  5) 마지막에 진행 표시 off(성공·실패 공통).
  const handleImport = useCallback(
    (file: File) =>
      runImport(file, {
        post: request,
        describeError: toErrorMessage,
        importing,
        setImporting,
        setImportError,
        setImportMessage,
      }),
    [importing],
  );

  // DataImportExportPanel 의 busy/error/message props — busy 우선 → error → message 순으로
  // 패널이 렌더 분기하므로(컴포넌트 박제), 컨테이너는 export·import 두 작업의 진행/실패/완료
  // 상태를 단일 패널 props 로 합성한다(④e 결정 근거): DataImportExportPanel 이 export·import 를
  // 한 패널로 표현하므로(버튼+파일입력 + 단일 busy/error/message 슬롯), 컨테이너도 작업별 state 를
  // 분리 보유(exporting/importing 등 — 가드·전이는 독립)하되 패널로는 단일 슬롯으로 OR 합성해
  // 내려보낸다. 우선순위는 패널 렌더 분기 정합으로 busy(둘 중 하나라도 진행) → error(export
  // error 우선, 없으면 import error) → message(export message 우선, 없으면 import message). 동시
  // 발화는 각 가드가 차단하므로 한 시점에 한 작업만 진행한다(우선순위 충돌 표면 최소). 타입은 패널
  // props 에서 파생해 시그니처 정합을 강제한다(컴포넌트 props 재정의 금지).
  const importExportPanelProps: Pick<
    DataImportExportPanelProps,
    'onExport' | 'onImportFile' | 'busy' | 'error' | 'message'
  > = {
    onExport: handleExport,
    onImportFile: handleImport,
    busy: exporting || importing,
    error: exportError ?? importError,
    message: exportMessage ?? importMessage,
  };

  // === 스케줄 패널 배선(T-0885) — 다섯 번째 패널 ==========================================
  // cron 식 입력 상태 — controlled lift-up(컨테이너 소유). SchedulePanel 의 onCronChange 가
  // 이 값을 갱신하고, handleApply 가 PUT body 의 cronExpression 으로 공급한다.
  const [cronExpression, setCronExpression] =
    useState<string>(initialCronExpression);

  // apply/trigger in-flight 플래그 — SchedulePanel 이 단일 busy 슬롯으로 두 컨트롤을 억제하므로
  // (busy=true 면 입력·버튼 미렌더 → 중복 트리거 원천 차단) 하나의 busy 상태를 공유한다. 진행 표시
  // (busy 우선)와 이중 발사 가드(runApply/runTrigger 의 busy 가드)에 함께 쓴다(④d exporting 동형).
  const [scheduleBusy, setScheduleBusy] = useState<boolean>(initialScheduleBusy);

  // apply/trigger 완료 안내 문구 — 성공 시 사람-친화 완료 안내를 보관해 message props 로 표시한다.
  // 재발화 시작·실패 시 비운다(④d exportMessage 동형). GET 파생 안내보다 우선(최신 피드백).
  const [scheduleMessage, setScheduleMessage] = useState<string | undefined>(
    undefined,
  );

  // apply/trigger 실패 문구 — 실패 시 사람-친화 문구(toErrorMessage 파생)를 보관해 error props 로
  // 안전 표시한다(throw 없음). 재발화 시작 시 비운다(④d exportError 동형).
  const [scheduleError, setScheduleError] = useState<string | undefined>(
    undefined,
  );

  // 등록 스케줄 목록 조회(GET /api/schedules, Admin+) — useApiResource 다섯 번째 호출. 응답
  // string[](등록 schedule name 목록)·loading·error 를 컨테이너가 받아 message/error props 로
  // 내려보낸다(Decision 1 — 패널은 fetch 를 모른다). Admin+ 라 User 는 403→error props 안전 표시.
  const {
    data: scheduleData,
    loading: scheduleLoading,
    error: scheduleGetError,
  } = useApiResource<string[]>(SCHEDULES_PATH);

  // 파트 재조회 nonce(T-1153) — 파트 생성 POST 성공 시 이 값을 +1 해 parts path 를 변화시켜
  // useApiResource 재조회를 유발한다(read-only hook 수정 0 경로 — groupsRefreshNonce 동형).
  // nonce 0 초기 마운트는 base path(PARTS_PATH) 그대로다(T-1152 마운트와 동일 — 회귀 0).
  const [partsRefreshNonce, setPartsRefreshNonce] = useState<number>(0);

  // 파트 목록 조회 path(T-1153) — nonce-aware 빌더로 전환(buildPartsPath). nonce 0 이면 base
  // path(T-1152 마운트와 동일), 생성 성공 후 nonce 증가가 `_r` query 로 재조회를 낸다.
  const partsPath = useMemo(
    () => buildPartsPath(partsRefreshNonce),
    [partsRefreshNonce],
  );

  // 파트 목록 조회(GET /api/parts, T-1152 마운트 → T-1153 nonce 전환) — useApiResource 호출.
  // 그룹처럼 재사용할 기존 파트 fetch 가 없어(AdminView 파트 미조회) 신규 호출이 정당하다(double-fetch
  // 대상 부재). 변수명에 part prefix 를 붙여 인원/그룹/멤버십/스케줄 등 다른 조회 상태와 섞이지 않게
  // 분리한다(groupLoading/groupError 동형). data 가 undefined(미조회/진행 중/실패)이면 렌더 시 `?? []`
  // 로 안전 방어한다. 생성 성공 시 partsRefreshNonce bump 로 이 조회를 권위 재조회한다(낙관 추가 없음).
  const {
    data: partsData,
    loading: partLoading,
    error: partError,
  } = useApiResource<PartRow[]>(partsPath);

  // 선택 파트 상태(T-1156) — controlled lift-up(컨테이너 소유). 파트 관리 섹션의 파트 선택
  // <select> 가 이 값을 갱신하고, 값이 있을 때만 소속 인원을 조건부 조회한다(selectedGroupId 동형).
  const [selectedPartId, setSelectedPartId] = useState<string>(
    initialSelectedPartId,
  );

  // 선택 파트의 소속 인원 조회 path(T-1156) — 선택이 있을 때만 조건부 path 를 만든다(미선택이면
  // null → useApiResource 미조회 idle). 선택 변경 시 path 가 달라져 자동 refetch 하고(이전 파트의
  // 인원이 잔존하지 않는다 — hook 이 path 변경마다 state 를 초기화), 파트 CRUD 성공으로
  // partsRefreshNonce 가 증가하면 `_r` query 로 소속 인원도 함께 권위 재조회한다(별도 nonce 미도입).
  const partPersonsPath = useMemo(
    () => buildPartPersonsPath(selectedPartId || undefined, partsRefreshNonce),
    [selectedPartId, partsRefreshNonce],
  );

  // 선택 파트의 소속 인원 조회(T-1156) — GET /api/parts/:id/persons 를 조건부 fetch 한다.
  // loading/error 는 컨테이너가 받아 PersonList 의 대응 props 로 내려보낸다(ADR-0041 Decision 1 —
  // 컴포넌트는 fetch 를 모른다). 404(파트 부재)/500/네트워크 실패는 모두 error 문구로 안전 표시된다.
  const {
    data: partPersonData,
    loading: partPersonLoading,
    error: partPersonError,
  } = useApiResource<PersonRow[]>(partPersonsPath);

  // 표시용 소속 인원 목록(T-1156) — 응답이 배열이 아닌 비정상 payload(객체·null·문자열 등)이거나
  // 미조회/진행 중/실패로 undefined 여도 빈 배열로 안전 방어한다(throw 0 — PersonList 가
  // undefined.length 로 깨지지 않도록). groups 파생(Array.isArray) convention 정합.
  const partPersons = useMemo(
    () => (Array.isArray(partPersonData) ? partPersonData : []),
    [partPersonData],
  );

  // 사용자 목록 조회(GET /api/users, T-1159 마운트, REQ-044/REQ-045) — useApiResource 신규 호출.
  // 파트처럼 재사용할 기존 사용자 fetch 가 없어(AdminView 사용자 미조회) 신규 단일 호출이 정당하다
  // (double-fetch 대상 부재). 변수명에 user prefix 를 붙여 인원/그룹/파트/멤버십 등 다른 조회 상태와
  // 섞이지 않게 분리한다(partLoading/partError 동형). T-1160 에서 생성 mutation 이 붙어 정적 path
  // 대신 nonce-aware buildUsersPath 조회로 전환했다(nonce 0 이면 문자열 동일 — 초기 조회 회귀 0).
  // Admin+ endpoint 라 비-Admin actor 의 요청은 403 이 되지만, 그 error 문구가 화면에 노출되지는
  // 않는다 — 아래 사용자 관리 섹션이 isAdmin gating 안쪽이라 렌더 자체가 차단되고 권한 부족 안내만
  // 남는다(fail-closed, 아래 섹션 주석 정합). 조회 hook 은 등급과 무관하게 호출되므로 요청은 나가되
  // 실패는 error state 로 흡수되어 throw 0 이다(Admin 에게만 error 문구가 표면화된다).
  // 사용자 재조회 nonce + nonce-aware 조회 path(T-1160 — partsRefreshNonce/partsPath 동형).
  const [usersRefreshNonce, setUsersRefreshNonce] = useState<number>(0);

  const usersPath = useMemo(
    () => buildUsersPath(usersRefreshNonce),
    [usersRefreshNonce],
  );

  const {
    data: usersData,
    loading: userLoading,
    error: userError,
  } = useApiResource<UserRow[]>(usersPath);

  // 사용자 생성 input·in-flight·실패 문구 상태(T-1160 — 파트 생성 state mirror, 입력만 2 필드).
  const [userEmailInput, setUserEmailInput] = useState<string>('');
  const [userPasswordInput, setUserPasswordInput] = useState<string>('');
  const [creatingUser, setCreatingUser] = useState<boolean>(false);
  const [createUserError, setCreateUserError] = useState<string | undefined>(
    undefined,
  );

  // 사용자 생성 실 mutation 핸들러(T-1160 — handleCreatePart mirror. 전이는 러너가 캡슐화).
  const handleCreateUser = useCallback(
    () =>
      runCreateUser(userEmailInput, userPasswordInput, {
        create: request,
        describeError: toErrorMessage,
        isConflict: (e: unknown) => e instanceof ApiError && e.status === 409,
        creating: creatingUser,
        setCreating: setCreatingUser,
        setCreateError: setCreateUserError,
        bumpRefresh: () => setUsersRefreshNonce((n) => n + 1),
        resetInput: () => {
          setUserEmailInput('');
          setUserPasswordInput('');
        },
      }),
    [userEmailInput, userPasswordInput, creatingUser],
  );

  // 사용자 역할 변경 in-flight·실패 문구 상태(T-1162 — 생성 state mirror. 입력 폼이 없어 2종만).
  // 생성 실패 문구(createUserError)와 별개 상태라 두 alert 가 섞이지 않는다.
  // in-flight 는 boolean 이 아니라 진행 중인 사용자 id 로 들고 있다(T-1164) — UserList 가 그 id 로
  // 진행 행을 짚어 aria-busy·진행 문구를 렌더하기 때문. undefined 는 "진행 없음".
  const [changingRoleId, setChangingRoleId] = useState<string | undefined>(
    undefined,
  );
  const [changeRoleError, setChangeRoleError] = useState<string | undefined>(
    undefined,
  );

  // 진행 id 의 동기 사본(T-1165) — 위 state 는 UserList 로 내려보내는 렌더 표면이라 같은 tick 의
  // 두 번째 발사가 stale 값을 본다. 가드는 이 ref 를 읽고, 둘은 아래 gate 가 함께 갱신한다.
  const changingRoleIdRef = useRef<string | undefined>(undefined);
  const changingRoleGate = useMemo(
    () => createInFlightIdGate(changingRoleIdRef, setChangingRoleId),
    [],
  );

  // 사용자 역할 변경 실 mutation 핸들러(T-1162 — handleCreateUser mirror. 전이는 러너가 캡슐화).
  // UserList 가 (row.id, 다음 역할)로 호출한다.
  // deps 에서 changingRoleId 를 뺐다(T-1165) — 가드가 render state 를 더는 읽지 않아 재생성이
  // 불필요하고, 남는 참조는 모두 stable 하다(request·toErrorMessage 는 모듈 import, setChangeRoleError
  // ·setUsersRefreshNonce 는 useState setter, changingRoleGate 는 deps [] 인 useMemo).
  const handleChangeRole = useCallback(
    (id: string, nextRole: string) =>
      runChangeRole(id, nextRole, {
        patch: request,
        describeError: toErrorMessage,
        isForbidden: (e: unknown) => e instanceof ApiError && e.status === 403,
        // 호출 시점 읽기 — render 시점에 캡처된 값이 아니다(이중 발사 창 차단의 핵심).
        changingId: changingRoleGate.read(),
        setChangingId: changingRoleGate.write,
        setChangeError: setChangeRoleError,
        bumpRefresh: () => setUsersRefreshNonce((n) => n + 1),
      }),
    [changingRoleGate],
  );

  // 파트 생성 controlled input 상태(T-1153) — 컨테이너 소유. "파트 추가" 클릭 시 handleCreatePart
  // 가 POST body 의 name 필드로 공급하고, 성공 후 빈 값으로 되돌린다(연속 생성 편의). 그룹 생성의
  // groupNameInput 패턴 mirror(파트도 name 단일 필드).
  const [partNameInput, setPartNameInput] = useState<string>('');

  // 파트 생성 mutation in-flight 플래그(T-1153) — POST 진행 중 true. 진행 표시(입력·버튼 비활성)와
  // 동시 재호출 가드(이전 mutation 미완 중 재발사 차단)에 함께 쓴다(creatingGroup 동형).
  const [creatingPart, setCreatingPart] = useState<boolean>(false);

  // 파트 생성 mutation 실패 문구(T-1153) — POST 실패 시 사람-친화 문구를 보관해 폼 하단에 안전
  // 표시한다(throw 없음). 409(중복 이름)면 PART_DUPLICATE_ERROR 전용 문구, 그 외는 toErrorMessage
  // 파생 문구. 성공/재시도 시작 시 비운다.
  const [createPartError, setCreatePartError] = useState<string | undefined>(
    undefined,
  );

  // 파트 생성 실 mutation 핸들러(T-1153) — 파트 생성 POST(/api/parts, body `{ name }`)를 컨테이너
  // 내부 async 로 발사한다(handleCreateGroup 정합). 빈/공백 name·이전 mutation 미완(creatingPart)
  // 발사 억제 + 성공(파트 재조회 + 입력 초기화)/실패(error 안전 표시, throw 없음)/409 중복 전용 문구
  // 전이는 runCreatePart 가 캡슐화한다. 409 판정은 ApiError.status===409 검사를 isConflict 로 주입한다.
  // 입력값·creatingPart 를 deps 의존성에 포함해 stale 없이 최신 입력·가드 상태로 발사한다.
  const handleCreatePart = useCallback(
    () =>
      runCreatePart(partNameInput, {
        create: request,
        describeError: toErrorMessage,
        isConflict: (e: unknown) => e instanceof ApiError && e.status === 409,
        creating: creatingPart,
        setCreating: setCreatingPart,
        setCreateError: setCreatePartError,
        bumpRefresh: () => setPartsRefreshNonce((n) => n + 1),
        resetInput: () => setPartNameInput(''),
      }),
    [partNameInput, creatingPart],
  );

  // 파트 삭제 mutation in-flight 플래그(T-1154) — DELETE 진행 중 true. 진행 표시(loading 우선)와
  // 동시 재호출 가드(이전 mutation 미완 중 재호출 차단)에 함께 쓴다(deletingGroup 동형).
  const [deletingPart, setDeletingPart] = useState<boolean>(false);

  // 파트 삭제 mutation 실패 문구(T-1154) — DELETE 실패 시 사람-친화 문구(toErrorMessage 파생)를
  // 보관해 목록 패널의 error props 로 안전 표시한다(throw 없음). 성공/재시도 시작 시 비운다.
  const [deletePartError, setDeletePartError] = useState<string | undefined>(
    undefined,
  );

  // onDelete 실 mutation 핸들러(T-1154) — 파트 삭제 DELETE(/api/parts/:id)를 컨테이너 내부 async
  // 로 발사한다(신규 mutation hook 미작성 — runDeleteGroup 정합). 빈/공백/falsy id·이전 mutation
  // 미완(deletingPart) 발사 억제 + 성공(파트 재조회 트리거)/실패(error 안전 표시, throw 없음) 전이는
  // runDeletePart 가 캡슐화한다. deletingPart 를 deps 의존성에 포함해 stale 없이 최신 가드 상태로
  // 발사한다. 성공 경로 전용 bumpRefresh(T-1154 계약 — 실패 시 미호출)에서 파트 재조회 nonce bump
  // 와 함께 선택 해제도 처리한다(T-1157): 선택 중인 파트를 삭제하면 selectedPartId 를 비워 사라진
  // 파트의 소속 인원 재조회(404 문구)와 <select> 표시값 불일치를 막는다. functional setState 로
  // 최신 선택값을 읽어 selectedPartId 를 deps 에 넣지 않는다(stale closure 회피 + deps 유지).
  // 실패 시 선택 유지는 bumpRefresh 미호출로 자동 보장된다(러너 시그니처 변경 0). 콜백 본문은
  // buildDeletePartBumpRefresh 순수 factory 가 소유해 test 가 실물 배선을 직접 호출·검증한다.
  const handleDeletePart = useCallback(
    (id: string) =>
      runDeletePart(id, {
        remove: request,
        describeError: toErrorMessage,
        deleting: deletingPart,
        setDeleting: setDeletingPart,
        setDeleteError: setDeletePartError,
        bumpRefresh: buildDeletePartBumpRefresh(
          setPartsRefreshNonce,
          setSelectedPartId,
          id,
        ),
      }),
    [deletingPart],
  );

  // 편집 대상 part id(T-1155) — null 이면 편집 안 함(인라인 수정 폼 미렌더). PartList 각 행의
  // "수정" 버튼 클릭 시 해당 row.id 로 채우고, 성공/취소 시 null 로 되돌린다. 편집 폼 렌더 분기
  // 기준값(editingGroupId 동형).
  const [editingPartId, setEditingPartId] = useState<string | null>(null);

  // 파트 수정 name controlled input 상태(T-1155) — 컨테이너 소유. "수정" 클릭 시 해당 row 의 현재
  // name 으로 prefill 한다(파트도 편집 필드가 name 하나뿐 — UpdatePartDto 계약). handleUpdatePart
  // 가 편집 시작 원본 name(editPartOriginalName)과 함께 러너에 넘겨 미변경 skip 을 판정한다.
  const [editPartNameInput, setEditPartNameInput] = useState<string>('');

  // 편집 시작 시점의 원본 name 스냅샷(T-1155) — runUpdatePart 가 현재 입력과 비교해 미변경이면
  // 발사를 억제하는 데 쓴다(자기 자신과의 409 유발도 함께 회피). "수정" 클릭 시 클릭한 row 의 현재
  // name 으로 채우고, 편집 종료 시 빈 문자열로 되돌린다.
  const [editPartOriginalName, setEditPartOriginalName] = useState<string>('');

  // 파트 수정 mutation in-flight 플래그(T-1155) — PATCH 진행 중 true. 진행 표시(입력·버튼 비활성)와
  // 동시 재호출 가드(이전 mutation 미완 중 재발사 차단)에 함께 쓴다(updatingGroup 동형).
  const [updatingPart, setUpdatingPart] = useState<boolean>(false);

  // 파트 수정 mutation 실패 문구(T-1155) — PATCH 실패 시 사람-친화 문구를 보관해 편집 폼 하단에 안전
  // 표시한다(throw 없음, 생성/삭제 error 와 별도 문구). 409(중복 이름)면 PART_DUPLICATE_ERROR 전용
  // 문구, 그 외는 toErrorMessage 파생 문구. 성공/재시도/편집 시작 시 비운다.
  const [updatePartError, setUpdatePartError] = useState<string | undefined>(
    undefined,
  );

  // 편집 폼 닫기(편집 상태 종료) helper(T-1155) — 편집 대상 id·name 입력·원본 스냅샷을 모두 기본값
  // 으로 되돌린다. 성공 후 closeEdit·취소 버튼 두 경로가 공유한다(resetEditGroupForm 동형).
  const resetEditPartForm = useCallback(() => {
    setEditingPartId(null);
    setEditPartNameInput('');
    setEditPartOriginalName('');
  }, []);

  // "수정" 버튼 클릭 핸들러(T-1155) — PartList.onEdit 로 내려보낸다. 클릭한 row 의 현재 name 으로 폼을
  // prefill 하고(partsData 에서 id 매칭) 원본 name 스냅샷도 함께 세팅한다(미변경 판정 기준). 직전 수정
  // error 도 비워 새 편집 세션을 깨끗이 시작한다(handleEditGroup 동형). 매칭 row 가 없으면 빈 문자열
  // prefill — 러너의 빈 name 가드가 발사를 막는다(throw 없음).
  const handleEditPart = useCallback(
    (id: string) => {
      const row = (partsData ?? []).find((part) => part.id === id);
      const name = row?.name ?? '';
      setEditingPartId(id);
      setEditPartNameInput(name);
      setEditPartOriginalName(name);
      setUpdatePartError(undefined);
    },
    [partsData],
  );

  // 편집 취소 핸들러(T-1155) — 인라인 폼을 닫고 입력·error 를 비운다(발사 없이 편집 상태만 종료 —
  // 입력이 원복된다). 진행 중(updatingPart)일 때는 취소를 억제해 PATCH 완료 전 폼이 사라지지 않게
  // 한다(버튼 disabled + 핸들러 가드 이중, handleCancelEditGroup 동형).
  const handleCancelEditPart = useCallback(() => {
    if (updatingPart) {
      return;
    }
    resetEditPartForm();
    setUpdatePartError(undefined);
  }, [updatingPart, resetEditPartForm]);

  // 파트 수정 실 mutation 핸들러(T-1155) — 파트 수정 PATCH(/api/parts/:id, body `{ name }`)를 컨테이너
  // 내부 async 로 발사한다(handleUpdateGroup 정합). 빈/falsy id·이전 mutation 미완(updatingPart)·빈·
  // 공백 name·미변경 name 발사 억제 + 성공(파트 재조회 + 편집 종료)/실패(error 안전 표시, throw 없음)/
  // 409 중복 전용 문구 전이는 runUpdatePart 가 캡슐화한다. 409 판정은 ApiError.status===409 검사를
  // isConflict 로 주입한다(handleCreatePart 동형). 입력 name·원본·편집 대상 id·updatingPart 를 deps
  // 의존성에 포함해 stale 없이 최신 입력·가드 상태로 발사한다.
  const handleUpdatePart = useCallback(
    () =>
      runUpdatePart(
        editingPartId ?? '',
        editPartNameInput,
        editPartOriginalName,
        {
          update: request,
          describeError: toErrorMessage,
          isConflict: (e: unknown) => e instanceof ApiError && e.status === 409,
          updating: updatingPart,
          setUpdating: setUpdatingPart,
          setUpdateError: setUpdatePartError,
          bumpRefresh: () => setPartsRefreshNonce((n) => n + 1),
          closeEdit: resetEditPartForm,
        },
      ),
    [
      editingPartId,
      editPartNameInput,
      editPartOriginalName,
      updatingPart,
      resetEditPartForm,
    ],
  );

  // SchedulePanel 로 내려보낼 안내 message 파생 — apply/trigger 완료 안내 우선, 없으면 GET 상태
  // (loading/빈 목록/이름 목록 요약)를 파생한다(deriveScheduleMessage). 초기 loading 도 안전 안내.
  const schedulePanelMessage = useMemo(
    () =>
      deriveScheduleMessage(scheduleData, scheduleLoading, scheduleMessage),
    [scheduleData, scheduleLoading, scheduleMessage],
  );

  // SchedulePanel 로 내려보낼 error 파생 — mutation 실패(scheduleError)를 최우선 노출하고(방금
  // 사용자가 한 apply/trigger 의 실패가 가장 최신 피드백), 없으면 GET 실패(scheduleGetError)를
  // 표시한다. 둘 다 없으면 undefined. Admin+ 미만 403 도 이 경로로 안전 표시(throw 없음). busy 중
  // 에는 패널이 error 를 무시하고 진행 표시를 우선한다(busy 우선 정책).
  const schedulePanelError = scheduleError ?? scheduleGetError;

  // onApply 실 핸들러(T-0885) — apply PUT 을 컨테이너 내부 async 로 발사한다(runImport 정합 —
  // useApiResource 는 read-on-mount 라 클릭 발화에 부적합). 빈 cron 식 발사 억제 + 이중 발사 가드 +
  // 성공/실패 message·error 전이는 runApply 가 캡슐화한다. busy 를 deps 의존성에 포함해 stale 가드
  // 방지, cronExpression 을 포함해 최신 입력값을 발사한다.
  const handleApply = useCallback(
    () =>
      runApply(cronExpression, {
        request,
        describeError: toErrorMessage,
        busy: scheduleBusy,
        setBusy: setScheduleBusy,
        setError: setScheduleError,
        setMessage: setScheduleMessage,
      }),
    [cronExpression, scheduleBusy],
  );

  // onManualTrigger 실 핸들러(T-0885) — manual trigger POST 를 컨테이너 내부 async 로 발사한다.
  // 이중 발사 가드 + 성공/실패 전이는 runTrigger 가 캡슐화한다(body 없는 202 Accepted).
  const handleManualTrigger = useCallback(
    () =>
      runTrigger({
        request,
        describeError: toErrorMessage,
        busy: scheduleBusy,
        setBusy: setScheduleBusy,
        setError: setScheduleError,
        setMessage: setScheduleMessage,
      }),
    [scheduleBusy],
  );

  // cron 식 변경 — SchedulePanel 의 cron 입력이 값을 컨테이너 상태로 올린다(controlled lift-up).
  // 그룹 선택 handleSelectChange 동형. SchedulePanel 은 이 값의 저장처를 모른다(Decision 1).
  const handleCronChange = useCallback((value: string) => {
    setCronExpression(value);
  }, []);
  // === /스케줄 패널 배선(T-0885) =========================================================

  // === 재평가 트리거 패널 배선(T-0886) — 여섯 번째 패널 ==================================
  // 선택 person 상태 — controlled lift-up(컨테이너 소유). person <select> 선택이 이 값을 갱신하고,
  // handleReevalTrigger 가 POST path param 으로 공급한다. 옵션은 선택 그룹의 파생 members 를 쓴다
  // (기존 deriveMembers 결과 재사용 — 별도 fetch 0). 그룹 선택 <select> 동형의 controlled lift-up.
  const [selectedPersonId, setSelectedPersonId] = useState<string>(
    initialSelectedPersonId,
  );

  // 선택 재수집 window(days) 상태 — controlled lift-up. ReEvaluationTriggerPanel 의 onSelect 가 이
  // 값을 갱신하고, onTrigger 가 이 값을 body.days 로 발사한다. 0(windows 미매칭)이면 panel 이
  // placeholder 로 fallback + 트리거 버튼 비활성(경계값 안전 — 의미 없는 기간 트리거 방지).
  const [selectedDays, setSelectedDays] = useState<number>(initialSelectedDays);

  // 재평가 in-flight 플래그 — POST 진행 중 true. 진행 표시(submitting 우선)와 이중 발사 가드
  // (runReEvaluate 의 submitting 가드)에 함께 쓴다(scheduleBusy 동형).
  const [reevalSubmitting, setReevalSubmitting] = useState<boolean>(
    initialReevalSubmitting,
  );

  // 재평가 실패 문구 — 실패 시 사람-친화 문구(toErrorMessage 파생)를 보관해 error props 로 안전
  // 표시한다(throw 없음). 재발화 시작 시 비운다(scheduleError 동형). 성공 시 error 는 undefined 유지.
  const [reevalError, setReevalError] = useState<string | undefined>(undefined);

  // person 선택 옵션 — 선택 그룹의 파생 members 를 재사용한다(deriveMembers 결과). 그룹 미선택/멤버
  // 0 이면 빈 옵션(placeholder 만) — 재평가 트리거는 person 미선택 가드로 안전하게 억제된다.
  const personOptions = members;

  // onTrigger 실 핸들러(T-0886) — 재평가 POST 를 컨테이너 내부 async 로 발사한다(runTrigger 정합 —
  // useApiResource 는 read-on-mount 라 클릭 발화에 부적합). 선택 personId(path param)·days(body)·
  // in-flight 여부·상태 setter 를 runReEvaluate 에 주입한다. person 미선택 발사 억제 + 이중 발사
  // 가드 + 성공/실패 전이는 runReEvaluate 가 캡슐화한다. selectedPersonId·reevalSubmitting 을 deps
  // 의존성에 포함해 stale 없이 최신값을 발사·가드한다.
  const handleReevalTrigger = useCallback(
    (days: number) =>
      runReEvaluate(selectedPersonId, days, {
        post: request,
        describeError: toErrorMessage,
        submitting: reevalSubmitting,
        setSubmitting: setReevalSubmitting,
        setError: setReevalError,
      }),
    [selectedPersonId, reevalSubmitting],
  );

  // onSelect 실 핸들러(T-0886) — panel 의 window 선택이 selectedDays 를 컨테이너 상태로 올린다
  // (controlled lift-up). handleCronChange 동형. panel 은 이 값의 저장처를 모른다(Decision 1).
  const handleReevalSelect = useCallback((days: number) => {
    setSelectedDays(days);
  }, []);

  // person 선택 변경 — person <select> 가 선택 person id 를 컨테이너 상태로 올린다(빈 값 = 미선택
  // 으로 되돌림). 그룹 선택 handleSelectChange 동형. panel 은 person 선택을 모른다(Decision 1).
  const handlePersonChange = (event: { target: { value: string } }) => {
    setSelectedPersonId(event.target.value);
  };
  // === /재평가 트리거 패널 배선(T-0886) ================================================

  // 그룹 선택 변경 — <select> 가 선택 그룹 id 를 컨테이너 상태로 올린다(빈 값 선택 시 미선택
  // 으로 되돌려 멤버 빈 상태로 표시). GroupMemberList 는 선택 상호작용을 모른다(Decision 1).
  const handleSelectChange = (event: { target: { value: string } }) => {
    setSelectedGroupId(event.target.value);
  };

  // 빈 상태 문구 결정 — 그룹 미선택이면 "그룹을 선택하면…" 안내, 선택했는데 멤버 0 이면
  // "이 그룹에 속한 인원이 없습니다" 안내를 GroupMemberList 의 emptyMessage 로 내려보낸다.
  const emptyMessage = selectedGroupId
    ? EMPTY_MEMBER_TEXT
    : NO_GROUP_SELECTED_TEXT;

  return (
    <section aria-label="Admin 관리">
      {/* 그룹 선택 컨트롤 — 그룹 목록을 옵션으로 노출하고 선택 시 그 그룹의 멤버를 파생한다.
          loading 중에는 그룹 목록이 비어 옵션이 빈 선택지만 노출되고, 멤버 패널이 loading 을
          props 로 받아 진행 표시를 한다(컨테이너가 fetch 상태를 패널로 위임). */}
      <select
        aria-label="그룹 선택"
        value={selectedGroupId}
        onChange={handleSelectChange}
      >
        <option value="">{NO_SELECTION_LABEL}</option>
        {groups.map((group, index) => (
          <option key={group.id ?? `g${index + 1}`} value={group.id ?? ''}>
            {group.name ?? FALLBACK_GROUP_NAME}
          </option>
        ))}
      </select>
      {/* 그룹 멤버 목록(첫 패널) — 선택 그룹 멤버십 fetch(GET /api/groups/:id/members, T-1129)
          결과에서 파생한 groupMembers(id = membershipId)와 그 fetch 의 loading/error 를 props 로만
          내려보낸다(ADR-0041 Decision 1 — 패널은 fetch 를 모른다). onRemove 배선(T-1130)으로 각
          멤버 행에 제거 버튼이 렌더되고, 클릭 시 그 행의 membershipId 로 DELETE :id/members/:membershipId
          를 발사한다(handleRemove). loading/error 는 멤버십 조회와 remove mutation 을 합성한다
          (removing||membersLoading / removeError??membersError — mutation 우선). 컴포넌트 수정 0. */}
      <GroupMemberList
        members={groupMembers}
        loading={removing || membersLoading}
        error={removeError ?? membersError}
        emptyMessage={emptyMessage}
        onRemove={handleRemove}
      />
      {/* 멤버 추가(T-1131) — personId 입력 + "추가" 버튼. GroupMemberList(presentational)는 display +
          onRemove 만 책임지므로 add 컨트롤은 컨테이너가 직접 소유한다(controlled lift-up, ADR-0041
          Decision 1 — 컴포넌트 수정 0). 클릭 시 handleAdd 가 POST /api/groups/:id/members(body
          `{ personId }`)를 발사하고, 성공 시 membersRefreshNonce bump 로 권위 재조회한다(낙관 override
          없음 — remove 동형). 선택 그룹 미선택/진행 중/빈·공백 입력일 때는 버튼을 비활성화해 발사를 억제
          하고(runAdd 도 동일 조건을 no-op 가드로 이중 방어), 입력은 미선택/진행 중에도 비활성화한다.
          실패 문구(addError)는 입력 하단에 안전 표시한다(throw 없음). */}
      <div>
        <input
          aria-label="추가할 멤버 personId"
          type="text"
          value={personIdInput}
          onChange={(event) => setPersonIdInput(event.target.value)}
          disabled={!selectedGroupId || adding}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!selectedGroupId || adding || !personIdInput.trim()}
        >
          추가
        </button>
        {addError ? <p role="alert">{addError}</p> : null}
      </div>
      {/* Admin+ RBAC gating(④h) — Admin/SuperAdmin 등급(isAdmin === true)에게만 Admin 전용 패널
          (DifficultyModelSelector + scope <select> + DataImportExportPanel)을 렌더한다. 세 패널은
          모두 Admin+ endpoint(GET /api/llm/providers·/difficulty-mappings·/admin/export·/admin/import,
          api.md 114·119·122·123)에 의존하므로, 비-Admin(또는 등급 불명/조회 중)에게는 패널을 아예
          마운트하지 않고(403 노이즈 차단) 권한 부족 안내 한 줄만 보여준다(fail-closed). gating
          판정·등급 파생은 컨테이너 책임이고 패널 props 계약은 불변이다(ADR-0041 Decision 1 — 패널은
          gating 을 모른다). GroupMemberList + 그룹 선택 <select> 는 GET /api/groups 가 User+ 라
          gating 대상이 아니며 위에서 등급 무관 렌더된다. */}
      {isAdmin ? (
        <>
          {/* LLM 모델 지정(두 번째 패널) — provider 목록·난이도 매핑을 파생해 props 로만 내려보낸다
              (ADR-0041 Decision 1 — 패널은 fetch/PATCH 를 모른다). llmLoading/llmError 는 두 LLM 읽기
              조회 + mutation(assigning/assignError)의 loading/error 합성(④c — mutation 우선). onAssign 은
              실 PATCH(/api/llm/difficulty-mappings/:difficulty) async 핸들러(④c) — 성공 시 재조회 +
              낙관 반영, 실패 시 error props 안전 표시(throw 없음). 컴포넌트 수정 0. */}
          <DifficultyModelSelector
            providers={providers}
            mapping={difficultyMapping}
            onAssign={handleAssign}
            loading={llmLoading}
            error={llmError}
          />
          {/* 등록된 LLM provider 설정 목록(T-1134 마운트 + T-1135 삭제 배선, R-96). 기존 providerData 를
              재사용해 sanitized view(providerConfigs)로 파생하고, 삭제 콜백(handleDeleteProvider)을
              onDelete 로 내려 각 행에 삭제 버튼을 배선한다. loading 은 조회+삭제 in-flight 를 합성
              (providersLoading||deletingProvider — remove 패널 동형), error 는 삭제 실패를 우선 노출
              (deleteProviderError??providersError — mutation 우선). 성공 시 providersRefreshNonce bump
              로 권위 재조회한다(낙관 제거 없음). 수정(PATCH)은 onEdit 배선 + 아래 인라인 폼(T-1137). */}
          <LlmProviderConfigList
            providers={providerConfigs}
            loading={providersLoading || deletingProvider}
            error={deleteProviderError ?? providersError}
            onDelete={handleDeleteProvider}
            onEdit={handleEditProvider}
          />
          {/* provider 수정(T-1137, R-96) — 인라인 수정 폼. LlmProviderConfigList 각 행의 "수정"
              버튼(onEdit=handleEditProvider)이 편집 대상 id 를 세팅하면(editingProviderId !== null)
              본 폼이 렌더된다. 4 controlled input(provider/endpointUrl/apiKey/modelId)은 클릭한 row
              의 현재 값으로 prefill 하되, apiKey 는 read never-back 이라 빈 값으로 시작하고
              placeholder 로 "변경 시에만 입력" 을 안내한다(입력 시에만 PATCH body 에 포함 → 기존
              ciphertext 유지). "provider 수정" 클릭 시 handleUpdateProvider 가 PATCH
              /api/llm/providers/:id(변경 필드만 body)를 발사하고, 성공 시 providersRefreshNonce bump
              로 권위 재조회 + 편집 종료한다(낙관 갱신 없음 — 생성/삭제 동형). 진행 중(updatingProvider)
              이면 입력·버튼을 비활성화해 이중 PATCH 를 억제하고(runUpdateProvider 도 동일 조건을 no-op
              가드로 이중 방어), "취소" 로 발사 없이 편집을 닫을 수 있다. apiKey 는 secret
              input(type="password")으로 노출을 줄이고 실패 문구(updateProviderError)에도 재노출되지
              않는다(삭제/생성 error 와 별도 문구). ADR-0041 Decision 1 — presentational 목록은 수정
              폼을 모르므로 컨테이너가 직접 소유한다(컴포넌트 수정 0). */}
          {editingProviderId !== null ? (
            <div>
              {/* provider 입력을 5-provider select 로 constrain(T-1138, R-99~103). 편집 대상 row 의
                  provider 값(editProviderInput)이 5 개 중 하나면 그 option 이 선택되고, 목록에 없는
                  레거시/비정상 값이면 placeholder(빈 value)로 fallback 렌더된다(브라우저는 매칭 option
                  부재 시 첫 option 을 선택). value/onChange 계약은 기존 text input 과 동일해 PATCH body
                  조립·가드는 수정 0. */}
              <select
                aria-label="수정할 provider"
                value={resolveProviderSelectValue(editProviderInput)}
                onChange={(event) => setEditProviderInput(event.target.value)}
                disabled={updatingProvider}
              >
                <option value="">{LLM_PROVIDER_PLACEHOLDER_LABEL}</option>
                {LLM_PROVIDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                aria-label="수정할 provider endpointUrl"
                type="text"
                value={editEndpointUrlInput}
                onChange={(event) => setEditEndpointUrlInput(event.target.value)}
                disabled={updatingProvider}
              />
              <input
                aria-label="수정할 provider apiKey"
                type="password"
                placeholder="변경 시에만 입력"
                value={editApiKeyInput}
                onChange={(event) => setEditApiKeyInput(event.target.value)}
                disabled={updatingProvider}
              />
              <input
                aria-label="수정할 provider modelId"
                type="text"
                value={editModelIdInput}
                onChange={(event) => setEditModelIdInput(event.target.value)}
                disabled={updatingProvider}
              />
              <button
                type="button"
                onClick={handleUpdateProvider}
                disabled={updatingProvider}
              >
                provider 수정
              </button>
              <button
                type="button"
                onClick={handleCancelEditProvider}
                disabled={updatingProvider}
              >
                취소
              </button>
              {updateProviderError ? (
                <p role="alert">{updateProviderError}</p>
              ) : null}
            </div>
          ) : null}
          {/* provider 생성(T-1136, R-96) — 4 controlled input(provider/endpointUrl/apiKey/modelId) +
              "추가" 버튼. LlmProviderConfigList(presentational, 읽기 전용 목록 + 삭제)는 생성 컨트롤을
              모르므로 컨테이너가 직접 소유한다(controlled lift-up, ADR-0041 Decision 1 — 컴포넌트 수정
              0). 클릭 시 handleCreateProvider 가 POST /api/llm/providers(body 4 필드)를 발사하고, 성공
              시 providersRefreshNonce bump 로 권위 재조회한다(낙관 추가 없음 — 삭제/추가 동형). 4 필드
              중 하나라도 빈·공백이거나 진행 중이면 버튼을 비활성화해 발사를 억제하고(runCreateProvider
              도 동일 조건을 no-op 가드로 이중 방어), 입력은 진행 중에도 비활성화한다. apiKey 는 secret
              input(type="password")으로 화면 노출을 줄이되 생성 body 전송만 담당하고, 실패 문구
              (createProviderError)에도 재노출되지 않는다(삭제 error 와 별도 문구). */}
          <div>
            {/* provider 입력을 5-provider select 로 constrain(T-1138, R-99~103). placeholder(빈
                value) 를 선두 배치해 미선택 시 생성 버튼 가드(!providerInput.trim())가 그대로 발화한다
                (POST 미호출). value/onChange 계약은 기존 text input 과 동일해 POST body 조립은 수정 0 —
                선택 불가능한 지원 외 값은 option 부재로 제출 자체가 봉쇄된다. */}
            <select
              aria-label="생성할 provider"
              value={providerInput}
              onChange={(event) => setProviderInput(event.target.value)}
              disabled={creatingProvider}
            >
              <option value="">{LLM_PROVIDER_PLACEHOLDER_LABEL}</option>
              {LLM_PROVIDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              aria-label="생성할 provider endpointUrl"
              type="text"
              value={endpointUrlInput}
              onChange={(event) => setEndpointUrlInput(event.target.value)}
              disabled={creatingProvider}
            />
            <input
              aria-label="생성할 provider apiKey"
              type="password"
              value={apiKeyInput}
              onChange={(event) => setApiKeyInput(event.target.value)}
              disabled={creatingProvider}
            />
            <input
              aria-label="생성할 provider modelId"
              type="text"
              value={modelIdInput}
              onChange={(event) => setModelIdInput(event.target.value)}
              disabled={creatingProvider}
            />
            <button
              type="button"
              onClick={handleCreateProvider}
              disabled={
                creatingProvider ||
                !providerInput.trim() ||
                !endpointUrlInput.trim() ||
                !apiKeyInput.trim() ||
                !modelIdInput.trim()
              }
            >
              provider 추가
            </button>
            {createProviderError ? (
              <p role="alert">{createProviderError}</p>
            ) : null}
          </div>
          {/* export scope 선택 컨트롤(④g) — 컨테이너가 직접 렌더한다(그룹 선택 <select> 동형 —
              presentational DataImportExportPanel 은 scope 를 모른다, ADR-0041 Decision 1). 선택값은
              handleExport 가 buildExportPath 로 GET /api/admin/export?scope= query 에 부착하고, 빈
              선택(전체) 시에는 query 없이 호출한다(④f 동작 유지). scope 후보는 frontend-local 보수
              목록(EXPORT_SCOPE_OPTIONS) — backend 확정 enum 정합은 후속. */}
          <select
            aria-label="export 범위 선택"
            value={selectedScope}
            onChange={handleScopeChange}
          >
            {EXPORT_SCOPE_OPTIONS.map((option) => (
              <option key={option.value || '__all__'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {/* 데이터 import/export(세 번째 패널, ④d export + ④e import) — export·import 콜백·진행·
              결과·실패를 컨테이너가 소유하고 패널은 onExport/onImportFile 콜백 + busy/error/message
              props 만 소비한다(ADR-0041 Decision 1 — 패널은 fetch/FormData 를 모른다). onImportFile
              배선으로 파일 입력이 활성화된다(④d 가 비활성화했던 입력 활성). import 는 POST
              /api/admin/import 로 multipart FormData 전송(④e). scope query 부착은 컨테이너 책임 —
              패널 props 계약 불변(④g). 컴포넌트 수정 0. */}
          <DataImportExportPanel {...importExportPanelProps} />
          {/* 스케줄 설정(다섯 번째 패널, T-0885 — P6 deferred wiring 재개) — cron 주기 지정(R-72)·
              manual trigger(R-73)의 콜백·진행·결과·실패를 컨테이너가 소유하고, 패널은 cronExpression·
              onCronChange·onApply·onManualTrigger·busy·error·message props 만 소비한다(ADR-0041
              Decision 1 — 패널은 fetch 를 모른다). onCronChange/onApply/onManualTrigger 배선으로
              입력·버튼이 활성화된다(콜백 미전달 시 패널이 비활성 렌더). apply 는 PUT /api/schedules
              (단일 default name + cron 식), trigger 는 POST /api/schedules/trigger(body 없음). GET
              /api/schedules 목록·loading 은 message 로, GET 실패·mutation 실패는 error 로 합성해
              내려보낸다(schedulePanelMessage/schedulePanelError). 컴포넌트 수정 0. */}
          <SchedulePanel
            cronExpression={cronExpression}
            onCronChange={handleCronChange}
            onApply={handleApply}
            onManualTrigger={handleManualTrigger}
            busy={scheduleBusy}
            error={schedulePanelError}
            message={schedulePanelMessage}
          />
          {/* 재평가 인원 선택 컨트롤(T-0886) — 선택 그룹의 파생 members 를 옵션으로 노출한다(그룹
              선택 <select> 동형 controlled lift-up — presentational 패널은 person 선택을 모른다,
              ADR-0041 Decision 1). 선택된 personId 가 재평가 POST 의 path param 으로 쓰인다. 그룹
              미선택/멤버 0 이면 placeholder 만 노출(재평가는 person 미선택 가드로 억제 — crash 없음). */}
          <select
            aria-label="재평가 인원 선택"
            value={selectedPersonId}
            onChange={handlePersonChange}
          >
            <option value="">{NO_PERSON_SELECTION_LABEL}</option>
            {personOptions.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          {/* 재평가 트리거(여섯 번째 패널, T-0886 — P6 deferred wiring 완결) — 최근 N일 delete→재수집
              (R-74)의 window 후보·선택·진행·실패를 컨테이너가 소유하고, 패널은 windows·selectedDays·
              onSelect·onTrigger·submitting·error props 만 소비한다(ADR-0041 Decision 1 — 패널은
              fetch 를 모른다). onSelect 는 selectedDays 갱신, onTrigger 는 POST /api/schedules/
              recent-deletion/:personId 로 { instants: [], days } body 를 발사한다(person 미선택 시
              가드로 억제). 성공은 error 없음으로, 실패는 error props(reevalError)로 안전 표시한다
              (throw 없음). windows 는 frontend-local 상수(REEVAL_WINDOW_OPTIONS). 컴포넌트 수정 0. */}
          <ReEvaluationTriggerPanel
            windows={REEVAL_WINDOW_OPTIONS}
            selectedDays={selectedDays}
            onSelect={handleReevalSelect}
            onTrigger={handleReevalTrigger}
            submitting={reevalSubmitting}
            error={reevalError}
          />
          {/* 사용자 관리(T-1159 마운트, REQ-044/REQ-045) — 파트 마운트(T-1152)와 동형이나 GET
              /api/users 가 Admin+ 전용이라 본 섹션만 isAdmin gating 안쪽에 둔다(비-Admin 에게는 아예
              마운트하지 않아 403 목록이 화면에 남지 않는다 — 위 fail-closed 정책 정합). 신규 조회
              useApiResource<UserRow[]>(USERS_PATH) 의 data/loading/error 를 그대로 UserList 로 내려
              보낸다(ADR-0041 Decision 1 — 컴포넌트는 fetch 를 모른다). data 가 undefined(미조회/진행
              중/실패)이면 `?? []` 로 빈 배열을 안전하게 넘겨 throw 없이 렌더한다(경계 방어). 생성
              (T-1160)·역할 변경(T-1162) mutation 이 배선돼 있고, onChangeRole 은 isSuperAdmin 일
              때만 내려간다(비-SuperAdmin 에겐 undefined → 버튼 미렌더로 확정 403 사전 차단).
              UserList 의 named UserRow 를 조회 제네릭에 그대로 쓴다(컴포넌트 수정 0). */}
          <section aria-label="사용자 관리 섹션">
            <h2>{USER_HEADING}</h2>
            {/* 사용자 생성(T-1160, REQ-044/REQ-045) — 파트 생성 폼(T-1153) mirror, 입력만 2 필드.
                빈 입력·진행 중엔 버튼·입력 비활성으로 발사 억제(러너도 no-op 가드로 이중 방어). */}
            <div>
              <input
                aria-label="추가할 사용자 이메일"
                type="text"
                value={userEmailInput}
                onChange={(event) => setUserEmailInput(event.target.value)}
                disabled={creatingUser}
              />
              <input
                aria-label="추가할 사용자 비밀번호"
                type="password"
                value={userPasswordInput}
                onChange={(event) => setUserPasswordInput(event.target.value)}
                disabled={creatingUser}
              />
              <button
                type="button"
                onClick={handleCreateUser}
                disabled={
                  creatingUser || !userEmailInput.trim() || !userPasswordInput
                }
              >
                사용자 추가
              </button>
              {createUserError ? <p role="alert">{createUserError}</p> : null}
            </div>
            {/* 역할 변경 실패 문구(T-1162) — 생성 실패 alert 와 별개 상태라 서로 섞이지 않는다. */}
            {changeRoleError ? <p role="alert">{changeRoleError}</p> : null}
            {/* changingRoleId(T-1164) — 진행 중인 역할 변경 대상 id 를 내려보낸다. 그 행에만
                aria-busy·진행 문구가 붙고 진행 중에는 모든 역할 변경 버튼이 비활성화된다. */}
            <UserList
              users={usersData ?? []}
              loading={userLoading}
              error={userError}
              onChangeRole={isSuperAdmin ? handleChangeRole : undefined}
              changingRoleId={changingRoleId}
            />
          </section>
        </>
      ) : (
        // 비-Admin(또는 등급 불명/조회 중) — Admin 전용 패널 대신 권한 부족 안내 한 줄(fail-closed).
        <p role="status">{NOT_ADMIN_NOTICE_TEXT}</p>
      )}
      {/* 인원 관리(T-1142 목록 + T-1143 생성, REQ-049/REQ-023) — backend Person API(GET /api/persons
          active 인원 Person[] 반환)를 사람이 볼 수 있게 목록으로 표시하고, POST /api/persons 로 신규
          인원을 추가하는 생성 폼을 함께 배선한다. 기존 패널과 시각적으로 구분되는 별도 섹션(heading +
          폼 + 컴포넌트)으로 마운트하고, 인원 조회의 loading/error 와 인원 배열만 PersonList 로
          내려보낸다(다른 조회 상태와 섞지 않음 — ADR-0041 Decision 1, 컴포넌트는 fetch 를 모른다).
          data 가 undefined(미조회/진행 중/실패)이면 `?? []` 로 빈 배열을 안전하게 넘겨 throw 없이
          렌더한다. 생성 성공 시 personsRefreshNonce bump 로 권위 재조회한다(낙관 추가 없음). */}
      <section aria-label={PERSON_HEADING}>
        <h2>{PERSON_HEADING}</h2>
        {/* 인원 생성 폼(T-1143, REQ-023) — 2 controlled input(fullName/email) + "인원 추가" 버튼.
            PersonList(presentational 읽기 전용 목록)는 생성 컨트롤을 모르므로 컨테이너가 직접 소유한다
            (controlled lift-up, ADR-0041 Decision 1 — 컴포넌트 수정 0). 클릭 시 handleCreatePerson 이
            POST /api/persons(body 2 필드)를 발사하고, 성공 시 personsRefreshNonce bump 로 권위
            재조회한다(낙관 추가 없음). 2 필드 중 하나라도 빈·공백이거나 진행 중이면 버튼을 비활성화해
            발사를 억제하고(runCreatePerson 도 동일 조건을 no-op 가드로 이중 방어), 입력은 진행 중에도
            비활성화한다. 실패 문구(createPersonError)는 폼 하단에 role="alert" 로 안전 표시한다. */}
        <div>
          <input
            aria-label="추가할 인원 이름"
            type="text"
            value={fullNameInput}
            onChange={(event) => setFullNameInput(event.target.value)}
            disabled={creatingPerson}
          />
          <input
            aria-label="추가할 인원 email"
            type="email"
            value={emailInput}
            onChange={(event) => setEmailInput(event.target.value)}
            disabled={creatingPerson}
          />
          <button
            type="button"
            onClick={handleCreatePerson}
            disabled={
              creatingPerson || !fullNameInput.trim() || !emailInput.trim()
            }
          >
            인원 추가
          </button>
          {createPersonError ? (
            <p role="alert">{createPersonError}</p>
          ) : null}
        </div>
        {/* 인원 수정(T-1145, REQ-049) — 인라인 수정 폼. PersonList 각 행의 "수정" 버튼(onEdit=
            handleEditPerson)이 편집 대상 id 를 세팅하면(editingPersonId !== null) 본 폼이 렌더된다.
            3 controlled input(fullName text / email email / active <select> 활성·휴직)은 클릭한 row 의
            현재 값으로 prefill 되고, 원본 스냅샷(editPersonOriginal)과 함께 저장된다. "인원 수정" 클릭 시
            handleUpdatePerson 이 buildPersonPatch 로 변경 필드만 조립해 PATCH /api/persons/:id 를 발사하고,
            성공 시 personsRefreshNonce bump 로 권위 재조회 + 편집 종료한다(낙관 갱신 없음 — 생성/삭제 동형).
            진행 중(updatingPerson)이면 입력·버튼을 비활성화해 이중 PATCH 를 억제하고(runUpdatePerson 도
            빈 patch/in-flight 를 no-op 가드로 이중 방어), "취소" 로 발사 없이 편집을 닫을 수 있다. 실패
            문구(updatePersonError)는 폼 하단에 role="alert" 로 안전 표시한다(생성/삭제 error 와 별도).
            ADR-0041 Decision 1 — presentational 목록은 수정 폼을 모르므로 컨테이너가 직접 소유한다. */}
        {editingPersonId !== null ? (
          <div>
            <input
              aria-label="수정할 인원 이름"
              type="text"
              value={editFullNameInput}
              onChange={(event) => setEditFullNameInput(event.target.value)}
              disabled={updatingPerson}
            />
            <input
              aria-label="수정할 인원 email"
              type="email"
              value={editEmailInput}
              onChange={(event) => setEditEmailInput(event.target.value)}
              disabled={updatingPerson}
            />
            {/* active 는 boolean 이라 <select> 로 활성/휴직 두 값을 controlled 로 노출한다(soft
                deactivate/reactivate — UpdatePersonDto active). 값은 'active'/'inactive' 문자열이되
                onChange 에서 boolean 으로 환원해 상태에 저장한다. */}
            <select
              aria-label="수정할 인원 활성 여부"
              value={editActiveInput ? 'active' : 'inactive'}
              onChange={(event) =>
                setEditActiveInput(event.target.value === 'active')
              }
              disabled={updatingPerson}
            >
              <option value="active">활성</option>
              <option value="inactive">휴직</option>
            </select>
            <button
              type="button"
              onClick={handleUpdatePerson}
              disabled={updatingPerson}
            >
              인원 수정
            </button>
            <button
              type="button"
              onClick={handleCancelEditPerson}
              disabled={updatingPerson}
            >
              취소
            </button>
            {updatePersonError ? (
              <p role="alert">{updatePersonError}</p>
            ) : null}
          </div>
        ) : null}
        {/* 인원 삭제 배선(T-1144, REQ-049) + 인원 수정 배선(T-1145) — 삭제 콜백(handleDeletePerson)을
            onDelete 로, 수정 콜백(handleEditPerson)을 onEdit 로 내려 각 행에 삭제·수정 버튼을 배선한다.
            loading 은 조회+삭제 in-flight 를 합성(personLoading||deletingPerson — provider 목록 패널
            동형), error 는 삭제 실패를 우선 노출(deletePersonError??personError — mutation 우선). 성공
            시 personsRefreshNonce bump 로 권위 재조회한다(낙관 제거 없음). */}
        <PersonList
          persons={personData ?? []}
          loading={personLoading || deletingPerson}
          error={deletePersonError ?? personError}
          onDelete={handleDeletePerson}
          onEdit={handleEditPerson}
        />
      </section>
      {/* 그룹 관리(T-1146, REQ-028/REQ-049) — 그룹 생성 폼을 담는 별도 섹션. 그룹 목록은 기존 select
          조회부(useApiResource<GroupRow[]>)가 소유하므로 본 slice 는 생성 성공 시 groupsRefreshNonce
          bump 로 그 조회를 권위 재조회만 갱신한다(별도 목록 카드 UI 는 Out of Scope). name 단일
          controlled input + "그룹 추가" 버튼으로 POST /api/groups(body `{ name }`)를 발사하고, name 이
          빈·공백이거나 진행 중이면 버튼을 비활성화해 발사를 억제한다(runCreateGroup 도 no-op 가드로 이중
          방어), 입력은 진행 중에도 비활성화한다. 실패 문구(createGroupError)는 폼 하단에 role="alert" 로
          안전 표시한다. Group.name 은 @unique 미정의라 409 특수 분기 없이 일반 error 로 표면화한다. */}
      <section aria-label={GROUP_HEADING}>
        <h2>{GROUP_HEADING}</h2>
        <div>
          <input
            aria-label="추가할 그룹 이름"
            type="text"
            value={groupNameInput}
            onChange={(event) => setGroupNameInput(event.target.value)}
            disabled={creatingGroup}
          />
          <button
            type="button"
            onClick={handleCreateGroup}
            disabled={creatingGroup || !groupNameInput.trim()}
          >
            그룹 추가
          </button>
          {createGroupError ? <p role="alert">{createGroupError}</p> : null}
        </div>
        {/* 그룹 수정(T-1150, REQ-028/REQ-049) — 인라인 수정 폼. GroupList 각 행의 "수정" 버튼(onEdit=
            handleEditGroup)이 편집 대상 id 를 세팅하면(editingGroupId !== null) 본 폼이 렌더된다. name
            단일 controlled input 은 클릭한 row 의 현재 name 으로 prefill 되고, 원본 name 스냅샷
            (editGroupOriginalName)과 함께 저장된다. "그룹 수정" 클릭 시 handleUpdateGroup 이 PATCH
            /api/groups/:id(body `{ name }`)를 발사하고, 성공 시 groupsRefreshNonce bump 로 권위 재조회 +
            편집 종료한다(낙관 갱신 없음 — 인원 수정 동형). 진행 중(updatingGroup)이면 입력·버튼을
            비활성화해 이중 PATCH 를 억제하고(runUpdateGroup 도 빈·공백·미변경 name/in-flight 를 no-op
            가드로 이중 방어), "취소" 로 발사 없이 편집을 닫을 수 있다. 실패 문구(updateGroupError)는 폼
            하단에 role="alert" 로 안전 표시한다(생성/삭제 error 와 별도). ADR-0041 Decision 1 —
            presentational 목록은 수정 폼을 모르므로 컨테이너가 직접 소유한다. */}
        {editingGroupId !== null ? (
          <div>
            <input
              aria-label="수정할 그룹 이름"
              type="text"
              value={editGroupNameInput}
              onChange={(event) => setEditGroupNameInput(event.target.value)}
              disabled={updatingGroup}
            />
            <button
              type="button"
              onClick={handleUpdateGroup}
              disabled={updatingGroup || !editGroupNameInput.trim()}
            >
              그룹 수정
            </button>
            <button
              type="button"
              onClick={handleCancelEditGroup}
              disabled={updatingGroup}
            >
              취소
            </button>
            {updateGroupError ? (
              <p role="alert">{updateGroupError}</p>
            ) : null}
          </div>
        ) : null}
        {/* 그룹 목록 카드(T-1148 마운트, T-1149 삭제 배선, REQ-028/REQ-049) — 기존 그룹 조회
            (useApiResource<GroupRow[]>)의 data/loading/error 를 재사용해(새 fetch 추가 없음 —
            double-fetch 회피) GroupList 로 내려보낸다. data 가 undefined(미조회/진행 중/실패)이면
            `?? []` 로 빈 배열을 안전하게 넘겨 throw 없이 렌더한다(경계 방어). onDelete(handleDeleteGroup)
            를 내려 각 행에 삭제 버튼을 배선한다(T-1149, PersonList onDelete 동형). loading 은 조회+삭제
            in-flight 를 합성(groupLoading||deletingGroup), error 는 삭제 실패를 우선 노출
            (deleteGroupError??groupError — mutation 우선). 성공 시 groupsRefreshNonce bump 로 권위
            재조회한다(낙관 제거 없음). onEdit(handleEditGroup)를 내려 각 행에 수정 버튼을 배선한다
            (T-1150, PersonList onEdit 동형 — 클릭 시 대상 id 로 인라인 수정 폼을 연다). 로컬 GroupRow 를
            그대로 넘긴다(GroupList 의 named GroupRow 미import — 구조적 타입 호환). ADR-0041 Decision 1 —
            presentational 컴포넌트는 fetch 를 모른다. */}
        <GroupList
          groups={data ?? []}
          loading={groupLoading || deletingGroup}
          error={deleteGroupError ?? groupError}
          onDelete={handleDeleteGroup}
          onEdit={handleEditGroup}
        />
      </section>
      {/* 파트 관리(T-1152 마운트, T-1153 생성 배선, T-1154 삭제 배선, T-1155 수정 배선,
          REQ-028/REQ-049) — 그룹
          마운트(T-1148)와 동형이나 재사용할 기존 파트 fetch 가 없어 useApiResource<PartRow[]>(PARTS_PATH)
          신규 조회의 data/loading/error 를 PartList 로 내려보낸다(ADR-0041 Decision 1 — 컴포넌트는 fetch
          를 모른다). data 가 undefined(미조회/진행 중/실패)이면 `?? []` 로 빈 배열을 안전하게 넘겨 throw
          없이 렌더한다(경계 방어). onDelete(handleDeletePart)를 내려 각 행에 삭제 버튼을 배선한다(T-1154,
          GroupList onDelete 동형). loading 은 조회+삭제 in-flight 를 합성(partLoading||deletingPart),
          error 는 삭제 실패를 우선 노출(deletePartError??partError — mutation 우선). 성공 시
          partsRefreshNonce bump 로 권위 재조회한다(낙관 제거 없음). onEdit(handleEditPart)도 내려 각 행에
          수정 버튼을 배선한다(T-1155 — 파트 CRUD 완결). PartList 의 named PartRow 를 그대로 조회 제네릭·props 타입에 쓴다
          (로컬 PartRow 부재 — 이름 충돌 없음). */}
      <section aria-label={PART_HEADING}>
        <h2>{PART_HEADING}</h2>
        {/* 파트 생성(T-1153, REQ-028/REQ-049) — 그룹 생성 폼(T-1146)을 mirror. name 단일 controlled
            input + "파트 추가" 버튼으로 POST /api/parts(body `{ name }`)를 발사하고, name 이 빈·공백
            이거나 진행 중이면 버튼을 비활성화해 발사를 억제한다(runCreatePart 도 no-op 가드로 이중 방어),
            입력도 진행 중엔 비활성화한다. 성공 시 partsRefreshNonce bump 로 위 파트 조회를 권위 재조회한다
            (별도 낙관 추가 없음). 실패 문구(createPartError)는 폼 하단에 role="alert" 로 안전 표시한다 —
            Part.name @unique 위반 409 는 "이미 존재하는 파트 이름입니다" 전용 문구로 구분 표면화한다. */}
        <div>
          <input
            aria-label="추가할 파트 이름"
            type="text"
            value={partNameInput}
            onChange={(event) => setPartNameInput(event.target.value)}
            disabled={creatingPart}
          />
          <button
            type="button"
            onClick={handleCreatePart}
            disabled={creatingPart || !partNameInput.trim()}
          >
            파트 추가
          </button>
          {createPartError ? <p role="alert">{createPartError}</p> : null}
        </div>
        {/* 파트 수정(T-1155, REQ-028/REQ-049) — 인라인 수정 폼. PartList 각 행의 "수정" 버튼(onEdit=
            handleEditPart)이 편집 대상 id 를 세팅하면(editingPartId !== null) 본 폼이 렌더된다. name
            단일 controlled input 은 클릭한 row 의 현재 name 으로 prefill 되고, 원본 name 스냅샷
            (editPartOriginalName)과 함께 저장된다. "파트 수정" 클릭 시 handleUpdatePart 가 PATCH
            /api/parts/:id(body `{ name }`)를 발사하고, 성공 시 partsRefreshNonce bump 로 권위 재조회 +
            편집 종료한다(낙관 갱신 없음 — 그룹 수정 동형). 진행 중(updatingPart)이면 입력·버튼을
            비활성화해 이중 PATCH 를 억제하고(runUpdatePart 도 빈·공백·미변경 name/in-flight 를 no-op
            가드로 이중 방어), "취소" 로 발사 없이 편집을 닫을 수 있다(입력 원복). 실패 문구
            (updatePartError)는 폼 하단에 role="alert" 로 안전 표시한다 — Part.name @unique 위반 409 는
            "이미 존재하는 파트 이름입니다" 전용 문구로 구분 표면화한다(그룹과의 차이). ADR-0041
            Decision 1 — presentational 목록은 수정 폼을 모르므로 컨테이너가 직접 소유한다. */}
        {editingPartId !== null ? (
          <div>
            <input
              aria-label="수정할 파트 이름"
              type="text"
              value={editPartNameInput}
              onChange={(event) => setEditPartNameInput(event.target.value)}
              disabled={updatingPart}
            />
            <button
              type="button"
              onClick={handleUpdatePart}
              disabled={updatingPart || !editPartNameInput.trim()}
            >
              파트 수정
            </button>
            <button
              type="button"
              onClick={handleCancelEditPart}
              disabled={updatingPart}
            >
              취소
            </button>
            {updatePartError ? <p role="alert">{updatePartError}</p> : null}
          </div>
        ) : null}
        {/* onEdit(handleEditPart)를 내려 각 행에 수정 버튼을 배선한다(T-1155, GroupList onEdit 동형 —
            클릭 시 대상 id 로 위 인라인 수정 폼을 연다). loading 은 조회+삭제 in-flight 합성 그대로
            둔다(수정 진행 표시는 폼 자체의 비활성화가 담당 — 목록을 로딩으로 가려 수정 폼이 사라지는
            혼란 방지, 그룹 수정 배선 동형). */}
        <PartList
          parts={partsData ?? []}
          loading={partLoading || deletingPart}
          error={deletePartError ?? partError}
          onDelete={handleDeletePart}
          onEdit={handleEditPart}
        />
        {/* 파트 소속 인원 조회(T-1156, REQ-049) — 그룹 멤버십 조건부 조회(T-1129) 를 mirror 한다.
            파트 선택 <select>(컨테이너 소유 selectedPartId)가 값을 가지면 buildPartPersonsPath 가
            path 를 만들어 GET /api/parts/:id/persons 를 조건부 조회하고, 미선택이면 null → 미조회
            (idle)로 남는다. 조회 결과는 기존 PersonList 를 읽기 전용으로 재사용해 렌더한다 —
            onDelete/onEdit 를 전달하지 않아 삭제·수정 버튼이 렌더되지 않는다(소속 인원 배정·해제
            mutation 은 Out of Scope). 빈 상태 문구는 미선택(NO_PART_SELECTED_TEXT)과 인원 0
            (EMPTY_PART_PERSON_TEXT)을 구분해 내려보낸다. 컴포넌트 수정 0(ADR-0041 Decision 1). */}
        <select
          aria-label="소속 인원을 볼 파트 선택"
          value={selectedPartId}
          onChange={(event) => setSelectedPartId(event.target.value)}
        >
          <option value="">{PART_NO_SELECTION_LABEL}</option>
          {(partsData ?? []).map((part, index) => (
            <option key={part.id ?? `pt${index + 1}`} value={part.id ?? ''}>
              {/* name 누락 row 도 throw 없이 안전 렌더한다(PartList 의 placeholder 정합). */}
              {part.name ?? '(이름 없음)'}
            </option>
          ))}
        </select>
        <PersonList
          persons={partPersons}
          loading={partPersonLoading}
          error={partPersonError}
          emptyMessage={
            selectedPartId ? EMPTY_PART_PERSON_TEXT : NO_PART_SELECTED_TEXT
          }
        />
      </section>
    </section>
  );
}

export {
  findGroup,
  deriveMembers,
  buildGroupMembersPath,
  deriveMembersFromMemberships,
  deriveProviders,
  deriveProviderConfigs,
  deriveDifficultyMapping,
  buildMappingsPath,
  buildProvidersPath,
  buildPersonsPath,
  buildGroupsPath,
  buildPartsPath,
  buildUsersPath,
  buildPartPersonsPath,
  buildExportPath,
  mergeMapping,
  parseFilename,
  triggerDownload,
  runAssign,
  runExport,
  runImport,
  formatImportJobDetail,
  runApply,
  runTrigger,
  deriveScheduleMessage,
  buildRecentDeletionPath,
  runReEvaluate,
  runRemove,
  runDeleteProvider,
  runAdd,
  runCreateProvider,
  runCreatePerson,
  runCreateGroup,
  runCreatePart,
  runCreateUser,
  runChangeRole,
  createInFlightIdGate,
  runDeletePerson,
  runDeleteGroup,
  runDeletePart,
  resolveSelectedPartIdAfterDelete,
  buildDeletePartBumpRefresh,
  buildPersonPatch,
  runUpdatePerson,
  runUpdateGroup,
  runUpdatePart,
  runUpdateProvider,
  resolveProviderSelectValue,
  LLM_PROVIDER_OPTIONS,
  isAdminRole,
};
export type {
  AdminViewProps,
  GroupRow,
  GroupMemberRow,
  MembershipRow,
  LlmProviderRow,
  DifficultyMappingRow,
  MeRow,
  AssignDeps,
  DownloadDeps,
  ExportDeps,
  ImportDeps,
  ScheduleMutationDeps,
  ReEvaluationDeps,
  RemoveDeps,
  DeleteProviderDeps,
  AddDeps,
  CreateProviderFields,
  CreateProviderDeps,
  CreatePersonFields,
  CreatePersonDeps,
  CreateGroupDeps,
  CreatePartDeps,
  CreateUserDeps,
  ChangeRoleDeps,
  InFlightIdGate,
  DeletePersonDeps,
  DeleteGroupDeps,
  DeletePartDeps,
  PersonPatchInput,
  PersonPatch,
  UpdatePersonDeps,
  UpdateGroupDeps,
  UpdatePartDeps,
  UpdateProviderFields,
  UpdateProviderDeps,
};
export default AdminView;
