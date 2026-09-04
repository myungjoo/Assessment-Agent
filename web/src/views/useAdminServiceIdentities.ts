// AdminView ServiceIdentity 축 hook(T-1888) — AdminView 본문 `492 행` ~ `710 행` 의 ServiceIdentity
// 축 prelude(조회 1 + 경로 1 + 파생 3 + slot 1 + 상태 13 + gate 2 + 핸들러 · 리셋 7 = 28 선언)를
// 선행 주석까지 본문 무변경으로 옮긴 순수 추출 모듈이다. 동작 변경 0 — 옮긴 선언의 본문 ·
// `useMemo`/`useCallback` deps 배열 · 러너 주입 키 · slot deps 14 필드가 이동 전과 한 글자도 다르지
// 않고, 새로 쓴 것은 함수 시그니처와 반환 literal 뿐이다.
//
// 외부 의존(러너 2 종 · 조회 hook · 경로 빌더 · 행 액션 factory · in-flight gate · api primitive ·
// 타입)은 전부 모듈 최상위 import 로 해결하고, 축이 참조하는 props 유래 초기값 2 개
// (`initialSelectedIdentityPersonId` · `initialEditingIdentityId`)만 파라미터로 받는다
// (T-1884 의 `initialImportConfirmText` 선례 동형 — 파라미터는 정확히 2 개다).
//
// 반환은 JSX ServiceIdentity 패널 구역이 실제로 쓰는 23 심볼만 공개한다 —
// `serviceIdentitiesRefreshNonce` · `serviceIdentitiesPath` · `serviceIdentityData` ·
// `identityActionBusyId` · `confirmingDeleteIdentityId` · `identityActionErrorId` ·
// `identityActionErrorText` · `identityActionGate` · `identityActionBusyIdRef` ·
// `handleBeginServiceIdentityEdit` · `serviceIdentityRowActionsDeps` 와 나머지 내부 setter 는
// 노출하지 않는다(캡슐화 — T-1884/T-1886/T-1887 선례 승계).
//
// 단 `setSelectedIdentityPersonId` 는 **예외적으로 노출**한다 — 인원 축의 `handleCreatePerson`
// (`onCreated`) · `handleUpdatePerson`(`onUpdated`) 두 핸들러가 생성 · 수정 성공 후 조회 대상을
// 자동 선택하려고 이 setter 를 직접 부르며(T-1780 · T-1781), 그 두 줄을 원본 소스 정규식으로
// 잠그는 drift-guard 2 건(AdminView.person-create-identity-autoselect.test.tsx ·
// AdminView.person-update-identity-autoselect.test.tsx)이 글자-동일을 요구하기 때문이다.
//
// 본 모듈은 AdminView 배럴에 추가하지 않는다 — 기존 공개 표면 무변경이 순수 추출의 전제다.
import { useCallback, useMemo, useRef, useState } from 'react';
import { useApiResource, toErrorMessage } from '../api/useApiResource';
import { buildServiceIdentitiesPath } from './adminResourcePathBuilders';
import {
  runCreateServiceIdentity,
  runUpdateServiceIdentity,
} from './adminServiceIdentityRunners';
import {
  buildServiceIdentityRowActionsSlot,
  beginServiceIdentityEdit,
  type ServiceIdentityRowActionsWiringDeps,
} from './adminServiceIdentityRowActions';
import {
  createServiceIdentity,
  updateServiceIdentity,
  deleteServiceIdentity,
  setPrimaryServiceIdentity,
} from '../api/serviceIdentity';
import type { ServiceIdentityRow } from '../api/serviceIdentity';
import { createInFlightIdGate } from './adminViewConstants';

