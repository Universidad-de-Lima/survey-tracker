# API — Serverless Endpoints

Tres funciones serverless desplegadas en Vercel que implementan la capa de datos del sistema `survey-tracker`. Cada archivo es un módulo independiente que exporta `async (req, res) => {}`.

## Endpoints

---

### `GET /api/qr-scan`

**Archivo**: `qr-scan.js`

**Propósito**: Registrar un escaneo QR y redirigir al usuario a la encuesta Zoho.

**Input**:
- Headers: `Origin: *` (CORS habilitado)
- Método: `GET` (también acepta `POST`, `OPTIONS`)

**Output**:
- Success: HTTP 302 redirect a `ZOHO_SURVEY_URL`
- Error: HTTP 500 `{ error: "Error al procesar la solicitud de escaneo QR." }`
- OPTIONS: HTTP 204

**Side Effects**:
- Incrementa `survey_counts/scanned` en Firebase Realtime Database vía `transaction()` atómica

**Dependencias**: `firebase-admin`, `FIREBASE_SERVICE_ACCOUNT_KEY`, `FIREBASE_DATABASE_URL`, `ZOHO_SURVEY_URL`

---

### `POST /api/zoho-webhook`

**Archivo**: `zoho-webhook.js`

**Propósito**: Procesar notificaciones de encuestas completadas desde Zoho Survey.

**Input**:
- Método: `POST` (también acepta `OPTIONS`)
- Body (JSON):
```json
{
  "response_status": "COMPLETED",
  "webhook_event": "response_completed"
}
```

**Output**:
- Success: HTTP 200 `{ message: "Webhook de Zoho procesado con éxito." }`
- Payload inválido: HTTP 400 `{ error: "Payload de webhook inválido o incompleto." }`
- Error interno: HTTP 500 `{ error: "Error interno del servidor al procesar el webhook." }`
- Método no permitido: HTTP 405
- OPTIONS: HTTP 204

**Side Effects**:
- Incrementa `survey_counts/completed` en Firebase Realtime Database vía `transaction()` atómica
- Solo procesa si `response_status === "COMPLETED"` y `webhook_event === "response_completed"`

**Dependencias**: `firebase-admin`, `FIREBASE_SERVICE_ACCOUNT_KEY`, `FIREBASE_DATABASE_URL`

**Advertencia**: No se implementa verificación HMAC. El endpoint confía en que el payload cumpla la estructura esperada sin validar el origen.

---

### `GET /api/get-counts`

**Archivo**: `get-counts.js`

**Propósito**: Retornar los contadores actuales para el dashboard frontend.

**Input**:
- Método: `GET` (también acepta `OPTIONS`)

**Output**:
- Success: HTTP 200
```json
{
  "scanned": 42,
  "completed": 35
}
```
- Error: HTTP 500 `{ error: "Error interno del servidor al obtener los contadores." }`
- Método no permitido: HTTP 405
- OPTIONS: HTTP 204

**Side Effects**: Ninguno. Solo lectura de Firebase.

**Dependencias**: `firebase-admin`, `FIREBASE_SERVICE_ACCOUNT_KEY`, `FIREBASE_DATABASE_URL`

---

## Common Patterns

### Firebase Initialization (repetido en cada archivo)
```javascript
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)),
        databaseURL: process.env.FIREBASE_DATABASE_URL
    });
}
const db = admin.database();
```

### CORS Configuration (repetido en cada archivo)
```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
```

## Technical Debt

1. **Código duplicado**: Inicialización de Firebase y configuración CORS se repiten en los 3 endpoints. Refactorizar a `lib/firebase.js` y `lib/cors.js`.
2. **Sin validación de webhook**: `zoho-webhook.js` no verifica firma HMAC. Riesgo de falsificación de eventos.
3. **Logging mínimo**: Solo `console.log`/`console.error`. Sin estructura ni niveles.
4. **Sin tests**: No hay cobertura de pruebas para ningún endpoint.

## AI Agent Notes

- **Formato Vercel**: Cada endpoint exporta `async (req, res) => {}` — compatible con `@vercel/node`.
- **Firebase transaction()**: `qr-scan.js` y `zoho-webhook.js` usan `transaction()` para escrituras atómicas. No modificar a `set()` o `update()` sin evaluar riesgos de concurrencia.
- **Estructura Firebase**: `survey_counts/{ scanned: number, completed: number }`. Es compartida entre todos los endpoints. Cambios en esta estructura afectan al frontend.
- **CORS abierto**: `Access-Control-Allow-Origin: *`. Aceptable para este caso de uso (frontend GitHub Pages, backend Vercel), pero no recomendado para producción sin restricciones.
- **Redirección 302**: `qr-scan.js` responde con redirect después de la transacción. Asegurar que la transacción se complete antes del redirect.
