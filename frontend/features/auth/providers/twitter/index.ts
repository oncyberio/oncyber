import {
    TwitterAuthProvider,
    signInWithPopup,
    linkWithPopup,
} from "firebase/auth";

import { auth } from "..";

export async function twitter_signIn() {
    const provider = new TwitterAuthProvider();

    return await signInWithPopup(auth, provider);
}

export async function twitter_link() {
    const provider = new TwitterAuthProvider();

    return await linkWithPopup(auth.currentUser, provider);
}
