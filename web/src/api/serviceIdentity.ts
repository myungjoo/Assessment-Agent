// ServiceIdentity API 클라이언트 — 읽기 축(T-1759) + 쓰기 축 1/2(T-1760) + 2/2(T-1761).
// [ADR-0058](../../../docs/decisions/ADR-0058-service-identity-management-api.md)
// §Follow-ups (d) AdminView 편집 UI 의 전제 계층이다. 현재 web/src 에 ServiceIdentity
// 를 다루는 코드가 0 건이라, 패널을 그리기 전에 backend 5 route 중 조회 1 개를 호출할
// client 를 먼저 만든다. 본 slice(T-1761)로 backend 5 route 전량이 client 층에서
// 완결됐고, 잔여는 `ServiceIdentityList` 패널 컴포넌트 신설 · AdminView 배선뿐이다.
//
// 계약 정본은 `docs/architecture/api.md` `82`~`86 행` 과 backend
// `src/user/service-identity.controller.ts` `69`·`86`·`127`·`151 행` 이다:
//  - `GET .../identities` → 200 + raw `ServiceIdentity[]` (row 0 개면 빈 배열, 예외 아님)
//  - `POST .../identities` → 201 + 생성 row (body 2 필드; 400 / 404 / 409)
//  - `PATCH .../identities/:identityId` → 200 + 갱신 row (body 1 필드; 400 / 404)
//  - `DELETE .../identities/:identityId` → 204 No Content (body 없음; 404 3 단)
//  - `POST .../identities/:identityId/primary` → 200 + 승격 row (body 없음; 404 3 단)
//  - Person 자체가 부재하면 service 선검사가 404(ADR-0058 §Decision 5 (c))
//  - guard tier 는 조회 `User+` · 쓰기 `Admin+`(§Decision 4) — 인증 cookie 는 apiClient.
//
// auth.ts 선례를 승계한 얇은 per-resource helper — apiClient(request) 위에 비즈니스
// 분기만 얹고, credentials 동반 · 401→refresh→재시도 · 비-2xx → `ApiError` 변환은
// 전부 apiClient 책임으로 남긴다. 새 dependency 0(브라우저 표준 fetch + apiClient).

import { ApiError, request, requestRaw } from './apiClient';

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

/**
 * identity 단건 경로(PATCH · 후속 DELETE 공용) — 컬렉션 경로에 id 하나를 덧붙인다.
 * 두 path param **모두** encode 한다(한쪽에 `/` 가 섞이면 다른 route 로 새거나 404).
 */
export function serviceIdentityItemPath(
  personId: string,
  identityId: string,
): string {
  const base = serviceIdentityCollectionPath(personId);
  return `${base}/${encodeURIComponent(identityId)}`;
}

// 쓰기 축 공통 — 필수 path param 이 비면 네트워크 호출 없이 오류로 표면화한다(읽기 축의
// "빈 배열 조기 반환" 과 정책이 다르다 — 쓰기가 조용히 성공한 척하면 호출측이 반영됐다고
// 오인한다). status 0 은 apiClient 의 네트워크 실패 규약(서버에 닿지 않음)과 같은 축이다.
function assertPathParam(value: string, name: string): void {
  if (value.trim() === '') {
    throw new ApiError(0, `${name} 가 비어 있어 요청을 보내지 않았습니다`);
  }
}

// 쓰기 응답 정상화 — 계약상 단건 row 객체여야 한다. 빈 값으로 흡수하면 호출측이 없는 row 를
// 다루게 되므로 `ApiError(0)` 로 정상화한다(`typeof null === 'object'` 라 null 도 배제).
// 필드 검증은 하지 않는다 — raw row 를 그대로 주는 backend 계약이 정본이다.
function asRow(body: unknown): ServiceIdentityRow {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(0, '서버 응답이 identity row 객체가 아닙니다');
  }
  return body as ServiceIdentityRow;
}

/**
 * `POST /api/persons/:personId/identities` — identity 1 개 추가(201 + 생성 row).
 *  - `personId` 가 빈/공백뿐이면 **네트워크 호출 없이** `ApiError(0)`.
 *  - body 는 `service`·`externalId` **2 필드만** 재구성해 보낸다 — backend DTO 가
 *    `forbidNonWhitelisted` 라 `isPrimary` 등 여분 키는 그 자체로 400(api.md `83 행`).
 *  - `400`·`404`(Person 부재)·`409`(`@@unique([personId, service])` 중복)·`401`·`5xx`·
 *    네트워크는 흡수하지 않고 `ApiError` 전파(표면화는 후속 패널 slice 책임).
 *  - 첫 row 자동 primary 승격은 backend service 책임(ADR-0058 §Decision 2).
 */
