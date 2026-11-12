import { initializeApp } from "firebase/app";

import { firebaseEmulators, nodeEnv } from "@env";

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

/** `host:port` as an emulator connect call wants it. */
export function splitEmulatorHost(value: string): [string, number] {
    const at = value.lastIndexOf(":");
    return [value.slice(0, at), Number(value.slice(at + 1))];
}

// Each service may be started from more than one module; connect it once.
const connected = new Set<string>();

/**
 * Points a Firebase service at its local emulator when `pnpm dev:local` set
 * one up. Call right after getAuth/getFirestore/getDatabase, before any read.
 */
export function connectEmulator(
    service: keyof typeof firebaseEmulators,
    connect: (host: string, port: number) => void
) {
    const value = firebaseEmulators[service];
    if (!value || connected.has(service)) return;
    connected.add(service);
    const [host, port] = splitEmulatorHost(value);
    connect(host, port);
}
