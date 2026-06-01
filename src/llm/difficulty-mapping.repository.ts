// DifficultyMappingRepository — DifficultyMapping entity 의 CRUD primitive 를
// PrismaService 위에 얇게 wrapping 한 repository. T-0137 acceptance 박제 (ADR-0011
// 구현). LlmProviderConfigRepository (src/llm/llm-provider-config.repository.ts)
// 패턴을 mirror — PrismaService delegate 1:1 forwarding, P2025 propagate, null-safe
// findById/findByDifficulty.
//
// 책임 경계:
//   - 본 repository 는 도메인 invariant (난이도 값 검증 / 3 row 초과 거부 / 미설정
//     슬롯 fail-fast — ADR-0011 §3) 를 검증하지 않는다 — 후속 DifficultyMappingService
//     (T-0138+) 책임. 본 layer 는 raw forward 만.
//   - 본 class 는 PrismaService 의 `difficultyMapping` delegate 에 1:1 forwarding
//     만 한다. 테스트는 그 delegate 를 Jest mock 으로 대체해 호출 인자 + return
//     값 정합성만 검증한다 (DB 실연결 불필요).
//
// DifficultyMapping 은 **3 row 고정 모델** (easy / medium / hard 각 1 row — ADR-0011
// §1). `@@unique([difficulty])` 정의 → create 가 동일 난이도 중복 시 Prisma `P2002`
// (unique 위반) 분기 발생 (LlmProviderConfig 의 P2002 부재와 대조). 본 repository 는
// P2002 를 catch 없이 raw propagate — fail-fast 변환 (4xx) 은 후속 service 책임
// (ADR-0011 §3).
//
// Prisma error 정책 (LlmProviderConfigRepository 와 동일):
//   - findById / findByDifficulty 가 row 부재 시 null 반환 (throw 안 함) — null-safe API.
//   - delete / updateProviderConfig 가 row 부재 시 Prisma `P2025` (record not found)
//     그대로 propagate — 호출자 (후속 service) 가 NotFoundException 변환 책임.
//   - create 가 `@@unique([difficulty])` 중복 시 Prisma `P2002` 그대로 propagate.
//   - 모든 메서드가 PrismaService reject 시 그대로 propagate (DB 장애 등).
import { Injectable } from "@nestjs/common";
import type { DifficultyMapping } from "@prisma/client";

import { PrismaService } from "../persistence/prisma.service";

import type { Difficulty } from "./difficulty";

// 본 repository 가 노출하는 create 메서드의 input shape. difficulty (3 슬롯 중 1) +
// llmProviderConfigId (nullable FK — ADR-0011 §3 미설정 슬롯 nullable 시작) 가
// user-settable — id / createdAt / updatedAt 은 schema 의 `@default` / `@updatedAt`
// 가 cover 하므로 input 에서 제외.
//
// difficulty 는 Difficulty union (src/llm/difficulty.ts) 으로 타입 좁힘 — 본 layer
// 는 추가 값 검증 0 (union 자체가 compile-time 좁힘, 후속 service 가 isDifficulty 로
// runtime 검증). llmProviderConfigId 는 nullable — 미설정 슬롯 (셋업 전) 허용.
export interface DifficultyMappingCreateInput {
  difficulty: Difficulty;
  llmProviderConfigId?: string | null;
}

@Injectable()
export class DifficultyMappingRepository {
  constructor(private readonly prisma: PrismaService) {}

  // create — Prisma schema 의 default 가 id / createdAt / updatedAt 을 cover.
  // `@@unique([difficulty])` 위반 시 Prisma P2002 throw — 본 layer catch X
  // (fail-fast 변환은 후속 service 책임, ADR-0011 §3). 난이도 값 검증도 service 책임.
  async create(
    input: DifficultyMappingCreateInput,
  ): Promise<DifficultyMapping> {
    return this.prisma.difficultyMapping.create({ data: input });
  }

  // findById — findUnique 의 row 부재 분기는 null 반환 (Prisma native 동작).
  async findById(id: string): Promise<DifficultyMapping | null> {
    return this.prisma.difficultyMapping.findUnique({ where: { id } });
  }

  // findByDifficulty — `@@unique([difficulty])` 위 findUnique. 난이도 슬롯 1 개를
  // difficulty 값으로 조회 (resolve 의 진입점 — ADR-0011 §2). row 부재 시 null 반환.
  async findByDifficulty(
    difficulty: Difficulty,
  ): Promise<DifficultyMapping | null> {
    return this.prisma.difficultyMapping.findUnique({ where: { difficulty } });
  }

  // findMany — 전체 DifficultyMapping 조회 (3 row 고정 모델 — easy/medium/hard).
  // 정렬 / 필터는 후속 service / controller layer 책임 — 본 layer 는 raw forward.
  async findMany(): Promise<DifficultyMapping[]> {
    return this.prisma.difficultyMapping.findMany();
  }

  // delete — hard delete. id 부재 시 Prisma `P2025` throw — 본 layer catch X.
  async delete(id: string): Promise<DifficultyMapping> {
    return this.prisma.difficultyMapping.delete({ where: { id } });
  }

  // updateProviderConfig — 난이도 슬롯의 FK (llmProviderConfigId) 재지정 (T-0139
  // Admin endpoint 의 backbone — ADR-0011 §2 의 슬롯별 model 재지정). `@@unique`
  // 인 difficulty 를 where 로 슬롯 1 개를 특정해 FK 갱신. null 전달 시 슬롯 미설정
  // 으로 되돌림 (fail-fast 거부 대상으로 복귀 — ADR-0011 §3). 슬롯 (difficulty) 부재
  // 시 Prisma `P2025` throw — 본 layer catch X (후속 service 가 NotFound 변환).
  async updateProviderConfig(
    difficulty: Difficulty,
    llmProviderConfigId: string | null,
  ): Promise<DifficultyMapping> {
    return this.prisma.difficultyMapping.update({
      where: { difficulty },
      data: { llmProviderConfigId },
    });
  }
}
