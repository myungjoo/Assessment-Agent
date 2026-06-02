---
id: T-0178
title: GithubModule wiring + env→instance config 순수 함수 parser
phase: P4
status: DONE
commitMode: pr
prNumber: 162
mergedAs: 50fb704
completedAt: 2026-06-03T01:30:00+09:00
reviewRounds: 1
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-044]
estimatedDiff: 285
estimatedFiles: 5
created: 2026-06-03
plannerNote: P4 milestone-3 — ADR-0017 후속 chain row1(GithubModule wiring + env config parser, dep0/schema0/§5 미발화)
---

# T-0178 — GithubModule wiring + env→instance config 순수 함수 parser

## Why

P4 milestone-3 (GitHub adapter, Q-0017 승인) 의 다음 dependency-free slice 다. 현재 `src/github/` 에는 `GithubAdapter` (@Injectable dispatch service) + `buildGithubRequest` (순수 builder) 만 있고, 이를 NestJS module 로 배선하는 `github.module.ts` 가 없으며 AppModule 에도 등록돼 있지 않다. [ADR-0017](../decisions/ADR-0017-github-instance-config-source.md) 의 "후속 task chain" 표 row 1 (GithubModule wiring + env config parser) 이 본 task 다. ADR-0017 Decision §1 (`process.env` 기반 config source) + Decision §2 (`GITHUB_INSTANCES` enumerable key + per-key `_HOST`/`_ORG`/`_TOKEN_ENC`) + Decision §3 (env→instance config 변환 = 부수효과 0 순수 함수, fail-fast) 를 코드로 박제한다. 이로써 README L7–18 의 GitHub 3 instance (REQ-005/006/007/008) 활성화 설정 경로가 코드 레벨에서 완결된다.

새 외부 dependency 0 (`process.env` 는 Node 표준 — `pnpm add` 0), schema 변경 0, 실 token / credential 0 (env 이름·shape 만 다룸 — 실값 미기재, [CLAUDE.md §9](../../CLAUDE.md)) → [CLAUDE.md §5](../../CLAUDE.md) HITL 게이트 미발화.

## Required Reading

- `docs/decisions/ADR-0017-github-instance-config-source.md` — Decision §1 (env source) / §2 (env naming: `GITHUB_INSTANCES` + per-key `GITHUB_<KEY>_HOST`/`_ORG`/`_TOKEN_ENC`) / §3 (순수 함수 parser 경계 + fail-fast + missing/malformed 방어) / "후속 task chain" 표 (본 task = row 1, token JIT decrypt 는 row 2 = 별도 task)
- `src/llm/llm-live-test-gating.ts` — `resolveLiveTestGating(env: NodeJS.ProcessEnv)` 순수 함수 + `isPresent` guard + missing 진단 reason 패턴 (본 task 의 `resolveGithubInstances` 가 mirror 할 reference)
- `src/llm/llm-live-test-gating.spec.ts` — 위 순수 함수의 R-112 negative case spec 패턴 (참고만)
- `src/auth/auth.module.ts` — `@Module` + `process.env` 직접 read (`registerAsync`/`useFactory`) NestJS module env-source 선례
- `src/github/github-adapter.service.ts` (L32, L165–183 위주) — `@Injectable GithubAdapter` 의 `@Optional` 생성자 (fetch + emitter, Prisma dep 0) — module 의 provider/export 대상. `GithubRequestInput` shape (host/token/path/query) 도 확인 (parser 결과의 host/orgs/tokenEnc 와의 경계)
- `src/llm/llm.module.ts` + `src/llm/llm.module.spec.ts` — `@Module` providers/exports 등록 + module compile spec (jest.mock 패턴) 의 mirror 대상
- `src/app.module.ts` — `imports: [...]` 에 `GithubModule` 추가할 위치
- `scripts/check-spec-presence.sh` — 신규 production `.ts` 의 colocated spec 동반 의무 (CI 강제) 확인

## Acceptance Criteria

구현 산출물 (≤ 5 파일, ≤ ~300 LOC):

1. **`src/github/github-instance-config.ts` (신규)** — ADR-0017 Decision §3 의 env→instance config 변환 순수 함수.
   - env 키 이름 상수: `GITHUB_INSTANCES_ENV` (= `"GITHUB_INSTANCES"`) + per-key suffix 상수 (`_HOST` / `_ORG` / `_TOKEN_ENC`) 또는 key 별 변수 이름 조립 helper. **실값 0 — 이름 상수만** ([§9](../../CLAUDE.md)).
   - `GithubInstanceConfig` interface: `{ key: string; host: string; orgs: string[]; tokenEnc: string }` (tokenEnc = encrypted-at-rest envelope 문자열 — 본 task 는 decrypt 안 함, 그대로 보관).
   - `resolveGithubInstances(env: NodeJS.ProcessEnv): GithubInstanceConfig[]` — `GITHUB_INSTANCES` comma-separated key list 를 파싱 → 각 key 마다 `GITHUB_<KEY 대문자>_HOST` / `_ORG` / `_TOKEN_ENC` 를 read → config 객체 배열로 변환. 부수효과 0 / 외부 의존 0 (`llm-live-test-gating.ts` mirror).
   - **fail-fast / malformed 방어** (ADR-0017 Decision §3): `GITHUB_INSTANCES` 부재/빈/공백-only → 빈 배열 또는 명확한 처리 (구현이 선택하되 일관). 열거된 key 의 `_HOST` 또는 `_TOKEN_ENC` 부재/빈 → 해당 instance 를 reject (throw 또는 skip + 진단) — 평문/빈 fallback 금지. `_ORG` 다중 값은 comma-separated split + trim. 진단 메시지에 어느 env 가 부재했는지 이름만 박제 (실값 금지, §9).
