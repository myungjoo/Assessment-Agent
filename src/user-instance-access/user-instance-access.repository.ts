// UserInstanceAccessRepository — UserInstanceAccess (User↔instance binding) entity 의
// data-access layer. ADR-0024 §3 allowlist lookup + §4 instanceRef 정규화 binding
// create 를 PrismaService 위에 얇게 wrapping 한 repository (T-0222 acceptance 박제,
// ADR-0024 후속 chain row (2)).
//
// PermissionDeniedRecordRepository (src/permission-denied/permission-denied-record.
// repository.ts) 패턴을 mirror — PrismaService delegate 1:1 forwarding / reject
// propagate. 단, ADR-0024 §4(v) 가 "binding 입력 시점 정규화" 를 박제했으므로 본
// repository 는 create 입력의 instanceRef 에만 정규화 (normalizeInstanceRef) 를
// 적용한다 (그 외 raw forward — 도메인 validation 은 호출자/service 책임).
//
// 책임 경계:
//   - 본 repository 는 PrismaService 의 `userInstanceAccess` delegate 에 forwarding
//     만 한다. 테스트는 그 delegate 를 Jest mock 으로 대체해 호출 인자 + return 값
//     정합성만 검증한다 (PostgreSQL 실연결 불필요).
//   - service 결선 (PermissionDeniedRecordService.list non-Admin 분기의 placeholder
//     대체 + query.instanceRef ∩ allowlist 교집합) 은 본 slice 밖 (ADR-0024 후속
//     chain row (3) — 명시적 next Follow-up). 본 slice 머지 후에도 audit endpoint
//     non-Admin 동작 변경 0 (placeholder 미접촉).
//
// Prisma error 정책 (PermissionDeniedRecordRepository 동일):
//   - findInstanceRefsByUserId / create 가 PrismaService reject 시 (DB 장애 등)
//     그대로 propagate — swallow 하지 않는다. 호출자 (후속 service) 가 4xx 변환 책임.
//   - create 의 중복 binding (정규화값 기준 `@@unique([userId, instanceRef])` 위반)
//     은 P2002 reject — 본 layer 는 catch 0 (raw propagate). 호출자가 처리.
import { Injectable } from "@nestjs/common";
import type { UserInstanceAccess } from "@prisma/client";

import { PrismaService } from "../persistence/prisma.service";

// create 가 받는 binding 입력 shape. userId / instanceRef 만 필수 — id / createdAt
// 은 schema 의 `@default(cuid())` / `@default(now())` 가 cover (ADR-0024 §2 채택 모델).
export interface UserInstanceAccessCreateInput {
  userId: string;
  instanceRef: string;
}

// normalizeInstanceRef — ADR-0024 §4 정규화 규칙을 단일 함수로 모은다 (R-112
// entrypoint-helper 분리 정합 — 분기 있는 정규화 로직을 helper 안에 집약). 다음
// service-결선 slice 가 lookup 측 비교 (query.instanceRef 정규화 / record 비교) 에
// 본 함수를 재사용하도록 named export.
//
// 적용 규칙 (ADR-0024 §4):
//   - (i)  host 부분 lowercase — DNS host 는 대소문자 무관 (RFC 4343). scheme://
//          authority 형태면 authority(host[:port]) 만 lowercase, 그 외 (host-only
//          GitHub configured host) 는 전체 lowercase.
//   - (ii) trailing slash 제거 — Confluence base URL 표기 변형 정규화.
//   - (iii) path / scheme — 그대로 유지 (scheme 다르면 다른 instance — http ≠ https).
//   - (iv) 빈 문자열은 빈 문자열로 반환 (유효 binding 아님 — 호출자가 거부 판단).
//
// 정규화는 idempotent — 이미 정규화된 값을 다시 넣어도 동일 값 반환.
export function normalizeInstanceRef(raw: string): string {
  // (iv) 빈/공백 입력은 빈 문자열로 — 유효 binding 아님 (호출자 거부 판단 위임).
  if (raw === undefined || raw === null || raw.trim() === "") {
    return "";
  }

  let value = raw.trim();

  // (ii) trailing slash 제거 — Confluence 풀 REST base URL (`.../api/` → `.../api`).
  // scheme 의 `://` 는 보존 (slash 제거 대상은 끝의 path 구분자 한정).
  value = value.replace(/\/+$/, "");

  // scheme 유무로 분기:
  //   - `scheme://authority/path` 형태면 authority 부분만 lowercase (path/scheme 보존).
  //   - scheme 없는 host-only (GitHub configured host) 면 전체 lowercase.
  const schemeMatch = value.match(
    /^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^/]*)(.*)$/,
  );
  if (schemeMatch) {
    const [, scheme, authority, rest] = schemeMatch;
    // (i) host 부분 (authority) lowercase. (iii) scheme 는 그대로, path(rest) 그대로.
    return `${scheme}${authority.toLowerCase()}${rest}`;
  }

  // scheme 없는 host-only — 전체를 host 로 간주해 lowercase (GitHub configured host).
  return value.toLowerCase();
}

