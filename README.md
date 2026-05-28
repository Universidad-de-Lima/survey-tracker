# survey-tracker

Sistema de monitoreo en tiempo real para encuestas de satisfacción universitaria. Rastrea escaneos QR y respuestas completadas mediante una arquitectura serverless con dashboard web.

## Architecture

```
┌──────────────┐     QR Scan      ┌──────────────────┐
│   Usuario     │ ──────────────> │  Vercel API       │
│ (QR escaneado)│                 │  /api/qr-scan.js  │
└──────────────┘                  └────────┬─────────┘
                                           │
                                           ▼
                                   ┌──────────────────┐
                                   │  Firebase RTDB    │
                                   │ survey_counts/    │
                                   │  ├ scanned: N     │
                                   │  └ completed: N   │
                                   └────────┬─────────┘
                                           │
┌──────────────┐     Webhook      ┌────────┴─────────┐
│   Zoho Survey │ ──────────────> │  Vercel API       │
│ (respuesta)   │                 │ /api/zoho-webhook │
└──────────────┘                  └──────────────────┘

┌──────────────────────────┐      GET /api/get-counts
│  GitHub Pages Dashboard   │ <─────────────────────────┐
│  (polling cada 5s)        │                           │
│  ├ Escaneos Totales       │                           │
│  ├ Encuestas Completadas  │                           │
│  └ Pendientes             │                           │
└──────────────────────────┘                           │
        │                                              │
        └──────────────────────────────────────────────┘
```

## Migration Status

| Fase | Estado | Descripción |
|------|--------|-------------|
| FASE 1 | ✅ Completa | Monorepo + pnpm + Turbo + TypeScript base + ESLint + Prettier + Husky |
| FASE 2 | 🔄 Pendiente | Frontend: Vite + React + TanStack Query + Feature-Based Architecture |
| FASE 3 | ⏳ Pendiente | Backend: Fastify + Clean Architecture + Prisma + PostgreSQL |
| FASE 4 | ⏳ Pendiente | Testing: Vitest + Testing Library + Playwright + Supertest |
| FASE 5 | ⏳ Pendiente | CI/CD: GitHub Actions workflows |
| FASE 6 | ⏳ Pendiente | Observabilidad + Seguridad + Performance |

## Repository Structure

```
survey-tracker/
├── apps/
│   ├── backend/              # Serverless API (Vercel) → Migrating to Fastify
│   │   ├── api/              # Current serverless endpoints (JS)
│   │   │   ├── get-counts.js     # GET: retorna contadores actuales
│   │   │   ├── qr-scan.js        # GET: registra escaneo y redirige a Zoho
│   │   │   └── zoho-webhook.js   # POST: recibe notificación de encuesta completada
│   │   ├── src/              # Future Fastify backend (TypeScript)
│   │   ├── package.json
│   │   └── vercel.json
│   └── frontend/             # Dashboard → Migrating to React + Vite
│       ├── public/           # Current static files (HTML/CSS/JS)
│       └── src/              # Future React app (TypeScript)
├── packages/
│   ├── ui/                   # Shared UI components (future)
│   ├── shared-types/         # Shared TypeScript types
│   ├── eslint-config/        # Shared ESLint configuration
│   └── tsconfig/             # Shared TypeScript configurations
├── .github/workflows/        # CI/CD pipelines
├── .vscode/                  # VS Code configuration & agents instructions
├── docs/                     # Architecture, API, and decision records
├── infrastructure/           # Docker, deployment configs
├── scripts/                  # Build and utility scripts
├── tests/                    # E2E and integration tests
├── package.json              # Monorepo root (pnpm workspace)
├── pnpm-workspace.yaml       # Workspace configuration
├── turbo.json                # Turborepo pipeline
└── README.md
```

## Tech Stack

