---
id: T-1315
title: 로컬 LLM 스크립트 3종의 stale 런너 kill 목록에 llama-server 추가 + 목록 parity smoke 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-060, REQ-061]
estimatedDiff: 215
estimatedFiles: 4
created: 2026-07-30
independentStream: local-llm-runner-hygiene
dependsOn: []
prNumber: 1197
touchesFiles:
  - deploy/local-llm-example/_common.ps1
  - deploy/local-llm-example/expose-lan.ps1
  - deploy/local-llm-example/install.ps1
  - test/smoke/realdata-e2e-local-llm-example-orphan-runner-killlist-single-source-parity-contract.smoke-spec.ts
plannerNote: "PLAN.md 운영 backlog 오너 실측 항목(2026-07-30 b5cf8346) 을 pr task 1개로 변환 — kill 목록 3 곳 +llama-server + parity smoke, 약 215 LOC / 4 파일"
---

# T-1315 — 로컬 LLM 스크립트 3종의 stale 런너 kill 목록에 llama-server 추가 + 목록 parity smoke 신설

## Why

[PLAN.md](../PLAN.md) 운영 정책 backlog 161 행(오너 2026-07-30 실측 발견, "즉시 task 변환 대상")이 지목한 결함이다. `deploy/local-llm-example/_common.ps1:116` 의 `Start-OllamaServerIfNeeded` 폴백이 멈춘 인스턴스를 정리할 때 종료 대상을 `'ollama app', 'ollama', 'ollama_llama_server'` 로 잡는데, 현재 Ollama 는 모델을 자식 프로세스 **`llama-server`** 에 적재하므로 마지막 이름이 구버전이라 매칭되지 않는다. 실측(RTX 4070 12GB)에서 부모만 강제 종료하니 `llama-server` 가 고아로 남아 VRAM 10,588 MiB 를 계속 점유했고, 직접 종료 후 1,357 MiB 로 복귀했다. 서버가 멈춰 폴백을 타는 상황에서 고아가 VRAM 을 물고 있으면 새 서버의 모델 적재가 CPU offload 되거나 실패해 **daily-test live leg 타임아웃/FAIL 의 잠재 원인**(PLAN 109 행 실 평가 nightly e2e)이 된다. 동일한 stale 목록이 `expose-lan.ps1:64` · `install.ps1:89` 에도 글자-동일하게 복제돼 있어(origin/main `6b0b2aee` grep 확인) 세 곳을 함께 교정하고, 목록 drift 를 앞으로 막는 정적 parity smoke 를 함께 박제한다.

## Required Reading

- [docs/PLAN.md](../PLAN.md) 161 행 (본 task 의 근거 bullet — 실측 수치·수정 방침·동반 확인 지시) + 160 행 (직전 T-1314 live timeout 상향, 본 수정이 그 보험임을 확인)
- `deploy/local-llm-example/_common.ps1` 101~123 행 (`Start-OllamaServerIfNeeded` — 트레이 앱 기동 → 폴백 정리 → `ollama serve` 직접 기동, 116 행이 수정 대상)
- `deploy/local-llm-example/expose-lan.ps1` 55~70 행 (LAN 노출 후 서버 재기동 경로의 동일 kill 목록, 64 행)
- `deploy/local-llm-example/install.ps1` 82~95 행 (설치 후 재기동 경로의 동일 kill 목록, 89 행)
- `deploy/local-llm-example/stop-llm.ps1` 30~45 행 (**참조만, 수정 금지** — 정상 언로드 경로는 `keep_alive=0` 서버 자기 언로드이며 37 행 `-StopServer` 분기는 언로드 후 실행되므로 고아가 생기지 않는다)
- `test/smoke/realdata-e2e-local-llm-example-stop-llm-ps1-model-unload-keepalive0-config-sourced-cli-fallback-stopserver-branch-contract.smoke-spec.ts` 185~195 행 (`stopServerBranch` 의 `Get-Process -Name 'ollama app', 'ollama'` 정규식 — **stop-llm.ps1 전용**이라 본 task 의 3 파일 변경으로 깨지지 않음을 확인. 신설 spec 의 정적-앵커 서술 스타일 참고용)

## Acceptance Criteria

