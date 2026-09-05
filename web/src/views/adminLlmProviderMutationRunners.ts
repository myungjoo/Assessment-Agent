// AdminView 의 LLM provider mutation 러너 군(T-1135 ~ T-1137)을 담는 모듈 — T-1857 순수 추출.
// AdminView.tsx 가 5,282 줄로 남아있는 god component 부채(PLAN 183 행)를 갚는 여섯째 실분할이며,
// 본 모듈의 8 심볼(입력 타입 2 · deps 타입 3 · async 러너 3)은 AdminView 에서 **본문 한 줄도 바꾸지
// 않고** 옮겨온 것이다(동작 · 계약 · spec 무변경 — 선언 앞 export 키워드만 붙였다). 각 선언 위의
// 주석 블록은 그 러너가 막는 결함의 가드 근거 정본이라 함께 옮겼다. 배치를 web/src/views/ 아래로
// 잡은 이유는 이동 블록이 발사 primitive(create / update / remove)를 전부 deps 로 주입받아 외부 값
// import 가 사실상 없기 때문이다(타입 RequestOptions 1 줄만 추가). JSX 가 없으므로 확장자는 .ts 다.
//
// AdminView 와의 방향: AdminView → 본 모듈(값 의존) 의 **단방향** import 만 만든다. 본 모듈은
// AdminView 를 import 하지 않는다(역방향이 필요해지면 이동 범위를 잘못 잡았다는 신호 — 범위를
// 넓히지 말고 Follow-ups 로 남긴다). AdminView 파일 끝 export 목록은 임포트한 러너 3 개를 그대로
// re-export 하고, 입력 · deps 타입 5 개도 이동 전부터 AdminView 의 `export type {` 표면이었으므로
// 그대로 re-export 한다(공개 표면 무변경). 덕분에 기존 spec 4 개(llm-provider-create-contract /
// llm-provider-update-contract / llm-provider-delete-contract / AdminView.test.tsx)의
// `from './AdminView'` 가 import 경로 수정 없이 그대로 산다. llm-provider-list-contract 의
// readFileSync drift-guard 가 잠그는 것은 조회 call site(useApiResource)라 AdminView 원문에 남는다.
//
// 이동 범위 보정 — 러너 3 개가 직접 참조하는 모듈 상수 LLM_PROVIDERS_PATH 도 본문 무변경으로 함께
// 옮겼다. AdminView 에 남겨두면 본 모듈 → AdminView 역방향 import 가 생겨 위 단방향 규약을 깨뜨리기
// 때문이다(GROUPS_PATH 를 옮긴 T-1854 · PERSONS_PATH 를 옮긴 T-1856 선례 동형). 이 상수는 AdminView
// 의 buildProvidersPath 가 여전히 쓰므로 AdminView 가 본 모듈에서 import 해 쓴다(정본 1 개 유지).
//
// 합류분(T-1877 순수 추출 — PLAN 183 행 부채의 열넷째 실분할) — 난이도 매핑 **assign 축** 2 심볼
// (AssignDeps · runAssign)과 그 러너가 직접 참조하는 상수 LLM_MAPPINGS_PATH 를 AdminView 에서 본문
// 한 줄도 바꾸지 않고 옮겨왔다(선언 앞 export 키워드만 추가). provider mutation 축과 같은 파일에
// 두는 이유는 두 축이 같은 LLM 도메인의 mutation 러너이고 주입 계약(발사 primitive · describeError ·
// in-flight 가드 · bumpRefresh)이 동형이라 한 모듈의 응집이 유지되기 때문이다. LLM_MAPPINGS_PATH 도
// LLM_PROVIDERS_PATH 와 같은 이유로 함께 옮겼고(재선언 = 정본 2 개라 금지), AdminView 의 잔류
// buildMappingsPath 가 본 모듈에서 import 해 쓴다. 유일한 호출부 handleAssign 은 AdminView 에 남아
// 본 모듈의 runAssign 을 그대로 호출하며, 파일 끝 배럴이 runAssign · AssignDeps 를 계속 re-export 해
// 기존 spec 2 개(AdminView.difficulty-mapping-assign-contract / AdminView.test.tsx)가 무수정으로 산다.

import type { RequestOptions } from '../api/apiClient';
import type { Difficulty } from '../components/DifficultyModelSelector';

// LLM provider 목록 조회 path — 고정 endpoint(GET /api/llm/providers, api.md 114 Admin+,
// sanitize view 6 필드 id/provider/endpointUrl/modelId/createdAt/updatedAt). Admin+ 라
// User 등급은 403 — 그 403 은 LLM_ERROR_FALLBACK 경로로 error props 안전 표시(throw 없음).
export const LLM_PROVIDERS_PATH = '/api/llm/providers';

