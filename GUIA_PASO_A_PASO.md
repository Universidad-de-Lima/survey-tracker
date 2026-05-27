# Guía de Despliegue y Configuración

Sigue estos pasos para poner en marcha el proyecto:

## 1. Configuración de Firebase
1. Ve a [Firebase Console](https://console.firebase.google.com/).
2. Crea un nuevo proyecto.
3. En la sección **Build**, crea una **Realtime Database**.
4. En **Project Settings > Service Accounts**, haz clic en **Generate new private key**.
5. Abre el archivo JSON descargado, copia todo su contenido y guárdalo en una sola línea (lo usaremos como variable de entorno).

## 2. Despliegue del Backend en Vercel

### Paso A: Subir a GitHub
1. Entra a tu cuenta de GitHub y crea un nuevo repositorio llamado `zoho-dashboard-backend` (márcalo como **Private**).
2. Sube los archivos de la carpeta `backend/` de este proyecto a ese repositorio. Debe quedar así:
   - `api/` (carpeta con los 3 archivos .js)
   - `package.json`
   - `vercel.json` (¡Muy importante para enrutar las funciones!)
   - `README.md`

### Paso B: Conectar con Vercel
1. Ve a [Vercel.com](https://vercel.com/) e inicia sesión con tu cuenta de GitHub.
2. Haz clic en el botón **"Add New"** y selecciona **"Project"**.
3. Verás una lista de tus repositorios de GitHub. Busca `zoho-dashboard-backend` y haz clic en **"Import"**.

### Paso C: Configurar Variables de Entorno (¡MUY IMPORTANTE!)
Antes de darle al botón "Deploy", despliega la sección **"Environment Variables"** y agrega estas tres:

1.  **Nombre:** `FIREBASE_SERVICE_ACCOUNT_KEY`
    **Valor:** (Pega aquí el contenido de tu archivo JSON de Firebase. Asegúrate de que esté todo en una sola línea).
2.  **Nombre:** `FIREBASE_DATABASE_URL`
    **Valor:** (La URL de tu base de datos de Firebase, ej: `https://tu-proyecto.firebaseio.com`).
3.  **Nombre:** `ZOHO_SURVEY_URL`
    **Valor:** (La URL real de tu encuesta de Zoho donde quieres que la gente responda).

### Paso D: Desplegar
1. Haz clic en el botón **"Deploy"**.
2. Espera un minuto. Cuando termine, verás una pantalla de confeti.
3. Vercel te dará un dominio (ej: `zoho-dashboard-backend-six.vercel.app`). **Copia esa URL**, la necesitaremos para el frontend.

## 3. Configuración del Frontend
1. Abre `frontend/public/js/app.js`.
2. Reemplaza la URL en `BACKEND_API_URL` por la URL de Vercel + `/api/get-counts`.
3. Sube el contenido de la carpeta `frontend/public/` a tu repositorio de GitHub Pages.

## 4. Integración con Zoho Survey
1. En Zoho Survey, ve a la configuración de la encuesta y busca **Webhooks**.
2. Configura un Webhook para el evento "Response Completed".
3. Usa la URL de Vercel + `/api/zoho-webhook`.

## 5. Código QR
1. Genera un nuevo código QR que apunte a la URL de Vercel + `/api/qr-scan`.
2. Reemplaza el archivo `assets/QRCode.png` en tu repositorio de GitHub con este nuevo código QR.
