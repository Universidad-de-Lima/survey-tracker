# API Documentation

## Current Endpoints (Vercel Serverless)

See `apps/backend/api/README.md` for detailed API contracts.

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/qr-scan` | Register QR scan + redirect to Zoho |
| POST | `/api/zoho-webhook` | Receive Zoho survey completion webhook |
| GET | `/api/get-counts` | Get current scan/completion counters |
| POST | `/api/reset-counts` | Reset counters to zero (requires `Authorization: Bearer <key>`) |

## Endpoints protegidos

### `POST /api/reset-counts`

Resetea `scanned` y `completed` a `0` en Firebase Realtime Database.

**Headers:**
```
Authorization: Bearer <RESET_API_KEY>
Content-Type: application/json
```

**Response (200):**
```json
{
  "message": "Contadores reseteados exitosamente.",
  "previousCounts": {
    "scanned": 5,
    "completed": 3
  }
}
```

**Response (401):**
```json
{
  "error": "Invalid or missing API key",
  "code": "UNAUTHORIZED"
}
```

**Configuración:**
- La `RESET_API_KEY` se define como variable de entorno en Vercel
- El frontend tiene un botón "Resetear Contadores" que solicita la key antes de ejecutar
