# T-0001 PR #1 Review — Round 0/7 (Detailed Notes)

Companion file to the PR comment. Written by `reviewer` sub-agent.

## Scope of this review

- **Primary target**: commit `10554d5` — `feat(bootstrap): NestJS+pnpm+CI skeleton with ADR-0001 (T-0001)`.
- **Co-bundled docs (informational only — not BLOCKER per driver instruction)**:
  - `6393b24` — STATE.json + journal + task frontmatter (direct-mode)
  - `5373fd5` — `.claude/hooks/pr-check.sh`, `.claude/settings.json`, CLAUDE.md preamble, agent rule patches
  - `c32c64e` — integrator/reviewer MCP tools + CLAUDE.md §4 chain rule
- Per CLAUDE.md §3.1 those three direct-mode commits should normally land directly on `main` and never appear in a PR. They got co-bundled because the environment restricts all driver activity to one designated working branch. Noted, not blocking.

## Acceptance Criteria — line-by-line

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | ADR-0001 exists, ACCEPTED, NestJS/TS/pnpm/Jest/GHA documented | ok | `docs/decisions/ADR-0001-stack.md` lines 1-71; Decision table covers all six |
| 2 | `package.json` exists, `pnpm install` produces lockfile | ok | `package.json` + `pnpm-lock.yaml` (3,564 lines, lockfileVersion 9) |
| 3 | `pnpm build` succeeds (`tsc -p tsconfig.build.json`) | ok | script in `package.json:13`, `tsconfig.build.json` extends base + excludes test |
| 4 | `pnpm test` succeeds with ≥1 sanity test | ok | `test/sanity.spec.ts` — arithmetic + AppModule bootstrap (2 tests) |
| 5 | `pnpm lint` succeeds | ok | `.eslintrc.cjs` + script `eslint "src/**/*.ts" "test/**/*.ts"` |
| 6 | `.github/workflows/ci.yml` runs lint+build+test on push/PR to main | ok | workflow lines 1-42; trigger + steps verified |
| 7 | `.gitignore` covers `node_modules/`, `dist/`, `coverage/`, `.env*` | ok | all four present (plus build/, .pnpm-store/, IDE, OS) |
| 8 | README has `pnpm install/build/test/lint` usage paragraph | ok | README "Development" section (post-line 131) |
| 9 | All packaged in single commit | ok | `10554d5` is atomic for the bootstrap content |

All nine acceptance criteria are satisfied by `10554d5`.

## 8-Check Charter (README 117-128) Walkthrough

### 1. 주제 해결 여부
Bootstrap stack + CI is achieved end-to-end. ADR justifies each choice; code is the minimum scaffolding to compile, lint, and test.

### 2. 기존 기능/성능/회귀
No prior code exists; regression risk on production code is zero. However, the meta-layer (`.claude/`, CLAUDE.md preamble, stop-hook) co-bundled in this PR could regress *driver behavior* — see Finding M-1.

### 3. 코드 크기 / 범위
- `actualDiff: 447 LOC`, `actualFiles: 11`.
- Planner cap is **300 LOC, 5 files** (CLAUDE.md §3).
- Excluding `pnpm-lock.yaml` (generated, 3,564 lines), source LOC ≈ 247, files = 10. The lockfile pushes file count to 11; without the four co-bundled doc files the bootstrap commit alone touches roughly 10 files / ~400 LOC raw + lockfile (still over the 5-file cap, source LOC marginally over).
- NestJS bootstrap intrinsically requires `package.json`, `tsconfig.json`, `tsconfig.build.json`, `.eslintrc.cjs`, `.gitignore`, `ci.yml`, ADR, README edit, `src/app.module.ts`, `src/main.ts`, `test/sanity.spec.ts`, lockfile — there is no smaller bootstrap. Acceptable, but planner cap should be revised for known-large bootstrap tasks (Follow-up).

### 4. Test 완비
- Two tests in `test/sanity.spec.ts`:
  - `1 + 1 === 2` — proves Jest + ts-jest wiring.
  - `NestFactory.createApplicationContext(AppModule)` — proves the DI graph composes.
- For T-0001 scope (smoke-only, e2e out of scope) this is sufficient.

### 5. 미래 영향 감지
- The AppModule bootstrap test will fail if any future module introduces a broken provider, circular DI, or import-time error in the root graph.
- However, it will **not** catch breakage if the bootstrap path in `src/main.ts` diverges from what the test calls (the test calls `createApplicationContext` directly, bypassing `main.ts`). For T-0001 this is fine; flag as a Follow-up for when `main.ts` grows real responsibilities.

