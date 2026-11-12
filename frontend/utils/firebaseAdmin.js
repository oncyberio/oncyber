import * as admin from "firebase-admin";

const credentials = {
    type: process.env.FIREBASE_ADMIN_TYPE,
    project_id: process.env.FIREBASE_ADMIN_PROJECT_ID,
    private_key_id: process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
    client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_ADMIN_CLIENT_ID,
    auth_uri: process.env.FIREBASE_ADMIN_AUTH_URI,
    token_uri: process.env.FIREBASE_ADMIN_TOKEN_URI,
    auth_provider_x509_cert_url:
        process.env.FIREBASE_ADMIN_AUTH_PROVIDER_x509_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_ADMIN_CLIENT_x509_CERT_URL,
};

const projectId =
    credentials.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!admin.apps.length) {
    const hasServiceAccount =
        credentials.project_id &&
        credentials.client_email &&
        credentials.private_key;
    admin.initializeApp({
        // Local runtime fixtures do not touch Firestore and should not require
        // production credentials merely to import an API/SSR module. Real
        // Firestore access still resolves through ADC or fails normally.
        ...(hasServiceAccount
            ? { credential: admin.credential.cert(credentials) }
            : { projectId }),
        databaseURL:
            process.env.FIREBASE_ADMIN_DATABASE_URL ||
            (projectId
                ? `https://${projectId}-default-rtdb.firebaseio.com`
                : undefined),
    });
}

export const db = admin.firestore();
export const auth = admin.auth;
export const fire = admin.firestore;
