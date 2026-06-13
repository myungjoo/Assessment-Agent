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
import DifficultyModelSelector from '../components/DifficultyModelSelector';
import type {
  ProviderOption,
  Difficulty,
} from '../components/DifficultyModelSelector';

// 그룹 목록 조회 path — 고정 endpoint(GET /api/groups, api.md 81 User+). personId 같은
// 필수 query 가 없어 무조건 조회한다(미인증은 AuthGate 가 이미 차단). DashboardView 의
// path 파생 helper 규약과 정합하게 상수로 둔다(조건부 가드 불요 — null 분기 없음).
const GROUPS_PATH = '/api/groups';

// LLM provider 목록 조회 path — 고정 endpoint(GET /api/llm/providers, api.md 114 Admin+,
// sanitize view 6 필드 id/provider/endpointUrl/modelId/createdAt/updatedAt). Admin+ 라
// User 등급은 403 — 그 403 은 LLM_ERROR_FALLBACK 경로로 error props 안전 표시(throw 없음).
const LLM_PROVIDERS_PATH = '/api/llm/providers';
// 난이도 슬롯 매핑 조회 path — 고정 endpoint(GET /api/llm/difficulty-mappings, api.md 119
// Admin+, 3 난이도 슬롯 배열, 빈 배열 seed 전 정상). Admin+ 라 User 등급은 403.
const LLM_MAPPINGS_PATH = '/api/llm/difficulty-mappings';

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

// LLM provider row 의 frontend-local 최소 타입 — backend sanitize view(api.md 114 6 필드)
// 중 DifficultyModelSelector 가 쓰는 id/provider/modelId 세 후보만 보수적으로 매핑한다.
// 모든 필드를 선택적으로 두어 누락/비정상 row 도 throw 없이 받는다(③a~④a frontend-local
// 최소 타입 convention 정합 — apiKey 등 잔여 필드는 무시).
interface LlmProviderRow {
  id?: string;
  provider?: string;
  modelId?: string;
}

