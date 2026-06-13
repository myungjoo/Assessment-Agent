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

import { useCallback, useMemo, useState } from 'react';
import { useApiResource, toErrorMessage } from '../api/useApiResource';
import { request } from '../api/apiClient';
import type { RequestOptions } from '../api/apiClient';
import GroupMemberList from '../components/GroupMemberList';
import type { Member } from '../components/GroupMemberList';
import DifficultyModelSelector from '../components/DifficultyModelSelector';
import type {
  ProviderOption,
  Difficulty,
} from '../components/DifficultyModelSelector';
// P6 wiring ④d (T-0388) — 세 번째 패널 DataImportExportPanel export 배선. presentational
// 컴포넌트는 수정 0 으로 named import 만(ADR-0041 Decision 1 — 패널은 fetch 를 모른다).
import DataImportExportPanel from '../components/DataImportExportPanel';
import type { DataImportExportPanelProps } from '../components/DataImportExportPanel';

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

// 평가 자료 export path — 고정 endpoint(GET /api/admin/export, api.md 122 Admin+, raw 미포함
// REQ-032·REQ-030). scope query 는 본 slice 미부착 — api.md 가 scope 를 선택 필터로만 기술하고
// 기본값을 명시하지 않으므로, scope 선택 UI(드롭다운/필터) 가 도입되는 후속 slice 전까지는
// query 없이 전체 scope 로 export 한다(scope 미부착 = backend 기본 scope 위임). Admin+ 라 User
// 등급은 403 — 그 403 은 runExport 의 catch 가 error props 로 안전 표시(throw 없음).
const ADMIN_EXPORT_PATH = '/api/admin/export';

// export 성공 시 DataImportExportPanel 의 message props 로 내려보낼 사람-친화 완료 안내.
// 실 파일 저장 트리거(Blob→다운로드) 는 후속 slice 라(Out of Scope), 본 slice 는 export 호출
// 성공 사실만 표면화한다(데이터 건수/scope 요약은 응답 형태 미확정이라 단순 완료 문구로 둔다).
const EXPORT_DONE_TEXT = '내보내기 완료';

// 평가 자료 import path — 고정 endpoint(POST /api/admin/import, api.md 123 Admin+, multipart
// file upload). Admin+ 라 User 등급은 403 — 그 403 은 runImport 의 catch 가 error props 로 안전
// 표시(throw 없음). backup/restore(api.md 124·125) 는 본 slice Out of Scope(import 만).
const ADMIN_IMPORT_PATH = '/api/admin/import';

// import multipart FormData 의 file field 이름 — api.md 123 이 multipart field 키를 명시하지
// 않으므로 가장 표준적인 'file' 을 쓴다(NestJS FileInterceptor 의 기본 field 명 관례 정합).
// backend import controller 가 다른 키를 요구하면 후속 정정한다(현 src/ 에 미구현 — ④d export
// 와 동일하게 api.md 계약 기준 선배선). 컴포넌트/apiClient 수정 0 — native FormData body.
const IMPORT_FILE_FIELD = 'file';

// import 성공 시 DataImportExportPanel 의 message props 로 내려보낼 사람-친화 완료 안내.
// import 결과 상세(건수/충돌/검증 리포트) 는 후속 slice 라(Out of Scope), 본 slice 는 import
// 호출 성공 사실만 표면화한다(응답 형태 미확정이라 단순 완료 문구로 둔다 — EXPORT_DONE_TEXT 동형).
const IMPORT_DONE_TEXT = '가져오기 완료';

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

// 난이도 슬롯 매핑 조회 path 빌더(순수 helper) — ④c PATCH 성공 시 GET 재조회를 유발하기 위해
// 컨테이너의 refreshNonce 를 cache-busting query(`_r`)로 실어 path 문자열을 변화시킨다.
// useApiResource 는 path 변경 시에만 재조회하므로(수정 0 — read-only hook), nonce 증가가 곧
// 재조회 트리거다. nonce 0(초기 조회)이면 query 없는 깨끗한 path 를 그대로 쓴다(불필요 query
// 회피). `_r` 은 backend GET 핸들러가 @Query 를 받지 않아 무시한다(api.md 119 — 부수효과 0).
function buildMappingsPath(refreshNonce: number): string {
  if (refreshNonce <= 0) {
    return LLM_MAPPINGS_PATH;
  }
  return `${LLM_MAPPINGS_PATH}?_r=${refreshNonce}`;
}

