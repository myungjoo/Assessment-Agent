// AdminView 멤버십 축 hook(T-1896 순수 추출 슬라이스) — AdminView 본문 `736 행` ~ `841 행` 의
// 멤버십 축 한 덩어리(106 줄, 12 선언)를 선행 주석까지 본문 무변경으로 옮긴 모듈이다. 이동 대상은
// `members` client-side 파생 · `membersRefreshNonce` · `removing` · `removeError` ·
// `groupMembersPath` useMemo · `useApiResource<MembershipRow[]>` 조회 · `groupMembers` 파생 ·
// `handleRemove` · `adding` · `addError` · `handleAdd` · `addCandidates` 이고, 동작 변경은 0 이다 —
// 옮긴 선언의 본문 · 모든 `useMemo`/`useCallback` deps 배열 · `runRemove`/`runAdd` 주입 키가 이동
// 전과 한 글자도 다르지 않고, 새로 쓴 것은 함수 시그니처와 반환 object literal 뿐이다.
//
// 파라미터는 축 밖 의존 3 개(`groups` · `selectedGroupId` · `personData`)를 **단일 object 로** 받는다.
// 위치 인자 대신 object 를 고른 이유는 세 값이 모두 "그룹 축 · 인원 축이 이미 만들어 둔 조회 결과"
// 라 순서에 의미가 없고 타입도 배열 · 문자열 · 배열로 서로 섞이기 쉬워, 호출부에서 키 이름이 그대로
// 보이는 편이 배선 사고(값 뒤바뀜)를 막기 때문이다. 그 밖의 값은 받지 않는다 — 축 밖 setter 호출이
// 0 건이라 `useAdminPersons` 가 받은 것 같은 외부 setter 파라미터가 본 축에는 필요 없다.
//
// 호출 위치 제약: AdminView 는 본 hook 을 **이동 전 블록 자리**(그룹 `groups` 파생 직후, LLM
// provider 축 hook 앞)에서 호출해야 한다. 반환 `members` 를 `useAdminSchedule` 이 소비하고,
// `useApiResource` 발사 순번으로 route 를 구분하는 기존 spec 이 있어 순번이 바뀌면 회귀가 난다.
//
// 반환은 잔류 소비처(GroupMemberList 배선 · `useAdminSchedule` 의 `members` 주입)가 실제로 쓰는 11
// 심볼만 공개하고 내부 값(`membershipData` 원본 응답 · `groupMembersPath` · `membersRefreshNonce` ·
// 각 축의 state setter)은 노출하지 않는다(캡슐화 — T-1884 ~ T-1895 선례 승계). 재조회 nonce 의
// 유일한 소비처인 `bumpRefresh` 두 자리가 함께 들어왔으므로 setter 를 한시 노출할 이유도 없다.
// 11 심볼 중 `adding` 만은 현 JSX 가 아직 배선하지 않은 읽기 전용 in-flight 플래그다 — 짝인
// `removing` 이 GroupMemberList 의 loading 합성에 쓰이는 것과 대칭을 맞춰 표면에 남기되(추가 진행
// 표시 배선은 별도 슬라이스), 컨테이너는 destructure 하지 않아 미사용 경고를 만들지 않는다.
//
// 본 모듈은 AdminView 배럴에 추가하지 않는다 — 기존 공개 표면 무변경이 순수 추출의 전제다.
import { useCallback, useMemo, useState } from 'react';
import { useApiResource, toErrorMessage } from '../api/useApiResource';
import { request } from '../api/apiClient';
import { runAdd, runRemove } from './adminMembershipRunners';
import {
  buildGroupMembersPath,
  deriveAddCandidates,
  deriveMembers,
  deriveMembersFromMemberships,
  findGroup,
} from './adminMembershipDerivations';
import type { GroupRow, MembershipRow } from './adminMembershipDerivations';
import type { PersonRow } from '../components/PersonList';

