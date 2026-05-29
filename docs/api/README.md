# API Documentation

## Current Endpoints (Vercel Serverless)

See `apps/backend/api/README.md` for detailed API contracts.

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/qr-scan` | Register QR scan + redirect to Zoho |
| POST | `/api/zoho-webhook` | Receive Zoho survey completion webhook |
| GET | `/api/get-counts` | Get current scan/completion counters |
| POST | `/api/reset-counts` | Reset counters to zero (sin auth, solo confirmación frontend) |

## Endpoints

### `POST /api/reset-counts`

Resetea `scanned` y `completed` a `0` en Firebase Realtime Database.

**Headers:**
```
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

**Frontend:**
- El dashboard tiene un botón negro "Resetear Contadores" debajo del código QR
- Al hacer clic, muestra confirmación: "¿Resetear todos los contadores a cero?"
- Al confirmar, envía `POST /api/reset-counts` y actualiza los contadores automáticamente