// 서버 파생 매핑 위에 낙관적 override 를 덮는 순수 helper — ④c PATCH 발사 직후 재조회 도착
// 전까지 재지정한 슬롯이 즉시 새 provider 를 반영하도록 한다. override 의 각 슬롯값이 정의돼
// 있으면(undefined 가 아니면) base 를 덮고, undefined 슬롯은 base 를 유지한다(부분 override).
// override 가 비거나(아무 슬롯도 없음) 모두 undefined 면 base 와 동일한 새 객체를 반환한다.
function mergeMapping(
  base: Record<Difficulty, string | null>,
  override: Partial<Record<Difficulty, string | null>>,
): Record<Difficulty, string | null> {
  const merged: Record<Difficulty, string | null> = { ...base };
  for (const key of DIFFICULTY_KEYS) {
    const value = override[key];
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  return merged;
}

// onAssign 의 PATCH + state-전이 로직을 캡슐화한 순수 async 러너(④c, 테스트 가능성 —
// jsdom/렌더러 없이 mutation 본체를 직접 검증한다. useApiResource 의 runFetch 가 effect
// 본체를 분리해 jsdom 없이 검증한 convention 정합). 컨테이너의 handleAssign 은 이 러너에
// 현재 in-flight 여부(assigning)와 상태 setter 들을 주입해 호출만 한다. 동작:
//  - 빈/falsy providerId → 미발사(잘못된 body 회피).
//  - assigning(이전 mutation 미완) → 미발사(이중 PATCH·state 경합 차단).
//  - 발사 시 낙관 반영 + 진행 on + error 비움 → PATCH → 성공(재조회 트리거 + override 비움) /
//    실패(override 롤백 + 문구 표면화) → 진행 off(공통).
interface AssignDeps {
  // PATCH 발사 primitive — apiClient.request 를 주입한다(테스트는 mock 주입).
  patch: (path: string, options: RequestOptions) => Promise<unknown>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입).
  describeError: (e: unknown) => string;
  // 현재 mutation in-flight 여부 — true 면 미발사(동시 재호출 가드).
  assigning: boolean;
  setAssigning: (next: boolean) => void;
  setAssignError: (next: string | undefined) => void;
  setOptimistic: (
    updater: (
      prev: Partial<Record<Difficulty, string | null>>,
    ) => Partial<Record<Difficulty, string | null>>,
  ) => void;
  // 권위 재조회 트리거 — refreshNonce 를 +1 한다(path 변경 유발).
  bumpRefresh: () => void;
}

