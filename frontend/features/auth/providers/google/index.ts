import {
    GoogleAuthProvider,
    signInWithPopup,
    linkWithPopup,
} from "firebase/auth";

import { auth } from "../index";

export async function google_signIn() {
    const provider = new GoogleAuthProvider();

    const credential = await signInWithPopup(auth, provider);

    return credential;
}

export async function google_link() {
    const provider = new GoogleAuthProvider();

    const credential = await linkWithPopup(auth.currentUser, provider);

    return credential;
}
