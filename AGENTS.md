# robinhoot — NestJS 11 starter

## Package manager

pnpm only. Never use npm or yarn.

## Commands

| Goal | Command |
|---|---|
| Install | `pnpm install` |
| Dev server (watch) | `pnpm run start:dev` |
| Build | `pnpm run build` |
| Lint + fix | `pnpm run lint` |
| Format | `pnpm run format` |
| Unit tests | `pnpm run test` |
| Unit tests (watch) | `pnpm run test:watch` |
| Coverage | `pnpm run test:cov` |
| E2E tests | `pnpm run test:e2e` |

## Testing layout

- **Unit tests**: `*.spec.ts` files co-located next to source under `src/`. Jest config is embedded in `package.json`, rootDir = `src`.
- **E2E tests**: `*.e2e-spec.ts` in `test/`. Config at `test/jest-e2e.json`.

## Notable config

- **Prettier** (`.prettierrc`): single quotes, trailing commas, `endOfLine: auto` in ESLint rule.
- **ESLint** (`eslint.config.mjs`): flat config with `typescript-eslint` + prettier plugin. `no-explicit-any` off, `no-floating-promises` warn, `no-unsafe-argument` warn.
- **Nest CLI** (`nest-cli.json`): `deleteOutDir: true` — cleans `dist/` on each build.
- **TypeScript** (`tsconfig.json`): `nodenext` module, `ES2023` target, decorators enabled, `strictNullChecks` on, `noImplicitAny` off.
- **Port**: defaults to `3000` via `process.env.PORT ?? 3000` in `src/main.ts`.

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->

## Shared assistant tooling (OpenCode and Codex)

- Shared domain skills live in `.agents/skills/`. OpenSpec skills there link to
  `.opencode/skills/` so both assistants use the same workflows.
- OpenSpec CLI: `pnpm exec openspec <command>`. For generated workflows that say
  `openspec ...`, use `pnpm exec openspec ...` when it is not on PATH.
- In Codex, invoke `$openspec-propose`, `$openspec-explore`,
  `$openspec-apply-change`, `$openspec-sync-specs`, or `$openspec-archive-change`.
  References to `/opsx-*` in shared workflows mean the corresponding skill.
  Translate OpenCode-specific tool names (AskUserQuestion, TodoWrite, Task,
  Skill) to available Codex equivalents; if no equivalent exists, carry out the
  step directly. Ask questions in chat when no question tool is available.
- Fallow MCP is configured in both assistants. CLI fallback:
  `pnpm exec fallow audit --format json --quiet`. Findings are not an execution
  failure; distinguish the tool's findings status from runtime errors. Do not
  apply automated fixes unless they are part of the requested work.
- Codex custom agents live in `.codex/agents/`: `docs-writer`, `review`, and
  `security-auditor`. Use them when the user requests delegation. They inherit
  the parent session's permissions. Review and security audits must not edit
  files; docs-writer and review have shell tools disabled.
- OpenCode `/test` corresponds to Codex `$project-test`. Database-backed tests
  require the test database; do not silently substitute the production database.
