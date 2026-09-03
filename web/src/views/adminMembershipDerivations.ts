// AdminView 의 그룹 멤버십 파생 helper 축을 담는 모듈 — T-1876 순수 추출.
// AdminView.tsx 가 4,072 줄로 남아있는 god component 부채(PLAN 183 행)를 갚는 열셋째 실분할이며,
// 직전 T-1874 가 옮긴 멤버십 mutation 러너(adminMembershipRunners.ts)의 **짝인 순수 파생 축** 이다.
// 본 모듈의 심볼은 AdminView 에서 **본문 한 줄도 바꾸지 않고** 옮겨온 것이다(동작 · 계약 · spec
// 무변경 — 선언 앞 export 키워드만 붙였다). 각 선언 위의 주석 블록은 그 helper 가 지키는 안전
// fallback 계약의 근거 정본이라 함께 옮겼다. 이동 대상은 AdminView 의 연속 블록 두 조각 —
// helper 5(588 행 ~ 715 행: findGroup · deriveMembers · buildGroupMembersPath ·
// deriveMembersFromMemberships · deriveAddCandidates)와 그것이 쓰는 row 타입 3(477 행 ~ 510 행:
// GroupMemberRow · GroupRow · MembershipRow) · 상수 1(472 행 ~ 473 행: FALLBACK_MEMBER_NAME) 이다.
// 상수는 이동 전에도 AdminView 배럴에 없던 모듈-private 심볼이라 여기서도 export 하지 않는다.
//
// 배치를 web/src/views/ 아래로 잡은 이유는 이동 블록이 전부 순수 함수라 남는 외부 의존이 표시용
// 타입 Member · PersonRow 둘뿐이기 때문이다. JSX 가 없으므로 확장자는 .ts 다
// (adminMembershipRunners · adminScheduleRunners · adminUserMutationRunners 선례 동형).
//
// AdminView 와의 방향: AdminView → 본 모듈(값 · 타입 의존) 의 **단방향** import 만 만든다. 본 모듈은
// AdminView 를 import 하지 않는다(역방향이 필요해지면 이동 범위를 잘못 잡았다는 신호 — 범위를 넓히지
// 말고 Follow-ups 로 남긴다). AdminView 파일 끝 export 배럴이 임포트한 값 5 개(findGroup ·
// deriveMembers · buildGroupMembersPath · deriveMembersFromMemberships · deriveAddCandidates)와
// 타입 3 개(GroupRow · GroupMemberRow · MembershipRow)를 이동 전 표면 그대로 re-export 하므로,
// 기존 계약 spec 의 './AdminView' import 경로는 무수정으로 산다(공개 표면 무변경).

import type { Member } from '../components/GroupMemberList';
import type { PersonRow } from '../components/PersonList';

// 이름 누락 멤버 row 의 fallback 라벨 — 의미 없는 빈 이름 방지(파생 단계 보수).
const FALLBACK_MEMBER_NAME = '이름 미상';

// 멤버 row 의 frontend-local 최소 타입 — backend DTO 전수 공유는 Out of Scope(후속 별도
// 결정). id/name/role 세 후보 필드만 보수적으로 매핑한다. 모든 필드를 선택적으로 두어
// 누락/비정상 row 도 throw 없이 받는다(③a~③b-2 의 frontend-local 최소 타입 convention 정합).
export interface GroupMemberRow {
  id?: string;
  name?: string;
  // 표시 이름 후보 — name 우선, 없으면 fullName 을 이름으로 쓴다(backend 가 fullName 을 쓰는
  // 경우 대비). 둘 다 누락이면 fallback 라벨.
  fullName?: string;
  // 역할 라벨 후보(선택) — 있으면 GroupMemberList 가 이름과 함께 표시한다.
  role?: string;
}

// 그룹 row 의 frontend-local 최소 타입 — id/name + 멤버 배열 후보 두 필드(members/persons)만
// 보수적으로 매핑한다. 모든 필드를 선택적으로 두어 누락/비정상 row 도 throw 없이 받는다.
// 멤버 배열은 members 우선, 없으면 persons 를 쓴다(backend 응답 키가 무엇이든 보수적으로
// 받기 위함 — api.md 81 이 키를 명시하지 않으므로). 둘 다 없으면 멤버 빈 배열(④b 에서 fetch).
export interface GroupRow {
  id?: string;
  name?: string;
  members?: GroupMemberRow[];
  persons?: GroupMemberRow[];
}

