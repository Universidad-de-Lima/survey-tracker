# Frontend — Dashboard de Monitoreo (GitHub Pages)

Dashboard en React + Vite + TypeScript que muestra en tiempo real los contadores de escaneos QR y encuestas completadas. Desplegado en GitHub Pages.

## Purpose

Proveer una interfaz visual para monitorear el progreso de una encuesta de satisfacción, mostrando:
- Escaneos totales (personas que escanearon el QR)
- Encuestas completadas (personas que terminaron la encuesta)
- Encuestados pendientes (diferencia entre escaneos y completados)

## Architecture Role

Capa de presentación del sistema `survey-tracker`. SPA React que consume datos del backend serverless mediante polling HTTP con TanStack Query.

## Stack

| Tecnología | Versión | Uso |
|-----------|---------|-----|
| React | 18 | UI framework |
| TypeScript | 5.4 | Lenguaje tipado |
| Vite | 5 | Build tool |
| Tailwind CSS | 4 | Framework CSS |
| TanStack Query | 5 | Data fetching + polling |
| Zod | 3 | Validación de entorno |
| Vitest | 1.6 | Testing |
| Testing Library | 15 | Component testing |

## Key Files

| Ruta | Propósito |
|------|-----------|
| `src/app/App.tsx` | Root component con QueryClientProvider |
| `src/app/layouts/MainLayout.tsx` | Layout principal (Header + Footer) |
| `src/features/dashboard/pages/DashboardPage.tsx` | Página principal del dashboard |
| `src/features/dashboard/components/DashboardCard.tsx` | Card con contador animado |
| `src/features/dashboard/components/DashboardPanel.tsx` | Panel de 3 cards |
| `src/features/dashboard/components/QRCodeSection.tsx` | Sección del código QR |
| `src/features/dashboard/components/ResetButton.tsx` | Botón de reset de contadores |
| `src/features/dashboard/hooks/useSurveyCounts.ts` | Hook useQuery + useMutation |
| `src/features/dashboard/services/dashboardService.ts` | Llamadas API |
| `src/shared/services/api.ts` | Cliente HTTP genérico |
| `src/shared/validators/env.ts` | Validación de VITE_* con Zod |

## Data Flow

```
DashboardPage
  └── useSurveyCounts()       ← TanStack Query (polling 5s)
        └── fetchSurveyCounts()
              └── apiClient.get('/get-counts')
                    └── GET https://<vercel>/api/get-counts
                          └── Firebase RTDB: survey_counts
```

## Execution Flow

1. `Vite` bundle se sirve desde GitHub Pages con base `/survey-tracker/`
2. `DashboardPage` monta `useSurveyCounts` hook con polling cada 5s
3. Cada ciclo:
   - Fetch a `VITE_API_BASE_URL/get-counts`
   - Actualiza estado vía TanStack Query
   - `DashboardPanel` recibe nuevos counts y renderiza `DashboardCard`
   - Cada card anima el contador con `requestAnimationFrame`

## Reset de Contadores

El dashboard incluye un botón **"Resetear Contadores"** que permite reiniciar `scanned` y `completed` a cero.

**Flujo:**
1. Usuario hace clic en "Resetear Contadores" (botón negro debajo del QR)
2. Se muestra confirmación: "¿Resetear todos los contadores a cero?"
3. Al confirmar, se envía `POST /api/reset-counts`
4. En éxito: los contadores se actualizan automáticamente vía TanStack Query

## Dependencies

| Dependencia | Tipo | Propósito |
|------------|------|-----------|
| react + react-dom | Runtime | UI framework |
| @tanstack/react-query | Runtime | Data fetching + polling + mutations |
| @tanstack/react-query-devtools | Dev | Debug de queries |
| react-router-dom | Runtime | (futuro) Routing |
| zod | Runtime | Validación de entorno |
| @tailwindcss/vite | Build | Plugin Tailwind para Vite |
| @vitejs/plugin-react | Build | Plugin React para Vite |
| vite | Build | Bundler + dev server |
| typescript | Build | Type checking |
| vitest + @testing-library/react | Dev | Testing |

## Configuration

- **Backend URL**: `VITE_API_BASE_URL` (variable de entorno o default `https://qr-smoky-theta.vercel.app/api`)
- **Polling interval**: 5000ms (configurable vía `VITE_POLL_INTERVAL`)
- **Base path**: `/survey-tracker/` (para GitHub Pages)

## Estructura (Feature-Based)

```
src/
├── app/               # App shell
│   ├── App.tsx        # Root component with providers
│   └── layouts/       # MainLayout, Header, Footer
├── features/          # Feature modules (autónomos)
│   └── dashboard/     #   pages, components, hooks, services, types
├── shared/            # Cross-cutting concerns
│   ├── components/    #   ErrorBoundary
│   ├── services/      #   api client
│   ├── validators/    #   env validation (Zod)
│   └── styles/        #   Global CSS + Tailwind
├── assets/            # Static assets (QRCode.png)
└── test/              # Test setup
```

## Reset de Contadores

El dashboard incluye un botón **"Resetear Contadores"** (fondo negro, texto blanco) debajo del código QR.

**Flujo:**
1. Usuario hace clic en "Resetear Contadores"
2. Confirmación: "¿Resetear todos los contadores a cero?"
3. `POST /api/reset-counts` → Firebase resetea a 0
4. TanStack Query invalida la caché y actualiza automáticamente

### Stack

| Tecnología | Propósito |
|-----------|-----------|
| React 18 | UI library |
| Vite 5 | Build tool / dev server |
| TypeScript 5 | Type safety |
| Tailwind CSS 4 | Utility-first styling |
| TanStack Query 5 | Server state / polling |
| Zod 3 | Runtime validation |
| Vitest | Testing framework |
| Testing Library | Component testing |

## Technical Debt

1. **URL hardcodeada** — `BACKEND_API_URL` está fija en el código. No permite configuración por entorno (dev/prod).
2. **Sin manejo de errores en UI** — Si el backend falla, solo se loguea en consola. El usuario no recibe feedback visual.
3. **Polling ineficiente** — Consulta cada 5s incluso si la pestaña está inactiva. Podría usarse `requestAnimationFrame` con visibility API o Firebase listeners en tiempo real.
4. **Sin indicador de carga** — No hay estado "cargando" durante la primera solicitud ni en reconexiones.
5. **Valores iniciales hardcodeados** — Los contadores se inicializan en 0 en el HTML y también en JS.

## Improvement Opportunities

- Usar Firebase Realtime Database SDK en frontend con `on('value', ...)` en lugar de polling
- Agregar un WebSocket o Server-Sent Events si se elimina Firebase
- Implementar retry logic con backoff exponencial
- Agregar indicador de conectividad (online/offline)
- Parametrizar `BACKEND_API_URL` vía variable de build o atributo `data-*` en HTML

## AI Agent Notes

- **Framework**: Vanilla JS. No hay React, Vue ni SPA framework. Cambios de estado son manipulaciones directas del DOM.
- **Animaciones**: `animateCounter()` usa `requestAnimationFrame()` para transiciones suaves de 1 segundo.
- **Indicador visual**: `triggerNewResponseIndicator()` muestra un punto amarillo pulsante en las tarjetas cuando hay cambios.
- **Convención de nombres**: IDs de elementos HTML siguen el patrón `camelCase` (ej. `totalScans`, `completedSurveys`).
- **Backend URL**: La constante `BACKEND_API_URL` en `app.js` apunta a producción directo. Cambiar para entornos locales.
- **Sin dependencias de build**: No hay webpack, vite ni bundler. El código se sirve tal cual.
