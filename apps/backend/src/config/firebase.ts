import admin from 'firebase-admin';

import { env } from '@/config/env';

let firebaseInitialized = false;

export function getFirebaseDb(): admin.database.Database {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_KEY)),
      databaseURL: env.FIREBASE_DATABASE_URL,
    });
    firebaseInitialized = true;
  }

  return admin.database();
}

export function isFirebaseInitialized(): boolean {
  return firebaseInitialized || admin.apps.length > 0;
}
