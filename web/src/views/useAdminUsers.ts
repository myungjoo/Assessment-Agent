// AdminView 사용자 관리 축 hook(T-1891 슬라이스 ① + T-1892 슬라이스 ②) — AdminView 본문의 사용자
// 관리 한 구역을 선행 주석까지 본문 무변경으로 옮긴 순수 추출 모듈이다. 슬라이스 ① 이 이동 전
// `1170 행` ~ `1227 행` 의 7 선언(재조회 nonce state · nonce-aware path useMemo · `useApiResource`
// 조회 1 · 생성 입력 2 상태 · in-flight 1 상태 · 실패 문구 2 상태 · `handleCreateUser`)을 옮겼고,
// 슬라이스 ② 가 이동 전 `1194 행` ~ `1288 행` 의 12 선언(역할 변경 in-flight · 실패 문구 2 상태 ·
// `changingRoleIdRef` · `changingRoleGate` useMemo · `handleChangeRole` / 인스턴스 접근 6 상태 ·
// grant · revoke 핸들러 2 · `deriveInstanceAccessFormFlags` 파생)을 합류시켰다. 동작 변경 0 —
// 옮긴 선언의 본문 · `useMemo`/`useCallback` deps 배열 · 러너 주입 키(생성 12 · 역할 변경 7 ·
// grant 8 · revoke 7)가 이동 전과 한 글자도 다르지 않고, 새로 쓴 것은 함수 시그니처와 반환
// literal 뿐이다.
//
// 파라미터는 없다 — 이 축이 참조하는 외부 값(조회 hook · api primitive · 경로 빌더 · 생성/역할
// 변경/부여/회수 러너 · 파생 helper · in-flight gate 팩토리 · 실패 문구 helper 3 종 · `UserRow`
// 타입)이 전부 모듈 최상위 import 로 해결되고 축 밖 상태에 의존하는 지점이 0 이기 때문이다
// (useAdminSchedule 의 params object 와 달리 초기값 props 도 없다).
//
// 반환은 사용자 섹션 JSX(`AdminView.tsx` 의 사용자 관리 섹션)가 실제로 쓰는 것만 공개하고 내부
// 값(`usersPath` · `setCreatingUser` · `setCreateUserError` · `setCreateUserErrorLines` ·
// `changingRoleIdRef` · `changingRoleGate` · `grantingInstanceAccess` · `revokingInstanceAccess` ·
// 그 setter 들)은 노출하지 않는다(캡슐화 — T-1884/T-1886/T-1887/T-1888/T-1889 선례 승계).
// 슬라이스 ① 이 한시적으로 내보내던 `setUsersRefreshNonce` 는 본 슬라이스에서 반환 표면에서
// 내렸다 — 유일 소비처였던 역할 변경 핸들러가 같은 모듈로 들어와 그
// `bumpRefresh: () => setUsersRefreshNonce((n) => n + 1)` 가 모듈 내부 참조가 됐기 때문이다
// (글자-동일 유지, 축 밖 노출 0).
//
// 본 모듈은 AdminView 배럴에 추가하지 않는다 — 기존 공개 표면 무변경이 순수 추출의 전제다.
import { useCallback, useMemo, useRef, useState } from 'react';
import { useApiResource, toErrorMessage } from '../api/useApiResource';
import { request, ApiError } from '../api/apiClient';
import { buildUsersPath } from './adminResourcePathBuilders';
import {
  deriveInstanceAccessFormFlags,
  describeCreateUserFailure,
  describeCreateUserFailureLines,
  runChangeRole,
  runCreateUser,
  runGrantInstanceAccess,
  runRevokeInstanceAccess,
} from './adminUserMutationRunners';
import { createInFlightIdGate } from './adminViewConstants';
import type { UserRow } from '../components/UserList';