export async function createServiceIdentity(
  personId: string,
  input: { service: string; externalId: string },
): Promise<ServiceIdentityRow> {
  assertPathParam(personId, 'personId');
  const body = await request<unknown>(serviceIdentityCollectionPath(personId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // 허용 축 2 개만 명시 재구성 — forbidNonWhitelisted 대비.
    body: JSON.stringify({
      service: input.service,
      externalId: input.externalId,
    }),
  });
  return asRow(body);
}

/**
 * `PATCH .../identities/:identityId` — 부분 갱신(200 + 갱신 row).
 *  - `personId`·`identityId` 중 하나라도 빈/공백뿐이면 호출 없이 `ApiError(0)`.
 *  - 허용 축은 `externalId` **단일** — `service`·`isPrimary` 는 시그니처가 받지 않아
 *    컴파일 단계에서 봉쇄된다(ADR-0058 §Decision 3 — service 갱신은 DELETE 후 POST 로,
 *    primary 전이는 전용 route 의 transaction 으로만 표현한다).
 *  - `400`(DTO 위반·`null`)·`404`(부재 **또는 타 Person 소유**)·`401`·`5xx`·네트워크는
 *    그대로 전파. 타 Person row 를 404 로 감추는 것도 backend 정책(api.md `84 행`).
 */
export async function updateServiceIdentity(
  personId: string,
  identityId: string,
  input: { externalId: string },
): Promise<ServiceIdentityRow> {
  assertPathParam(personId, 'personId');
  assertPathParam(identityId, 'identityId');
  const body = await request<unknown>(
    serviceIdentityItemPath(personId, identityId),
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      // 허용 축 1 개만 — 여분 키가 붙은 input 이 와도 전송 body 는 externalId 단일.
      body: JSON.stringify({ externalId: input.externalId }),
    },
  );
  return asRow(body);
}

/**
 * `DELETE .../identities/:identityId` — identity hard delete (204 No Content).
 *  - `personId`·`identityId` 중 하나라도 빈/공백뿐이면 **네트워크 호출 없이**
 *    `ApiError(0)` (쓰기 축 `assertPathParam` 승계 — 읽기 축 빈 배열 반환과 다르다).
 *  - 응답이 204 라 **body 를 파싱하지 않는다** — `request` 는 2xx body 를 무조건 파싱해
 *    빈 본문을 의미 없는 값으로 되돌리므로, body 를 소비하지 않는 `requestRaw` 로
 *    `void` 마감한다(api.md `85 행`).
 *  - 삭제 대상이 primary 였을 때의 자동 재승격은 backend 책임(ADR-0058 §Decision 2).
 *  - `404` 3 단(Person 부재 · 타 Person 소유 · `P2025`)·`401`·`5xx`·네트워크는 흡수하지
 *    않고 `ApiError` 그대로 전파 — 사용자 표면화는 후속 패널 slice 책임.
 */
export async function deleteServiceIdentity(
  personId: string,
  identityId: string,
): Promise<void> {
  assertPathParam(personId, 'personId');
  assertPathParam(identityId, 'identityId');
  // 반환값을 버린다 — 204 의 빈 body 를 읽을 이유가 없다(위 주석 근거).
  await requestRaw(serviceIdentityItemPath(personId, identityId), {
    method: 'DELETE',
  });
}

/**
 * `POST .../identities/:identityId/primary` — 해당 identity 를 primary 로 승격
 * (200 + 승격 row).
 *  - `personId`·`identityId` 중 하나라도 빈/공백뿐이면 호출 없이 `ApiError(0)`.
 *  - **body 를 보내지 않는다** — 대상이 path param 2 개로 완전 지정되는 action route 라
 *    `Content-Type` 헤더도 `body` 옵션도 붙이지 않는다(api.md `86 행`).
 *  - 이미 primary 인 row 에 재요청해도 결과가 같은 **idempotent**(unset+set 의 atomic
 *    처리는 backend `$transaction` 책임) — client 는 중복 호출 방지 로직을 두지 않는다.
 *  - `404` 3 단·`401`·`5xx`·네트워크는 흡수하지 않고 `ApiError` 그대로 전파.
 */
export async function setPrimaryServiceIdentity(
  personId: string,
  identityId: string,
): Promise<ServiceIdentityRow> {
  assertPathParam(personId, 'personId');
  assertPathParam(identityId, 'identityId');
  const body = await request<unknown>(
    `${serviceIdentityItemPath(personId, identityId)}/primary`,
    { method: 'POST' },
  );
  return asRow(body);
}
