// LlmProviderConfigRepository — LlmProviderConfig entity 의 CRUD primitive 4 종을
// PrismaService 위에 얇게 wrapping 한 repository. T-0135 acceptance §36 박제.
// GroupRepository (src/user/group.repository.ts) 패턴을 mirror — PrismaService
// delegate 1:1 forwarding, P2025 propagate, null-safe findById.
//
// 책임 경계:
//   - 본 repository 는 도메인 invariant (provider 값 검증 / endpoint URL 형식 /
//     custom 3 model 슬롯 정책 — REQ-051 등) 를 검증하지 않는다 — 후속
//     LlmProviderConfigService (T-0139) 책임. 본 layer 는 raw forward 만.
//   - 본 class 는 PrismaService 의 `llmProviderConfig` delegate 에 1:1 forwarding
//     만 한다. 테스트는 그 delegate 를 Jest mock 으로 대체해 호출 인자 + return
//     값 정합성만 검증한다 (DB 실연결 불필요).
//
// LlmProviderConfig 는 **다중 row 모델** (각 provider 별 1+ row, custom 은 3 model
// 슬롯 — REQ-051). GroupRepository 와 동일하게 `@unique` / `@@unique` 미정의이므로
// P2002 (unique 위반) 분기가 부재 — create 의 P2002 catch 0 (PersonRepository.create
// 의 email @unique P2002 패턴과 대조).
//
// Prisma error 정책 (GroupRepository 와 동일):
//   - findById 가 row 부재 시 null 반환 (throw 안 함) — null-safe API.
//   - delete 가 row 부재 시 Prisma `P2025` (record not found) 그대로 propagate —
//     호출자 (후속 service) 가 NotFoundException 변환 책임. 본 layer catch X.
//   - create / findMany 가 PrismaService reject 시 그대로 propagate (DB 장애 등).
import { Injectable } from "@nestjs/common";
import type { LlmProviderConfig } from "@prisma/client";

import { PrismaService } from "../persistence/prisma.service";

// 본 repository 가 노출하는 create 메서드의 input shape. provider / endpointUrl /
// apiKey / modelId 4 컬럼이 user-settable — id / createdAt / updatedAt 은 schema 의
// `@default` / `@updatedAt` 가 cover 하므로 input 에서 제외.
//
// apiKey 는 평문 String (encryption-at-rest 는 ADR-0006 follow-up — 본 task 는
// secret 처리 코드 0, 암호화 0). provider 는 enum-as-String literal (LlmProvider
// enum 의 값) — 본 layer 는 값 검증 0, 후속 service 가 isLlmProvider 로 검증.
export interface LlmProviderConfigCreateInput {
  provider: string;
  endpointUrl: string;
  apiKey: string;
  modelId: string;
}

// 본 repository 의 update 메서드 input shape — create 와 달리 **변경할 필드만** 담는
// partial shape (provider / endpointUrl / apiKey / modelId 의 부분 집합). 부재 키는
// Prisma update 의 data 에 포함되지 않아 미변경된다 (PATCH 의 부분 갱신 시멘틱).
// apiKey 가 명시된 경우 그 값은 service 가 LlmApiKeyCipher.encrypt 로 만든 ciphertext
// (평문이 본 layer 에 닿지 않음 — encryption-at-rest, ADR-0014 §1). 본 layer 는 값
// 검증 0 (raw forward) — provider 멤버십 / 형식 검증은 service / DTO 책임.
export type LlmProviderConfigUpdateInput =
  Partial<LlmProviderConfigCreateInput>;

@Injectable()
export class LlmProviderConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  // create — Prisma schema 의 default 가 id / createdAt / updatedAt 을 cover.
  // provider 값 / endpoint 형식 validation 은 후속 service 책임 (raw forward).
  async create(
    input: LlmProviderConfigCreateInput,
  ): Promise<LlmProviderConfig> {
    return this.prisma.llmProviderConfig.create({ data: input });
  }

  // findById — findUnique 의 row 부재 분기는 null 반환 (Prisma native 동작).
  async findById(id: string): Promise<LlmProviderConfig | null> {
    return this.prisma.llmProviderConfig.findUnique({ where: { id } });
  }

  // findMany — 전체 LlmProviderConfig 조회 (다중 row 모델). 정렬 / provider 별
  // 필터는 후속 service / controller layer 책임 — 본 layer 는 raw forward.
  async findMany(): Promise<LlmProviderConfig[]> {
    return this.prisma.llmProviderConfig.findMany();
  }

  // update — 부분 갱신 (PATCH). data 에 담긴 필드만 교체하고 나머지는 미변경.
  // id 부재 시 Prisma `update` 는 `P2025` (record not found) 를 throw — delete 와
  // 동일하게 본 layer 는 catch 하지 않고 그대로 propagate (후속 service 가
  // NotFoundException 404 변환 책임). data 는 변경할 필드만 담는 partial shape
  // (raw forward — 값 검증 0). apiKey 가 포함된 경우 그 값은 service 가 미리
  // encrypt 한 ciphertext (평문 미수신 — encryption-at-rest, ADR-0014 §1).
  async update(
    id: string,
    data: LlmProviderConfigUpdateInput,
  ): Promise<LlmProviderConfig> {
    return this.prisma.llmProviderConfig.update({ where: { id }, data });
  }

  // delete — hard delete. id 부재 시 Prisma `P2025` throw — 본 layer catch X.
  // LlmProviderConfig 는 DifficultyMapping (T-0136) 1:N relation 의 부모이나,
  // 본 task 는 DifficultyMapping model 미존재라 cascade 정책 박제 0 (T-0136 책임).
  async delete(id: string): Promise<LlmProviderConfig> {
    return this.prisma.llmProviderConfig.delete({ where: { id } });
  }
}