### 6. CI Fail-fast
- Workflow steps run sequentially (`lint` → `build` → `test`). Any single failure short-circuits the run.
- `pnpm install --frozen-lockfile` blocks merges that drift from the committed lockfile.
- Branch-protection enforcement is repo-level config, not a PR concern.

### 7. ARCHITECTURE / API 문서
- ADR-0001 added inside the PR (matches policy).
- `docs/architecture/modules.md|api.md|data-model.md` do not yet exist — correct for P0 (PLAN places them in P1+).
- README Development section is the only user-facing doc surface affected and is updated.

### 8. 문제 발견 시 PR 코멘트
- This review fulfills it; agent attribution per README line 128 is in the header.

## Findings

### BLOCKER
*(none)*

### MAJOR

**M-1. Co-bundled direct-mode commits violate CLAUDE.md §3.1 separation (informational, per driver instruction)**
- **Where**: commits `6393b24`, `5373fd5`, `c32c64e` (all four direct-mode payload categories — STATE.json, journal, task frontmatter, `.claude/`, CLAUDE.md operating rules).
- **Why it matters**: §3.1 mandates "direct" payloads bypass PR review. Bundling them into a PR (a) lets reviewer comment on docs that policy says reviewer doesn't gate, (b) makes the PR diff harder to read, (c) sets a precedent that erodes the direct/pr split.
- **Mitigation acknowledged**: the working-branch environment constraint forces this. Not actionable in this PR. Per driver explicit instruction, **not a BLOCKER**.
- **Follow-up**: a meta-task should formalize how direct-mode docs reach `main` when only one working branch exists (e.g., a separate fast-path PR with auto-merge, or relax the §3.1 rule for this environment via an ADR amendment).

### MINOR

**m-1. Planner cap exceeded (`docs/tasks/T-0001-bootstrap-stack-and-ci.md` frontmatter)**
- `estimatedDiff: 250 / actualDiff: 447`, `estimatedFiles: 5 / actualFiles: 11`.
- A NestJS bootstrap cannot fit in 5 files / 300 LOC; the estimate was unrealistic. Action: planner should treat bootstrap tasks as a known exception (Follow-up — not a fix in this PR).

**m-2. `test/sanity.spec.ts` bypasses `src/main.ts`**
- Test calls `NestFactory.createApplicationContext(AppModule)` directly. If `src/main.ts` is later mutated to add bootstrap-only logic (logger setup, env validation, `app.listen()`), the test won't catch a regression there.
- Add a follow-up task to either (a) export `bootstrap()` from `main.ts` and import it in the test, or (b) accept this gap until a real HTTP test arrives in P1.

**m-3. CI workflow lacks `concurrency` group (`.github/workflows/ci.yml`)**
- No `concurrency: { group: ${{ github.workflow }}-${{ github.ref }}, cancel-in-progress: true }`. On rapid pushes, multiple runs queue and waste minutes. Cheap follow-up.

**m-4. CI matrix is single-element (`.github/workflows/ci.yml:14-17`)**
- `matrix: { node: [22] }` with `fail-fast: false` provides no extra coverage. Either drop the matrix or extend (e.g., add 20 LTS once supported). Cosmetic.

**m-5. `tsconfig.json` still includes `test/**/*` (`tsconfig.json:23`)**
- Build correctness relies on `tsconfig.build.json`'s `exclude` overriding the base. Works, but a reader has to know TS extension semantics. Optional: move `include` to `tsconfig.build.json` instead of relying on override.

**m-6. ESLint config has no `project` reference**
- Type-aware lint rules (`no-floating-promises`, etc.) cannot run. Intentional minimal config per the comment in `.eslintrc.cjs`. Note for the eventual stricter-lint follow-up.

**m-7. `package.json` jest config in-file vs. `jest.config.js`**
- Inline Jest config in `package.json` is fine for T-0001. As config grows (mocks, setup files, projects), promote to `jest.config.ts`. Future concern only.

**m-8. `journal-2026-05-23.md` line exceeds 5-line CLAUDE.md §7 guidance**
- Currently 3 lines (1 header + 1 blank + 1 entry). Within limits. No action.

## Change Requests (concrete)

*(none required for merge of T-0001)*

The criteria are satisfied, tests prove the wiring, CI is in place. All Findings above are MINOR and intentionally deferred to follow-up tasks.

## Recommended follow-up tasks (for planner, not this PR)

1. F-T-0002 — Establish branch-protection on `main` once CI is verified stable.
2. F-T-0003 — Decide if `src/main.ts` should export `bootstrap()` so tests can cover the actual entry path (resolves m-2).
3. F-T-0004 — Add CI `concurrency` group (resolves m-3).
4. F-T-meta — ADR amendment to handle direct-mode docs on the single working branch (resolves M-1 systemically).

