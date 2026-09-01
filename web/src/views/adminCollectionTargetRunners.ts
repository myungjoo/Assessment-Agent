// AdminView 의 수집 대상(CollectionTarget) 러너 군(T-1826 · T-1828 · T-1829)을 담는 모듈 —
// T-1830 순수 추출. AdminView.tsx 가 6,223 줄까지 다시 자란 god component 부채(PLAN 183 행)를
// 갚는 둘째 실분할이며, 본 모듈의 9 심볼(상수 2 · 러너 3 · 타입 4)은 AdminView 에서 **본문 한 줄도
// 바꾸지 않고** 옮겨온 것이다(동작 · 계약 · spec 무변경). 각 선언 위의 주석 블록은 그 러너가 막는
// 결함의 가드 근거 정본이라 함께 옮겼다. 배치를 web/src/views/ 아래로 잡은 이유는 이동 블록의 상대
// import 경로(`../api/...` · `../components/...`)가 그대로 유효해 본문 재작성이 0 이 되기 때문이다.
// JSX 가 없으므로 확장자는 .ts 다.
//
// AdminView 와의 방향: AdminView → 본 모듈(값 의존) 의 **단방향** import 만 만든다. 본 모듈은
// AdminView 를 import 하지 않는다(역방향이 필요해지면 이동 범위를 잘못 잡았다는 신호 — 범위를
// 넓히지 말고 Follow-ups 로 남긴다). AdminView 파일 끝 export 목록은 임포트한 러너 3 개를 그대로
// re-export 해, 기존 spec 3 개의 `from './AdminView'` 가 import 경로 수정 없이 그대로 산다.
// COLLECTION_TARGET_TYPES 정본은 CollectionTargetAddForm 이며 본 모듈이 거기서 직접 가져온다
// (AdminView 경유 재수출 금지 — 순환 회피).

import type { RequestOptions } from '../api/apiClient';
import { COLLECTION_TARGET_TYPES } from '../components/CollectionTargetAddForm';

// 수집 대상 조회 path(T-1825) — 고정 endpoint(GET /api/collection-targets, collection-target.
// controller `@Get()` 이 `@Roles("User")` 조회 tier 로 CollectionTarget 배열을 envelope 없이
// 직반환하고 row 0 개면 빈 배열이다 — ADR-0059 §Decision 5). AdminView 는 수집 대상을 전혀
// 조회하지 않아 재사용할 fetch 가 없으므로 신규 상수로 둔다. 등록·수정 slice 가 아직 없어
// refresh nonce 빌더 없이 단순 상수 path 로 조회한다(PARTS_PATH / USERS_PATH 동형 —
// nonce-aware 빌더 전환은 후속 편집 slice 책임). personId 같은 필수 query 없음.
export const COLLECTION_TARGETS_PATH = '/api/collection-targets';

// 허용 type 값의 string 배열 view(T-1826) — 정본은 CollectionTargetAddForm 의 상수(그 자체가
// backend DTO @IsIn 과 동기)다. readonly 튜플 그대로는 `includes(임의 string)` 가 타입 오류라
// 판정용으로만 넓힌 별칭을 둔다(값 복제 0 — 상수를 두 곳에 적으면 갈라진다).
export const COLLECTION_TARGET_TYPE_VALUES: readonly string[] = COLLECTION_TARGET_TYPES;

// 수집 대상 등록(POST) body 의 3 허용 축 묶음(T-1826) — backend CreateCollectionTargetDto 의
// 필수 3 필드와 1:1 이다. optional 4 축(`orgs`/`repos`/`spaces`/`active`)은 미전달로 DB
// default 에 위임하고, `id`/`createdAt`/`updatedAt`/token 계열은 애초에 이 타입에 없으므로
// forbidNonWhitelisted 400 이 나는 경로 자체가 없다(ADR-0059 §Decision 2 credential 경계).
type CollectionTargetInput = {
  type: string;
  instanceKey: string;
  endpoint: string;
};

