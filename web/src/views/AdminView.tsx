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

import { useCallback, useMemo, useRef, useState } from 'react';
import { useApiResource, toErrorMessage } from '../api/useApiResource';
import { request, ApiError } from '../api/apiClient';
// import/export 러너 군(T-1860 순수 추출) — export job-flow 배선 · import 실행 · dry-run preview ·
// 확인 확정 · 확인 취소 러너와 그 deps 타입 · 경로/문구 상수 · 문구 합성 helper 를 담는 모듈. 본문은
// 한 줄도 바뀌지 않았고 AdminView 는 값만 import 한다(단방향). 파일 끝 export 목록이 이동 전 표면을
// 그대로 re-export 하므로 기존 spec 의 `from './AdminView'` 도 무수정으로 산다(공개 표면 무변경).
import {
  buildExportInput,
  clearImportConfirm,
  formatImportJobDetail,
  formatRestorePlanConfirmText,
  formatRestoreTotalsPhrase,
  runAdminExportJob,
  runConfirmedImport,
  runImport,
  runImportPreview,
} from './adminImportExportRunners';
import type {
  ConfirmImportDeps,
  DownloadDeps,
  ImportDeps,
  ImportPreviewDeps,
  RunAdminExportJobDeps,
} from './adminImportExportRunners';
// 스케줄 · 재평가 축 러너 군(T-1869 apply 조각 + T-1870 trigger · 재평가 잔여의 순수 추출) — apply ·
// manual trigger · 재평가 러너와 안내 문구 helper · path 빌더 · deps 타입 · 동반 상수를 담는 모듈.
// 본문은 한 줄도 바뀌지 않았고 AdminView 는 값만 import 한다(단방향). 파일 끝 export 배럴이 이동 전
// 표면을 그대로 re-export 하므로 기존 spec 의 `from './AdminView'` 도 무수정으로 산다.
import {
  SCHEDULES_PATH,
  buildRecentDeletionPath,
  deriveScheduleMessage,
  runApply,
  runReEvaluate,
  runTrigger,
} from './adminScheduleRunners';
import type { ReEvaluationDeps, ScheduleMutationDeps } from './adminScheduleRunners';
// 사용자 관리 mutation 축 러너 군(T-1872 생성 축 + T-1873 권한 · 역할 축 순수 추출) — 생성 POST ·
// 인스턴스 접근 부여 POST · 회수 DELETE · 역할 변경 PATCH 러너와 그 순수 helper · 실패 문구 파생
// helper · 줄 element className · 사용자 endpoint base path 를 담는 모듈. 본문은 한 줄도 바뀌지
// 않았고 AdminView 는 값과 타입을 import 만 한다(단방향 — 본 모듈은 AdminView 를 import 하지
// 않는다). USERS_PATH 는 T-1879 로 함께 옮겨진 buildUsersPath 가 쓴다(정본 1 개 유지 — AdminView 는
// 더 이상 직접 가져오지 않는다). 파일 끝 export 배럴이 이동 전
// 표면을 그대로 re-export 하므로 기존 spec 의 `from './AdminView'` 도 무수정으로 산다.
import {
  CREATE_USER_ERROR_LINE_CLASS,
  buildInstanceAccessPath,
  deriveInstanceAccessFormFlags,
  describeCreateUserFailure,
  describeCreateUserFailureLines,
  hasCreateUserErrorLines,
  runChangeRole,
  runCreateUser,
  runGrantInstanceAccess,
  runRevokeInstanceAccess,
} from './adminUserMutationRunners';
import type {
  ChangeRoleDeps,
  CreateUserDeps,
  GrantInstanceAccessDeps,
  InstanceAccessFormFlags,
  InstanceAccessFormInput,
  RevokeInstanceAccessDeps,
} from './adminUserMutationRunners';
// 그룹 멤버십 mutation 축 러너 군(T-1874 순수 추출) — 멤버 제거 DELETE · 멤버 추가 POST 러너와 그
// deps 타입을 담는 모듈. 본문은 한 줄도 바뀌지 않았고 AdminView 는 값과 타입을 import 만 한다(단방향
// — 본 모듈은 AdminView 를 import 하지 않는다). 파일 끝 export 배럴이 이동 전 표면을 그대로
// re-export 하므로 기존 spec 의 `from './AdminView'` 도 무수정으로 산다.
import { runAdd, runRemove } from './adminMembershipRunners';
import type { AddDeps, RemoveDeps } from './adminMembershipRunners';
// 그룹 멤버십 파생 helper 축(T-1876 순수 추출) — 위 mutation 러너 군의 짝인 순수 파생 helper 5 와
// 그것이 쓰는 row 타입 3 을 담는 모듈. 본문 · 주석은 한 줄도 바뀌지 않았고 AdminView 는 값과 타입을
// import 만 한다(단방향 — 본 모듈은 AdminView 를 import 하지 않는다). 파일 끝 export 배럴이 이동 전
// 표면을 그대로 re-export 하므로 기존 spec 의 `from './AdminView'` 도 무수정으로 산다.
import {
  buildGroupMembersPath,
  deriveAddCandidates,
  deriveMembers,
  deriveMembersFromMemberships,
  findGroup,
} from './adminMembershipDerivations';
import type {
  GroupMemberRow,
  GroupRow,
  MembershipRow,
} from './adminMembershipDerivations';
// T-1880 — provider · 난이도 파생 helper 축(값 4 + row 타입 2)을 새 모듈에서 되돌려 쓴다. 본문은
// 한 줄도 바뀌지 않았고 AdminView → 모듈 단방향 import 만 한다(역방향 0). 파일 끝 export 배랴이
// 이동 전 표면을 그대로 re-export 하므로 기존 spec 의 `from './AdminView'` 는 무수정으로 산다.
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
import GroupMemberList from '../components/GroupMemberList';
import DifficultyModelSelector from '../components/DifficultyModelSelector';
import type { Difficulty } from '../components/DifficultyModelSelector';
// P6 wiring ④d (T-0388) — 세 번째 패널 DataImportExportPanel export 배선. presentational
// 컴포넌트는 수정 0 으로 named import 만(ADR-0041 Decision 1 — 패널은 fetch 를 모른다).
import DataImportExportPanel from '../components/DataImportExportPanel';
// import/export 축 hook(T-1884 순수 추출) — 본 컨테이너의 export/import prelude 를 통째로 옮긴
// 모듈. 컨테이너는 반환 3 심볼만 소비하고 축 내부 상태 · 러너 주입은 hook 이 소유한다.
import { useAdminImportExport } from './useAdminImportExport';
// T-1134 — R-96 LLM provider 관리 UI 마운트. 직전 slice(T-1133)가 신설한 순수 presentational
// LlmProviderConfigList 를 Admin+ 패널에 배선한다. 컴포넌트 수정 0 으로 default import + named
// type 만(ADR-0041 Decision 1 — 패널은 fetch 를 모른다). 기존 providerData 재사용(새 fetch 0).
import LlmProviderConfigList from '../components/LlmProviderConfigList';
// T-0885 — P6 deferred wiring 재개(PLAN line120/123). 다섯 번째 패널 SchedulePanel export
// 배선. presentational 컴포넌트는 수정 0 으로 default import 만(ADR-0041 Decision 1 — 패널은
// fetch 를 모른다). backend 계약(P7 @Controller("api/schedules"), ADR-0042)이 shipped 되어
// defer 사유 해소.
import SchedulePanel from '../components/SchedulePanel';
// T-0886 — P6 deferred wiring 완결(PLAN line120/123). 여섯 번째 패널 ReEvaluationTriggerPanel
// export 배선. presentational 컴포넌트는 수정 0 으로 default import 만(ADR-0041 Decision 1 —
// 패널은 fetch 를 모른다). backend 계약(POST /api/schedules/recent-deletion/:personId, Admin+,
// ADR-0038 reeval chain / RecentDeletionController)이 shipped 되어 defer 사유 해소. T-0885
// (SchedulePanel) 의 짝.
import ReEvaluationTriggerPanel from '../components/ReEvaluationTriggerPanel';
// T-1142 — P6 line120 Admin "인원(Person)" 관리 UI 마운트. 직전 slice(T-1141)가 신설한 순수
// presentational PersonList 를 AdminView 에 배선한다. 컴포넌트 수정 0 으로 default import +
// named type(PersonRow)만(ADR-0041 Decision 1 — 패널은 fetch 를 모른다). 실 fetch(GET
// /api/persons)는 아래 useApiResource 로 컨테이너가 소유하고, data/loading/error 를 props 로만
// 내려보낸다(T-1140 DashboardView 마운트 패턴 mirror — 읽기 전용, mutation/nonce 불요).
import PersonList from '../components/PersonList';
import type { PersonRow } from '../components/PersonList';
// T-1766 — ADR-0058 §Follow-ups (d) 여덟 번째 web slice(읽기 축). ServiceIdentityList(T-1762)는
// 수정 0 으로 default import 만(ADR-0041 Decision 1), row 타입·path 는 client 계약 재사용.
import ServiceIdentityList from '../components/ServiceIdentityList';
// T-1767 — ADR-0058 §Follow-ups (d) 쓰기 축 1/3(추가 POST). 폼(T-1763)은 controlled
// presentational 이라 입력 state·발사·재조회는 컨테이너 책임(ADR-0041 Decision 1).
import ServiceIdentityAddForm from '../components/ServiceIdentityAddForm';
// T-1768 — 쓰기 축 2/3(수정 PATCH). 폼(T-1764)도 controlled 이라 대상 선택·입력·발사는 컨테이너 책임.
import ServiceIdentityEditForm from '../components/ServiceIdentityEditForm';
import {
  deriveServiceIdentityRowActionsFlags,
  buildServiceIdentityRowActionBridge,
  buildServiceIdentityRowActionsProps,
  buildServiceIdentityRowActionsSlot,
  beginServiceIdentityEdit,
  type ServiceIdentityRowFlagsInput,
  type ServiceIdentityRowActionsFlags,
  type ServiceIdentityRowActionBridgeDeps,
  type ServiceIdentityRowActionBridge,
  type ServiceIdentityRowActionsWiringDeps,
  type BeginServiceIdentityEditDeps,
} from './adminServiceIdentityRowActions'; // T-1824 순수 추출 — 12 심볼의 정본은 새 모듈이고 본 컨테이너는 import + 파일 끝 목록 re-export 만 한다(기존 spec 6 개의 `from './AdminView'` 무수정 유지).
// ServiceIdentity mutation 러너 군(T-1852 순수 추출) — 네 러너와 그 입력/deps 타입 5 개의 정본이
// 옮겨간 모듈. 본문 무변경, AdminView 는 값만 import 한다(단방향). 파일 끝 export 목록이 네 러너를
// 그대로 re-export 하므로 기존 spec 5 개의 `from './AdminView'` 도 그대로 산다. deps 타입 5 개는
// 이동 전에도 AdminView 의 export 표면이 아니어서 재수출하지 않는다(공개 표면 무변경).
import {
  runCreateServiceIdentity,
  runUpdateServiceIdentity,
  runDeleteServiceIdentity,
  runSetPrimaryServiceIdentity,
} from './adminServiceIdentityRunners';
import {
  createServiceIdentity,
  updateServiceIdentity,
  deleteServiceIdentity,
  setPrimaryServiceIdentity,
} from '../api/serviceIdentity';
import type { ServiceIdentityRow } from '../api/serviceIdentity';
// 그룹 목록 마운트 대상(T-1148, T-1147 presentational) — default export 만 가져온다. GroupList 도
// 자체 GroupRow 를 named export 하지만 여기서는 import 하지 않고 AdminView 로컬 GroupRow(L327)를
// 그대로 props 로 넘긴다(구조적 타입 호환 — 중복 식별자·이름 충돌 회피, task Required Reading).
import GroupList from '../components/GroupList';
// 파트 목록 마운트 대상(T-1152, T-1151 presentational) — default PartList 와 named PartRow 타입을
// 함께 가져온다. AdminView 에는 로컬 PartRow 가 없어(파트 미조회) GroupRow 때와 달리 이름 충돌이
// 없으므로 named PartRow 를 그대로 조회 제네릭·props 타입에 재사용한다(task Required Reading).
import PartList from '../components/PartList';
import type { PartRow } from '../components/PartList';
// 사용자 목록 마운트 대상(T-1159, T-1158 presentational) — default UserList 와 named UserRow 타입을
// 함께 가져온다. AdminView 에는 로컬 UserRow 가 없어(사용자 미조회) 이름 충돌이 없으므로 named
// UserRow 를 그대로 조회 제네릭·props 타입에 재사용한다(PartRow 차용 convention 동형).
import UserList from '../components/UserList';
import type { UserRow } from '../components/UserList';
// 수집 대상 목록 마운트 대상(T-1825, ADR-0059 §Follow-ups (e)) — default CollectionTargetList 와
// 그 파일이 정본으로 들고 있는 named CollectionTargetRow 타입을 함께 가져온다. AdminView 에는
// 로컬 CollectionTargetRow 가 없어 이름 충돌이 없으므로 named 타입을 그대로 조회 제네릭·props
// 타입에 재사용한다(PartRow / UserRow 차용 convention 동형 — 별도 api client 모듈 신설 0).
import CollectionTargetList from '../components/CollectionTargetList';
import type { CollectionTargetRow } from '../components/CollectionTargetList';
// 수집 대상 등록 폼 마운트 대상(T-1826, ADR-0059 §Follow-ups (e) 편집 축) — 목록 아래에
// Admin+ 일 때만 렌더한다(POST 가 `@Roles("Admin")` 편집 tier).
import CollectionTargetAddForm, {
  COLLECTION_TARGET_TYPES,
} from '../components/CollectionTargetAddForm';
// 수집 대상 러너 군(T-1830 순수 추출) — 등록 POST · 삭제 DELETE · 활성 토글 PATCH 세 러너와 그
// 조회 path 상수를 담은 모듈. 본문은 한 줄도 바뀌지 않았고 AdminView 는 값만 import 한다(단방향).
// 아래 파일 끝 export 목록이 세 러너를 그대로 re-export 하므로 기존 spec 의 `from './AdminView'`
// 도 그대로 산다. COLLECTION_TARGETS_PATH 도 정본을 1 개로 유지하려 여기서 가져온다(재선언 금지).
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
// 그룹·파트 mutation 러너 군(T-1146 ~ T-1157)을 담는 격리 모듈(T-1854 순수 추출 — PLAN 183 행
// god component 부채의 넷째 실분할). AdminView → 본 모듈 단방향 import 이며, 파일 끝 export 목록이
// 러너 6 · helper 2 · deps 타입 6 을 그대로 re-export 해 기존 계약 spec 7 개의 `from './AdminView'` 가
// 무수정으로 산다(공개 표면 무변경).
import {
  runCreateGroup,
  runCreatePart,
  runDeleteGroup,
  runDeletePart,
  resolveSelectedPartIdAfterDelete,
  buildDeletePartBumpRefresh,
  runUpdateGroup,
  runUpdatePart,
} from './adminGroupPartMutationRunners';
import type {
  CreateGroupDeps,
  CreatePartDeps,
  DeleteGroupDeps,
  DeletePartDeps,
  UpdateGroupDeps,
  UpdatePartDeps,
} from './adminGroupPartMutationRunners';
// 인원(Person) mutation 러너 군(T-1143 ~ T-1145 · T-1780 · T-1781)을 담는 격리 모듈(T-1856 순수
// 추출 — PLAN 183 행 god component 부채의 다섯째 실분할). AdminView → 본 모듈 단방향 import 이며,
// 파일 끝 export 목록이 러너 3 · helper 2 · 입력/deps 타입 6 을 그대로 re-export 해 기존 spec 6 개의
// `from './AdminView'` 가 무수정으로 산다(공개 표면 무변경). PERSONS_PATH 는 T-1879 로 함께 옮겨진
// buildPersonsPath 가 새 모듈에서 직접 가져다 쓴다(정본 1 개 유지 — 재선언 금지).
import {
  extractCreatedPersonId,
  runCreatePerson,
  runDeletePerson,
  buildPersonPatch,
  runUpdatePerson,
} from './adminPersonMutationRunners';
import type {
  CreatePersonFields,
  CreatePersonDeps,
  DeletePersonDeps,
  PersonPatchInput,
  PersonPatch,
  UpdatePersonDeps,
} from './adminPersonMutationRunners';
// LLM provider mutation 러너 군(T-1135 ~ T-1137)을 담는 격리 모듈(T-1857 순수 추출 — PLAN 183 행
// god component 부채의 여섯째 실분할). AdminView → 본 모듈 단방향 import 이며, 파일 끝 export 목록이
// 러너 3 · 입력/deps 타입 5 를 그대로 re-export 해 기존 spec 4 개의 `from './AdminView'` 가 무수정으로
// 산다(공개 표면 무변경). LLM_PROVIDERS_PATH · LLM_MAPPINGS_PATH 는 T-1879 로 함께 옮겨진
// buildProvidersPath · buildMappingsPath 가 새 모듈에서 직접 가져다 쓴다(정본 1 개 유지 — 재선언 금지).
// T-1877 합류 — 난이도 매핑 assign 축(runAssign · AssignDeps)도 같은 모듈로 옮겨 여기서 되돌려 쓴다.
// 러너는 잔류 소비처 handleAssign 이 호출 형태 무변경으로 그대로 호출한다.
import {
  runDeleteProvider,
  runCreateProvider,
  runUpdateProvider,
  runAssign,
} from './adminLlmProviderMutationRunners';
import type {
  DeleteProviderDeps,
  CreateProviderFields,
  CreateProviderDeps,
  UpdateProviderFields,
  UpdateProviderDeps,
  AssignDeps,
} from './adminLlmProviderMutationRunners';
// 자원 목록 조회 path 빌더 축(T-1879 순수 추출 — PLAN 183 행 god component 부채의 열다섯째
// 실분할). 여덟 빌더는 본문 한 줄도 바뀌지 않은 채 통째로 옮겨졌고, AdminView 는 단방향 import 로
// 되돌려 쓴다(본 모듈은 AdminView 를 import 하지 않는다). 여덟 호출부는 호출 형태 무변경이며
// 파일 끝 export 배럴이 여덟 이름을 그대로 re-export 해 기존 spec 이 무수정으로 산다.
import {
  buildMappingsPath,
  buildProvidersPath,
  buildPersonsPath,
  buildGroupsPath,
  buildPartsPath,
  buildUsersPath,
  buildPartPersonsPath,
  buildServiceIdentitiesPath,
} from './adminResourcePathBuilders';
// T-1711 (REQ-067) — 사용자 추가 폼의 아이디·비밀번호 조건 사전 안내 문구. 여기서 문구를 새로
// 쓰지 않고 SuperAdmin 초기 셋업 폼(T-1710)이 이미 export 한 상수를 재사용한다 — 두 화면이 같은
// backend 계약(POST /api/users 의 AddUserDto: @IsEmail + @IsNotEmpty + @MinLength)을 쓰므로
// 문구가 두 벌이 되면 규칙 변경 시 한쪽만 갱신되는 drift 가 생긴다. 컴포넌트 자체는 마운트하지
// 않고 상수만 named import 한다(SuperAdminSetupForm 수정 0).
import {
  USERNAME_HINT_TEXT,
  PASSWORD_HINT_TEXT,
} from '../components/SuperAdminSetupForm';

