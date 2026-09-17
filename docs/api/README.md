# API Documentation

Backend serverless desplegado en Vercel.

**Base URL:** `https://qr-smoky-theta.vercel.app/api`

---

## Endpoints

### `GET /api/qr-scan`

Registra un escaneo de QR y redirige al encuestado a la encuesta de Zoho.

**Input:**
- Método: `GET` (también acepta `POST`, `OPTIONS`)

**Output:**
- Success: HTTP 302 redirect a `ZOHO_SURVEY_URL`
- Error: HTTP 500 `{ error: "Error al procesar la solicitud de escaneo QR." }`
- OPTIONS: HTTP 204

**Side effects:**
- Incrementa `survey_counts/scanned` en Firebase Realtime Database vía `transaction()` atómica.

---

### `POST /api/zoho-webhook`

Recibe notificaciones de Zoho Survey cuando un encuestado completa la encuesta.

**Headers:**
```
Content-Type: application/json
X-Webhook-Secret: <ZOHO_WEBHOOK_SECRET>
```

**Input:**
- Método: `POST` (también acepta `OPTIONS`)
- Body (JSON):
```json
{
  "response_status": "COMPLETED",
  "webhook_event": "response_completed",
  "response_id": "unique-response-id-from-zoho"
}
```

**Output:**
- Success (nueva respuesta): HTTP 200 `{ message: "Webhook de Zoho procesado con éxito.", completed: true }`
- Success (respuesta ya procesada): HTTP 200 `{ message: "Webhook ya fue procesado.", completed: false }`
- Secret inválido o ausente: HTTP 401 `{ error: "Unauthorized: invalid webhook secret." }`
- Secret no configurado en el servidor: HTTP 503 `{ error: "Webhook secret not configured." }`
- Payload inválido: HTTP 400 `{ error: "Payload de webhook inválido o incompleto." }`
- Error interno: HTTP 500 `{ error: "Error interno del servidor al procesar el webhook." }`
- OPTIONS: HTTP 204

**Side effects:**
- Incrementa `survey_counts/completed` vía `transaction()` atómica.
- Guarda `processed_responses/<response_id>` para evitar conteos duplicados.

**Seguridad:**
- El header `X-Webhook-Secret` debe coincidir con la variable de entorno `ZOHO_WEBHOOK_SECRET`, comparada en tiempo constante (`crypto.timingSafeEqual`).
- **Falla cerrado:** sin `ZOHO_WEBHOOK_SECRET` el webhook responde 503 y no registra nada, en lugar de aceptar cualquier petición.

---

### `GET /api/get-counts`

Retorna los contadores de una sesión para el dashboard frontend.

**Input:**
- Método: `GET` (también acepta `OPTIONS`)
- Parámetro opcional `?s=<sesion>` (por defecto `default`)

**Output:**
- Success: HTTP 200
```json
{
  "scanned": 42,
  "completed": 35,
  "pending": 7,
  "sessionId": "salon-302-20set-1100"
}
```
- Método no permitido: HTTP 405 `{ error: "Método no permitido." }`
- Error: HTTP 500 `{ error: "Error interno del servidor al obtener los contadores." }`
- OPTIONS: HTTP 204

**Side effects:** Ninguno. Solo lectura de Firebase (`sessions/<sesion>`).

**Nota:** una sesión que todavía no ha empezado devuelve `{ scanned: 0, completed: 0, pending: 0 }` sin error, en lugar de fallar.

---

### `POST /api/reset-counts`

Reinicia los contadores `scanned` y `completed` a cero.

**Headers:**
```
Content-Type: application/json
X-Reset-Secret: <RESET_COUNTS_SECRET>
```

**Input:**
- Método: `POST` (también acepta `OPTIONS`)

**Output:**
- Success: HTTP 200
```json
{
  "message": "Contadores reseteados exitosamente.",
  "previousCounts": {
    "scanned": 5,
    "completed": 3
  }
}
```
- Clave inválida o ausente: HTTP 401 `{ error: "Unauthorized: invalid reset secret." }`
- Clave no configurada en el servidor: HTTP 503 `{ error: "Reset endpoint not configured." }`
- Método no permitido: HTTP 405 `{ error: "Método no permitido." }`
- Error interno: HTTP 500 `{ error: "Error interno del servidor al resetear contadores." }`
- OPTIONS: HTTP 204

**Side effects:**
- Establece `survey_counts` a `{ scanned: 0, completed: 0 }`.

**Seguridad:**
- Operación destructiva: **falla cerrado**. Sin `RESET_COUNTS_SECRET`, el endpoint responde 503 y no resetea nada.
- La clave se envía en la cabecera `X-Reset-Secret` y se compara en tiempo constante (`crypto.timingSafeEqual`).
- La clave **no** se incluye en el bundle del frontend: la teclea el operador en el dashboard en cada operación.

---

## CORS

Todos los endpoints habilitan CORS con origen `*` para permitir llamadas desde GitHub Pages.

## Notas técnicas

- Las escrituras en Firebase usan `transaction()` para garantizar atomicidad ante concurrencia.
- El campo `response_id` se sanitiza antes de usarse como clave en Firebase RTDB.
