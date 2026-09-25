# survey-tracker

Sistema de monitoreo en vivo para las encuestas de satisfacción de la Universidad de Lima.
El alumno escanea un QR proyectado en el salón y el panel muestra, en el acto, cuántos
escanearon, cuántos terminaron y cuántos quedan **pendientes** — para que el encuestador sepa
cuándo puede pasar al siguiente salón.

## URLs del proyecto

- **Panel (es lo que se proyecta en el salón):** https://universidad-de-lima.github.io/survey-tracker/
- **Backend:** https://encuesta-pregrado.vercel.app
- **Encuesta (Zoho Survey):** https://survey.zohopublic.com/zs/IWC2X9

## Cómo funciona

```
              QR FIJO (el mismo toda la campaña, se proyecta)
                          │
                          ▼
                   /api/qr-scan ──── cuenta el escaneo ──► redirige a la encuesta de Zoho
                          │
                          ▼
              el alumno responde y pulsa ENVIAR
                          │
                          ▼
                   /api/done ──── cuenta la finalización ──► «¡Gracias!»
                          ▲
                          │
   PANEL PROYECTADO ── lee /api/get-counts cada 5 s
                     └─ botón RESET ──► /api/reset-counts
```

En Firebase Realtime Database hay **un único contador**:

```
sessions/default/scanned      escaneos
sessions/default/completed    encuestas terminadas
```

`pending` (= `scanned − completed`) lo calcula el servidor y lo devuelve ya resuelto.

## Stack tecnológico

| Capa | Tecnología | Plan |
|---|---|---|
| Panel | React + Vite + TypeScript + Tailwind CSS | GitHub Pages (gratuito) |
| Backend | Node.js serverless (Vercel Functions) | Vercel Hobby (gratuito) |
| Contador | Firebase Realtime Database | Spark (gratuito) |
| Encuesta | Zoho Survey | Plan contratado por la Universidad |

## El QR

- Es **uno solo y fijo**: `https://encuesta-pregrado.vercel.app/api/qr-scan`.
- **Apunta al contador, no directamente a Zoho.** Ese salto es lo que permite contar el
  escaneo: sin él no se cuenta nada.
- Lo genera `scripts/generar_qr.py` en cada despliegue del frontend y queda publicado en
  `https://universidad-de-lima.github.io/survey-tracker/qr/encuesta.png`, que es lo que el
  panel muestra en pantalla. No hay que generarlo ni subirlo a mano.

## Cada escaneo cuenta

**No hay deduplicación**: si un mismo celular escanea dos veces, **suma dos**. Se pidió así
para que el contador refleje directamente lo que ocurre en el salón, sin nada por detrás.

Consecuencia a tener en cuenta: si alguien escanea de más, «Pendientes» puede quedarse por
encima de cero aunque ya hayan terminado todos. El encuestador lo resuelve pulsando `RESET`
cuando comprueba que ya no queda nadie respondiendo.

## Reset

El botón `RESET` del panel pone el contador a cero para el siguiente salón: **sólo eso**, no
toca nada más. **No lleva clave** a propósito: del toque accidental protege la confirmación del
propio botón, y el riesgo que queda (que alguien encuentre la URL) sólo descuadraría un número
en pantalla — las respuestas están a salvo en Zoho y se ve al instante.

## Configuración en Zoho

Una sola cosa, **en la encuesta a la que apunta el QR** (`survey.zohopublic.com/zs/IWC2X9`):

**CONFIGURACIÓN → Página final de la encuesta → «Redirigir a nueva página»**

```
https://encuesta-pregrado.vercel.app/api/done
```

Sin parámetros ni cabeceras. Cuando el alumno pulsa ENVIAR, Zoho lo redirige aquí, se cuenta
la finalización y ve un mensaje de agradecimiento. Si esto no está configurado, «Escanearon»
sube pero «Terminaron» se queda en cero.

### Restricciones de Zoho

**No se usa ninguna.** En **Publicar → Restricciones → Restricciones de respuesta**, Zoho
permite limitar a una respuesta por **IP** o por **dispositivo (cookie)**, y las dos están
**desactivadas** a propósito.

El motivo es el salón: muchos alumnos comparten la misma conexión (la red del aula o los datos
del propio celular), así que cualquiera de las dos opciones bloquearía a alumnos que **sí** deben
responder. Un bloqueo así no muestra ningún mensaje: se nota en el contador, porque
«Escanearon» sube y «Terminaron» se queda corto.

Antes de activar cualquier restricción, comprobar con **varios celulares a la vez** que todos
pueden responder.

## Antes de pasar a producción — lista de comprobación

- [ ] Configurar la redirección de la página final en Zoho (`/api/done`).
- [ ] Comprobar en Zoho que **no** haya ninguna restricción de respuestas activada.
- [ ] Probar con **varios celulares a la vez** que todos pueden responder.
- [ ] Pulsar `RESET` para dejar el contador en cero antes del primer salón.
- [ ] Proyectar el panel en un salón real y comprobar que el QR se lee desde las últimas filas.
- [ ] Acordar quién pulsa `RESET` y con qué criterio («Pendientes» = 0).

