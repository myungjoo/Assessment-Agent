// AdminView 의 ServiceIdentity mutation 러너 군(T-1767 ~ T-1770)을 담는 모듈 — T-1852 순수 추출.
// AdminView.tsx 가 6,253 줄까지 다시 자란 god component 부채(PLAN 183 행)를 갚는 셋째 실분할이며,
// 본 모듈의 9 심볼(입력 타입 1 · deps 타입 4 · async 러너 4)은 AdminView 에서 **본문 한 줄도 바꾸지
// 않고** 옮겨온 것이다(동작 · 계약 · spec 무변경 — 선언 앞 export 키워드만 붙였다). 각 선언 위의
// 주석 블록은 그 러너가 막는 결함의 가드 근거 정본(ADR-0058 §Decision 1 · §Decision 3 의 body
// 화이트리스트 포함)이라 함께 옮겼다. 배치를 web/src/views/ 아래로 잡은 이유는 이동 블록이 외부
// import 를 하나도 쓰지 않아(모든 발사 primitive 가 deps 주입) 본문 재작성이 0 이 되기 때문이다.
// JSX 가 없으므로 확장자는 .ts 다.
//
// AdminView 와의 방향: AdminView → 본 모듈(값 의존) 의 **단방향** import 만 만든다. 본 모듈은
// AdminView 를 import 하지 않는다(역방향이 필요해지면 이동 범위를 잘못 잡았다는 신호 — 범위를
// 넓히지 말고 Follow-ups 로 남긴다). AdminView 파일 끝 export 목록은 임포트한 러너 4 개를 그대로
// re-export 해, 기존 spec 5 개(service-identity-create / -update / -delete / -primary /
// -row-bridge)의 `from './AdminView'` 가 import 경로 수정 없이 그대로 산다. 반면 deps 타입 5 개는
// 이동 전에도 AdminView 의 export 표면이 아니었으므로 재수출하지 않고 본 모듈에서만 export 한다
// (공개 표면 무변경). 아울러 adminServiceIdentityRowActions.tsx 가 두 러너를 AdminView 에서
// 가져오던 **역방향 import 도 본 추출로 해소**되어 그 모듈도 본 모듈만 단방향으로 바라본다.

// service identity 추가(POST) body 의 2 허용 축 묶음(T-1767) — client 의 createServiceIdentity
// 시그니처와 같은 모양이라 컨테이너 입력값을 그대로 러너로 넘길 수 있다(T-1768 Nit 흡수).
export type ServiceIdentityInput = { service: string; externalId: string };

// 추가 POST + state-전이 로직에 주입하는 deps(T-1767 — runCreatePerson 의 CreatePersonDeps 를
// 1:1 mirror. jsdom/렌더러 없이 mutation 본체를 직접 검증한다). 발사 primitive 가 apiClient.request
// 가 아니라 client 의 createServiceIdentity(기본 주입, 테스트는 mock)인 것은 path 조립과 body
// 화이트리스트(forbidNonWhitelisted 대비)가 그 함수 책임이기 때문이다(ADR-0058 §Decision 1).
export interface CreateServiceIdentityDeps {
  create: (personId: string, input: ServiceIdentityInput) => Promise<unknown>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입).
  describeError: (e: unknown) => string;
  // 현재 create in-flight 여부 — true 면 미발사(이중 POST·경합 가드).
  creating: boolean;
  setCreating: (next: boolean) => void;
  setCreateError: (next: string | undefined) => void;
  // 목록 재조회 트리거(serviceIdentitiesRefreshNonce +1) / 성공 후 2 입력 초기화.
  bumpRefresh: () => void;
  resetInput: () => void;
}

// 추가 POST /api/persons/:personId/identities(body `{ service, externalId }`) + state-전이를
// 캡슐화한 순수 async 러너(T-1767 — runCreatePerson mirror). 3 no-op 가드(미선택 personId /
// 입력 미완 / in-flight) 뒤, 진행 on + 직전 error 비움 → POST → 성공(목록 재조회 + 입력 초기화)
// / 실패(문구 표면화 — throw 없이) → 진행 off(공통).
export async function runCreateServiceIdentity(
  personId: string,
  input: ServiceIdentityInput,
  deps: CreateServiceIdentityDeps,
): Promise<void> {
  // 인원 미선택 방어 — falsy·빈·공백뿐 personId 는 미발사(깨진 path·불필요 요청 회피).
  const targetPersonId = personId?.trim();
  if (!targetPersonId) {
    return;
  }
  // 필수 2 필드 방어 — 하나라도 비면 미발사(400 확정 요청을 네트워크 전에 차단).
  const service = input?.service?.trim();
  const externalId = input?.externalId?.trim();
  if (!service || !externalId) {
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
    // POST — 201 Created. 응답은 소비하지 않고 재조회로 권위 목록을 받는다(낙관 추가 없음).
    await deps.create(targetPersonId, { service, externalId });
    deps.bumpRefresh();
    deps.resetInput();
  } catch (e) {
    // 실패 — 문구를 안전 표시(throw 없이). 400·404·409 중복·401·5xx·네트워크 0 모두 동일 경로.
    // 재조회 nonce·입력은 건드리지 않는다(목록·입력 유지 — 재시도 편의).
    deps.setCreateError(deps.describeError(e));
  } finally {
    deps.setCreating(false);
  }
}

