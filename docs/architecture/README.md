# Architecture

## System Overview

```
┌──────────────┐     QR Scan      ┌───────────────────┐
│   Usuario     │ ──────────────> │  apps/backend       │
│ (QR escaneado)│                 │  /api/qr-scan      │
└──────────────┘                  └─────────┬──────────┘
                                            │
                                            ▼
                                    ┌──────────────────┐
                                    │  Firebase RTDB    │
                                    │ survey_counts/    │
                                    │  ├ scanned: N     │
                                    │  └ completed: N   │
                                    └────────┬─────────┘
                                            │
┌──────────────┐     Webhook      ┌─────────┴──────────┐
│   Zoho Survey │ ──────────────> │  apps/backend       │
│ (respuesta)   │                 │ /api/zoho-webhook   │
└──────────────┘                  └────────────────────┘

┌──────────────────────────┐      GET /api/get-counts
│  apps/frontend (Vite SPA) │ <─────────────────────────┐
│  (React + TanStack Query) │                           │
│  ├ Escaneos Totales       │                           │
│  ├ Encuestas Completadas  │                           │
│  └ Pendientes             │                           │
└──────────────────────────┘                           │
        │                                              │
        └──────────────────────────────────────────────┘
```

## Architecture Decisions

See `docs/decisions/` for Architecture Decision Records (ADRs).

## Current Architecture

- **Monorepo**: pnpm workspace + Turborepo
- **Frontend**: Static HTML/CSS/JS → Migrating to React + Vite
- **Backend**: Node.js serverless functions (Vercel) → Migrating to Fastify
- **Database**: Firebase Realtime Database (current) → PostgreSQL + Prisma (planned)
- **Deployment**: Vercel (backend) + GitHub Pages (frontend)