## Endpoints de la API

Detalle completo en [docs/api/README.md](./docs/api/README.md).

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api/qr-scan` | Cuenta el escaneo y redirige a la encuesta de Zoho |
| GET | `/api/done` | Cuenta la finalización (lo llama Zoho desde la página final) |
| GET | `/api/get-counts` | Devuelve los contadores actuales |
| POST | `/api/reset-counts` | Pone los contadores a cero |
| GET | `/api/health` | Igual que `get-counts`: comprueba de un vistazo que el backend responde |
| POST | `/api/procesar-encuesta` | Lo llama el portal para pedir la actualización de datos |

## Estructura del proyecto

```
survey-tracker/
├── .github/workflows/            # CI (lint, tipos, tests, build) y despliegue del panel
├── apps/
│   ├── backend/
│   │   ├── api/
│   │   │   ├── qr-scan.js          # cuenta el escaneo y redirige
│   │   │   ├── done.js             # cuenta la finalización + página de gracias
│   │   │   ├── get-counts.js       # contadores para el panel
│   │   │   ├── reset-counts.js     # botón RESET
│   │   │   └── procesar-encuesta.js # pide al portal que actualice sus datos
│   │   ├── lib/
│   │   │   ├── firebase.js       # Firebase Admin + incremento atómico
│   │   │   └── sessions.js       # rutas de la sesión y cálculo de contadores
│   │   └── vercel.json           # enrutado de los endpoints
│   └── frontend/                 # Panel React + Vite
│       └── src/features/dashboard/
├── scripts/generar_qr.py         # genera el QR fijo en cada despliegue
├── docs/api/                     # Documentación de endpoints
└── packages/                     # Configuración y tipos compartidos
```

## Variables de entorno

### Backend (Vercel)

```env
# Firebase Admin SDK
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"..."}'
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com

# Zoho: a dónde se redirige al alumno después de escanear el QR.
ZOHO_SURVEY_URL=https://survey.zohopublic.com/zs/IWC2X9

# Llave de GitHub que usa /api/procesar-encuesta para pedir la actualización del portal.
# Permisos: Contents Read and write sobre `survey-test` (+ Actions Read-only, opcional).
GITHUB_DISPATCH_TOKEN=ghp_...

# Environment
NODE_ENV=production
```

El contador no tiene ninguna clave: el reset no la pide y Zoho se conecta por la redirección de
la página final, sin cabeceras. La única llave es la del proceso del portal, y vive solo aquí:
el navegador nunca la ve.

### Panel

**No hay que definir ninguna variable.** La dirección del backend está escrita en el propio
código (`apps/frontend/src/shared/validators/env.ts`), y es la que usan tanto el panel como el
generador del QR.

> **No definas `VITE_API_BASE_URL` en GitHub.** El flujo de despliegue le añade `/api/qr-scan`
> por su cuenta, así que definirlo genera un QR que apunta a `.../api/api/qr-scan`, que no
> funciona. Si cambia la dirección del backend se cambia en el código: `env.ts` (panel) y
> `scripts/generar_qr.py` (QR).

## Desarrollo

```bash
pnpm install
pnpm --filter @survey-tracker/frontend dev
pnpm lint
pnpm test
pnpm exec turbo type-check
pnpm --filter @survey-tracker/frontend build
```

## Despliegue

- **Backend:** Vercel lo despliega al hacer push a `main`.
- **Panel:** GitHub Actions construye y publica en GitHub Pages cuando cambia algo de
  `apps/frontend/`, `packages/`, `scripts/` o el propio workflow. En ese mismo proceso se
  regenera el QR.

> **Aviso:** `apps/backend/vercel.json` declara las rutas **una a una**. Un endpoint nuevo
> que no se añada ahí se compila pero devuelve **404**, y ni el CI ni Vercel avisan.

## Límites y consideraciones

| Servicio | Límite gratuito | Uso real |
|---|---|---|
| Vercel Hobby | 1.000.000 invocaciones/mes | ~30.000/mes (**3 %**) |
| Firebase RTDB Spark | 1 GB almacenado · 10 GB descargado/mes | ~0,15 % |
| GitHub Pages | 1 GB almacenamiento · 100 GB tráfico/mes | despreciable |

Medición con **un salón entero a la vez** (60 escaneos y 60 finalizaciones simultáneas, con el
panel consultando en paralelo): **120/120 correctas**, sin errores, con la mitad resueltas en
menos de un segundo.

El contador consulta Firebase por su vía REST, así que **no gasta las 100 conexiones
simultáneas** de Spark: ese límite es para las aplicaciones que se conectan y se quedan
escuchando. El recurso que sí conviene vigilar es el **tiempo de procesamiento**, y quien lo
consume no son los alumnos sino el panel, que consulta cada 5 segundos mientras está abierto.
Cerrarlo entre salones (o subirlo a 10 segundos) deja una campaña en una fracción pequeña del
límite gratuito.

## Licencia

© Universidad de Lima. Todos los derechos reservados.
