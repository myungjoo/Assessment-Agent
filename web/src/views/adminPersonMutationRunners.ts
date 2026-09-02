// AdminView 의 인원(Person) mutation 러너 군(T-1143 ~ T-1145 · T-1780 · T-1781)을 담는 모듈 —
// T-1856 순수 추출. AdminView.tsx 가 5,569 줄로 남아있는 god component 부채(PLAN 183 행)를 갚는
// 다섯째 실분할이며, 본 모듈의 11 심볼(입력 타입 2 · deps 타입 3 · 순수 helper 2 · async 러너 3)은
// AdminView 에서 **본문 한 줄도 바꾸지 않고** 옮겨온 것이다(동작 · 계약 · spec 무변경 — 선언 앞
// export 키워드만 붙였다). 각 선언 위의 주석 블록은 그 러너가 막는 결함의 가드 근거 정본이라 함께
// 옮겼다. 배치를 web/src/views/ 아래로 잡은 이유는 이동 블록이 발사 primitive 를 전부 deps 로
// 주입받아 외부 값 import 가 사실상 없기 때문이다(타입 RequestOptions 1 줄 + 행 id 정규화 정본
// normalizeRowId 1 줄만 추가). JSX 가 없으므로 확장자는 .ts 다.
//
// AdminView 와의 방향: AdminView → 본 모듈(값 의존) 의 **단방향** import 만 만든다. 본 모듈은
// AdminView 를 import 하지 않는다(역방향이 필요해지면 이동 범위를 잘못 잡았다는 신호 — 범위를
// 넓히지 말고 Follow-ups 로 남긴다). normalizeRowId 는 AdminView 가 아니라 그 정본 모듈
// adminServiceIdentityRowActions 에서 직접 가져오므로 이 규약을 깨지 않는다(같은 규칙 두 벌 금지).
// AdminView 파일 끝 export 목록은 임포트한 러너 3 개와 helper 2 개를 그대로 re-export 하고, 입력·
// deps 타입 6 개도 이동 전부터 AdminView 의 `export type {` 표면이었으므로 그대로 re-export 한다
// (공개 표면 무변경). 덕분에 기존 spec 6 개(person-create-contract / person-delete-contract /
// person-update-contract / person-create-identity-autoselect / person-update-identity-autoselect /
// AdminView.test.tsx)의 `from './AdminView'` 가 import 경로 수정 없이 그대로 산다. 두 identity-
// autoselect spec 의 readFileSync drift-guard 가 잠그는 것은 컨테이너의 deps 조립부(handleCreatePerson
// / handleUpdatePerson)라 AdminView 원문에 그대로 남는다.
//
// 이동 범위 보정 — 러너 3 개가 직접 참조하는 모듈 상수 PERSONS_PATH 도 본문 무변경으로 함께 옮겼다.
// AdminView 에 남겨두면 본 모듈 → AdminView 역방향 import 가 생겨 위 단방향 규약을 깨뜨리기 때문이다
// (GROUPS_PATH · PARTS_PATH 를 adminGroupPartMutationRunners.ts 로 옮긴 T-1854 선례 동형). 이 상수는
// AdminView 의 buildPersonsPath 가 여전히 쓰므로 AdminView 가 본 모듈에서 import 해 쓴다(정본 1 개 유지).

import type { RequestOptions } from '../api/apiClient';
// 행 id 정규화 정본(T-1824 추출) — extractCreatedPersonId 가 trim 규칙을 재구현하지 않고 재사용한다.
import { normalizeRowId } from './adminServiceIdentityRowActions';

// 인원(Person) 목록 조회 base path — 고정 endpoint(GET /api/persons, active 인원 Person[] 반환,
// PersonController T-0036). personId 같은 필수 query 가 없어 무조건 조회한다(미인증은 AuthGate
// 가 이미 차단). T-1143 부터 인원 생성 POST 성공 시 권위 재조회를 유발해야 하므로, 고정 상수
// 대신 buildPersonsPath(refreshNonce) nonce-aware 빌더의 base 로 쓴다(buildProvidersPath 동형).
export const PERSONS_PATH = '/api/persons';