- [x] `deploy/local-llm-example/_common.ps1` 116 행의 `Get-Process -Name` 목록에 `'llama-server'` 를 추가한다. 기존 3 이름(`'ollama app'` · `'ollama'` · `'ollama_llama_server'`)은 구버전 호환을 위해 **글자 그대로 유지**하고, `-ErrorAction SilentlyContinue` 도 유지한다.
- [x] `deploy/local-llm-example/expose-lan.ps1` 64 행 · `deploy/local-llm-example/install.ps1` 89 행의 동일 목록에도 같은 방식으로 `'llama-server'` 를 추가해 세 파일의 목록을 동일하게 맞춘다 (파일당 1 줄 수정, 다른 로직 변경 0).
- [x] 신설 spec `test/smoke/realdata-e2e-local-llm-example-orphan-runner-killlist-single-source-parity-contract.smoke-spec.ts` 를 추가한다. 실 PowerShell 실행 0 · 실 프로세스 종료 0 — 세 실 파일을 `fs.readFileSync` 로 읽고 정적 텍스트 앵커 + TS 동형 pure helper(예: `parseKillList(text)` → 이름 배열, `hasSilentlyContinue(text)`)로만 검증한다. spec 본문은 **≤ 220 LOC** 로 유지(전체 diff 300 LOC cap 보호).
- [x] happy-path test 1+ — `parseKillList` 가 세 파일 각각에서 `'llama-server'` 를 포함한 목록을 돌려준다(파일별 1 it 또는 `it.each` 3 케이스).
- [x] error path test 1+ — `Get-Process -Name` 라인이 없는 입력·빈 문자열 입력에 대해 `parseKillList` 가 빈 배열을 돌려주고 throw 하지 않는다(정적 helper 의 방어 경로).
- [x] flow / branch cover — helper 의 분기마다 test 분리: (a) 목록 라인 존재 분기, (b) 부재 분기, (c) 주석(`#`) 처리된 라인은 유효 목록으로 세지 않는 분기.
- [x] negative cases 충분 cover (각 1+ test) — (a) 세 파일 중 하나라도 `'llama-server'` 가 빠지면 fail 하는 **회귀 방지** assert(본 결함이 되돌아오면 red), (b) 레거시 3 이름 중 하나라도 사라지면 fail 하는 assert, (c) `ollama*` 같은 wildcard 과잉 매칭 토큰이 목록에 없음을 assert, (d) 세 파일 목록이 서로 다르면 fail 하는 parity assert(집합 동일), (e) `-ErrorAction SilentlyContinue` 누락 시 fail 하는 assert, (f) `stop-llm.ps1` 의 정상 경로가 여전히 `keep_alive=0` 언로드이고 강제 kill 로 대체되지 않았음을 assert.
- [x] `pnpm lint && pnpm build` 통과.
- [x] `pnpm test` 통과 + `pnpm test:smoke` 통과 (신설 spec 은 env gating 없이 상시 실행되는 정적 spec 이어야 한다 — CI 에서 자동 수행, R-113).
- [x] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — production `src/` 변경 0 이므로 threshold 회귀가 없음을 확인.
- [x] 기존 spec 무회귀 확인 — `realdata-e2e-local-llm-example-*` 계열 8 spec 이 모두 green(특히 stop-llm-ps1 contract 의 `Get-Process` 정규식).

## Out of Scope

- `deploy/local-llm-example/stop-llm.ps1` 의 kill 목록 변경 — 정상 VRAM 해제 경로는 `keep_alive=0` 서버 자기 언로드이며 `-StopServer` 는 언로드 뒤에 돌아 고아가 생기지 않는다(오너 실측 1,405 MiB 복귀). 손대면 오히려 정책 역행.
- `start-llm.ps1` 의 `-NoWarm` 예열 정책 변경 — PLAN 161 행이 "루틴 쪽 별건" 으로 명시.
- `deploy/daily-test.sh` 의 leg 추가·변경 — leg 변경은 drift-guard smoke 3종(T-0791/T-0944/T-0947) 동반 갱신을 강제해 5 파일 cap 을 넘긴다(Q-0054 사고).
- 기존 대형 contract spec 3종(`common-ps1-config-default-*` · `install-ps1-ordered-sequence-*` · `stop-llm-ps1-*`) 본문 수정 — 이들은 kill 목록을 assert 하지 않음이 확인됐다(`git grep "ollama app" -- test/` 1 hit = stop-llm spec, 대상 파일은 stop-llm.ps1).
- 실 PowerShell 실행 · 실 Ollama 종료 · 실 `nvidia-smi` VRAM 측정 — spec 은 정적 텍스트 앵커만.
- `docs/PLAN.md` 160·161 행 checkbox 갱신 및 `README.md`/`docs/ops/*` 문서 동기 — direct doc task 소관(§3.1 mixed 금지, Follow-ups 참조).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner 관찰) `docs/PLAN.md` 160 행(realdata live timeout 120s — T-1314 `6b0b2aee` 로 shipped)과 161 행(본 task) 의 checkbox `[ ] → [x]` + shipped 근거 박제는 direct doc-only slice 로 별도 큐잉 필요.

## 완료 기록

- 완료: 2026-07-30T08:51Z. PR [#1197](https://github.com/myungjoo/Assessment-Agent/pull/1197) squash merge `f4cd5da2`, reviewer VERDICT=APPROVE (round 1), CI green (PR run + main run `30528338777`).
- `_common.ps1` 116 · `expose-lan.ps1` 64 · `install.ps1` 89 세 곳의 `Get-Process -Name` 목록에 `'llama-server'` append — 레거시 3 이름과 `-ErrorAction SilentlyContinue` 글자 그대로 유지, 다른 로직 변경 0. 4 파일 +209/-3.
- 신설 parity smoke 15 test (happy 4 · error 2 · branch 3 · negative 6) green. 실 PowerShell·실 프로세스 종료·실 `nvidia-smi` 0 — 정적 텍스트 앵커 + TS 동형 pure helper 만. `local-llm-example` 계열 smoke 10 suite / 277 test 무회귀.
- Follow-up (본 fire 흡수): `docs/PLAN.md` 160 · 161 행 checkbox `[ ] → [x]` + shipped 근거 박제를 본 bookkeeping direct commit 에서 함께 처리 — 별도 task 큐잉 불요.