// 수정 PATCH + state-전이 로직에 주입하는 deps(T-1768 — CreateServiceIdentityDeps 를 1:1 mirror).
// 발사 primitive 가 client 의 updateServiceIdentity(기본 주입, 테스트는 mock)인 것은 item path
// 조립과 body 화이트리스트(externalId 단일)가 그 함수 책임이기 때문이다(ADR-0058 §Decision 3 —
// service·isPrimary 는 시그니처가 아예 받지 않는다).
export interface UpdateServiceIdentityDeps {
  update: (
    personId: string,
    identityId: string,
    input: { externalId: string },
  ) => Promise<unknown>;
  describeError: (e: unknown) => string;
  // in-flight(true 면 미발사) + setter + 재조회 트리거 + 편집 접기.
  updating: boolean;
  setUpdating: (next: boolean) => void;
  setUpdateError: (next: string | undefined) => void;
  bumpRefresh: () => void;
  endEdit: () => void;
}
// 수정 PATCH /api/persons/:personId/identities/:identityId(body `{ externalId }`) + state-전이를
// 캡슐화한 순수 async 러너(T-1768 — runCreateServiceIdentity mirror).
export async function runUpdateServiceIdentity(
  personId: string,
  identityId: string,
  input: { externalId: string },
  deps: UpdateServiceIdentityDeps,
): Promise<void> {
  // 4 no-op 가드 — 미선택 personId / 미선택 identityId(깨진 item path 차단) / 입력 미완(400 확정
  // 요청 사전 차단) / in-flight(이중 PATCH·경합). falsy·빈·공백뿐은 모두 미선택·미완으로 본다.
  const targetPersonId = personId?.trim();
  const targetIdentityId = identityId?.trim();
  const filled = Boolean(input?.externalId?.trim());
  if (!targetPersonId || !targetIdentityId || !filled || deps.updating) {
    return;
  }
  deps.setUpdating(true);
  // 재발화 시작 시 직전 error 를 비운다(실패 후 재시도 시 직전 error 정리).
  deps.setUpdateError(undefined);
  try {
    // PATCH — 전송값은 trim 하지 않은 원문이다. ServiceIdentityEditForm 의 "변경 0" 판정이
    // 원문 비교라(앞뒤 공백만 다른 값도 변경), trim 해 보내면 폼 판정과 저장값이 어긋난다.
    await deps.update(targetPersonId, targetIdentityId, {
      externalId: input.externalId,
    });
    deps.bumpRefresh();
    deps.endEdit();
  } catch (e) {
    // 실패 — 문구를 안전 표시(throw 없이). 400·404(부재/타 Person 소유)·401·5xx·네트워크 0 모두
    // 동일 경로. 재조회도 편집 종료도 하지 않는다(입력 유지 — 재시도 편의).
    deps.setUpdateError(deps.describeError(e));
  } finally {
    deps.setUpdating(false);
  }
}