// 난이도 매핑 row 의 frontend-local 최소 타입 — 슬롯 키(difficulty)와 할당된 provider config
// id(llmProviderConfigId) 두 후보만 보수적으로 매핑한다. 둘 다 선택적이라 누락/비정상 row 도
// throw 없이 받는다(빈 배열 seed 전·미지의 난이도 키 안전 처리는 deriveDifficultyMapping 책임).
interface DifficultyMappingRow {
  difficulty?: string;
  llmProviderConfigId?: string | null;
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

// 난이도 슬롯 고정 3 키 — deriveDifficultyMapping 의 기본 골격(미지의 키 무시 + 누락 슬롯 null).
const DIFFICULTY_KEYS: Difficulty[] = ['easy', 'medium', 'hard'];

// provider 응답 row 배열 → DifficultyModelSelector 의 ProviderOption[] 파생(순수 helper).
// rows 가 배열이 아니면 빈 배열을 반환한다(throw 없이). id/provider/modelId 누락 row 는
// 보수적 fallback — id 누락 row 는 index 기반 합성 key(`p<n>`), provider/modelId 누락은 빈
// 문자열로 채워 컴포넌트가 undefined 를 렌더하지 않게 한다(③a~④a 보수 매핑 convention).
function deriveProviders(rows: LlmProviderRow[] | undefined): ProviderOption[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.map((row, index) => ({
    id: row.id ?? `p${index + 1}`,
    provider: row.provider ?? '',
    modelId: row.modelId ?? '',
  }));
}

// 난이도 매핑 응답 row 배열 → Record<Difficulty, string | null> 파생(순수 helper). 세 슬롯
// (easy/medium/hard) 을 키로 하고 기본값은 null(빈 배열 seed 전 안전 처리). 응답에 해당
// 슬롯이 있으면 그 llmProviderConfigId 를 채우되, 빈 문자열/누락은 null 로 보정한다. 미지의
// 난이도 키(예 'expert') 는 무시한다(세 슬롯 외 키는 골격에 없어 자연 skip — throw 없음).
// rows 가 배열이 아니어도 세 슬롯 모두 null 인 기본 매핑을 반환한다(throw 없이).
function deriveDifficultyMapping(
  rows: DifficultyMappingRow[] | undefined,
): Record<Difficulty, string | null> {
  const mapping: Record<Difficulty, string | null> = {
    easy: null,
    medium: null,
    hard: null,
  };
  if (!Array.isArray(rows)) {
    return mapping;
  }
  for (const row of rows) {
    const key = row.difficulty as Difficulty | undefined;
    // 세 슬롯에 속한 키만 반영(미지의 난이도 키는 무시) — type-narrowing 후 안전 할당.
    if (key && DIFFICULTY_KEYS.includes(key)) {
      // 빈 문자열/누락 id 는 미할당(null)으로 보정 — placeholder fallback.
      mapping[key] = row.llmProviderConfigId ? row.llmProviderConfigId : null;
    }
  }
  return mapping;
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

  // LLM provider 목록 조회(④b 두 번째 패널) — useApiResource 추가 호출(④a 의 그룹 조회 +
  // 본 slice 두 번 = 총 세 번). loading/error 는 컨테이너가 받아 DifficultyModelSelector 의
  // props 로 내려보낸다(Decision 1 — 패널은 fetch 를 모른다). Admin+ 라 User 는 403→error.
  const {
    data: providerData,
    loading: providersLoading,
    error: providersError,
  } = useApiResource<LlmProviderRow[]>(LLM_PROVIDERS_PATH);

  // 난이도 슬롯 매핑 조회(④b) — provider 와 같은 thin fetch hook 으로 추가 조회한다.
  const {
    data: mappingData,
    loading: mappingsLoading,
    error: mappingsError,
  } = useApiResource<DifficultyMappingRow[]>(LLM_MAPPINGS_PATH);

  // provider 응답 → ProviderOption[] 파생(순수 helper). data 미도착이면 빈 배열(빈 상태).
  const providers = useMemo(
    () => deriveProviders(providerData),
    [providerData],
  );

  // 난이도 매핑 응답 → Record<Difficulty, string | null> 파생. 세 슬롯을 키로 기본 null.
  const difficultyMapping = useMemo(
    () => deriveDifficultyMapping(mappingData),
    [mappingData],
  );

  // loading 합성 — 두 LLM 조회 중 하나라도 진행 중이면 true(loading 우선 정책에 맞춰 패널이
  // 부분 데이터로 깜빡이지 않게 둘 다 끝날 때까지 로딩 표시한다, ADR-0041 Decision 1 경계).
  const llmLoading = providersLoading || mappingsLoading;

  // error 합성 — provider 조회 error 를 우선 노출하고, 없으면 mapping 조회 error 를 쓴다
  // (provider 가 없으면 슬롯 폼 자체가 의미 없으므로 provider error 가 더 근본적). 둘 다
  // 없으면 undefined. Admin+ 미만 403 도 이 경로로 error props 안전 표시(throw 없음).
  const llmError = providersError ?? mappingsError;

  // onAssign no-op — 슬롯 재지정 PATCH(/api/llm/difficulty-mappings/:difficulty) mutation 은
  // ④c Out of Scope. 본 slice 는 읽기 표시까지라 required onAssign 에 빈 콜백을 전달한다
  // (실 PATCH·낙관적 업데이트·토스트는 ④c). 컴포넌트 수정 0 유지(controlled props 소비).
  const handleAssignNoop = (_difficulty: Difficulty, _providerId: string) => {
    // mutation 은 ④c — 본 slice 는 no-op.
  };

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
      {/* LLM 모델 지정(두 번째 패널) — provider 목록·난이도 매핑을 파생해 props 로만 내려보낸다
          (ADR-0041 Decision 1 — 패널은 fetch 를 모른다). llmLoading/llmError 는 두 LLM 조회의
          loading/error 합성. onAssign 은 no-op(슬롯 재지정 PATCH mutation 은 ④c Out of Scope).
          Admin+ 미만 사용자의 403 도 llmError 로 안전 표시(throw 없음). 컴포넌트 수정 0. */}
      <DifficultyModelSelector
        providers={providers}
        mapping={difficultyMapping}
        onAssign={handleAssignNoop}
        loading={llmLoading}
        error={llmError}
      />
    </section>
  );
}

export { findGroup, deriveMembers, deriveProviders, deriveDifficultyMapping };
export type {
  AdminViewProps,
  GroupRow,
  GroupMemberRow,
  LlmProviderRow,
  DifficultyMappingRow,
};
export default AdminView;
