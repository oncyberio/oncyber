import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

import { firebaseApp } from "./firebaseApp";

// Studio and editor only: this module starts Firestore and the Realtime
// Database. Sign-in imports utils/firebaseApp instead, so pages that only
// show worlds never load either.

export { firebaseApp };

export const auth = getAuth(firebaseApp);
export const database = getDatabase(firebaseApp);
export const db = getFirestore(firebaseApp);
// const storage = getStorage(firebaseApp);
// export const fire = firebase.firestore
// const analytics = getAnalytics(firebaseApp);
