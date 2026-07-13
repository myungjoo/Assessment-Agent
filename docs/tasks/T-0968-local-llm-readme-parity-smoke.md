---
id: T-0968
title: deploy/local-llm-example/README.md 사용법 runbook cross-artifact 정본 계약(문서화 config 값 4종↔config.env active 키 byte-parity·LAN_ALLOW_CIDR/포트 11434 parity·AA 연결 endpointUrl/modelId↔config.env·스크립트 표 7종 실 파일 존재·config.local.env↔.gitignore 커밋금지 parity·SEED_LLM_ENDPOINT_URL 포트 규약 + deploy/README·seed-llm-config.sh cross-ref 실존) 정적 smoke
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-061, REQ-062]
estimatedDiff: 400
estimatedFiles: 1
sizeExempt: true
exemptReason: "test-only 단일 smoke-spec 1파일. sibling T-0967(_common.ps1 코드-기본값 cross-parity, +? LOC)·T-0966(config.env 내부+seed cross-parity, 390 LOC)·T-0965(deploy/README runbook, 694 LOC) 동형. R-112 4종 cover 위한 다수 assert(문서화 config 값 4종 byte-parity·LAN_ALLOW_CIDR/포트 parity·AA 연결 값·스크립트 표 7종 실 파일 존재·config.local.env↔.gitignore parity·SEED_LLM_ENDPOINT_URL 포트·cross-ref 파일 실존·negative mutant a~h 8종·원본 read-only·§9 secret-safety) 불가피로 300 LOC 초과 예상이나 accepted sibling 패턴 그대로 — production 0 LOC·README.md/config.env/.gitignore/스크립트 미변경."
independentStream: realdata-e2e-local-llm-readme-parity-contract
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-local-llm-example-readme-runbook-config-doc-value-single-source-parity-script-table-file-existence-gitignore-crossref-contract.smoke-spec.ts]
created: 2026-07-14
plannerNote: "P5 §108/§109 로컬 Ollama live-LLM 운영 premise leg — T-0966(config.env)·T-0967(_common.ps1 코드-기본값)이 봉한 LLM 호스트측 정본의 문서화 counterpart README.md 는 smoke 미봉(grep NONE). deploy/README(T-0965)의 LLM 호스트측 대응 — runbook 문서-값이 config.env active 키·스크립트 실 파일과 drift 하면 운영자 오구성. pr-mode test-only 1파일 sizeExempt dep[] file-disjoint."
---

# T-0968 — deploy/local-llm-example/README.md 사용법 runbook cross-artifact 정본 계약 정적 smoke

## Why

로컬 Ollama live-LLM 운영 premise 를 봉해온 chain 이 LLM 호스트측 설정 정본(config.env, T-0966)과 그 config 를 코드로 소비/embedding 하는 공용 헬퍼(_common.ps1, T-0967)를 봉했다. 그러나 운영자가 실제로 **읽고 따라 하는 사용법 문서** `deploy/local-llm-example/README.md` 는 아직 smoke 미봉이다(origin/main grep 확인 — `test/` 에 `local-llm-example/README` 참조 spec NONE). 이 README 는 config 값·AA 연결 값·스크립트 목록·LAN 노출 절차를 **문서-값으로 재기술**하는데, 그 문서-값이 실 artifact(config.env active 키·`_common.ps1` 코드-기본값·실 스크립트 파일)와 어긋나면(drift) 문서를 신뢰한 운영자가 잘못된 모델/포트/endpoint 로 로컬 LLM 을 구성한다.

