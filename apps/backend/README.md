# Backend — Serverless API (Vercel)

Backend serverless para el sistema de monitoreo de encuestas. Expone 3 endpoints HTTP desplegados como funciones Vercel Node.js. Almacena contadores en Firebase Realtime Database.

## Purpose

Registrar escaneos QR entrantes, procesar webhooks de Zoho Survey, y proveer contadores agregados al frontend del dashboard.

## Architecture Role

Capa de servidor dentro del sistema `survey-tracker`. Actúa como intermediario entre el usuario (escaneo QR), Zoho Survey (webhook) y el dashboard frontend (polling).

## Stack

| Tecnología | Versión | Uso |
|-----------|---------|-----|
| Node.js | 18+ (Vercel runtime) | Runtime serverless |
| firebase-admin | ^11.0.0 | SDK de administración Firebase |
| Vercel CLI (dev) | ^32.0.0 | Deploy tooling |

## Endpoints

| Método | Ruta | Archivo | Propósito |
|--------|------|---------|-----------|
| GET | `/api/qr-scan` | `api/qr-scan.js` | Incrementa contador de escaneos y redirige a Zoho Survey |
| POST | `/api/zoho-webhook` | `api/zoho-webhook.js` | Recibe notificación de encuesta completada desde Zoho |
| GET | `/api/get-counts` | `api/get-counts.js` | Retorna `{ scanned, completed }` al frontend |
| POST | `/api/reset-counts` | Fastify `src/modules/reset/` | Resetea contadores a cero |

Para contratos detallados de cada endpoint, ver `api/README.md`.

## Data Flow

### Escaneo QR
```
Usuario ──GET──> /api/qr-scan ──transaction()──> Firebase: survey_counts/scanned++
                                              ──302──> ZOHO_SURVEY_URL
```

### Webhook Zoho
```
Zoho ──POST──> /api/zoho-webhook ──transaction()──> Firebase: survey_counts/completed++
     (body: { response_status: "COMPLETED", webhook_event: "response_completed" })
```

### Consulta de Contadores
```
Frontend ──GET──> /api/get-counts ──once("value")──> Firebase: survey_counts
              <── { scanned: number, completed: number }
```

### Reset de Contadores
```
Frontend ──POST──> /api/reset-counts ──set({ scanned:0, completed:0 })──> Firebase
                <── { message, previousCounts: { scanned, completed } }
```

## Dependencies

| Paquete | Propósito |
|---------|-----------|
| `firebase-admin` | Inicialización y operaciones sobre Firebase Realtime Database |
| `vercel` (dev) | CLI para deploy y desarrollo local |

## Configuration

### Variables de Entorno (Vercel)

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | string (JSON minificado) | Credenciales de cuenta de servicio Firebase |
| `FIREBASE_DATABASE_URL` | string (URL) | URL de Firebase Realtime Database |
| `ZOHO_SURVEY_URL` | string (URL) | URL de redirección post-escaneo QR |


### Configuración de Deploy (`vercel.json`)

```json
{
  "builds": [{ "src": "api/*.js", "use": "@vercel/node" }],
  "routes": [
    { "src": "/api/qr-scan", "dest": "api/qr-scan.js" },
    { "src": "/api/zoho-webhook", "dest": "api/zoho-webhook.js" },
    { "src": "/api/get-counts", "dest": "api/get-counts.js" }
  ]
}
```

## Future Architecture (Fastify + Clean Architecture)

El backend está siendo migrado de serverless functions (Vercel) a un servidor Fastify con Clean Architecture.

### Nueva Estructura

```
src/
├── config/          # Config (env, firebase)
├── modules/         # Feature modules (Clean Architecture)
│   ├── surveys/     #   controller → service → repository
│   ├── qr/          #   controller → service → repository
│   ├── webhooks/    #   controller → service → repository
│   └── reset/       #   controller → service → repository (reset counters)
├── middleware/      # CORS, rate-limit, error-handler
├── shared/          # Errors, logger, utils
├── database/        # Prisma schema (future PostgreSQL)
├── app.ts           # Fastify app builder
└── server.ts        # Entry point
```

### Capas por Módulo

| Capa | Responsabilidad |
|------|----------------|
| `*.routes.ts` | Definición de rutas HTTP |
| `*.controller.ts` | Manejo de request/response |
| `*.service.ts` | Lógica de negocio |
| `*.repository.ts` | Acceso a datos (Firebase/DB) |
| `*.schema.ts` | Validación Zod |
| `*.types.ts` | Tipos TypeScript |

### Contrato Clean Architecture
- Controller → Service → Repository → Database
- Controller NO contiene lógica de negocio
- Service NO conoce HTTP (no req/res)
- Repository solo conoce DB (Firebase/Prisma)

## Technical Debt

1. **Inicialización duplicada de Firebase** — El bloque `if (!admin.apps.length) { admin.initializeApp(...) }` se repite idéntico en los 3 endpoints. Debería extraerse a un módulo compartido (ej. `lib/firebase.js`).
2. **Sin verificación de webhook** — El endpoint `zoho-webhook` no valida HMAC ni token de Zoho. Cualquier cliente con la URL puede enviar POSTs que incrementen el contador.
3. **Manejo de errores genérico** — Todos los catch devuelven `500` con mensaje genérico. No hay diferenciación por tipo de error.
4. **Sin tests** — No hay pruebas unitarias ni de integración para los endpoints.

## AI Agent Notes

- **Convención**: Cada archivo en `api/` exporta `async (req, res) => {}` (formato Vercel serverless).
- **Firebase Realtime Database**: La estructura de datos es `survey_counts/{ scanned, completed }`. Es crítica para todo el sistema.
- **CORS**: Todos los endpoints usan `res.setHeader('Access-Control-Allow-Origin', '*')`. No hay restricción de origen.
- **Seguridad**: `qr-scan.js` acepta GET y POST. `zoho-webhook.js` solo acepta POST. `get-counts.js` solo acepta GET.
- **Riesgo de concurrencia**: `qr-scan.js` y `zoho-webhook.js` usan `transaction()` para evitar condiciones de carrera en escritura.
- **Package.json**: `"main"` apunta a `api/get-counts.js`. Esto es metadata, no afecta el deploy en Vercel.
