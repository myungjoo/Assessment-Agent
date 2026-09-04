// AdminView LLM provider · 난이도 매핑 축 hook(T-1887) — AdminView 본문 `1177 행` ~ `1466 행` 의
// LLM 축 prelude(조회 2 + 경로·파생 5 + 합성 2 + 상태 18 + 핸들러·리셋 7 = 37 선언)를 선행 주석까지
// 본문 무변경으로 옮긴 순수 추출 모듈이다. 동작 변경 0 — 옮긴 선언의 본문 · `useMemo`/`useCallback`
// deps 배열 · 러너 주입 키가 이동 전과 한 글자도 다르지 않고, 새로 쓴 것은 함수 시그니처와 반환
// literal 뿐이다.
//
// 외부 의존(러너 4 종 · 조회 hook · 경로 빌더 2 · 파생 helper 4 · 문구 helper · 타입)은 전부 모듈
// 최상위 import 로 해결하므로 hook 은 **주입 파라미터를 받지 않는다**(T-1884 의
// `initialImportConfirmText` 같은 props 유래 초기값이 본 축에는 0 건임을 사전 실측했다).
//
// 반환은 JSX LLM 패널 구역이 실제로 쓰는 36 심볼만 공개한다(task 본문이 열거한 심볼 목록
// 전부 — 본문의 '35' 는 계수 오차이고 열거 자체는 36 개다) — `providersRefreshNonce` ·
// `providerData` · `mappingData` · `mappingsLoading` · `mappingsError` · `providersPath` ·
// `mappingsPath` · `refreshNonce` · `optimisticMapping` · `assigning` · `assignError` ·
// `resetEditProviderForm` 와 나머지 내부 setter 는 노출하지 않는다(캡슐화 — 축 밖에서 이 축의
// 내부 상태를 직접 갱신할 경로를 만들지 않는다, T-1884/T-1886 선례 승계).
//
// 본 모듈은 AdminView 배럴에 추가하지 않는다 — 기존 공개 표면 무변경이 순수 추출의 전제다.
import { useCallback, useMemo, useState } from 'react';
import { useApiResource, toErrorMessage } from '../api/useApiResource';
import { request } from '../api/apiClient';
import type { Difficulty } from '../components/DifficultyModelSelector';
import {
  deriveDifficultyMapping,
  deriveProviderConfigs,
  deriveProviders,
  mergeMapping,
} from './adminProviderDifficultyDerivations';
import type {
  DifficultyMappingRow,
  LlmProviderRow,
} from './adminProviderDifficultyDerivations';
import {
  runAssign,
  runCreateProvider,
  runDeleteProvider,
  runUpdateProvider,
} from './adminLlmProviderMutationRunners';
import {
  buildMappingsPath,
  buildProvidersPath,
} from './adminResourcePathBuilders';