이는 서버측 재배포 runbook `deploy/README.md`(T-0965 봉함)의 LLM 호스트측 counterpart 다. README 의 documentation single-source 계약을 정적 앵커로 봉하는 것이 본 task 다. 핵심 위험은 **문서-값 drift**: README §설정 바꾸기(line 89~92)가 `OLLAMA_MODEL=gemma4:12b`·`OLLAMA_HOST=127.0.0.1:11434`·`OLLAMA_KEEP_ALIVE=5m`·`OPENAI_BASE_URL=http://127.0.0.1:11434/v1` 를, §AA에 연결하기(line 122~123)가 `endpointUrl=http://127.0.0.1:11434/v1`·`modelId=gemma4:12b` 를, §LAN 노출(line 141~142)이 `LAN_ALLOW_CIDR=192.168.0.0/24`·TCP `11434` 를 문서-값으로 명기한다 — 이들이 config.env active 키(T-0966 봉함)와 byte-drift 하면 운영자가 문서를 믿고 오구성한다. 또한 §스크립트 설명 표(line 65~73)가 열거하는 7종(`install.ps1`·`start-llm.ps1`·`stop-llm.ps1`·`status.ps1`·`test-llm.ps1`·`config.env`·`_common.ps1`)이 실 파일로 존재해야 하고(문서-표가 삭제된 스크립트를 가리키면 dead 안내), §설정 바꾸기(line 95)의 `config.local.env` 커밋-금지 안내가 `.gitignore`(line 2)와 parity 해야 하며, §다른 기기(line 152·157)의 `SEED_LLM_ENDPOINT_URL` 예시 포트 `11434` + cross-ref(`deploy/README.md`·`deploy/seed-llm-config.sh`)가 실존해야 한다. 이 문서-정본이 변질되면 무인 재배포 후 live-LLM 평가(PLAN §109)의 운영자 진입 안내가 조용히 오구성으로 이끈다. 본 task 는 그 문서-정본을 정적 앵커로 봉해 LLM 호스트측 운영 premise 의 문서 leg 를 config.env(T-0966)·_common.ps1(T-0967) 위에 완결에 붙인다(PLAN.md §108/§109).

## Required Reading

- `deploy/local-llm-example/README.md` 전체 — §설정 바꾸기(line 88~93: `OLLAMA_MODEL=gemma4:12b`·`OLLAMA_HOST=127.0.0.1:11434`·`OLLAMA_KEEP_ALIVE=5m`·`OPENAI_BASE_URL=http://127.0.0.1:11434/v1`)·§스크립트 설명 표(line 65~73: 스크립트 7종)·§AA에 연결하기(line 119~124: `endpointUrl`·`modelId`)·§LAN 노출(line 134~158: `LAN_ALLOW_CIDR=192.168.0.0/24`·포트 `11434`·`SEED_LLM_ENDPOINT_URL` 예시·`deploy/README.md`/`deploy/seed-llm-config.sh` cross-ref)·§설정 바꾸기 config.local.env 안내(line 95). 본 task 는 이 파일에서 문서-값 토큰을 정적 추출한다(재작성/변경 0 — read-only).
- `deploy/local-llm-example/config.env` — active 키(`OLLAMA_MODEL=gemma4:12b`·`OLLAMA_HOST=127.0.0.1:11434`·`OLLAMA_KEEP_ALIVE=5m`·`OPENAI_BASE_URL=http://127.0.0.1:11434/v1`·`LAN_ALLOW_CIDR=192.168.0.0/24`). README 문서-값과 cross-artifact byte-parity 대조(readFileSync 정적 추출).
- `deploy/local-llm-example/.gitignore` — line 2 `config.local.env` 커밋-금지 등재. README §설정 바꾸기(line 95 "gitignore됨") 문서와 cross-artifact 대조.
- `deploy/local-llm-example/` 디렉토리 — README §스크립트 표가 열거하는 7종 파일(`install.ps1`·`start-llm.ps1`·`stop-llm.ps1`·`status.ps1`·`test-llm.ps1`·`config.env`·`_common.ps1`) 실 존재 대조(`existsSync`).
- `deploy/README.md`·`deploy/seed-llm-config.sh` — README §다른 기기(line 156~157) cross-ref 대상. 실 파일 존재 대조(`existsSync`, 내용 검증 아님 — 링크 dead 여부만).
- `test/smoke/realdata-e2e-deploy-readme-runbook-parity-*.smoke-spec.ts`(T-0965) 또는 `...config-env-internal-template-parity-contract.smoke-spec.ts`(T-0966) — 형제 패턴(readFileSync 정적 추출·repo-root `__dirname` cwd-robust 해석·선언적 토큰 존재/값/parity assert·합성 mutant drift-detection·원본 read-only·§9 credential 누출 0 구조). 본 task 는 동일 패턴을 README 문서-값 cross-parity + 스크립트 파일 존재 + gitignore/cross-ref 에 적용 — 재구현이 아니라 패턴 참조.

## Acceptance Criteria

