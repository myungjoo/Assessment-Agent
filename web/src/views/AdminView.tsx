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
// T-1893 — ApiError 는 파트 생성 · 수정의 isConflict 판정에만 쓰이던 마지막 소비처가
// useAdminParts 로 옮겨가 이 파일에서 미사용이 됐다(배럴 재수출 대상도 아님). 러너 deps 에
// 계속 주입되는 request 만 남긴다 — 공개 표면 무변경.
import { request } from '../api/apiClient';
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
// T-1887 — `Difficulty` type 은 LLM 축과 함께 useAdminLlmProviders 로 옮겨져 본 컨테이너에서는
// 더 이상 참조되지 않는다(배럴 재수출 대상도 아님). 미사용 import 를 남기면 tsc noUnusedLocals 가
// 잡으므로 이 한 줄만 지운다 — 배럴이 재수출하는 축 관련 import 10 종 + row 타입 2 종은 그대로다.
// P6 wiring ④d (T-0388) — 세 번째 패널 DataImportExportPanel export 배선. presentational
// 컴포넌트는 수정 0 으로 named import 만(ADR-0041 Decision 1 — 패널은 fetch 를 모른다).
import DataImportExportPanel from '../components/DataImportExportPanel';
// import/export 축 hook(T-1884 순수 추출) — 본 컨테이너의 export/import prelude 를 통째로 옮긴
// 모듈. 컨테이너는 반환 3 심볼만 소비하고 축 내부 상태 · 러너 주입은 hook 이 소유한다.
import { useAdminImportExport } from './useAdminImportExport';
// LLM provider · 난이도 매핑 축 hook(T-1887 순수 추출) — 본 컨테이너의 LLM 축 prelude 를 통째로
// 옮긴 모듈. 컨테이너는 반환 36 심볼만 소비하고 축 내부 상태 · 러너 주입은 hook 이 소유한다.
import { useAdminLlmProviders } from './useAdminLlmProviders';
// ServiceIdentity 축 hook(T-1888 순수 추출) — 본 컨테이너의 ServiceIdentity prelude 를 통째로
// 옮긴 모듈. 컨테이너는 반환 23 심볼만 소비하고 축 내부 상태 · 러너 주입 · 행 액션 gate 는 hook 이
// 소유한다. props 유래 초기값 2 개만 인자로 넘긴다.
import { useAdminServiceIdentities } from './useAdminServiceIdentities';
// 스케줄 · 재평가 축 hook(T-1889 순수 추출) — 본 컨테이너의 스케줄 패널 · 재평가 트리거 패널
// prelude 두 구역을 통째로 옮긴 모듈. 컨테이너는 반환 15 심볼만 소비하고 축 내부 상태 · 조회 ·
// 러너 주입은 hook 이 소유한다. props 유래 초기값 5 개와 축 밖 값 members 만 인자로 넘긴다.
import { useAdminSchedule } from './useAdminSchedule';
// 사용자 관리 축 hook ①(T-1891 순수 추출) — 사용자 목록 조회 + 생성 배선 한 구역을 통째로 옮긴
// 모듈. 컨테이너는 반환 심볼만 소비하고 조회 nonce · path 파생 · 생성 상태 전이는 hook 이
// 소유한다. 인자는 없다(축 밖 의존 0). 배럴에는 추가하지 않는다(공개 표면 무변경).
import { useAdminUsers } from './useAdminUsers';
// 파트 축 hook(T-1893 순수 추출) — 본 컨테이너의 파트 축 3 조각(목록 조회 · 선택/소속 인원 조회 ·
// 생성/삭제/수정 mutation 배선)을 통째로 옮긴 모듈. 컨테이너는 반환 24 심볼만 소비하고 축 내부
// 상태 · 조회 path · 러너 주입은 hook 이 소유한다. props 유래 초기값 1 개만 인자로 넘긴다.
// 배럴에는 추가하지 않는다(공개 표면 무변경).
import { useAdminParts } from './useAdminParts';
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
// T-1888 — ServiceIdentity api primitive 4 종(create/update/delete/setPrimary)과 `ServiceIdentityRow`
// type 은 축과 함께 useAdminServiceIdentities 로 옮겨져 본 컨테이너에서는 미사용이 되어 함께
// 정리했다(T-1887 의 `Difficulty` type 선례 동형). 다섯 심볼 모두 파일 끝 배럴의 재수출 대상이
// 아니어서 제거해도 공개 표면은 한 글자도 바뀌지 않는다 — 배럴이 재수출하는 축 러너 4 · 경로 빌더 ·
// 행 액션 5 · 타입 6 은 그대로 둔다.
// 그룹 목록 마운트 대상(T-1148, T-1147 presentational) — default export 만 가져온다. GroupList 도
// 자체 GroupRow 를 named export 하지만 여기서는 import 하지 않고 AdminView 로컬 GroupRow(L327)를
// 그대로 props 로 넘긴다(구조적 타입 호환 — 중복 식별자·이름 충돌 회피, task Required Reading).
import GroupList from '../components/GroupList';
// 파트 목록 마운트 대상(T-1152, T-1151 presentational) — default PartList 를 가져온다. 조회
// 제네릭·props 타입에 쓰던 named PartRow 타입은 T-1893 이 파트 축 배선을 useAdminParts 로 옮기며
// 이 파일에서 미사용이 되어 함께 정리했다(배럴 재수출 대상도 아니라 공개 표면 무변경 — 바로 아래
// UserRow / 위 CollectionTargetRow 선례 동형).
import PartList from '../components/PartList';
// 사용자 목록 마운트 대상(T-1159, T-1158 presentational) — default UserList 를 가져온다. 조회
// 제네릭에 쓰던 named UserRow 타입은 T-1891 이 조회를 useAdminUsers 로 옮기며 이 파일에서 미사용이
// 되어 함께 정리했다(배럴 재수출 대상도 아니라 공개 표면 무변경 — 위 CollectionTargetRow 선례 동형).
import UserList from '../components/UserList';
// 수집 대상 목록 마운트 대상(T-1825, ADR-0059 §Follow-ups (e)) — default CollectionTargetList 를
// 가져온다. 조회 제네릭에 쓰던 named CollectionTargetRow 타입은 T-1886 이 조회를
// useAdminCollectionTargets 로 옮기며 이 파일에서 미사용이 되어 함께 정리했다(배럴 재수출 대상도
// 아니라 공개 표면 무변경 — PartRow / UserRow 의 default import 관행은 그대로다).
import CollectionTargetList from '../components/CollectionTargetList';
// 수집 대상 등록 폼 마운트 대상(T-1826, ADR-0059 §Follow-ups (e) 편집 축) — 목록 아래에
// Admin+ 일 때만 렌더한다(POST 가 `@Roles("Admin")` 편집 tier). 허용 type 목록
// (COLLECTION_TARGET_TYPES)은 T-1886 이 등록 입력 상태와 함께 hook 으로 옮겨 여기서는 쓰지 않는다.
import CollectionTargetAddForm from '../components/CollectionTargetAddForm';
// 수집 대상 러너 군(T-1830 순수 추출) — 등록 POST · 삭제 DELETE · 활성 토글 PATCH 세 러너와
// prefill 접기/축 조립 helper 를 담은 모듈. 본문은 한 줄도 바뀌지 않았고, 파일 끝 export 목록이
// 이 5 심볼을 그대로 re-export 하므로 기존 spec 의 `from './AdminView'` 도 그대로 산다
// (T-1886 이 실호출을 hook 으로 옮긴 뒤에도 **배럴 재수출 유지를 위해 import 를 남긴다**).
import {
  buildScopePatch,
  foldScopeForEdit,
  runCreateCollectionTarget,
  runDeleteCollectionTarget,
  runToggleCollectionTargetActive,
} from './adminCollectionTargetRunners';
// 수집 대상 축 prelude hook(T-1886 순수 추출) — 조회 · 파생 · 상태 14 · 핸들러 7 을 담는다.
import { useAdminCollectionTargets } from './useAdminCollectionTargets';
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

  // ServiceIdentity 축 배선(T-1888 순수 추출) — 조회 1 + 경로 1 + 파생 3 + slot 1 + 상태 13 +
  // in-flight gate 2 + 핸들러 · 리셋 7 = 28 선언이 useAdminServiceIdentities 로 통째로 옮겨갔다.
  // 본문 무변경 이동이라 동작 · 렌더 트리 · 조회 순번은 이동 전과 동일하고, 여기서는 props 유래
  // 초기값 2 개를 넘겨 hook 이 공개하는 23 심볼만 되받는다(내부 nonce · 경로 · 행 액션 state ·
  // gate 는 hook 안에 캡슐화 — 축 밖에서 건드릴 경로 없음). 위치는 인원 조회 직후 그대로 두어야
  // 한다 — 기존 spec 이 useApiResource mock 을 호출 순번으로 라우팅하는 케이스가 있다.
  const {
    selectedIdentityPersonId,
    setSelectedIdentityPersonId,
    handleIdentityPersonChange,
    serviceIdentities,
    serviceIdentityLoading,
    serviceIdentityError,
    serviceIdentityRowActionsSlot,
    identityServiceInput,
    setIdentityServiceInput,
    identityExternalIdInput,
    setIdentityExternalIdInput,
    creatingServiceIdentity,
    createServiceIdentityError,
    handleCreateServiceIdentity,
    editingIdentityId,
    editingIdentity,
    handleEditTargetChange,
    identityEditExternalIdInput,
    setIdentityEditExternalIdInput,
    updatingServiceIdentity,
    updateServiceIdentityError,
    endServiceIdentityEdit,
    handleUpdateServiceIdentity,
  } = useAdminServiceIdentities(
    initialSelectedIdentityPersonId,
    initialEditingIdentityId,
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

  // LLM provider · 난이도 매핑 축 hook(T-1887) — 조회 2 + 경로·파생 5 + 합성 2 + 상태 18 +
  // 핸들러·리셋 7 = 37 선언을 useAdminLlmProviders 로 순수 추출했다(동작 변경 0). 컨테이너는
  // JSX LLM 패널 구역이 쓰는 36 심볼만 되돌려 쓰고, 축 내부 nonce · 원본 응답 · setter 는 hook
  // 안에 캡슐화된다. 호출 위치는 이동 전 블록이 있던 자리 그대로다 — 두 useApiResource 조회의
  // 순번이 바뀌면 호출 순서로 route 를 구분하는 기존 spec 이 red 가 된다.
  const {
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
  } = useAdminLlmProviders();

  // import/export 축 hook(T-1884) — export/import 상태 9 + 핸들러 5 + 패널 props 파생 1 을
  // useAdminImportExport 로 순수 추출했다(동작 변경 0). 컨테이너는 소비처 JSX 3 곳이 쓰는 3 심볼만
  // 되돌려 쓰고, 축 내부 setter 는 hook 안에 캡슐화된다.
  const { selectedScope, handleScopeChange, importExportPanelProps } =
    useAdminImportExport(initialImportConfirmText);

  // 스케줄 · 재평가 축 배선(T-0885 · T-0886)은 T-1889 에서 useAdminSchedule 로 순수 추출했다
  // (동작 변경 0). 컨테이너는 JSX 소비처 두 덩어리(SchedulePanel · 재평가 인원 <select> + 재평가
  // 패널)가 쓰는 15 심볼만 되돌려 쓰고, 축 내부 setter 와 조회 원본은 hook 안에 캡슐화된다. 축 밖
  // 값은 그룹 축 파생 members 하나뿐이라 props 유래 초기값 5 개와 함께 단일 object 로 넘긴다.
  const {
    cronExpression,
    scheduleBusy,
    schedulePanelMessage,
    schedulePanelError,
    handleCronChange,
    handleApply,
    handleManualTrigger,
    selectedPersonId,
    selectedDays,
    reevalSubmitting,
    reevalError,
    personOptions,
    handleReevalTrigger,
    handleReevalSelect,
    handlePersonChange,
  } = useAdminSchedule({
    initialCronExpression,
    initialScheduleBusy,
    initialSelectedPersonId,
    initialSelectedDays,
    initialReevalSubmitting,
    members,
  });

  // 파트 축 전체 배선(T-1893 순수 추출) — 이동 전 `1085 행` ~ `1106 행`(재조회 nonce · nonce-aware
  // path · `useApiResource<PartRow[]>` 목록 조회) · `1141 행` ~ `1171 행`(선택 파트 상태 · 조건부
  // 소속 인원 path · `useApiResource<PersonRow[]>` 조회 · partPersons 방어 파생) · `1208 행` ~
  // `1372 행`(생성 · 삭제 · 수정 상태 11 + 핸들러 6) 세 조각을 useAdminParts hook 이 그대로
  // 소유한다(본문 · deps 배열 · 러너 주입 키 무변경 — 동작 변경 0). 아래 파트 관리 섹션 JSX 가
  // destructure 한 값을 그대로 되돌려 쓴다(소비처 동반). props 유래 초기값 initialSelectedPartId
  // 하나만 인자로 넘긴다(축 밖 의존 0 — 그룹 · 인원 · 멤버십 파생 참조 0). 호출 위치는 조각 (A)
  // 자리 그대로라 수집 대상 · 사용자 hook 호출 순번을 건드리지 않는다.
  const {
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
  } = useAdminParts(initialSelectedPartId);

  // 수집 대상 축 prelude(T-1886 순수 추출) — 조회 1 + 파생 1 + 상태 14 + 핸들러 7 = 23 선언을
  // useAdminCollectionTargets hook 으로 통째로 옮기고 여기서는 소비 심볼만 되돌려 쓴다(본문 무변경
  // 이동 — 동작 변경 0). **호출 위치를 옮기지 않는다**: 기존 collection-targets spec 이
  // useApiResource mock 을 호출 순서로 구분하므로 파트 목록 조회 직후라는 순번이 계약이다.
  const {
    collectionTargets,
    collectionTargetLoading,
    collectionTargetError,
    collectionTargetTypeInput,
    collectionTargetInstanceKeyInput,
    collectionTargetEndpointInput,
    setCollectionTargetTypeInput,
    setCollectionTargetInstanceKeyInput,
    setCollectionTargetEndpointInput,
    creatingCollectionTarget,
    createCollectionTargetError,
    deleteCollectionTargetError,
    toggleCollectionTargetError,
    updateCollectionTargetError,
    editingCollectionTargetId,
    updatingCollectionTargetId,
    collectionTargetEndpointEditInput,
    setCollectionTargetEndpointEditInput,
    collectionTargetScopeEditInput,
    handleCreateCollectionTarget,
    handleDeleteCollectionTarget,
    handleToggleCollectionTargetActive,
    handleStartEditCollectionTarget,
    handleChangeCollectionTargetScope,
    handleCancelEditCollectionTarget,
    handleSubmitEditCollectionTarget,
  } = useAdminCollectionTargets();

  // 사용자 관리 축 전체 배선(T-1891 슬라이스 ① + T-1892 슬라이스 ② 순수 추출) — 이동 전
  // `1170 행` ~ `1227 행` 의 조회 nonce · nonce-aware path · useApiResource 조회 · 생성
  // 입력/in-flight/실패 문구 상태 · handleCreateUser 와, 이동 전 `1194 행` ~ `1288 행` 의 역할 변경
  // 2 상태 · 진행 id gate · handleChangeRole · 인스턴스 접근 6 상태 · grant/revoke 핸들러 ·
  // deriveInstanceAccessFormFlags 파생을 useAdminUsers hook 이 그대로 소유한다(본문 · deps 배열 ·
  // 러너 주입 키 무변경 — 동작 변경 0). 아래 사용자 관리 섹션 JSX 가 destructure 한 값을 그대로
  // 되돌려 쓴다(소비처 동반). 슬라이스 ① 의 한시적 노출이던 setUsersRefreshNonce 는 그 유일
  // 소비처(역할 변경 · 인스턴스 접근 bumpRefresh)가 hook 안으로 들어와 사라졌다.
  const {
    usersData,
    userLoading,
    userError,
    userEmailInput,
    setUserEmailInput,
    userPasswordInput,
    setUserPasswordInput,
    creatingUser,
    createUserError,
    createUserErrorLines,
    handleCreateUser,
    changingRoleId,
    changeRoleError,
    handleChangeRole,
    instanceAccessUserId,
    setInstanceAccessUserId,
    instanceRefInput,
    setInstanceRefInput,
    instanceAccessError,
    instanceAccessNotice,
    handleGrantInstanceAccess,
    handleRevokeInstanceAccess,
    instanceAccessBusy,
    instanceAccessActionDisabled,
  } = useAdminUsers();

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
