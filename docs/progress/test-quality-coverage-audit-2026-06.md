# CI 테스트 스위트 품질·coverage 감사 보고서 (2026-06)

- task: T-0231 (audit-only entry, commitMode: direct)
- 작성일: 2026-06-04
- 수집 방법: `pnpm install --frozen-lockfile` 후 `pnpm test:cov` (jest `--coverage`) 실 1 회 실행. per-file 수치는 jest text summary 원본.
- 표본 한계: coverage 수치는 **전수**(165 spec suite / src 전체)다. 품질(% 너머) 점검은 gap 이 드러난 파일 + 대표 spec **표본**이다(전수 line-by-line 점검 아님 — 보고서 §3 에 표본 명시).

---

## 1. 요약 — 전체 coverage 와 threshold 대비 여유/위험

`pnpm test:cov` 1 회 실행 결과 (165 suite / 3276 test 전부 pass):

| 지표 | All files 측정값 | threshold (package.json `coverageThreshold.global`) | 여유 |
| --- | --- | --- | --- |
| % Statements | 99.94 | 50 | +49.94 (대형 여유) |
| % Branch | 99.83 | 50 | +49.83 (대형 여유) |
| % Functions | 100 | 80 | +20 (대형 여유) |
| % Lines | 99.94 | 80 | +19.94 (대형 여유) |

**threshold 와 실측 사이 사실 정정**: T-0231 task Why 본문은 threshold 를 "line ≥ 80% / function ≥ 80%"(맞음) + "branch 는 global threshold 미포함"이라고 적었으나, **실제 `package.json` 은 branch 50 / statements 50 도 명시**돼 있다(미포함 아님). 다만 branch/statement floor 가 50 으로 line/function 80 보다 **낮게** 설정돼 있어 "낮은 분기 floor 가 % 뒤에 분기 누락을 숨길 수 있다"는 task 의 risk 지적은 **정책 측면에서 여전히 유효**하다(실측 branch 가 99.83 이라 현재는 무해하지만, floor 가 낮아 미래 회귀를 조기에 못 막음).

**결론**: 현 스위트는 raw coverage 측면에서 **threshold 를 압도적으로 상회**(전 지표 거의 100%). 80% floor 턱걸이 파일은 **0 건**. 위험은 "raw %" 가 아니라 (a) 극소수 미커버 분기, (b) coverage 측정에서 **제외된 파일군의 숨은 분기**, (c) % 가 보장하지 못하는 **assertion 의미·negative case 충분성**에 있다. 아래 §2~§4 가 이를 다룬다.

---

## 2. coverage 취약 목록 (실측 수치 인용)

### (a) branch coverage 가 line 대비 현저히 낮은 파일

전체적으로 거의 없음. 100% 미만 파일은 아래 3 건뿐(나머지 ~120 production 파일은 전 지표 100%):

| 파일 | % Stmts | % Branch | % Funcs | % Lines | Uncovered |
| --- | --- | --- | --- | --- | --- |
| `src/llm/difficulty-mapping.service.ts` | 97.05 | 100 | 100 | 96.87 | line 50 |
| `src/llm/encrypt-token-cli.ts` | 100 | 91.66 | 100 | 100 | line 113 |
| `src/llm/difficulty-mapping.repository.ts`·기타 | 100 | 100 | 100 | 100 | — |

- `difficulty-mapping.service.ts:50` — `getPrismaErrorCode()` helper 의 `return undefined` 경로(error 가 객체가 아니거나 `code` 필드가 string 이 아닐 때). Prisma 가 아닌/형식 외 error 가 throw 되는 negative 분기가 미실행. line 미커버지만 branch 는 100 으로 잡혀(삼항/조건이 statement 단위라) **line gap 이 branch gap 보다 먼저 드러난 사례**.
- `encrypt-token-cli.ts:113` — `const message = error instanceof Error ? error.message : String(error);` 의 **`: String(error)` 분기**(비-Error 값이 throw 됐을 때)가 미실행 → branch 91.66. 기존 error-path test 는 전부 `Error` 인스턴스를 throw 하는 cipher 만 검증(spec L264·L281)해서 **비-Error throw 라는 R-112 negative case 가 누락**. 전형적 "방어 코드인데 그 방어가 test 되지 않은" 사례.

### (b) 80% floor 턱걸이(80~85%) 파일/모듈

**0 건.** 100% 미만 파일조차 최저가 line 96.87 / branch 91.66 으로 모두 90% 이상. floor 턱걸이 위험 없음.

### (c) `coveragePathIgnorePatterns` 제외 파일 중 분기 로직 보유 (R-112 entrypoint 예외 위반 후보)

`package.json` 의 `coveragePathIgnorePatterns` = `["/node_modules/", "src/main.ts", "\\.module\\.ts$"]`. 즉 **모든 `*.module.ts` 9 개 + `src/main.ts`** 가 coverage 측정에서 제외된다.