- [ ] `test/smoke/realdata-e2e-local-llm-example-readme-runbook-config-doc-value-single-source-parity-script-table-file-existence-gitignore-crossref-contract.smoke-spec.ts` 신설. `deploy/local-llm-example/README.md`·`config.env`·`.gitignore` 를 `readFileSync` 로 읽어 문서-값/정본 토큰을 정적 추출하고, 스크립트 표 7종 + cross-ref 2종은 `existsSync` 로 실 파일 존재만 확인한다(실 PowerShell 실행/실 Ollama 기동/실 추론/실 markdown 렌더 0). repo-root 경로는 `__dirname` 기준으로 cwd-robust 하게 해석(sibling T-0965/T-0966 패턴). `process.env` 읽기 0 — fixture 는 정적 파일 텍스트만. 실 markdown 파서 라이브러리 도입 0 — node 내장 `fs`/`path` + 정규식/행 슬라이스만.
- [ ] **Happy-path(문서-값 cross-artifact parity, 1순위 계약)**: README 가 문서-값으로 명기하는 config 값 4종(`OLLAMA_MODEL=gemma4:12b`·`OLLAMA_HOST=127.0.0.1:11434`·`OLLAMA_KEEP_ALIVE=5m`·`OPENAI_BASE_URL=http://127.0.0.1:11434/v1`, §설정 바꾸기 line 89~92)의 각 값을 정적 추출하고, `config.env` 동명 active 키 값과 **byte-동일**임을 단언하는 assert 4개(키당 1개 이상). 어느 하나라도 drift 하면 운영자가 문서를 믿고 config.env 정본과 다른 값으로 구성.
- [ ] **Happy-path(부수 문서-값 parity)**: 각각 성공 assert 1+ —
  - `LAN_ALLOW_CIDR=192.168.0.0/24`(README §LAN 노출 line 141~142) ↔ config.env active 키 byte-parity,
  - README §AA에 연결하기 `endpointUrl`(line 122) = `http://127.0.0.1:11434/v1` 가 config.env `OPENAI_BASE_URL` 과, `modelId`(line 123) = `gemma4:12b` 가 config.env `OLLAMA_MODEL` 과 byte-parity,
  - 포트 `11434` 가 README 전반(§빠른시작·§설정·§AA연결·§LAN·§SEED_LLM_ENDPOINT_URL line 152)에서 일관되게 등장하고 config.env `OLLAMA_HOST`/`OPENAI_BASE_URL` 포트와 byte-동일.
- [ ] **Happy-path(스크립트 표 실 파일 존재 계약)**: README §스크립트 설명 표(line 65~73)가 열거하는 7종(`install.ps1`·`start-llm.ps1`·`stop-llm.ps1`·`status.ps1`·`test-llm.ps1`·`config.env`·`_common.ps1`)을 표 텍스트에서 정적 추출하고, 각 파일이 `deploy/local-llm-example/` 에 `existsSync` 로 실존함을 단언하는 assert(파일당 1+ 또는 배열 일괄 1+). 문서-표가 삭제/개명된 스크립트를 가리키면 dead 안내 검출.
- [ ] **cross-artifact config.local.env↔.gitignore parity 계약**: README §설정 바꾸기(line 95)가 "개인 오버라이드는 `config.local.env`(gitignore됨)" 로 안내하는 파일명(`config.local.env`)이 `.gitignore`(line 2)에 커밋-금지 항목으로 등재됨을 단언하는 assert 1+ (미등재면 문서 안내와 실제 gitignore 가 drift → 개인 secret override 커밋 위험).
- [ ] **cross-ref 실존 계약**: README §다른 기기(line 156~157)가 참조하는 `deploy/README.md`·`deploy/seed-llm-config.sh` 가 실 파일로 존재함을 `existsSync` 로 단언하는 assert 1+ (링크 dead 여부만 — 내용 검증은 각 파일 own smoke 소관).
- [ ] **Error/negative path 충분 cover** — 예외 상황 분기마다 mutant 합성 소스로 not-match/실패 단언 각 1+ (최소 a~h 8종):
  - (a) README 문서-값 `OLLAMA_MODEL=gemma4:12b` 를 `llama3:8b` 로 바꾼 mutant → 문서↔config.env cross-parity drift 검출,
  - (b) README `OLLAMA_HOST` 포트를 `11434` 에서 `8080` 으로 바꾼 mutant → 포트 cross-parity drift 검출,
  - (c) README `endpointUrl` 의 `/v1` suffix 제거 mutant → AA 연결 endpoint 규약 drift 검출,
  - (d) README `modelId` 를 `gemma4:12b` 에서 `qwen3:8b` 로 바꾼 mutant → modelId↔config.env drift 검출,
  - (e) README `LAN_ALLOW_CIDR=192.168.0.0/24` 를 `10.0.0.0/8` 로 바꾼 mutant → CIDR cross-parity drift 검출,
  - (f) README §스크립트 표에서 `test-llm.ps1` 행을 존재하지 않는 `run-llm.ps1` 로 바꾼 합성 mutant → 스크립트 표 실 파일 존재 계약 drift 검출(`existsSync` false),
  - (g) `.gitignore` 에서 `config.local.env` 행을 제거한 합성 mutant → 문서 안내↔gitignore parity drift(gitignore 측) 검출,
  - (h) README cross-ref 를 존재하지 않는 `deploy/DEPLOY.md` 로 바꾼 합성 mutant → cross-ref 실존 계약 drift 검출(`existsSync` false).
