// ServiceIdentity API 클라이언트 — 읽기 축(GET 목록) 1 개만 여는 slice (T-1759).
// [ADR-0058](../../../docs/decisions/ADR-0058-service-identity-management-api.md)
// §Follow-ups (d) AdminView 편집 UI 의 전제 계층이다. 현재 web/src 에 ServiceIdentity
// 를 다루는 코드가 0 건이라, 패널을 그리기 전에 backend 5 route 중 조회 1 개를 호출할
// client 를 먼저 만든다. 쓰기 축(POST 추가 · PATCH 수정 · DELETE 삭제 · POST primary)
// 은 후속 slice 책임이다.
//
// 계약 정본은 `docs/architecture/api.md` `82 행` 과 backend
// `src/user/service-identity.controller.ts` `69`·`86 행` 이다:
//  - `GET /api/persons/:personId/identities` → 200 + raw `ServiceIdentity[]`
//  - row 0 개면 200 + 빈 배열(예외 아님)
//  - Person 자체가 부재하면 service 선검사가 404(ADR-0058 §Decision 5 (c))
//  - guard tier 는 `User+`(§Decision 4) — 인증 cookie 는 apiClient 가 동반한다.
//
// auth.ts 선례를 승계한 얇은 per-resource helper — apiClient(request) 위에 비즈니스
// 분기만 얹고, credentials 동반 · 401→refresh→재시도 · 비-2xx → `ApiError` 변환은
// 전부 apiClient 책임으로 남긴다. 새 dependency 0(브라우저 표준 fetch + apiClient).

import { request } from './apiClient';

// backend raw row 와 1:1 인 타입 — `prisma/schema.prisma` `257~274 행`.
// `id`/`personId`/`service`/`externalId`/`isPrimary` 5 필드는 항상 오고,
// `createdAt`/`updatedAt` 는 JSON 직렬화된 ISO 문자열이라 `string` 이며 소비처가
// 아직 없으므로 optional 로 둔다(응답에서 빠져도 타입이 깨지지 않게).
export interface ServiceIdentityRow {
  id: string;
  personId: string;
  service: string;
  externalId: string;
  isPrimary: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 해당 Person 의 identity 컬렉션 경로를 조립한다.
 *
 * `personId` 에 `/` · 공백 등이 섞여도 경로가 깨지지 않도록 반드시
 * `encodeURIComponent` 를 통과시킨다(path param 이 경로 구분자를 삼키면 전혀 다른
 * route 로 흘러가거나 404 가 되는 것을 막는다).
 */
export function serviceIdentityCollectionPath(personId: string): string {
  return `/api/persons/${encodeURIComponent(personId)}/identities`;
}

/**
 * `GET /api/persons/:personId/identities` 를 호출해 raw row 배열을 그대로 반환한다.
 *
 * 분기 계약:
 *  - `personId` 가 빈 문자열이거나 공백뿐이면 **네트워크 호출 없이** 빈 배열을
 *    반환한다. 선택 전 상태의 UI 가 `/api/persons//identities` 같은 무의미한 경로를
 *    때리지 않도록 하는 조기 반환이다.
 *  - 응답이 배열이 아니면(계약 위반 · 비 JSON body 등) 빈 배열로 흡수한다 —
 *    사유를 지어내지 않고, 목록 소비처가 항상 배열을 받도록 정상화한다.
 *  - `ApiError`(404 Person 부재 · 401 미인증 · 5xx · 네트워크 status 0)는
 *    **흡수하지 않고 그대로 전파** 한다. 오류 표면화(빈 목록인지 조회 실패인지의
 *    구분 표시)는 후속 패널 slice 의 책임이며, 여기서 빈 배열로 삼키면 그 구분을
 *    영구히 잃는다.
 *
 * 응답 가공(정렬 · 필터 · 복제)은 하지 않는다 — primary 우선 정렬 등 표시 규칙도
 * 후속 slice 몫이다.
 */
export async function fetchServiceIdentities(
  personId: string,
): Promise<ServiceIdentityRow[]> {
  // 조기 반환 분기 — 미선택 상태(빈/공백 personId)는 요청 자체를 보내지 않는다.
  if (personId.trim() === '') {
    return [];
  }
  // ApiError 는 여기서 catch 하지 않는다(위 계약대로 그대로 전파).
  const body = await request<unknown>(serviceIdentityCollectionPath(personId));
  // 배열이 아닌 body(null · 객체 · 문자열 등)는 빈 배열로 정상화.
  if (!Array.isArray(body)) {
    return [];
  }
  return body as ServiceIdentityRow[];
}