// 인원 생성 POST 2 필드 묶음(T-1143) — 컨테이너의 2 controlled input(fullName/email) 값을 러너에
// 한 덩어리로 넘긴다. 러너가 각 필드를 trim 해 빈/공백 가드에 쓰고, 유효 시 body 로 JSON 직렬화한다.
// active 는 Prisma default(true)라 body 에서 제외한다(CreatePersonDto 2 필드만 — src/user/dto).
export interface CreatePersonFields {
  fullName: string;
  email: string;
}

// 인원 생성 POST + state-전이 로직에 주입하는 deps(T-1143 — runCreateProvider 의 CreateProviderDeps
// 를 mirror. jsdom/렌더러 없이 mutation 본체를 직접 검증한다). 컨테이너의 handleCreatePerson 은 이
// 러너에 2 입력값(CreatePersonFields)·현재 in-flight 여부(creating)·상태 setter·재조회 트리거·입력
// 초기화를 주입해 호출만 한다. path param 이 없어(POST /api/persons) id 는 없다.
export interface CreatePersonDeps {
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
  // 생성 성공 + 응답에서 id 추출 성공 시에만 호출되는 optional 후속 훅(T-1780) — 컨테이너가
  // 방금 만든 인원을 service identity 대상으로 자동 선택하는 데 쓴다(REQ-079). optional 이라
  // 미전달 호출처(기존 spec 포함)는 수정 0 으로 그대로 컴파일·통과한다.
  onCreated?: (personId: string) => void;
}

// 인원 생성 201 응답에서 생성된 인원 id 를 방어적으로 꺼내는 순수 helper(T-1780). 응답 형태를
// 신뢰하지 않는다 — 비객체(undefined/null/문자열/숫자/배열) · `id` 부재 · `id` 비-string · 공백뿐인
// id 는 모두 undefined 로 접는다. trim 규칙은 재구현하지 않고 행 id 정규화 정본 normalizeRowId 를
// 재사용한다(같은 규칙 두 벌 금지). 반환이 undefined 면 호출처는 후속 자동 선택을 하지 않는다.
export function extractCreatedPersonId(response: unknown): string | undefined {
  if (
    typeof response !== 'object' ||
    response === null ||
    Array.isArray(response)
  ) {
    return undefined;
  }
  const rawId = (response as { id?: unknown }).id;
  if (typeof rawId !== 'string') {
    return undefined;
  }
  // 공백뿐인 id 는 빈 값으로 접혀 undefined 가 된다(빈 선택으로 조회가 idle 로 떨어지는 사고 차단).
  return normalizeRowId(rawId) || undefined;
}

// 인원 생성 POST /api/persons(body `{ fullName, email }`) + state-전이 로직을 캡슐화한 순수 async
// 러너(T-1143 — runCreateProvider mirror). backend create(person.controller, 201 Created,
// CreatePersonDto 2 필드, email 중복 → 409 Conflict, 검증 실패 → 400)를 발사한다. 컨테이너의
// handleCreatePerson 은 이 러너에 deps 를 주입해 호출만 한다. 동작:
//  - 2 필드 중 하나라도 빈/공백만 → 미발사(잘못된 body·400 회피 — 각 필드 trim 후 falsy 면 억제).
//  - creating(이전 mutation 미완) → 미발사(이중 POST·state 경합 차단 — runCreateProvider 가드 동형).
//  - 발사 시 진행 on + 직전 error 비움 → POST(trim 된 2 필드 JSON body) → 성공(인원 재조회
//    트리거 + 입력 초기화) / 실패(사람-친화 문구 표면화 — throw 없이) → 진행 off(공통).
export async function runCreatePerson(
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
    const created = await deps.create(PERSONS_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email }),
    });
    // 성공 — 권위 인원 재조회 트리거(재조회로 생성된 행이 목록에 나타난다 — 낙관 추가 없음) +
    // 입력 초기화(연속 생성 시 직전 값 잔존 방지).
    deps.bumpRefresh();
    deps.resetInput();
    // 후속 훅(T-1780) — 201 응답에서 id 를 꺼내는 데 성공한 경우에만 호출한다. 추출 실패(비객체·
    // id 부재/비-string/공백)면 호출 0 이고 위 성공 전이는 그대로다(응답 형태 변화가 생성 자체를
    // 깨지 않도록 — 자동 선택은 부가 편의일 뿐).
    const createdId = extractCreatedPersonId(created);
    if (createdId) {
      deps.onCreated?.(createdId);
    }
  } catch (e) {
    // 실패 — 사람-친화 문구를 error state 로 안전 표시(throw 없이). 400 검증 실패(빈/잘못된 email)
    // / 409 email 중복 / 비-2xx / 네트워크 0 모두 ApiError.status → toErrorMessage 파생으로
    // 표면화. 재조회 nonce·입력은 건드리지 않는다(실패 시 입력 유지 — 재시도 편의).
    deps.setCreateError(deps.describeError(e));
  } finally {
    deps.setCreating(false);
  }
}