- `src/auth/auth.module.ts` — `JwtModule.registerAsync({ useFactory: () => ({ secret: process.env.AUTH_JWT_SECRET ?? "" ... }) })` 의 **`?? ""` nullish 분기**를 품고 있다(L63). `\\.module\\.ts$` 패턴으로 coverage 제외 → 이 분기는 **% 에 전혀 잡히지 않는다**.
  - 단, **spec 은 존재**한다: `src/auth/auth.module.spec.ts:102` 가 `delete process.env.AUTH_JWT_SECRET` 후 module compile 을 검증해 fallback 분기를 **실행은 한다**(spec-presence + 실행 양쪽 통과). 즉 R-112 "spec 동반" 의무는 충족이나, **coverage 측정기가 그 분기를 세지 못해 회귀 시 자동 적발 못 함**(measurement blind spot). 나머지 8 개 `*.module.ts` 는 순수 선언(`@Module({...})` 배열)만이라 분기 없음 — 제외 정당.
  - 판정: **정책상 미세 risk**(위반은 아님 — spec 으로 실행 cover 됨). `auth.module.ts` 의 env-fallback 분기 로직을 testable helper(예: `resolveJwtSecret(env): string`)로 분리하면 coverage 측정 대상이 되어 회귀 자동 적발 가능. §4 backlog T-cand-3.
- `src/main.ts` — R-112 entrypoint 예외 규칙대로 제외 + 분기 helper(`parse-port.ts`·`bootstrap.ts`)가 이미 분리돼 각각 100% cover. **정합 — 위반 아님**.

---

## 3. 품질(% 너머) 점검 — 표본 + gap 인용

표본: 100% 미만 3 파일 전부 + 대표 spec(`encrypt-token-cli.spec.ts`, `auth.module.spec.ts`). 근거는 파일:라인.

### (i) assertion 빈약(실행만 하고 expect 부실)

- 점검한 표본에서 **심각한 assertion 빈약은 발견되지 않음**. 예: `encrypt-token-cli.spec.ts` 의 error-path test(L264·L281)는 단순 `toBeDefined` 가 아니라 (return code == 1) + (stdout 비어있음) + (stderr 에 평문 미노출, §9 보안 invariant)까지 다중 의미 assertion. `auth.module.spec.ts` 도 `toBeInstanceOf(AuthService)` 등 타입 검증 동반.
- 단 `auth.module.spec.ts` 의 일부 케이스(L60·L77·L115)는 `expect(service).toBeDefined()` 위주 — DI 등록 검증 목적이라 허용 범위지만, env-fallback 분기(L102~115)는 "compile 성공"만 보고 **secret 이 실제 `""` 로 binding 됐는지**는 검증 안 함. backlog T-cand-3 에서 helper 분리 + 반환값 assertion 으로 강화 권고.

### (ii) error path 미검증

- `difficulty-mapping.service.ts:50` — `getPrismaErrorCode` 의 non-Prisma error 분기(`return undefined`)가 미검증(§2(a)). 이 helper 가 `undefined` 를 반환하면 호출부가 "P2002(unique 위반) 아님" 으로 분기하는데, 그 negative 분기로 들어가는 test 표본이 없음.

### (iii) R-112 negative case 부족 (권한·빈입력·경계·type mismatch·의존성 실패 분기)

- **type mismatch / 비정상 throw 누락**: `encrypt-token-cli.ts:113` 의 `String(error)` 분기 — 비-Error 값(string·object 등)이 throw 됐을 때의 진단 경로. R-112 의 "type mismatch / 비정상 시퀀스" negative case 에 해당하나 미커버(§2(a)). 권한·빈입력·경계는 해당 파일에서 이미 cover(빈/공백 평문 L298, 키 부재·길이미달 L264·L281).
- 그 외 표본 파일들의 권한·빈입력·경계 negative case 는 양호(전수 아님 — 표본 한정 판단).

### (iv) 경계값/edge 누락

- 표본 범위에서 **두드러진 경계값 누락 미발견**. `parse-port.ts`(포트 범위 경계)·DTO validator 들은 100% + 별도 spec 보유. 단 전수 점검이 아니므로 "표본에서 미발견"으로 한정.

---

## 4. 우선순위화된 강화 backlog (follow-up task 후보)

risk = 도메인 중요도 × 결함 노출 가능성. 모두 commitMode: pr, 각 ≤ 300 LOC / 5 파일 cap 내. test 강화이므로 production 코드 변경 0 (T-cand-3 만 helper 분리로 소량 prod 변경 동반 — 별도 명시).

### P1 — `encrypt-token-cli.ts` 비-Error throw negative case (security-adjacent)