2. **`src/github/github-instance-config.spec.ts` (신규, colocated)** — 위 순수 함수의 R-112 cover (아래 test 항목 참조).
3. **`src/github/github.module.ts` (신규)** — `@Module` 로 `GithubAdapter` 를 provide + export. AppModule (또는 다른 module) 이 inject 가능하게. PersistenceModule dep 불요 (`GithubAdapter` 는 Prisma dep 0). config parser 를 module init 시점에 쓸지 (예: provider factory) 또는 후속 slice 로 둘지는 ADR-0017 Decision §3 정합으로 구현이 결정하되, **token JIT decrypt 호출은 본 task 에 넣지 않는다** (ADR-0017 chain row 2 = 별도 task).
4. **`src/github/github.module.spec.ts` (신규, colocated)** — `llm.module.spec.ts` mirror — module compile + `GithubAdapter` provider resolve + exports 등록 정합 검증.
5. **`src/app.module.ts` (수정)** — `imports` 배열에 `GithubModule` 추가 + 주석 1 줄 (T-0178 / REQ-005~008).

테스트 요구 (R-112 — `commitMode: pr` 코드 task 의무):

- [ ] **Happy-path unit test**: `resolveGithubInstances` 가 정상 env (예: `GITHUB_INSTANCES=public,sec,ecode` + 각 key 의 3 변수 set) 를 받아 3 개 config 객체 배열을 정확히 반환 (host/orgs/tokenEnc 매핑 정확). `GithubModule` compile + `GithubAdapter` resolve happy-path 1+.
- [ ] **Error path unit test**: 열거된 key 의 `_HOST` 부재 / `_TOKEN_ENC` 부재 시 reject (throw 또는 skip+진단) — 평문/빈 fallback 안 함을 검증.
- [ ] **Flow / branch coverage**: parser 의 각 분기 cover — `GITHUB_INSTANCES` 부재 분기, 빈/공백 key 분기, 다중 org comma split 분기, 단일 org 분기, 부분-set (일부 key 만 완전) 분기 각 1+ test.
- [ ] **Negative cases 충분 cover** (예외 상황 분기마다 1+): (a) `GITHUB_INSTANCES` undefined / 빈 문자열 / 공백-only, (b) 열거된 key 의 `_HOST` 빈/공백, (c) `_TOKEN_ENC` 빈/공백, (d) `_ORG` 빈 (org 0 개 허용 여부는 ADR-0017 정합으로 구현 결정 후 그 분기 cover), (e) key list 의 trailing comma / 중복 key / 대소문자 변형, (f) 열거된 key 인데 변수 전부 부재 (부분-set). 단일 negative 만 작성 금지 — 위 각각 1+.
- [ ] **Coverage**: `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%, `package.json` `coverageThreshold.global`). 신규 production 파일은 colocated spec 으로 high cover.
- [ ] `pnpm lint && pnpm build && pnpm test` green (tester 가 R-110 확인).

## Out of Scope

- **token JIT decrypt** — `GITHUB_<KEY>_TOKEN_ENC` 를 [ADR-0014](../decisions/ADR-0014-llm-api-key-encryption-at-rest.md) cipher 로 decrypt 해 `GithubRequestInput.token` 에 평문 공급하는 wiring 은 **본 task 밖** (ADR-0017 chain row 2 = 별도 task). 본 task 는 `tokenEnc` 암호문을 그대로 config 에 보관만.
- **실 token / credential 주입** — `_TOKEN_ENC` 의 실 암호문 (실 GitHub token 암호화 값) 주입 + 실 네트워크 live smoke 는 ADR-0017 chain row 3 = §5 credential 게이트 task. 본 task 는 env 이름·shape 만 (실값 0, §9).
- **PermissionDeniedRecord entity / persistence** — DB schema 변경 (§5 게이트). 본 task 밖.
- **ConfluenceModule wiring** — 별도 adapter (Q-0017). 본 task 밖.
- **token 전용 master key (`GITHUB_TOKEN_ENC_KEY`) 신설 결정** — ADR-0017 Decision §3 이 "후속 wiring/decrypt task 확정" 으로 deferral. 본 task 는 새 env key 도입 0.
- **rate-limit backoff / since 증분 / orchestrator loop** — adapter 후속 slice. 본 task 밖.
- ADR-0017 PROPOSED→ACCEPTED status 갱신 — 본 wiring 머지 후 별도 direct task (ADR-0017 chain row 4).
- `docs/architecture/modules.md` GithubModule row / `p4-implementation-plan` 의 octokit→내장 fetch 정합 doc-sync — 별도 direct task.

## Suggested Sub-agents

`implementer → tester` (architecture 결정은 ADR-0017 가 이미 박제 — architect 불요).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