export function useAdminUsers() {
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
  // 실패 사유 줄 배열(T-1835, REQ-084) — 표시 지점이 이쪽을 우선해 줄마다 별도 element 로 렌더한다.
  // 문자열 축(createUserError)은 종전 계약대로 함께 유지된다(줄 배열 부재 시 fallback).
  const [createUserErrorLines, setCreateUserErrorLines] = useState<
    string[] | undefined
  >(undefined);

  // 사용자 생성 실 mutation 핸들러(T-1160 — handleCreatePart mirror. 전이는 러너가 캡슐화).
  const handleCreateUser = useCallback(
    () =>
      runCreateUser(userEmailInput, userPasswordInput, {
        create: request,
        // T-1715 — 400 만 축별 구체 사유로 교체(그 외 status 는 toErrorMessage 그대로).
        describeError: describeCreateUserFailure,
        // T-1835 — 줄 배열이 사유 정본(위 describeError 는 그 join 파생).
        describeErrorLines: describeCreateUserFailureLines,
        isConflict: (e: unknown) => e instanceof ApiError && e.status === 409,
        creating: creatingUser,
        setCreating: setCreatingUser,
        setCreateError: setCreateUserError,
        setCreateErrorLines: setCreateUserErrorLines,
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

  // 부여 상태 5종(T-1166 — 생성 state mirror). 다른 mutation 과 섞이지 않게 instance-access 전용
  // 이름으로 분리한다(실패 alert 2 개가 서로를 덮어쓰지 않게). notice 는 조회 endpoint 부재 때문에
  // 성공을 알릴 유일한 표면이다(재조회 nonce bump 없음).
  const [instanceAccessUserId, setInstanceAccessUserId] = useState<string>('');
  const [instanceRefInput, setInstanceRefInput] = useState<string>('');
  const [grantingInstanceAccess, setGrantingInstanceAccess] = useState(false);
  const [instanceAccessError, setInstanceAccessError] = useState<string>();
  const [instanceAccessNotice, setInstanceAccessNotice] = useState<string>();

  // 회수 진행 플래그(T-1167) — 부여와 별개의 in-flight 축. 대상 select·주소 input·error·notice 는
  // T-1166 것을 그대로 재사용한다(같은 폼의 두 방향 action — 새 상태 뭉치 신설 0).
  const [revokingInstanceAccess, setRevokingInstanceAccess] = useState(false);

  // 인스턴스 접근 권한 부여 실 mutation 핸들러(T-1166 — handleCreateUser mirror).
  const handleGrantInstanceAccess = useCallback(
    () =>
      runGrantInstanceAccess(instanceAccessUserId, instanceRefInput, {
        grant: request,
        describeError: toErrorMessage,
        isConflict: (e: unknown) => e instanceof ApiError && e.status === 409,
        granting: grantingInstanceAccess,
        setGranting: setGrantingInstanceAccess,
        setGrantError: setInstanceAccessError,
        setGrantNotice: setInstanceAccessNotice,
        resetInput: () => setInstanceRefInput(''),
      }),
    [instanceAccessUserId, instanceRefInput, grantingInstanceAccess],
  );

  // 인스턴스 접근 권한 회수 실 mutation 핸들러(T-1167 — handleGrantInstanceAccess mirror).
  // isConflict 주입이 없다(revoke 는 409 분기 부재 — 위 러너 주석).
  const handleRevokeInstanceAccess = useCallback(
    () =>
      runRevokeInstanceAccess(instanceAccessUserId, instanceRefInput, {
        revoke: request,
        describeError: toErrorMessage,
        revoking: revokingInstanceAccess,
        setRevoking: setRevokingInstanceAccess,
        setRevokeError: setInstanceAccessError,
        setRevokeNotice: setInstanceAccessNotice,
        resetInput: () => setInstanceRefInput(''),
      }),
    [instanceAccessUserId, instanceRefInput, revokingInstanceAccess],
  );

  // 부여·회수 통합 in-flight + 버튼 비활성(T-1167 도입, T-1168 helper 추출) — 파생 진리표는
  // module-scope 순수 helper 가 소유한다(근거·계약은 deriveInstanceAccessFormFlags 주석). 어느
  // 한쪽이라도 진행 중이면 폼 전체를 잠그는 교차 발사 이중 방어 계약은 그대로다.
  const { busy: instanceAccessBusy, actionDisabled: instanceAccessActionDisabled } =
    deriveInstanceAccessFormFlags({
      granting: grantingInstanceAccess,
      revoking: revokingInstanceAccess,
      userId: instanceAccessUserId,
      instanceRef: instanceRefInput,
    });

  // 반환 표면 — 사용자 섹션 JSX 가 실제로 소비하는 24 심볼(조회/생성 축 11 + 역할 변경 축 3 +
  // 인스턴스 접근 축 10). 내부 전용(`usersPath` · `setUsersRefreshNonce` · 실패/in-flight setter ·
  // `changingRoleIdRef` · `changingRoleGate` · `grantingInstanceAccess` · `revokingInstanceAccess`)
  // 은 의도적으로 빼 축 밖에서 이 축의 내부 상태를 건드릴 경로를 만들지 않는다.
  return {
    usersData,
    userLoading,
    userError,
    userEmailInput,
    setUserEmailInput,
    userPasswordInput,
    setUserPasswordInput,
    creatingUser,
    createUserError,
    createUserErrorLines,
    handleCreateUser,
    changingRoleId,
    changeRoleError,
    handleChangeRole,
    instanceAccessUserId,
    setInstanceAccessUserId,
    instanceRefInput,
    setInstanceRefInput,
    instanceAccessError,
    instanceAccessNotice,
    handleGrantInstanceAccess,
    handleRevokeInstanceAccess,
    instanceAccessBusy,
    instanceAccessActionDisabled,
  };
}
