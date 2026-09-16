# survey-tracker

Sistema de monitoreo en tiempo real para encuestas de satisfacción universitaria. Rastrea escaneos QR y respuestas completadas mediante una arquitectura serverless con dashboard web.

## URLs del proyecto

- **Dashboard:** https://universidad-de-lima.github.io/survey-tracker/
- **Encuesta Zoho:** https://survey.zohopublic.com/zs/ZKC54z
- **Backend (Vercel):** https://qr-smoky-theta.vercel.app

## Arquitectura

```
Usuario escanea QR
        │
        ▼
┌─────────────────┐     Redirige a encuesta Zoho
│ /api/qr-scan    │◄──────────────────────────────┐
│   (Vercel)      │                             │
└────────┬────────┘                             │
         │                                      │
         ▼                                      │
  Firebase RTDB                                 │
  survey_counts/                                │
  ├─ scanned: N                                 │
  └─ completed: N                               │
         ▲                                      │
         │                                      │
         │     Webhook Zoho                     │
         └────/api/zoho-webhook ────────────────┘
                   (Vercel)

Dashboard (GitHub Pages)
  │
  └─► Polling cada 5s a /api/get-counts
  └─► POST /api/reset-counts (botón)
```

## Stack tecnológico

| Capa | Tecnología | Plan |
|---|---|---|
| Frontend | React + Vite + TypeScript + Tailwind CSS | GitHub Pages (gratuito) |
| Backend | Node.js serverless (Vercel Functions) | Vercel Hobby (gratuito) |
| Base de datos | Firebase Realtime Database | Spark (gratuito) |
| Encuestas | Zoho Survey | Pagado (único costo) |
| CI/CD | GitHub Actions | Gratuito |

## Estructura del proyecto

```
survey-tracker/
├── .github/workflows/        # CI/CD: lint, test, build, deploy, security
├── apps/
│   ├── backend/              # Serverless API (Vercel)
│   │   ├── api/              # Endpoints
│   │   │   ├── get-counts.js
│   │   │   ├── qr-scan.js
│   │   │   ├── reset-counts.js
│   │   │   └── zoho-webhook.js
│   │   ├── lib/              # Utilidades compartidas
│   │   │   └── firebase.js   # Inicialización de Firebase Admin
│   │   ├── api/__tests__/    # Tests unitarios
│   │   ├── .env.example
│   │   ├── package.json
│   │   └── vercel.json
│   └── frontend/             # Dashboard React + Vite
│       ├── src/              # Aplicación React
│       ├── public/           # Assets estáticos
│       ├── index.html
│       ├── package.json
│       └── vite.config.ts
├── packages/
│   ├── eslint-config/        # Configuración compartida de ESLint
│   ├── shared-types/         # Tipos TypeScript compartidos
│   └── tsconfig/             # Configuraciones TypeScript compartidas
├── docs/api/                 # Documentación de endpoints
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Variables de entorno

### Backend (`apps/backend/.env`)

```env
# Firebase Admin SDK
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"..."}'
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com

# Zoho
ZOHO_SURVEY_URL=https://survey.zohopublic.com/zs/ZKC54z
ZOHO_WEBHOOK_SECRET=your-secure-random-secret

# Environment
NODE_ENV=production
```

### Frontend (build time)

Configurar en el repositorio de GitHub como variable `VITE_API_BASE_URL`:

```
VITE_API_BASE_URL=https://qr-smoky-theta.vercel.app/api
```

## Configuración del webhook de Zoho Survey

1. En Zoho Survey, ir a **Integraciones → Webhook**.
2. Configurar la URL del webhook:
   ```
   https://qr-smoky-theta.vercel.app/api/zoho-webhook
   ```
3. Agregar un header personalizado:
   ```
   X-Webhook-Secret: <ZOHO_WEBHOOK_SECRET>
   ```
4. El valor debe coincidir exactamente con la variable de entorno `ZOHO_WEBHOOK_SECRET` en Vercel.
5. Evento recomendado: `response_completed`.

El backend valida el header `X-Webhook-Secret` y rechaza cualquier request que no coincida (HTTP 401).

## Endpoints de la API

Ver [docs/api/README.md](./docs/api/README.md) para el detalle completo.

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api/qr-scan` | Registra un escaneo y redirige a la encuesta Zoho |
| POST | `/api/zoho-webhook` | Recibe notificación de encuesta completada |
| GET | `/api/get-counts` | Retorna contadores actuales |
| POST | `/api/reset-counts` | Reinicia contadores a cero |

## Seguridad e idempotencia

- **Webhook protegido:** requiere header `X-Webhook-Secret`.
- **Idempotencia:** cada `response_id` de Zoho se registra en `processed_responses/` para evitar conteos duplicados si Zoho reintenta el webhook.
- **Sanitización:** los `response_id` se limpian antes de usarse como claves de Firebase RTDB.

## Desarrollo

```bash
# Instalar dependencias
pnpm install

# Desarrollo frontend
pnpm --filter @survey-tracker/frontend dev

# Desarrollo backend (Vercel CLI)
pnpm --filter @survey-tracker/backend dev:vercel

# Lint
pnpm lint

# Type check
pnpm exec turbo type-check

# Tests
pnpm test

# Build frontend
pnpm --filter @survey-tracker/frontend build
```

## Despliegue

- **Backend:** se despliega automáticamente en Vercel al hacer push a `main` (configurar integración Vercel).
- **Frontend:** GitHub Actions ejecuta build y despliega a GitHub Pages cuando cambian archivos de `apps/frontend/` o `packages/`.

## Límites y consideraciones

El proyecto está diseñado para funcionar dentro de los planes gratuitos:

| Servicio | Límite gratuito relevante |
|---|---|
| Vercel Hobby | ~125.000 invocaciones serverless/mes |
| Firebase RTDB Spark | 100 conexiones simultáneas, 1 GB descargado/mes |
| GitHub Pages | 1 GB almacenamiento, 100 GB bandwidth/mes |

Para **~250 encuestas/día**, la carga es muy baja. El dashboard usa polling cada 5 segundos, lo cual es razonable para un número moderado de espectadores simultáneos.

## Licencia

© Universidad de Lima. Todos los derechos reservados.