// 등록 POST + state-전이 로직에 주입하는 deps(T-1826 — CreateServiceIdentityDeps 를 1:1
// mirror). 발사 primitive 가 apiClient.request 인 것은 본 slice 가 route 1 개뿐이라 per-resource
// client 모듈을 아직 두지 않기 때문이다(task Out of Scope — 5 route 가 다 붙는 시점에 추출 판단).
interface CreateCollectionTargetDeps {
  // POST 발사기 — (path, options) 시그니처는 apiClient.request 와 같다(테스트는 mock 주입).
  post: (path: string, options: RequestOptions) => Promise<unknown>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입).
  describeError: (e: unknown) => string;
  // 현재 create in-flight 여부 — true 면 미발사(이중 POST·경합 가드).
  creating: boolean;
  setCreating: (next: boolean) => void;
  setCreateError: (next: string | undefined) => void;
  // 목록 권위 재조회(useApiResource 의 reload) / 성공 후 입력 초기화.
  reloadTargets: () => void;
  resetInput: () => void;
}

// 등록 POST /api/collection-targets(body `{ type, instanceKey, endpoint }`) + state-전이를
// 캡슐화한 순수 async 러너(T-1826 — runCreateServiceIdentity mirror). 3 no-op 가드(허용 밖
// type / 입력 미완 / in-flight) 뒤, 진행 on + 직전 error 비움 → POST → 성공(입력 초기화 +
// 목록 재조회) / 실패(문구 표면화 — throw 없이) → 진행 off(공통).
export async function runCreateCollectionTarget(
  input: CollectionTargetInput,
  deps: CreateCollectionTargetDeps,
): Promise<void> {
  // 필수 2 필드 방어 — 하나라도 비면(공백뿐 포함) 미발사(400 확정 요청을 네트워크 전에 차단).
  const instanceKey = input?.instanceKey?.trim();
  const endpoint = input?.endpoint?.trim();
  if (!instanceKey || !endpoint) {
    return;
  }
  // type 방어 — @IsIn 허용 밖(빈 값·소문자·미지원 종류)이면 미발사. 폼 <select> 가 2 option
  // 뿐이지만 러너는 컨테이너 state 를 그대로 받으므로 값 자체를 여기서 한 번 더 잠근다.
  const type = input?.type;
  if (!COLLECTION_TARGET_TYPE_VALUES.includes(type)) {
    return;
  }
  // 동시 재호출 가드 — 이전 create 미완 중이면 미발사(이중 POST·state 경합 차단).
  if (deps.creating) {
    return;
  }
  deps.setCreating(true);
  // 재발화 시작 시 직전 error 를 비운다(실패 후 재시도 시 직전 error 정리).
  deps.setCreateError(undefined);
  try {
    // POST — 201 Created. 응답 body 는 소비하지 않고 재조회로 권위 목록을 받는다(낙관 추가
    // 없음). 그래서 응답이 배열·null 등 예상 밖 shape 여도 여기서 throw 하지 않는다.
    await deps.post(COLLECTION_TARGETS_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, instanceKey, endpoint }),
    });
    deps.resetInput();
    deps.reloadTargets();
  } catch (e) {
    // 실패 — 문구를 안전 표시(throw 없이). 400·403·409 중복·5xx·네트워크 0 모두 동일 경로.
    // 재조회·입력은 건드리지 않는다(입력 유지 — 사용자가 다시 타이핑하지 않아도 되게).
    deps.setCreateError(deps.describeError(e));
  } finally {
    deps.setCreating(false);
  }
}

// 수집 대상 삭제(DELETE) + state-전이 로직에 주입하는 deps(T-1828 — 위 CreateCollectionTargetDeps
// 를 1:1 mirror 하되 DELETE 계약에 맞춘다). in-flight 표현이 boolean 이 아니라 **진행 중 id** 인
// 것은 삭제가 행 단위 액션이라 어느 행이 진행 중인지가 화면 표시에 필요하기 때문이다
// (identityActionBusyId 선례). 발사 primitive 가 apiClient.request 인 것도 등록 축과 같은 이유다
// (route 1 개뿐 — per-resource client 모듈 추출은 task Out of Scope).
interface DeleteCollectionTargetDeps {
  // DELETE 발사기 — (path, options) 시그니처는 apiClient.request 와 같다(테스트는 mock 주입).
  remove: (path: string, options: RequestOptions) => Promise<unknown>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입).
  describeError: (e: unknown) => string;
  // 현재 삭제 진행 중인 행 id — truthy 면 미발사(이중 DELETE·경합 가드). 어느 행이든 하나가
  // 진행 중이면 전체를 잠근다(재조회가 목록 전체를 갈아끼우므로 행별 병렬 삭제는 무의미).
  deletingId: string | undefined;
  setDeletingId: (next: string | undefined) => void;
  setDeleteError: (next: string | undefined) => void;
  // 목록 권위 재조회(useApiResource 의 reload) — 삭제 성공 후 호출한다.
  reloadTargets: () => void;
}

