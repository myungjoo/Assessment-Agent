// AdminView 인원 축 hook(T-1894 순수 추출 슬라이스 ① · T-1895 합류 슬라이스 ②) — AdminView 본문에
// 있던 인원 축 4 조각을 선행 주석까지 본문 무변경으로 옮긴 모듈이다. 슬라이스 ① 이 (A) 재조회
// nonce · 휴직 포함 토글 · nonce + 토글 aware `personsPath` useMemo · 목록 조회, (B) 삭제 in-flight ·
// 실패 문구 · `handleDeletePerson` 를 옮겼고, 슬라이스 ② 가 이동 전 좌표로 (C) `537 행` ~ `586 행`
// (생성 2 input · in-flight · 실패 문구 · `handleCreatePerson`), (D) `738 행` ~ `849 행`(편집 대상
// id · 편집 3 input · 원본 스냅샷 · in-flight · 실패 문구 · `resetEditPersonForm` ·
// `handleEditPerson` · `handleCancelEditPerson` · `handleUpdatePerson`) 합 162 줄을 합류시켰다.
// 동작 변경 0 — 옮긴 선언의 본문 · `useMemo`/`useCallback` deps 배열 · 러너 주입 키가 이동 전과 한
// 글자도 다르지 않고, 새로 쓴 것은 함수 시그니처와 반환 literal 뿐이다.
//
// 파라미터는 props 유래 초기값 `initialPersonsIncludeInactive` 와 축 밖 setter
// `setSelectedIdentityPersonId` 2 개다. 후자는 이 축이 유일하게 축 밖에 의존하는 값으로, 생성 ·
// 수정 성공 직후 identity 조회 대상을 자동 선택하는 배선(T-1780 · T-1781, REQ-079)이 쓴다 —
// 파라미터명을 유지해 `onCreated:` · `onUpdated:` 두 줄을 무변경으로 옮겼다. 그 setter 를 돌려주는
// `useAdminServiceIdentities` 호출은 AdminView 에서 본 hook 호출 **앞**으로 올라갔다(두 hook 사이
// 데이터 의존 0 — `useApiResource` 발사 순번만 인원 ↔ identity 로 교환되고, web 의 모든 spec 이
// mock 을 path 로 라우팅해 회귀가 없다).
//
// 반환은 잔류 소비처가 실제로 쓰는 것만 공개하고 내부 값(`personsPath` · `personsRefreshNonce` ·
// 각 축의 state setter)은 노출하지 않는다(캡슐화 — T-1884/T-1886/T-1887/T-1888/T-1889/T-1891/
// T-1892/T-1893/T-1894 선례 승계). T-1894 가 한시적으로 노출했던 `setPersonsRefreshNonce` 는
// 마지막 소비처(생성 · 수정 핸들러의 `bumpRefresh`)가 본 슬라이스로 들어와 모듈 내부 참조가 됐으므로
// **반환 표면에서 내렸다**(T-1891 → T-1892 가 `setUsersRefreshNonce` 를 내린 선례 동형).
//
// 본 모듈은 AdminView 배럴에 추가하지 않는다 — 기존 공개 표면 무변경이 순수 추출의 전제다.
import { useCallback, useMemo, useState } from 'react';
import { useApiResource, toErrorMessage } from '../api/useApiResource';
import { request } from '../api/apiClient';
import { buildPersonsPath } from './adminResourcePathBuilders';
import {
  runCreatePerson,
  runDeletePerson,
  buildPersonPatch,
  runUpdatePerson,
} from './adminPersonMutationRunners';
import type { PersonPatchInput } from './adminPersonMutationRunners';
import type { PersonRow } from '../components/PersonList';