- [ ] **원본 read-only 입증**: 합성 mutate 후에도 원본 `README.md`/`config.env`/`.gitignore` 추출 결과가 불변(원본 텍스트 미변조)임을 단언하는 test 1+.
- [ ] **§9 secret-safety**: 추출/합성하는 어떤 토큰에도 실 secret/password/apiKey/실 자격이 등장하지 않음(bind 주소 `127.0.0.1:11434`·CIDR `192.168.0.0/24`·모델 tag `gemma4:12b`·keep-alive `5m`·`/v1` suffix·SEED_LLM 예시 `192.168.0.5:11434`·apiKey 안내값 `ollama`(더미) 만 — 모두 비시크릿 설정 값/경로/예시)을 단언하는 test 1+. mutant 에 쓰는 합성 값조차 명백한 dummy(`8080`·`llama3:8b`·`qwen3:8b`·`10.0.0.0/8`·`run-llm.ps1`·`deploy/DEPLOY.md`)로 한정 — 실 자격 0. `process.env` 읽기 0.
- [ ] **Flow/branch cover**: 각 정본 앵커의 일치/drift 분기(문서-값 4종 cross-parity·LAN_ALLOW_CIDR/포트·AA 연결 값·스크립트 표 7종 존재·config.local.env↔.gitignore parity·cross-ref 실존)를 각 test 로 분리. README/config.env/.gitignore 는 정적 문서·선언적 설정 — "런타임 분기 없음(정적 소스 텍스트 앵커) — happy/negative mutant 로 대체 cover" 명시.
- [ ] non-gated 항상 실행(describe.skip / gating 분기 0), 실 PowerShell 실행/실 Ollama/실 추론/실 markdown 렌더 0, 대조 artifact(`README.md`·`config.env`·`.gitignore`·스크립트 7종·cross-ref 2종) 변경 0(readFileSync/existsSync 읽기만).
- [ ] `pnpm lint && pnpm build` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 spec 은 production 0 LOC 라 coverageThreshold 무회귀 — 기존 임계 유지 확인.

## Out of Scope

- `deploy/local-llm-example/README.md`·`config.env`·`.gitignore`·스크립트 파일 수정 금지(drift 실제 발견 시 별도 fix task — 본 task 는 검증 smoke 신설만).
- T-0966(config.env 내부 템플릿 + seed cross-parity)·T-0967(_common.ps1 코드-기본값 cross-parity) smoke 재구현/변경 0 — 본 task 는 README **문서-값** 이 config.env active 키/실 스크립트 파일과 parity 하는지만(config.env 내부 계약·_common.ps1 코드-기본값은 각 T-0966/T-0967 봉함).
- README 가 참조하는 `deploy/README.md`·`deploy/seed-llm-config.sh`·개별 스크립트(`install.ps1` 등)의 **내용** 계약 검증 0 — 본 task 는 파일 **존재**(dead-link 여부)만 확인. 각 파일 내부 계약은 own smoke 소관(deploy/README = T-0965 봉함, seed-llm-config.sh cross-parity = T-0966 봉함, 개별 스크립트 = 필요 시 follow-up).
- README §트러블슈팅·§자원 해제 동작·§제거 절차의 서술 정확성 검증 0 — 본 task 는 config-값 cross-parity·스크립트 표 존재·gitignore/cross-ref 정적 계약만. 서술 semantic 은 별도 표면(필요 시 follow-up).
- 실 Ollama pull/serve/추론·실 PowerShell 파서 동작·실 LAN 노출·실 방화벽 규칙·실 markdown 렌더링 실측 도입 0 — 정적 소스 텍스트 앵커만(README 문서-값 ↔ config.env/.gitignore/스크립트 파일 parity).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음)