export function useAdminLlmProviders() {
  // provider 재조회 nonce(T-1135) — LlmProviderConfigList.onDelete DELETE 성공 시 이 값을 +1 해
  // providers path 를 변화시켜 useApiResource 재조회를 유발한다(read-only hook 수정 0 경로 —
  // buildMappingsPath/membersRefreshNonce 동형). nonce 0 초기 마운트는 base path 그대로다.
  const [providersRefreshNonce, setProvidersRefreshNonce] = useState<number>(0);

  // provider 목록 조회 path(T-1135) — nonce-aware 빌더로 전환(buildProvidersPath). nonce 0 이면
  // base path(T-1134 마운트와 동일), 삭제 성공 후 nonce 증가가 `_r` query 로 재조회를 낸다.
  const providersPath = useMemo(
    () => buildProvidersPath(providersRefreshNonce),
    [providersRefreshNonce],
  );

  // LLM provider 목록 조회(④b 두 번째 패널) — useApiResource 추가 호출(④a 의 그룹 조회 +
  // 본 slice 두 번 = 총 세 번). loading/error 는 컨테이너가 받아 DifficultyModelSelector 의
  // props 로 내려보낸다(Decision 1 — 패널은 fetch 를 모른다). Admin+ 라 User 는 403→error.
  const {
    data: providerData,
    loading: providersLoading,
    error: providersError,
  } = useApiResource<LlmProviderRow[]>(providersPath);

  // provider 삭제 mutation in-flight 플래그(T-1135) — DELETE 진행 중 true. 진행 표시(loading 우선)와
  // 동시 재호출 가드(이전 mutation 미완 중 재호출 차단)에 함께 쓴다(remove removing 동형).
  const [deletingProvider, setDeletingProvider] = useState<boolean>(false);

  // provider 삭제 mutation 실패 문구(T-1135) — DELETE 실패 시 사람-친화 문구(toErrorMessage 파생)를
  // 보관해 목록 패널의 error props 로 안전 표시한다(throw 없음). 성공/재시도 시작 시 비운다.
  const [deleteProviderError, setDeleteProviderError] = useState<
    string | undefined
  >(undefined);

  // onDelete 실 mutation 핸들러(T-1135) — provider 삭제 DELETE(/api/llm/providers/:id)를 컨테이너
  // 내부 async 로 발사한다(신규 mutation hook 미작성 — runRemove 정합). 빈/공백/falsy id·이전
  // mutation 미완(deletingProvider) 발사 억제 + 성공(provider 재조회 트리거)/실패(error 안전 표시,
  // throw 없음) 전이는 runDeleteProvider 가 캡슐화한다. deletingProvider 를 deps 의존성에 포함해
  // stale 없이 최신 가드 상태로 발사한다.
  const handleDeleteProvider = useCallback(
    (id: string) =>
      runDeleteProvider(id, {
        remove: request,
        describeError: toErrorMessage,
        deleting: deletingProvider,
        setDeleting: setDeletingProvider,
        setDeleteError: setDeleteProviderError,
        bumpRefresh: () => setProvidersRefreshNonce((n) => n + 1),
      }),
    [deletingProvider],
  );

  // provider 생성 4 controlled input 상태(T-1136) — 컨테이너 소유. "추가" 클릭 시
  // handleCreateProvider 가 POST body 의 4 필드로 공급하고, 성공 후 모두 빈 값으로 되돌린다
  // (연속 생성 편의 + secret apiKey 잔존 방지). runCreatePerson 의 입력 초기화 패턴 mirror.
  const [providerInput, setProviderInput] = useState<string>('');
  const [endpointUrlInput, setEndpointUrlInput] = useState<string>('');
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [modelIdInput, setModelIdInput] = useState<string>('');

  // provider 생성 mutation in-flight 플래그(T-1136) — POST 진행 중 true. 진행 표시(입력·버튼
  // 비활성)와 동시 재호출 가드(이전 mutation 미완 중 재발사 차단)에 함께 쓴다(adding 동형).
  const [creatingProvider, setCreatingProvider] = useState<boolean>(false);

  // provider 생성 mutation 실패 문구(T-1136) — POST 실패 시 사람-친화 문구(toErrorMessage 파생)를
  // 보관해 폼 하단에 안전 표시한다(throw 없음, 삭제 error 와 별도 문구). 성공/재시도 시작 시 비운다.
  const [createProviderError, setCreateProviderError] = useState<
    string | undefined
  >(undefined);

  // provider 생성 실 mutation 핸들러(T-1136) — provider 생성 POST(/api/llm/providers, body 4 필드)를
  // 컨테이너 내부 async 로 발사한다(handleAdd 정합). 빈/공백 필드·이전 mutation 미완(creatingProvider)
  // 발사 억제 + 성공(provider 재조회 + 4 입력 초기화)/실패(error 안전 표시, throw 없음) 전이는
  // runCreateProvider 가 캡슐화한다. 4 입력값·creatingProvider 를 deps 의존성에 포함해 stale 없이
  // 최신 입력·가드 상태로 발사한다. 재조회는 기존 setProvidersRefreshNonce 를 재사용한다(신규 nonce 0).
  const handleCreateProvider = useCallback(
    () =>
      runCreateProvider(
        {
          provider: providerInput,
          endpointUrl: endpointUrlInput,
          apiKey: apiKeyInput,
          modelId: modelIdInput,
        },
        {
          create: request,
          describeError: toErrorMessage,
          creating: creatingProvider,
          setCreating: setCreatingProvider,
          setCreateError: setCreateProviderError,
          bumpRefresh: () => setProvidersRefreshNonce((n) => n + 1),
          resetInput: () => {
            setProviderInput('');
            setEndpointUrlInput('');
            setApiKeyInput('');
            setModelIdInput('');
          },
        },
      ),
    [
      providerInput,
      endpointUrlInput,
      apiKeyInput,
      modelIdInput,
      creatingProvider,
    ],
  );

  // 재조회 nonce(④c) — DifficultyModelSelector.onAssign PATCH 성공 시 이 값을 +1 해
  // mappings path 를 변화시켜 useApiResource 재조회를 유발한다(read-only hook 수정 0 경로).
  const [refreshNonce, setRefreshNonce] = useState<number>(0);

  // 낙관적 override(④c) — PATCH 발사 직후 재조회 도착 전까지 재지정 슬롯을 즉시 반영한다.
  // 성공 후 재조회 트리거와 함께 비우고(권위 데이터로 대체), 실패 시 롤백(비움)한다.
  const [optimisticMapping, setOptimisticMapping] = useState<
    Partial<Record<Difficulty, string | null>>
  >({});

  // mutation in-flight 플래그(④c) — PATCH 진행 중 true. 진행 표시(loading 우선)와 동시 재호출
  // 가드(이전 mutation 미완 중 재호출 차단)에 함께 쓴다.
  const [assigning, setAssigning] = useState<boolean>(false);

  // mutation 실패 문구(④c) — PATCH 실패 시 사람-친화 문구(toErrorMessage 파생)를 보관해
  // error props 로 안전 표시한다(throw 없음). 성공/재시도 시작 시 비운다.
  const [assignError, setAssignError] = useState<string | undefined>(undefined);

  // 난이도 슬롯 매핑 조회(④b) — provider 와 같은 thin fetch hook 으로 추가 조회한다. path 는
  // refreshNonce 를 cache-busting query 로 실어(④c) PATCH 성공 시 nonce 증가가 재조회를 낸다.
  const mappingsPath = useMemo(
    () => buildMappingsPath(refreshNonce),
    [refreshNonce],
  );
  const {
    data: mappingData,
    loading: mappingsLoading,
    error: mappingsError,
  } = useApiResource<DifficultyMappingRow[]>(mappingsPath);

  // provider 응답 → ProviderOption[] 파생(순수 helper). data 미도착이면 빈 배열(빈 상태).
  const providers = useMemo(
    () => deriveProviders(providerData),
    [providerData],
  );

  // provider 응답 → LlmProviderConfigList 의 읽기 전용 view 파생(T-1134). 같은 providerData 를
  // 재사용해(새 fetch 0) sanitized LlmProviderConfigRow[] 로 매핑, props 로만 내려보낸다.
  const providerConfigs = useMemo(
    () => deriveProviderConfigs(providerData),
    [providerData],
  );

  // 편집 대상 provider id(T-1137) — null 이면 편집 안 함(인라인 수정 폼 미렌더). "수정" 버튼
  // 클릭 시 해당 row.id 로 채우고, 성공/취소 시 null 로 되돌린다. 편집 폼 렌더 분기의 기준값.
  const [editingProviderId, setEditingProviderId] = useState<string | null>(
    null,
  );

  // provider 수정 4 controlled input 상태(T-1137) — 컨테이너 소유. "수정" 클릭 시 해당 row 의
  // 현재 값으로 prefill 하되, apiKey 는 read never-back 이라 빈 값으로 시작한다(placeholder 로
  // "변경 시에만 입력" 안내). handleUpdateProvider 가 PATCH body 의 변경 필드로 공급한다.
  const [editProviderInput, setEditProviderInput] = useState<string>('');
  const [editEndpointUrlInput, setEditEndpointUrlInput] = useState<string>('');
  const [editApiKeyInput, setEditApiKeyInput] = useState<string>('');
  const [editModelIdInput, setEditModelIdInput] = useState<string>('');

  // provider 수정 mutation in-flight 플래그(T-1137) — PATCH 진행 중 true. 진행 표시(입력·버튼
  // 비활성)와 동시 재호출 가드(이전 mutation 미완 중 재발사 차단)에 함께 쓴다(creatingProvider 동형).
  const [updatingProvider, setUpdatingProvider] = useState<boolean>(false);

  // provider 수정 mutation 실패 문구(T-1137) — PATCH 실패 시 사람-친화 문구(toErrorMessage 파생)를
  // 보관해 편집 폼 하단에 안전 표시한다(throw 없음, 삭제/생성 error 와 별도 문구). 성공/재시도/편집
  // 시작 시 비운다.
  const [updateProviderError, setUpdateProviderError] = useState<
    string | undefined
  >(undefined);

  // 편집 폼 닫기(편집 상태 종료) helper(T-1137) — 편집 대상 id·4 입력을 모두 비운다(secret apiKey
  // 잔존 방지). 성공 후 closeEdit·취소 버튼 두 경로가 공유한다.
  const resetEditProviderForm = useCallback(() => {
    setEditingProviderId(null);
    setEditProviderInput('');
    setEditEndpointUrlInput('');
    setEditApiKeyInput('');
    setEditModelIdInput('');
  }, []);

  // "수정" 버튼 클릭 핸들러(T-1137) — LlmProviderConfigList.onEdit 로 내려보낸다. 클릭한 row 의
  // 현재 값으로 폼을 prefill 하되(providerConfigs 에서 id 매칭), apiKey 는 read never-back 이라
  // 빈 값으로 시작한다(placeholder 안내). 직전 수정 error 도 비워 새 편집 세션을 깨끗이 시작한다.
  const handleEditProvider = useCallback(
    (id: string) => {
      const row = providerConfigs.find((config) => config.id === id);
      setEditingProviderId(id);
      setEditProviderInput(row?.provider ?? '');
      setEditEndpointUrlInput(row?.endpointUrl ?? '');
      // apiKey 는 목록에 미노출(read never-back)이라 현재 값을 알 수 없으므로 빈 값으로 시작한다.
      setEditApiKeyInput('');
      setEditModelIdInput(row?.modelId ?? '');
      setUpdateProviderError(undefined);
    },
    [providerConfigs],
  );

  // 편집 취소 핸들러(T-1137) — 인라인 폼을 닫고 입력·error 를 비운다(발사 없이 편집 상태만 종료).
  // 진행 중(updatingProvider)일 때는 취소를 억제해 PATCH 완료 전 폼이 사라지지 않게 한다(가드는
  // 버튼 disabled + 핸들러 가드 이중).
  const handleCancelEditProvider = useCallback(() => {
    if (updatingProvider) {
      return;
    }
    resetEditProviderForm();
    setUpdateProviderError(undefined);
  }, [updatingProvider, resetEditProviderForm]);

  // provider 수정 실 mutation 핸들러(T-1137) — provider 수정 PATCH(/api/llm/providers/:id, body 는
  // 변경 필드만)를 컨테이너 내부 async 로 발사한다(handleCreateProvider 정합). 빈/falsy id·이전
  // mutation 미완(updatingProvider)·변경 필드 0 발사 억제 + 성공(provider 재조회 + 편집 종료)/실패
  // (error 안전 표시, throw 없음) 전이는 runUpdateProvider 가 캡슐화한다. 4 입력값·편집 대상 id·
  // updatingProvider 를 deps 의존성에 포함해 stale 없이 최신 입력·가드 상태로 발사한다. 재조회는
  // 기존 setProvidersRefreshNonce 를 재사용한다(신규 nonce 0).
  const handleUpdateProvider = useCallback(
    () =>
      runUpdateProvider(
        {
          provider: editProviderInput,
          endpointUrl: editEndpointUrlInput,
          apiKey: editApiKeyInput,
          modelId: editModelIdInput,
        },
        {
          update: request,
          describeError: toErrorMessage,
          id: editingProviderId ?? '',
          updating: updatingProvider,
          setUpdating: setUpdatingProvider,
          setUpdateError: setUpdateProviderError,
          bumpRefresh: () => setProvidersRefreshNonce((n) => n + 1),
          closeEdit: resetEditProviderForm,
        },
      ),
    [
      editProviderInput,
      editEndpointUrlInput,
      editApiKeyInput,
      editModelIdInput,
      editingProviderId,
      updatingProvider,
      resetEditProviderForm,
    ],
  );

  // 난이도 매핑 응답 → Record<Difficulty, string | null> 파생 + 낙관적 override 병합(④c).
  // 서버 권위 매핑 위에 진행 중인 재지정 슬롯을 즉시 덮어, 재조회 도착 전에도 새 provider 가
  // DifficultyModelSelector 의 mapping props 로 내려가도록 한다(낙관 반영). override 가 비면
  // 서버 매핑 그대로다(merge 결과는 base 와 동일한 새 객체).
  const difficultyMapping = useMemo(
    () => mergeMapping(deriveDifficultyMapping(mappingData), optimisticMapping),
    [mappingData, optimisticMapping],
  );

  // loading 합성 — 두 LLM 읽기 조회 또는 mutation(assigning) 중 하나라도 진행 중이면 true.
  // mutation in-flight 도 loading 우선으로 표시해(④c) 패널이 진행 중을 노출한다(ADR-0041
  // Decision 1 경계 — 읽기 loading 과 mutation loading 을 패널 단일 loading props 로 합성).
  const llmLoading = providersLoading || mappingsLoading || assigning;

  // error 합성 — mutation 실패(assignError)를 최우선 노출한다(④c — 방금 사용자가 한 재지정의
  // 실패가 가장 최신·근본적 피드백). 없으면 provider 조회 error, 없으면 mapping 조회 error.
  // 둘 다 없으면 undefined. Admin+ 미만 403 도 이 경로로 error props 안전 표시(throw 없음).
  const llmError = assignError ?? providersError ?? mappingsError;

  // onAssign 실 mutation 핸들러(④c) — 슬롯 재지정 PATCH(/api/llm/difficulty-mappings/:difficulty)
  // 를 컨테이너 내부 async 로 발사한다(신규 mutation hook 미작성 — cap·범위 정합). 동작:
  //  1) 빈/비정상 providerId 면 미발사(잘못된 body 전송 회피).
  //  2) 이전 mutation 미완(assigning) 중 재호출이면 미발사(이중 호출·state 깨짐 차단).
  //  3) 낙관 반영(슬롯 즉시 새 provider) + 진행 표시 on + 이전 error 비움.
  //  4) PATCH 성공 → refreshNonce +1(권위 재조회 트리거) + 낙관 override 비움(권위 데이터로 대체).
  //  5) PATCH 실패 → 낙관 override 롤백(비움) + toErrorMessage 문구를 error props 로 안전 표시
  //     (throw 없음 — 미지원 난이도 400 / config·슬롯 부재 404 / Admin+ 미만 403 / 네트워크 0 모두).
  //  6) 마지막에 진행 표시 off(성공·실패 공통).
  const handleAssign = useCallback(
    (difficulty: Difficulty, providerId: string) =>
      runAssign(difficulty, providerId, {
        patch: request,
        describeError: toErrorMessage,
        assigning,
        setAssigning,
        setAssignError,
        setOptimistic: setOptimisticMapping,
        bumpRefresh: () => setRefreshNonce((n) => n + 1),
      }),
    [assigning],
  );

  // 반환 표면 — JSX LLM 패널 구역(provider 목록 · 생성 폼 · 인라인 편집 폼 · 난이도 슬롯 선택기)이
  // 실제로 소비하는 36 심볼만 공개한다. 내부 전용(원본 응답 2 · 재조회 nonce 2 · 경로 2 · 낙관 override ·
  // mapping 조회 loading/error · assign in-flight/실패 문구 · 편집 폼 리셋 helper · 나머지 setter)은
  // 의도적으로 빼 축 밖에서 이 축의 내부 상태를 건드릴 경로를 만들지 않는다.
  return {
    providers,
    providerConfigs,
    providersLoading,
    providersError,
    deletingProvider,
    deleteProviderError,
    handleDeleteProvider,
    providerInput,
    setProviderInput,
    endpointUrlInput,
    setEndpointUrlInput,
    apiKeyInput,
    setApiKeyInput,
    modelIdInput,
    setModelIdInput,
    creatingProvider,
    createProviderError,
    handleCreateProvider,
    editingProviderId,
    editProviderInput,
    setEditProviderInput,
    editEndpointUrlInput,
    setEditEndpointUrlInput,
    editApiKeyInput,
    setEditApiKeyInput,
    editModelIdInput,
    setEditModelIdInput,
    updatingProvider,
    updateProviderError,
    handleEditProvider,
    handleCancelEditProvider,
    handleUpdateProvider,
    difficultyMapping,
    llmLoading,
    llmError,
    handleAssign,
  };
}
