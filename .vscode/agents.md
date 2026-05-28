# survey-tracker — VS Code Agents Configuration

## Project Overview
Monorepo for university survey tracking system.
- **Frontend**: React + Vite + TypeScript (apps/frontend)
- **Backend**: Fastify + TypeScript + Prisma (apps/backend)
- **Database**: Firebase Realtime Database (current) → PostgreSQL (migrating)
- **Package Manager**: pnpm
- **Monorepo Tool**: Turborepo

## Architecture Rules

### Monorepo Structure
```
survey-tracker/
├── apps/
│   ├── frontend/     # React SPA (Vite)
│   └── backend/      # Fastify API server
├── packages/
│   ├── ui/           # Shared UI components
│   ├── shared-types/ # Shared TypeScript types
│   ├── eslint-config/# Shared ESLint config
│   └── tsconfig/     # Shared TypeScript configs
├── docs/             # Architecture & API documentation
├── tests/            # E2E and integration tests
└── infrastructure/   # Docker, CI/CD configs
```

### Frontend Architecture (Feature-Based)
```
apps/frontend/src/
├── app/          # Router, providers, layouts, store
├── features/     # Feature modules (surveys, qr, dashboard, analytics)
├── shared/       # Shared components, hooks, services, utils, types
├── assets/       # Static assets
├── styles/       # Global styles and theme
└── main.tsx      # Entry point
```

### Backend Architecture (Clean Architecture)
```
apps/backend/src/
├── config/       # App configuration and env vars
├── modules/      # Feature modules (surveys, qr, analytics, webhooks)
├── middleware/    # Express/Fastify middleware
├── shared/       # Shared utilities and helpers
├── database/     # Prisma schema, migrations, seeds
├── app.ts        # Fastify app setup
└── server.ts     # Server entry point
```

## Coding Conventions

### File naming
- **kebab-case** for files: `survey-service.ts`, `qr-controller.ts`
- **PascalCase** for components: `DashboardCard.tsx`, `SurveyStats.tsx`
- **camelCase** for variables/functions: `getCounts()`, `updateCounter()`
- **UPPER_SNAKE_CASE** for constants: `BACKEND_API_URL`, `POLL_INTERVAL`

### Imports
- Use absolute imports with `@/` prefix for frontend, `@/` for backend
- Group: builtin → external → internal → parent → sibling → index
- No deep relative paths (e.g., `../../../../utils/`)

### TypeScript
- Strict mode enabled globally
- No `any` unless documented with JSDoc reason
- Prefer `interface` over `type` for object shapes
- Use `type` for unions, intersections, and primitives
- Explicit return types on public API functions

### Validation
- All external input validated with Zod schemas
- Environment variables validated at app startup
- Webhook payloads validated before processing

## Sensitive Points

1. **Firebase transactions**: `qr-scan` and `zoho-webhook` use `transaction()` for atomic writes. Do NOT change to `set()` or `update()` without evaluating concurrency risks.
2. **Survey counts structure**: `survey_counts/{ scanned, completed }` is shared between all endpoints. Changes break both backend and frontend.
3. **CORS configuration**: All endpoints use `Access-Control-Allow-Origin: *`. Acceptable for GitHub Pages + Vercel, but restrict for production.
4. **Webhook security**: `zoho-webhook` has no HMAC verification. Any client can POST to increment counters.

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all apps |
| `pnpm lint` | Lint all apps |
| `pnpm test` | Run all tests |
| `pnpm format` | Format all files with Prettier |
| `turbo type-check` | Run TypeScript type checking |

## AI Agent Constraints

- Do NOT modify Firebase initialization pattern without creating a shared module first
- Do NOT change `survey_counts` DB structure without updating ALL consumers
- Do NOT add new packages without running `pnpm install` afterward
- Always run `turbo type-check` after modifying TypeScript files
- Keep feature modules self-contained — do not centralize logic in shared/
