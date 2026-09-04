// AdminView 수집 대상 축 hook(T-1886) — AdminView 본문 `1533 행` ~ `1761 행` 의 수집 대상 축
// prelude(조회 1 + 파생 1 + 상태 14 + 핸들러 7 = 23 선언)를 선행 주석까지 본문 무변경으로 옮긴
// 순수 추출 모듈이다. 동작 변경 0 — 옮긴 선언의 본문 · `useCallback` deps 배열 · 러너 주입 키가
// 이동 전과 한 글자도 다르지 않고, 새로 쓴 것은 함수 시그니처와 반환 literal 뿐이다.
//
// 외부 의존(러너 4 종 · 조회 hook · 문구 helper · 타입 · 허용 type 목록)은 전부 모듈 최상위
// import 로 해결하므로 hook 은 **주입 파라미터를 받지 않는다**(직전 슬라이스 T-1884 의
// `initialImportConfirmText` 같은 props 유래 초기값이 본 축에는 없음을 사전 실측했다).
//
// 반환은 JSX 수집 대상 섹션이 실제로 쓰는 심볼만 공개한다 — `reloadCollectionTargets` ·
// `deletingCollectionTargetId` · `togglingCollectionTargetId` 와 나머지 내부 setter 는 노출하지
// 않는다(캡슐화 — 축 밖에서 이 축의 state 를 직접 갱신할 경로를 만들지 않는다, T-1884 선례 승계).
//
// 본 모듈은 AdminView 배럴에 추가하지 않는다 — 기존 공개 표면 무변경이 순수 추출의 전제다.
import { useCallback, useMemo, useState } from 'react';
import { useApiResource, toErrorMessage } from '../api/useApiResource';
import { request } from '../api/apiClient';
import type { CollectionTargetRow } from '../components/CollectionTargetList';
import { COLLECTION_TARGET_TYPES } from '../components/CollectionTargetAddForm';
import {
  COLLECTION_TARGETS_PATH,
  EMPTY_COLLECTION_TARGET_SCOPE_INPUT,
  buildScopePatch,
  foldScopeForEdit,
  runCreateCollectionTarget,
  runDeleteCollectionTarget,
  runToggleCollectionTargetActive,
  runUpdateCollectionTarget,
} from './adminCollectionTargetRunners';
import type { CollectionTargetScopeField } from './adminCollectionTargetRunners';

