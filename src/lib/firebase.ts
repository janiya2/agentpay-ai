import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyBMrnCMPA6Ouh_qg9pwWSbJi63dXZHby_k',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'web-b61f1.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'web-b61f1',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'web-b61f1.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '806029963863',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:806029963863:web:b0c42b92338246793e6912',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-0YLHNLVQZT',
};

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

let db: Firestore;
try {
  db = getFirestore(app);
} catch (e) {
  console.warn('Firebase Firestore initialization notice:', e);
  db = {} as Firestore;
}

let auth: Auth;
try {
  auth = getAuth(app);
} catch (e) {
  console.warn('Firebase Auth initialization notice:', e);
  auth = {} as Auth;
}

export { app, db, auth };