// 난이도 슬롯 매핑 조회 path — 고정 endpoint(GET /api/llm/difficulty-mappings, api.md 119
// Admin+, 3 난이도 슬롯 배열, 빈 배열 seed 전 정상). Admin+ 라 User 등급은 403.
export const LLM_MAPPINGS_PATH = '/api/llm/difficulty-mappings';

// provider 삭제 DELETE + state-전이 로직에 주입하는 deps(T-1135 — runRemove 의 RemoveDeps 를
// 1:1 mirror. jsdom/렌더러 없이 mutation 본체를 직접 검증한다). RemoveDeps 와 달리 path param 이
// provider id 하나뿐이라 groupId 는 없다(DELETE /api/llm/providers/:id 는 단일 세그먼트). 컨테이너의
// handleDeleteProvider 는 이 러너에 현재 in-flight 여부(deleting)·상태 setter·재조회 트리거를 주입해
// 호출만 한다.
export interface DeleteProviderDeps {
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
export async function runDeleteProvider(
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

// provider 생성 POST 4 필드 묶음(T-1136) — 컨테이너의 4 controlled input 값을 러너에 한 덩어리로
// 넘긴다. 러너가 각 필드를 trim 해 빈/공백 가드에 쓰고, 유효 시 body 로 JSON 직렬화한다. secret
// apiKey 는 생성 body 전송만 담당하며 응답·목록·error 어디에도 재노출되지 않는다.
export interface CreateProviderFields {
  provider: string;
  endpointUrl: string;
  apiKey: string;
  modelId: string;
}

// provider 생성 POST + state-전이 로직에 주입하는 deps(T-1136 — runAdd 의 AddDeps 를 mirror.
// jsdom/렌더러 없이 mutation 본체를 직접 검증한다). 컨테이너의 handleCreateProvider 는 이 러너에
// 4 입력값(CreateProviderFields)·현재 in-flight 여부(creating)·상태 setter·재조회 트리거·입력
// 초기화를 주입해 호출만 한다. path param 이 없어(POST /api/llm/providers) groupId 는 없다.
export interface CreateProviderDeps {
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
export async function runCreateProvider(
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

// provider 수정 PATCH 4 필드 묶음(T-1137) — 컨테이너의 인라인 수정 폼 4 controlled input 값을
// 러너에 한 덩어리로 넘긴다. 러너가 각 필드를 trim 해 "명시된 필드만"(빈/공백 제외) body 로
// JSON 직렬화한다(부분 갱신 semantics — 부재 필드는 backend 가 미변경). secret apiKey 는
// read never-back 이라 빈 값으로 시작하고, 사용자가 입력했을 때만 body 에 포함해 기존 ciphertext
// 를 교체한다(빈 apiKey 는 body 에서 제외 → 기존 값 유지). apiKey 는 응답·목록·error 어디에도
// 재노출되지 않는다.
export interface UpdateProviderFields {
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
export interface UpdateProviderDeps {
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
export async function runUpdateProvider(
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

// 전역 기본 provider 재지정 PUT + state-전이 로직에 주입하는 deps(T-1898 — DeleteProviderDeps
// (50 행) 를 1:1 mirror. jsdom/렌더러 없이 mutation 본체를 직접 검증한다). runUpdateProvider 와
// 달리 대상 id 가 path param 이 아니라 **body 필드** 로 가므로(PUT /api/llm/providers/default 는
// 정적 path) deps 에 id 를 두지 않고 러너 인자로 받는다 — DeleteProviderDeps 와 같은 모양이다.
// 컨테이너의 handleSetDefaultProvider(쓰기 축 B)는 이 러너에 현재 in-flight 여부(settingDefault)·
// 상태 setter·재조회 트리거를 주입해 호출만 한다.
export interface SetDefaultProviderDeps {
  // PUT 발사 primitive — apiClient.request 를 주입한다(테스트는 mock 주입). PATCH 축과 같은
  // request 함수라 이름도 update 로 맞춘다(UpdateProviderDeps.update 동형 — method 만 다르다).
  update: (path: string, options: RequestOptions) => Promise<unknown>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입).
  describeError: (e: unknown) => string;
  // 현재 기본 재지정 in-flight 여부 — true 면 미발사(이중 PUT·경합 가드).
  settingDefault: boolean;
  setSettingDefault: (next: boolean) => void;
  setDefaultError: (next: string | undefined) => void;
  // 권위 provider 재조회 트리거 — providersRefreshNonce 를 +1 한다(path 변경 유발).
  bumpRefresh: () => void;
}

// 전역 기본 provider 재지정 PUT /api/llm/providers/default + state-전이 로직을 캡슐화한 순수 async
// 러너(T-1898 — runDeleteProvider 캡슐화 패턴 1:1 mirror). backend PUT(llm.controller, T-1865,
// api.md 134 행 — body SetDefaultLlmProviderDto { llmProviderConfigId }, 200 + 방금 기본이 된
// config 의 sanitize view(isDefault: true), 단일 슬롯 upsert 1 회라 기본이 0 개인 window 가 없고
// 이미 기본인 config 재지정도 성공(멱등), 부재 id 는 P2003/P2025 를 service 가 404 로 수렴,
// DTO 위반 400 / 미인증 401 / 비-Admin 403)를 발사한다.
//
// 인자 순서 판정 — T-1866 AC 본문은 runSetDefaultProvider(deps, id) 로 적었으나, 같은 모듈의
// runDeleteProvider(id, deps) convention 에 맞춰 (id, deps) 로 뒤집는다(모듈 안에서 대상 식별자를
// 앞에 두는 규약이 이미 정본이고, 호출부가 러너마다 순서를 기억해야 하는 부담을 없앤다).
//
// 동작:
//  - 빈/공백/falsy id → 미발사(무의미한 400 왕복 회피 — trim 후 빈 문자열도 차단).
//  - settingDefault(이전 발사 미완) → 미발사(이중 PUT·state 경합 차단 — deleting 가드 동형).
//  - 발사 시 진행 on + 직전 error 비움 → PUT(id 는 path 가 아니라 JSON body 로 — 정적 path 라
//    encodeURIComponent 대상이 없다) → 성공(권위 재조회 트리거) / 실패(사람-친화 문구 표면화 —
//    throw 없이) → 진행 off(공통).
export async function runSetDefaultProvider(
  id: string,
  deps: SetDefaultProviderDeps,
): Promise<void> {
  // 비정상 호출 가드 — 빈/공백/falsy id 는 PUT 미발사(불필요 요청·확정 400 회피). 공백만 든 id 도
  // trim 후 빈 문자열이면 차단한다(경계값 — @IsNotEmpty 로 어차피 400 이 될 body).
  if (!id || id.trim() === '') {
    return;
  }
  // 동시 재호출 가드 — 이전 재지정 미완 중이면 미발사(이중 PUT·state 경합 차단).
  if (deps.settingDefault) {
    return;
  }
  deps.setSettingDefault(true);
  // 재발화 시작 시 직전 error 를 비운다(실패 후 재시도 시 직전 error 정리 — 새 재지정 진행만 남도록).
  deps.setDefaultError(undefined);
  try {
    // PUT /api/llm/providers/default — 대상 id 는 body 의 llmProviderConfigId 단일 키로 간다
    // (set-default-llm-provider.dto.ts 정본. forbidNonWhitelisted 라 extra 키를 더하면 400 이므로
    // 키를 1 개로 고정한다). path 가 정적 문자열이라 인코딩할 param 이 없다. 응답 sanitize view 는
    // 소비하지 않는다 — 목록 갱신은 아래 bumpRefresh 의 권위 재조회가 담당한다.
    await deps.update(`${LLM_PROVIDERS_PATH}/default`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ llmProviderConfigId: id }),
    });
    // 성공 — 권위 provider 재조회 트리거(재조회로 목록의 isDefault 배지가 새 행으로 옮겨간다 —
    // 낙관 반영·목록 직접 변형 없음).
    deps.bumpRefresh();
  } catch (e) {
    // 실패 — 사람-친화 문구를 error state 로 안전 표시(throw 없이). 404 부재 id / 403 Admin+ 미만 /
    // 401 미인증 / 400 DTO 위반 / 비-2xx / 네트워크 0 모두 ApiError.status → toErrorMessage 파생으로
    // 표면화. 재조회 nonce 는 bump 하지 않는다(실패 시 목록·배지 그대로 유지).
    deps.setDefaultError(deps.describeError(e));
  } finally {
    deps.setSettingDefault(false);
  }
}

// onAssign 의 PATCH + state-전이 로직을 캡슐화한 순수 async 러너(④c, 테스트 가능성 —
// jsdom/렌더러 없이 mutation 본체를 직접 검증한다. useApiResource 의 runFetch 가 effect
// 본체를 분리해 jsdom 없이 검증한 convention 정합). 컨테이너의 handleAssign 은 이 러너에
// 현재 in-flight 여부(assigning)와 상태 setter 들을 주입해 호출만 한다. 동작:
//  - 빈/falsy providerId → 미발사(잘못된 body 회피).
//  - assigning(이전 mutation 미완) → 미발사(이중 PATCH·state 경합 차단).
//  - 발사 시 낙관 반영 + 진행 on + error 비움 → PATCH → 성공(재조회 트리거 + override 비움) /
//    실패(override 롤백 + 문구 표면화) → 진행 off(공통).
export interface AssignDeps {
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

export async function runAssign(
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
