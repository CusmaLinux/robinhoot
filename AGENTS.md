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
