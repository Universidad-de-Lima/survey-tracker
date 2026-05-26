# Backend Serverless para Monitoreo de Encuesta (Vercel)

Este backend maneja el registro de escaneos QR, los webhooks de Zoho Survey y proporciona los contadores al frontend.

## Configuración en Vercel

### Variables de Entorno Requeridas

Debes configurar las siguientes variables de entorno en tu proyecto de Vercel:

1.  `FIREBASE_SERVICE_ACCOUNT_KEY`: El contenido completo del archivo JSON de la cuenta de servicio de Firebase (en una sola línea).
2.  `FIREBASE_DATABASE_URL`: La URL de tu Firebase Realtime Database (ej: `https://tu-proyecto.firebaseio.com`).
3.  `ZOHO_SURVEY_URL`: La URL directa de tu encuesta en Zoho Survey a la que se redirigirá a los usuarios después de escanear.

## Endpoints

- `GET /api/qr-scan`: Registra un escaneo y redirige a Zoho Survey.
- `POST /api/zoho-webhook`: Recibe las notificaciones de encuesta completada desde Zoho.
- `GET /api/get-counts`: Retorna los contadores actuales (`scanned` y `completed`).