async function runAssign(
  difficulty: Difficulty,
  providerId: string,
  deps: AssignDeps,
): Promise<void> {
  // 비정상 호출 가드 — 빈/falsy providerId 는 PATCH 미발사(잘못된 body 회피).
  if (!providerId) {
    return;
  }
  // 동시 재호출 가드 — 이전 mutation 미완 중이면 미발사(이중 PATCH·state 경합 차단).
  if (deps.assigning) {
    return;
  }
  deps.setAssigning(true);
  deps.setAssignError(undefined);
  deps.setOptimistic((prev) => ({ ...prev, [difficulty]: providerId }));
  try {
    await deps.patch(`${LLM_MAPPINGS_PATH}/${difficulty}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ llmProviderConfigId: providerId }),
    });
    // 성공 — 권위 재조회 트리거 + 낙관 override 비움(서버 데이터로 대체).
    deps.setOptimistic(() => ({}));
    deps.bumpRefresh();
  } catch (e) {
    // 실패 — 낙관 override 롤백 + 사람-친화 문구 표면화(throw 없이 error props 로).
    deps.setOptimistic(() => ({}));
    deps.setAssignError(deps.describeError(e));
  } finally {
    deps.setAssigning(false);
  }
}

// onExport 의 GET + state-전이 로직을 캡슐화한 순수 async 러너(④d — ④c runAssign 캡슐화 패턴
// 차용. jsdom/렌더러 없이 export 본체를 직접 검증한다 — AssignDeps 와 동형의 ExportDeps 주입).
// 컨테이너의 handleExport 는 이 러너에 현재 in-flight 여부(exporting)와 상태 setter 들을 주입해
// 호출만 한다. 동작:
//  - exporting(이전 export 미완) → 미발사(이중 GET·state 경합 차단 — runAssign 의 assigning 가드 동형).
//  - 발사 시 진행 on + 이전 error·message 비움 → GET /api/admin/export → 성공(완료 message 설정) /
//    실패(error 문구 표면화 — throw 없이) → 진행 off(공통).
interface ExportDeps {
  // export GET 발사 primitive — apiClient.request 를 주입한다(테스트는 mock 주입).
  get: (path: string, options?: RequestOptions) => Promise<unknown>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입).
  describeError: (e: unknown) => string;
  // 현재 export in-flight 여부 — true 면 미발사(동시 재호출 가드).
  exporting: boolean;
  setExporting: (next: boolean) => void;
  setExportError: (next: string | undefined) => void;
  setExportMessage: (next: string | undefined) => void;
}

async function runExport(deps: ExportDeps): Promise<void> {
  // 동시 재호출 가드 — 이전 export 미완 중이면 미발사(이중 GET·state 경합 차단).
  if (deps.exporting) {
    return;
  }
  deps.setExporting(true);
  // 재발화 시작 시 직전 error·message 를 비운다(실패 후 재시도 시 직전 error 정리 + 직전 완료
  // 안내 정리 — 새 export 의 진행 표시만 남도록).
  deps.setExportError(undefined);
  deps.setExportMessage(undefined);
  try {
    // GET /api/admin/export — 옵션 생략(apiClient.request 기본 GET). scope query 미부착(전체
    // scope, scope 선택 UI 는 후속). 응답 body 형태(JSON/text/빈 body)는 본 slice 가 소비하지
    // 않으므로(실 파일 저장 트리거는 후속) 성공 사실만 확인한다 — 비정상/빈 응답도 throw 없이 완료.
    await deps.get(ADMIN_EXPORT_PATH);
    // 성공 — 사람-친화 완료 안내를 message 로 표면화(DataImportExportPanel 의 정상 message 분기).
    deps.setExportMessage(EXPORT_DONE_TEXT);
  } catch (e) {
    // 실패 — 사람-친화 문구를 error props 로 안전 표시(throw 없이). 403 Admin+ 미만 / 404 /
    // 비-2xx / 네트워크 0 모두 ApiError.status → toErrorMessage 파생으로 표면화.
    deps.setExportError(deps.describeError(e));
  } finally {
    deps.setExporting(false);
  }
}

// onImportFile 의 POST(multipart) + state-전이 로직을 캡슐화한 순수 async 러너(④e — ④d
// runExport 캡슐화 패턴 차용. jsdom/렌더러 없이 import 본체를 직접 검증한다 — ExportDeps 와
// 동형의 ImportDeps 주입). 컨테이너의 handleImport 는 이 러너에 현재 in-flight 여부(importing)와
// 상태 setter 들을 주입해 호출만 한다. 동작:
//  - 빈/falsy file → 미발사(빈 선택 방어 — DataImportExportPanel.handleFileChange 도 falsy file
//    시 미호출이나 러너 자체도 방어해 직접 호출/비정상 입력에 안전).
//  - importing(이전 import 미완) → 미발사(이중 POST·state 경합 차단 — runExport 의 exporting 가드 동형).
//  - 발사 시 진행 on + 이전 error·message 비움 → FormData 에 file append → POST /api/admin/import →
//    성공(완료 message 설정) / 실패(error 문구 표면화 — throw 없이) → 진행 off(공통).
interface ImportDeps {
  // import POST 발사 primitive — apiClient.request 를 주입한다(테스트는 mock 주입).
  post: (path: string, options: RequestOptions) => Promise<unknown>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입).
  describeError: (e: unknown) => string;
  // 현재 import in-flight 여부 — true 면 미발사(동시 재호출 가드).
  importing: boolean;
  setImporting: (next: boolean) => void;
  setImportError: (next: string | undefined) => void;
  setImportMessage: (next: string | undefined) => void;
}

async function runImport(file: File, deps: ImportDeps): Promise<void> {
  // 비정상 호출 가드 — 빈/falsy file 은 POST 미발사(빈 선택 방어 — 잘못된 body 회피).
  if (!file) {
    return;
  }
  // 동시 재호출 가드 — 이전 import 미완 중이면 미발사(이중 POST·state 경합 차단).
  if (deps.importing) {
    return;
  }
  deps.setImporting(true);
  // 재발화 시작 시 직전 error·message 를 비운다(실패 후 재시도 시 직전 error 정리 + 직전 완료
  // 안내 정리 — 새 import 의 진행 표시만 남도록, runExport 의 시작 정리 동형).
  deps.setImportError(undefined);
  deps.setImportMessage(undefined);
  try {
    // 선택 File 을 multipart FormData 로 동봉 — body 가 FormData 면 브라우저가 multipart
    // Content-Type boundary 를 자동 설정하므로 수동 헤더 미지정(boundary 누락 방지). apiClient
    // .request 가 RequestInit.body 를 native 수용 → apiClient.ts 수정 0.
    const formData = new FormData();
    formData.append(IMPORT_FILE_FIELD, file);
    // POST /api/admin/import — multipart body. 응답 body 형태(건수/리포트)는 본 slice 가
    // 소비하지 않으므로(import 결과 상세 표시는 후속) 성공 사실만 확인한다.
    await deps.post(ADMIN_IMPORT_PATH, { method: 'POST', body: formData });
    // 성공 — 사람-친화 완료 안내를 message 로 표면화(DataImportExportPanel 의 정상 message 분기).
    deps.setImportMessage(IMPORT_DONE_TEXT);
  } catch (e) {
    // 실패 — 사람-친화 문구를 error props 로 안전 표시(throw 없이). 403 Admin+ 미만 / 400 잘못된
    // 파일 / 404 / 비-2xx / 네트워크 0 모두 ApiError.status → toErrorMessage 파생으로 표면화.
    deps.setImportError(deps.describeError(e));
  } finally {
    deps.setImporting(false);
  }
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

  // export in-flight 플래그(④d) — export GET 진행 중 true. 진행 표시(busy)와 동시 재호출 가드
  // (이전 export 미완 중 재호출 차단)에 함께 쓴다(④c assigning 동형).
  const [exporting, setExporting] = useState<boolean>(false);

  // export 완료 안내 문구(④d) — export 성공 시 사람-친화 완료 안내를 보관해 message props 로
  // 표시한다. 재발화 시작·실패 시 비운다.
  const [exportMessage, setExportMessage] = useState<string | undefined>(
    undefined,
  );

  // export 실패 문구(④d) — export 실패 시 사람-친화 문구(toErrorMessage 파생)를 보관해 error
  // props 로 안전 표시한다(throw 없음). 재발화 시작 시 비운다.
  const [exportError, setExportError] = useState<string | undefined>(undefined);

  // onExport 실 핸들러(④d) — export GET(/api/admin/export) 을 컨테이너 내부 async 로 발사한다
  // (신규 fetch hook 미작성 — ④c runAssign 정합, useApiResource 는 read-on-mount 라 클릭 발화에
  // 부적합). 동작:
  //  1) 이전 export 미완(exporting) 중 재호출이면 미발사(이중 호출·state 깨짐 차단).
  //  2) 진행 표시 on + 직전 error·message 비움(실패 후 재시도 시 직전 error 정리).
  //  3) GET 성공 → 완료 안내(message) 표면화.
  //  4) GET 실패 → toErrorMessage 문구를 error props 로 안전 표시(403/404/비-2xx/네트워크 0 모두, throw 없음).
  //  5) 마지막에 진행 표시 off(성공·실패 공통).
  const handleExport = useCallback(
    () =>
      runExport({
        get: request,
        describeError: toErrorMessage,
        exporting,
        setExporting,
        setExportError,
        setExportMessage,
      }),
    [exporting],
  );

  // import in-flight 플래그(④e) — import POST 진행 중 true. 진행 표시(busy)와 동시 재호출 가드
  // (이전 import 미완 중 재호출 차단)에 함께 쓴다(④d exporting 동형).
  const [importing, setImporting] = useState<boolean>(false);

  // import 완료 안내 문구(④e) — import 성공 시 사람-친화 완료 안내를 보관해 message props 로
  // 표시한다. 재발화 시작·실패 시 비운다(④d exportMessage 동형).
  const [importMessage, setImportMessage] = useState<string | undefined>(
    undefined,
  );

  // import 실패 문구(④e) — import 실패 시 사람-친화 문구(toErrorMessage 파생)를 보관해 error
  // props 로 안전 표시한다(throw 없음). 재발화 시작 시 비운다(④d exportError 동형).
  const [importError, setImportError] = useState<string | undefined>(undefined);

  // onImportFile 실 핸들러(④e) — import POST(/api/admin/import, multipart) 를 컨테이너 내부
  // async 로 발사한다(신규 fetch hook 미작성 — ④d runExport 정합, useApiResource 는 read-on-mount
  // 라 파일 선택 발화에 부적합). 동작:
  //  1) 빈/falsy file 또는 이전 import 미완(importing) 중 재호출이면 미발사(빈 선택 방어 +
  //     이중 호출·state 깨짐 차단).
  //  2) 진행 표시 on + 직전 error·message 비움(실패 후 재시도 시 직전 error 정리).
  //  3) FormData 에 file append → POST 성공 → 완료 안내(message) 표면화.
  //  4) POST 실패 → toErrorMessage 문구를 error props 로 안전 표시(403/400/404/비-2xx/네트워크 0 모두, throw 없음).
  //  5) 마지막에 진행 표시 off(성공·실패 공통).
  const handleImport = useCallback(
    (file: File) =>
      runImport(file, {
        post: request,
        describeError: toErrorMessage,
        importing,
        setImporting,
        setImportError,
        setImportMessage,
      }),
    [importing],
  );

  // DataImportExportPanel 의 busy/error/message props — busy 우선 → error → message 순으로
  // 패널이 렌더 분기하므로(컴포넌트 박제), 컨테이너는 export·import 두 작업의 진행/실패/완료
  // 상태를 단일 패널 props 로 합성한다(④e 결정 근거): DataImportExportPanel 이 export·import 를
  // 한 패널로 표현하므로(버튼+파일입력 + 단일 busy/error/message 슬롯), 컨테이너도 작업별 state 를
  // 분리 보유(exporting/importing 등 — 가드·전이는 독립)하되 패널로는 단일 슬롯으로 OR 합성해
  // 내려보낸다. 우선순위는 패널 렌더 분기 정합으로 busy(둘 중 하나라도 진행) → error(export
  // error 우선, 없으면 import error) → message(export message 우선, 없으면 import message). 동시
  // 발화는 각 가드가 차단하므로 한 시점에 한 작업만 진행한다(우선순위 충돌 표면 최소). 타입은 패널
  // props 에서 파생해 시그니처 정합을 강제한다(컴포넌트 props 재정의 금지).
  const importExportPanelProps: Pick<
    DataImportExportPanelProps,
    'onExport' | 'onImportFile' | 'busy' | 'error' | 'message'
  > = {
    onExport: handleExport,
    onImportFile: handleImport,
    busy: exporting || importing,
    error: exportError ?? importError,
    message: exportMessage ?? importMessage,
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
          (ADR-0041 Decision 1 — 패널은 fetch/PATCH 를 모른다). llmLoading/llmError 는 두 LLM 읽기
          조회 + mutation(assigning/assignError)의 loading/error 합성(④c — mutation 우선). onAssign 은
          실 PATCH(/api/llm/difficulty-mappings/:difficulty) async 핸들러(④c) — 성공 시 재조회 +
          낙관 반영, 실패 시 error props 안전 표시(throw 없음). 컴포넌트 수정 0. */}
      <DifficultyModelSelector
        providers={providers}
        mapping={difficultyMapping}
        onAssign={handleAssign}
        loading={llmLoading}
        error={llmError}
      />
      {/* 데이터 import/export(세 번째 패널, ④d export + ④e import) — export·import 콜백·진행·
          결과·실패를 컨테이너가 소유하고 패널은 onExport/onImportFile 콜백 + busy/error/message
          props 만 소비한다(ADR-0041 Decision 1 — 패널은 fetch/FormData 를 모른다). onImportFile
          배선으로 파일 입력이 활성화된다(④d 가 비활성화했던 입력 활성). import 는 POST
          /api/admin/import 로 multipart FormData 전송(④e). 컴포넌트 수정 0. */}
      <DataImportExportPanel {...importExportPanelProps} />
    </section>
  );
}

export {
  findGroup,
  deriveMembers,
  deriveProviders,
  deriveDifficultyMapping,
  buildMappingsPath,
  mergeMapping,
  runAssign,
  runExport,
  runImport,
};
export type {
  AdminViewProps,
  GroupRow,
  GroupMemberRow,
  LlmProviderRow,
  DifficultyMappingRow,
  AssignDeps,
  ExportDeps,
  ImportDeps,
};
export default AdminView;
