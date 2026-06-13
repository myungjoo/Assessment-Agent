// P6 composition wiring ④a (T-0385, ADR-0041 Decision 1·3·5) — Admin 화면 컨테이너 shell.
// controlled lift-up: 본 컨테이너가 데이터(GET /api/groups)·loading/error·선택 그룹 상태를
// useState/useApiResource 로 소유하고, presentational GroupMemberList 는 props 로만 소비한다
// — 컴포넌트 수정 0 (ADR-0041 Decision 1 경계). 새 dependency 0 — react hooks +
// 기존 useApiResource(apiClient fetch) 경유만 (ADR-0040 §5 게이트, axios/react-query 미도입).
//
// 책임 경계(④a): 그룹 목록 조회(GET /api/groups, User+, api.md 81) + 그룹 선택 <select> +
// 선택 그룹의 멤버 파생 → GroupMemberList 첫 패널 배선까지. 나머지 4 패널
// (DifficultyModelSelector·ReEvaluationTriggerPanel·DataImportExportPanel·SchedulePanel)
// 배선 + 멤버 추가/제거 mutation(onRemove) + Admin+ RBAC gating UI 는 ④b/④c Out of Scope.
//
// 멤버 데이터 출처(api.md 81 응답 형태 확인 결과): api.md 는 GET /api/groups 를 "임의 group
// 목록(REQ-028)" 으로만 기술하고 group row 가 멤버 배열을 포함하는지 명시하지 않는다. 따라서
// 본 slice 는 group row 에 members 필드가 "있으면" 그것을 client-side 로 파생해 표시하고,
// 없으면 빈 배열(빈 상태) 로 안전 표시한다 — 별도 GET /api/groups/:id/members 신규 fetch 는
// ④b Out of Scope(본 컨테이너는 useApiResource 를 그룹 목록 조회에 단 한 번만 호출한다).

import { useMemo, useState } from 'react';
import { useApiResource } from '../api/useApiResource';
import GroupMemberList from '../components/GroupMemberList';
import type { Member } from '../components/GroupMemberList';

// 그룹 목록 조회 path — 고정 endpoint(GET /api/groups, api.md 81 User+). personId 같은
// 필수 query 가 없어 무조건 조회한다(미인증은 AuthGate 가 이미 차단). DashboardView 의
// path 파생 helper 규약과 정합하게 상수로 둔다(조건부 가드 불요 — null 분기 없음).
const GROUPS_PATH = '/api/groups';

// 그룹 미선택 시 멤버 패널에 노출할 안내 문구 — 그룹을 고르면 그 멤버가 표시됨을 안내한다.
const NO_GROUP_SELECTED_TEXT = '그룹을 선택하면 인원이 표시됩니다';
// 그룹 선택 <select> 의 빈 선택지 라벨 — selectedGroupId 미선택 시 첫 옵션으로 노출한다.
const NO_SELECTION_LABEL = '그룹을 선택하세요';
// 선택 그룹에 멤버가 없을 때 GroupMemberList 에 내려보낼 빈 상태 문구.
const EMPTY_MEMBER_TEXT = '이 그룹에 속한 인원이 없습니다';
// 이름 누락 멤버 row 의 fallback 라벨 — 의미 없는 빈 이름 방지(파생 단계 보수).
const FALLBACK_MEMBER_NAME = '이름 미상';
// 그룹 이름 누락 시 <select> 옵션에 노출할 fallback 라벨.
const FALLBACK_GROUP_NAME = '이름 없는 그룹';