| Componente | Tecnología | Rol |
|-----------|-----------|-----|
| Runtime Backend | Node.js 18+ (Vercel) | Ejecución serverless |
| Firebase Admin SDK | v11.x | Acceso a Realtime Database |
| Base de datos | Firebase Realtime Database | Almacén de contadores en tiempo real |
| Frontend | HTML5 + CSS3 + JavaScript ES6 | Dashboard estático |
| Estilos | Tailwind CSS (CDN) | Framework CSS utility-first |
| Despliegue Backend | Vercel (serverless functions) | Hosting de APIs |
| Despliegue Frontend | GitHub Pages | Hosting estático |

## Data Flow

### 1. Registro de Escaneo QR
1. Usuario escanea código QR que apunta a `/api/qr-scan`
2. `qr-scan.js` incrementa `survey_counts/scanned` en Firebase (transacción atómica)
3. Servidor redirige (302) al usuario a `ZOHO_SURVEY_URL`

### 2. Registro de Encuesta Completada
1. Zoho Survey envía POST a `/api/zoho-webhook` con `response_status: COMPLETED`
2. `zoho-webhook.js` valida payload y incrementa `survey_counts/completed` en Firebase

### 3. Dashboard
1. `app.js` realiza polling GET a `/api/get-counts` cada 5 segundos
2. Recibe `{ scanned: number, completed: number }`
3. Calcula `pending = scanned - completed`
4. Actualiza contadores con animación CSS

## Dependencies

| Paquete | Versión | Propósito |
|---------|---------|-----------|
| `firebase-admin` | ^11.0.0 | SDK de administración para Firebase RTDB |
| `vercel` (dev) | ^32.0.0 | CLI de despliegue Vercel |

## Configuration

### Variables de Entorno (Vercel)

| Variable | Descripción |
|----------|-------------|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | JSON completo de cuenta de servicio Firebase (minificado a una línea) |
| `FIREBASE_DATABASE_URL` | URL de Firebase Realtime Database |
| `ZOHO_SURVEY_URL` | URL de redirección después del escaneo QR |

### Despliegue Frontend
- Sirve estáticamente desde `frontend/public/`
- Compatible con GitHub Pages sin configuración adicional
- La URL del backend se configura en `frontend/public/js/app.js` como `BACKEND_API_URL`

## Technical Debt

1. **Inicialización duplicada de Firebase** — `firebase-admin` se inicializa idénticamente en los 3 endpoints con el mismo bloque condicional (`if (!admin.apps.length)`). Refactorizar a un módulo compartido.
2. **URL del backend hardcodeada** — `BACKEND_API_URL` en `app.js` es una constante fija. No permite configuración por entorno sin modificar el código fuente.
3. **Sin autenticación en webhook** — El endpoint `zoho-webhook` no valida que la solicitud provenga legítimamente de Zoho (sin verificación HMAC o token).
4. **Polling vs WebSocket** — El frontend usa polling cada 5s. Para actualización instantánea, Firebase Realtime Database ofrece listeners en tiempo real que no se están utilizando.
5. **Sin manejo de errores en UI** — El dashboard no muestra estado de error al usuario si el backend no responde.

## Improvement Opportunities

- Extraer inicialización de Firebase a un módulo compartido (`backend/lib/firebase.js`)
- Implementar Firebase Realtime Database listeners en frontend para eliminar polling
- Agregar verificación de webhook (HMAC signature) para seguridad
- Usar variables de entorno en build time para configurar `BACKEND_API_URL`
- Agregar tests unitarios para cada endpoint
- Agregar logging estructurado

## AI Agent Notes

- **Punto sensible**: Los endpoints `qr-scan.js` y `zoho-webhook.js` usan `transaction()` de Firebase, que es atómico pero tiene implicaciones de concurrencia.
- **Convención**: Cada archivo de API es un módulo serverless autocontenido que exporta `async (req, res) => {}`.
- **Riesgo**: Modificar la estructura de `survey_counts` en Firebase rompe tanto backend como frontend simultáneamente.
- **Deploy**: Backend requiere `vercel.json` con rutas explícitas. Frontend es estático puro.
- **CORS**: Todos los endpoints habilitan CORS con `*`, permitiendo acceso desde cualquier origen.
