// DifficultyMappingService — DifficultyMapping 도메인 의 application service.
// T-0138 acceptance 박제 (ADR-0011 §2 resolve + §3 fail-fast 의 service-level 강제).
//
// 책임:
//   - DifficultyMappingRepository (raw CRUD) + LlmProviderConfigRepository (resolve
//     의 두 번째 hop) 2 collaborator 위에 도메인 의미 부여 — 난이도 값 검증 /
//     미설정 슬롯 fail-fast (ADR-0011 §3) / FK resolve (ADR-0011 §2) / Prisma known
//     error code 의 NestJS HttpException 변환. GroupService (T-0050/T-0056) 패턴의
//     1:1 mirror.
//   - resolveModel — 난이도 → DifficultyMapping 슬롯 → LlmProviderConfig.modelId
//     resolve 의 fail-fast chain. 미지원 난이도 / 슬롯 부재 / FK null / 가리킨
//     config 부재 4 분기를 4xx 로 거부 (silent-fallback 금지 — ADR-0011 §3).
//   - findAllMappings / assignProviderConfig — T-0139 Admin endpoint (슬롯별 model
//     재지정) 의 backbone. controller / DTO / RBAC 는 본 task Out of Scope (T-0139).
//
// 책임 경계 (Out of Scope — T-0138 시점):
//   - provider HTTP client / 실제 LLM API call (resolve 된 modelId 로 외부 호출) 없음
//     — 후속 routing task (provider SDK 추가 + CLAUDE.md §5 HITL 게이트) 책임.
//   - Admin LLM 지정 endpoint / DTO / RBAC (PATCH /api/llm/difficulty-mappings) 없음
//     — T-0139 책임. 본 service 의 findAllMappings / assignProviderConfig 가 그
//     endpoint 의 backbone 이나 HTTP-layer forward 는 별도 task.
//   - LlmProviderConfigService 신설 없음 — LlmProviderConfigRepository.findById 만
//     read 용으로 inject (resolve 의 두 번째 hop + assign 의 사전 존재 검증).
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { LlmProviderConfig } from "@prisma/client";

import { isDifficulty } from "./difficulty";
import { DifficultyMappingRepository } from "./difficulty-mapping.repository";
import { LlmProviderConfigRepository } from "./llm-provider-config.repository";

// Prisma 의 error 식별 — `code` field 가 known request error 의 식별자.
// GroupService / PartService / PersonService 의 동일 helper 와 동일 duck typing
// 패턴 — `Prisma.PrismaClientKnownRequestError` 의 instanceof check 대신 runtime
// 의존성 회피 차원. (repository spec 의 `Object.assign(new Error, { code })`
// 패턴과 정합.) 본 helper 의 service 중복은 GroupService §Follow-ups 의 phase 2
// 외화 candidate (본 task 는 mirror 우선, 신규 외화 없음).
function getPrismaErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return undefined;
}

// resolveModel 의 반환 payload — resolve 된 LlmProviderConfig 의 호출 대상 메타.
// LlmGateway (후속 routing task) 의 LlmGenerateOptions.modelId + LlmGenerateResult
// (provider / modelId) 소비처 정합 — provider + modelId + configId 3 필드만 노출
// (apiKey / endpointUrl 은 resolve 결과 payload 에서 제외 — secret 노출 회피,
// gateway 가 필요 시 configId 로 재조회). ADR-0011 §2 의 resolve 결과 형태.
export interface ResolvedModel {
  // resolve 된 LlmProviderConfig.id — gateway 가 추가 메타 재조회 시 사용.
  configId: string;
  // resolve 된 provider 식별자 (LlmProvider enum-as-String literal).
  provider: string;
  // resolve 된 model 식별자 — 실제 호출 대상 (LlmGenerateOptions.modelId 소비).
  modelId: string;
}

@Injectable()
export class DifficultyMappingService {
  constructor(
    private readonly difficultyMappingRepository: DifficultyMappingRepository,
    // resolve 의 두 번째 hop (FK → LlmProviderConfig) + assignProviderConfig 의
    // 지정 대상 config 사전 존재 검증 source. read 용으로만 inject (config 의
    // 도메인 service 는 별도 task).
    private readonly llmProviderConfigRepository: LlmProviderConfigRepository,
  ) {}