export function useAdminPersons(
  initialPersonsIncludeInactive: boolean,
  setSelectedIdentityPersonId: (personId: string) => void,
) {
  // 인원 재조회 nonce(T-1143) — 인원 생성 POST 성공 시 이 값을 +1 해 persons path 를 변화시켜
  // useApiResource 재조회를 유발한다(read-only hook 수정 0 경로 — providersRefreshNonce 동형).
  // nonce 0 초기 마운트는 base path 그대로다(T-1142 마운트와 동일 — 회귀 0).
  const [personsRefreshNonce, setPersonsRefreshNonce] = useState<number>(0);

  // 휴직 인원 포함 여부(T-1804) — 인원 관리 섹션의 controlled checkbox 가 소유하는 컨테이너
  // 상태(controlled lift-up). true 면 조회 path 에 `includeInactive=true` 가 실려 backend 가
  // findAll()(휴직 포함)로 분기하고, 그 목록의 기존 인라인 수정 폼(활성/휴직 <select> → PATCH)이
  // 곧 재활성(Activate) 진입점이 된다. 기본 false = 종전 활성-only 조회(회귀 0).
  const [personsIncludeInactive, setPersonsIncludeInactive] = useState<boolean>(
    initialPersonsIncludeInactive,
  );

  // 인원 목록 조회 path(T-1143 nonce, T-1804 includeInactive) — 빌더가 두 축을 함께 조립한다.
  // nonce 0 + 토글 OFF 면 base path(T-1142 마운트와 동일), 생성 성공 후 nonce 증가가 `_r` query 로
  // 재조회를 내고, 토글 변경도 path 를 바꿔 useApiResource 재조회를 낸다(두 값 모두 의존성).
  const personsPath = useMemo(
    () => buildPersonsPath(personsRefreshNonce, personsIncludeInactive),
    [personsRefreshNonce, personsIncludeInactive],
  );

  // 인원 목록 조회(T-1142, T-1143 nonce 전환) — useApiResource 로 GET /api/persons(active 인원
  // Person[])를 조회한다. 컨테이너가 인원 목록 상태를 소유하고, 그 data/loading/error 를
  // presentational PersonList 에 props 로만 내려보낸다(ADR-0041 Decision 1 — 패널은 fetch 를
  // 모른다). 변수명에 person prefix 를 붙여 그룹/멤버십/LLM 조회의 loading/error 와 섞이지 않게
  // 분리한다(T-1140 permissionDenied prefix 동형).
  const {
    data: personData,
    loading: personLoading,
    error: personError,
  } = useApiResource<PersonRow[]>(personsPath);

  // 인원 삭제 mutation in-flight 플래그(T-1144) — DELETE 진행 중 true. 진행 표시(loading 우선)와
  // 동시 재호출 가드(이전 mutation 미완 중 재호출 차단)에 함께 쓴다(deletingProvider 동형).
  const [deletingPerson, setDeletingPerson] = useState<boolean>(false);

  // 인원 삭제 mutation 실패 문구(T-1144) — DELETE 실패 시 사람-친화 문구(toErrorMessage 파생)를
  // 보관해 목록 패널의 error props 로 안전 표시한다(throw 없음). 성공/재시도 시작 시 비운다.
  const [deletePersonError, setDeletePersonError] = useState<
    string | undefined
  >(undefined);

  // onDelete 실 mutation 핸들러(T-1144) — 인원 삭제 DELETE(/api/persons/:id)를 컨테이너 내부 async
  // 로 발사한다(신규 mutation hook 미작성 — runDeleteProvider 정합). 빈/공백/falsy id·이전 mutation
  // 미완(deletingPerson) 발사 억제 + 성공(인원 재조회 트리거)/실패(error 안전 표시, throw 없음) 전이는
  // runDeletePerson 이 캡슐화한다. deletingPerson 을 deps 의존성에 포함해 stale 없이 최신 가드 상태로
  // 발사한다.
  const handleDeletePerson = useCallback(
    (id: string) =>
      runDeletePerson(id, {
        remove: request,
        describeError: toErrorMessage,
        deleting: deletingPerson,
        setDeleting: setDeletingPerson,
        setDeleteError: setDeletePersonError,
        bumpRefresh: () => setPersonsRefreshNonce((n) => n + 1),
      }),
    [deletingPerson],
  );

  // 인원 생성 2 controlled input 상태(T-1143) — 컨테이너 소유. "추가" 클릭 시 handleCreatePerson
  // 이 POST body 의 2 필드(fullName/email)로 공급하고, 성공 후 모두 빈 값으로 되돌린다(연속 생성
  // 편의). runCreateProvider 의 providerInput 패턴 mirror.
  const [fullNameInput, setFullNameInput] = useState<string>('');
  const [emailInput, setEmailInput] = useState<string>('');

  // 인원 생성 mutation in-flight 플래그(T-1143) — POST 진행 중 true. 진행 표시(입력·버튼 비활성)와
  // 동시 재호출 가드(이전 mutation 미완 중 재발사 차단)에 함께 쓴다(creatingProvider 동형).
  const [creatingPerson, setCreatingPerson] = useState<boolean>(false);

  // 인원 생성 mutation 실패 문구(T-1143) — POST 실패 시 사람-친화 문구(toErrorMessage 파생)를
  // 보관해 폼 하단에 안전 표시한다(throw 없음). 성공/재시도 시작 시 비운다.
  const [createPersonError, setCreatePersonError] = useState<
    string | undefined
  >(undefined);

  // 인원 생성 실 mutation 핸들러(T-1143) — 인원 생성 POST(/api/persons, body 2 필드)를 컨테이너
  // 내부 async 로 발사한다(handleCreateProvider 정합). 빈/공백 필드·이전 mutation 미완(creatingPerson)
  // 발사 억제 + 성공(인원 재조회 + 2 입력 초기화)/실패(error 안전 표시, throw 없음) 전이는
  // runCreatePerson 이 캡슐화한다. 2 입력값·creatingPerson 을 deps 의존성에 포함해 stale 없이 최신
  // 입력·가드 상태로 발사한다.
  const handleCreatePerson = useCallback(
    () =>
      runCreatePerson(
        {
          fullName: fullNameInput,
          email: emailInput,
        },
        {
          create: request,
          describeError: toErrorMessage,
          creating: creatingPerson,
          setCreating: setCreatingPerson,
          setCreateError: setCreatePersonError,
          bumpRefresh: () => setPersonsRefreshNonce((n) => n + 1),
          resetInput: () => {
            setFullNameInput('');
            setEmailInput('');
          },
          // 생성 직후 identity 대상 자동 선택(T-1780, REQ-079) — 방금 만든 인원에 service
          // identity 를 붙이는 동선에서 사용자가 select 를 손으로 다시 고르지 않도록, 생성 응답의
          // id 를 조회 대상 state 로 그대로 넘긴다(ADR-0058 §Follow-ups (d) 마지막 한 칸).
          // 주의: 인원 목록은 위 bumpRefresh 로 방금 재조회를 시작한 참이라, 응답이 오기 전까지는
          // <select> 에 이 id 의 option 이 아직 없어 잠깐 비어 보일 수 있다(값 자체는 유지되고
          // 재조회 완료 시 정상 표시된다 — 별도 보정 없음).
          onCreated: (personId) => setSelectedIdentityPersonId(personId),
        },
      ),
    [fullNameInput, emailInput, creatingPerson],
  );

  // 편집 대상 person id(T-1145) — null 이면 편집 안 함(인라인 수정 폼 미렌더). PersonList 각 행의
  // "수정" 버튼 클릭 시 해당 row.id 로 채우고, 성공/취소 시 null 로 되돌린다. 편집 폼 렌더 분기 기준값
  // (editingProviderId 동형).
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);

  // 인원 수정 3 controlled input 상태(T-1145) — 컨테이너 소유. "수정" 클릭 시 해당 row 의 현재 값으로
  // prefill 한다(fullName/email 은 text, active 는 boolean — <select> 활성/휴직). handleUpdatePerson 이
  // buildPersonPatch 로 변경 필드만 PATCH body 로 공급한다(editProviderInput 패턴 mirror).
  const [editFullNameInput, setEditFullNameInput] = useState<string>('');
  const [editEmailInput, setEditEmailInput] = useState<string>('');
  const [editActiveInput, setEditActiveInput] = useState<boolean>(true);

  // 편집 시작 시점의 원본 스냅샷(T-1145) — buildPersonPatch 가 현재 입력과 비교해 "변경된 필드만"
  // 파생하는 데 쓴다. "수정" 클릭 시 클릭한 row 의 현재 값으로 채우고, 편집 종료 시 기본값으로 되돌린다.
  const [editPersonOriginal, setEditPersonOriginal] = useState<PersonPatchInput>(
    { fullName: '', email: '', active: true },
  );

  // 인원 수정 mutation in-flight 플래그(T-1145) — PATCH 진행 중 true. 진행 표시(입력·버튼 비활성)와
  // 동시 재호출 가드(이전 mutation 미완 중 재발사 차단)에 함께 쓴다(updatingProvider 동형).
  const [updatingPerson, setUpdatingPerson] = useState<boolean>(false);

  // 인원 수정 mutation 실패 문구(T-1145) — PATCH 실패 시 사람-친화 문구(toErrorMessage 파생)를 보관해
  // 편집 폼 하단에 안전 표시한다(throw 없음, 생성/삭제 error 와 별도 문구). 성공/재시도/편집 시작 시 비운다.
  const [updatePersonError, setUpdatePersonError] = useState<
    string | undefined
  >(undefined);

  // 편집 폼 닫기(편집 상태 종료) helper(T-1145) — 편집 대상 id·3 입력·원본 스냅샷을 모두 기본값으로
  // 되돌린다. 성공 후 closeEdit·취소 버튼 두 경로가 공유한다(resetEditProviderForm 동형).
  const resetEditPersonForm = useCallback(() => {
    setEditingPersonId(null);
    setEditFullNameInput('');
    setEditEmailInput('');
    setEditActiveInput(true);
    setEditPersonOriginal({ fullName: '', email: '', active: true });
  }, []);

  // "수정" 버튼 클릭 핸들러(T-1145) — PersonList.onEdit 로 내려보낸다. 클릭한 row 의 현재 값으로 폼을
  // prefill 하고(personData 에서 id 매칭) 원본 스냅샷도 함께 세팅한다(변경분 파생 기준). 직전 수정
  // error 도 비워 새 편집 세션을 깨끗이 시작한다(handleEditProvider 동형).
  const handleEditPerson = useCallback(
    (id: string) => {
      const row = (personData ?? []).find((person) => person.id === id);
      const fullName = row?.fullName ?? '';
      const email = row?.email ?? '';
      const active = row?.active ?? true;
      setEditingPersonId(id);
      setEditFullNameInput(fullName);
      setEditEmailInput(email);
      setEditActiveInput(active);
      setEditPersonOriginal({ fullName, email, active });
      setUpdatePersonError(undefined);
    },
    [personData],
  );

  // 편집 취소 핸들러(T-1145) — 인라인 폼을 닫고 입력·error 를 비운다(발사 없이 편집 상태만 종료).
  // 진행 중(updatingPerson)일 때는 취소를 억제해 PATCH 완료 전 폼이 사라지지 않게 한다(버튼 disabled +
  // 핸들러 가드 이중, handleCancelEditProvider 동형).
  const handleCancelEditPerson = useCallback(() => {
    if (updatingPerson) {
      return;
    }
    resetEditPersonForm();
    setUpdatePersonError(undefined);
  }, [updatingPerson, resetEditPersonForm]);

  // 인원 수정 실 mutation 핸들러(T-1145) — 인원 수정 PATCH(/api/persons/:id, body 는 변경 필드만)를
  // 컨테이너 내부 async 로 발사한다(handleUpdateProvider 정합). buildPersonPatch 로 원본 대비 변경분만
  // 조립하고, 빈/falsy id·이전 mutation 미완(updatingPerson)·변경 필드 0 발사 억제 + 성공(인원 재조회 +
  // 편집 종료)/실패(error 안전 표시, throw 없음) 전이는 runUpdatePerson 이 캡슐화한다. 3 입력값·원본·
  // 편집 대상 id·updatingPerson 을 deps 의존성에 포함해 stale 없이 최신 입력·가드 상태로 발사한다.
  const handleUpdatePerson = useCallback(
    () =>
      runUpdatePerson(
        editingPersonId ?? '',
        buildPersonPatch(
          {
            fullName: editFullNameInput,
            email: editEmailInput,
            active: editActiveInput,
          },
          editPersonOriginal,
        ),
        {
          update: request,
          describeError: toErrorMessage,
          updating: updatingPerson,
          setUpdating: setUpdatingPerson,
          setUpdateError: setUpdatePersonError,
          bumpRefresh: () => setPersonsRefreshNonce((n) => n + 1),
          closeEdit: resetEditPersonForm,
          // 수정 직후 identity 대상 자동 선택(T-1781, REQ-079) — 방금 고친 인원에 service
          // identity 를 붙이는 동선에서 사용자가 조회 select 를 손으로 다시 고르지 않도록,
          // 수정 대상 id 를 조회 대상 state 로 그대로 넘긴다(ADR-0058 §Follow-ups (d) 잔여 한 칸,
          // 생성 축 onCreated 배선 mirror). 주의: 인원 목록은 위 bumpRefresh 로 방금 재조회를
          // 시작한 참이라, 응답이 오기 전까지는 <select> 에 이 id 의 option 이 잠깐 비어 보일 수
          // 있다(값 자체는 유지되고 재조회 완료 시 정상 표시된다 — 별도 보정 없음).
          onUpdated: (personId) => setSelectedIdentityPersonId(personId),
        },
      ),
    [
      editingPersonId,
      editFullNameInput,
      editEmailInput,
      editActiveInput,
      editPersonOriginal,
      updatingPerson,
      resetEditPersonForm,
    ],
  );

  // 반환 표면 — 잔류 소비처(AdminView 인원 관리 JSX)가 실제로 쓰는 심볼과 편집 종료 helper 만
  // 공개한다(조회 3 + 토글 2 + 삭제 3 + 생성 7 + 수정 13). 내부 전용(`personsRefreshNonce` ·
  // `personsPath` · `setPersonsRefreshNonce` · 각 in-flight/error/원본 스냅샷 setter ·
  // `setEditingPersonId`)은 의도적으로 빼 축 밖에서 이 축의 내부 상태를 건드릴 경로를 만들지 않는다.
  return {
    personData,
    personLoading,
    personError,
    personsIncludeInactive,
    setPersonsIncludeInactive,
    deletingPerson,
    deletePersonError,
    handleDeletePerson,
    fullNameInput,
    setFullNameInput,
    emailInput,
    setEmailInput,
    creatingPerson,
    createPersonError,
    handleCreatePerson,
    editingPersonId,
    editFullNameInput,
    setEditFullNameInput,
    editEmailInput,
    setEditEmailInput,
    editActiveInput,
    setEditActiveInput,
    updatingPerson,
    updatePersonError,
    resetEditPersonForm,
    handleEditPerson,
    handleCancelEditPerson,
    handleUpdatePerson,
  };
}