// 축 밖 의존 3 개 — 그룹 축이 만든 목록 파생 · 선택 그룹 state, 인원 축(useAdminPersons)이 돌려준
// 인원 목록 응답. 셋 다 읽기 전용으로만 쓰인다(본 축은 축 밖 setter 를 호출하지 않는다).
export interface UseAdminMembershipsParams {
  groups: GroupRow[];
  selectedGroupId: string;
  personData: PersonRow[] | undefined;
}

export function useAdminMemberships({
  groups,
  selectedGroupId,
  personData,
}: UseAdminMembershipsParams) {
  // 선택 그룹의 멤버 파생(client-side, id = personId) — T-1129 부터 GroupMemberList 는 아래 신
  // endpoint fetch 결과(groupMembers, id = membershipId)를 쓰므로, 본 client-side 파생은 재평가
  // 인원 선택 <select> 의 personOptions 전용으로 남는다(재평가 POST 는 personId 를 path param 으로
  // 쓰므로 membershipId 부적합). 미선택/미발견/멤버 미포함이면 빈 배열.
  const members = useMemo(
    () => deriveMembers(groups, selectedGroupId || undefined),
    [groups, selectedGroupId],
  );

  // 멤버십 재조회 nonce(T-1130) — ④c remove DELETE 성공 시 이 값을 +1 해 groupMembersPath 를
  // 변화시켜 useApiResource 재조회를 유발한다(read-only hook 수정 0 경로 — buildMappingsPath 동형).
  const [membersRefreshNonce, setMembersRefreshNonce] = useState<number>(0);

  // remove mutation in-flight 플래그(T-1130) — DELETE 진행 중 true. 진행 표시(loading 우선)와
  // 동시 재호출 가드(이전 mutation 미완 중 재호출 차단)에 함께 쓴다(④c assigning 동형).
  const [removing, setRemoving] = useState<boolean>(false);

  // remove mutation 실패 문구(T-1130) — DELETE 실패 시 사람-친화 문구(toErrorMessage 파생)를
  // 보관해 error props 로 안전 표시한다(throw 없음). 성공/재시도 시작 시 비운다(④c assignError 동형).
  const [removeError, setRemoveError] = useState<string | undefined>(undefined);

  // 선택 그룹의 멤버십 조회 path(T-1129 → T-1130 nonce) — 선택이 있을 때만 조건부 path 를 만든다
  // (미선택 시 null → useApiResource 미조회 idle). 선택 변경 시 path 가 달라져 자동 refetch
  // (path-change refetch)하고, remove 성공 시 membersRefreshNonce 증가가 `_r` query 로 재조회를 낸다.
  const groupMembersPath = useMemo(
    () => buildGroupMembersPath(selectedGroupId || undefined, membersRefreshNonce),
    [selectedGroupId, membersRefreshNonce],
  );

  // 선택 그룹의 멤버십 조회(T-1129) — useApiResource 로 신 endpoint(GET /api/groups/:id/members,
  // T-1128 findMembershipsByGroupId)를 조건부 fetch 한다. loading/error 는 컨테이너가 받아
  // GroupMemberList 의 대응 props 로 내려보낸다(ADR-0041 Decision 1 — 패널은 fetch 를 모른다).
  const {
    data: membershipData,
    loading: membersLoading,
    error: membersError,
  } = useApiResource<MembershipRow[]>(groupMembersPath);

  // 멤버십 응답 → GroupMemberList 의 Member[] 파생(T-1129) — 각 Member.id 를 membershipId 로
  // 설정하고, 표시명은 선택 그룹 응답의 person(personId 매칭)에서 채운다. 미선택/미도착/비정상이면 빈 배열.
  const groupMembers = useMemo(
    () =>
      deriveMembersFromMemberships(
        membershipData,
        findGroup(groups, selectedGroupId || undefined),
      ),
    [membershipData, groups, selectedGroupId],
  );

  // onRemove 실 mutation 핸들러(T-1130) — 멤버 제거 DELETE(/api/groups/:id/members/:membershipId)
  // 를 컨테이너 내부 async 로 발사한다(신규 mutation hook 미작성 — ④c runAssign 정합). 빈/falsy
  // membershipId·이전 mutation 미완(removing) 발사 억제 + 성공(멤버십 재조회 트리거)/실패(error props
  // 안전 표시, throw 없음) 전이는 runRemove 가 캡슐화한다. selectedGroupId(DELETE path param)·removing
  // 을 deps 의존성에 포함해 stale 없이 최신 그룹·가드 상태로 발사한다.
  const handleRemove = useCallback(
    (membershipId: string) =>
      runRemove(membershipId, {
        remove: request,
        describeError: toErrorMessage,
        groupId: selectedGroupId,
        removing,
        setRemoving,
        setRemoveError,
        bumpRefresh: () => setMembersRefreshNonce((n) => n + 1),
      }),
    [selectedGroupId, removing],
  );

  // add mutation in-flight 플래그(T-1131) — POST 진행 중 true. 동시 재호출 가드(이전 mutation 미완
  // 중 재발사 차단 — 이중 POST 방지)에 쓴다(remove removing 동형). T-1238: 후보 select 가 컴포넌트
  // 로컬 state 로 이동해 컨테이너는 입력값을 더 이상 보유하지 않고, 이 플래그만 남아 in-flight 가드를 한다.
  const [adding, setAdding] = useState<boolean>(false);

  // add mutation 실패 문구(T-1131) — POST 실패 시 사람-친화 문구(toErrorMessage 파생)를 보관해
  // GroupMemberList 근처에 안전 표시한다(throw 없음). 성공/재시도 시작 시 비운다(remove removeError 동형).
  const [addError, setAddError] = useState<string | undefined>(undefined);

  // 멤버 추가 실 mutation 핸들러(T-1131 → T-1238 컨테이너 배선) — GroupMemberList 의 onAdd 콜백으로
  // 넘어가 선택된 후보의 personId 를 인자로 받아 멤버 추가 POST(/api/groups/:id/members, body
  // `{ personId }`)를 발사한다(handleRemove 정합). 빈/공백 personId·그룹 미선택·이전 mutation 미완
  // (adding) 발사 억제 + 성공(멤버십 재조회)/실패(error 안전 표시, throw 없음) 전이는 runAdd 가
  // 캡슐화한다. selectedGroupId(POST path param)·adding 을 deps 에 포함해 stale 없이 최신 그룹·가드
  // 상태로 발사한다. 후보 선택값은 컴포넌트 로컬 state 라 resetInput 은 무해화(no-op — 컨테이너 미보유).
  const handleAdd = useCallback(
    (personId: string) =>
      runAdd(personId, {
        add: request,
        describeError: toErrorMessage,
        groupId: selectedGroupId,
        adding,
        setAdding,
        setAddError,
        bumpRefresh: () => setMembersRefreshNonce((n) => n + 1),
        resetInput: () => {},
      }),
    [selectedGroupId, adding],
  );

  // 추가 후보(persons − 현재 멤버) 파생(T-1238) — deriveAddCandidates 로 전체 인원에서 현재 그룹
  // 멤버(membershipData 의 personId)를 제외한 Member[](id = personId)를 만든다. GroupMemberList 의
  // addCandidates prop 으로 내려보내 컴포넌트의 select 옵션이 된다(정렬/검색은 Out of Scope). deps 에
  // selectedGroupId 를 포함해(membershipData 는 이미 그룹별이지만) 그룹 전환 시 파생을 명시적으로 재평가한다.
  const addCandidates = useMemo(
    () => deriveAddCandidates(personData, membershipData),
    [personData, membershipData, selectedGroupId],
  );

  // 반환 표면 — 잔류 소비처가 실제로 쓰는 11 심볼만 공개한다. 원본 응답(`membershipData`) · 조회
  // path(`groupMembersPath`) · 재조회 nonce 와 각 setter 는 의도적으로 빼 축 밖에서 이 축의 내부
  // 상태를 건드릴 경로를 만들지 않는다(캡슐화).
  return {
    members,
    groupMembers,
    membersLoading,
    membersError,
    removing,
    removeError,
    handleRemove,
    adding,
    addError,
    handleAdd,
    addCandidates,
  };
}
