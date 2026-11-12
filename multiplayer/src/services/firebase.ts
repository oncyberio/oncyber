// import * as admin from "firebase-admin";

// let projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
// let privateKey = "";
// let clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

// try {
//     privateKey = JSON.parse(process.env.FIREBASE_ADMIN_PRIVATE_KEY);
// } catch (e) {
//     console.error("Error parsing FB key:", e);
// }

// console.log("Firebase Admin Init with:", {
//     projectId,
//     clientEmail,
//     // privateKey, // avoid logging sensitive info
// });

// const credentials = {
//     projectId,
//     privateKey: privateKey,
//     clientEmail: clientEmail,
// };

// let app = admin.initializeApp({
//     credential: admin.credential.cert(credentials),
//     storageBucket: `${process.env.FIREBASE_ADMIN_PROJECT_ID}-engine`,
// });

// app.firestore().settings({ ignoreUndefinedProperties: true });

// export const db = app.firestore();

// // export const database = admin.database();

// export const fire = app.firestore;