- **대상**: `src/llm/encrypt-token-cli.spec.ts` (test only).
- **추가할 test**: `io.cipher.encrypt` 가 **비-Error 값**(예: 문자열·`{}`)을 throw 하도록 mock → `runEncryptTokenCli` 가 (a) return 1, (b) stderr 진단에 `String(error)` 결과 포함, (c) 평문 미노출(§9) 을 검증. → `encrypt-token-cli.ts:113` branch 91.66→100.
- **risk 근거**: secret 암호화 CLI 의 error 진단 경로 — 평문 누출 invariant 가 걸린 보안 코드. 방어 분기가 미검증이면 회귀 시 평문 누출 회귀를 못 잡음. **최우선**.
- 규모: ~1 test case, ≤ 20 LOC, 1 파일.

### P2 — `difficulty-mapping.service.ts` non-Prisma error 분기 (error-path)

- **대상**: `src/llm/difficulty-mapping.service.ts` 호출부의 spec(`difficulty-mapping.service.spec.ts`) (test only).
- **추가할 test**: repository/persistence 가 **`code` 필드 없는 error**(또는 비-객체 throw)를 던지도록 mock → `getPrismaErrorCode` 가 `undefined` 반환하는 분기(L50)로 진입하고 호출부가 P2002 아닌 경로로 처리함을 검증. → line 96.87→100.
- **risk 근거**: 난이도 매핑 upsert 의 DB 오류 분기 — P2002(중복) vs 그 외 error 구분이 잘못되면 사용자에게 잘못된 에러 의미 전달. 중간 risk.
- 규모: ~1~2 test case, ≤ 30 LOC, 1 파일.

### P3 — `auth.module.ts` JWT secret fallback 분기 measurable 화 (coverage blind spot + prod 소량 변경)

- **대상**: `src/auth/auth.module.ts` + 신규 `src/auth/resolve-jwt-secret.ts`(helper) + `resolve-jwt-secret.spec.ts`.
- **변경**: `process.env.AUTH_JWT_SECRET ?? ""` 를 `resolveJwtSecret(env: NodeJS.ProcessEnv): string` helper 로 분리(module 은 helper 호출만). helper 는 coverage 측정 대상 → `?? ""` 분기가 % 에 잡힘. spec 은 (env 있음 → 그 값) + (env 없음/빈문자 → `""`, negative) 2 분기 검증 + 반환값 assertion(현 `auth.module.spec` 의 "compile 만 확인" 한계 보완, §3(i)).
- **risk 근거**: auth secret binding — 보안 핵심 + 현재 coverage blind spot(§2(c)). 회귀 자동 적발 불가 상태 해소. 단 위반은 아니라 P3.
- 규모: helper(~15 LOC prod) + spec(~30 LOC) + module edit(~3 LOC). ≤ 3 파일. **prod 코드 변경 동반 — pr-mode + reviewer 필수**.
- 주의: `coveragePathIgnorePatterns` 자체 수정은 Out of Scope(정책 변경). 본 task 는 helper 분리만으로 측정 대상화.

### P4 — (정책 권고, 즉시 task 화 X) `coverageThreshold` branch/statement floor 상향 검토

- **현황**: branch 50 / statements 50 (line/function 80 보다 낮음). 실측이 99.83 이라 floor 가 회귀 조기 적발에 거의 기능 못 함.
- **권고**: branch/statements floor 를 (예) 90 으로 상향 → 미래 분기 회귀를 조기 차단. 단 **CI 정책 변경 = pr-mode + 기존 통과 영향·false-positive 검토 동반**(Out of Scope 명시). 별도 task/ADR 로만. 본 보고서는 **권고만**.
- risk 근거: 예방적(현재 결함 0). 우선순위 낮으나 long-horizon 회귀 방어 가치.

### P5 — (후보 언급만) mutation testing 도입 검토

- raw coverage 99.94% + assertion 표본 양호이나, "% 너머 assertion 의미" 를 **체계적**으로 측정하려면 mutation testing(예: Stryker)이 정공법. 단 **새 dependency = §5 BLOCKED + 별도 ADR**. 본 보고서는 후보로만 언급(도입 X).

---

## 5. 감사 결론

- raw coverage 는 전 지표 ~100% 로 threshold 를 압도 — **80% floor 턱걸이·심각한 미커버 모듈 없음**.
- 실질 gap 은 (1) 보안 코드 1 건의 비-Error throw negative case 누락(P1, 최우선), (2) DB error 구분 분기 1 건(P2), (3) auth secret fallback 의 coverage 측정 blind spot(P3, helper 분리로 해소), 3 건으로 좁다.
- 정책 측면 권고 2 건(P4 branch floor 상향 / P5 mutation testing)은 별도 task/ADR.
- 본 task 는 audit-only — production·test 코드 미변경. 강화는 위 P1~P3 follow-up(pr-mode)이 수행. driver 가 planner 로 P1~P3 를 task 화 권장.

---

### Appendix — 수집 명령 재현

```
pnpm install --frozen-lockfile
pnpm test:cov   # jest --coverage, 165 suite / 3276 test pass, ~15s
```

100% 미만 3 파일 외 ~120 production 파일은 전 지표 100% (text summary 원본 기준). `*.module.ts` 9 개 + `src/main.ts` 는 `coveragePathIgnorePatterns` 로 측정 제외.
