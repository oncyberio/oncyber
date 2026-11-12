import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectDatabaseEmulator, getDatabase } from "firebase/database";

import { firebaseApp, connectEmulator } from "./firebaseApp";

// Studio and editor only: this module starts Firestore and the Realtime
// Database. Sign-in imports utils/firebaseApp instead, so pages that only
// show worlds never load either.

export { firebaseApp };

export const auth = getAuth(firebaseApp);
connectEmulator("auth", (host, port) =>
    connectAuthEmulator(auth, `http://${host}:${port}`, {
        disableWarnings: true,
    })
);
export const database = getDatabase(firebaseApp);
connectEmulator("database", (host, port) =>
    connectDatabaseEmulator(database, host, port)
);
export const db = getFirestore(firebaseApp);
connectEmulator("firestore", (host, port) =>
    connectFirestoreEmulator(db, host, port)
);
