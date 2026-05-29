# Frontend — Dashboard de Monitoreo (GitHub Pages)

Dashboard web estático que muestra en tiempo real los contadores de escaneos QR y encuestas completadas. Desplegado en GitHub Pages.

## Purpose

Proveer una interfaz visual para monitorear el progreso de una encuesta de satisfacción, mostrando:
- Escaneos totales (personas que escanearon el QR)
- Encuestas completadas (personas que terminaron la encuesta)
- Encuestados pendientes (diferencia entre escaneos y completados)

## Architecture Role

Capa de presentación del sistema `survey-tracker`. Frontend vanilla (sin framework) que consume datos del backend serverless mediante polling HTTP.

## Key Files

| Ruta | Propósito |
|------|-----------|
| `public/index.html` | Página principal con layout del dashboard |
| `public/js/app.js` | Lógica de polling, animación de contadores, manejo de respuestas |
| `public/css/style.css` | Estilos adicionales a Tailwind CSS |
| `public/assets/Logo.png` | Logotipo institucional |
| `public/assets/QRCode.png` | Código QR de la encuesta |
| `public/assets/favicon.png` | Favicon del sitio |

## Data Flow

```
app.js ──GET cada 5s──> /api/get-counts ──> Firebase RTDB
    <── { scanned, completed }
    │
    ├── Actualiza #totalScans (con animación)
    ├── Actualiza #completedSurveys (con animación)
    └── Calcula pending = scanned - completed
         └── Actualiza #pendingRespondents (con animación)
```

## Execution Flow

1. `index.html` se carga → muestra valores iniciales en 0
2. `app.js` se ejecuta inmediatamente:
   - Llama `updateCounters()` (primera carga)
   - Configura `setInterval(updateCounters, 5000)` (polling cada 5s)
3. Cada ciclo de polling:
   - Fetch a `BACKEND_API_URL`
   - Compara valores actuales con anteriores
   - Si hay cambios: anima contador + muestra indicador visual
   - Calcula pendientes

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
| Tailwind CSS (CDN) | CSS framework | Estilos utility-first (vía CDN en `<script>`) |
| Backend API (Vercel) | Externa | Fuente de datos (`BACKEND_API_URL`) |

## Configuration

- **Backend URL**: Configurada en `public/js/app.js` como constante `BACKEND_API_URL`
- **Polling interval**: 5000ms (5 segundos), configurado en `setInterval()`
- **Animation duration**: 1000ms, configurado en `animateCounter()`
- **Indicator visibility**: 3000ms para el indicador de nueva respuesta

## Future Architecture (React + Vite + Feature-Based)

El frontend está siendo migrado de HTML/CSS/JS estático a una SPA React con arquitectura feature-based.

### Nueva Estructura

```
src/
├── app/               # App shell
│   ├── App.tsx        # Root component with providers
│   └── layouts/       # MainLayout, Header, Footer
├── features/          # Feature modules (autónomos)
│   ├── dashboard/     #   pages, components, hooks, services, types
│   ├── qr/            #   (future)
│   ├── surveys/       #   (future)
│   └── analytics/     #   (future)
├── shared/            # Cross-cutting concerns
│   ├── components/    #   ErrorBoundary, UI primitives
│   ├── hooks/         #   Shared hooks
│   ├── services/      #   api client
│   ├── utils/         #   counterAnimation
│   ├── validators/    #   env validation (Zod)
│   └── types/         #   Shared types
├── assets/            # Static assets (imported by Vite)
├── styles/            # Global CSS + Tailwind
└── test/              # Test setup
```

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