export function useAdminCollectionTargets() {
  // 수집 대상 목록 조회(GET /api/collection-targets, T-1825 — ADR-0059 §Follow-ups (e) 화면 축
  // 첫 조각) — useApiResource 신규 호출 **1 회**다. AdminView 는 수집 대상을 전혀 조회하지 않아
  // 재사용할 기존 fetch 가 없으므로 신규 호출이 정당하고, 같은 path 를 두 번 부르지 않는다
  // (double-fetch 금지 — 아래 섹션이 이 한 호출의 data/loading/error 를 그대로 props 로 쓴다).
  // 변수명에 collectionTarget prefix 를 붙여 파트/사용자/그룹 조회 상태와 섞이지 않게 분리한다
  // (partLoading/partError 동형). 등록·수정 slice 가 아직 없어 refresh nonce 없이 상수 path 다.
  const {
    data: collectionTargetData,
    loading: collectionTargetLoading,
    error: collectionTargetError,
    // 등록(POST) 성공 후 권위 재조회 수단(T-1826) — 같은 path 를 다시 부르는 hook 내장
    // reload 라 nonce-aware 빌더로 갈아끼우지 않고도 목록이 최신화된다(추가 fetch 0).
    reload: reloadCollectionTargets,
  } = useApiResource<CollectionTargetRow[]>(COLLECTION_TARGETS_PATH);

  // 응답 body 정상화(T-1825 negative ⑤) — controller 계약은 배열이지만 proxy 오동작·계약 위반
  // 으로 `null` 이나 객체가 오면 `targets.length` 접근이 throw 한다. 여기서 배열 여부를 한 번만
  // 판정해 비-배열은 빈 배열로 흡수하고, 목록은 빈 상태 안내를 그대로 보여준다(화면이 통째로
  // 죽는 대신 "등록된 수집 대상이 없습니다" 로 안전 착지 — REQ-070 의 막히지 않는 빈 상태).
  const collectionTargets = useMemo<CollectionTargetRow[]>(
    () =>
      Array.isArray(collectionTargetData) ? collectionTargetData : [],
    [collectionTargetData],
  );

  // 등록 3 controlled input(T-1826) — type 은 <select> 라 초기값을 허용 첫 값으로 두어
  // 사용자가 아무것도 고르지 않아도 유효한 상태에서 시작한다(빈 값 → @IsIn 400 회피).
  // 성공 후 세 값을 초기 상태로 되돌린다(연속 등록 시 직전 값 잔존 방지).
  const [collectionTargetTypeInput, setCollectionTargetTypeInput] =
    useState<string>(COLLECTION_TARGET_TYPES[0]);
  const [collectionTargetInstanceKeyInput, setCollectionTargetInstanceKeyInput] =
    useState<string>('');
  const [collectionTargetEndpointInput, setCollectionTargetEndpointInput] =
    useState<string>('');
  // 등록 in-flight 플래그(폼 loading + 동시 재호출 가드 겸용)와 실패 문구(폼 상단 안전 표시).
  const [creatingCollectionTarget, setCreatingCollectionTarget] =
    useState<boolean>(false);
  const [createCollectionTargetError, setCreateCollectionTargetError] =
    useState<string | undefined>(undefined);

  // 등록 실 mutation 핸들러(T-1826) — 러너에 deps 를 주입해 호출만 한다. 입력 3 축·in-flight
  // 를 deps 배열에 포함해 stale 없이 최신 값으로 발사한다(handleCreateServiceIdentity 동형).
  const handleCreateCollectionTarget = useCallback(
    () =>
      runCreateCollectionTarget(
        {
          type: collectionTargetTypeInput,
          instanceKey: collectionTargetInstanceKeyInput,
          endpoint: collectionTargetEndpointInput,
        },
        {
          post: request,
          describeError: toErrorMessage,
          creating: creatingCollectionTarget,
          setCreating: setCreatingCollectionTarget,
          setCreateError: setCreateCollectionTargetError,
          reloadTargets: reloadCollectionTargets,
          resetInput: () => {
            setCollectionTargetTypeInput(COLLECTION_TARGET_TYPES[0]);
            setCollectionTargetInstanceKeyInput('');
            setCollectionTargetEndpointInput('');
          },
        },
      ),
    [
      collectionTargetTypeInput,
      collectionTargetInstanceKeyInput,
      collectionTargetEndpointInput,
      creatingCollectionTarget,
      reloadCollectionTargets,
    ],
  );

  // 삭제 진행 중인 행 id(T-1828) — 행 단위 액션이라 boolean 대신 id 를 들고 있어야 어느 행이
  // 진행 중인지 표시·격리가 가능하다(undefined 면 진행 중 아님). 실패 문구는 섹션 안에
  // role="alert" 로 노출한다(등록 폼의 error props 와 별도 축 — 어느 쪽 실패인지 섞이지 않게).
  const [deletingCollectionTargetId, setDeletingCollectionTargetId] =
    useState<string | undefined>(undefined);
  const [deleteCollectionTargetError, setDeleteCollectionTargetError] =
    useState<string | undefined>(undefined);

  // 삭제 실 mutation 핸들러(T-1828) — 러너에 deps 를 주입해 호출만 한다. 진행 id 를 deps 배열에
  // 포함해 stale 없이 최신 값으로 가드가 걸린다(handleCreateCollectionTarget 동형).
  const handleDeleteCollectionTarget = useCallback(
    (id: string) =>
      runDeleteCollectionTarget(id, {
        remove: request,
        describeError: toErrorMessage,
        deletingId: deletingCollectionTargetId,
        setDeletingId: setDeletingCollectionTargetId,
        setDeleteError: setDeleteCollectionTargetError,
        reloadTargets: reloadCollectionTargets,
      }),
    [deletingCollectionTargetId, reloadCollectionTargets],
  );

  // 토글 진행 중인 행 id + 실패 문구(T-1829) — 삭제 축 state 를 재사용하지 않고 별도로 둔다.
  // 재사용하면 삭제 실패 문구와 토글 실패 문구가 한 자리를 다퉈 어느 동작이 실패했는지 구분되지
  // 않고, 한 행의 삭제가 다른 행의 토글까지 잠그는 과잉 가드가 된다.
  const [togglingCollectionTargetId, setTogglingCollectionTargetId] = useState<
    string | undefined
  >(undefined);
  const [toggleCollectionTargetError, setToggleCollectionTargetError] =
    useState<string | undefined>(undefined);

  // 토글 실 mutation 핸들러(T-1829) — 러너에 deps 를 주입해 호출만 한다. 목록이 넘겨준
  // nextActive 를 그대로 러너에 전달한다(컨테이너가 현재 상태를 다시 계산하지 않는다 —
  // handleDeleteCollectionTarget 동형이되 인자가 2 개).
  const handleToggleCollectionTargetActive = useCallback(
    (id: string, nextActive: boolean) =>
      runToggleCollectionTargetActive(id, nextActive, {
        patch: request,
        describeError: toErrorMessage,
        togglingId: togglingCollectionTargetId,
        setTogglingId: setTogglingCollectionTargetId,
        setToggleError: setToggleCollectionTargetError,
        reloadTargets: reloadCollectionTargets,
      }),
    [togglingCollectionTargetId, reloadCollectionTargets],
  );

  // 값 편집(endpoint) 축 state 4 개(T-1831) — 편집 중인 행 id · 그 행의 endpoint 입력 · 저장
  // 진행 중인 행 id · 실패 문구. 토글·삭제 축 state 를 재사용하지 않는 이유는 같다 — 한 자리를
  // 다투면 어느 동작이 실패했는지 구분되지 않고, 한 행의 저장이 다른 행의 토글까지 잠근다.
  const [editingCollectionTargetId, setEditingCollectionTargetId] = useState<
    string | undefined
  >(undefined);
  const [
    collectionTargetEndpointEditInput,
    setCollectionTargetEndpointEditInput,
  ] = useState<string>('');
  const [updatingCollectionTargetId, setUpdatingCollectionTargetId] = useState<
    string | undefined
  >(undefined);
  const [updateCollectionTargetError, setUpdateCollectionTargetError] =
    useState<string | undefined>(undefined);

  // 범위 배열 3 축 편집 입력(T-1832) — 축마다 state 를 두지 않고 3 필드 문자열 객체 **하나**로
  // 둔다(축이 늘어도 state 수가 늘지 않고, 편집 시작·취소·성공의 리셋도 한 줄이다). 값은 화면이
  // 보여주는 그대로의 콤마 목록 문자열이고, 배열 변환은 저장 직전 parseScopeInput 이 한다.
  const [collectionTargetScopeEditInput, setCollectionTargetScopeEditInput] =
    useState<Record<CollectionTargetScopeField, string>>(
      EMPTY_COLLECTION_TARGET_SCOPE_INPUT,
    );

  // 편집 시작(T-1831 + T-1832) — 목록이 넘겨준 **현재 endpoint** 를 그대로 prefill 한다(컨테이너가
  // 목록을 다시 뒤지지 않는다 — 화면이 본 값과 편집 시작 값이 어긋날 여지 0). 직전 실패 문구도
  // 함께 비워 다른 행의 오류가 새 편집 화면에 남지 않게 한다.
  // 범위 3 축은 예외적으로 컨테이너가 `collectionTargets` 를 id 로 찾아 prefill 한다 —
  // `onEditStart` 시그니처(id, currentEndpoint)를 바꾸지 않기 위해서다(선행 slice spec 이 인자
  // 2 개 정확 일치를 잠그고 있고, 배열 3 개를 인자로 더 매다는 것은 계약을 무겁게 만든다).
  // 행을 못 찾거나 배열 축이 없으면 빈 문자열이라 편집은 "범위 없음" 에서 시작한다(throw 0).
  const handleStartEditCollectionTarget = useCallback(
    (id: string, currentEndpoint: string) => {
      setEditingCollectionTargetId(id);
      setCollectionTargetEndpointEditInput(currentEndpoint ?? '');
      const row = collectionTargets.find((target) => target?.id === id);
      setCollectionTargetScopeEditInput({
        orgs: foldScopeForEdit(row?.orgs),
        repos: foldScopeForEdit(row?.repos),
        spaces: foldScopeForEdit(row?.spaces),
      });
      setUpdateCollectionTargetError(undefined);
    },
    [collectionTargets],
  );

  // 범위 입력 변경(T-1832) — 축 이름별로 해당 필드만 갱신한다(다른 축의 입력이 초기화되지 않게
  // 이전 state 를 펼쳐 유지). 파싱·검증은 저장 시점 몫이라 여기서는 값을 그대로 담는다.
  const handleChangeCollectionTargetScope = useCallback(
    (field: CollectionTargetScopeField, next: string) => {
      setCollectionTargetScopeEditInput((prev) => ({ ...prev, [field]: next }));
    },
    [],
  );

  // 편집 취소(T-1831) — 편집 state 만 비운다(진행 중 요청은 러너의 finally 가 정리하므로 여기서
  // 건드리지 않는다). 실패 문구도 함께 지워 닫힌 폼의 오류가 섹션에 남지 않게 한다.
  const handleCancelEditCollectionTarget = useCallback(() => {
    setEditingCollectionTargetId(undefined);
    setCollectionTargetEndpointEditInput('');
    // 범위 입력도 함께 비운다(T-1832) — 남겨두면 다른 행을 편집할 때 직전 행의 범위가 잠깐
    // 보이거나, prefill 이 없는 축에 이전 값이 그대로 실릴 수 있다.
    setCollectionTargetScopeEditInput(EMPTY_COLLECTION_TARGET_SCOPE_INPUT);
    setUpdateCollectionTargetError(undefined);
  }, []);

  // 편집 저장 실 mutation 핸들러(T-1831) — 러너에 deps 를 주입해 호출만 한다. body 는 편집 입력
  // 1 축뿐이고(정체성 축 금지 계약), 성공 시 onUpdated 로 편집 폼을 닫는다(실패 시에는 닫지 않아
  // 사용자가 고쳐 쓰던 값이 유지된다 — handleToggleCollectionTargetActive 동형).
  const handleSubmitEditCollectionTarget = useCallback(
    (id: string) =>
      runUpdateCollectionTarget(
        id,
        {
          endpoint: collectionTargetEndpointEditInput,
          // 범위 축(T-1832) — 편집 중인 행의 type 이 쓰는 축만 파싱해 싣는다(화면에 없던 축을
          // 요청에 실으면 사용자가 보지 못한 값이 저장된다). 파싱 결과가 빈 배열이어도 그대로
          // 실어 "범위를 전부 지우는 편집" 이 발사되게 한다(축 누락과 구분 — 러너 계약).
          ...buildScopePatch(
            collectionTargets.find((target) => target?.id === id)?.type,
            collectionTargetScopeEditInput,
          ),
        },
        {
          patch: request,
          describeError: toErrorMessage,
          updatingId: updatingCollectionTargetId,
          setUpdatingId: setUpdatingCollectionTargetId,
          setUpdateError: setUpdateCollectionTargetError,
          reloadTargets: reloadCollectionTargets,
          onUpdated: () => {
            setEditingCollectionTargetId(undefined);
            setCollectionTargetEndpointEditInput('');
            // 범위 입력도 성공 시 함께 비운다(T-1832 — 취소 경로와 같은 리셋).
            setCollectionTargetScopeEditInput(
              EMPTY_COLLECTION_TARGET_SCOPE_INPUT,
            );
          },
        },
      ),
    [
      collectionTargetEndpointEditInput,
      collectionTargetScopeEditInput,
      collectionTargets,
      updatingCollectionTargetId,
      reloadCollectionTargets,
    ],
  );
  // 반환 표면 — JSX 수집 대상 섹션(목록 · 3 종 실패 alert · 등록 폼)이 실제로 소비하는 심볼만
  // 공개한다. 내부 전용(`collectionTargetData` 원본 · `reloadCollectionTargets` · 진행 중 행 id 2 종 ·
  // 나머지 setter)은 의도적으로 빼 축 밖에서 이 축의 내부 상태를 건드릴 경로를 만들지 않는다.
  return {
    collectionTargets,
    collectionTargetLoading,
    collectionTargetError,
    collectionTargetTypeInput,
    collectionTargetInstanceKeyInput,
    collectionTargetEndpointInput,
    setCollectionTargetTypeInput,
    setCollectionTargetInstanceKeyInput,
    setCollectionTargetEndpointInput,
    creatingCollectionTarget,
    createCollectionTargetError,
    deleteCollectionTargetError,
    toggleCollectionTargetError,
    updateCollectionTargetError,
    editingCollectionTargetId,
    updatingCollectionTargetId,
    collectionTargetEndpointEditInput,
    setCollectionTargetEndpointEditInput,
    collectionTargetScopeEditInput,
    handleCreateCollectionTarget,
    handleDeleteCollectionTarget,
    handleToggleCollectionTargetActive,
    handleStartEditCollectionTarget,
    handleChangeCollectionTargetScope,
    handleCancelEditCollectionTarget,
    handleSubmitEditCollectionTarget,
  };
}
