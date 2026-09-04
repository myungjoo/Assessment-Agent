// AdminView 인원 축 hook(T-1894 순수 추출 슬라이스 ①) — AdminView 본문에 있던 인원 축 4 조각 중
// **조회 · 삭제 2 조각**을 선행 주석까지 본문 무변경으로 옮긴 모듈이다. 이동 전 좌표로 (A)
// `476 행` ~ `506 행`(재조회 nonce state · 휴직 포함 토글 state · nonce + 토글 aware `personsPath`
// useMemo · `useApiResource<PersonRow[]>` 목록 조회), (B) `627 행` ~ `653 행`(삭제 in-flight 1 상태 ·
// 실패 문구 1 상태 · `handleDeletePerson`) 합 58 줄이다. 동작 변경 0 — 옮긴 선언의 본문 ·
// `useMemo`/`useCallback` deps 배열 · `runDeletePerson` 주입 키 6 개가 이동 전과 한 글자도 다르지
// 않고, 새로 쓴 것은 함수 시그니처와 반환 literal 뿐이다.
//
// 파라미터는 props 유래 초기값 `initialPersonsIncludeInactive` 하나다(useAdminParts 의 파라미터 1 개
// 시그니처 동형). 이 축이 참조하는 나머지 외부 값(조회 hook · api 발사 primitive · 경로 빌더 ·
// 삭제 러너 · `PersonRow` 타입)은 전부 모듈 최상위 import 로 해결되고, 축 밖 상태에 의존하는
// 지점은 0 이다.
//
// 반환은 잔류 소비처가 실제로 쓰는 것만 공개하고 내부 값(`personsPath` · `personsRefreshNonce` ·
// `setDeletingPerson` · `setDeletePersonError`)은 노출하지 않는다(캡슐화 —
// T-1884/T-1886/T-1887/T-1888/T-1889/T-1891/T-1892/T-1893 선례 승계). 단 `setPersonsRefreshNonce`
// 는 **한시적으로 노출**한다 — 아직 AdminView 에 남아 있는 인원 생성 · 수정 핸들러가
// `bumpRefresh: () => setPersonsRefreshNonce((n) => n + 1)` 로 이 축의 재조회를 트리거하기
// 때문이다. 후속 슬라이스가 생성 · 수정 조각을 같은 모듈로 합류시키면 그 소비처가 모듈 내부
// 참조가 되므로 반환 표면에서 내린다(T-1891 이 `setUsersRefreshNonce` 를 한시 노출했다가 T-1892
// 합류 때 내린 선례 동형).
//
// 본 모듈은 AdminView 배럴에 추가하지 않는다 — 기존 공개 표면 무변경이 순수 추출의 전제다.
import { useCallback, useMemo, useState } from 'react';
import { useApiResource, toErrorMessage } from '../api/useApiResource';
import { request } from '../api/apiClient';
import { buildPersonsPath } from './adminResourcePathBuilders';
import { runDeletePerson } from './adminPersonMutationRunners';
import type { PersonRow } from '../components/PersonList';

export function useAdminPersons(initialPersonsIncludeInactive: boolean) {
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

  // 반환 표면 — 잔류 소비처가 실제로 쓰는 9 심볼(조회 축 3 + 토글 축 2 + 삭제 축 3 + 한시적
  // `setPersonsRefreshNonce` 1). 내부 전용(`personsRefreshNonce` · `personsPath` ·
  // `setDeletingPerson` · `setDeletePersonError`)은 의도적으로 빼 축 밖에서 이 축의 내부 상태를
  // 건드릴 경로를 만들지 않는다.
  return {
    personData,
    personLoading,
    personError,
    personsIncludeInactive,
    setPersonsIncludeInactive,
    deletingPerson,
    deletePersonError,
    handleDeletePerson,
    setPersonsRefreshNonce,
  };
}
