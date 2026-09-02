// AdminView 의 그룹·파트 mutation 러너 군(T-1146 ~ T-1157)을 담는 모듈 — T-1854 순수 추출.
// AdminView.tsx 가 6,053 줄까지 다시 자란 god component 부채(PLAN 183 행)를 갚는 넷째 실분할이며,
// 본 모듈의 14 심볼(deps 타입 6 · async 러너 6 · 순수 helper 2)은 AdminView 에서 **본문 한 줄도
// 바꾸지 않고** 옮겨온 것이다(동작 · 계약 · spec 무변경 — 선언 앞 export 키워드만 붙였다). 각
// 선언 위의 주석 블록은 그 러너가 막는 결함의 가드 근거 정본이라 함께 옮겼다. 배치를
// web/src/views/ 아래로 잡은 이유는 이동 블록이 발사 primitive 를 전부 deps 로 주입받아
// 외부 값 import 가 사실상 없기 때문이다(타입 RequestOptions 1 줄만 추가). JSX 가 없으므로 확장자는 .ts 다.
//
// AdminView 와의 방향: AdminView → 본 모듈(값 의존) 의 **단방향** import 만 만든다. 본 모듈은
// AdminView 를 import 하지 않는다(역방향이 필요해지면 이동 범위를 잘못 잡았다는 신호 — 범위를
// 넓히지 말고 Follow-ups 로 남긴다). AdminView 파일 끝 export 목록은 임포트한 러너 6 개와 helper
// 2 개를 그대로 re-export 하고, deps 타입 6 개도 이동 전부터 AdminView 의 `export type {` 표면이었으므로
// 그대로 re-export 한다(공개 표면 무변경). 덕분에 기존 계약 spec 7 개(group-create / group-delete /
// group-update / part-create / part-delete / part-update / AdminView.test.tsx)의 `from './AdminView'` 가
// import 경로 수정 없이 그대로 산다.
//
// 이동 범위 보정 — 러너들이 직접 참조하는 모듈 상수 3 개(GROUPS_PATH · PARTS_PATH ·
// PART_DUPLICATE_ERROR)도 본문 무변경으로 함께 옮겼다. AdminView 에 남겨두면 본 모듈 → AdminView
// 역방향 import 가 생겨 위 단방향 규약을 깨뜨리기 때문이다(COLLECTION_TARGETS_PATH 를
// adminCollectionTargetRunners.ts 로 옮긴 T-1830 선례 동형). 그중 두 path 상수는 AdminView 의
// buildGroupsPath / buildPartsPath 가 여전히 쓰므로 AdminView 가 본 모듈에서 import 해 쓴다.

import type { RequestOptions } from '../api/apiClient';

// 그룹 목록 조회 path — 고정 endpoint(GET /api/groups, api.md 81 User+). personId 같은
// 필수 query 가 없어 무조건 조회한다(미인증은 AuthGate 가 이미 차단). DashboardView 의
// path 파생 helper 규약과 정합하게 상수로 둔다(조건부 가드 불요 — null 분기 없음).
export const GROUPS_PATH = '/api/groups';

// 파트 조회 path — 고정 endpoint(GET /api/parts, part.controller @Get() 파트 배열 반환). 그룹과
// 달리 AdminView 는 파트를 전혀 조회하지 않아 재사용할 fetch 가 없으므로 신규 상수로 둔다. 파트
// 생성 slice 가 아직 없어 refresh nonce 빌더 없이 단순 상수 path 로 조회한다(SCHEDULES_PATH 동형 —
// nonce-aware buildPartsPath 전환은 후속 create slice 책임). personId 같은 필수 query 없음.
export const PARTS_PATH = '/api/parts';

// 파트 생성 409(중복 이름) 전용 사람-친화 문구(T-1153) — Part.name 은 prisma schema 에서 @unique
// 라 중복 이름 POST 시 PartService.create 가 Prisma P2002 → ConflictException(409) 으로 변환한다.
// 그룹(Group.name @unique 미정의라 409 없음)과 달리 파트는 이 409 를 일반 error 문구("HTTP 409:
// …")가 아니라 원인이 분명한 전용 문구로 표면화해, 사용자가 중복 이름임을 즉시 알고 다른 이름으로
// 재시도하게 한다. §12 한국어. runCreatePart 의 catch 분기가 409 판정 시 이 상수를 error state 로 쓴다.
export const PART_DUPLICATE_ERROR = '이미 존재하는 파트 이름입니다';

// 그룹 생성 POST + state-전이 로직에 주입하는 deps(T-1146 — runCreatePerson 의 CreatePersonDeps 를
// mirror. jsdom/렌더러 없이 mutation 본체를 직접 검증한다). 컨테이너의 handleCreateGroup 은 이 러너에
// 현재 입력 name·in-flight 여부(creating)·상태 setter·재조회 트리거·입력 초기화를 주입해 호출만 한다.
// 그룹 생성 payload 는 name 단일 필드(CreateGroupDto — src/user/dto/create-group.dto.ts)라 인원 생성의
// 2 필드 대신 name 하나만 다룬다. Group.name 은 @unique 미정의라 409 특수 분기 없이 일반 error 표면화.
export interface CreateGroupDeps {
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
export async function runCreateGroup(
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
export interface CreatePartDeps {
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
export async function runCreatePart(
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

// 그룹 삭제 DELETE + state-전이 로직에 주입하는 deps(T-1149 — runDeletePerson 의 DeletePersonDeps 를
// 1:1 mirror. jsdom/렌더러 없이 mutation 본체를 직접 검증한다). path param 이 group id 하나뿐이라
// (DELETE /api/groups/:id 는 단일 세그먼트) 별도 필드는 없다. 컨테이너의 handleDeleteGroup 은 이 러너에
// 현재 in-flight 여부(deleting)·상태 setter·재조회 트리거를 주입해 호출만 한다.
export interface DeleteGroupDeps {
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
export async function runDeleteGroup(
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
export interface DeletePartDeps {
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
export async function runDeletePart(
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
export function resolveSelectedPartIdAfterDelete(
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
export function buildDeletePartBumpRefresh(
  setRefreshNonce: (updater: (prev: number) => number) => void,
  setSelected: (updater: (prev: string) => string) => void,
  deletedId: string,
): () => void {
  return () => {
    setRefreshNonce((n) => n + 1);
    setSelected((cur) => resolveSelectedPartIdAfterDelete(cur, deletedId));
  };
}

// 그룹 수정 PATCH + state-전이 로직에 주입하는 deps(T-1150 — runUpdatePerson 의 UpdatePersonDeps 를
// mirror. jsdom/렌더러 없이 mutation 본체를 직접 검증한다). 컨테이너의 handleUpdateGroup 은 이 러너에
// 편집 대상 id·현재 입력 name·편집 시작 원본 name·현재 in-flight 여부(updating)·상태 setter·재조회
// 트리거·편집 종료를 주입해 호출만 한다. 그룹은 편집 필드가 name 하나뿐이라(UpdateGroupDto 의 name
// 단일 partial update — src/user/dto/update-group.dto.ts) buildPersonPatch 같은 다필드 diff 헬퍼가
// 불요하고, 러너 안에서 trim·미변경 비교로 발사 여부를 직접 판정한다.
export interface UpdateGroupDeps {
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
export async function runUpdateGroup(
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
export interface UpdatePartDeps {
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
export async function runUpdatePart(
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