// 인원 삭제 DELETE + state-전이 로직에 주입하는 deps(T-1144 — runDeleteProvider 의 DeleteProviderDeps
// 를 1:1 mirror. jsdom/렌더러 없이 mutation 본체를 직접 검증한다). path param 이 person id 하나뿐이라
// (DELETE /api/persons/:id 는 단일 세그먼트) groupId 는 없다. 컨테이너의 handleDeletePerson 은 이 러너에
// 현재 in-flight 여부(deleting)·상태 setter·재조회 트리거를 주입해 호출만 한다.
export interface DeletePersonDeps {
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
export async function runDeletePerson(
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

// 인원 수정 3 필드 묶음(T-1145) — 컨테이너의 인라인 수정 폼 3 controlled input(fullName/email/active)
// 값이자 편집 시작 시점의 원본 스냅샷 타입. buildPersonPatch 가 input 과 original 을 비교해 "변경된
// 필드만" 담긴 부분 갱신 body(PersonPatch)를 만든다. active 는 boolean(soft deactivate/reactivate,
// UpdatePersonDto), fullName/email 은 string(trim 후 비교).
export interface PersonPatchInput {
  fullName: string;
  email: string;
  active: boolean;
}

// 인원 부분 갱신 body(T-1145) — UpdatePersonDto(fullName?/email?/active? 전부 optional, 부재=미변경)
// 정합. buildPersonPatch 가 "변경된 필드만" 채운다(부재 필드는 backend 가 미변경 semantics).
export interface PersonPatch {
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
export function buildPersonPatch(
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
export interface UpdatePersonDeps {
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
  // 수정 성공 후 후속 훅(T-1781, optional) — 방금 수정한 인원 id(trim 된 값)를 1 회 넘긴다.
  // 컨테이너는 이 값을 identity 조회 대상 state 로 흘려 자동 선택에 쓴다(REQ-079). optional 이라
  // 기존 호출처·기존 spec 은 무수정으로 통과한다(하위 호환). 생성 축의 onCreated 와 달리 대상
  // id 가 이미 입력이라 응답 파싱이 불요하다 — 성공 사실만으로 그 id 를 그대로 넘긴다.
  onUpdated?: (personId: string) => void;
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
export async function runUpdatePerson(
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
    // 성공 분기에서만 후속 훅 1 회(T-1781) — 방금 수정한 인원 id 를 trim 해 넘긴다(path 인코딩에
    // 쓴 원본이 아니라 가드가 통과시킨 정규화 값 — 조회 select 의 option value 와 같은 형태).
    // 실패(catch)·3 가드 no-op 경로에서는 호출되지 않는다. optional 이라 미전달 호출처는 no-op.
    deps.onUpdated?.(id.trim());
  } catch (e) {
    // 실패 — 사람-친화 문구를 error state 로 안전 표시(throw 없이). 400 검증 실패(빈/잘못된 email) /
    // 403 Admin+ 미만 / 404 미존재 / 409 email 중복 / 비-2xx / 네트워크 0 모두 ApiError.status →
    // toErrorMessage 파생으로 표면화. 재조회 nonce·편집 상태는 건드리지 않는다(실패 시 편집 유지).
    deps.setUpdateError(deps.describeError(e));
  } finally {
    deps.setUpdating(false);
  }
}