// T-1882 순수 추출 — 렌더 비의존 정적 표면(문구 · DOM id 상수 군 + 폼 옵션 · in-flight 게이트
// 축)의 정본이 새 모듈로 옮겨갔고, 본 컨테이너는 단방향 import 로 값을 되돌려 쓴다(본문 무변경).
// 파일 끝 export 배럴이 공개 심볼 4 개를 그대로 re-export 하므로 기존 spec 의 `from './AdminView'`
// 는 무수정으로 산다(공개 표면 무변경).
import {
  AUTH_ME_PATH,
  COLLECTION_TARGET_HEADING,
  CREATE_USER_EMAIL_HINT_ID,
  CREATE_USER_PASSWORD_HINT_ID,
  EMPTY_COLLECTION_TARGET_TEXT,
  EMPTY_MEMBER_TEXT,
  EMPTY_PART_PERSON_TEXT,
  EXPORT_SCOPE_OPTIONS,
  FALLBACK_GROUP_NAME,
  GROUP_HEADING,
  INSTANCE_ACCESS_NO_USER_LABEL,
  LLM_PROVIDER_OPTIONS,
  LLM_PROVIDER_PLACEHOLDER_LABEL,
  NOT_ADMIN_NOTICE_TEXT,
  NO_GROUP_SELECTED_TEXT,
  NO_PART_SELECTED_TEXT,
  NO_PERSON_SELECTION_LABEL,
  NO_SELECTION_LABEL,
  PART_HEADING,
  PART_NO_SELECTION_LABEL,
  PERSON_HEADING,
  PERSON_INCLUDE_INACTIVE_LABEL,
  REEVAL_WINDOW_OPTIONS,
  SERVICE_IDENTITY_NOT_ADMIN_NOTICE_TEXT,
  USER_HEADING,
  createInFlightIdGate,
  resolveProviderSelectValue,
} from './adminViewConstants';
import type { InFlightIdGate } from './adminViewConstants';

// GET /api/auth/me 응답의 frontend-local 최소 타입(④h) — api.md 71 의 5 필드 중 본 slice 가
// 등급 파생에 쓰는 role 후보만 보수적으로 매핑한다. role 을 선택적으로 두어 누락/비정상 응답
// (role 없음/null)도 throw 없이 수용한다(③a~④g 의 frontend-local 최소 타입 convention 정합 —
// id/email/createdAt/updatedAt 등 잔여 필드는 무시). 등급 파생은 isAdminRole 이 책임진다.
interface MeRow {
  role?: string | null;
}

interface AdminViewProps {
  // 초기 선택 그룹 id(선택) — renderToStaticMarkup 정적 검증을 위해 초기값 주입을 허용한다
  // (③a~③b-3 의 initial* 주입 패턴 정합). 미주입 시 그룹 미선택(빈 멤버 안내) 으로 시작한다.
  initialSelectedGroupId?: string;
  // 초기 cron 식 입력값(선택, T-0885) — 위 initialSelectedGroupId 와 동일한 정적 검증용 초기값
  // 주입 affordance. 미주입 시 빈 cron 입력으로 시작한다(controlled lift-up — 컨테이너 소유).
  initialCronExpression?: string;
  // 초기 스케줄 busy 상태(선택, T-0885) — apply/trigger in-flight 시 SchedulePanel 이 진행 표시로
  // 컨트롤을 억제하는 분기를 정적 렌더로 검증하기 위한 초기값 주입 affordance. 미주입 시 false.
  initialScheduleBusy?: boolean;
  // 초기 선택 person id(선택, T-0886) — 정적 렌더 검증용 초기값 주입 affordance(initialSelectedGroupId
  // 동형). 미주입 시 person 미선택으로 시작한다(controlled lift-up — 컨테이너 소유).
  initialSelectedPersonId?: string;
  // 초기 선택 재수집 window days(선택, T-0886) — 정적 렌더 검증용. 미주입 시 0(windows 미매칭 →
  // ReEvaluationTriggerPanel 이 placeholder 로 fallback + 트리거 버튼 비활성 — 경계값 안전).
  initialSelectedDays?: number;
  // 초기 재평가 submitting 상태(선택, T-0886) — 재평가 in-flight 시 패널이 진행 표시로 컨트롤을
  // 억제하는 분기를 정적 렌더로 검증하기 위한 초기값 주입 affordance. 미주입 시 false.
  initialReevalSubmitting?: boolean;
  // 초기 선택 파트 id(선택, T-1156) — 정적 렌더 검증용 초기값 주입 affordance(initialSelectedGroupId
  // 동형). 미주입 시 파트 미선택으로 시작해 소속 인원을 조회하지 않는다(조건부 조회 idle).
  initialSelectedPartId?: string;
  // 초기 import 확인 문구(선택, T-1309) — preview 성공 후의 확인 단계 분기를 정적 렌더로 검증하기
  // 위한 초기값 주입 affordance(initialScheduleBusy 동형). 미주입 시 undefined 라 확인 단계에
  // 진입하지 않는다 — 즉 실제 사용 경로의 초기 상태와 완전히 동일하다(회귀 0).
  initialImportConfirmText?: string;
  // 초기 service identity 조회 대상 인원 id(선택, T-1766) — 정적 렌더 검증용 주입 affordance
  // (initialSelectedPartId 동형). 미주입 시 미선택 = 조회 idle(실사용 초기 상태 동일).
  initialSelectedIdentityPersonId?: string;
  // 초기 수정 대상 identity id(선택, T-1768) — 정적 렌더 검증용 주입(미주입 시 폼 미마운트).
  initialEditingIdentityId?: string;
  // 초기 "휴직 인원 포함" 토글 값(선택, T-1804) — 정적 렌더 검증용 주입 affordance
  // (initialScheduleBusy 동형). 미주입 시 false = 활성 인원만 조회하는 실사용 초기 상태와 동일.
  initialPersonsIncludeInactive?: boolean;
}

// 등급 문자열 → Admin+ 여부 파생(순수 helper, ④h). backend role enum(api.md 71 —
// "SuperAdmin"/"Admin"/"User")과 정확히 대소문자까지 매칭한다. role === 'Admin' ||
// role === 'SuperAdmin' 이면 true, 그 외("User")/undefined/null/빈값/조회 전/소문자 같은
// enum 불일치는 모두 false 다(fail-closed — 등급이 불명확하면 Admin 권한을 부여하지 않는다).
// 조회 실패·응답 누락·loading 중에도 role 이 Admin/SuperAdmin 으로 확정되지 않으므로 false 로
// 안전하게 떨어진다(비-Admin 에게 Admin 패널을 노출하지 않는 안전 기본값).
function isAdminRole(role: string | null | undefined): boolean {
  return role === 'Admin' || role === 'SuperAdmin';
}

