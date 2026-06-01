// LlmProviderConfigService — LlmProviderConfig 도메인 의 read-only application
// service. T-0140 acceptance 박제 (T-0139 Follow-up #1 — `/api/llm/providers`
// 목록 slice). DifficultyMappingService (T-0138) 의 repository forward 패턴을
// mirror 하되 **추가로 apiKey secret redaction** 책임을 가진다.
//
// 핵심 보안 invariant (task §Why 박제):
//   - LlmProviderConfig.apiKey 는 평문 String 으로 저장된 secret (encryption-at-rest
//     는 ADR-0006 follow-up). GET 응답에 apiKey 를 **절대 포함하면 안 된다**.
//   - 따라서 본 service 는 repository 의 raw row 를 controller 로 그대로 forward 하지
//     않고, apiKey 를 제거한 view shape (LlmProviderConfigView) 배열로 변환해 반환한다.
//     controller 가 raw row 를 직접 직렬화하지 못하도록 sanitize 책임은 service 가 가짐.
//   - sanitize 는 **명시적 field pick** 으로 구현 (전체 row spread 후 apiKey delete
//     금지 — 새 secret 컬럼 추가 시 누락 방지 차원의 allow-list 정책). schema 에
//     새 secret 이 추가돼도 view 는 명시 pick 한 6 필드만 노출 → leak 표면 최소.
//
// 책임 경계 (Out of Scope — task §Out of Scope 박제):
//   - POST/PATCH/DELETE config CRUD (생성/수정/삭제) — Follow-up #1 (본 service 는
//     read-only 조회 slice 만). create slice 가 본 redaction sanitize 헬퍼 위에 build.
//   - apiKey encryption-at-rest — 평문 저장값 그대로 (ADR-0006 책임). 본 service 는
//     저장된 값을 응답에서 **제외 (redact)** 만 — 암호화 코드 0 / secret 처리 코드 0.
//   - provider HTTP client / 실제 LLM API call — 후속 routing task (HITL 게이트).
//
// 단건 조회 (T-0142 — Follow-up #2 구현): findById 는 목록과 동일 sanitize 헬퍼를
// 재사용해 단일 row 를 apiKey 제거 view 로 변환한다 (목록 / 단건 동일 allow-list
// redaction 정책 공유). 단, 목록과 달리 row 부재 (null) 를 빈 결과로 두지 않고
// NotFoundException (404) 로 변환한다 — DifficultyMappingService 의 service-layer
// 4xx mapping 관행 mirror (controller 가 아니라 service 가 404 throw).
//
// 생성 (T-0149 — POST slice): create 는 (1) isLlmProvider 로 provider 값 허용 집합
// 검증 (미지원 → BadRequestException 400), (2) LlmApiKeyCipher.encrypt 로 평문
// apiKey 를 AES-256-GCM envelope ciphertext 로 변환 (ADR-0014 §1), (3) ciphertext 를
// 담아 repository.create 호출, (4) 반환 row 를 기존 sanitize 로 redact 한 view 반환.
// read path 와 동일 sanitize 를 재사용해 응답에 apiKey 가 절대 노출되지 않음을 보장
// (ADR-0014 §3 write-only / never-read-back invariant).
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { LlmProviderConfig } from "@prisma/client";

import type { CreateLlmProviderConfigDto } from "./dto/create-llm-provider-config.dto";
import type { UpdateLlmProviderConfigDto } from "./dto/update-llm-provider-config.dto";
import { LlmApiKeyCipher } from "./llm-apikey-cipher.service";
import { isLlmProvider } from "./llm-gateway.interface";
import {
  LlmProviderConfigRepository,
  type LlmProviderConfigUpdateInput,
} from "./llm-provider-config.repository";

// Prisma 의 error 식별 — `code` field 가 known request error 의 식별자.
// DifficultyMappingService / GroupService / PersonService 의 동일 helper 와 동일
// duck typing 패턴 — `Prisma.PrismaClientKnownRequestError` 의 instanceof check
// 대신 runtime 의존성 회피 차원 (repository spec 의
// `Object.assign(new Error, { code })` 패턴 + test/helpers/prisma-mock.ts 의
// `buildPrismaError` 와 정합). 본 helper 의 service 간 중복은 기존 §Follow-ups 의
// shared util 외화 candidate — 본 task 는 mirror 우선, 신규 외화 없음 (task §Out
// of Scope 박제).
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

