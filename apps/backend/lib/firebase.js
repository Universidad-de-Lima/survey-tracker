import admin from 'firebase-admin';

export function getFirebaseDb() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
  }
  return admin.database();
}

/**
 * Incremento atómico resuelto en el servidor de Firebase.
 * Evita el ciclo leer-modificar-escribir de `transaction()`, que bajo la ráfaga de
 * un salón entero (~30-50 peticiones simultáneas) obliga a reintentar y dispara la
 * latencia que espera el alumno antes de ser redirigido a la encuesta.
 */
export function incrementBy(amount) {
  return admin.database.ServerValue.increment(amount);
}