// 멤버 row 의 frontend-local 최소 타입 — backend DTO 전수 공유는 Out of Scope(후속 별도
// 결정). id/name/role 세 후보 필드만 보수적으로 매핑한다. 모든 필드를 선택적으로 두어
// 누락/비정상 row 도 throw 없이 받는다(③a~③b-2 의 frontend-local 최소 타입 convention 정합).
interface GroupMemberRow {
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
interface GroupRow {
  id?: string;
  name?: string;
  members?: GroupMemberRow[];
  persons?: GroupMemberRow[];
}

interface AdminViewProps {
  // 초기 선택 그룹 id(선택) — renderToStaticMarkup 정적 검증을 위해 초기값 주입을 허용한다
  // (③a~③b-3 의 initial* 주입 패턴 정합). 미주입 시 그룹 미선택(빈 멤버 안내) 으로 시작한다.
  initialSelectedGroupId?: string;
}

// 그룹 row 배열에서 id 로 선택 그룹을 찾는다(순수 helper). rows 가 배열이 아니거나 미발견
// (stale 선택 — 선택 id 가 목록에 없음) 이면 undefined 를 반환한다(throw 없이).
function findGroup(
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
function deriveMembers(
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

// Admin 화면 컨테이너. useApiResource 로 GET /api/groups 결과를 소유하고, 선택 그룹 상태를
// useState 로 보유해 선택 그룹의 멤버를 client-side 파생 후 GroupMemberList 에 props 로
// 내려보낸다(controlled lift-up — GroupMemberList 는 fetch 를 모른다, ADR-0041 Decision 1).
function AdminView({ initialSelectedGroupId = '' }: AdminViewProps) {
  // 선택 그룹 상태 — controlled lift-up(컨테이너 소유). <select> 선택이 이 값을 갱신한다.
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    initialSelectedGroupId,
  );

  // 그룹 목록 조회 — useApiResource 를 단 한 번만 호출한다(④a 책임 경계). loading/error 는
  // 컨테이너가 받아 GroupMemberList 의 loading/error props 로 그대로 내려보낸다(Decision 1).
  const { data, loading, error } = useApiResource<GroupRow[]>(GROUPS_PATH);

  // 표시용 그룹 목록 — data 미도착이면 빈 배열로 간주한다(<select> 옵션·파생의 안전 기준).
  const groups = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  // 선택 그룹의 멤버 파생 — 선택 그룹의 members(또는 persons) 를 Member[] 로 매핑한다.
  // 미선택/미발견(stale)/멤버 미포함이면 빈 배열(GroupMemberList 가 빈 상태 렌더).
  const members = useMemo(
    () => deriveMembers(groups, selectedGroupId || undefined),
    [groups, selectedGroupId],
  );

  // 그룹 선택 변경 — <select> 가 선택 그룹 id 를 컨테이너 상태로 올린다(빈 값 선택 시 미선택
  // 으로 되돌려 멤버 빈 상태로 표시). GroupMemberList 는 선택 상호작용을 모른다(Decision 1).
  const handleSelectChange = (event: { target: { value: string } }) => {
    setSelectedGroupId(event.target.value);
  };

  // 빈 상태 문구 결정 — 그룹 미선택이면 "그룹을 선택하면…" 안내, 선택했는데 멤버 0 이면
  // "이 그룹에 속한 인원이 없습니다" 안내를 GroupMemberList 의 emptyMessage 로 내려보낸다.
  const emptyMessage = selectedGroupId
    ? EMPTY_MEMBER_TEXT
    : NO_GROUP_SELECTED_TEXT;

  return (
    <section aria-label="Admin 관리">
      {/* 그룹 선택 컨트롤 — 그룹 목록을 옵션으로 노출하고 선택 시 그 그룹의 멤버를 파생한다.
          loading 중에는 그룹 목록이 비어 옵션이 빈 선택지만 노출되고, 멤버 패널이 loading 을
          props 로 받아 진행 표시를 한다(컨테이너가 fetch 상태를 패널로 위임). */}
      <select
        aria-label="그룹 선택"
        value={selectedGroupId}
        onChange={handleSelectChange}
      >
        <option value="">{NO_SELECTION_LABEL}</option>
        {groups.map((group, index) => (
          <option key={group.id ?? `g${index + 1}`} value={group.id ?? ''}>
            {group.name ?? FALLBACK_GROUP_NAME}
          </option>
        ))}
      </select>
      {/* 그룹 멤버 목록(첫 패널) — 파생 members 와 그룹 조회의 loading/error 를 props 로만
          내려보낸다(ADR-0041 Decision 1 — 패널은 fetch 를 모른다). onRemove 미전달 — 멤버
          제거 mutation 은 ④b Out of Scope(제거 버튼 미렌더). 컴포넌트 수정 0. */}
      <GroupMemberList
        members={members}
        loading={loading}
        error={error}
        emptyMessage={emptyMessage}
      />
    </section>
  );
}

export { findGroup, deriveMembers };
export type { AdminViewProps, GroupRow, GroupMemberRow };
export default AdminView;
