// AdminView 파트 축 hook(T-1893 순수 추출) — AdminView 본문에 흩어져 있던 파트 축 3 조각을 선행
// 주석까지 본문 무변경으로 옮긴 모듈이다. 이동 전 좌표로 (A) `1085 행` ~ `1106 행`(재조회 nonce
// state · nonce-aware `partsPath` useMemo · `useApiResource<PartRow[]>` 목록 조회), (B) `1141 행`
// ~ `1171 행`(선택 파트 state · 조건부 `partPersonsPath` useMemo · `useApiResource<PersonRow[]>`
// 소속 인원 조회 · `partPersons` 방어 파생), (C) `1208 행` ~ `1372 행`(생성 3 선언 +
// `handleCreatePart` · 삭제 2 선언 + `handleDeletePart` · 수정 5 선언 + `resetEditPartForm` ·
// `handleEditPart` · `handleCancelEditPart` · `handleUpdatePart`) 합 218 줄이다. 동작 변경 0 —
// 옮긴 선언의 본문 · `useMemo`/`useCallback` deps 배열 · 러너 주입 키(생성 8 · 삭제 6 · 수정 8)가
// 이동 전과 한 글자도 다르지 않고, 새로 쓴 것은 함수 시그니처와 반환 literal 뿐이다.
//
// 파라미터는 props 유래 초기값 `initialSelectedPartId` 하나다(useAdminServiceIdentities 가
// 초기값 2 개를 받은 선례 동형). 이 축이 참조하는 나머지 외부 값(조회 hook · api 발사 primitive ·
// 경로 빌더 2 · mutation 러너 3 · 삭제 bumpRefresh factory · `PartRow`/`PersonRow` 타입)은 전부
// 모듈 최상위 import 로 해결되고, 축 밖 상태에 의존하는 지점은 0 이다(그룹 · 인원 · 멤버십 파생
// 참조 0 — 그래서 이 축이 잔여 3 축 중 가장 먼저 닫힌다).
//
// 반환은 파트 관리 섹션 JSX 가 실제로 쓰는 24 심볼만 공개하고 내부 값(`partsRefreshNonce` ·
// `setPartsRefreshNonce` · `partsPath` · `partPersonsPath` · `partPersonData` ·
// `editPartOriginalName` · `resetEditPartForm` · 실패/in-flight setter)은 노출하지 않는다
// (캡슐화 — T-1884/T-1886/T-1887/T-1888/T-1889/T-1891/T-1892 선례 승계). 축이 통째로 들어와
// bumpRefresh 소비처가 전부 모듈 안이므로 T-1891 같은 한시적 setter 노출도 필요 없다.
//
// 본 모듈은 AdminView 배럴에 추가하지 않는다 — 기존 공개 표면 무변경이 순수 추출의 전제다.
import { useCallback, useMemo, useState } from 'react';
import { useApiResource, toErrorMessage } from '../api/useApiResource';
import { request, ApiError } from '../api/apiClient';
import {
  buildPartsPath,
  buildPartPersonsPath,
} from './adminResourcePathBuilders';
import {
  runCreatePart,
  runDeletePart,
  runUpdatePart,
  buildDeletePartBumpRefresh,
} from './adminGroupPartMutationRunners';
import type { PartRow } from '../components/PartList';
import type { PersonRow } from '../components/PersonList';

