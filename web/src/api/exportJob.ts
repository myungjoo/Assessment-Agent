// export-job API client — P6 export 계약 정합(T-1242, api.md 124 / export.controller.ts).
// web 이 과거 `GET /api/admin/export`(단발 Blob 모델)로 호출하던 것을 backend 의 job
// 기반 POST 계약(권위 = api.md 124 + `@Controller("api/admin/export")`)에 맞춰 조립하는
// 격리된 순수 client 모듈이다. AdminView 배선은 후속 slice — 본 모듈은 primitive 만 제공.
//
// 정책 (재구현 금지 — apiClient 위임):
//  - fetch/credentials/401→refresh 재시도/비-2xx→ApiError/네트워크→ApiError(0) 는
//    모두 `request`/`requestRaw` 가 담당한다. 본 모듈은 경로·HTTP method·body 조립과
//    job 계약 표현만 진다(중복 0).
//  - JSON body 를 파싱해 받는 함수(create/get/listRunning)는 `request`, 이진/스트리밍
//    raw Response 를 소비해야 하는 다운로드는 `requestRaw` 를 쓴다(Blob 정합).
//  - `id` 는 항상 `encodeURIComponent` 로 인코딩해 경로 인젝션/비정상 문자를 방어한다.

import { request, requestRaw } from './apiClient';
import type { RequestOptions } from './apiClient';

// 권위 계약 경로 — api.md 124 `POST /api/admin/export`. 하위 route 는 이 상수를 조립.
const EXPORT_BASE_PATH = '/api/admin/export';

// 최소 구조적 타입 — backend 타입 import 금지(web/backend 별도 빌드, 수동 동기
// trade-off, AdminView L204 convention 계승). 필요한 필드만 최소로 선언한다.
interface ExportJob {
  id: string;
  status: string;
}

// 생성 입력 — api.md 124 `CreateExportDto`(scope/dateRange/entitySelector) 정합.
// 필드는 모두 optional — 미전달 시 backend 기본 scope 에 위임한다(빈 body 경계값).
interface CreateExportInput {
  scope?: string;
  dateRange?: unknown;
  entitySelector?: unknown;
}

// JSON body 를 보내는 공통 옵션 — Content-Type + method 를 조립한다.
function jsonPost(input: CreateExportInput): RequestOptions {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  };
}

// export job 생성 — POST /api/admin/export, body = CreateExportDto. 생성된 job
// (id·status=PENDING 포함)을 그대로 resolve 한다. 403/네트워크 등은 request 가
// ApiError 로 표면화하며 본 함수는 삼키지 않고 전파한다.
async function createExportJob(input: CreateExportInput): Promise<ExportJob> {
  return request<ExportJob>(EXPORT_BASE_PATH, jsonPost(input));
}

// export job 상태 조회 — GET /api/admin/export/:id. id 는 encodeURIComponent 로 인코딩.
async function getExportJob(id: string): Promise<ExportJob> {
  return request<ExportJob>(`${EXPORT_BASE_PATH}/${encodeURIComponent(id)}`);
}

// 진행 중 export job 목록 — GET /api/admin/export/running. 빈 배열도 정상 통과.
async function listRunningExportJobs(): Promise<ExportJob[]> {
  return request<ExportJob[]>(`${EXPORT_BASE_PATH}/running`);
}

// export 결과 다운로드 — GET /api/admin/export/:id/download 를 requestRaw 로 호출해
// raw Response 를 반환한다(호출측이 response.blob()/헤더로 소비). body 파싱을 하지
// 않으므로 request 가 아닌 requestRaw 를 쓴다(Blob/스트리밍 정합).
async function downloadExportJob(id: string): Promise<Response> {
  return requestRaw(`${EXPORT_BASE_PATH}/${encodeURIComponent(id)}/download`);
}

export {
  EXPORT_BASE_PATH,
  createExportJob,
  getExportJob,
  listRunningExportJobs,
  downloadExportJob,
};
export type { ExportJob, CreateExportInput };
