// AdminView 사용자 관리 축 hook ①(T-1891) — AdminView 본문 `1170 행` ~ `1227 행` 한 구역(사용자
// 목록 조회 + 생성 배선)의 7 선언(재조회 nonce state · nonce-aware path useMemo · `useApiResource`
// 조회 1 · 생성 입력 2 상태 · in-flight 1 상태 · 실패 문구 2 상태 · `handleCreateUser`)을 선행
// 주석까지 본문 무변경으로 옮긴 순수 추출 모듈이다. 동작 변경 0 — 옮긴 선언의 본문 ·
// `useMemo`/`useCallback` deps 배열 · `runCreateUser` 주입 키 12 개가 이동 전과 한 글자도 다르지
// 않고, 새로 쓴 것은 함수 시그니처와 반환 literal 뿐이다.
//
// 파라미터는 없다 — 이 축이 참조하는 외부 값(조회 hook · api primitive · 경로 빌더 · 생성 러너 ·
// 실패 문구 helper 2 종 · `UserRow` 타입)이 전부 모듈 최상위 import 로 해결되고 축 밖 상태에
// 의존하는 지점이 0 이기 때문이다(useAdminSchedule 의 params object 와 달리 초기값 props 도 없다).
//
// 반환은 사용자 섹션 JSX(`AdminView.tsx` 의 사용자 관리 섹션)와 잔류 역할 변경 축이 실제로 쓰는
// 것만 공개하고 내부 값(`usersPath` · `setCreatingUser` · `setCreateUserError` ·
// `setCreateUserErrorLines`)은 노출하지 않는다(캡슐화 — T-1884/T-1886/T-1887/T-1888/T-1889 선례
// 승계). 예외는 `setUsersRefreshNonce` 하나로, 아직 AdminView 에 남아 있는 역할 변경 ·
// 인스턴스 접근 핸들러가 `bumpRefresh: () => setUsersRefreshNonce((n) => n + 1)` 를 **글자-동일**로
// 유지해야 해서 한시적으로 내보낸다 — 슬라이스 ②(역할 변경 + 인스턴스 접근 합류)가 그 소비처를
// 이 모듈로 흡수하면서 반환 표면에서 내린다.
//
// 본 모듈은 AdminView 배럴에 추가하지 않는다 — 기존 공개 표면 무변경이 순수 추출의 전제다.
import { useCallback, useMemo, useState } from 'react';
import { useApiResource } from '../api/useApiResource';
import { request, ApiError } from '../api/apiClient';
import { buildUsersPath } from './adminResourcePathBuilders';
import {
  describeCreateUserFailure,
  describeCreateUserFailureLines,
  runCreateUser,
} from './adminUserMutationRunners';
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

  // 반환 표면 — 사용자 섹션 JSX 가 실제로 소비하는 11 심볼 + 잔류 축 전용 `setUsersRefreshNonce`
  // 1 개. 내부 전용(`usersPath` · 실패/in-flight setter 3 종)은 의도적으로 빼 축 밖에서 이 축의
  // 내부 상태를 건드릴 경로를 만들지 않는다.
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
    // 한시적 노출(T-1891) — 잔류 역할 변경 · 인스턴스 접근 핸들러의 bumpRefresh 를 글자-동일로
    // 유지하기 위한 것. 슬라이스 ② 가 그 소비처를 흡수하면서 이 줄을 제거한다.
    setUsersRefreshNonce,
  };
}