// 멤버십 row 의 frontend-local 최소 타입(T-1129) — 신 endpoint(GET /api/groups/:id/members,
// T-1128 findMembershipsByGroupId)가 반환하는 raw PersonGroupMembership row 의 세 후보 필드만
// 보수적으로 매핑한다. id = membershipId(후속 ④c remove mutation 의 DELETE :id/members/:membershipId
// 인자), personId = 표시명을 기존 그룹 응답 person 에서 매칭할 키. 모든 필드를 선택적으로 두어
// 누락/비정상 row 도 throw 없이 받는다(createdAt 등 잔여 필드는 무시).
export interface MembershipRow {
  id?: string;
  personId?: string;
  groupId?: string;
}

// 그룹 row 배열에서 id 로 선택 그룹을 찾는다(순수 helper). rows 가 배열이 아니거나 미발견
// (stale 선택 — 선택 id 가 목록에 없음) 이면 undefined 를 반환한다(throw 없이).
export function findGroup(
  groups: GroupRow[] | undefined,
  selectedGroupId: string | undefined,
): GroupRow | undefined {
  if (!Array.isArray(groups) || !selectedGroupId) {
    return undefined;
  }
  return groups.find((group) => group.id === selectedGroupId);
}

// 선택 그룹 → GroupMemberList 의 Member[] 파생(순수 helper). groups 미도착(undefined)/빈
// 배열/선택 미발견(stale)/멤버 미포함이면 빈 배열을 반환한다(빈 상태 위임 — throw 없이).
// 멤버 배열은 group.members 우선, 없으면 group.persons 를 쓴다(키 다양성 보수 수용). id
// 누락 row 는 index 기반 합성 key 로, name 누락 row 는 fallback 라벨로 안전 매핑한다.
// 그룹 응답이 멤버를 포함하지 않으면 빈 배열 — 별도 GET /api/groups/:id/members fetch 는
// ④b Out of Scope(본 컨테이너는 그룹 목록 조회만 한다).
export function deriveMembers(
  groups: GroupRow[] | undefined,
  selectedGroupId: string | undefined,
): Member[] {
  const group = findGroup(groups, selectedGroupId);
  if (!group) {
    return [];
  }
  const rawMembers = group.members ?? group.persons;
  if (!Array.isArray(rawMembers)) {
    return [];
  }
  return rawMembers.map((member, index) => {
    const name = member.name ?? member.fullName ?? FALLBACK_MEMBER_NAME;
    return {
      id: member.id ?? `m${index + 1}`,
      name: name || FALLBACK_MEMBER_NAME,
      role: member.role,
    };
  });
}

// 선택 그룹의 멤버십 조회 path 빌더(순수 helper, T-1129 → T-1130 nonce 확장) — GET
// /api/groups/:id/members(T-1128, api.md 82). 선택 그룹이 있을 때만 path 를 만들고, 미선택
// (빈/falsy)이면 null 을 반환해 useApiResource 의 조건부 조회(path=null → 미조회, idle)를
// 유발한다(personId 미선택 시 미조회 convention 정합 — useApiResource.ts 9~11). groupId 는
// encodeURIComponent 로 안전 인코딩해 비정상 문자가 든 id 도 path 가 깨지지 않게 한다
// (buildExportPath/buildRecentDeletionPath 의 안전 인코딩 convention 정합).
// T-1130: ④c remove mutation 성공 후 멤버십 재조회를 유발하기 위해 cache-busting nonce(`_r`)를
// 받는다(buildMappingsPath 동형). nonce 0(초기 조회)이면 query 없는 깨끗한 path 를 그대로 쓰고
// (불필요 query 회피), 1+ 면 `?_r=<nonce>` 를 부착해 useApiResource 의 path-변경 재조회를 낸다.
// `_r` 은 backend GET 핸들러가 @Query 를 받지 않아 무시한다(api.md 82 — 부수효과 0). 선택 그룹
// 변경 refetch(path 변경)는 selectedGroupId 변화가 그대로 유지한다.
export function buildGroupMembersPath(
  selectedGroupId: string | undefined,
  refreshNonce = 0,
): string | null {
  if (!selectedGroupId) {
    return null;
  }
  const base = `/api/groups/${encodeURIComponent(selectedGroupId)}/members`;
  if (refreshNonce <= 0) {
    return base;
  }
  return `${base}?_r=${refreshNonce}`;
}