// Admin 화면 컨테이너. useApiResource 로 GET /api/groups 결과를 소유하고, 선택 그룹 상태를
// useState 로 보유해 선택 그룹의 멤버를 client-side 파생 후 GroupMemberList 에 props 로
// 내려보낸다(controlled lift-up — GroupMemberList 는 fetch 를 모른다, ADR-0041 Decision 1).
function AdminView({
  initialSelectedGroupId = '',
  initialCronExpression = '',
  initialScheduleBusy = false,
  initialSelectedPersonId = '',
  initialSelectedDays = 0,
  initialReevalSubmitting = false,
  initialSelectedPartId = '',
  initialImportConfirmText,
  initialSelectedIdentityPersonId = '',
  initialEditingIdentityId = '',
  initialPersonsIncludeInactive = false,
}: AdminViewProps) {
  // 선택 그룹 상태 — controlled lift-up(컨테이너 소유). <select> 선택이 이 값을 갱신한다.
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    initialSelectedGroupId,
  );

  // 그룹 목록 조회 — useApiResource 로 그룹 <select> 옵션의 원천을 조회한다(④a 책임 경계).
  // T-1129 부터 GroupMemberList 의 loading/error 는 그룹 조회가 아니라 선택 그룹 멤버십 조회
  // (아래 useApiResource<MembershipRow[]>)가 소유하므로, 그룹 조회의 loading/error 는 별도로
  // 구독하지 않고 data 만 소비한다(그룹 조회 실패 시 옵션 빈 목록으로 안전 표시 — 그룹 조회
  // 실패 표면화는 본 slice Out of Scope).
  // 그룹 재조회 nonce(T-1146) — 그룹 생성 POST 성공 시 이 값을 +1 해 groups path 를 변화시켜
  // useApiResource 재조회를 유발한다(read-only hook 수정 0 경로 — personsRefreshNonce 동형).
  // nonce 0 초기 마운트는 base path(GROUPS_PATH) 그대로다(T-1129 이전 마운트와 동일 — 회귀 0).
  const [groupsRefreshNonce, setGroupsRefreshNonce] = useState<number>(0);

  // 그룹 목록 조회 path(T-1146) — nonce-aware 빌더로 전환(buildGroupsPath). nonce 0 이면 base
  // path, 생성 성공 후 nonce 증가가 `_r` query 로 재조회를 낸다(buildPersonsPath mirror).
  const groupsPath = useMemo(
    () => buildGroupsPath(groupsRefreshNonce),
    [groupsRefreshNonce],
  );

  // 그룹 목록 조회(T-1146 select·생성 폼 원천, T-1148 목록 카드 마운트로 loading/error 재사용).
  // 기존엔 data 만 소비했으나, 본 slice 가 GroupList 를 마운트하며 새 useApiResource 호출을
  // 추가하지 않고(double-fetch 회피) 같은 조회의 loading/error 를 함께 destructure 해 GroupList
  // props 로 내려보낸다. 변수명에 group prefix 를 붙여 인원/멤버십/LLM 조회 상태와 섞이지 않게
  // 분리한다(personLoading/personError 동형). select 드롭다운·파생은 그대로 data 만 소비한다.
  const {
    data,
    loading: groupLoading,
    error: groupError,
  } = useApiResource<GroupRow[]>(groupsPath);

  // 현재 사용자 등급 조회(④h) — useApiResource 네 번째 호출(GET /api/auth/me, User+). 응답
  // role 만 소비해 Admin+ 여부를 파생한다. 조회 실패/loading/응답 누락은 모두 isAdmin=false
  // 로 fail-closed 처리되므로(아래 useMemo), error 를 별도 표시하지 않고 gating 안내로 흡수한다
  // — Admin 패널 의존 endpoint 가 Admin+(403)라 비-Admin 에게는 패널 자체를 숨기면 충분하다.
  const { data: meData, loading: meLoading } =
    useApiResource<MeRow>(AUTH_ME_PATH);

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

  // service identity 읽기 축 배선(T-1766) — 조회 대상 인원 상태(controlled lift-up, 컨테이너
  // 소유). 인원 관리 섹션 전용 <select> 가 이 값을 갱신한다. 재평가 패널의 selectedPersonId 를
  // 재사용하지 않는 것은 두 화면의 선택이 서로를 덮으면 안 되기 때문이다(각 화면 독립 소유).
  const [selectedIdentityPersonId, setSelectedIdentityPersonId] =
    useState<string>(initialSelectedIdentityPersonId);

  // 조회 대상 인원 변경 — 빈 값 선택 시 미선택으로 되돌아가 조회가 idle 로 떨어진다.
  const handleIdentityPersonChange = (event: {
    target: { value: string };
  }) => {
    setSelectedIdentityPersonId(event.target.value);
  };

  // 목록 재조회 nonce(T-1767) — 추가 성공 시 +1 해 조회 path 를 바꿔 권위 재조회를 낸다.
  const [serviceIdentitiesRefreshNonce, setServiceIdentitiesRefreshNonce] =
    useState<number>(0);

  // 선택 인원의 identity 조회 path — 선택 변경 시 path 가 달라져 자동 refetch 하고 이전 인원의
  // 목록은 잔존하지 않는다. nonce 를 함께 넘겨 추가 성공 후에도 다시 조회한다(T-1767 — 실패
  // 시에는 bump 하지 않아 목록이 그대로 유지된다).
  const serviceIdentitiesPath = useMemo(
    () =>
      buildServiceIdentitiesPath(
        selectedIdentityPersonId || undefined,
        serviceIdentitiesRefreshNonce,
      ),
    [selectedIdentityPersonId, serviceIdentitiesRefreshNonce],
  );

  // 선택 인원의 service identity 조회 — loading/error 는 컨테이너가 받아 ServiceIdentityList 의
  // 대응 props 로 내려보낸다(ADR-0041 Decision 1). 404/403/5xx/네트워크 실패는 hook 의 사람-친화
  // 문구(toErrorMessage 경로)로 안전 표시된다(throw 없음).
  const {
    data: serviceIdentityData,
    loading: serviceIdentityLoading,
    error: serviceIdentityError,
  } = useApiResource<ServiceIdentityRow[]>(serviceIdentitiesPath);

  // 표시용 identity 목록 — 비정상 payload(객체·null·문자열)이거나 미조회/진행 중/실패로
  // undefined 여도 빈 배열로 방어한다(partPersons 선례 — undefined.length 로 깨지지 않도록).
  const serviceIdentities = useMemo(
    () => (Array.isArray(serviceIdentityData) ? serviceIdentityData : []),
    [serviceIdentityData],
  );

  // 추가 2 controlled input(T-1767) — 성공 후 둘 다 빈 값으로 되돌린다.
  const [identityServiceInput, setIdentityServiceInput] = useState<string>('');
  const [identityExternalIdInput, setIdentityExternalIdInput] =
    useState<string>('');
  // 추가 in-flight 플래그(폼 loading + 동시 재호출 가드 겸용)와 실패 문구(폼 하단 안전 표시).
  const [creatingServiceIdentity, setCreatingServiceIdentity] =
    useState<boolean>(false);
  const [createServiceIdentityError, setCreateServiceIdentityError] = useState<
    string | undefined
  >(undefined);

  // 추가 실 mutation 핸들러(T-1767) — 러너에 deps 주입해 호출만 한다. 입력값·in-flight·선택
  // 인원을 deps 배열에 포함해 stale 없이 최신 값으로 발사한다.
  const handleCreateServiceIdentity = useCallback(
    () =>
      runCreateServiceIdentity(
        selectedIdentityPersonId,
        {
          service: identityServiceInput,
          externalId: identityExternalIdInput,
        },
        {
          create: createServiceIdentity,
          describeError: toErrorMessage,
          creating: creatingServiceIdentity,
          setCreating: setCreatingServiceIdentity,
          setCreateError: setCreateServiceIdentityError,
          bumpRefresh: () => setServiceIdentitiesRefreshNonce((n) => n + 1),
          resetInput: () => {
            setIdentityServiceInput('');
            setIdentityExternalIdInput('');
          },
        },
      ),
    [
      selectedIdentityPersonId,
      identityServiceInput,
      identityExternalIdInput,
      creatingServiceIdentity,
    ],
  );
  // 수정 편집 state 4 개(T-1768) — 대상 id(빈 문자열이 미편집) · 입력 · in-flight · 실패 문구.
  const [editingIdentityId, setEditingIdentityId] =
    useState<string>(initialEditingIdentityId);
  const [identityEditExternalIdInput, setIdentityEditExternalIdInput] =
    useState<string>('');
  const [updatingServiceIdentity, setUpdatingServiceIdentity] =
    useState<boolean>(false);
  const [updateServiceIdentityError, setUpdateServiceIdentityError] = useState<
    string | undefined
  >(undefined);
  // 수정 대상 row 파생 — 목록에서 id 로 찾는다(새 fetch 0). 사라진 대상이면 폼이 자연히 접힌다.
  const editingIdentity = useMemo(
    () => serviceIdentities.find((row) => row.id === editingIdentityId),
    [serviceIdentities, editingIdentityId],
  );
  // 수정 대상 선택 변경 — 대상 id 갱신 + 그 row 의 externalId 로 prefill + 직전 실패 문구 비움.
  const handleEditTargetChange = (event: { target: { value: string } }) => {
    const nextId = event.target.value;
    setEditingIdentityId(nextId);
    setIdentityEditExternalIdInput(
      serviceIdentities.find((row) => row.id === nextId)?.externalId ?? '',
    );
    setUpdateServiceIdentityError(undefined);
  };
  const endServiceIdentityEdit = useCallback(() => {
    setEditingIdentityId('');
    setIdentityEditExternalIdInput('');
    setUpdateServiceIdentityError(undefined);
  }, []);
  // 수정 실 mutation 핸들러 — 러너에 deps 주입해 호출만. 인원·대상·입력·in-flight 로 stale 방지.
  const handleUpdateServiceIdentity = useCallback(
    () =>
      runUpdateServiceIdentity(
        selectedIdentityPersonId,
        editingIdentityId,
        { externalId: identityEditExternalIdInput },
        {
          update: updateServiceIdentity,
          describeError: toErrorMessage,
          updating: updatingServiceIdentity,
          setUpdating: setUpdatingServiceIdentity,
          setUpdateError: setUpdateServiceIdentityError,
          bumpRefresh: () => setServiceIdentitiesRefreshNonce((n) => n + 1),
          endEdit: endServiceIdentityEdit,
        },
      ),
    [
      selectedIdentityPersonId,
      editingIdentityId,
      identityEditExternalIdInput,
      updatingServiceIdentity,
      endServiceIdentityEdit,
    ],
  );

  // 행 액션 state 4 종(T-1777 — ADR-0058 §Follow-ups (d) 마감 결선). 목록 전체에 각각 하나씩만
  // 두는 slot 이며, 앞 3 종은 boolean 이 아니라 "대상 행 id" 다 — 행 단위 플래그 파생
  // (deriveServiceIdentityRowActionsFlags)이 id 비교로 판정해야 다른 행의 진행 · 확인 · 실패가
  // 이 행을 물들이지 않기 때문이다. undefined 가 "해당 행 없음" 이다.
  const [identityActionBusyId, setIdentityActionBusyId] = useState<
    string | undefined
  >(undefined);
  const [confirmingDeleteIdentityId, setConfirmingDeleteIdentityId] = useState<
    string | undefined
  >(undefined);
  const [identityActionErrorId, setIdentityActionErrorId] = useState<
    string | undefined
  >(undefined);
  const [identityActionErrorText, setIdentityActionErrorText] = useState<
    string | undefined
  >(undefined);
  // 진행 id 의 동기 사본 + gate(changingRoleGate 선례 그대로 — 새로 구현하지 않는다). 위 state 는
  // 렌더 표면이라 같은 tick 의 두 번째 발사가 stale 값을 본다. 러너 가드는 gate.read() 로 ref 를 읽고,
  // 둘은 createInFlightIdGate 가 ref → state 순서로 함께 갱신한다.
  const identityActionBusyIdRef = useRef<string | undefined>(undefined);
  const identityActionGate = useMemo(
    () => createInFlightIdGate(identityActionBusyIdRef, setIdentityActionBusyId),
    [],
  );

  // 행 편집 진입(T-1776 helper 호출만 — 진입 로직 인라인 재작성 금지). 주입하는 6 종이 모두
  // useState setter 라 참조가 stable 하므로 deps 는 빈 배열이다.
  const handleBeginServiceIdentityEdit = useCallback(
    (identity: ServiceIdentityRow) =>
      beginServiceIdentityEdit(identity, {
        setEditingIdentityId,
        setEditExternalIdInput: setIdentityEditExternalIdInput,
        setUpdateError: setUpdateServiceIdentityError,
        setConfirmingDeleteId: setConfirmingDeleteIdentityId,
        setErrorIdentityId: setIdentityActionErrorId,
        setErrorText: setIdentityActionErrorText,
      }),
    [],
  );

  // 행 액션 배선 deps 14 필드(T-1773 계약) — remove 에 deleteServiceIdentity, setPrimary 에
  // setPrimaryServiceIdentity 를 꽂는다. 두 primitive 는 시그니처가 같아 교차 배선이 컴파일을
  // 통과하므로 spec 이 호출 인자까지 검증한다. personId 는 조회 <select> 가 고른 인원이라
  // 미선택('')이면 러너 가드가 발사 없이 접는다.
  const serviceIdentityRowActionsDeps =
    useMemo<ServiceIdentityRowActionsWiringDeps>(
      () => ({
        gate: identityActionGate,
        setErrorIdentityId: setIdentityActionErrorId,
        setErrorText: setIdentityActionErrorText,
        personId: selectedIdentityPersonId,
        onEdit: handleBeginServiceIdentityEdit,
        remove: deleteServiceIdentity,
        setPrimary: setPrimaryServiceIdentity,
        describeError: toErrorMessage,
        bumpRefresh: () => setServiceIdentitiesRefreshNonce((n) => n + 1),
        confirmingDeleteId: confirmingDeleteIdentityId,
        setConfirmingDeleteId: setConfirmingDeleteIdentityId,
        busyIdentityId: identityActionBusyId,
        errorIdentityId: identityActionErrorId,
        errorText: identityActionErrorText,
      }),
      [
        identityActionGate,
        selectedIdentityPersonId,
        handleBeginServiceIdentityEdit,
        confirmingDeleteIdentityId,
        identityActionBusyId,
        identityActionErrorId,
        identityActionErrorText,
      ],
    );
  // 목록에 내려보낼 행 액션 slot — props 조립은 factory(T-1773/T-1775) 책임이라 손으로 만들지
  // 않는다. deps 가 바뀔 때만 새 함수를 만들어 <ServiceIdentityList> 의 prop 정체성을 안정화한다.
  const serviceIdentityRowActionsSlot = useMemo(
    () => buildServiceIdentityRowActionsSlot(serviceIdentityRowActionsDeps),
    [serviceIdentityRowActionsDeps],
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

  // 그룹 생성 controlled input 상태(T-1146) — 컨테이너 소유. "그룹 추가" 클릭 시 handleCreateGroup
  // 이 POST body 의 name 필드로 공급하고, 성공 후 빈 값으로 되돌린다(연속 생성 편의). 인원 생성의
  // fullNameInput 패턴 mirror(그룹은 name 단일 필드).
  const [groupNameInput, setGroupNameInput] = useState<string>('');

  // 그룹 생성 mutation in-flight 플래그(T-1146) — POST 진행 중 true. 진행 표시(입력·버튼 비활성)와
  // 동시 재호출 가드(이전 mutation 미완 중 재발사 차단)에 함께 쓴다(creatingPerson 동형).
  const [creatingGroup, setCreatingGroup] = useState<boolean>(false);

  // 그룹 생성 mutation 실패 문구(T-1146) — POST 실패 시 사람-친화 문구(toErrorMessage 파생)를
  // 보관해 폼 하단에 안전 표시한다(throw 없음). 성공/재시도 시작 시 비운다.
  const [createGroupError, setCreateGroupError] = useState<string | undefined>(
    undefined,
  );

  // 그룹 생성 실 mutation 핸들러(T-1146) — 그룹 생성 POST(/api/groups, body `{ name }`)를 컨테이너
  // 내부 async 로 발사한다(handleCreatePerson 정합). 빈/공백 name·이전 mutation 미완(creatingGroup)
  // 발사 억제 + 성공(그룹 재조회 + 입력 초기화)/실패(error 안전 표시, throw 없음) 전이는 runCreateGroup
  // 이 캡슐화한다. 입력값·creatingGroup 을 deps 의존성에 포함해 stale 없이 최신 입력·가드 상태로 발사한다.
  const handleCreateGroup = useCallback(
    () =>
      runCreateGroup(groupNameInput, {
        create: request,
        describeError: toErrorMessage,
        creating: creatingGroup,
        setCreating: setCreatingGroup,
        setCreateError: setCreateGroupError,
        bumpRefresh: () => setGroupsRefreshNonce((n) => n + 1),
        resetInput: () => setGroupNameInput(''),
      }),
    [groupNameInput, creatingGroup],
  );

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

  // 그룹 삭제 mutation in-flight 플래그(T-1149) — DELETE 진행 중 true. 진행 표시(loading 우선)와
  // 동시 재호출 가드(이전 mutation 미완 중 재호출 차단)에 함께 쓴다(deletingPerson 동형).
  const [deletingGroup, setDeletingGroup] = useState<boolean>(false);

  // 그룹 삭제 mutation 실패 문구(T-1149) — DELETE 실패 시 사람-친화 문구(toErrorMessage 파생)를
  // 보관해 목록 패널의 error props 로 안전 표시한다(throw 없음). 성공/재시도 시작 시 비운다.
  const [deleteGroupError, setDeleteGroupError] = useState<string | undefined>(
    undefined,
  );

  // onDelete 실 mutation 핸들러(T-1149) — 그룹 삭제 DELETE(/api/groups/:id)를 컨테이너 내부 async
  // 로 발사한다(신규 mutation hook 미작성 — runDeletePerson 정합). 빈/공백/falsy id·이전 mutation
  // 미완(deletingGroup) 발사 억제 + 성공(그룹 재조회 트리거)/실패(error 안전 표시, throw 없음) 전이는
  // runDeleteGroup 이 캡슐화한다. deletingGroup 을 deps 의존성에 포함해 stale 없이 최신 가드 상태로
  // 발사한다.
  const handleDeleteGroup = useCallback(
    (id: string) =>
      runDeleteGroup(id, {
        remove: request,
        describeError: toErrorMessage,
        deleting: deletingGroup,
        setDeleting: setDeletingGroup,
        setDeleteError: setDeleteGroupError,
        bumpRefresh: () => setGroupsRefreshNonce((n) => n + 1),
      }),
    [deletingGroup],
  );

  // 편집 대상 group id(T-1150) — null 이면 편집 안 함(인라인 수정 폼 미렌더). GroupList 각 행의
  // "수정" 버튼 클릭 시 해당 row.id 로 채우고, 성공/취소 시 null 로 되돌린다. 편집 폼 렌더 분기
  // 기준값(editingPersonId 동형).
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  // 그룹 수정 name controlled input 상태(T-1150) — 컨테이너 소유. "수정" 클릭 시 해당 row 의 현재
  // name 으로 prefill 한다(그룹은 편집 필드가 name 하나뿐 — 인원의 3 입력 대비 단순). handleUpdateGroup
  // 이 편집 시작 원본 name(editGroupOriginalName)과 함께 러너에 넘겨 미변경 skip 을 판정한다.
  const [editGroupNameInput, setEditGroupNameInput] = useState<string>('');

  // 편집 시작 시점의 원본 name 스냅샷(T-1150) — runUpdateGroup 이 현재 입력과 비교해 미변경이면
  // 발사를 억제하는 데 쓴다(buildPersonPatch 의 원본 스냅샷 역할을 name 단일 필드로 축소). "수정"
  // 클릭 시 클릭한 row 의 현재 name 으로 채우고, 편집 종료 시 빈 문자열로 되돌린다.
  const [editGroupOriginalName, setEditGroupOriginalName] = useState<string>('');

  // 그룹 수정 mutation in-flight 플래그(T-1150) — PATCH 진행 중 true. 진행 표시(입력·버튼 비활성)와
  // 동시 재호출 가드(이전 mutation 미완 중 재발사 차단)에 함께 쓴다(updatingPerson 동형).
  const [updatingGroup, setUpdatingGroup] = useState<boolean>(false);

  // 그룹 수정 mutation 실패 문구(T-1150) — PATCH 실패 시 사람-친화 문구(toErrorMessage 파생)를 보관해
  // 편집 폼 하단에 안전 표시한다(throw 없음, 생성/삭제 error 와 별도 문구). 성공/재시도/편집 시작 시 비운다.
  const [updateGroupError, setUpdateGroupError] = useState<string | undefined>(
    undefined,
  );

  // 편집 폼 닫기(편집 상태 종료) helper(T-1150) — 편집 대상 id·name 입력·원본 스냅샷을 모두 기본값으로
  // 되돌린다. 성공 후 closeEdit·취소 버튼 두 경로가 공유한다(resetEditPersonForm 동형).
  const resetEditGroupForm = useCallback(() => {
    setEditingGroupId(null);
    setEditGroupNameInput('');
    setEditGroupOriginalName('');
  }, []);

  // "수정" 버튼 클릭 핸들러(T-1150) — GroupList.onEdit 로 내려보낸다. 클릭한 row 의 현재 name 으로 폼을
  // prefill 하고(data 에서 id 매칭) 원본 name 스냅샷도 함께 세팅한다(미변경 판정 기준). 직전 수정
  // error 도 비워 새 편집 세션을 깨끗이 시작한다(handleEditPerson 동형).
  const handleEditGroup = useCallback(
    (id: string) => {
      const row = (data ?? []).find((group) => group.id === id);
      const name = row?.name ?? '';
      setEditingGroupId(id);
      setEditGroupNameInput(name);
      setEditGroupOriginalName(name);
      setUpdateGroupError(undefined);
    },
    [data],
  );

  // 편집 취소 핸들러(T-1150) — 인라인 폼을 닫고 입력·error 를 비운다(발사 없이 편집 상태만 종료).
  // 진행 중(updatingGroup)일 때는 취소를 억제해 PATCH 완료 전 폼이 사라지지 않게 한다(버튼 disabled +
  // 핸들러 가드 이중, handleCancelEditPerson 동형).
  const handleCancelEditGroup = useCallback(() => {
    if (updatingGroup) {
      return;
    }
    resetEditGroupForm();
    setUpdateGroupError(undefined);
  }, [updatingGroup, resetEditGroupForm]);

  // 그룹 수정 실 mutation 핸들러(T-1150) — 그룹 수정 PATCH(/api/groups/:id, body `{ name }`)를 컨테이너
  // 내부 async 로 발사한다(handleUpdatePerson 정합). 빈/falsy id·이전 mutation 미완(updatingGroup)·빈·
  // 공백 name·미변경 name 발사 억제 + 성공(그룹 재조회 + 편집 종료)/실패(error 안전 표시, throw 없음)
  // 전이는 runUpdateGroup 이 캡슐화한다. 입력 name·원본·편집 대상 id·updatingGroup 을 deps 의존성에
  // 포함해 stale 없이 최신 입력·가드 상태로 발사한다.
  const handleUpdateGroup = useCallback(
    () =>
      runUpdateGroup(
        editingGroupId ?? '',
        editGroupNameInput,
        editGroupOriginalName,
        {
          update: request,
          describeError: toErrorMessage,
          updating: updatingGroup,
          setUpdating: setUpdatingGroup,
          setUpdateError: setUpdateGroupError,
          bumpRefresh: () => setGroupsRefreshNonce((n) => n + 1),
          closeEdit: resetEditGroupForm,
        },
      ),
    [
      editingGroupId,
      editGroupNameInput,
      editGroupOriginalName,
      updatingGroup,
      resetEditGroupForm,
    ],
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

  // Admin+ 여부 파생(④h) — me 응답의 role 을 isAdminRole 로 판정한다. role 이 Admin/SuperAdmin
  // 으로 확정될 때만 true 이고, 조회 전(meData undefined)/loading/실패/role 누락/비-Admin 은 모두
  // false 다(fail-closed). loading 중에도 false 라 등급 확정 전에는 Admin 패널이 노출되지 않는다
  // (깜빡임 최소 — 안정화 후 노출). meLoading 은 의존성에 포함하되 false 분기를 바꾸지 않는다
  // (loading→확정 전이 시 재계산 트리거 — stale-Admin 노출 방지).
  const isAdmin = useMemo(
    () => !meLoading && isAdminRole(meData?.role),
    [meData, meLoading],
  );

  // SuperAdmin 여부 파생(T-1162 — 위 isAdmin 동형, 판정만 최상위 등급 정확 매칭). PATCH
  // /api/users/:id/role 이 @Roles("SuperAdmin") 이므로 이 파생이 true 일 때만 역할 변경 콜백을
  // UserList 로 내려 확정 403 요청을 사전 차단한다. loading / 조회 실패 / meData 부재 / role
  // 누락 / 'superadmin' 같은 enum 불일치는 모두 false(fail-closed — 대소문자 관대 처리 없음).
  const isSuperAdmin = useMemo(
    () => !meLoading && meData?.role === 'SuperAdmin',
    [meData, meLoading],
  );

  // 표시용 그룹 목록 — data 미도착이면 빈 배열로 간주한다(<select> 옵션·파생의 안전 기준).
  const groups = useMemo(() => (Array.isArray(data) ? data : []), [data]);

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

  // import/export 축 hook(T-1884) — export/import 상태 9 + 핸들러 5 + 패널 props 파생 1 을
  // useAdminImportExport 로 순수 추출했다(동작 변경 0). 컨테이너는 소비처 JSX 3 곳이 쓰는 3 심볼만
  // 되돌려 쓰고, 축 내부 setter 는 hook 안에 캡슐화된다.
  const { selectedScope, handleScopeChange, importExportPanelProps } =
    useAdminImportExport(initialImportConfirmText);

  // === 스케줄 패널 배선(T-0885) — 다섯 번째 패널 ==========================================
  // cron 식 입력 상태 — controlled lift-up(컨테이너 소유). SchedulePanel 의 onCronChange 가
  // 이 값을 갱신하고, handleApply 가 PUT body 의 cronExpression 으로 공급한다.
  const [cronExpression, setCronExpression] =
    useState<string>(initialCronExpression);

  // apply/trigger in-flight 플래그 — SchedulePanel 이 단일 busy 슬롯으로 두 컨트롤을 억제하므로
  // (busy=true 면 입력·버튼 미렌더 → 중복 트리거 원천 차단) 하나의 busy 상태를 공유한다. 진행 표시
  // (busy 우선)와 이중 발사 가드(runApply/runTrigger 의 busy 가드)에 함께 쓴다(④d exporting 동형).
  const [scheduleBusy, setScheduleBusy] = useState<boolean>(initialScheduleBusy);

  // apply/trigger 완료 안내 문구 — 성공 시 사람-친화 완료 안내를 보관해 message props 로 표시한다.
  // 재발화 시작·실패 시 비운다(④d exportMessage 동형). GET 파생 안내보다 우선(최신 피드백).
  const [scheduleMessage, setScheduleMessage] = useState<string | undefined>(
    undefined,
  );

  // apply/trigger 실패 문구 — 실패 시 사람-친화 문구(toErrorMessage 파생)를 보관해 error props 로
  // 안전 표시한다(throw 없음). 재발화 시작 시 비운다(④d exportError 동형).
  const [scheduleError, setScheduleError] = useState<string | undefined>(
    undefined,
  );

  // 등록 스케줄 목록 조회(GET /api/schedules, Admin+) — useApiResource 다섯 번째 호출. 응답
  // string[](등록 schedule name 목록)·loading·error 를 컨테이너가 받아 message/error props 로
  // 내려보낸다(Decision 1 — 패널은 fetch 를 모른다). Admin+ 라 User 는 403→error props 안전 표시.
  const {
    data: scheduleData,
    loading: scheduleLoading,
    error: scheduleGetError,
  } = useApiResource<string[]>(SCHEDULES_PATH);

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

  // 사용자 목록 조회(GET /api/users, T-1159 마운트, REQ-044/REQ-045) — useApiResource 신규 호출.
  // 파트처럼 재사용할 기존 사용자 fetch 가 없어(AdminView 사용자 미조회) 신규 단일 호출이 정당하다
  // (double-fetch 대상 부재). 변수명에 user prefix 를 붙여 인원/그룹/파트/멤버십 등 다른 조회 상태와
  // 섞이지 않게 분리한다(partLoading/partError 동형). T-1160 에서 생성 mutation 이 붙어 정적 path
  // 대신 nonce-aware buildUsersPath 조회로 전환했다(nonce 0 이면 문자열 동일 — 초기 조회 회귀 0).
  // Admin+ endpoint 라 비-Admin actor 의 요청은 403 이 되지만, 그 error 문구가 화면에 노출되지는
  // 않는다 — 아래 사용자 관리 섹션이 isAdmin gating 안쪽이라 렌더 자체가 차단되고 권한 부족 안내만
  // 남는다(fail-closed, 아래 섹션 주석 정합). 조회 hook 은 등급과 무관하게 호출되므로 요청은 나가되
  // 실패는 error state 로 흡수되어 throw 0 이다(Admin 에게만 error 문구가 표면화된다).
  // 사용자 재조회 nonce + nonce-aware 조회 path(T-1160 — partsRefreshNonce/partsPath 동형).
  const [usersRefreshNonce, setUsersRefreshNonce] = useState<number>(0);

  const usersPath = useMemo(
    () => buildUsersPath(usersRefreshNonce),
    [usersRefreshNonce],
  );

  const {
    data: usersData,
    loading: userLoading,
    error: userError,
  } = useApiResource<UserRow[]>(usersPath);

  // 사용자 생성 input·in-flight·실패 문구 상태(T-1160 — 파트 생성 state mirror, 입력만 2 필드).
  const [userEmailInput, setUserEmailInput] = useState<string>('');
  const [userPasswordInput, setUserPasswordInput] = useState<string>('');
  const [creatingUser, setCreatingUser] = useState<boolean>(false);
  const [createUserError, setCreateUserError] = useState<string | undefined>(
    undefined,
  );
  // 실패 사유 줄 배열(T-1835, REQ-084) — 표시 지점이 이쪽을 우선해 줄마다 별도 element 로 렌더한다.
  // 문자열 축(createUserError)은 종전 계약대로 함께 유지된다(줄 배열 부재 시 fallback).
  const [createUserErrorLines, setCreateUserErrorLines] = useState<
    string[] | undefined
  >(undefined);

  // 사용자 생성 실 mutation 핸들러(T-1160 — handleCreatePart mirror. 전이는 러너가 캡슐화).
  const handleCreateUser = useCallback(
    () =>
      runCreateUser(userEmailInput, userPasswordInput, {
        create: request,
        // T-1715 — 400 만 축별 구체 사유로 교체(그 외 status 는 toErrorMessage 그대로).
        describeError: describeCreateUserFailure,
        // T-1835 — 줄 배열이 사유 정본(위 describeError 는 그 join 파생).
        describeErrorLines: describeCreateUserFailureLines,
        isConflict: (e: unknown) => e instanceof ApiError && e.status === 409,
        creating: creatingUser,
        setCreating: setCreatingUser,
        setCreateError: setCreateUserError,
        setCreateErrorLines: setCreateUserErrorLines,
        bumpRefresh: () => setUsersRefreshNonce((n) => n + 1),
        resetInput: () => {
          setUserEmailInput('');
          setUserPasswordInput('');
        },
      }),
    [userEmailInput, userPasswordInput, creatingUser],
  );

  // 사용자 역할 변경 in-flight·실패 문구 상태(T-1162 — 생성 state mirror. 입력 폼이 없어 2종만).
  // 생성 실패 문구(createUserError)와 별개 상태라 두 alert 가 섞이지 않는다.
  // in-flight 는 boolean 이 아니라 진행 중인 사용자 id 로 들고 있다(T-1164) — UserList 가 그 id 로
  // 진행 행을 짚어 aria-busy·진행 문구를 렌더하기 때문. undefined 는 "진행 없음".
  const [changingRoleId, setChangingRoleId] = useState<string | undefined>(
    undefined,
  );
  const [changeRoleError, setChangeRoleError] = useState<string | undefined>(
    undefined,
  );

  // 진행 id 의 동기 사본(T-1165) — 위 state 는 UserList 로 내려보내는 렌더 표면이라 같은 tick 의
  // 두 번째 발사가 stale 값을 본다. 가드는 이 ref 를 읽고, 둘은 아래 gate 가 함께 갱신한다.
  const changingRoleIdRef = useRef<string | undefined>(undefined);
  const changingRoleGate = useMemo(
    () => createInFlightIdGate(changingRoleIdRef, setChangingRoleId),
    [],
  );

  // 사용자 역할 변경 실 mutation 핸들러(T-1162 — handleCreateUser mirror. 전이는 러너가 캡슐화).
  // UserList 가 (row.id, 다음 역할)로 호출한다.
  // deps 에서 changingRoleId 를 뺐다(T-1165) — 가드가 render state 를 더는 읽지 않아 재생성이
  // 불필요하고, 남는 참조는 모두 stable 하다(request·toErrorMessage 는 모듈 import, setChangeRoleError
  // ·setUsersRefreshNonce 는 useState setter, changingRoleGate 는 deps [] 인 useMemo).
  const handleChangeRole = useCallback(
    (id: string, nextRole: string) =>
      runChangeRole(id, nextRole, {
        patch: request,
        describeError: toErrorMessage,
        isForbidden: (e: unknown) => e instanceof ApiError && e.status === 403,
        // 호출 시점 읽기 — render 시점에 캡처된 값이 아니다(이중 발사 창 차단의 핵심).
        changingId: changingRoleGate.read(),
        setChangingId: changingRoleGate.write,
        setChangeError: setChangeRoleError,
        bumpRefresh: () => setUsersRefreshNonce((n) => n + 1),
      }),
    [changingRoleGate],
  );

  // 부여 상태 5종(T-1166 — 생성 state mirror). 다른 mutation 과 섞이지 않게 instance-access 전용
  // 이름으로 분리한다(실패 alert 2 개가 서로를 덮어쓰지 않게). notice 는 조회 endpoint 부재 때문에
  // 성공을 알릴 유일한 표면이다(재조회 nonce bump 없음).
  const [instanceAccessUserId, setInstanceAccessUserId] = useState<string>('');
  const [instanceRefInput, setInstanceRefInput] = useState<string>('');
  const [grantingInstanceAccess, setGrantingInstanceAccess] = useState(false);
  const [instanceAccessError, setInstanceAccessError] = useState<string>();
  const [instanceAccessNotice, setInstanceAccessNotice] = useState<string>();

  // 회수 진행 플래그(T-1167) — 부여와 별개의 in-flight 축. 대상 select·주소 input·error·notice 는
  // T-1166 것을 그대로 재사용한다(같은 폼의 두 방향 action — 새 상태 뭉치 신설 0).
  const [revokingInstanceAccess, setRevokingInstanceAccess] = useState(false);

  // 인스턴스 접근 권한 부여 실 mutation 핸들러(T-1166 — handleCreateUser mirror).
  const handleGrantInstanceAccess = useCallback(
    () =>
      runGrantInstanceAccess(instanceAccessUserId, instanceRefInput, {
        grant: request,
        describeError: toErrorMessage,
        isConflict: (e: unknown) => e instanceof ApiError && e.status === 409,
        granting: grantingInstanceAccess,
        setGranting: setGrantingInstanceAccess,
        setGrantError: setInstanceAccessError,
        setGrantNotice: setInstanceAccessNotice,
        resetInput: () => setInstanceRefInput(''),
      }),
    [instanceAccessUserId, instanceRefInput, grantingInstanceAccess],
  );

  // 인스턴스 접근 권한 회수 실 mutation 핸들러(T-1167 — handleGrantInstanceAccess mirror).
  // isConflict 주입이 없다(revoke 는 409 분기 부재 — 위 러너 주석).
  const handleRevokeInstanceAccess = useCallback(
    () =>
      runRevokeInstanceAccess(instanceAccessUserId, instanceRefInput, {
        revoke: request,
        describeError: toErrorMessage,
        revoking: revokingInstanceAccess,
        setRevoking: setRevokingInstanceAccess,
        setRevokeError: setInstanceAccessError,
        setRevokeNotice: setInstanceAccessNotice,
        resetInput: () => setInstanceRefInput(''),
      }),
    [instanceAccessUserId, instanceRefInput, revokingInstanceAccess],
  );

  // 부여·회수 통합 in-flight + 버튼 비활성(T-1167 도입, T-1168 helper 추출) — 파생 진리표는
  // module-scope 순수 helper 가 소유한다(근거·계약은 deriveInstanceAccessFormFlags 주석). 어느
  // 한쪽이라도 진행 중이면 폼 전체를 잠그는 교차 발사 이중 방어 계약은 그대로다.
  const { busy: instanceAccessBusy, actionDisabled: instanceAccessActionDisabled } =
    deriveInstanceAccessFormFlags({
      granting: grantingInstanceAccess,
      revoking: revokingInstanceAccess,
      userId: instanceAccessUserId,
      instanceRef: instanceRefInput,
    });

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

  // SchedulePanel 로 내려보낼 안내 message 파생 — apply/trigger 완료 안내 우선, 없으면 GET 상태
  // (loading/빈 목록/이름 목록 요약)를 파생한다(deriveScheduleMessage). 초기 loading 도 안전 안내.
  const schedulePanelMessage = useMemo(
    () =>
      deriveScheduleMessage(scheduleData, scheduleLoading, scheduleMessage),
    [scheduleData, scheduleLoading, scheduleMessage],
  );

  // SchedulePanel 로 내려보낼 error 파생 — mutation 실패(scheduleError)를 최우선 노출하고(방금
  // 사용자가 한 apply/trigger 의 실패가 가장 최신 피드백), 없으면 GET 실패(scheduleGetError)를
  // 표시한다. 둘 다 없으면 undefined. Admin+ 미만 403 도 이 경로로 안전 표시(throw 없음). busy 중
  // 에는 패널이 error 를 무시하고 진행 표시를 우선한다(busy 우선 정책).
  const schedulePanelError = scheduleError ?? scheduleGetError;

  // onApply 실 핸들러(T-0885) — apply PUT 을 컨테이너 내부 async 로 발사한다(runImport 정합 —
  // useApiResource 는 read-on-mount 라 클릭 발화에 부적합). 빈 cron 식 발사 억제 + 이중 발사 가드 +
  // 성공/실패 message·error 전이는 runApply 가 캡슐화한다. busy 를 deps 의존성에 포함해 stale 가드
  // 방지, cronExpression 을 포함해 최신 입력값을 발사한다.
  const handleApply = useCallback(
    () =>
      runApply(cronExpression, {
        request,
        describeError: toErrorMessage,
        busy: scheduleBusy,
        setBusy: setScheduleBusy,
        setError: setScheduleError,
        setMessage: setScheduleMessage,
      }),
    [cronExpression, scheduleBusy],
  );

  // onManualTrigger 실 핸들러(T-0885) — manual trigger POST 를 컨테이너 내부 async 로 발사한다.
  // 이중 발사 가드 + 성공/실패 전이는 runTrigger 가 캡슐화한다(body 없는 202 Accepted).
  const handleManualTrigger = useCallback(
    () =>
      runTrigger({
        request,
        describeError: toErrorMessage,
        busy: scheduleBusy,
        setBusy: setScheduleBusy,
        setError: setScheduleError,
        setMessage: setScheduleMessage,
      }),
    [scheduleBusy],
  );

  // cron 식 변경 — SchedulePanel 의 cron 입력이 값을 컨테이너 상태로 올린다(controlled lift-up).
  // 그룹 선택 handleSelectChange 동형. SchedulePanel 은 이 값의 저장처를 모른다(Decision 1).
  const handleCronChange = useCallback((value: string) => {
    setCronExpression(value);
  }, []);
  // === /스케줄 패널 배선(T-0885) =========================================================

  // === 재평가 트리거 패널 배선(T-0886) — 여섯 번째 패널 ==================================
  // 선택 person 상태 — controlled lift-up(컨테이너 소유). person <select> 선택이 이 값을 갱신하고,
  // handleReevalTrigger 가 POST path param 으로 공급한다. 옵션은 선택 그룹의 파생 members 를 쓴다
  // (기존 deriveMembers 결과 재사용 — 별도 fetch 0). 그룹 선택 <select> 동형의 controlled lift-up.
  const [selectedPersonId, setSelectedPersonId] = useState<string>(
    initialSelectedPersonId,
  );

  // 선택 재수집 window(days) 상태 — controlled lift-up. ReEvaluationTriggerPanel 의 onSelect 가 이
  // 값을 갱신하고, onTrigger 가 이 값을 body.days 로 발사한다. 0(windows 미매칭)이면 panel 이
  // placeholder 로 fallback + 트리거 버튼 비활성(경계값 안전 — 의미 없는 기간 트리거 방지).
  const [selectedDays, setSelectedDays] = useState<number>(initialSelectedDays);

  // 재평가 in-flight 플래그 — POST 진행 중 true. 진행 표시(submitting 우선)와 이중 발사 가드
  // (runReEvaluate 의 submitting 가드)에 함께 쓴다(scheduleBusy 동형).
  const [reevalSubmitting, setReevalSubmitting] = useState<boolean>(
    initialReevalSubmitting,
  );

  // 재평가 실패 문구 — 실패 시 사람-친화 문구(toErrorMessage 파생)를 보관해 error props 로 안전
  // 표시한다(throw 없음). 재발화 시작 시 비운다(scheduleError 동형). 성공 시 error 는 undefined 유지.
  const [reevalError, setReevalError] = useState<string | undefined>(undefined);

  // person 선택 옵션 — 선택 그룹의 파생 members 를 재사용한다(deriveMembers 결과). 그룹 미선택/멤버
  // 0 이면 빈 옵션(placeholder 만) — 재평가 트리거는 person 미선택 가드로 안전하게 억제된다.
  const personOptions = members;

  // onTrigger 실 핸들러(T-0886) — 재평가 POST 를 컨테이너 내부 async 로 발사한다(runTrigger 정합 —
  // useApiResource 는 read-on-mount 라 클릭 발화에 부적합). 선택 personId(path param)·days(body)·
  // in-flight 여부·상태 setter 를 runReEvaluate 에 주입한다. person 미선택 발사 억제 + 이중 발사
  // 가드 + 성공/실패 전이는 runReEvaluate 가 캡슐화한다. selectedPersonId·reevalSubmitting 을 deps
  // 의존성에 포함해 stale 없이 최신값을 발사·가드한다.
  const handleReevalTrigger = useCallback(
    (days: number) =>
      runReEvaluate(selectedPersonId, days, {
        post: request,
        describeError: toErrorMessage,
        submitting: reevalSubmitting,
        setSubmitting: setReevalSubmitting,
        setError: setReevalError,
      }),
    [selectedPersonId, reevalSubmitting],
  );

  // onSelect 실 핸들러(T-0886) — panel 의 window 선택이 selectedDays 를 컨테이너 상태로 올린다
  // (controlled lift-up). handleCronChange 동형. panel 은 이 값의 저장처를 모른다(Decision 1).
  const handleReevalSelect = useCallback((days: number) => {
    setSelectedDays(days);
  }, []);

  // person 선택 변경 — person <select> 가 선택 person id 를 컨테이너 상태로 올린다(빈 값 = 미선택
  // 으로 되돌림). 그룹 선택 handleSelectChange 동형. panel 은 person 선택을 모른다(Decision 1).
  const handlePersonChange = (event: { target: { value: string } }) => {
    setSelectedPersonId(event.target.value);
  };
  // === /재평가 트리거 패널 배선(T-0886) ================================================

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
      {/* 그룹 멤버 목록(첫 패널) — 선택 그룹 멤버십 fetch(GET /api/groups/:id/members, T-1129)
          결과에서 파생한 groupMembers(id = membershipId)와 그 fetch 의 loading/error 를 props 로만
          내려보낸다(ADR-0041 Decision 1 — 패널은 fetch 를 모른다). onRemove 배선(T-1130)으로 각
          멤버 행에 제거 버튼이 렌더되고, 클릭 시 그 행의 membershipId 로 DELETE :id/members/:membershipId
          를 발사한다(handleRemove). loading/error 는 멤버십 조회와 remove mutation 을 합성한다
          (removing||membersLoading / removeError??membersError — mutation 우선). 컴포넌트 수정 0. */}
      {/* 멤버 추가 배선(T-1238) — T-1237 이 신설한 presentational onAdd/addCandidates 계약을 주입한다.
          addCandidates(persons − 현재 멤버)로 컴포넌트의 후보 select 를 채우고, onAdd 로 선택된 후보의
          personId 를 handleAdd 에 넘겨 POST /api/groups/:id/members(body `{ personId }`)를 발사한다.
          성공 시 membersRefreshNonce bump 로 권위 재조회(낙관 override 없음 — remove 동형). 선택값은
          컴포넌트 로컬 state 라 컨테이너는 값을 보유하지 않고, 후보 미선택/빈 후보는 컴포넌트가 버튼
          disabled 로 1차 차단, runAdd 가 빈 personId·그룹 미선택·in-flight 를 2차 방어한다. */}
      <GroupMemberList
        members={groupMembers}
        loading={removing || membersLoading}
        error={removeError ?? membersError}
        emptyMessage={emptyMessage}
        onRemove={handleRemove}
        onAdd={handleAdd}
        addCandidates={addCandidates}
      />
      {/* 멤버 추가 실패 문구(T-1131 → T-1238) — 기존 free-text 입력 블록을 은퇴(add UX 를
          presentational 컴포넌트로 일원화)하고, 실패 문구만 GroupMemberList 근처에 남겨 안전 표시한다.
          error props 경로가 아니라 별도 alert 로 두는 이유: 컴포넌트의 error 분기는 목록·추가 form 을
          모두 감춰 add 실패 후 재시도 form 이 사라지기 때문(add 진행 중 form 유지). throw 없음. */}
      {addError ? <p role="alert">{addError}</p> : null}
      {/* Admin+ RBAC gating(④h) — Admin/SuperAdmin 등급(isAdmin === true)에게만 Admin 전용 패널
          (DifficultyModelSelector + scope <select> + DataImportExportPanel)을 렌더한다. 세 패널은
          모두 Admin+ endpoint(GET /api/llm/providers·/difficulty-mappings·/admin/export·/admin/import,
          api.md 114·119·122·123)에 의존하므로, 비-Admin(또는 등급 불명/조회 중)에게는 패널을 아예
          마운트하지 않고(403 노이즈 차단) 권한 부족 안내 한 줄만 보여준다(fail-closed). gating
          판정·등급 파생은 컨테이너 책임이고 패널 props 계약은 불변이다(ADR-0041 Decision 1 — 패널은
          gating 을 모른다). GroupMemberList + 그룹 선택 <select> 는 GET /api/groups 가 User+ 라
          gating 대상이 아니며 위에서 등급 무관 렌더된다. */}
      {isAdmin ? (
        <>
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
          {/* 등록된 LLM provider 설정 목록(T-1134 마운트 + T-1135 삭제 배선, R-96). 기존 providerData 를
              재사용해 sanitized view(providerConfigs)로 파생하고, 삭제 콜백(handleDeleteProvider)을
              onDelete 로 내려 각 행에 삭제 버튼을 배선한다. loading 은 조회+삭제 in-flight 를 합성
              (providersLoading||deletingProvider — remove 패널 동형), error 는 삭제 실패를 우선 노출
              (deleteProviderError??providersError — mutation 우선). 성공 시 providersRefreshNonce bump
              로 권위 재조회한다(낙관 제거 없음). 수정(PATCH)은 onEdit 배선 + 아래 인라인 폼(T-1137). */}
          <LlmProviderConfigList
            providers={providerConfigs}
            loading={providersLoading || deletingProvider}
            error={deleteProviderError ?? providersError}
            onDelete={handleDeleteProvider}
            onEdit={handleEditProvider}
          />
          {/* provider 수정(T-1137, R-96) — 인라인 수정 폼. LlmProviderConfigList 각 행의 "수정"
              버튼(onEdit=handleEditProvider)이 편집 대상 id 를 세팅하면(editingProviderId !== null)
              본 폼이 렌더된다. 4 controlled input(provider/endpointUrl/apiKey/modelId)은 클릭한 row
              의 현재 값으로 prefill 하되, apiKey 는 read never-back 이라 빈 값으로 시작하고
              placeholder 로 "변경 시에만 입력" 을 안내한다(입력 시에만 PATCH body 에 포함 → 기존
              ciphertext 유지). "provider 수정" 클릭 시 handleUpdateProvider 가 PATCH
              /api/llm/providers/:id(변경 필드만 body)를 발사하고, 성공 시 providersRefreshNonce bump
              로 권위 재조회 + 편집 종료한다(낙관 갱신 없음 — 생성/삭제 동형). 진행 중(updatingProvider)
              이면 입력·버튼을 비활성화해 이중 PATCH 를 억제하고(runUpdateProvider 도 동일 조건을 no-op
              가드로 이중 방어), "취소" 로 발사 없이 편집을 닫을 수 있다. apiKey 는 secret
              input(type="password")으로 노출을 줄이고 실패 문구(updateProviderError)에도 재노출되지
              않는다(삭제/생성 error 와 별도 문구). ADR-0041 Decision 1 — presentational 목록은 수정
              폼을 모르므로 컨테이너가 직접 소유한다(컴포넌트 수정 0). */}
          {editingProviderId !== null ? (
            <div>
              {/* provider 입력을 5-provider select 로 constrain(T-1138, R-99~103). 편집 대상 row 의
                  provider 값(editProviderInput)이 5 개 중 하나면 그 option 이 선택되고, 목록에 없는
                  레거시/비정상 값이면 placeholder(빈 value)로 fallback 렌더된다(브라우저는 매칭 option
                  부재 시 첫 option 을 선택). value/onChange 계약은 기존 text input 과 동일해 PATCH body
                  조립·가드는 수정 0. */}
              <select
                aria-label="수정할 provider"
                value={resolveProviderSelectValue(editProviderInput)}
                onChange={(event) => setEditProviderInput(event.target.value)}
                disabled={updatingProvider}
              >
                <option value="">{LLM_PROVIDER_PLACEHOLDER_LABEL}</option>
                {LLM_PROVIDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                aria-label="수정할 provider endpointUrl"
                type="text"
                value={editEndpointUrlInput}
                onChange={(event) => setEditEndpointUrlInput(event.target.value)}
                disabled={updatingProvider}
              />
              <input
                aria-label="수정할 provider apiKey"
                type="password"
                placeholder="변경 시에만 입력"
                value={editApiKeyInput}
                onChange={(event) => setEditApiKeyInput(event.target.value)}
                disabled={updatingProvider}
              />
              <input
                aria-label="수정할 provider modelId"
                type="text"
                value={editModelIdInput}
                onChange={(event) => setEditModelIdInput(event.target.value)}
                disabled={updatingProvider}
              />
              <button
                type="button"
                onClick={handleUpdateProvider}
                disabled={updatingProvider}
              >
                provider 수정
              </button>
              <button
                type="button"
                onClick={handleCancelEditProvider}
                disabled={updatingProvider}
              >
                취소
              </button>
              {updateProviderError ? (
                <p role="alert">{updateProviderError}</p>
              ) : null}
            </div>
          ) : null}
          {/* provider 생성(T-1136, R-96) — 4 controlled input(provider/endpointUrl/apiKey/modelId) +
              "추가" 버튼. LlmProviderConfigList(presentational, 읽기 전용 목록 + 삭제)는 생성 컨트롤을
              모르므로 컨테이너가 직접 소유한다(controlled lift-up, ADR-0041 Decision 1 — 컴포넌트 수정
              0). 클릭 시 handleCreateProvider 가 POST /api/llm/providers(body 4 필드)를 발사하고, 성공
              시 providersRefreshNonce bump 로 권위 재조회한다(낙관 추가 없음 — 삭제/추가 동형). 4 필드
              중 하나라도 빈·공백이거나 진행 중이면 버튼을 비활성화해 발사를 억제하고(runCreateProvider
              도 동일 조건을 no-op 가드로 이중 방어), 입력은 진행 중에도 비활성화한다. apiKey 는 secret
              input(type="password")으로 화면 노출을 줄이되 생성 body 전송만 담당하고, 실패 문구
              (createProviderError)에도 재노출되지 않는다(삭제 error 와 별도 문구). */}
          <div>
            {/* provider 입력을 5-provider select 로 constrain(T-1138, R-99~103). placeholder(빈
                value) 를 선두 배치해 미선택 시 생성 버튼 가드(!providerInput.trim())가 그대로 발화한다
                (POST 미호출). value/onChange 계약은 기존 text input 과 동일해 POST body 조립은 수정 0 —
                선택 불가능한 지원 외 값은 option 부재로 제출 자체가 봉쇄된다. */}
            <select
              aria-label="생성할 provider"
              value={providerInput}
              onChange={(event) => setProviderInput(event.target.value)}
              disabled={creatingProvider}
            >
              <option value="">{LLM_PROVIDER_PLACEHOLDER_LABEL}</option>
              {LLM_PROVIDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              aria-label="생성할 provider endpointUrl"
              type="text"
              value={endpointUrlInput}
              onChange={(event) => setEndpointUrlInput(event.target.value)}
              disabled={creatingProvider}
            />
            <input
              aria-label="생성할 provider apiKey"
              type="password"
              value={apiKeyInput}
              onChange={(event) => setApiKeyInput(event.target.value)}
              disabled={creatingProvider}
            />
            <input
              aria-label="생성할 provider modelId"
              type="text"
              value={modelIdInput}
              onChange={(event) => setModelIdInput(event.target.value)}
              disabled={creatingProvider}
            />
            <button
              type="button"
              onClick={handleCreateProvider}
              disabled={
                creatingProvider ||
                !providerInput.trim() ||
                !endpointUrlInput.trim() ||
                !apiKeyInput.trim() ||
                !modelIdInput.trim()
              }
            >
              provider 추가
            </button>
            {createProviderError ? (
              <p role="alert">{createProviderError}</p>
            ) : null}
          </div>
          {/* export scope 선택 컨트롤(④g) — 컨테이너가 직접 렌더한다(그룹 선택 <select> 동형 —
              presentational DataImportExportPanel 은 scope 를 모른다, ADR-0041 Decision 1). 선택값은
              handleExport 가 runAdminExportJob 으로 POST job-flow(create→poll→download) 입력의 scope
              에 반영하고, 빈 선택(전체) 시에는 scope 없이 호출한다(④f 동작 유지). scope 후보는 frontend-local 보수
              목록(EXPORT_SCOPE_OPTIONS) — backend 확정 enum 정합은 후속. */}
          <select
            aria-label="export 범위 선택"
            value={selectedScope}
            onChange={handleScopeChange}
          >
            {EXPORT_SCOPE_OPTIONS.map((option) => (
              <option key={option.value || '__all__'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {/* 데이터 import/export(세 번째 패널, ④d export + ④e import) — export·import 콜백·진행·
              결과·실패를 컨테이너가 소유하고 패널은 onExport/onImportFile 콜백 + busy/error/message
              props 만 소비한다(ADR-0041 Decision 1 — 패널은 fetch/FormData 를 모른다). onImportFile
              배선으로 파일 입력이 활성화된다(④d 가 비활성화했던 입력 활성). import 는 POST
              /api/admin/import 로 multipart FormData 전송(④e). scope query 부착은 컨테이너 책임 —
              패널 props 계약 불변(④g). 컴포넌트 수정 0. */}
          <DataImportExportPanel {...importExportPanelProps} />
          {/* 스케줄 설정(다섯 번째 패널, T-0885 — P6 deferred wiring 재개) — cron 주기 지정(R-72)·
              manual trigger(R-73)의 콜백·진행·결과·실패를 컨테이너가 소유하고, 패널은 cronExpression·
              onCronChange·onApply·onManualTrigger·busy·error·message props 만 소비한다(ADR-0041
              Decision 1 — 패널은 fetch 를 모른다). onCronChange/onApply/onManualTrigger 배선으로
              입력·버튼이 활성화된다(콜백 미전달 시 패널이 비활성 렌더). apply 는 PUT /api/schedules
              (단일 default name + cron 식), trigger 는 POST /api/schedules/trigger(body 없음). GET
              /api/schedules 목록·loading 은 message 로, GET 실패·mutation 실패는 error 로 합성해
              내려보낸다(schedulePanelMessage/schedulePanelError). 컴포넌트 수정 0. */}
          <SchedulePanel
            cronExpression={cronExpression}
            onCronChange={handleCronChange}
            onApply={handleApply}
            onManualTrigger={handleManualTrigger}
            busy={scheduleBusy}
            error={schedulePanelError}
            message={schedulePanelMessage}
          />
          {/* 재평가 인원 선택 컨트롤(T-0886) — 선택 그룹의 파생 members 를 옵션으로 노출한다(그룹
              선택 <select> 동형 controlled lift-up — presentational 패널은 person 선택을 모른다,
              ADR-0041 Decision 1). 선택된 personId 가 재평가 POST 의 path param 으로 쓰인다. 그룹
              미선택/멤버 0 이면 placeholder 만 노출(재평가는 person 미선택 가드로 억제 — crash 없음). */}
          <select
            aria-label="재평가 인원 선택"
            value={selectedPersonId}
            onChange={handlePersonChange}
          >
            <option value="">{NO_PERSON_SELECTION_LABEL}</option>
            {personOptions.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          {/* 재평가 트리거(여섯 번째 패널, T-0886 — P6 deferred wiring 완결) — 최근 N일 delete→재수집
              (R-74)의 window 후보·선택·진행·실패를 컨테이너가 소유하고, 패널은 windows·selectedDays·
              onSelect·onTrigger·submitting·error props 만 소비한다(ADR-0041 Decision 1 — 패널은
              fetch 를 모른다). onSelect 는 selectedDays 갱신, onTrigger 는 POST /api/schedules/
              recent-deletion/:personId 로 { instants: [], days } body 를 발사한다(person 미선택 시
              가드로 억제). 성공은 error 없음으로, 실패는 error props(reevalError)로 안전 표시한다
              (throw 없음). windows 는 frontend-local 상수(REEVAL_WINDOW_OPTIONS). 컴포넌트 수정 0. */}
          <ReEvaluationTriggerPanel
            windows={REEVAL_WINDOW_OPTIONS}
            selectedDays={selectedDays}
            onSelect={handleReevalSelect}
            onTrigger={handleReevalTrigger}
            submitting={reevalSubmitting}
            error={reevalError}
          />
          {/* 사용자 관리(T-1159 마운트, REQ-044/REQ-045) — 파트 마운트(T-1152)와 동형이나 GET
              /api/users 가 Admin+ 전용이라 본 섹션만 isAdmin gating 안쪽에 둔다(비-Admin 에게는 아예
              마운트하지 않아 403 목록이 화면에 남지 않는다 — 위 fail-closed 정책 정합). 신규 조회
              useApiResource<UserRow[]>(USERS_PATH) 의 data/loading/error 를 그대로 UserList 로 내려
              보낸다(ADR-0041 Decision 1 — 컴포넌트는 fetch 를 모른다). data 가 undefined(미조회/진행
              중/실패)이면 `?? []` 로 빈 배열을 안전하게 넘겨 throw 없이 렌더한다(경계 방어). 생성
              (T-1160)·역할 변경(T-1162) mutation 이 배선돼 있고, onChangeRole 은 isSuperAdmin 일
              때만 내려간다(비-SuperAdmin 에겐 undefined → 버튼 미렌더로 확정 403 사전 차단).
              UserList 의 named UserRow 를 조회 제네릭에 그대로 쓴다(컴포넌트 수정 0). */}
          <section aria-label="사용자 관리 섹션">
            <h2>{USER_HEADING}</h2>
            {/* 사용자 생성(T-1160, REQ-044/REQ-045) — 파트 생성 폼(T-1153) mirror, 입력만 2 필드.
                빈 입력·진행 중엔 버튼·입력 비활성으로 발사 억제(러너도 no-op 가드로 이중 방어). */}
            {/* 조건 안내 2 축(T-1711, REQ-067) — 제출 후 400 을 받고서야 규칙을 추측하지 않도록
                입력 전에도 항상 보이게 둔다. 그래서 creatingUser·createUserError 등 어떤 상태에도
                의존하지 않는 무조건 렌더이며(분기 0), 실패 alert 가 떠도 안내는 그대로 남는다.
                안내는 경보가 아니므로 role="alert" 를 붙이지 않는다(매 렌더 낭독 방지) — 대신
                aria-describedby 로 대응 입력의 설명으로만 연결한다(접근 가능 이름은 종전 aria-label
                그대로 유지). 문구는 위 named import 상수 그대로 — 입력값을 섞지 않는다. */}
            <div>
              <input
                aria-label="추가할 사용자 이메일"
                type="text"
                value={userEmailInput}
                onChange={(event) => setUserEmailInput(event.target.value)}
                disabled={creatingUser}
                aria-describedby={CREATE_USER_EMAIL_HINT_ID}
              />
              <p id={CREATE_USER_EMAIL_HINT_ID}>{USERNAME_HINT_TEXT}</p>
              <input
                aria-label="추가할 사용자 비밀번호"
                type="password"
                value={userPasswordInput}
                onChange={(event) => setUserPasswordInput(event.target.value)}
                disabled={creatingUser}
                aria-describedby={CREATE_USER_PASSWORD_HINT_ID}
              />
              <p id={CREATE_USER_PASSWORD_HINT_ID}>{PASSWORD_HINT_TEXT}</p>
              <button
                type="button"
                onClick={handleCreateUser}
                disabled={
                  creatingUser || !userEmailInput.trim() || !userPasswordInput
                }
              >
                사용자 추가
              </button>
              {/* 실패 안내(T-1835, REQ-084) — 줄 단위 목록이 있으면 그것을 우선해 줄마다 별도
                  element 로 렌더하고, 없을 때만 단일 문자열로 되돌아간다(둘 다 없으면 미렌더).
                  줄 원문은 그대로 보존한다 — 합치거나 요약하지 않는다(REQ-068).
                  index 를 key 에 섞는 이유: 같은 사유 문구가 두 줄에 반복될 수 있어 본문만으로는
                  key 가 유일하지 않다. 목록은 재정렬되지 않으므로 index key 로 충분하다. */}
              {hasCreateUserErrorLines(createUserErrorLines) ? (
                <div role="alert">
                  {(createUserErrorLines as string[]).map((line, index) => (
                    <p
                      key={`${String(index)}-${String(line)}`}
                      className={CREATE_USER_ERROR_LINE_CLASS}
                    >
                      {line}
                    </p>
                  ))}
                </div>
              ) : createUserError ? (
                <p role="alert">{createUserError}</p>
              ) : null}
            </div>
            {/* 역할 변경 실패 문구(T-1162) — 생성 실패 alert 와 별개 상태라 서로 섞이지 않는다. */}
            {changeRoleError ? <p role="alert">{changeRoleError}</p> : null}
            {/* changingRoleId(T-1164) — 진행 중인 역할 변경 대상 id 를 내려보낸다. 그 행에만
                aria-busy·진행 문구가 붙고 진행 중에는 모든 역할 변경 버튼이 비활성화된다. */}
            <UserList
              users={usersData ?? []}
              loading={userLoading}
              error={userError}
              onChangeRole={isSuperAdmin ? handleChangeRole : undefined}
              changingRoleId={changingRoleId}
            />
            {/* 인스턴스 접근 권한 부여(T-1166, REQ-016/REQ-044) — 생성 폼 mirror. 대상은 이미 조회한
                목록에서 고르고(추가 fetch 0) 주소만 자유 입력한다. 성공은 role="status" 안내로만
                피드백(조회 endpoint 부재 — 위 상수 주석). 미선택·공백·진행 중이면 컨트롤 비활성. */}
            <div>
              <select
                aria-label="접근 권한을 부여할 사용자"
                value={instanceAccessUserId}
                onChange={(ev) => setInstanceAccessUserId(ev.target.value)}
                disabled={instanceAccessBusy}
              >
                <option value="">{INSTANCE_ACCESS_NO_USER_LABEL}</option>
                {/* 조회 중이면 옵션을 비운다(권위 아닌 목록으로 대상 선택 유도 금지 — UserList 의
                    loading 우선 계약 정합). id 없는 행은 제외, 라벨은 email 없으면 id fallback. */}
                {(userLoading ? [] : (usersData ?? []))
                  .filter((user) => Boolean(user.id))
                  .map((user) => (
                    <option key={user.id} value={user.id}>{user.email ?? user.id}</option>
                  ))}
              </select>
              <input
                aria-label="부여할 인스턴스 주소"
                type="text"
                value={instanceRefInput}
                onChange={(event) => setInstanceRefInput(event.target.value)}
                disabled={instanceAccessBusy}
              />
              <button
                type="button"
                onClick={handleGrantInstanceAccess}
                disabled={instanceAccessActionDisabled}
              >
                인스턴스 접근 권한 부여
              </button>
              {/* 회수(T-1167, REQ-016/REQ-044) — 같은 폼(대상 select + 주소 input)의 반대 방향
                  action. DELETE 는 부재 binding 도 성공(204)이라 확인 다이얼로그 없이 즉시 발사한다.
                  비활성은 부여 버튼과 같은 파생 값을 공유한다(조건 분화 금지 — T-1168). */}
              <button
                type="button"
                onClick={handleRevokeInstanceAccess}
                disabled={instanceAccessActionDisabled}
              >
                인스턴스 접근 권한 회수
              </button>
              {instanceAccessError ? <p role="alert">{instanceAccessError}</p> : null}
              {instanceAccessNotice ? <p role="status">{instanceAccessNotice}</p> : null}
            </div>
          </section>
        </>
      ) : (
        // 비-Admin(또는 등급 불명/조회 중) — Admin 전용 패널 대신 권한 부족 안내 한 줄(fail-closed).
        <p role="status">{NOT_ADMIN_NOTICE_TEXT}</p>
      )}
      {/* 인원 관리(T-1142 목록 + T-1143 생성, REQ-049/REQ-023) — backend Person API(GET /api/persons
          active 인원 Person[] 반환)를 사람이 볼 수 있게 목록으로 표시하고, POST /api/persons 로 신규
          인원을 추가하는 생성 폼을 함께 배선한다. 기존 패널과 시각적으로 구분되는 별도 섹션(heading +
          폼 + 컴포넌트)으로 마운트하고, 인원 조회의 loading/error 와 인원 배열만 PersonList 로
          내려보낸다(다른 조회 상태와 섞지 않음 — ADR-0041 Decision 1, 컴포넌트는 fetch 를 모른다).
          data 가 undefined(미조회/진행 중/실패)이면 `?? []` 로 빈 배열을 안전하게 넘겨 throw 없이
          렌더한다. 생성 성공 시 personsRefreshNonce bump 로 권위 재조회한다(낙관 추가 없음). */}
      <section aria-label={PERSON_HEADING}>
        <h2>{PERSON_HEADING}</h2>
        {/* 휴직 인원 포함 토글(T-1804, REQ-071) — 체크하면 조회 path 에 `includeInactive=true` 가
            실려 backend 가 휴직(active:false) 인원까지 돌려준다(T-1803 query 계약). 그래야 휴직
            처리한 인원이 목록에 다시 나타나 기존 인라인 수정 폼의 활성/휴직 <select> → PATCH
            경로로 재활성(Activate)할 수 있다. controlled checkbox — 컨테이너가 값을 소유하고,
            변경이 곧 personsPath 변경 = useApiResource 재조회다(hook 수정 0). */}
        <label>
          <input
            aria-label={PERSON_INCLUDE_INACTIVE_LABEL}
            type="checkbox"
            checked={personsIncludeInactive}
            onChange={(event) =>
              setPersonsIncludeInactive(event.target.checked)
            }
          />
          {PERSON_INCLUDE_INACTIVE_LABEL}
        </label>
        {/* 인원 생성 폼(T-1143, REQ-023) — 2 controlled input(fullName/email) + "인원 추가" 버튼.
            PersonList(presentational 읽기 전용 목록)는 생성 컨트롤을 모르므로 컨테이너가 직접 소유한다
            (controlled lift-up, ADR-0041 Decision 1 — 컴포넌트 수정 0). 클릭 시 handleCreatePerson 이
            POST /api/persons(body 2 필드)를 발사하고, 성공 시 personsRefreshNonce bump 로 권위
            재조회한다(낙관 추가 없음). 2 필드 중 하나라도 빈·공백이거나 진행 중이면 버튼을 비활성화해
            발사를 억제하고(runCreatePerson 도 동일 조건을 no-op 가드로 이중 방어), 입력은 진행 중에도
            비활성화한다. 실패 문구(createPersonError)는 폼 하단에 role="alert" 로 안전 표시한다. */}
        <div>
          <input
            aria-label="추가할 인원 이름"
            type="text"
            value={fullNameInput}
            onChange={(event) => setFullNameInput(event.target.value)}
            disabled={creatingPerson}
          />
          <input
            aria-label="추가할 인원 email"
            type="email"
            value={emailInput}
            onChange={(event) => setEmailInput(event.target.value)}
            disabled={creatingPerson}
          />
          <button
            type="button"
            onClick={handleCreatePerson}
            disabled={
              creatingPerson || !fullNameInput.trim() || !emailInput.trim()
            }
          >
            인원 추가
          </button>
          {createPersonError ? (
            <p role="alert">{createPersonError}</p>
          ) : null}
        </div>
        {/* 인원 수정(T-1145, REQ-049) — 인라인 수정 폼. PersonList 각 행의 "수정" 버튼(onEdit=
            handleEditPerson)이 편집 대상 id 를 세팅하면(editingPersonId !== null) 본 폼이 렌더된다.
            3 controlled input(fullName text / email email / active <select> 활성·휴직)은 클릭한 row 의
            현재 값으로 prefill 되고, 원본 스냅샷(editPersonOriginal)과 함께 저장된다. "인원 수정" 클릭 시
            handleUpdatePerson 이 buildPersonPatch 로 변경 필드만 조립해 PATCH /api/persons/:id 를 발사하고,
            성공 시 personsRefreshNonce bump 로 권위 재조회 + 편집 종료한다(낙관 갱신 없음 — 생성/삭제 동형).
            진행 중(updatingPerson)이면 입력·버튼을 비활성화해 이중 PATCH 를 억제하고(runUpdatePerson 도
            빈 patch/in-flight 를 no-op 가드로 이중 방어), "취소" 로 발사 없이 편집을 닫을 수 있다. 실패
            문구(updatePersonError)는 폼 하단에 role="alert" 로 안전 표시한다(생성/삭제 error 와 별도).
            ADR-0041 Decision 1 — presentational 목록은 수정 폼을 모르므로 컨테이너가 직접 소유한다. */}
        {editingPersonId !== null ? (
          <div>
            <input
              aria-label="수정할 인원 이름"
              type="text"
              value={editFullNameInput}
              onChange={(event) => setEditFullNameInput(event.target.value)}
              disabled={updatingPerson}
            />
            <input
              aria-label="수정할 인원 email"
              type="email"
              value={editEmailInput}
              onChange={(event) => setEditEmailInput(event.target.value)}
              disabled={updatingPerson}
            />
            {/* active 는 boolean 이라 <select> 로 활성/휴직 두 값을 controlled 로 노출한다(soft
                deactivate/reactivate — UpdatePersonDto active). 값은 'active'/'inactive' 문자열이되
                onChange 에서 boolean 으로 환원해 상태에 저장한다. */}
            <select
              aria-label="수정할 인원 활성 여부"
              value={editActiveInput ? 'active' : 'inactive'}
              onChange={(event) =>
                setEditActiveInput(event.target.value === 'active')
              }
              disabled={updatingPerson}
            >
              <option value="active">활성</option>
              <option value="inactive">휴직</option>
            </select>
            <button
              type="button"
              onClick={handleUpdatePerson}
              disabled={updatingPerson}
            >
              인원 수정
            </button>
            <button
              type="button"
              onClick={handleCancelEditPerson}
              disabled={updatingPerson}
            >
              취소
            </button>
            {updatePersonError ? (
              <p role="alert">{updatePersonError}</p>
            ) : null}
          </div>
        ) : null}
        {/* 인원 삭제 배선(T-1144, REQ-049) + 인원 수정 배선(T-1145) — 삭제 콜백(handleDeletePerson)을
            onDelete 로, 수정 콜백(handleEditPerson)을 onEdit 로 내려 각 행에 삭제·수정 버튼을 배선한다.
            loading 은 조회+삭제 in-flight 를 합성(personLoading||deletingPerson — provider 목록 패널
            동형), error 는 삭제 실패를 우선 노출(deletePersonError??personError — mutation 우선). 성공
            시 personsRefreshNonce bump 로 권위 재조회한다(낙관 제거 없음). */}
        <PersonList
          persons={personData ?? []}
          loading={personLoading || deletingPerson}
          error={deletePersonError ?? personError}
          onDelete={handleDeletePerson}
          onEdit={handleEditPerson}
        />
        {/* 인원별 service identity 목록(T-1766, ADR-0058 §Follow-ups (d) 읽기 축) — 전용
            <select> 로 인원을 고르면 GET /api/persons/:personId/identities 를 조건부 조회해
            ServiceIdentityList 에 내려보낸다. 옵션은 이미 조회 중인 personData 파생이라 새
            fetch 0(비정상 payload 는 빈 배열 방어). 행 액션 slot 결선은 T-1777. */}
        <select
          aria-label="service identity 조회 인원 선택"
          value={selectedIdentityPersonId}
          onChange={handleIdentityPersonChange}
        >
          <option value="">{NO_PERSON_SELECTION_LABEL}</option>
          {(Array.isArray(personData) ? personData : []).map((person) => (
            <option key={person.id} value={person.id}>
              {person.fullName}
            </option>
          ))}
        </select>
        {/* 읽기 축은 등급 무관 렌더 유지(ADR-0058 §Decision 4 — GET = User+). 위 조회 <select> 와
            이 목록 본체는 게이트 밖에 남기고, 행 액션 slot 만 Admin+ 로 막는다. 비-Admin 이면
            undefined 를 내려 T-1774 의 slot 미전달 경로(행 액션 markup 0)로 떨어진다 — slot factory
            호출 자체는 그대로 두고 전달 여부만 분기한다(hook 순서 불변). */}
        <ServiceIdentityList
          identities={serviceIdentities}
          loading={serviceIdentityLoading}
          error={serviceIdentityError}
          renderRowActions={isAdmin ? serviceIdentityRowActionsSlot : undefined}
        />
        {/* 쓰기 축 Admin+ gating(T-1778, ADR-0058 §Decision 4 — 추가 · 수정 · 삭제 · primary 지정은
            Admin+). 추가 폼 · 수정 대상 <select> · 수정 폼 3 컨트롤을 isAdmin 삼항 안으로 넣어
            Admin/SuperAdmin 에게만 마운트하고, 그 외(비-Admin · 등급 불명 · 조회 중 · 조회 실패)에는
            안내 한 줄만 렌더한다(fail-closed — 눌러도 403 만 돌아오는 버튼을 노출하지 않는다).
            판정은 기존 isAdmin 파생을 그대로 쓴다(등급 helper 재구현 0). */}
        {isAdmin ? (
          <>
            {/* service identity 추가 폼(T-1767, ADR-0058 §Follow-ups (d) 쓰기 축 1/3) — 위 조회
                <select> 로 고른 인원에게 POST /api/persons/:personId/identities 를 발사한다. 입력값·
                진행·실패 문구는 컨테이너가 내려보내고, 성공 시 nonce bump 로 위 목록이 재조회된다. */}
            <ServiceIdentityAddForm
              service={identityServiceInput}
              externalId={identityExternalIdInput}
              onServiceChange={setIdentityServiceInput}
              onExternalIdChange={setIdentityExternalIdInput}
              onSubmit={handleCreateServiceIdentity}
              loading={creatingServiceIdentity}
              error={createServiceIdentityError}
            />
            {/* 수정 축(T-1768, ADR-0058 (d) 쓰기 2/3) — 대상 선택 시 prefill 후 PATCH 폼 마운트. */}
            <select
              aria-label="수정 대상 identity 선택"
              value={editingIdentityId}
              onChange={handleEditTargetChange}
            >
              <option value="">수정할 identity 를 선택하세요</option>
              {serviceIdentities.map((identity) => (
                <option key={identity.id} value={identity.id}>
                  {identity.service} / {identity.externalId}
                </option>
              ))}
            </select>
            {editingIdentity ? (
              <ServiceIdentityEditForm
                service={editingIdentity.service}
                initialExternalId={editingIdentity.externalId}
                externalId={identityEditExternalIdInput}
                onExternalIdChange={setIdentityEditExternalIdInput}
                onSubmit={handleUpdateServiceIdentity}
                onCancel={endServiceIdentityEdit}
                loading={updatingServiceIdentity}
                error={updateServiceIdentityError}
              />
            ) : null}
          </>
        ) : (
          // 비-Admin(또는 등급 불명/조회 중) — 쓰기 컨트롤 대신 권한 안내 한 줄(fail-closed).
          <p role="status">{SERVICE_IDENTITY_NOT_ADMIN_NOTICE_TEXT}</p>
        )}
      </section>
      {/* 그룹 관리(T-1146, REQ-028/REQ-049) — 그룹 생성 폼을 담는 별도 섹션. 그룹 목록은 기존 select
          조회부(useApiResource<GroupRow[]>)가 소유하므로 본 slice 는 생성 성공 시 groupsRefreshNonce
          bump 로 그 조회를 권위 재조회만 갱신한다(별도 목록 카드 UI 는 Out of Scope). name 단일
          controlled input + "그룹 추가" 버튼으로 POST /api/groups(body `{ name }`)를 발사하고, name 이
          빈·공백이거나 진행 중이면 버튼을 비활성화해 발사를 억제한다(runCreateGroup 도 no-op 가드로 이중
          방어), 입력은 진행 중에도 비활성화한다. 실패 문구(createGroupError)는 폼 하단에 role="alert" 로
          안전 표시한다. Group.name 은 @unique 미정의라 409 특수 분기 없이 일반 error 로 표면화한다. */}
      <section aria-label={GROUP_HEADING}>
        <h2>{GROUP_HEADING}</h2>
        <div>
          <input
            aria-label="추가할 그룹 이름"
            type="text"
            value={groupNameInput}
            onChange={(event) => setGroupNameInput(event.target.value)}
            disabled={creatingGroup}
          />
          <button
            type="button"
            onClick={handleCreateGroup}
            disabled={creatingGroup || !groupNameInput.trim()}
          >
            그룹 추가
          </button>
          {createGroupError ? <p role="alert">{createGroupError}</p> : null}
        </div>
        {/* 그룹 수정(T-1150, REQ-028/REQ-049) — 인라인 수정 폼. GroupList 각 행의 "수정" 버튼(onEdit=
            handleEditGroup)이 편집 대상 id 를 세팅하면(editingGroupId !== null) 본 폼이 렌더된다. name
            단일 controlled input 은 클릭한 row 의 현재 name 으로 prefill 되고, 원본 name 스냅샷
            (editGroupOriginalName)과 함께 저장된다. "그룹 수정" 클릭 시 handleUpdateGroup 이 PATCH
            /api/groups/:id(body `{ name }`)를 발사하고, 성공 시 groupsRefreshNonce bump 로 권위 재조회 +
            편집 종료한다(낙관 갱신 없음 — 인원 수정 동형). 진행 중(updatingGroup)이면 입력·버튼을
            비활성화해 이중 PATCH 를 억제하고(runUpdateGroup 도 빈·공백·미변경 name/in-flight 를 no-op
            가드로 이중 방어), "취소" 로 발사 없이 편집을 닫을 수 있다. 실패 문구(updateGroupError)는 폼
            하단에 role="alert" 로 안전 표시한다(생성/삭제 error 와 별도). ADR-0041 Decision 1 —
            presentational 목록은 수정 폼을 모르므로 컨테이너가 직접 소유한다. */}
        {editingGroupId !== null ? (
          <div>
            <input
              aria-label="수정할 그룹 이름"
              type="text"
              value={editGroupNameInput}
              onChange={(event) => setEditGroupNameInput(event.target.value)}
              disabled={updatingGroup}
            />
            <button
              type="button"
              onClick={handleUpdateGroup}
              disabled={updatingGroup || !editGroupNameInput.trim()}
            >
              그룹 수정
            </button>
            <button
              type="button"
              onClick={handleCancelEditGroup}
              disabled={updatingGroup}
            >
              취소
            </button>
            {updateGroupError ? (
              <p role="alert">{updateGroupError}</p>
            ) : null}
          </div>
        ) : null}
        {/* 그룹 목록 카드(T-1148 마운트, T-1149 삭제 배선, REQ-028/REQ-049) — 기존 그룹 조회
            (useApiResource<GroupRow[]>)의 data/loading/error 를 재사용해(새 fetch 추가 없음 —
            double-fetch 회피) GroupList 로 내려보낸다. data 가 undefined(미조회/진행 중/실패)이면
            `?? []` 로 빈 배열을 안전하게 넘겨 throw 없이 렌더한다(경계 방어). onDelete(handleDeleteGroup)
            를 내려 각 행에 삭제 버튼을 배선한다(T-1149, PersonList onDelete 동형). loading 은 조회+삭제
            in-flight 를 합성(groupLoading||deletingGroup), error 는 삭제 실패를 우선 노출
            (deleteGroupError??groupError — mutation 우선). 성공 시 groupsRefreshNonce bump 로 권위
            재조회한다(낙관 제거 없음). onEdit(handleEditGroup)를 내려 각 행에 수정 버튼을 배선한다
            (T-1150, PersonList onEdit 동형 — 클릭 시 대상 id 로 인라인 수정 폼을 연다). 로컬 GroupRow 를
            그대로 넘긴다(GroupList 의 named GroupRow 미import — 구조적 타입 호환). ADR-0041 Decision 1 —
            presentational 컴포넌트는 fetch 를 모른다. */}
        <GroupList
          groups={data ?? []}
          loading={groupLoading || deletingGroup}
          error={deleteGroupError ?? groupError}
          onDelete={handleDeleteGroup}
          onEdit={handleEditGroup}
        />
      </section>
      {/* 파트 관리(T-1152 마운트, T-1153 생성 배선, T-1154 삭제 배선, T-1155 수정 배선,
          REQ-028/REQ-049) — 그룹
          마운트(T-1148)와 동형이나 재사용할 기존 파트 fetch 가 없어 useApiResource<PartRow[]>(PARTS_PATH)
          신규 조회의 data/loading/error 를 PartList 로 내려보낸다(ADR-0041 Decision 1 — 컴포넌트는 fetch
          를 모른다). data 가 undefined(미조회/진행 중/실패)이면 `?? []` 로 빈 배열을 안전하게 넘겨 throw
          없이 렌더한다(경계 방어). onDelete(handleDeletePart)를 내려 각 행에 삭제 버튼을 배선한다(T-1154,
          GroupList onDelete 동형). loading 은 조회+삭제 in-flight 를 합성(partLoading||deletingPart),
          error 는 삭제 실패를 우선 노출(deletePartError??partError — mutation 우선). 성공 시
          partsRefreshNonce bump 로 권위 재조회한다(낙관 제거 없음). onEdit(handleEditPart)도 내려 각 행에
          수정 버튼을 배선한다(T-1155 — 파트 CRUD 완결). PartList 의 named PartRow 를 그대로 조회 제네릭·props 타입에 쓴다
          (로컬 PartRow 부재 — 이름 충돌 없음). */}
      <section aria-label={PART_HEADING}>
        <h2>{PART_HEADING}</h2>
        {/* 파트 생성(T-1153, REQ-028/REQ-049) — 그룹 생성 폼(T-1146)을 mirror. name 단일 controlled
            input + "파트 추가" 버튼으로 POST /api/parts(body `{ name }`)를 발사하고, name 이 빈·공백
            이거나 진행 중이면 버튼을 비활성화해 발사를 억제한다(runCreatePart 도 no-op 가드로 이중 방어),
            입력도 진행 중엔 비활성화한다. 성공 시 partsRefreshNonce bump 로 위 파트 조회를 권위 재조회한다
            (별도 낙관 추가 없음). 실패 문구(createPartError)는 폼 하단에 role="alert" 로 안전 표시한다 —
            Part.name @unique 위반 409 는 "이미 존재하는 파트 이름입니다" 전용 문구로 구분 표면화한다. */}
        <div>
          <input
            aria-label="추가할 파트 이름"
            type="text"
            value={partNameInput}
            onChange={(event) => setPartNameInput(event.target.value)}
            disabled={creatingPart}
          />
          <button
            type="button"
            onClick={handleCreatePart}
            disabled={creatingPart || !partNameInput.trim()}
          >
            파트 추가
          </button>
          {createPartError ? <p role="alert">{createPartError}</p> : null}
        </div>
        {/* 파트 수정(T-1155, REQ-028/REQ-049) — 인라인 수정 폼. PartList 각 행의 "수정" 버튼(onEdit=
            handleEditPart)이 편집 대상 id 를 세팅하면(editingPartId !== null) 본 폼이 렌더된다. name
            단일 controlled input 은 클릭한 row 의 현재 name 으로 prefill 되고, 원본 name 스냅샷
            (editPartOriginalName)과 함께 저장된다. "파트 수정" 클릭 시 handleUpdatePart 가 PATCH
            /api/parts/:id(body `{ name }`)를 발사하고, 성공 시 partsRefreshNonce bump 로 권위 재조회 +
            편집 종료한다(낙관 갱신 없음 — 그룹 수정 동형). 진행 중(updatingPart)이면 입력·버튼을
            비활성화해 이중 PATCH 를 억제하고(runUpdatePart 도 빈·공백·미변경 name/in-flight 를 no-op
            가드로 이중 방어), "취소" 로 발사 없이 편집을 닫을 수 있다(입력 원복). 실패 문구
            (updatePartError)는 폼 하단에 role="alert" 로 안전 표시한다 — Part.name @unique 위반 409 는
            "이미 존재하는 파트 이름입니다" 전용 문구로 구분 표면화한다(그룹과의 차이). ADR-0041
            Decision 1 — presentational 목록은 수정 폼을 모르므로 컨테이너가 직접 소유한다. */}
        {editingPartId !== null ? (
          <div>
            <input
              aria-label="수정할 파트 이름"
              type="text"
              value={editPartNameInput}
              onChange={(event) => setEditPartNameInput(event.target.value)}
              disabled={updatingPart}
            />
            <button
              type="button"
              onClick={handleUpdatePart}
              disabled={updatingPart || !editPartNameInput.trim()}
            >
              파트 수정
            </button>
            <button
              type="button"
              onClick={handleCancelEditPart}
              disabled={updatingPart}
            >
              취소
            </button>
            {updatePartError ? <p role="alert">{updatePartError}</p> : null}
          </div>
        ) : null}
        {/* onEdit(handleEditPart)를 내려 각 행에 수정 버튼을 배선한다(T-1155, GroupList onEdit 동형 —
            클릭 시 대상 id 로 위 인라인 수정 폼을 연다). loading 은 조회+삭제 in-flight 합성 그대로
            둔다(수정 진행 표시는 폼 자체의 비활성화가 담당 — 목록을 로딩으로 가려 수정 폼이 사라지는
            혼란 방지, 그룹 수정 배선 동형). */}
        <PartList
          parts={partsData ?? []}
          loading={partLoading || deletingPart}
          error={deletePartError ?? partError}
          onDelete={handleDeletePart}
          onEdit={handleEditPart}
        />
        {/* 파트 소속 인원 조회(T-1156, REQ-049) — 그룹 멤버십 조건부 조회(T-1129) 를 mirror 한다.
            파트 선택 <select>(컨테이너 소유 selectedPartId)가 값을 가지면 buildPartPersonsPath 가
            path 를 만들어 GET /api/parts/:id/persons 를 조건부 조회하고, 미선택이면 null → 미조회
            (idle)로 남는다. 조회 결과는 기존 PersonList 를 읽기 전용으로 재사용해 렌더한다 —
            onDelete/onEdit 를 전달하지 않아 삭제·수정 버튼이 렌더되지 않는다(소속 인원 배정·해제
            mutation 은 Out of Scope). 빈 상태 문구는 미선택(NO_PART_SELECTED_TEXT)과 인원 0
            (EMPTY_PART_PERSON_TEXT)을 구분해 내려보낸다. 컴포넌트 수정 0(ADR-0041 Decision 1). */}
        <select
          aria-label="소속 인원을 볼 파트 선택"
          value={selectedPartId}
          onChange={(event) => setSelectedPartId(event.target.value)}
        >
          <option value="">{PART_NO_SELECTION_LABEL}</option>
          {(partsData ?? []).map((part, index) => (
            <option key={part.id ?? `pt${index + 1}`} value={part.id ?? ''}>
              {/* name 누락 row 도 throw 없이 안전 렌더한다(PartList 의 placeholder 정합). */}
              {part.name ?? '(이름 없음)'}
            </option>
          ))}
        </select>
        <PersonList
          persons={partPersons}
          loading={partPersonLoading}
          error={partPersonError}
          emptyMessage={
            selectedPartId ? EMPTY_PART_PERSON_TEXT : NO_PART_SELECTED_TEXT
          }
        />
      </section>
      {/* 수집 대상 관리(T-1825 마운트, ADR-0059 §Follow-ups (e), REQ-070/REQ-072) — 파트 관리
          섹션 뒤, 최외곽 </section> 앞에 새 읽기 축 섹션을 추가한다. 위 useApiResource
          <CollectionTargetRow[]>(COLLECTION_TARGETS_PATH) **한 호출**의 data/loading/error 를
          그대로 CollectionTargetList 로 내려보낸다(ADR-0041 Decision 1 — 컴포넌트는 fetch 를
          모른다). data 는 위에서 Array.isArray 로 정상화한 collectionTargets 를 쓰므로 미조회/
          진행 중/실패/비-배열 응답 어디서도 throw 하지 않는다.
          gating — backend GET 이 `@Roles("User")` 조회 tier 이고 본 섹션에는 편집 컨트롤이
          없으므로 isAdmin gating **바깥**에 둔다(403 유발 0 — 등록·수정·삭제 폼이 붙는 후속
          편집 slice 가 그 컨트롤에만 Admin+ gating 을 얹는다). */}
      <section aria-label={COLLECTION_TARGET_HEADING}>
        <h2>{COLLECTION_TARGET_HEADING}</h2>
        <CollectionTargetList
          targets={collectionTargets}
          loading={collectionTargetLoading}
          error={collectionTargetError}
          emptyMessage={EMPTY_COLLECTION_TARGET_TEXT}
          /* 삭제 진입점(T-1828) — backend `@Delete(":id")` 가 `@Roles("Admin")` 이라 non-Admin
             에게는 콜백을 내리지 않아 버튼 자체가 렌더되지 않는다(403 확정 컨트롤 미노출 —
             등록 폼 gating 과 동형). 목록 본체는 종전대로 gating 바깥에 남는다. */
          onDelete={isAdmin ? handleDeleteCollectionTarget : undefined}
          /* 활성/비활성 토글 진입점(T-1829) — backend `@Patch(":id")` 가 `@Roles("Admin")` 이라
             non-Admin 에게는 콜백을 내리지 않아 버튼 자체가 렌더되지 않는다(REQ-073 RBAC
             게이팅 — 403 확정 컨트롤 미노출). 목록 본체는 종전대로 gating 바깥에 남는다. */
          onToggleActive={
            isAdmin ? handleToggleCollectionTargetActive : undefined
          }
          /* 값 편집(endpoint) 진입점 + 인라인 폼 배선(T-1831) — backend `@Patch(":id")` 가
             `@Roles("Admin")` 이라 non-Admin 에게는 편집 콜백을 일체 내리지 않아 버튼·폼이
             렌더되지 않는다(REQ-073 RBAC 게이팅 — 403 확정 컨트롤 미노출). editingId 도
             Admin 일 때만 내려 non-Admin 화면에서 폼이 뜰 경로 자체를 없앤다. 값·입력 변경·
             취소 3 props 는 gating 하지 않는데, 폼이 뜨는 조건(editingId 일치)이 이미 Admin
             에서만 성립해 non-Admin 에게는 호출될 경로가 없는 inert 값이기 때문이다. */
          onEditStart={isAdmin ? handleStartEditCollectionTarget : undefined}
          editingId={isAdmin ? editingCollectionTargetId : undefined}
          editEndpoint={collectionTargetEndpointEditInput}
          onEditEndpointChange={setCollectionTargetEndpointEditInput}
          onEditSubmit={isAdmin ? handleSubmitEditCollectionTarget : undefined}
          onEditCancel={handleCancelEditCollectionTarget}
          editBusy={updatingCollectionTargetId !== undefined}
          /* 범위 배열 3 축 편집 배선(T-1832) — 변경 콜백은 편집 진입점과 같은 기준으로 Admin
             일 때만 내린다(같은 `@Roles("Admin")` PATCH — 403 확정 컨트롤 미노출, REQ-073).
             콜백이 없으면 목록이 범위 입력을 아예 렌더하지 않으므로 non-Admin 화면에는 입력
             자체가 없다. 값(editScopes)은 gating 하지 않는데, 입력이 뜨는 조건이 이미 Admin
             에서만 성립해 non-Admin 에게는 inert 값이기 때문이다(editEndpoint 동형). */
          editScopes={collectionTargetScopeEditInput}
          onEditScopeChange={
            isAdmin ? handleChangeCollectionTargetScope : undefined
          }
        />
        {/* 삭제 실패 문구(T-1828) — 목록·등록 폼과 별도 축이라 섹션 안 독립 alert 로 노출한다
            (등록 폼의 error props 와 섞이면 어느 동작이 실패했는지 구분되지 않는다). 값이
            없으면 미렌더라 정상 화면에는 빈 alert 가 남지 않는다. */}
        {deleteCollectionTargetError ? (
          <div role="alert">{deleteCollectionTargetError}</div>
        ) : null}
        {/* 토글 실패 문구(T-1829) — 삭제 문구와 별도 alert 다(같은 자리를 쓰면 어느 동작이
            실패했는지 구분되지 않는다). 값이 없으면 미렌더라 정상 화면에 빈 alert 는 없다. */}
        {toggleCollectionTargetError ? (
          <div role="alert">{toggleCollectionTargetError}</div>
        ) : null}
        {/* 편집 저장 실패 문구(T-1831) — 삭제·토글 문구와 또 별도 alert 다(어느 동작이 실패했는지
            구분되게). 값이 없으면 미렌더라 정상 화면에 빈 alert 는 남지 않는다. */}
        {updateCollectionTargetError ? (
          <div role="alert">{updateCollectionTargetError}</div>
        ) : null}
        {/* 등록 폼(T-1826, ADR-0059 §Follow-ups (e) 편집 축) — POST /api/collection-targets 가
            `@Roles("Admin")` 편집 tier 라 isAdmin 이 true 일 때만 렌더한다(non-Admin 에게
            보이면 403 이 확정된 컨트롤을 노출하는 셈). 위 목록은 GET 이 `@Roles("User")` 라
            종전대로 gating 바깥에 그대로 둔다 — 읽기 축 회귀 0. */}
        {isAdmin ? (
          <CollectionTargetAddForm
            type={collectionTargetTypeInput}
            instanceKey={collectionTargetInstanceKeyInput}
            endpoint={collectionTargetEndpointInput}
            onTypeChange={setCollectionTargetTypeInput}
            onInstanceKeyChange={setCollectionTargetInstanceKeyInput}
            onEndpointChange={setCollectionTargetEndpointInput}
            onSubmit={handleCreateCollectionTarget}
            loading={creatingCollectionTarget}
            error={createCollectionTargetError}
          />
        ) : null}
      </section>
    </section>
  );
}

export {
  findGroup,
  deriveMembers,
  buildGroupMembersPath,
  deriveMembersFromMemberships,
  deriveAddCandidates,
  deriveProviders,
  deriveProviderConfigs,
  deriveDifficultyMapping,
  buildMappingsPath,
  buildProvidersPath,
  buildPersonsPath,
  buildGroupsPath,
  buildPartsPath,
  buildUsersPath,
  buildPartPersonsPath,
  buildServiceIdentitiesPath,
  buildExportInput,
  runAdminExportJob,
  mergeMapping,
  runAssign,
  runImport,
  formatImportJobDetail,
  runImportPreview,
  formatRestorePlanConfirmText,
  formatRestoreTotalsPhrase,
  runConfirmedImport,
  clearImportConfirm,
  runApply,
  runTrigger,
  deriveScheduleMessage,
  buildRecentDeletionPath,
  runReEvaluate,
  runRemove,
  runDeleteProvider,
  runAdd,
  runCreateProvider,
  runCreatePerson,
  extractCreatedPersonId,
  runCreateServiceIdentity,
  runCreateCollectionTarget,
  runDeleteCollectionTarget,
  runToggleCollectionTargetActive,
  // 범위 배열 편집(T-1832)의 순수 helper 2 종 — 컨테이너 state 는 정적 렌더에서 관측되지 않아
  // prefill 접기/축 조립 규칙을 단위로 잠그려면 export 가 필요하다(선례: extractCreatedPersonId).
  foldScopeForEdit,
  buildScopePatch,
  runUpdateServiceIdentity,
  runDeleteServiceIdentity,
  runSetPrimaryServiceIdentity,
  runCreateGroup,
  runCreatePart,
  runCreateUser,
  describeCreateUserFailure,
  // T-1835 — 줄 배열 정본 + 렌더 판정 helper + 줄 element className(모두 spec 단위 검증 대상).
  describeCreateUserFailureLines,
  hasCreateUserErrorLines,
  CREATE_USER_ERROR_LINE_CLASS,
  runChangeRole,
  buildInstanceAccessPath,
  runGrantInstanceAccess,
  runRevokeInstanceAccess,
  deriveInstanceAccessFormFlags,
  deriveServiceIdentityRowActionsFlags,
  buildServiceIdentityRowActionBridge,
  buildServiceIdentityRowActionsProps,
  buildServiceIdentityRowActionsSlot,
  beginServiceIdentityEdit,
  createInFlightIdGate,
  runDeletePerson,
  runDeleteGroup,
  runDeletePart,
  resolveSelectedPartIdAfterDelete,
  buildDeletePartBumpRefresh,
  buildPersonPatch,
  runUpdatePerson,
  runUpdateGroup,
  runUpdatePart,
  runUpdateProvider,
  resolveProviderSelectValue,
  LLM_PROVIDER_OPTIONS,
  isAdminRole,
};
export type {
  AdminViewProps,
  GroupRow,
  GroupMemberRow,
  MembershipRow,
  LlmProviderRow,
  DifficultyMappingRow,
  MeRow,
  AssignDeps,
  DownloadDeps,
  RunAdminExportJobDeps,
  ImportDeps,
  ImportPreviewDeps,
  ConfirmImportDeps,
  ScheduleMutationDeps,
  ReEvaluationDeps,
  RemoveDeps,
  DeleteProviderDeps,
  AddDeps,
  CreateProviderFields,
  CreateProviderDeps,
  CreatePersonFields,
  CreatePersonDeps,
  CreateGroupDeps,
  CreatePartDeps,
  CreateUserDeps,
  ChangeRoleDeps,
  GrantInstanceAccessDeps,
  RevokeInstanceAccessDeps,
  InstanceAccessFormInput,
  InstanceAccessFormFlags,
  ServiceIdentityRowFlagsInput,
  ServiceIdentityRowActionsFlags,
  ServiceIdentityRowActionBridgeDeps,
  ServiceIdentityRowActionBridge,
  ServiceIdentityRowActionsWiringDeps,
  BeginServiceIdentityEditDeps,
  InFlightIdGate,
  DeletePersonDeps,
  DeleteGroupDeps,
  DeletePartDeps,
  PersonPatchInput,
  PersonPatch,
  UpdatePersonDeps,
  UpdateGroupDeps,
  UpdatePartDeps,
  UpdateProviderFields,
  UpdateProviderDeps,
};
export default AdminView;
