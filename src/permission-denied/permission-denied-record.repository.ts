// PermissionDeniedRecordRepository — PermissionDeniedRecord entity 의 영속화
// primitive 2 종 (append-only insert + audit query) 을 PrismaService 위에 얇게
// wrapping 한 repository. T-0209 acceptance 박제 (ADR-0022 후속 chain row 2).
// LlmProviderConfigRepository (src/llm/llm-provider-config.repository.ts) 패턴을
// mirror — PrismaService delegate 1:1 forwarding, reject propagate, 값 검증 0.
//
// 책임 경계:
//   - 본 repository 는 도메인 invariant (provider 값 허용 집합 / reason 도출 등) 를
//     검증하지 않는다 — 후속 PermissionDeniedRecordService 책임. 본 layer 는 raw
//     forward 만 한다.
//   - 본 class 는 PrismaService 의 `permissionDeniedRecord` delegate 에 1:1
//     forwarding 만 한다. 테스트는 그 delegate 를 Jest mock 으로 대체해 호출 인자 +
//     return 값 정합성만 검증한다 (PostgreSQL 실연결 불필요).
//
// PermissionDeniedRecord 는 **append-only audit row** (ADR-0022 §3 — dedup 미적용·
// 영구 보존). `@@unique` 미정의이므로 (LlmProviderConfig 와 동형) P2002 (unique
// 위반) 분기가 부재 — create 의 P2002 catch 0 (raw forward). 한 번 기록되면 갱신
// 되지 않는 immutable entity 라 update / delete 메서드도 두지 않는다 (Out of Scope).
//
// Prisma error 정책 (LlmProviderConfigRepository 와 동일):
//   - create / findMany 가 PrismaService reject 시 (DB 장애 등) 그대로 propagate —
//     swallow 하지 않는다. 호출자 (후속 service) 가 4xx 변환 책임 (단 본 audit
//     record 는 컬렉션 조회라 404 변환 0 — 빈 결과는 빈 배열).
import { Injectable } from "@nestjs/common";
import type { Prisma, PermissionDeniedRecord } from "@prisma/client";

import { PrismaService } from "../persistence/prisma.service";

// 본 repository 가 노출하는 create 메서드의 input shape. provider / instanceRef /
// resourceRef / httpStatus 는 필수, principal / reason 은 nullable (ADR-0022 §1 —
// 현 이벤트가 principal 을 싣지 않고 reason 은 service 가 도출/생략). id / createdAt
// 은 schema 의 `@default(cuid())` / `@default(now())` 가 cover 하므로 input 에서 제외
// (updatedAt 은 immutable entity 라 컬럼 자체가 부재 — ADR-0022 §1).
export interface PermissionDeniedRecordCreateInput {
  provider: string;
  instanceRef: string;
  resourceRef: string;
  principal?: string | null;
  httpStatus: number;
  reason?: string | null;
}

// findMany 의 audit 조회 필터 (ADR-0022 §4 query path). 전부 선택 — 부재 시 전체
// 조회. instanceRef ("이 instance 의 최근 거부 이력") / provider / httpStatus
// ("github 의 403 거부") 로 필터 가능. 정렬은 항상 createdAt desc (최신 우선) — 본
// layer 가 고정 (시계열 audit 조회의 기본 정렬). 값 검증 0 (raw forward).
export interface PermissionDeniedRecordFilter {
  instanceRef?: string;
  // set-membership (`instanceRef in (...)`) own-instance 필터 (ADR-0024 §3). 단일
  // `instanceRef`(exact) 와 AND 공존(교집합) — 둘 다 주어지면 exact 가 set 에 속할
  // 때만 그 단일로 좁혀지고, 속하지 않으면 매칭 0(타 instance 비노출, ADR-0024 §3).
  // service(slice B)가 non-Admin allowlist 를 이 필드로 강제 주입한다 — 사용자가
  // own-instance 범위를 query param 으로 넓힐 수 없게 allowlist 가 상한(ADR-0024 §3).
  instanceRefIn?: string[];
  provider?: string;
  httpStatus?: number;
}

@Injectable()
export class PermissionDeniedRecordRepository {
  constructor(private readonly prisma: PrismaService) {}

  // create — 권한 거부 1 row insert (append-only, ADR-0022 §3). Prisma schema 의
  // `@default` 가 id / createdAt 을 cover. provider 값 / reason 도출은 service
  // 책임 (raw forward). `@@unique` 부재라 P2002 catch 0 — reject 는 그대로 propagate.
  async create(
    input: PermissionDeniedRecordCreateInput,
  ): Promise<PermissionDeniedRecord> {
    return this.prisma.permissionDeniedRecord.create({ data: input });
  }

  // findMany — audit 조회 (ADR-0022 §4). createdAt desc 정렬 (최신 우선) + 선택
  // 필터 (instanceRef / instanceRefIn / provider / httpStatus). 필터 인자가
  // undefined 면 where 절 없이 전체 조회. 부재 키는 where 에 포함하지 않아 해당
  // 컬럼으로 필터하지 않는다 (undefined 체크로 omit/include 분기). delegate reject
  // 는 swallow 없이 propagate.
  //
  // instanceRef(단일 exact) 와 instanceRefIn(set membership, ADR-0024 §3) 의 합성:
  //   - 둘 다 주어지면 Prisma `AND` 절로 합성해 교집합(AND) — exact 가 set 에 속하면
  //     그 단일로 좁혀지고, 속하지 않으면 매칭 0(타 instance 비노출, ADR-0024 §3).
  //     (둘 다 같은 `instanceRef` 컬럼을 노려 단일 where key 로는 충돌하므로 AND 합성.)
  //   - 하나만 주어지면 해당 조건만 where 에 직접 얹는다.
  // 값 정규화는 하지 않는다(받은 값 그대로 forward) — 정규화는 binding 입력/비교
  // 시점(ADR-0024 §4, slice B + UserInstanceAccess) 책임.
  async findMany(
    filter?: PermissionDeniedRecordFilter,
  ): Promise<PermissionDeniedRecord[]> {
    const where: Prisma.PermissionDeniedRecordWhereInput = {};

    const hasExact = filter?.instanceRef !== undefined;
    const hasSet = filter?.instanceRefIn !== undefined;
    if (hasExact && hasSet) {
      // exact ∩ set: 둘 다 instanceRef 컬럼을 노리므로 AND 절로 합성(교집합).
      where.AND = [
        { instanceRef: filter!.instanceRef },
        { instanceRef: { in: filter!.instanceRefIn } },
      ];
    } else if (hasExact) {
      where.instanceRef = filter!.instanceRef;
    } else if (hasSet) {
      where.instanceRef = { in: filter!.instanceRefIn };
    }

    if (filter?.provider !== undefined) {
      where.provider = filter.provider;
    }
    if (filter?.httpStatus !== undefined) {
      where.httpStatus = filter.httpStatus;
    }
    return this.prisma.permissionDeniedRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }
}
