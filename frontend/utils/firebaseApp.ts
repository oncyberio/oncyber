import { initializeApp } from "firebase/app";

import { nodeEnv } from "@env";

// The Firebase app alone. Sign-in (features/auth/providers) needs only this
// and firebase/auth; utils/firebase.js adds Firestore and the Realtime
// Database for the studio and the editor, so visitors never load those.

const firebaseConfig = {
    apiKey: nodeEnv.FIREBASE_API_KEY,
    authDomain: nodeEnv.FIREBASE_AUTH_DOMAIN,
    projectId: nodeEnv.FIREBASE_PROJECT_ID,
    storageBucket: nodeEnv.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: nodeEnv.FIREBASE_MESSAGING_SENDER_ID,
    appId: nodeEnv.FIREBASE_APP_ID,
    measurementId: nodeEnv.FIREBASE_MEASUREMENT_ID,
};

export const firebaseApp = initializeApp(firebaseConfig);
