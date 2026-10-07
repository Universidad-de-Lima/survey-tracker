# Servidor local (sin Vercel)

Corre el portal de encuestas y el intérprete de IA **en la propia PC del usuario**, en horario
laboral, sin depender de Vercel. El servidor es Node puro: **no tiene dependencias npm** (solo
módulos estándar) y sirve tres cosas:

1. Los archivos estáticos del portal de `survey-test` (`zoho-survey/`).
2. `POST /api/interpretar`, reutilizando el mismo handler que corre en Vercel
   (`apps/backend/api/interpretar.js`), sin duplicar ni reescribir la lógica de la IA.
3. `POST /api/subir-csv`: recibe el CSV de Zoho desde el botón «Subir datos» del
   portal, lo guarda en `entradas/` y, si el nombre corresponde a una encuesta
   conocida, lo copia a `data/` con el nombre canónico y ejecuta el proceso del
   portal (`actualizar-portal.sh`), que publica en `sitio/`.

Requiere **Node 26** (probado con Node ≥ 18) y funciona detrás de la red interna de la
universidad. No hace falta ser administrador.

## 1. El archivo de configuración (fuera de todo repositorio)

La clave de la IA y las rutas viven en un archivo `.env` **fuera de todo repositorio** (y fuera de
Documentos/Escritorio), en la carpeta del usuario:

```
C:\Users\jloayzac\portal-survey\ia.env
```

Contenido exacto (tres líneas):

```env
GOOGLE_API_KEY=<tu-clave-aqui>
SITIO_DIR=Q:\ANALISTA DE DATOS\1. GitHub\survey-test\zoho-survey
PUERTO=8000
```

Nunca se versiona ni se imprime la clave.

`SITIO_DIR` y `PUERTO` son opcionales: si no están, el servidor usa la carpeta del portal de
`survey-test` (buscándola junto al repo) y el puerto `8000`. Si `SITIO_DIR` no apunta a una
carpeta existente, el servidor arranca pero avisa con un error claro.

## 2. Comando de arranque

```bash
node --env-file="C:\Users\jloayzac\portal-survey\ia.env" apps/backend/servidor-local.js
```

Node 26 lee el `.env` con `--env-file`. Al arrancar escribe **una sola línea** con las
direcciones de escucha y la carpeta servida, por ejemplo:

```
Portal disponible en http://localhost:8000  |  http://172.16.19.224:8000 — carpeta servida: Q:\...\survey-test\zoho-survey
```

## 3. Arranque automático (oculto) con un `.vbs`

El usuario lanza el servidor al iniciar sesión con un `.vbs` que se coloca en su carpeta de
Inicio y no muestra ninguna ventana. Ver el archivo entregado `iniciar-portal.vbs`.

## 4. Cómo probarlo

1. En la PC servidor, abrir en el navegador: **http://localhost:8000/**
2. Desde **otra PC de la red interna**: **http://172.16.19.224:8000/**
3. Comprobar la IA: usar el asistente de preguntas del portal (sección del ítem 1.9) o:

```bash
curl -X POST http://172.16.19.224:8000/api/interpretar \
  -H "Content-Type: application/json" \
  -d '{"pregunta":"¿Cuántos respondieron en 2026-1?","paso":"plan"}'
```

Si falta `GOOGLE_API_KEY`, la petición responde un error claro (no se cuelga) indicando que hay
que configurarla.

## Rutas y tipos

| Ruta | Método | Respuesta |
|---|---|---|
| `/` | GET | `index.html` del portal |
| `/…` (archivo) | GET | El archivo con su MIME; 404 claro si no existe |
| `/carpeta/` | GET | Solo si trae `index.html`; si no, 404 (no lista directorios) |
| `/api/interpretar` | POST | Reutiliza el handler de Vercel; 400 si el cuerpo no es JSON, 405 si no es POST, 500 claro si falta la clave |
| `/api/subir-csv` | POST | Guarda el CSV en `entradas/`; con un nombre aceptado lo copia a `data/` y ejecuta el proceso del portal (200 con los números nuevos; 400 nombre desconocido o sin `ID de respuesta`, 409 si ya hay una actualización en curso, 413 si supera el tope, 500 si el proceso falla) |

Extensiones con MIME propio: `.html .css .js .json .svg .png .jpg .jpeg .woff .woff2 .ico .txt`.

## Subida de CSV (botón «Subir datos»)

El portal manda el CSV en crudo a `POST /api/subir-csv` (el nombre original, opcional, va en
`?nombre=`). El servidor lo guarda en `entradas/` con un nombre único con fecha y hora que nunca
sobrescribe, y **reconoce la encuesta por el NOMBRE del archivo**:

- **Nombres aceptados** (los CSV de `data/`; ver `ENCUESTAS_CONOCIDAS` en `servidor-local.js`):
  - `ENCUESTA DE SATISFACCIÓN ESTUDIANTIL - PREGRADO - 2025-2.csv`
  - `ENCUESTA DE SATISFACCIÓN ESTUDIANTIL - PREGRADO - 2026-1.csv`
  - `ENCUESTA DE SATISFACCIÓN ESTUDIANTIL - PREGRADO - 2026-2.csv`
  - `ENCUESTA DE SATISFACCIÓN DOCENTE - PREGRADO - 2026.csv`
  - `ENCUESTA DE SATISFACCIÓN GRADUADOS - PREGRADO - 2026.csv`
  - `ENCUESTA DE SATISFACCIÓN NO DOCENTE - 2026.csv`
- Con un nombre aceptado, copia el CSV a `data/` con ese nombre canónico y ejecuta el proceso
  (`PROCESO_CMD`; por defecto `C:/Users/jloayzac/portal-survey/actualizar-portal.sh`), que
  publica en `sitio/`. La respuesta trae los números nuevos (`numeros`: período, encuestados,
  NPS (Net Promoter Score), CSAT (Customer Satisfaction Score)).
- Con cualquier otro nombre responde **400** con `nombres_aceptados` y no procesa nada.
- Una subida a la vez: mientras el proceso corre, otra subida responde **409**. El tope del
  proceso se ajusta con `PROCESO_TIMEOUT_MS` (30 min por defecto).

Variables de entorno opcionales: `ENTRADAS_DIR`, `DATA_DIR`, `PROCESO_CMD`, `PROCESO_TIMEOUT_MS`
y `SUBIR_CSV_MAX_BYTES` (10 MB por defecto).

## Seguridad

- La clave se lee de `process.env.GOOGLE_API_KEY` y **nunca** se imprime ni se guarda en el repo.
- El servidor resuelve las rutas dentro de `SITIO_DIR`: no se puede salir con `..`.
- No hay listado de directorios.