// 삭제 DELETE + state-전이 로직에 주입하는 deps(T-1769 — UpdateServiceIdentityDeps 를 1:1 mirror).
// 발사 primitive 는 client 의 deleteServiceIdentity(후속 마운트 slice 가 기본 주입, 테스트는 mock)다
// — item path 조립과 204 무-body 마감이 그 함수 책임이기 때문이다(api/serviceIdentity.ts).
// 수정 축과 달리 body 입력이 없으므로 입력 미완 가드는 두지 않는다(가드는 3 종뿐).
export interface DeleteServiceIdentityDeps {
  remove: (personId: string, identityId: string) => Promise<unknown>;
  describeError: (e: unknown) => string;
  // in-flight(true 면 미발사) + setter + 재조회 트리거 + 삭제 확인 단계 종료.
  deleting: boolean;
  setDeleting: (next: boolean) => void;
  setDeleteError: (next: string | undefined) => void;
  bumpRefresh: () => void;
  endConfirm: () => void;
}
// 삭제 DELETE /api/persons/:personId/identities/:identityId(body 없음) + state-전이를 캡슐화한
// 순수 async 러너(T-1769 — runUpdateServiceIdentity mirror).
export async function runDeleteServiceIdentity(
  personId: string,
  identityId: string,
  deps: DeleteServiceIdentityDeps,
): Promise<void> {
  // 3 no-op 가드 — 미선택 personId / 미선택 identityId(깨진 item path 차단) / in-flight(이중
  // DELETE 는 두 번째가 404 로 실패해 오해를 부른다). falsy·빈·공백뿐은 모두 미선택으로 본다.
  const targetPersonId = personId?.trim();
  const targetIdentityId = identityId?.trim();
  if (!targetPersonId || !targetIdentityId || deps.deleting) {
    return;
  }
  deps.setDeleting(true);
  // 재발화 시작 시 직전 error 를 비운다(실패 후 재시도 시 직전 error 정리).
  deps.setDeleteError(undefined);
  try {
    await deps.remove(targetPersonId, targetIdentityId);
    // 삭제 대상이 primary 였을 때의 자동 재승격은 backend 책임이라(ADR-0058 §Decision 2) 여기서
    // 낙관 갱신·승격 추론을 하지 않는다 — bumpRefresh 로 권위 재조회만 걸어 결과를 그대로 받는다.
    deps.bumpRefresh();
    deps.endConfirm();
  } catch (e) {
    // 실패 — 문구를 안전 표시(throw 없이). 404(Person 부재·타 Person 소유·P2025)·401·5xx·네트워크
    // 0 모두 동일 경로. 재조회도 확인 단계 종료도 하지 않는다(확인 단계를 열어둬 재시도 가능).
    deps.setDeleteError(deps.describeError(e));
  } finally {
    deps.setDeleting(false);
  }
}

// primary 지정 POST + state-전이 로직에 주입하는 deps(T-1770 — DeleteServiceIdentityDeps 를 1:1
// mirror). 발사 primitive 는 client 의 setPrimaryServiceIdentity(후속 마운트 slice 가 기본 주입,
// 테스트는 mock)다 — action route path 조립과 무-body 마감이 그 함수 책임이기 때문이다
// (api/serviceIdentity.ts). 삭제 축과 달리 확인 단계가 없어 종료 콜백(endConfirm)을 받지 않는다.
export interface SetPrimaryServiceIdentityDeps {
  setPrimary: (personId: string, identityId: string) => Promise<unknown>;
  describeError: (e: unknown) => string;
  // in-flight(true 면 미발사) + setter + 재조회 트리거.
  settingPrimary: boolean;
  setSettingPrimary: (next: boolean) => void;
  setPrimaryError: (next: string | undefined) => void;
  bumpRefresh: () => void;
}
// primary 지정 POST /api/persons/:personId/identities/:identityId/primary(body 없음) + state-전이를
// 캡슐화한 순수 async 러너(T-1770 — runDeleteServiceIdentity mirror).
export async function runSetPrimaryServiceIdentity(
  personId: string,
  identityId: string,
  deps: SetPrimaryServiceIdentityDeps,
): Promise<void> {
  // 3 no-op 가드 — 미선택 personId / 미선택 identityId(깨진 item path 차단) / in-flight(이중 POST
  // 경합 차단). falsy·빈·공백뿐은 모두 미선택으로 본다.
  // "이미 primary 인 행" 가드는 두지 않는다 — client 계약이 idempotent 이고(api/serviceIdentity.ts)
  // 버튼 disable 은 ServiceIdentityRowActions 책임이다.
  const targetPersonId = personId?.trim();
  const targetIdentityId = identityId?.trim();
  if (!targetPersonId || !targetIdentityId || deps.settingPrimary) {
    return;
  }
  deps.setSettingPrimary(true);
  // 재발화 시작 시 직전 error 를 비운다(실패 후 재시도 시 직전 error 정리).
  deps.setPrimaryError(undefined);
  try {
    // 성공 응답의 승격 row 는 소비하지 않고 버린다 — "1 인원 1 primary" invariant 상 승격은 직전
    // primary 행의 해제를 동반하는데(ADR-0058 §Decision 2) 응답에는 그 반대편 행이 없어 낙관
    // 갱신이 목록을 어긋나게 만든다. 그래서 bumpRefresh 로 권위 재조회만 건다.
    await deps.setPrimary(targetPersonId, targetIdentityId);
    deps.bumpRefresh();
  } catch (e) {
    // 실패 — 문구를 안전 표시(throw 없이). 404 3 단·401·5xx·네트워크 0 모두 동일 경로.
    // 재조회는 하지 않는다(목록이 그대로 남아 같은 자리에서 재시도 가능).
    deps.setPrimaryError(deps.describeError(e));
  } finally {
    deps.setSettingPrimary(false);
  }
}