export function useAdminParts(initialSelectedPartId: string) {
  // 파트 재조회 nonce(T-1153) — 파트 생성 POST 성공 시 이 값을 +1 해 parts path 를 변화시켜
  // useApiResource 재조회를 유발한다(read-only hook 수정 0 경로 — groupsRefreshNonce 동형).
  // nonce 0 초기 마운트는 base path(PARTS_PATH) 그대로다(T-1152 마운트와 동일 — 회귀 0).
  const [partsRefreshNonce, setPartsRefreshNonce] = useState<number>(0);

  // 파트 목록 조회 path(T-1153) — nonce-aware 빌더로 전환(buildPartsPath). nonce 0 이면 base
  // path(T-1152 마운트와 동일), 생성 성공 후 nonce 증가가 `_r` query 로 재조회를 낸다.
  const partsPath = useMemo(
    () => buildPartsPath(partsRefreshNonce),
    [partsRefreshNonce],
  );

  // 파트 목록 조회(GET /api/parts, T-1152 마운트 → T-1153 nonce 전환) — useApiResource 호출.
  // 그룹처럼 재사용할 기존 파트 fetch 가 없어(AdminView 파트 미조회) 신규 호출이 정당하다(double-fetch
  // 대상 부재). 변수명에 part prefix 를 붙여 인원/그룹/멤버십/스케줄 등 다른 조회 상태와 섞이지 않게
  // 분리한다(groupLoading/groupError 동형). data 가 undefined(미조회/진행 중/실패)이면 렌더 시 `?? []`
  // 로 안전 방어한다. 생성 성공 시 partsRefreshNonce bump 로 이 조회를 권위 재조회한다(낙관 추가 없음).
  const {
    data: partsData,
    loading: partLoading,
    error: partError,
  } = useApiResource<PartRow[]>(partsPath);

  // 선택 파트 상태(T-1156) — controlled lift-up(컨테이너 소유). 파트 관리 섹션의 파트 선택
  // <select> 가 이 값을 갱신하고, 값이 있을 때만 소속 인원을 조건부 조회한다(selectedGroupId 동형).
  const [selectedPartId, setSelectedPartId] = useState<string>(
    initialSelectedPartId,
  );

  // 선택 파트의 소속 인원 조회 path(T-1156) — 선택이 있을 때만 조건부 path 를 만든다(미선택이면
  // null → useApiResource 미조회 idle). 선택 변경 시 path 가 달라져 자동 refetch 하고(이전 파트의
  // 인원이 잔존하지 않는다 — hook 이 path 변경마다 state 를 초기화), 파트 CRUD 성공으로
  // partsRefreshNonce 가 증가하면 `_r` query 로 소속 인원도 함께 권위 재조회한다(별도 nonce 미도입).
  const partPersonsPath = useMemo(
    () => buildPartPersonsPath(selectedPartId || undefined, partsRefreshNonce),
    [selectedPartId, partsRefreshNonce],
  );

  // 선택 파트의 소속 인원 조회(T-1156) — GET /api/parts/:id/persons 를 조건부 fetch 한다.
  // loading/error 는 컨테이너가 받아 PersonList 의 대응 props 로 내려보낸다(ADR-0041 Decision 1 —
  // 컴포넌트는 fetch 를 모른다). 404(파트 부재)/500/네트워크 실패는 모두 error 문구로 안전 표시된다.
  const {
    data: partPersonData,
    loading: partPersonLoading,
    error: partPersonError,
  } = useApiResource<PersonRow[]>(partPersonsPath);

  // 표시용 소속 인원 목록(T-1156) — 응답이 배열이 아닌 비정상 payload(객체·null·문자열 등)이거나
  // 미조회/진행 중/실패로 undefined 여도 빈 배열로 안전 방어한다(throw 0 — PersonList 가
  // undefined.length 로 깨지지 않도록). groups 파생(Array.isArray) convention 정합.
  const partPersons = useMemo(
    () => (Array.isArray(partPersonData) ? partPersonData : []),
    [partPersonData],
  );

  // 파트 생성 controlled input 상태(T-1153) — 컨테이너 소유. "파트 추가" 클릭 시 handleCreatePart
  // 가 POST body 의 name 필드로 공급하고, 성공 후 빈 값으로 되돌린다(연속 생성 편의). 그룹 생성의
  // groupNameInput 패턴 mirror(파트도 name 단일 필드).
  const [partNameInput, setPartNameInput] = useState<string>('');

  // 파트 생성 mutation in-flight 플래그(T-1153) — POST 진행 중 true. 진행 표시(입력·버튼 비활성)와
  // 동시 재호출 가드(이전 mutation 미완 중 재발사 차단)에 함께 쓴다(creatingGroup 동형).
  const [creatingPart, setCreatingPart] = useState<boolean>(false);

  // 파트 생성 mutation 실패 문구(T-1153) — POST 실패 시 사람-친화 문구를 보관해 폼 하단에 안전
  // 표시한다(throw 없음). 409(중복 이름)면 PART_DUPLICATE_ERROR 전용 문구, 그 외는 toErrorMessage
  // 파생 문구. 성공/재시도 시작 시 비운다.
  const [createPartError, setCreatePartError] = useState<string | undefined>(
    undefined,
  );

  // 파트 생성 실 mutation 핸들러(T-1153) — 파트 생성 POST(/api/parts, body `{ name }`)를 컨테이너
  // 내부 async 로 발사한다(handleCreateGroup 정합). 빈/공백 name·이전 mutation 미완(creatingPart)
  // 발사 억제 + 성공(파트 재조회 + 입력 초기화)/실패(error 안전 표시, throw 없음)/409 중복 전용 문구
  // 전이는 runCreatePart 가 캡슐화한다. 409 판정은 ApiError.status===409 검사를 isConflict 로 주입한다.
  // 입력값·creatingPart 를 deps 의존성에 포함해 stale 없이 최신 입력·가드 상태로 발사한다.
  const handleCreatePart = useCallback(
    () =>
      runCreatePart(partNameInput, {
        create: request,
        describeError: toErrorMessage,
        isConflict: (e: unknown) => e instanceof ApiError && e.status === 409,
        creating: creatingPart,
        setCreating: setCreatingPart,
        setCreateError: setCreatePartError,
        bumpRefresh: () => setPartsRefreshNonce((n) => n + 1),
        resetInput: () => setPartNameInput(''),
      }),
    [partNameInput, creatingPart],
  );

  // 파트 삭제 mutation in-flight 플래그(T-1154) — DELETE 진행 중 true. 진행 표시(loading 우선)와
  // 동시 재호출 가드(이전 mutation 미완 중 재호출 차단)에 함께 쓴다(deletingGroup 동형).
  const [deletingPart, setDeletingPart] = useState<boolean>(false);

  // 파트 삭제 mutation 실패 문구(T-1154) — DELETE 실패 시 사람-친화 문구(toErrorMessage 파생)를
  // 보관해 목록 패널의 error props 로 안전 표시한다(throw 없음). 성공/재시도 시작 시 비운다.
  const [deletePartError, setDeletePartError] = useState<string | undefined>(
    undefined,
  );

  // onDelete 실 mutation 핸들러(T-1154) — 파트 삭제 DELETE(/api/parts/:id)를 컨테이너 내부 async
  // 로 발사한다(신규 mutation hook 미작성 — runDeleteGroup 정합). 빈/공백/falsy id·이전 mutation
  // 미완(deletingPart) 발사 억제 + 성공(파트 재조회 트리거)/실패(error 안전 표시, throw 없음) 전이는
  // runDeletePart 가 캡슐화한다. deletingPart 를 deps 의존성에 포함해 stale 없이 최신 가드 상태로
  // 발사한다. 성공 경로 전용 bumpRefresh(T-1154 계약 — 실패 시 미호출)에서 파트 재조회 nonce bump
  // 와 함께 선택 해제도 처리한다(T-1157): 선택 중인 파트를 삭제하면 selectedPartId 를 비워 사라진
  // 파트의 소속 인원 재조회(404 문구)와 <select> 표시값 불일치를 막는다. functional setState 로
  // 최신 선택값을 읽어 selectedPartId 를 deps 에 넣지 않는다(stale closure 회피 + deps 유지).
  // 실패 시 선택 유지는 bumpRefresh 미호출로 자동 보장된다(러너 시그니처 변경 0). 콜백 본문은
  // buildDeletePartBumpRefresh 순수 factory 가 소유해 test 가 실물 배선을 직접 호출·검증한다.
  const handleDeletePart = useCallback(
    (id: string) =>
      runDeletePart(id, {
        remove: request,
        describeError: toErrorMessage,
        deleting: deletingPart,
        setDeleting: setDeletingPart,
        setDeleteError: setDeletePartError,
        bumpRefresh: buildDeletePartBumpRefresh(
          setPartsRefreshNonce,
          setSelectedPartId,
          id,
        ),
      }),
    [deletingPart],
  );

  // 편집 대상 part id(T-1155) — null 이면 편집 안 함(인라인 수정 폼 미렌더). PartList 각 행의
  // "수정" 버튼 클릭 시 해당 row.id 로 채우고, 성공/취소 시 null 로 되돌린다. 편집 폼 렌더 분기
  // 기준값(editingGroupId 동형).
  const [editingPartId, setEditingPartId] = useState<string | null>(null);

  // 파트 수정 name controlled input 상태(T-1155) — 컨테이너 소유. "수정" 클릭 시 해당 row 의 현재
  // name 으로 prefill 한다(파트도 편집 필드가 name 하나뿐 — UpdatePartDto 계약). handleUpdatePart
  // 가 편집 시작 원본 name(editPartOriginalName)과 함께 러너에 넘겨 미변경 skip 을 판정한다.
  const [editPartNameInput, setEditPartNameInput] = useState<string>('');

  // 편집 시작 시점의 원본 name 스냅샷(T-1155) — runUpdatePart 가 현재 입력과 비교해 미변경이면
  // 발사를 억제하는 데 쓴다(자기 자신과의 409 유발도 함께 회피). "수정" 클릭 시 클릭한 row 의 현재
  // name 으로 채우고, 편집 종료 시 빈 문자열로 되돌린다.
  const [editPartOriginalName, setEditPartOriginalName] = useState<string>('');

  // 파트 수정 mutation in-flight 플래그(T-1155) — PATCH 진행 중 true. 진행 표시(입력·버튼 비활성)와
  // 동시 재호출 가드(이전 mutation 미완 중 재발사 차단)에 함께 쓴다(updatingGroup 동형).
  const [updatingPart, setUpdatingPart] = useState<boolean>(false);

  // 파트 수정 mutation 실패 문구(T-1155) — PATCH 실패 시 사람-친화 문구를 보관해 편집 폼 하단에 안전
  // 표시한다(throw 없음, 생성/삭제 error 와 별도 문구). 409(중복 이름)면 PART_DUPLICATE_ERROR 전용
  // 문구, 그 외는 toErrorMessage 파생 문구. 성공/재시도/편집 시작 시 비운다.
  const [updatePartError, setUpdatePartError] = useState<string | undefined>(
    undefined,
  );

  // 편집 폼 닫기(편집 상태 종료) helper(T-1155) — 편집 대상 id·name 입력·원본 스냅샷을 모두 기본값
  // 으로 되돌린다. 성공 후 closeEdit·취소 버튼 두 경로가 공유한다(resetEditGroupForm 동형).
  const resetEditPartForm = useCallback(() => {
    setEditingPartId(null);
    setEditPartNameInput('');
    setEditPartOriginalName('');
  }, []);

  // "수정" 버튼 클릭 핸들러(T-1155) — PartList.onEdit 로 내려보낸다. 클릭한 row 의 현재 name 으로 폼을
  // prefill 하고(partsData 에서 id 매칭) 원본 name 스냅샷도 함께 세팅한다(미변경 판정 기준). 직전 수정
  // error 도 비워 새 편집 세션을 깨끗이 시작한다(handleEditGroup 동형). 매칭 row 가 없으면 빈 문자열
  // prefill — 러너의 빈 name 가드가 발사를 막는다(throw 없음).
  const handleEditPart = useCallback(
    (id: string) => {
      const row = (partsData ?? []).find((part) => part.id === id);
      const name = row?.name ?? '';
      setEditingPartId(id);
      setEditPartNameInput(name);
      setEditPartOriginalName(name);
      setUpdatePartError(undefined);
    },
    [partsData],
  );

  // 편집 취소 핸들러(T-1155) — 인라인 폼을 닫고 입력·error 를 비운다(발사 없이 편집 상태만 종료 —
  // 입력이 원복된다). 진행 중(updatingPart)일 때는 취소를 억제해 PATCH 완료 전 폼이 사라지지 않게
  // 한다(버튼 disabled + 핸들러 가드 이중, handleCancelEditGroup 동형).
  const handleCancelEditPart = useCallback(() => {
    if (updatingPart) {
      return;
    }
    resetEditPartForm();
    setUpdatePartError(undefined);
  }, [updatingPart, resetEditPartForm]);

  // 파트 수정 실 mutation 핸들러(T-1155) — 파트 수정 PATCH(/api/parts/:id, body `{ name }`)를 컨테이너
  // 내부 async 로 발사한다(handleUpdateGroup 정합). 빈/falsy id·이전 mutation 미완(updatingPart)·빈·
  // 공백 name·미변경 name 발사 억제 + 성공(파트 재조회 + 편집 종료)/실패(error 안전 표시, throw 없음)/
  // 409 중복 전용 문구 전이는 runUpdatePart 가 캡슐화한다. 409 판정은 ApiError.status===409 검사를
  // isConflict 로 주입한다(handleCreatePart 동형). 입력 name·원본·편집 대상 id·updatingPart 를 deps
  // 의존성에 포함해 stale 없이 최신 입력·가드 상태로 발사한다.
  const handleUpdatePart = useCallback(
    () =>
      runUpdatePart(
        editingPartId ?? '',
        editPartNameInput,
        editPartOriginalName,
        {
          update: request,
          describeError: toErrorMessage,
          isConflict: (e: unknown) => e instanceof ApiError && e.status === 409,
          updating: updatingPart,
          setUpdating: setUpdatingPart,
          setUpdateError: setUpdatePartError,
          bumpRefresh: () => setPartsRefreshNonce((n) => n + 1),
          closeEdit: resetEditPartForm,
        },
      ),
    [
      editingPartId,
      editPartNameInput,
      editPartOriginalName,
      updatingPart,
      resetEditPartForm,
    ],
  );

  // 반환 표면 — 파트 관리 섹션 JSX 가 실제로 소비하는 24 심볼(조회 축 3 + 선택 · 소속 인원 축 5 +
  // 생성 축 5 + 삭제 축 3 + 수정 축 8). 내부 전용(`partsRefreshNonce` · `setPartsRefreshNonce` ·
  // `partsPath` · `partPersonsPath` · `partPersonData` · `editPartOriginalName` ·
  // `resetEditPartForm` · 실패/in-flight setter)은 의도적으로 빼 축 밖에서 이 축의 내부 상태를
  // 건드릴 경로를 만들지 않는다.
  return {
    partsData,
    partLoading,
    partError,
    selectedPartId,
    setSelectedPartId,
    partPersons,
    partPersonLoading,
    partPersonError,
    partNameInput,
    setPartNameInput,
    creatingPart,
    createPartError,
    handleCreatePart,
    deletingPart,
    deletePartError,
    handleDeletePart,
    editingPartId,
    editPartNameInput,
    setEditPartNameInput,
    updatingPart,
    updatePartError,
    handleEditPart,
    handleCancelEditPart,
    handleUpdatePart,
  };
}