// LlmProviderConfigView — HTTP 응답으로 노출 가능한 LlmProviderConfig 의 view shape.
// LlmProviderConfig 에서 **apiKey 만 제외** 한 6 필드 (id / provider / endpointUrl /
// modelId / createdAt / updatedAt). apiKey 는 secret 이라 view 타입 자체에서 누락 —
// 타입 레벨에서도 controller / caller 가 apiKey 에 접근하지 못하도록 차단.
export type LlmProviderConfigView = Omit<LlmProviderConfig, "apiKey">;

@Injectable()
export class LlmProviderConfigService {
  constructor(
    // 목록 / 단건 조회 + create 영속 source. findMany / findById / create 호출.
    private readonly repository: LlmProviderConfigRepository,
    // apiKey AES-256-GCM 암호화 helper (T-0147 / ADR-0014 §1). create 가 평문
    // apiKey 를 ciphertext envelope 으로 변환할 때만 사용 (read path 는 미사용 —
    // never-decrypt-and-return, ADR-0014 §3).
    private readonly cipher: LlmApiKeyCipher,
  ) {}

  // sanitize — 단일 raw row → apiKey 제거 view 변환. 명시적 field pick (allow-list)
  // 으로 구현 — apiKey 는 destructure 한 뒤 폐기하지 않고 아예 view 객체 키에 포함
  // 시키지 않는다. 새 secret 컬럼이 schema 에 추가돼도 본 pick 에 없으면 view 에
  // 누출되지 않음 (deny-by-default).
  private sanitize(row: LlmProviderConfig): LlmProviderConfigView {
    return {
      id: row.id,
      provider: row.provider,
      endpointUrl: row.endpointUrl,
      modelId: row.modelId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // findAll — 등록된 LlmProviderConfig 전체를 apiKey 제거 view 배열로 반환.
  // repository.findMany 의 reject (DB 장애 등 의존성 실패) 는 swallow 하지 않고
  // 그대로 propagate (await 로 throw 전파). 빈 배열 (등록 0) 도 그대로 빈 배열 반환
  // — 404 변환 안 함 (컬렉션 조회의 정상 결과). 분기: 빈 배열 → 빈 배열,
  // 비어있지 않은 배열 → 각 row sanitize.
  async findAll(): Promise<LlmProviderConfigView[]> {
    const rows = await this.repository.findMany();
    return rows.map((row) => this.sanitize(row));
  }

  // findById — 단일 LlmProviderConfig 를 id 로 조회해 apiKey 제거 view 로 반환.
  // repository.findById 는 row 부재 시 null 을 반환 (Prisma native — throw 안 함).
  // 본 service 는 그 null 을 빈 결과로 두지 않고 NotFoundException (404) 으로 변환
  // 한다 (목록 endpoint 와 달리 단건은 부재 = 404 의미). null 이 아니면 기존
  // sanitize 헬퍼를 그대로 재사용해 apiKey 를 제거한 view 를 반환 — 목록 / 단건이
  // 동일 allow-list redaction 정책을 공유한다 (새 secret 컬럼 추가 시에도 양쪽 동시
  // 보호). repository.findById 의 reject (DB 장애 등 의존성 실패) 는 swallow 하지
  // 않고 그대로 propagate (await 로 throw 전파).
  //
  // 분기: null → NotFoundException throw, 비-null → sanitize view 반환.
  async findById(id: string): Promise<LlmProviderConfigView> {
    const row = await this.repository.findById(id);
    if (row === null) {
      throw new NotFoundException(`llm provider config not found: ${id}`);
    }
    return this.sanitize(row);
  }

  // create — 새 LlmProviderConfig 를 영속한 뒤 apiKey 제거 view 로 반환 (POST slice,
  // T-0149). 처리 순서 (ADR-0014 §1·§3 박제):
  //   (1) provider 값 허용 집합 검증 — isLlmProvider 가 false 면 BadRequestException
  //       (400). DTO 는 형식 (비어있지 않은 string) 만 검증하므로 미지원 provider
  //       literal 의 거부는 service 책임 (DifficultyMappingService 의 isDifficulty
  //       service-layer 검증 패턴 mirror).
  //   (2) 평문 apiKey 를 LlmApiKeyCipher.encrypt 로 AES-256-GCM envelope ciphertext
  //       로 변환 (ADR-0014 §1). encrypt 가 throw (env 키 부재 / 길이 미달 등) 하면
  //       swallow 하지 않고 그대로 propagate — 평문이 암호화 없이 영속되는 경로 차단.
  //   (3) ciphertext 를 apiKey 자리에 담아 repository.create 호출. repository.create
  //       의 reject (DB 장애 등 의존성 실패) 도 swallow 없이 그대로 propagate.
  //   (4) 반환 row 를 read path 와 동일 sanitize 로 redact 한 view 반환 — 응답에
  //       apiKey (평문이든 ciphertext 든) 가 절대 포함되지 않음 (ADR-0014 §3
  //       write-only / never-read-back invariant — GET 과 동일 allow-list 정책 공유).
  //
  // 분기: provider 유효 (통과) vs 무효 (BadRequestException) 각 1 분기.
  async create(
    dto: CreateLlmProviderConfigDto,
  ): Promise<LlmProviderConfigView> {
    // (1) provider 허용 집합 검증 — 미지원 provider literal → 400.
    if (!isLlmProvider(dto.provider)) {
      throw new BadRequestException(
        `unsupported llm provider: ${dto.provider}`,
      );
    }

    // (2) 평문 apiKey → AES-256-GCM envelope ciphertext. encrypt throw 는 propagate.
    const ciphertext = this.cipher.encrypt(dto.apiKey);

    // (3) ciphertext 를 영속 (평문 apiKey 는 DB 에 절대 닿지 않음 — encrypt-at-rest).
    const row = await this.repository.create({
      provider: dto.provider,
      endpointUrl: dto.endpointUrl,
      apiKey: ciphertext,
      modelId: dto.modelId,
    });

    // (4) apiKey (ciphertext) 를 제거한 view 반환 — never-read-back invariant.
    return this.sanitize(row);
  }

  // update — 등록된 LlmProviderConfig 를 id 로 **부분 갱신** 한 뒤 apiKey 제거 view
  // 로 반환 (PATCH slice, T-0151). 처리 순서 (ADR-0014 §1·§3 박제):
  //   (1) provider 검증 — dto.provider 가 명시됐고 isLlmProvider 가 false 면
  //       BadRequestException (400). 부재면 검증 skip (create 의 isLlmProvider
  //       검증을 명시 경우에만 mirror — PATCH 는 provider 미변경 허용).
  //   (2) partial data 구성 — provider / endpointUrl / modelId 는 **명시된 것만**
  //       data 에 포함 (부재 필드는 omit → repository.update 가 미변경). undefined
  //       체크로 omit/include 분기.
  //   (3) apiKey 분기 — dto.apiKey 가 명시되면 cipher.encrypt 로 새 ciphertext 를
  //       만들어 data.apiKey 에 포함 (재암호화, POST encrypt 경로 재사용). 부재면
  //       data 에 apiKey 키 자체를 넣지 않음 → 기존 ciphertext 유지 (재암호화 0 /
  //       기존 secret 을 decrypt 해 read-back 하지 않음 — never-read-back, ADR-0014 §3).
  //       encrypt throw (env 키 부재 등) 는 swallow 없이 propagate.
  //   (4) repository.update(id, data) 를 try/catch 로 감싸 Prisma P2025 (id 부재)
  //       catch 시 NotFoundException (404) 변환 (delete 의 P2025→404 패턴 mirror).
  //       그 외 error (DB 장애 / 무관 Prisma code 등) 는 swallow 없이 propagate
  //       (404 로 잘못 변환하지 않음). getPrismaErrorCode duck-typing 재사용.
  //   (5) 반환 row 를 read path 와 동일 sanitize 로 redact 한 view 반환 — 응답에
  //       apiKey (평문이든 ciphertext 든) 절대 미포함 (ADR-0014 §3 never-read-back).
  //
  // 분기: provider 명시-유효 / 명시-무효(400) / 부재(skip) · apiKey 명시(encrypt) /
  //       부재(유지) · update 성공 / P2025(404) / 그 외(raw propagate).
  async update(
    id: string,
    dto: UpdateLlmProviderConfigDto,
  ): Promise<LlmProviderConfigView> {
    // (1) provider 명시 시에만 허용 집합 검증 — 미지원 provider literal → 400.
    if (dto.provider !== undefined && !isLlmProvider(dto.provider)) {
      throw new BadRequestException(
        `unsupported llm provider: ${dto.provider}`,
      );
    }

    // (2) 변경할 필드만 담는 partial data — 부재 필드는 omit (미변경).
    const data: LlmProviderConfigUpdateInput = {};
    if (dto.provider !== undefined) {
      data.provider = dto.provider;
    }
    if (dto.endpointUrl !== undefined) {
      data.endpointUrl = dto.endpointUrl;
    }
    if (dto.modelId !== undefined) {
      data.modelId = dto.modelId;
    }

    // (3) apiKey 분기 — 명시 시에만 재암호화 후 포함 (부재면 기존 ciphertext 유지,
    //     decrypt/encrypt 둘 다 미호출 — never-read-back). encrypt throw 는 propagate.
    if (dto.apiKey !== undefined) {
      data.apiKey = this.cipher.encrypt(dto.apiKey);
    }

    // (4) 부분 갱신 — id 부재의 P2025 만 404 로 변환, 그 외는 raw propagate.
    let row: LlmProviderConfig;
    try {
      row = await this.repository.update(id, data);
    } catch (error) {
      const code = getPrismaErrorCode(error);
      if (code === "P2025") {
        throw new NotFoundException(`llm provider config not found: ${id}`);
      }
      throw error;
    }

    // (5) apiKey 를 제거한 view 반환 — never-read-back invariant.
    return this.sanitize(row);
  }

  // delete — 등록된 LlmProviderConfig 를 id 로 hard delete (DELETE slice, T-0150).
  // repository.delete 를 try/catch 로 감싸 Prisma error code 를 4xx 로 변환한다
  // (DifficultyMappingService 의 service-layer Prisma error mapping 관행 mirror —
  // controller 가 아니라 service 가 4xx throw). 변환 분기:
  //   - P2025 (record to delete not found — id 부재): NotFoundException (404).
  //     repository.delete 가 부재 id 에 던지는 raw P2025 를 호출자 가시성 있는
  //     404 로 표면화 (GroupRepository delete 의 P2025 propagate 정책 정합).
  //   - P2003 (foreign key constraint failed — DifficultyMapping 슬롯이 본 config
  //     를 사용 중): ConflictException (409). schema 의 `onDelete: Restrict`
  //     (prisma/schema.prisma §DifficultyMapping FK, ADR-0011 §2) 가 in-use config
  //     삭제를 차단해 던지는 P2003 을 409 로 변환 — Admin 이 먼저 슬롯을 재지정한
  //     뒤 삭제하라는 운영 가시성 (자동 cascade nullify 안 함, task §Out of Scope).
  //   - 그 외 error (DB 장애 / 알 수 없는 Prisma code 등): swallow 없이 그대로
  //     propagate (404/409 로 잘못 변환하지 않음). getPrismaErrorCode 가 `code`
  //     필드 없는 plain Error 에 undefined 를 반환 → 어떤 변환 분기에도 매칭되지
  //     않아 raw propagate 로 떨어짐.
  // error code 식별은 getPrismaErrorCode duck-typing 패턴 (instanceof 회피).
  // 성공 시 void 반환 — 응답 body 0 (apiKey 든 어떤 config 필드든 직렬화 0,
  // ADR-0014 §3 never-read-back: 삭제 경로에서도 secret 노출 표면 0).
  //
  // 분기: 성공 (변환 0) / P2025 (404) / P2003 (409) / 그 외 (raw propagate).
  async delete(id: string): Promise<void> {
    try {
      await this.repository.delete(id);
    } catch (error) {
      const code = getPrismaErrorCode(error);
      if (code === "P2025") {
        throw new NotFoundException(`llm provider config not found: ${id}`);
      }
      if (code === "P2003") {
        throw new ConflictException(
          `llm provider config in-use: ${id} (먼저 DifficultyMapping 슬롯을 재지정한 뒤 삭제하세요)`,
        );
      }
      throw error;
    }
  }
}