// 멤버십 응답 + 선택 그룹 → GroupMemberList 의 Member[] 파생(순수 helper, T-1129). raw membership
// row 배열에서 Member[] 를 만들되, 각 Member.id 를 membership 의 id(membershipId)로 설정한다 —
// 후속 ④c remove mutation(DELETE :id/members/:membershipId)의 인자를 노출하기 위함. 표시명은 기존
// 그룹 응답의 person(group.members ?? group.persons, id = personId)에서 membership.personId 매칭으로
// 채우고, 매칭 부재/이름 누락/빈 이름이면 FALLBACK_MEMBER_NAME 으로 안전 fallback 한다(backend person
// include shape 변경은 Out of Scope). memberships 가 배열이 아니면 빈 배열(빈 상태 위임 — throw 없이).
// id 누락 membership 은 index 기반 합성 key 로 안전 매핑해 React key 안정성을 유지한다(deriveMembers 동형).
export function deriveMembersFromMemberships(
  memberships: MembershipRow[] | undefined,
  group: GroupRow | undefined,
): Member[] {
  if (!Array.isArray(memberships)) {
    return [];
  }
  const rawPersons = group?.members ?? group?.persons;
  const persons = Array.isArray(rawPersons) ? rawPersons : [];
  return memberships.map((membership, index) => {
    const person = membership.personId
      ? persons.find((candidate) => candidate.id === membership.personId)
      : undefined;
    const name = person?.name ?? person?.fullName ?? FALLBACK_MEMBER_NAME;
    return {
      id: membership.id ?? `m${index + 1}`,
      name: name || FALLBACK_MEMBER_NAME,
      role: person?.role,
    };
  });
}

// 전체 인원(personData) − 현재 그룹 멤버(membershipData 의 personId) → GroupMemberList 의 추가 후보
// Member[] 파생(순수 helper, T-1238). deriveMembers/deriveMembersFromMemberships 와 동형이라 배열이
// 아니면 빈 배열을 반환하고(throw 없이 — 조회 전/비정상 응답도 안전 수용), 각 후보의 id 는 person 의
// personId, 이름은 fullName(없으면 FALLBACK_MEMBER_NAME)로 매핑한다. 멤버십의 personId 집합을 만들어
// 그 집합에 든 인원을 제외하므로, 이미 멤버인 인원은 후보에서 빠진다(중복 추가 방지 — 서버 @@unique
// 위반 이전에 UI 에서 1차 차단). id 누락 인원은 index 기반 합성 key 로 안전 매핑해 React key 안정성을
// 유지한다. 후보의 role 은 add 후보에 불필요하고 personData 계약에 없어 매핑하지 않는다(있어도 무해).
export function deriveAddCandidates(
  personData: PersonRow[] | undefined,
  membershipData: MembershipRow[] | undefined,
): Member[] {
  if (!Array.isArray(personData)) {
    return [];
  }
  // 현재 멤버의 personId 집합 — membershipData 가 배열이 아니면 빈 집합(전원 후보). 빈/비문자열
  // personId 는 제외 키로 부적합해 걸러낸다(잘못된 제외로 정상 인원이 사라지는 것 방지).
  const memberPersonIds = new Set(
    (Array.isArray(membershipData) ? membershipData : [])
      .map((membership) => membership.personId)
      .filter(
        (personId): personId is string =>
          typeof personId === 'string' && personId !== '',
      ),
  );
  return personData
    .filter((person) => !memberPersonIds.has(person.id))
    .map((person, index) => {
      const name = person.fullName ?? FALLBACK_MEMBER_NAME;
      return {
        id: person.id ?? `p${index + 1}`,
        name: name || FALLBACK_MEMBER_NAME,
      };
    });
}
