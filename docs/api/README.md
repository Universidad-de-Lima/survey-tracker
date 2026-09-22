# API Documentation

Backend serverless desplegado en Vercel.

**Base URL:** `https://qr-smoky-theta.vercel.app/api`

---

## Endpoints

### `GET /api/qr-scan`

Es el destino del QR proyectado. Cuenta el escaneo y redirige al alumno a la encuesta.

**Input:**
- Método: `GET` (también acepta `POST`, `OPTIONS`)
- Parámetro opcional `?s=<sesion>` (por defecto `default`)

**Output:**
- HTTP **302** a `ZOHO_SURVEY_URL` (siempre, incluso si el conteo falla)
- HTTP 405 `{ error: "Método no permitido." }` para otros métodos
- HTTP 204 para `OPTIONS`

**Efectos:**
- Incrementa `sessions/<sesion>/scanned` con un incremento atómico resuelto en el servidor de
  Firebase (`ServerValue.increment`), sin ciclo leer-modificar-escribir.
- No deja ninguna cookie: cada escaneo suma, aunque venga del mismo celular.

**Robustez:** el contador es lo de menos. Si Firebase falla, **igual se redirige a la
encuesta**: lo que se pierde es un escaneo, nunca la respuesta del alumno.

---

### `GET /api/done`

Lo llama la **página final de la encuesta de Zoho** («Redirigir a nueva página»). No es un
webhook: no hay cabeceras ni secretos que configurar, sólo pegar la URL una vez en Zoho.

**Input:**
- Método: `GET` (otros métodos → HTTP 405)
- Parámetro opcional `?s=<sesion>` (por defecto `default`)

**Output:**
- HTTP 200 con una página HTML de agradecimiento
- HTTP 405 `{ error: "Método no permitido." }`

**Efectos:**
- Incrementa `sessions/<sesion>/completed`.
- No deja ninguna cookie: cada finalización suma.

**Robustez:** aunque falle el conteo, el alumno **siempre** ve el agradecimiento.

---

### `GET /api/get-counts`

Devuelve los contadores para el panel.

**Input:**
- Método: `GET` (también acepta `OPTIONS`)
- Parámetro opcional `?s=<sesion>` (por defecto `default`)

**Output:** HTTP 200

```json
{ "scanned": 30, "completed": 28, "pending": 2, "sessionId": "default" }
```

- HTTP 405 `{ error: "Método no permitido." }`
- HTTP 500 `{ error: "Error interno del servidor al obtener los contadores." }`
- HTTP 204 para `OPTIONS`

**Efectos:** ninguno. Sólo lectura de `sessions/<sesion>`.

**Nota:** `pending` se calcula en el servidor como `scanned − completed`, nunca negativo, y
una sesión sin empezar devuelve ceros sin error.

---

### `POST /api/reset-counts`

El botón `RESET` del panel: pone los contadores a cero para el siguiente salón.

**Input:**
- Método: `POST` (también acepta `OPTIONS`)
- Cuerpo: vacío

**Output:** HTTP 200

```json
{
  "message": "Contadores reseteados exitosamente.",
  "sessionId": "default",
  "previousCounts": { "scanned": 30, "completed": 29 }
}
```

- HTTP 405 `{ error: "Método no permitido." }`
- HTTP 500 `{ error: "Error interno del servidor al resetear contadores." }`
- HTTP 204 para `OPTIONS`

**Efectos:** deja `sessions/<sesion>` en `{ scanned: 0, completed: 0 }`.

**Decisión de diseño:** no pide clave. Del toque accidental protege la confirmación del propio
botón, y lo que un tercero podría conseguir con la URL es descuadrar un número en pantalla:
las respuestas están en Zoho y el encuestador lo ve al instante.

---

### `POST /api/procesar-encuesta`

Lo llama el **botón de refrescar del portal** (repositorio `survey-test`): le pide a GitHub que
ejecute el flujo `build_zoho_survey.yml`, que convierte las respuestas acumuladas de Zoho Survey
en los datos publicados del portal.

**Input:**
- Método: `POST` (también acepta `OPTIONS`)
- Cuerpo: vacío

**Output:** HTTP **202**

```json
{ "message": "Proceso solicitado. Los datos se actualizarán en unos minutos." }
```

- HTTP 200 `{ "message": "Ya hay una ejecución en curso o recién terminada. Prueba en unos minutos." }`
  si la última ejecución del flujo empezó hace menos de 10 minutos.
- HTTP 405 `{ error: "Método no permitido." }`
- HTTP 502 `{ error: "GitHub rechazó la solicitud.", status }`
- HTTP 503 `{ error: "Falta configurar GITHUB_DISPATCH_TOKEN en Vercel." }`
- HTTP 204 para `OPTIONS`

**Efectos:** dispara un `repository_dispatch` con `event_type: procesar_datos` en `survey-test`.
No toca Firebase.

**Variable de entorno:** `GITHUB_DISPATCH_TOKEN` (Vercel → Settings → Environment Variables).
Es un token de GitHub con **Contents: Read and write** sobre `survey-test`. Si además se le da
**Actions: Read-only**, el endpoint puede aplicar el corte de 10 minutos entre disparos.

**CORS:** a diferencia del resto, aquí **no** se permite cualquier origen: solo
`https://universidad-de-lima.github.io` y `http://localhost:3000`. La llave vive únicamente en el
servidor, así que el portal no guarda ni pide nada.

**Decisión de diseño:** la llave no se pega nunca en la página. El corte de 10 minutos no es
seguridad (la llave no está expuesta), es higiene: evita que dos clics seguidos encolen dos
ejecuciones.

---

## CORS

Todos los endpoints habilitan CORS con origen `*`, porque el panel se sirve desde GitHub Pages.
La excepción es `/api/procesar-encuesta`, que solo acepta el origen del portal (ver arriba).

## Notas técnicas

- **Incrementos atómicos:** los contadores se incrementan con `ServerValue.increment` en el
  servidor de Firebase. Bajo la ráfaga de un salón entero (~30 escaneos a la vez) esto evita
  los reintentos del ciclo leer-modificar-escribir y la latencia que espera el alumno.
- **Sesiones:** los contadores viven en `sessions/<sesion>/`. La campaña usa `default`; el
  parámetro `?s=` se mantiene porque los QR antiguos lo llevan y no estorba.
- **Sin deduplicación:** cada escaneo y cada finalización suman uno. Se pidió así a propósito:
  el contador refleja exactamente lo que llega, sin nada por detrás.
- **Enrutado:** `apps/backend/vercel.json` declara las rutas una a una. Un endpoint nuevo que
  no se añada ahí **devuelve 404 sin que el CI avise**.
