const dotenv = require("dotenv");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

dotenv.config();

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

initializeApp({
    credential: cert(credentials),
    databaseURL:
        process.env.FIREBASE_ADMIN_DATABASE_URL ||
        `https://${credentials.project_id}-default-rtdb.firebaseio.com`,
});

console.log("process.env.FIREBASE_ADMIN_TYPE", process.env.FIREBASE_ADMIN_TYPE)
const db = getFirestore();

module.exports = db;