@Injectable()
export class UserInstanceAccessRepository {
  constructor(private readonly prisma: PrismaService) {}

  // findInstanceRefsByUserId — ADR-0024 §3 step 1 allowlist lookup. `WHERE userId = ?`
  // 로 binding row 들의 instanceRef 만 select 해 string[] allowlist 반환.
  //
  // 경계 (ADR-0024 §3 step 1 / §4(iv)):
  //   - userId 가 빈 문자열/undefined/null 이면 DB 조회 없이 빈 배열 (lookup 0).
  //   - row 0 개면 빈 배열 (binding 0 — non-Admin 의 빈 allowlist fallback source).
  //   - 빈/null instanceRef row 는 allowlist 에서 제외 (방어적 — record 의
  //     instanceRef 는 NOT NULL 이라 정상 입력에선 발생 0).
  //   - PrismaService reject 는 swallow 없이 propagate.
  async findInstanceRefsByUserId(userId: string): Promise<string[]> {
    if (userId === undefined || userId === null || userId === "") {
      return [];
    }
    const rows = await this.prisma.userInstanceAccess.findMany({
      where: { userId },
      select: { instanceRef: true },
    });
    return rows
      .map((row) => row.instanceRef)
      .filter(
        (instanceRef): instanceRef is string =>
          instanceRef !== undefined &&
          instanceRef !== null &&
          instanceRef !== "",
      );
  }

  // create — binding 1 row insert. insert 전 instanceRef 에 ADR-0024 §4 정규화 적용
  // (normalizeInstanceRef) — `@@unique([userId, instanceRef])` 가 정규화값 기준
  // 중복을 강제하도록 (§4(v) 입력 시점 정규화).
  //
  // 정규화 후 instanceRef 가 빈 문자열이면 유효 binding 아님 (§4(iv)) — Error 를
  // throw 해 호출자에게 명확히 알린다 (silent 무효 row insert 방지). userId 는 raw
  // forward (FK 검증은 schema 의 relation 책임 — 부재 userId 면 P2003 propagate).
  async create(
    input: UserInstanceAccessCreateInput,
  ): Promise<UserInstanceAccess> {
    const instanceRef = normalizeInstanceRef(input.instanceRef);
    if (instanceRef === "") {
      throw new Error(
        "UserInstanceAccess.create: instanceRef 가 정규화 후 빈 문자열 — 유효 binding 아님 (ADR-0024 §4(iv))",
      );
    }
    return this.prisma.userInstanceAccess.create({
      data: { userId: input.userId, instanceRef },
    });
  }

  // deleteByUserIdAndInstanceRef — revoke 용 `@@unique([userId, instanceRef])` row
  // delete (ADR-0027 Decision §2/§4). 호출자(service)는 이미 정규화된 instanceRef
  // 를 넘긴다 — 본 메서드는 추가 정규화 0 (round-trip 정합은 service 가
  // normalizeInstanceRef() 로 보장, 정규화 단일 source 유지).
  //
  // idempotency — Prisma `deleteMany` 채택 (delete + P2025 catch 대비). deleteMany
  // 는 매칭 row 가 없으면 `{ count: 0 }` 를 반환하고 throw 하지 않으므로 부재
  // binding revoke 가 자연히 idempotent no-op (ADR-0027 §4 revoke 204 semantic).
  // delete 단건은 부재 시 P2025 throw 라 별도 catch 가 필요 — deleteMany 가 더 간결.
  //
  // 반환 — 삭제된 row count (호출자가 필요 시 활용; service 는 idempotent 라 count
  // 무관하게 성공 처리). PrismaService reject (DB 장애)는 swallow 없이 propagate.
  async deleteByUserIdAndInstanceRef(
    userId: string,
    instanceRef: string,
  ): Promise<number> {
    const result = await this.prisma.userInstanceAccess.deleteMany({
      where: { userId, instanceRef },
    });
    return result.count;
  }
}