  // resolveModel — 난이도 → 호출 대상 model resolve 의 fail-fast chain
  // (ADR-0011 §2 resolve + §3 fail-fast). 미설정 슬롯을 임의 기본 provider 로
  // silent 대체하지 않고 (silent-fallback 금지 — 결과 신뢰성 / 운영 가시성 /
  // REQ-049 명시 지정 의도) 어느 난이도가 미설정인지 4xx 로 표면화한다.
  //
  // 분기 박제 (R-112 cover — 5 분기 각 1+ test):
  //   1. isDifficulty(difficulty) false → BadRequestException (미지원 난이도 —
  //      허용 집합 밖: 빈 문자열 / 대문자 'Easy' / 'trivial' 등).
  //   2. findByDifficulty null (슬롯 row 부재 — seed 전) → BadRequestException
  //      ("model 미설정" — 어느 난이도인지 메시지 명시, 운영 가시성).
  //   3. mapping.llmProviderConfigId null (슬롯 존재하나 FK 미설정 — nullable
  //      시작) → 동일 fail-fast 4xx (어느 난이도가 미설정인지 명시).
  //   4. LlmProviderConfigRepository.findById null (가리킨 config 부재 — race
  //      window: resolve 직전 config 삭제) → 동일 fail-fast 4xx.
  //   5. happy-path: resolve 된 LlmProviderConfig 의 provider + modelId + configId
  //      를 ResolvedModel payload 로 반환.
  async resolveModel(difficulty: string): Promise<ResolvedModel> {
    // (1) 난이도 값 runtime 검증 — 허용 집합 밖이면 슬롯 조회 자체를 하지 않음.
    if (!isDifficulty(difficulty)) {
      throw new BadRequestException(`unsupported difficulty: ${difficulty}`);
    }

    // (2) 슬롯 row 조회 — 부재 시 미설정 (seed 전) fail-fast.
    const mapping =
      await this.difficultyMappingRepository.findByDifficulty(difficulty);
    if (mapping === null) {
      throw new BadRequestException(
        `difficulty model not configured: ${difficulty}`,
      );
    }

    // (3) FK 미설정 (슬롯 존재하나 nullable FK null — 셋업 전) fail-fast.
    if (mapping.llmProviderConfigId === null) {
      throw new BadRequestException(
        `difficulty model not configured: ${difficulty}`,
      );
    }

    // (4) 가리킨 config 조회 — 부재 (race window) 시 fail-fast.
    const config = await this.llmProviderConfigRepository.findById(
      mapping.llmProviderConfigId,
    );
    if (config === null) {
      throw new BadRequestException(
        `difficulty model not configured: ${difficulty}`,
      );
    }

    // (5) happy-path — resolve 결과 payload.
    return {
      configId: config.id,
      provider: config.provider,
      modelId: config.modelId,
    };
  }

  // findAllMappings — 3 row 고정 슬롯 전체 조회 (T-0139 Admin endpoint backbone).
  // raw forward — 정렬 / 도메인 변환 최소 (repository.findMany 의 native 순서 유지).
  // 빈 배열 (seed 전) 도 그대로 반환 — 404 변환 안 함 (조회는 정상 동작).
  async findAllMappings(): Promise<
    Awaited<ReturnType<DifficultyMappingRepository["findMany"]>>
  > {
    return this.difficultyMappingRepository.findMany();
  }

  // assignProviderConfig — 슬롯별 FK 재지정 (ADR-0011 §2, T-0139 Admin endpoint
  // backbone). 지정할 LlmProviderConfig 의 사전 존재를 검증한 뒤 슬롯 FK 를 갱신.
  //
  // 분기 박제 (R-112 cover):
  //   - isDifficulty(difficulty) false → BadRequestException (미지원 난이도).
  //   - LlmProviderConfigRepository.findById null (지정 대상 config 부재) →
  //     NotFoundException ("llm provider config not found").
  //   - repository.updateProviderConfig 의 P2025 (슬롯 difficulty 부재) →
  //     NotFoundException ("difficulty mapping not found").
  //   - 그 외 (unknown Prisma code / code 없는 generic Error / 의존성 fail) →
  //     raw propagate.
  async assignProviderConfig(
    difficulty: string,
    llmProviderConfigId: string,
  ): Promise<
    Awaited<ReturnType<DifficultyMappingRepository["updateProviderConfig"]>>
  > {
    // (1) 난이도 값 runtime 검증.
    if (!isDifficulty(difficulty)) {
      throw new BadRequestException(`unsupported difficulty: ${difficulty}`);
    }

    // (2) 지정할 LlmProviderConfig 사전 존재 검증 — null 시 NotFoundException.
    const config: LlmProviderConfig | null =
      await this.llmProviderConfigRepository.findById(llmProviderConfigId);
    if (config === null) {
      throw new NotFoundException(
        `llm provider config not found: ${llmProviderConfigId}`,
      );
    }

    // (3) 슬롯 FK 갱신 — 슬롯 difficulty 부재 시 P2025 → NotFoundException 변환.
    try {
      return await this.difficultyMappingRepository.updateProviderConfig(
        difficulty,
        llmProviderConfigId,
      );
    } catch (error) {
      if (getPrismaErrorCode(error) === "P2025") {
        throw new NotFoundException(
          `difficulty mapping not found: ${difficulty}`,
        );
      }
      throw error;
    }
  }
}
