---
id: ADR-0066
title: 사전 난이도 routing 의 운영 발화 스위치 — 스위치 source · 적용 진입점 · 기본값 경계 결정
status: ACCEPTED
date: 2026-09-10
relatedTask: [T-2008]
relatedReq: [REQ-050, REQ-049]
supersedes: null
augments: [ADR-0065, ADR-0011]
---

# ADR-0066 — 사전 난이도 routing 의 운영 발화 스위치 (R-97)

## Status

**ACCEPTED**. 본 slice 는 **결정만 박제** 하고 코드를 **0 LOC** 만든다 — diff 는 본 문서와 [ADR-0065](ADR-0065-difficulty-routing-activation.md) `## Follow-ups` pointer 1 줄뿐이고 `src/` · `web/` · `test/` · `prisma/` · `package.json` · `.github/workflows/` 변경이 **0** 이다 (ADR-0065 · [ADR-0064](ADR-0064-algorithm-research-contribution-uplift.md) 의 doc-only ADR 선례 동형). 신규 spec **0 이 정당** 하다 — 본 task 가 만드는 public symbol 이 0 이기 때문이며, R-112 의 4 축(happy-path / error path / 분기별 / 예외 분기마다 negative)은 `## Follow-ups` 의 집행 slice 가 진다. `commitMode: pr` 이므로 tester 는 `pnpm lint && pnpm build && pnpm test` green 확인으로 R-110 을 이행한다.

본 ADR 은 [ADR-0065](ADR-0065-difficulty-routing-activation.md) 와 [ADR-0011](ADR-0011-difficulty-model-assignment.md) 을 **augment** 한다. ADR-0065 `§ Decision 3` 이 사전 난이도 주입을 "명시적 opt-in 스위치 뒤 · 기본 OFF" 로 확정하면서 **그 스위치를 무엇으로 켜는지는 열어 두었고**, 같은 문서 `## Follow-ups` `96 행` 이 "사전 난이도의 운영 설정화 — 본 ADR 을 augment 하는 후속 ADR 이 선행한다" 로 본 결정을 지정했다. ADR-0065 `§ Decision 1 · 2 · 4` 와 ADR-0011 `§1 ~ §3` 의 결정 내용은 **한 줄도 뒤집지 않는다**(supersede 0).

## Context

### 공백 — opt-in 은 지어졌으나 켜는 경로가 없다

ADR-0065 의 집행 slice(T-2004 · T-2005)가 전량 머지돼 **주입 분기 자체는 production 에 실재** 한다. 그러나 그 분기를 `true` 로 세우는 **production 호출자가 0** 이다. origin/main `5996ea32` 실측:

- [evaluation-scoring.service.ts](../../src/assessment-evaluation/evaluation-scoring.service.ts) `47~55 행` 이 `ScoringOptions` 를 선언하고 `54 행` 이 `useInputDifficultyRouting?: boolean` 선택 필드를 보유한다. 그 값을 읽는 유일한 지점은 `107~113 행` 삼항이며 `108 행` 의 `=== true` 엄격 비교가 ON 게이트다. ON 이면 `difficulty` 를 얹어, OFF 이면 `{ modelId: options.modelId }` 만 `114 행` `gateway.generate` 로 넘긴다.
- `git grep -n "useInputDifficultyRouting" -- src/ web/ test/` 히트 7 중 production 은 위 3 개(선언 · 주석 · 읽기)뿐이고 나머지 4 개는 spec 이다 — **세팅하는 곳이 없다.**
- `git grep -in "DIFFICULTY_ROUTING\|INPUT_DIFFICULTY" -- src/ deploy/ .github/` 는 `DEFAULT_INPUT_DIFFICULTY` 상수 계열만 잡고 env · 설정 키는 **0** 이다.

결과적으로 Admin 이 easy / medium / hard 3 슬롯 model 을 지정해도 평가는 여전히 단일 `modelId` 로 나간다. [requirements.md](../requirements.md) `69 행` REQ-050 이 [T-2006](../tasks/T-2006-req050-difficulty-routing-readjudication.md) 재판정에서 남긴 잔여도 정확히 **"운영 발화 0 축"** 하나다.

