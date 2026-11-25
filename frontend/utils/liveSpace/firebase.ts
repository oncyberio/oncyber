/**
 * A space's live channels over Firebase (see ./index.ts). The only file of
 * the world's that imports Firebase; loaded on first use, and never in a
 * framed world.
 */
import { database, db } from "@utils/firebase";
import { collection, doc, onSnapshot } from "firebase/firestore";
import {
    limitToLast,
    onChildAdded,
    orderByKey,
    push,
    query,
    ref,
} from "firebase/database";
import type { LiveSpace } from "./index";

const firebaseLiveSpace: LiveSpace = {
    watchSpace(id, onData) {
        return onSnapshot(doc(db, "exhibits", id), (snapshot) => {
            // v9 SDK: exists is a method; data() is undefined when the
            // doc is missing (e.g. dev project doesn't have this exhibit)
            const data = snapshot.data() as any;
            if (!snapshot.exists() || data == null) return;
            data.id = snapshot.id;
            data.createdAt =
                data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt;
            onData(data);
        });
    },
    watchCollection(id, name, onData) {
        return onSnapshot(
            collection(db, "exhibits", id, name),
            (snapshot) => {
                const pieces: Record<string, any> = {};
                snapshot.forEach((piece) => {
                    pieces[piece.id] = piece.data();
                });
                onData(pieces);
            },
            (error) => console.error(error)
        );
    },
    watchEvents(id, onEvent) {
        return onChildAdded(
            query(
                ref(database, "/exhibits/" + id),
                orderByKey(),
                limitToLast(1)
            ),
            (snapshot) => {
                if (!snapshot) return;
                onEvent({ id: snapshot.key, ...snapshot.val() });
            }
        );
    },
    sendEvent(id, event) {
        void push(ref(database, "/exhibits/" + id), event);
    },
};

export default firebaseLiveSpace;
