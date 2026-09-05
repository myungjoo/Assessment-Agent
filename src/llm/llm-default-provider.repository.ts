// LlmDefaultProviderRepository — ADR-0062 §Decision 2 가 택1 한 **단일 슬롯 table**
// (`LlmDefaultProvider`) 위의 얇은 repository (T-1863). "전역 기본 LLM provider" 는
// LlmProviderConfig 의 isDefault Boolean 컬럼이 아니라 고정 id 1 row 로 표현되므로,
// 본 repository 가 노출하는 표면도 그 슬롯 1 개의 **읽기 / 교체** 두 메서드뿐이다.
// LlmProviderConfigRepository / DifficultyMappingRepository 패턴을 mirror —
// PrismaService delegate 1:1 forwarding, error code raw propagate, null-safe 읽기.
//
// 책임 경계:
//   - 본 layer 는 도메인 invariant 를 검증하지 않는다 — llmProviderConfigId 의 존재
//     여부 · 빈 문자열 거부 · P2003 → 404 변환은 전부 후속 LlmProviderConfigService
//     (T-1864) / DTO (T-1865) 책임이다. 본 layer 는 raw forward 만 한다.
//   - **redact 도 본 layer 책임이 아니다** — 슬롯 row 자체는 secret 을 담지 않지만,
//     후속 layer 가 슬롯이 가리키는 LlmProviderConfig 를 함께 읽을 때 그 row 의
//     apiKey (ciphertext) 를 절대 그대로 응답에 싣지 않아야 한다 (ADR-0014 §1
//     never-read-back — sanitize 는 service 책임). 회귀 방지용 명시 주석.
//   - 본 class 는 PrismaService 의 `llmDefaultProvider` delegate 에 1:1 forwarding
//     만 한다. 테스트는 그 delegate 를 Jest mock 으로 대체해 호출 인자 + return 값
//     정합성만 검증한다 (DB 실연결 불필요).
//
// Prisma error 정책 (형제 repository 와 동일):
//   - findSlot 이 슬롯 부재 시 null 반환 (throw 안 함) — null-safe API. 이 null 이
//     "명시 선택 없음" 을 뜻하며, resolver 는 그때만 하위 호환 분기로 떨어진다
//     (ADR-0062 §Decision 4 — 슬롯이 있으면 row 수와 무관하게 슬롯이 이긴다).
//   - setSlot 이 존재하지 않는 llmProviderConfigId 를 가리키면 FK 위반 `P2003` 을
//     그대로 propagate — 호출자가 NotFoundException(404) 변환 책임 (ADR-0062
//     §Decision 3: 여기서의 P2003 은 "가리키려는 config 가 없다" 이므로 delete 의
//     P2003 "이 config 를 누가 쓰고 있다" → 409 와 **방향이 반대** 다).
//   - 모든 메서드가 PrismaService reject 시 그대로 propagate (DB 장애 등).
import { Injectable } from "@nestjs/common";
import type { LlmDefaultProvider } from "@prisma/client";

import { PrismaService } from "../persistence/prisma.service";

// 전역 기본 provider 슬롯의 고정 PK 리터럴 (ADR-0062 §Decision 2). schema 의
// `@default("default")` 와 같은 값이며, 본 repository 가 읽기 / 쓰기 모두에서 이
// 상수만 사용하기 때문에 "슬롯은 언제나 1 개" 라는 invariant 가 성립한다 (CHECK
// 제약이 아니라 코드 계층 invariant — 잉여 row 가 있어도 읽기가 무시하므로 무해).
export const DEFAULT_SLOT_ID = "default";

@Injectable()
export class LlmDefaultProviderRepository {
  constructor(private readonly prisma: PrismaService) {}

  // findSlot — 고정 슬롯 1 row 를 PK 단건 조회. 슬롯 부재 (= 명시 선택 없음) 시
  // null 반환 (Prisma native 동작). 잉여 row 가 DB 직접 조작으로 생겨도 본 조회는
  // id = DEFAULT_SLOT_ID 하나만 보므로 무해하게 무시된다 (ADR-0062 fail-safe 비대칭).
  async findSlot(): Promise<LlmDefaultProvider | null> {
    return this.prisma.llmDefaultProvider.findUnique({
      where: { id: DEFAULT_SLOT_ID },
    });
  }

  // setSlot — 기본 provider 교체. upsert **단일 statement** 라 "이전 해제 → 새 지정"
  // 2 write 사이에 default 가 0 개인 window 가 존재하지 않는다 (ADR-0062 §Decision 2
  // 원자성 축 — isDefault 컬럼안이 $transaction 을 요구하는 지점과 대조). 이미 같은
  // config 가 기본인 상태에서의 재호출은 update 경로로 흘러 성공한다 (멱등 — PUT
  // 시멘틱 정합, ADR-0062 §Decision 3). 값 검증 0 (raw forward).
  async setSlot(llmProviderConfigId: string): Promise<LlmDefaultProvider> {
    return this.prisma.llmDefaultProvider.upsert({
      where: { id: DEFAULT_SLOT_ID },
      create: { id: DEFAULT_SLOT_ID, llmProviderConfigId },
      update: { llmProviderConfigId },
    });
  }
}