export function useAdminServiceIdentities(
  initialSelectedIdentityPersonId: string,
  initialEditingIdentityId: string,
) {
  // service identity 읽기 축 배선(T-1766) — 조회 대상 인원 상태(controlled lift-up, 컨테이너
  // 소유). 인원 관리 섹션 전용 <select> 가 이 값을 갱신한다. 재평가 패널의 selectedPersonId 를
  // 재사용하지 않는 것은 두 화면의 선택이 서로를 덮으면 안 되기 때문이다(각 화면 독립 소유).
  const [selectedIdentityPersonId, setSelectedIdentityPersonId] =
    useState<string>(initialSelectedIdentityPersonId);

  // 조회 대상 인원 변경 — 빈 값 선택 시 미선택으로 되돌아가 조회가 idle 로 떨어진다.
  const handleIdentityPersonChange = (event: {
    target: { value: string };
  }) => {
    setSelectedIdentityPersonId(event.target.value);
  };

  // 목록 재조회 nonce(T-1767) — 추가 성공 시 +1 해 조회 path 를 바꿔 권위 재조회를 낸다.
  const [serviceIdentitiesRefreshNonce, setServiceIdentitiesRefreshNonce] =
    useState<number>(0);

  // 선택 인원의 identity 조회 path — 선택 변경 시 path 가 달라져 자동 refetch 하고 이전 인원의
  // 목록은 잔존하지 않는다. nonce 를 함께 넘겨 추가 성공 후에도 다시 조회한다(T-1767 — 실패
  // 시에는 bump 하지 않아 목록이 그대로 유지된다).
  const serviceIdentitiesPath = useMemo(
    () =>
      buildServiceIdentitiesPath(
        selectedIdentityPersonId || undefined,
        serviceIdentitiesRefreshNonce,
      ),
    [selectedIdentityPersonId, serviceIdentitiesRefreshNonce],
  );

  // 선택 인원의 service identity 조회 — loading/error 는 컨테이너가 받아 ServiceIdentityList 의
  // 대응 props 로 내려보낸다(ADR-0041 Decision 1). 404/403/5xx/네트워크 실패는 hook 의 사람-친화
  // 문구(toErrorMessage 경로)로 안전 표시된다(throw 없음).
  const {
    data: serviceIdentityData,
    loading: serviceIdentityLoading,
    error: serviceIdentityError,
  } = useApiResource<ServiceIdentityRow[]>(serviceIdentitiesPath);

  // 표시용 identity 목록 — 비정상 payload(객체·null·문자열)이거나 미조회/진행 중/실패로
  // undefined 여도 빈 배열로 방어한다(partPersons 선례 — undefined.length 로 깨지지 않도록).
  const serviceIdentities = useMemo(
    () => (Array.isArray(serviceIdentityData) ? serviceIdentityData : []),
    [serviceIdentityData],
  );

  // 추가 2 controlled input(T-1767) — 성공 후 둘 다 빈 값으로 되돌린다.
  const [identityServiceInput, setIdentityServiceInput] = useState<string>('');
  const [identityExternalIdInput, setIdentityExternalIdInput] =
    useState<string>('');
  // 추가 in-flight 플래그(폼 loading + 동시 재호출 가드 겸용)와 실패 문구(폼 하단 안전 표시).
  const [creatingServiceIdentity, setCreatingServiceIdentity] =
    useState<boolean>(false);
  const [createServiceIdentityError, setCreateServiceIdentityError] = useState<
    string | undefined
  >(undefined);

  // 추가 실 mutation 핸들러(T-1767) — 러너에 deps 주입해 호출만 한다. 입력값·in-flight·선택
  // 인원을 deps 배열에 포함해 stale 없이 최신 값으로 발사한다.
  const handleCreateServiceIdentity = useCallback(
    () =>
      runCreateServiceIdentity(
        selectedIdentityPersonId,
        {
          service: identityServiceInput,
          externalId: identityExternalIdInput,
        },
        {
          create: createServiceIdentity,
          describeError: toErrorMessage,
          creating: creatingServiceIdentity,
          setCreating: setCreatingServiceIdentity,
          setCreateError: setCreateServiceIdentityError,
          bumpRefresh: () => setServiceIdentitiesRefreshNonce((n) => n + 1),
          resetInput: () => {
            setIdentityServiceInput('');
            setIdentityExternalIdInput('');
          },
        },
      ),
    [
      selectedIdentityPersonId,
      identityServiceInput,
      identityExternalIdInput,
      creatingServiceIdentity,
    ],
  );
  // 수정 편집 state 4 개(T-1768) — 대상 id(빈 문자열이 미편집) · 입력 · in-flight · 실패 문구.
  const [editingIdentityId, setEditingIdentityId] =
    useState<string>(initialEditingIdentityId);
  const [identityEditExternalIdInput, setIdentityEditExternalIdInput] =
    useState<string>('');
  const [updatingServiceIdentity, setUpdatingServiceIdentity] =
    useState<boolean>(false);
  const [updateServiceIdentityError, setUpdateServiceIdentityError] = useState<
    string | undefined
  >(undefined);
  // 수정 대상 row 파생 — 목록에서 id 로 찾는다(새 fetch 0). 사라진 대상이면 폼이 자연히 접힌다.
  const editingIdentity = useMemo(
    () => serviceIdentities.find((row) => row.id === editingIdentityId),
    [serviceIdentities, editingIdentityId],
  );
  // 수정 대상 선택 변경 — 대상 id 갱신 + 그 row 의 externalId 로 prefill + 직전 실패 문구 비움.
  const handleEditTargetChange = (event: { target: { value: string } }) => {
    const nextId = event.target.value;
    setEditingIdentityId(nextId);
    setIdentityEditExternalIdInput(
      serviceIdentities.find((row) => row.id === nextId)?.externalId ?? '',
    );
    setUpdateServiceIdentityError(undefined);
  };
  const endServiceIdentityEdit = useCallback(() => {
    setEditingIdentityId('');
    setIdentityEditExternalIdInput('');
    setUpdateServiceIdentityError(undefined);
  }, []);
  // 수정 실 mutation 핸들러 — 러너에 deps 주입해 호출만. 인원·대상·입력·in-flight 로 stale 방지.
  const handleUpdateServiceIdentity = useCallback(
    () =>
      runUpdateServiceIdentity(
        selectedIdentityPersonId,
        editingIdentityId,
        { externalId: identityEditExternalIdInput },
        {
          update: updateServiceIdentity,
          describeError: toErrorMessage,
          updating: updatingServiceIdentity,
          setUpdating: setUpdatingServiceIdentity,
          setUpdateError: setUpdateServiceIdentityError,
          bumpRefresh: () => setServiceIdentitiesRefreshNonce((n) => n + 1),
          endEdit: endServiceIdentityEdit,
        },
      ),
    [
      selectedIdentityPersonId,
      editingIdentityId,
      identityEditExternalIdInput,
      updatingServiceIdentity,
      endServiceIdentityEdit,
    ],
  );

  // 행 액션 state 4 종(T-1777 — ADR-0058 §Follow-ups (d) 마감 결선). 목록 전체에 각각 하나씩만
  // 두는 slot 이며, 앞 3 종은 boolean 이 아니라 "대상 행 id" 다 — 행 단위 플래그 파생
  // (deriveServiceIdentityRowActionsFlags)이 id 비교로 판정해야 다른 행의 진행 · 확인 · 실패가
  // 이 행을 물들이지 않기 때문이다. undefined 가 "해당 행 없음" 이다.
  const [identityActionBusyId, setIdentityActionBusyId] = useState<
    string | undefined
  >(undefined);
  const [confirmingDeleteIdentityId, setConfirmingDeleteIdentityId] = useState<
    string | undefined
  >(undefined);
  const [identityActionErrorId, setIdentityActionErrorId] = useState<
    string | undefined
  >(undefined);
  const [identityActionErrorText, setIdentityActionErrorText] = useState<
    string | undefined
  >(undefined);
  // 진행 id 의 동기 사본 + gate(changingRoleGate 선례 그대로 — 새로 구현하지 않는다). 위 state 는
  // 렌더 표면이라 같은 tick 의 두 번째 발사가 stale 값을 본다. 러너 가드는 gate.read() 로 ref 를 읽고,
  // 둘은 createInFlightIdGate 가 ref → state 순서로 함께 갱신한다.
  const identityActionBusyIdRef = useRef<string | undefined>(undefined);
  const identityActionGate = useMemo(
    () => createInFlightIdGate(identityActionBusyIdRef, setIdentityActionBusyId),
    [],
  );

  // 행 편집 진입(T-1776 helper 호출만 — 진입 로직 인라인 재작성 금지). 주입하는 6 종이 모두
  // useState setter 라 참조가 stable 하므로 deps 는 빈 배열이다.
  const handleBeginServiceIdentityEdit = useCallback(
    (identity: ServiceIdentityRow) =>
      beginServiceIdentityEdit(identity, {
        setEditingIdentityId,
        setEditExternalIdInput: setIdentityEditExternalIdInput,
        setUpdateError: setUpdateServiceIdentityError,
        setConfirmingDeleteId: setConfirmingDeleteIdentityId,
        setErrorIdentityId: setIdentityActionErrorId,
        setErrorText: setIdentityActionErrorText,
      }),
    [],
  );

  // 행 액션 배선 deps 14 필드(T-1773 계약) — remove 에 deleteServiceIdentity, setPrimary 에
  // setPrimaryServiceIdentity 를 꽂는다. 두 primitive 는 시그니처가 같아 교차 배선이 컴파일을
  // 통과하므로 spec 이 호출 인자까지 검증한다. personId 는 조회 <select> 가 고른 인원이라
  // 미선택('')이면 러너 가드가 발사 없이 접는다.
  const serviceIdentityRowActionsDeps =
    useMemo<ServiceIdentityRowActionsWiringDeps>(
      () => ({
        gate: identityActionGate,
        setErrorIdentityId: setIdentityActionErrorId,
        setErrorText: setIdentityActionErrorText,
        personId: selectedIdentityPersonId,
        onEdit: handleBeginServiceIdentityEdit,
        remove: deleteServiceIdentity,
        setPrimary: setPrimaryServiceIdentity,
        describeError: toErrorMessage,
        bumpRefresh: () => setServiceIdentitiesRefreshNonce((n) => n + 1),
        confirmingDeleteId: confirmingDeleteIdentityId,
        setConfirmingDeleteId: setConfirmingDeleteIdentityId,
        busyIdentityId: identityActionBusyId,
        errorIdentityId: identityActionErrorId,
        errorText: identityActionErrorText,
      }),
      [
        identityActionGate,
        selectedIdentityPersonId,
        handleBeginServiceIdentityEdit,
        confirmingDeleteIdentityId,
        identityActionBusyId,
        identityActionErrorId,
        identityActionErrorText,
      ],
    );
  // 목록에 내려보낼 행 액션 slot — props 조립은 factory(T-1773/T-1775) 책임이라 손으로 만들지
  // 않는다. deps 가 바뀔 때만 새 함수를 만들어 <ServiceIdentityList> 의 prop 정체성을 안정화한다.
  const serviceIdentityRowActionsSlot = useMemo(
    () => buildServiceIdentityRowActionsSlot(serviceIdentityRowActionsDeps),
    [serviceIdentityRowActionsDeps],
  );

  // 반환 표면 — JSX ServiceIdentity 패널 구역(조회 <select> · 목록 + 행 액션 slot · 추가 폼 ·
  // 수정 대상 <select> · 수정 폼)이 실제로 소비하는 23 심볼만 공개한다. 내부 전용(재조회 nonce ·
  // 조회 path · 원본 응답 · 행 액션 state 4 종 · in-flight gate 와 그 ref · 행 편집 진입 helper ·
  // slot deps memo · 나머지 setter)은 의도적으로 빼 축 밖에서 이 축의 내부 상태를 건드릴 경로를
  // 만들지 않는다. `setSelectedIdentityPersonId` 만 위 헤더 주석의 사유로 예외 노출한다.
  return {
    selectedIdentityPersonId,
    setSelectedIdentityPersonId,
    handleIdentityPersonChange,
    serviceIdentities,
    serviceIdentityLoading,
    serviceIdentityError,
    serviceIdentityRowActionsSlot,
    identityServiceInput,
    setIdentityServiceInput,
    identityExternalIdInput,
    setIdentityExternalIdInput,
    creatingServiceIdentity,
    createServiceIdentityError,
    handleCreateServiceIdentity,
    editingIdentityId,
    editingIdentity,
    handleEditTargetChange,
    identityEditExternalIdInput,
    setIdentityEditExternalIdInput,
    updatingServiceIdentity,
    updateServiceIdentityError,
    endServiceIdentityEdit,
    handleUpdateServiceIdentity,
  };
}
