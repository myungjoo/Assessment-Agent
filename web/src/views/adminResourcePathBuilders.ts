// AdminView 의 자원 목록 조회 path 빌더 축(T-1879 순수 추출 — PLAN 183 행 god component 부채의
// 열다섯째 실분할). 여덟 빌더는 AdminView 에서 본문 한 줄도 바뀌지 않은 채 통째로 옮겨졌고
// (선언 앞에 export 만 붙였다), AdminView 는 본 모듈에서 단방향 import 로 되돌려 쓴다(본 모듈은
// AdminView 를 import 하지 않는다 — 역방향 import 0). base 상수는 재선언하지 않고 각 정본
// 모듈에서 직접 가져온다(정본 1 개 유지 — drift 차단). 이미 추출된 동형 빌더
// buildGroupMembersPath 는 adminMembershipDerivations 에 그대로 두고 여기로 옮기지 않는다.
// AdminView 파일 끝 export 배럴이 여덟 이름을 그대로 re-export 하므로 기존 spec 이 AdminView 배럴에서
// 가져다 쓰던 import 는 무수정으로 산다(공개 표면 무변경).
import { serviceIdentityCollectionPath } from '../api/serviceIdentity';
import { USERS_PATH } from './adminUserMutationRunners';
import { GROUPS_PATH, PARTS_PATH } from './adminGroupPartMutationRunners';
import { PERSONS_PATH } from './adminPersonMutationRunners';
import {
  LLM_PROVIDERS_PATH,
  LLM_MAPPINGS_PATH,
} from './adminLlmProviderMutationRunners';

// 난이도 슬롯 매핑 조회 path 빌더(순수 helper) — ④c PATCH 성공 시 GET 재조회를 유발하기 위해
// 컨테이너의 refreshNonce 를 cache-busting query(`_r`)로 실어 path 문자열을 변화시킨다.
// useApiResource 는 path 변경 시에만 재조회하므로(수정 0 — read-only hook), nonce 증가가 곧
// 재조회 트리거다. nonce 0(초기 조회)이면 query 없는 깨끗한 path 를 그대로 쓴다(불필요 query
// 회피). `_r` 은 backend GET 핸들러가 @Query 를 받지 않아 무시한다(api.md 119 — 부수효과 0).
export function buildMappingsPath(refreshNonce: number): string {
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
export function buildProvidersPath(refreshNonce: number): string {
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
// backend GET 핸들러가 읽지 않는 미지의 query 라 그대로 무시된다(T-1803 이 개통한 @Query 는
// includeInactive 하나뿐 — api.md, 부수효과 0).
export function buildPersonsPath(
  refreshNonce: number,
  includeInactive = false,
): string {
  // T-1804 — 휴직 인원 포함 토글. backend 는 `includeInactive === "true"` 일 때만 findAll() 로
  // 분기하므로(T-1803, person.controller.ts @Get()), true 일 때만 `includeInactive=true` 를 싣고
  // false 는 아예 query 를 만들지 않는다(무의미한 `includeInactive=false` 금지 — bare base 발사가
  // findActive 계약과 글자-동일하게 유지된다). 두 query 가 동시에 실릴 때의 구분자(`?` / `&`)는
  // 아래 join 이 조립한다(첫 항목만 `?`, 나머지는 `&`). 두 번째 인자를 생략한 기존 호출부는
  // default false 라 종전 path 를 그대로 낸다(회귀 0).
  const params: string[] = [];
  if (refreshNonce > 0) {
    params.push(`_r=${refreshNonce}`);
  }
  if (includeInactive) {
    params.push('includeInactive=true');
  }
  if (params.length === 0) {
    return PERSONS_PATH;
  }
  return `${PERSONS_PATH}?${params.join('&')}`;
}

// 그룹 목록 조회 path 빌더(순수 helper, T-1146 — buildPersonsPath 동형) — 그룹 생성 POST
// (/api/groups) 성공 시 GET /api/groups 재조회를 유발하기 위해 컨테이너의 groupsRefreshNonce 를
// cache-busting query(`_r`)로 실어 path 문자열을 변화시킨다. useApiResource 는 path 변경 시에만
// 재조회하므로(read-only hook 수정 0), nonce 증가가 곧 재조회 트리거다. nonce 0(초기 조회)이면
// query 없는 깨끗한 base path(GROUPS_PATH — T-1129 이전 마운트 path 와 동일 유지, 회귀 0)를 그대로
// 쓴다. `_r` 은 backend GET 핸들러가 @Query 를 받지 않아 무시한다(api.md — 부수효과 0).
export function buildGroupsPath(refreshNonce: number): string {
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
export function buildPartsPath(refreshNonce: number): string {
  if (refreshNonce <= 0) {
    return PARTS_PATH;
  }
  return `${PARTS_PATH}?_r=${refreshNonce}`;
}

// 사용자 목록 조회 path 빌더(T-1160 — buildPartsPath 동형. nonce 를 `_r` 로 실어 재조회를 내되,
// backend 는 @Query 미수신이라 부수효과 0. nonce 0 이면 T-1159 초기 조회와 같은 base path).
export function buildUsersPath(refreshNonce: number): string {
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
export function buildPartPersonsPath(
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

// 선택 인원의 service identity 목록 조회 path 빌더(순수 helper, T-1766 — buildPartPersonsPath
// 동형) — GET /api/persons/:personId/identities(ADR-0058 §Decision 1). 미선택(falsy·빈 문자열·
// 공백뿐)이면 null 을 반환해 조건부 조회 idle 을 유발한다 — `/api/persons//identities` 같은 깨진
// path 발사 차단. base 는 client 의 serviceIdentityCollectionPath 로 얻는다(경로 재조립 시 계약
// drift — encodeURIComponent 안전 인코딩도 그 함수 책임). nonce 0 이하(초기·음수)면 base 를,
// 1+ 면 `?_r=<nonce>` 를 붙여 재조회를 낸다(쓰기 축 slice 자리 — backend 는 @Query 미수신, 무시).
export function buildServiceIdentitiesPath(
  selectedPersonId: string | undefined,
  refreshNonce = 0,
): string | null {
  if (!selectedPersonId || selectedPersonId.trim() === '') {
    return null;
  }
  const base = serviceIdentityCollectionPath(selectedPersonId);
  if (refreshNonce <= 0) {
    return base;
  }
  return `${base}?_r=${refreshNonce}`;
}