### 왜 배선이 아니라 ADR 이 먼저인가 — 진입점마다 modelId source 가 다르다

`ScoringOptions` 가 실제로 조립되는 좌표는 5 곳이고 그 셋이 서로 다른 source 를 쓴다:

| 좌표 | modelId source | 성격 |
| --- | --- | --- |
| [controller](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `291 행` | `dto.modelId`(필수) | `POST /evaluate` — 요청 DTO 직접 |
| [controller](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `905 행` | `dto.modelId` | `POST /summary` 요약 집계 |
| [controller](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `545 행` · `616 행` | `undefined as unknown as string` | period bridge — **미지정** |
| [build-fill-run-scoring-options.ts](../../src/assessment-evaluation/dto/build-fill-run-scoring-options.ts) `108~131 행` | request 우선 → server default fallback | fill-run 유일 조립 helper |

스위치를 "어디에 얹는가" 가 자명하지 않고, 잘못 얹으면 [difficulty-mapping.service.ts](../../src/llm/difficulty-mapping.service.ts) `99~129 행` 의 `resolveModel` fail-fast 4 분기가 광범위하게 발화해 회귀가 된다. 그래서 배선 slice 앞에 본 ADR 이 선다.

### 게이트

본 ADR 이 채택하는 안은 새 외부 dependency **0** · 외부 credential **0** · `prisma/schema.prisma` 변경 **0** 이다 (CLAUDE.md §5). 그 셋 중 하나라도 요구하는 후보는 `§ Decision 1` 에서 **채택하지 않는다**.

## Decision

### § Decision 1 — 스위치 source: ㉠ 요청 DTO 의 선택 boolean 필드 채택

후보 4 종에 조건 (a)~(d) 를 전부 대입한다.

| 후보 | (a) 기본 OFF 보존 | (b) 결정성 · 감사가능성 | (c) ADR-0011 §3 fail-fast 우회 | (d) 자율 집행(새 dep · credential · schema 0) |
| --- | --- | --- | --- | --- |
| **㉠ 요청 DTO 선택 필드** | **구조적 보존** — 미지정 = `undefined` = OFF | **결정적**(값의 source 가 요청 본문 1 곳, 서버 상태 무관) · **감사 가능**(`263~267 행` `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 뒤라 켠 주체가 인증된 Admin 요청으로 특정) | **우회 0** — ON 이면 4xx 그대로 전파 | **가능** — `class-validator` 는 이미 의존, env 로딩 · schema 0 |
| ㉡ 서버 env 설정 값 | 보존 가능(미설정 = OFF) | 결정적이나 **감사 약함** — 누가 언제 켰는지가 앱 밖(배포 산출물)에 있고 요청 단위 귀속이 0 | 우회 0 | 가능 |
| ㉢ DB 설정 row | 보존 가능 | 감사 가능 | 우회 0 | **불가** — 새 table · 컬럼은 `prisma/schema.prisma` 변경이라 CLAUDE.md §5 BLOCKED 사유 |
| ㉣ 3 슬롯 셋업 여부 자동 감지 | **파기** — 셋업된 환경은 아무도 켜지 않아도 ON | 비결정적(같은 요청이 DB 상태에 따라 다른 경로) · 켠 주체 **없음** | **우회함** — 미설정을 OFF 로 해석해 4xx 를 암묵 회피 | 가능 |

**결론(1 값): ㉠ 채택.** 스위치 source 는 **요청 DTO 의 선택 boolean 필드** 이며, 필드명은 `ScoringOptions` `54 행` 과 같은 `useInputDifficultyRouting` 으로 고정한다(층 간 이름 일치 — 배선이 전사 1 줄로 끝나 오배선 여지가 없다). 근거:

1. **기본 OFF 가 구조적으로 보존된다** — 필드를 보내지 않은 기존 client 는 `undefined` → `108 행` `=== true` 가 false → 종전 경로. 회귀가 "주의해서 0" 이 아니라 **구조상 0** 이다.
2. **폭발 반경이 요청 1 건** — ㉡ env 는 켜는 순간 그 서버의 **모든** 평가 호출이 ON 이라 슬롯 미설정 환경에서 전량 4xx 가 된다. ㉠ 은 켠 요청만 4xx 라 운영 전환이 점진적이다.
3. **[ADR-0062](ADR-0062-llm-default-provider-explicit-selection.md) 선례 정합** — 기본 provider 선택을 암묵 자동 선택이 아니라 **명시 선택 최우선** 으로 좁힌 결정과 같은 논리다. 난이도 routing 발화도 "누군가 명시적으로 지정" 이 정본이다.
4. **test 결정성** — `process.env` 변이(㉡)는 spec 간 누수 · 병렬 실행 순서 의존을 만든다. 요청 필드는 인자라 그 위험이 0 이다.

**㉣ 자동 감지 명시 기각.** 3 슬롯이 셋업돼 있으면 자동 ON, 아니면 자동 OFF 라는 안은 편해 보이지만 **실패를 암묵 회피** 한다 — 슬롯이 비어 있는 상태를 "routing 안 함" 으로 해석하는 것은 [ADR-0011](ADR-0011-difficulty-model-assignment.md) `60~64 행` 이 (i) 결과 신뢰성 훼손 (ii) 운영 가시성 상실 (iii) REQ-049 명시 지정 의도와 어긋남 을 이유로 이미 기각한 **silent fallback 을 형태만 바꿔 재도입** 하는 것이다. ADR-0065 `§ Decision 3` 이 (B) catch-후-fallback 을 기각한 것과 같은 축이며, 채택하면 augment 가 아니라 supersede 가 된다. 또한 FK 는 있으나 가리킨 config 가 삭제된 race(`99~129 행` 4 번째 분기)는 "셋업됨" 으로 보이므로 감지 자체가 부정확하다.

### § Decision 2 — 적용 진입점: 요청 DTO 가 modelId source 인 좌표에만 배선

**배선 규칙(1 값): 스위치는 `ScoringOptions` 를 요청 DTO 로부터 직접 조립하는 좌표에만 얹는다.** 좌표 단위 판정:

| 좌표 | 판정 | 사유 |
| --- | --- | --- |
| [controller](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `291 행`(`POST /evaluate`) | **배선함** | `EvaluateActivitiesDto`(`116 행`, modelId 는 `120~122 행`)가 이미 modelId source 다. 스위치 필드 1 개 추가 + `291 행` 객체 리터럴에 전사 1 줄 |
| [build-fill-run-scoring-options.ts](../../src/assessment-evaluation/dto/build-fill-run-scoring-options.ts) `108~131 행` | **배선함** | fill-run 의 **유일한** 조립 helper(반환 `116 행` · `123 행`, fail-fast `128~130 행`). `UnevaluatedFillRunRequestDto`(`54 행`, 선택 modelId 는 `76~79 행`)가 요청 source 이고 소비처는 [run-unevaluated-fill-run-core.ts](../../src/assessment-evaluation/dto/run-unevaluated-fill-run-core.ts) `125 행` 1 곳뿐이라 배선이 닫힌다 |
| [controller](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `905 행`(`POST /summary`) | **배선 안 함** | 요약 경로는 ADR-0065 `§ Decision 4` 가 **범위 밖** 으로 확정(좌표 batch 라 "항목" 이 단수로 정의되지 않아 사전 규칙의 입력면이 성립하지 않음). 본 ADR 은 그 판정을 **재확인** 한다 |
| [controller](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `545 행` · `616 행`(period bridge) | **배선 안 함(후속)** | modelId 자체가 `undefined as unknown as string` 이라 요청 DTO source 가 애초에 없다. 스위치를 흘리려면 ephemeral · admin bridge 2 종의 시그니처를 확장해야 해 배선 규칙 밖이고 slice 가 별개다 → `## Follow-ups` (c) |

즉 본 ADR 이 여는 발화 경로는 **`POST /evaluate` 와 fill-run 2 종** 이고, 나머지 3 좌표는 종전 경로 그대로다.

### § Decision 3 — 기본값 · 회귀 경계 · 잘못된 값의 취급

- **미지정 = OFF = 문자 단위 동일.** 스위치가 없거나 `false` 면 `generate` 인자는 `113 행` 의 `{ modelId: options.modelId }` 단일 키이며, 이는 주입 도입 **이전** 인자와 문자 단위로 같다. 따라서 슬롯 미설정 환경의 회귀는 0 이다.
- **ON 경로의 4xx 는 가리지 않는다.** `99~129 행` `resolveModel` 의 4 분기(허용 밖 난이도 / 슬롯 row 부재 / FK null / 가리킨 config 부재)가 던지는 `BadRequestException` 은 [llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) `112~116 행` 분기를 거쳐 그대로 전파된다. **silent fallback 금지** — ADR-0011 `60~64 행` 유지.
- **잘못된 값(1 값): HTTP 경계에서 400, 내부 호출은 OFF 환원 — 층별로 1 값씩.**
  - HTTP 경계 — DTO 필드는 `@IsOptional()` + `@IsBoolean()` 로만 검증한다. controller-scope `ValidationPipe`(`159~163 행`, `whitelist` + `forbidNonWhitelisted` + `transform`)가 문자열 `"true"` · 숫자 `1` · `null` 을 **400 BadRequest** 로 거부한다. `@Type(() => Boolean)` 류 **coercion 은 붙이지 않는다** — 임의 truthy 를 `true` 로 접으면 오타 한 글자가 조용히 운영 발화를 켜게 되어 (a) 기본 OFF 보존이 무너진다.
  - service 경계 — `108 행` 의 `=== true` 엄격 비교는 그대로 둔다. HTTP 밖 caller(orchestrator · test)가 비-boolean 을 넣어도 **OFF 로 환원** 되며 throw 하지 않는다. 즉 "요청은 거부, 내부는 OFF" 의 이중 방어이고, 두 층 어디서도 **의도치 않은 ON 은 발생하지 않는다**.

### § Decision 4 — 운영자 표면(ON 인데 슬롯이 빈 경우): 범위 밖

**결론(1 값): 범위 밖 — 기존 4xx 메시지를 그대로 노출한다.** 사유:

1. `resolveModel` 이 던지는 메시지 `difficulty model not configured: <난이도>`(`99~129 행`)는 **어느 난이도 슬롯이 미설정인지 이미 지목** 한다. ADR-0011 `60~64 행` 이 요구한 "운영 가시성" 요건은 그 메시지로 충족된다.
2. 별도 안내 표면(web 배너 · 사전 점검 endpoint 등)은 `web/` 변경 + 문구 결정 + 표면 위치 결정을 동반해 **스위치 결정과 다른 축** 이며, 같은 slice 에 넣으면 cap 을 깨고 결정 단위도 흐려진다.
3. 셋업 경로는 이미 존재한다 — `POST /api/llm/difficulty-mappings/seed`(T-1998)로 3 슬롯 row 를 멱등 확보한 뒤 슬롯별 `LlmProviderConfig` 를 지정하는 것이 ON 전환의 운영 선행 조건이고, 그 응답 요약은 T-2007 이 이미 표면화했다.

따라서 운영자 표면 개선은 `## Follow-ups` (d) 확장 지점으로 내린다.

## Consequences

- **얻는 것** — REQ-050 잔여 **"운영 발화 0" 축을 닫는 경로가 확정** 된다. 집행 slice 가 머지되면 Admin 이 지정한 3 슬롯 model 이 `POST /evaluate` · fill-run 에서 실제로 발화한다.
- **치르는 것(셋업 누락 4xx 노출)** — ON 을 지정한 요청은 슬롯이 비어 있으면 4xx 로 실패한다. 이는 은폐하지 않기로 한 **의도된 fail-fast** 이며, OFF 기본값 덕에 그 노출은 켠 요청으로만 국한된다.
- **치르는 것(오분류 routing)** — 사전 규칙이 metadata scalar 만 보므로 실제 난이도와 어긋난 슬롯으로 갈 수 있다(ADR-0065 `## Consequences` 승계). 결과 필드에는 여전히 사후 `classifyNarrative`(`117 행`) 값이 기록돼 평가 결과의 의미는 훼손되지 않는다.
- **치르는 것(전역 스위치 부재)** — ㉠ 채택의 대가로 "서버에서 한 번 켜면 전부 ON" 은 불가능하고 호출자가 매 요청 지정해야 한다. 폭발 반경을 요청 1 건으로 좁히기 위해 **의도적으로 치르는 교환** 이다.
- **바꾸지 않는 경계** — ADR-0011 `§1`(3 슬롯) · `§2`(FK resolve) · `§3`(fail-fast), ADR-0065 `§ Decision 1`(사전 규칙 입력면 · 중앙값 환원) · `§ Decision 2`(주입 지점 1 곳 · 입력/출력 난이도 비대칭) · `§ Decision 4`(요약 범위 밖), gateway `112~116 행` 분기, `classifyNarrative` 의 marker · default — 한 줄도 바꾸지 않는다.

## Alternatives considered

- **㉡ 서버 env 설정 값** — 기각. 켠 주체 · 시점의 감사 근거가 앱 밖에 있어 요청 단위 귀속이 0 이고, 켜는 순간 그 서버의 모든 평가가 ON 이라 슬롯 미설정 환경에서 **전량 4xx** 가 된다(폭발 반경 최대). spec 이 `process.env` 를 변이해야 해 test 결정성도 떨어진다.
- **㉢ DB 설정 row** — 기각. 새 table · 컬럼은 `prisma/schema.prisma` 변경이며 CLAUDE.md §5 상 **BLOCKED 사유** 다. 스위치는 요청 단위 in-memory 신호로 충분해 영속이 불요하다.
- **㉣ 3 슬롯 셋업 자동 감지** — 기각(`§ Decision 1` 명시 기각). 기본 OFF 파기 + silent fallback 의 형태 바꾼 재도입 + 감지 부정확(config 삭제 race).
- **DTO 에 `@Type(() => Boolean)` coercion 부여** — 기각. 임의 truthy 문자열이 ON 으로 접혀 오타가 조용히 운영 발화를 켠다. 명시 boolean 만 허용하고 그 외는 400 이 안전하다.
- **기본값을 ON 으로 뒤집고 opt-out 제공** — 기각. ADR-0065 `§ Decision 3` 의 "기본 OFF" 결정을 뒤집는 supersede 이며, 미셋업 환경 회귀 0 이라는 보증이 사라진다.
- **요약 경로(`905 행`)를 함께 배선** — 기각. ADR-0065 `§ Decision 4` 가 범위 밖으로 확정했고 입력면이 성립하지 않는다.
- **`useInputDifficultyRouting` 대신 난이도 값을 요청이 직접 지정** — 기각. 사전 난이도는 `resolveInputDifficulty` 의 **결정적 산출** 이라는 ADR-0065 `§ Decision 1` 을 뒤집고, 호출자가 슬롯을 임의 지정하는 우회로가 된다.

## Follow-ups

집행은 **후속 pr slice 소관** 이다. 각 slice 는 ≤ 300 LOC / ≤ 5 파일이며 CLAUDE.md §3 **소비처 동반 의무** 를 충족한다(스위치 필드 신설과 그 실제 배선을 같은 PR 에 넣는다). R-112 4 축(happy-path / error path / 분기별 / 예외 분기마다 negative)은 아래 (a) · (b) 가 진다.

- **(a) `POST /evaluate` 스위치 배선** — [evaluate-activities.dto.ts](../../src/assessment-evaluation/dto/evaluate-activities.dto.ts) `116 행` 클래스에 `@IsOptional() @IsBoolean() useInputDifficultyRouting?: boolean` 추가 · 그 `.spec.ts`(비-boolean 400 negative 포함) · [assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `291 행` 전사 1 줄 · 그 controller spec. **4 파일**. 소비처 동반 충족(필드 + 유일 소비처 동반).
- **(b) fill-run 스위치 배선** — [unevaluated-fill-run-request.dto.ts](../../src/assessment-evaluation/dto/unevaluated-fill-run-request.dto.ts) `54 행` 클래스에 동일 선택 필드 추가 · [build-fill-run-scoring-options.ts](../../src/assessment-evaluation/dto/build-fill-run-scoring-options.ts) `108~131 행` 에 3 번째 인자 수용 + 반환 `116 행` · `123 행` 두 곳 반영 · 그 `.spec.ts` · 소비처 [run-unevaluated-fill-run-core.ts](../../src/assessment-evaluation/dto/run-unevaluated-fill-run-core.ts) `125 행` 배선. **5 파일**(초과 시 DTO 축을 뒤 slice 로 분리).
- **(c) period bridge 경로(`545 행` · `616 행`)** — `§ Decision 2` 가 배선 규칙 밖으로 판정. bridge 2 종의 시그니처 확장이 선행돼야 하므로 별도 slice 이며, modelId source 자체가 미지정이라는 사실을 함께 정리한다.
- **(d) 운영자 표면(`§ Decision 4` 범위 밖)** — ON + 슬롯 미설정 시 별도 안내 표면. 확장 지점(task 아님) — 필요하면 후속 ADR 이 선행한다.
- **(e) REQ-050 재판정(direct)** — [requirements.md](../requirements.md) `69 행` 재판정은 [PLAN.md](../PLAN.md) `183 행` **once-rule** 대로 (a) · (b) **전량 머지 후 1 회만** 수행한다.

## References

- [ADR-0065](ADR-0065-difficulty-routing-activation.md) `§ Decision 3`(opt-in · 기본 OFF) · `§ Decision 4`(요약 범위 밖) · `96 행`(본 ADR 을 지정한 확장 지점) — 본 ADR 이 augment
- [ADR-0011](ADR-0011-difficulty-model-assignment.md) `47~51 행`(§1 3 슬롯) · `60~64 행`(§3 fail-fast · silent fallback 기각) — 본 ADR 이 augment
- [ADR-0062](ADR-0062-llm-default-provider-explicit-selection.md) — 명시 선택 우선 선례
- [src/assessment-evaluation/evaluation-scoring.service.ts](../../src/assessment-evaluation/evaluation-scoring.service.ts) `47~55 행`(`ScoringOptions`) · `54 행`(스위치 필드) · `107~113 행`(삼항) · `114 행`(generate) · `117 행`(사후 분류)
- [src/assessment-evaluation/assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `159~163 행`(ValidationPipe 3 설정) · `263~267 행`(Admin 가드) · `291 행` · `545 행` · `616 행` · `905 행`
- [src/assessment-evaluation/dto/build-fill-run-scoring-options.ts](../../src/assessment-evaluation/dto/build-fill-run-scoring-options.ts) `108~131 행` — 반환 `116 행` · `123 행`, fail-fast `128~130 행`
- [src/assessment-evaluation/dto/run-unevaluated-fill-run-core.ts](../../src/assessment-evaluation/dto/run-unevaluated-fill-run-core.ts) `125 행` — helper 의 유일 소비처
- [src/llm/difficulty-mapping.service.ts](../../src/llm/difficulty-mapping.service.ts) `99~129 행` — `resolveModel` fail-fast 4 분기
- [src/llm/llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts) `100 행`(`generate`) · `112~116 행`(difficulty 분기)
- [docs/requirements.md](../requirements.md) `69 행` — REQ-050 잔여 "운영 발화 0" 축
- [docs/PLAN.md](../PLAN.md) `183 행` — REQ 재판정 once-rule

Refs: ADR-0066, ADR-0065, ADR-0011, REQ-050, REQ-049, T-2008
