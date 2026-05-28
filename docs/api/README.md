# API Documentation

## Current Endpoints (Vercel Serverless)

See `apps/backend/api/README.md` for detailed API contracts.

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/qr-scan` | Register QR scan + redirect to Zoho |
| POST | `/api/zoho-webhook` | Receive Zoho survey completion webhook |
| GET | `/api/get-counts` | Get current scan/completion counters |

## Future Endpoints (Fastify)

Will be documented when backend migration to Fastify is complete.