// 수집 대상 삭제 DELETE /api/collection-targets/:id + state-전이를 캡슐화한 순수 async 러너
// (T-1828 — runCreateCollectionTarget / runDeletePerson 을 1:1 mirror). backend 는
// collection-target.controller `@Delete(":id")` + `@HttpCode(204)` + `@Roles("Admin")` 이다.
// 동작:
//  - 빈/공백뿐/비문자열 id → 미발사(잘못된 path·400 확정 요청을 네트워크 전에 차단).
//  - deletingId 보유(이전 삭제 미완) → 미발사(이중 DELETE·state 경합 차단).
//  - 발사 시 진행 id on + 직전 error 비움 → DELETE(id 는 encodeURIComponent 안전 인코딩) →
//    성공(목록 권위 재조회 — 204 는 body 가 없으므로 응답을 소비하지 않고 낙관 제거도 없다) /
//    실패(문구 표면화 — throw 없이) → 진행 id off(공통 finally).
export async function runDeleteCollectionTarget(
  id: string,
  deps: DeleteCollectionTargetDeps,
): Promise<void> {
  // 비정상 호출 가드 — 비문자열(undefined·숫자 등 계약 위반 입력)은 trim 이 없으므로 typeof 로
  // 먼저 잠그고, 빈/공백뿐 id 도 trim 후 빈 문자열이면 차단한다(경계값 — `/api/...//` 회피).
  const targetId = typeof id === 'string' ? id.trim() : '';
  if (!targetId) {
    return;
  }
  // 동시 재호출 가드 — 진행 중인 행이 하나라도 있으면 미발사(이중 DELETE·state 경합 차단).
  if (deps.deletingId) {
    return;
  }
  deps.setDeletingId(targetId);
  // 재발화 시작 시 직전 error 를 비운다(실패 후 재시도 시 직전 문구가 남지 않도록).
  deps.setDeleteError(undefined);
  try {
    // DELETE — 204 No Content 라 응답 body 가 없다. 그래서 응답을 소비하지 않고 성공 사실만
    // 확인하며, 계약을 어기고 body 가 실려 와도(예상 밖 shape) 여기서 throw 하지 않는다.
    await deps.remove(
      `${COLLECTION_TARGETS_PATH}/${encodeURIComponent(targetId)}`,
      { method: 'DELETE' },
    );
    // 성공 — 권위 목록 재조회(삭제된 행이 재조회로 사라진다 — 낙관 제거 없음).
    deps.reloadTargets();
  } catch (e) {
    // 실패 — 문구를 안전 표시(throw 없이). 403 Admin 미만 / 404 row 부재(P2025) / 5xx /
    // 네트워크 0 모두 동일 경로다. 재조회는 하지 않는다(실패 시 목록 그대로 유지).
    deps.setDeleteError(deps.describeError(e));
  } finally {
    deps.setDeletingId(undefined);
  }
}

// 수집 대상 활성/비활성 토글(PATCH) + state-전이 로직에 주입하는 deps(T-1829 — 위
// DeleteCollectionTargetDeps 를 1:1 mirror 하되 PATCH 계약에 맞춘다). in-flight 표현이 boolean
// 이 아니라 **진행 중 id** 인 것도 같은 이유다 — 토글은 행 단위 액션이라 어느 행이 진행 중인지가
// 화면 표시에 필요하다. 발사 primitive 가 apiClient.request 인 것도 삭제 축과 같다(route 1 개뿐 —
// per-resource client 모듈 추출은 task Out of Scope).
interface ToggleCollectionTargetActiveDeps {
  // PATCH 발사기 — (path, options) 시그니처는 apiClient.request 와 같다(테스트는 mock 주입).
  patch: (path: string, options: RequestOptions) => Promise<unknown>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입).
  describeError: (e: unknown) => string;
  // 현재 토글 진행 중인 행 id — truthy 면 미발사(이중 PATCH·경합 가드). 어느 행이든 하나가
  // 진행 중이면 전체를 잠근다(재조회가 목록 전체를 갈아끼우므로 행별 병렬 토글은 무의미).
  togglingId: string | undefined;
  setTogglingId: (next: string | undefined) => void;
  setToggleError: (next: string | undefined) => void;
  // 목록 권위 재조회(useApiResource 의 reload) — 토글 성공 후 호출한다.
  reloadTargets: () => void;
}

