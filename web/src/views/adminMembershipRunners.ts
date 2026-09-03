// AdminView 의 그룹 멤버십 add · remove mutation 러너 군을 담는 모듈 — T-1874 순수 추출.
// AdminView.tsx 가 4,198 줄로 남아있는 god component 부채(PLAN 183 행)를 갚는 열두째 실분할이며,
// 본 모듈의 심볼은 AdminView 에서 **본문 한 줄도 바꾸지 않고** 옮겨온 것이다(동작 · 계약 · spec
// 무변경 — 선언 앞 export 키워드만 붙였다). 각 선언 위의 주석 블록은 그 러너가 막는 결함의 가드
// 근거 정본이라 함께 옮겼다. 이동 대상은 AdminView 의 연속 1 블록(997 행 ~ 1127 행)인 4 심볼
// (RemoveDeps · runRemove · AddDeps · runAdd) 이며, 사용자 관리 mutation 축을 마감한 직전 두
// slice(T-1872 생성 축 · T-1873 권한 · 역할 축 — adminUserMutationRunners.ts)의 규약을 그대로 따른다.
//
// 배치를 web/src/views/ 아래로 잡은 이유는 이동 블록이 발사 primitive(remove · add)와 상태 setter ·
// 재조회 트리거를 전부 deps 로 주입받아 남는 외부 의존이 RequestOptions 타입 하나뿐이기 때문이다.
// JSX 가 없으므로 확장자는 .ts 다(adminScheduleRunners · adminUserMutationRunners 선례 동형).
//
// AdminView 와의 방향: AdminView → 본 모듈(값 · 타입 의존) 의 **단방향** import 만 만든다. 본 모듈은
// AdminView 를 import 하지 않는다(역방향이 필요해지면 이동 범위를 잘못 잡았다는 신호 — 범위를 넓히지
// 말고 Follow-ups 로 남긴다). AdminView 파일 끝 export 배럴이 임포트한 값 2 개(runRemove · runAdd)와
// 타입 2 개(RemoveDeps · AddDeps)를 이동 전 표면 그대로 re-export 하므로, 기존 계약 spec 의
// `from './AdminView'` 는 무수정으로 산다(공개 표면 무변경).

import type { RequestOptions } from '../api/apiClient';

// onRemove 의 멤버 제거 DELETE + state-전이 로직에 주입하는 deps(T-1130 — ④c runAssign /
// ④e runImport 의 *Deps 주입 convention 차용. jsdom/렌더러 없이 mutation 본체를 직접 검증한다).
// 컨테이너의 handleRemove 는 이 러너에 선택 groupId·현재 in-flight 여부(removing)·상태 setter·
// 재조회 트리거를 주입해 호출만 한다.
export interface RemoveDeps {
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
export async function runRemove(
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

// 멤버 추가 POST + state-전이 로직에 주입하는 deps(T-1131 — runRemove 의 RemoveDeps 를 1:1 mirror.
// jsdom/렌더러 없이 mutation 본체를 직접 검증한다). 컨테이너의 handleAdd 는 이 러너에 선택
// groupId·입력 personId·현재 in-flight 여부(adding)·상태 setter·재조회 트리거·입력 초기화를
// 주입해 호출만 한다.
export interface AddDeps {
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
export async function runAdd(personId: string, deps: AddDeps): Promise<void> {
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
