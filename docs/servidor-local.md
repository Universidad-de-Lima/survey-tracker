# Servidor local (sin Vercel)

Corre el portal de encuestas y el intérprete de IA **en la propia PC del usuario**, en horario
laboral, sin depender de Vercel. El servidor es Node puro: **no tiene dependencias npm** (solo
módulos estándar) y sirve dos cosas:

1. Los archivos estáticos del portal de `survey-test` (`zoho-survey/`).
2. `POST /api/interpretar`, reutilizando el mismo handler que corre en Vercel
   (`apps/backend/api/interpretar.js`), sin duplicar ni reescribir la lógica de la IA.

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

Extensiones con MIME propio: `.html .css .js .json .svg .png .jpg .jpeg .woff .woff2 .ico .txt`.

## Seguridad

- La clave se lee de `process.env.GOOGLE_API_KEY` y **nunca** se imprime ni se guarda en el repo.
- El servidor resuelve las rutas dentro de `SITIO_DIR`: no se puede salir con `..`.
- No hay listado de directorios.