// 수집 대상 활성/비활성 토글 PATCH /api/collection-targets/:id + state-전이를 캡슐화한 순수
// async 러너(T-1829 — runDeleteCollectionTarget 을 1:1 mirror). backend 는
// collection-target.controller `@Patch(":id")` + `@Roles("Admin")` 이고, DTO(update-collection-target)
// 의 `active?: boolean` 축만 실어 보낸다(정체성 축 type/instanceKey 는 body 금지 계약).
// ADR-0059 §Decision 5 의 "일시 제외는 삭제가 아니라 active=false PATCH" 를 실제로 발사하는 지점.
// 동작:
//  - 빈/공백뿐/비문자열 id → 미발사(잘못된 path·400 확정 요청을 네트워크 전에 차단).
//  - togglingId 보유(이전 토글 미완) → 미발사(이중 PATCH·state 경합 차단).
//  - 발사 시 진행 id on + 직전 error 비움 → PATCH(id 는 encodeURIComponent 안전 인코딩) →
//    성공(목록 권위 재조회 — 응답 body 는 소비하지 않는다. 낙관 갱신 없음) /
//    실패(문구 표면화 — throw 없이) → 진행 id off(공통 finally).
export async function runToggleCollectionTargetActive(
  id: string,
  nextActive: boolean,
  deps: ToggleCollectionTargetActiveDeps,
): Promise<void> {
  // 비정상 호출 가드 — 비문자열(undefined·숫자 등 계약 위반 입력)은 trim 이 없으므로 typeof 로
  // 먼저 잠그고, 빈/공백뿐 id 도 trim 후 빈 문자열이면 차단한다(경계값 — `/api/...//` 회피).
  const targetId = typeof id === 'string' ? id.trim() : '';
  if (!targetId) {
    return;
  }
  // 동시 재호출 가드 — 진행 중인 행이 하나라도 있으면 미발사(이중 PATCH·state 경합 차단).
  if (deps.togglingId) {
    return;
  }
  deps.setTogglingId(targetId);
  // 재발화 시작 시 직전 error 를 비운다(실패 후 재시도 시 직전 문구가 남지 않도록).
  deps.setToggleError(undefined);
  try {
    // PATCH — body 는 허용 축 중 active 하나뿐이다. 목록이 넘겨준 **다음 상태**를 그대로 싣기
    // 때문에 여기서 현재 상태를 다시 계산하지 않는다(화면이 본 상태와 요청이 어긋날 여지 0).
    // 응답 body(갱신된 row)는 소비하지 않고 재조회로 권위 목록을 받으므로, 계약을 어긴 shape 가
    // 와도 여기서 throw 하지 않는다.
    await deps.patch(
      `${COLLECTION_TARGETS_PATH}/${encodeURIComponent(targetId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: nextActive }),
      },
    );
    // 성공 — 권위 목록 재조회(토글된 행의 표시가 재조회로 바뀐다 — 낙관 갱신 없음).
    deps.reloadTargets();
  } catch (e) {
    // 실패 — 문구를 안전 표시(throw 없이). 400 검증 / 403 Admin 미만 / 404 row 부재(P2025) /
    // 5xx / 네트워크 0 모두 동일 경로다. 재조회는 하지 않는다(실패 시 목록 그대로 유지).
    deps.setToggleError(deps.describeError(e));
  } finally {
    deps.setTogglingId(undefined);
  }
}

// 수집 대상 값 편집(PATCH) 부분 갱신 body(T-1831) — backend UpdateCollectionTargetDto 의 허용 축
// 중 본 slice 가 화면에 올린 `endpoint` 1 축만 optional 로 둔다. 배열 3 축(orgs/repos/spaces)은
// 다음 slice 가 **필드만 늘려** 같은 러너에 실어 보낼 수 있게 타입을 부분 갱신 객체로 잡았다
// (러너 재작성 0). 정체성 축(type · instanceKey)은 애초에 이 타입에 없다 — ADR-0059 §Decision 5
// 가 "변경은 DELETE + POST" 로 못박았고 body 에 실으면 forbidNonWhitelisted 400 이 확정이다.
type CollectionTargetPatch = {
  endpoint?: string;
  // 범위 배열 3 축(T-1832) — backend UpdateCollectionTargetDto `57~71 행` 의 `@IsArray()` 허용
  // 축과 1:1 이다. 세 축 모두 optional 이라 미전달 축은 merge patch 로 서버가 보존하고, **빈
  // 배열은 유효한 값**이다(범위를 전부 비우는 편집 — 축 누락과 구분된다). type 별로 어느 축이
  // 쓰이는지(GITHUB → orgs·repos / CONFLUENCE → spaces)는 화면이 가르고, 러너는 실린 축을
  // 그대로 싣는다(러너가 type 을 다시 판정하면 화면과 어긋날 여지가 생긴다).
  orgs?: string[];
  repos?: string[];
  spaces?: string[];
};

// 범위 배열 3 축의 필드명(T-1832) — 러너의 body 조립 루프와 화면의 입력 렌더가 **같은 목록**을
// 보게 하려고 한 곳에 둔다(두 곳에 적으면 축이 하나 늘 때 갈라진다). 순서는 화면 표시 순서다.
export const COLLECTION_TARGET_SCOPE_FIELDS = ['orgs', 'repos', 'spaces'] as const;
// 위 상수에서 파생한 축 이름 union — 컴포넌트 콜백 인자 타입의 정본이다.
export type CollectionTargetScopeField =
  (typeof COLLECTION_TARGET_SCOPE_FIELDS)[number];
const SCOPE_FIELDS: readonly CollectionTargetScopeField[] =
  COLLECTION_TARGET_SCOPE_FIELDS;

// type 별로 실제 의미가 있는 범위 축 매핑(T-1832) — schema 사실(ADR-0059 §Consequences (c))
// 그대로다: GITHUB 대상은 org·repo 범위를, CONFLUENCE 대상은 space 범위를 쓴다. 알 수 없는/
// 누락 type 은 빈 목록이라 아무 축도 싣지 않는다.
// 목록 컴포넌트(CollectionTargetList)는 같은 매핑을 **표시용** 으로 따로 갖는다 — 선행 spec 들이
// 그 컴포넌트를 통째로 vi.mock 하는 표면이라 본 모듈을 값 import 시키면 mock 표면이 러너까지
// 번지기 때문이다. 두 벌이 갈라지지 않는지는 T-1832 spec 의 drift 가드 케이스가 잠근다.
export const COLLECTION_TARGET_SCOPE_FIELDS_BY_TYPE: Record<
  string,
  readonly CollectionTargetScopeField[]
> = {
  GITHUB: ['orgs', 'repos'],
  CONFLUENCE: ['spaces'],
};

// 편집 중인 행의 type 에서 요청에 실을 범위 축 목록을 고른다(순수 함수 · throw 0). 비문자열 ·
// 누락 · 미등록 type 은 빈 배열이라 호출부가 방어 코드를 두지 않아도 된다.
export function scopeFieldsForCollectionTargetType(
  type?: string,
): readonly CollectionTargetScopeField[] {
  if (typeof type !== 'string') {
    return [];
  }
  return COLLECTION_TARGET_SCOPE_FIELDS_BY_TYPE[type] ?? [];
}

// 범위 배열 3 축의 콤마 목록 입력 → 문자열 배열 파싱(T-1832, 순수 함수 · throw 0).
// 화면은 `orgs` · `repos` · `spaces` 를 "a, b, c" 한 줄로 편집시키므로 전송 직전에 배열로
// 되돌려야 한다. 규칙은 셋 다 같다 — 콤마로 나눠 각 원소 trim → 빈 원소 제거(연속 콤마 ·
// 꼬리 콤마 흡수) → **앞선 것 우선**으로 중복 제거(사용자가 적은 순서를 보존한다).
// 비문자열 입력(undefined · 숫자 · 배열 등 계약 위반)은 빈 배열로 흡수해 호출부가 방어 코드를
// 두지 않아도 되게 한다. 빈 배열 결과 자체가 유효한 값이라 여기서 미발사 판정을 하지 않는다
// (그 판정은 호출부 몫 — 러너는 배열이면 그대로 싣는다).
export function parseScopeInput(raw: string): string[] {
  if (typeof raw !== 'string') {
    return [];
  }
  const seen = new Set<string>();
  const parsed: string[] = [];
  for (const piece of raw.split(',')) {
    const value = piece.trim();
    // 빈 원소(공백뿐 · 연속 콤마)는 버린다 — 서버에 빈 문자열 원소가 저장되지 않게.
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    parsed.push(value);
  }
  return parsed;
}

// 값 편집 PATCH + state-전이 로직에 주입하는 deps(T-1831 — 위 ToggleCollectionTargetActiveDeps
// 를 1:1 mirror 하되 편집 폼 계약에 맞춘다). in-flight 표현이 진행 중 id 인 것도 같은 이유고,
// 토글 축 state 를 재사용하지 않는 이유도 같다(어느 동작이 실패했는지 문구가 섞이지 않게).
// 편집 축에만 있는 축은 `onUpdated` 하나뿐이다 — 성공 시 편집 폼을 닫아야 하는데 그 폼 state 는
// 컨테이너 소유라 러너가 콜백으로 알린다(실패 시에는 호출하지 않아 입력이 유지된다).
interface UpdateCollectionTargetDeps {
  // PATCH 발사기 — (path, options) 시그니처는 apiClient.request 와 같다(테스트는 mock 주입).
  patch: (path: string, options: RequestOptions) => Promise<unknown>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입).
  describeError: (e: unknown) => string;
  // 현재 편집 저장 진행 중인 행 id — truthy 면 미발사(이중 PATCH·경합 가드). 어느 행이든 하나가
  // 진행 중이면 전체를 잠근다(재조회가 목록 전체를 갈아끼우므로 행별 병렬 저장은 무의미).
  updatingId: string | undefined;
  setUpdatingId: (next: string | undefined) => void;
  setUpdateError: (next: string | undefined) => void;
  // 목록 권위 재조회(useApiResource 의 reload) — 저장 성공 후 호출한다.
  reloadTargets: () => void;
  // 성공 후 편집 폼 종료(선택) — 미전달이어도 러너는 정상 동작한다(폼 없이 러너만 쓰는 호출부).
  onUpdated?: () => void;
}

// 수집 대상 값 편집 PATCH /api/collection-targets/:id + state-전이를 캡슐화한 순수 async 러너
// (T-1831 — runToggleCollectionTargetActive 를 1:1 mirror). backend 는 collection-target.
// controller `@Patch(":id")` + `@Roles("Admin")` 이고 body 는 UpdateCollectionTargetDto 의
// 허용 축만 담는다. ADR-0059 §Decision 5 의 "잘못 입력한 endpoint 는 삭제·재등록이 아니라 PATCH
// 로 고친다" 를 실제로 발사하는 지점이다.
// 동작:
//  - 빈/공백뿐/비문자열 id → 미발사(잘못된 path·400 확정 요청을 네트워크 전에 차단).
//  - patch 가 객체가 아니거나 적용할 키 0 개 → 미발사(의미 없는 PATCH 왕복 차단).
//  - endpoint 가 전달됐는데 trim 후 빈 문자열 → 미발사(@IsNotEmpty 400 확정 요청 차단).
//    전송값은 trim 한 값이다(앞뒤 공백이 그대로 저장돼 URL 이 깨지는 것을 막는다).
//  - updatingId 보유(이전 저장 미완) → 미발사(이중 PATCH·state 경합 차단).
//  - 발사 시 진행 id on + 직전 error 비움 → PATCH(id 는 encodeURIComponent 안전 인코딩) →
//    성공(권위 재조회 + onUpdated 로 편집 폼 종료 — 낙관 갱신 없음) /
//    실패(문구 표면화 — throw 없이, 입력·폼 유지) → 진행 id off(공통 finally).
export async function runUpdateCollectionTarget(
  id: string,
  patch: CollectionTargetPatch,
  deps: UpdateCollectionTargetDeps,
): Promise<void> {
  // 비정상 호출 가드 — 비문자열(undefined·숫자 등 계약 위반 입력)은 trim 이 없으므로 typeof 로
  // 먼저 잠그고, 빈/공백뿐 id 도 trim 후 빈 문자열이면 차단한다(경계값 — `/api/...//` 회피).
  const targetId = typeof id === 'string' ? id.trim() : '';
  if (!targetId) {
    return;
  }
  // 적용할 축 조립 — 값 축마다 "전달됐는가" 와 "전달된 값이 유효한가" 를 따로 본다. endpoint 가
  // 아예 없으면 이번 PATCH 의 대상이 아니고(다음 slice 의 배열 축만 실릴 수 있다), 전달됐는데
  // 공백뿐이면 400 이 확정이므로 네트워크 전에 막는다(빈 body 로 축소하지 않는다 — 사용자가
  // 지우려던 값이 조용히 무시되는 대신 아무 일도 일어나지 않게 한다).
  const body: CollectionTargetPatch = {};
  if (patch && typeof patch === 'object') {
    if (typeof patch.endpoint === 'string') {
      const endpoint = patch.endpoint.trim();
      if (!endpoint) {
        return;
      }
      body.endpoint = endpoint;
    }
    // 범위 배열 3 축(T-1832) — 축마다 "배열로 전달됐는가" 만 본다. 배열이면 빈 배열이어도 그대로
    // 싣는다(범위를 전부 비우는 편집이 유효한 값이기 때문 — 여기서 빈 배열을 걸러내면 사용자가
    // 지우려던 범위가 조용히 보존된다). 배열이 아닌 값(문자열 · 숫자 · null 등 계약 위반)은
    // @IsArray() 400 이 확정이므로 네트워크 전에 무시한다(endpoint 의 "공백뿐이면 미발사" 와
    // 판정이 다른 이유는 endpoint 는 축 자체가 필수 비-공백이고 배열 축은 빈 값이 합법이라서다).
    for (const field of SCOPE_FIELDS) {
      const value = patch[field];
      if (Array.isArray(value)) {
        body[field] = value;
      }
    }
  }
  // 적용할 키가 0 개면 미발사 — 아무것도 바꾸지 않는 PATCH 왕복(과 그로 인한 재조회)을 차단한다.
  if (Object.keys(body).length === 0) {
    return;
  }
  // 동시 재호출 가드 — 진행 중인 행이 하나라도 있으면 미발사(이중 PATCH·state 경합 차단).
  if (deps.updatingId) {
    return;
  }
  deps.setUpdatingId(targetId);
  // 재발화 시작 시 직전 error 를 비운다(실패 후 재시도 시 직전 문구가 남지 않도록).
  deps.setUpdateError(undefined);
  try {
    // PATCH — body 는 위에서 조립한 허용 축만 담는다(merge patch 라 미전달 축은 서버가 보존).
    // 응답 body(갱신된 row)는 소비하지 않고 재조회로 권위 목록을 받으므로, 계약을 어긴 shape 가
    // 와도 여기서 throw 하지 않는다.
    await deps.patch(
      `${COLLECTION_TARGETS_PATH}/${encodeURIComponent(targetId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    // 성공 — 권위 목록 재조회 후 편집 폼을 닫는다(onUpdated 는 optional 이라 없으면 건너뛴다).
    deps.reloadTargets();
    deps.onUpdated?.();
  } catch (e) {
    // 실패 — 문구를 안전 표시(throw 없이). 400 검증 / 403 Admin 미만 / 404 row 부재(P2025) /
    // 5xx / 네트워크 0 모두 동일 경로다. 재조회·폼 종료는 하지 않는다(입력 유지 — 사용자가
    // 고쳐 쓰던 값을 잃지 않게).
    deps.setUpdateError(deps.describeError(e));
  } finally {
    deps.setUpdatingId(undefined);
  }
}
