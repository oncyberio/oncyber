import { Experience } from "@uitypes/experience";
import { database } from "@utils/firebase";
import Api from "../three/api";
import { EDITION_ACTIONS } from "../three/constants";
import {
    get,
    onValue,
    orderByKey,
    query,
    ref,
    set,
    limitToLast,
    push,
    onChildAdded,
} from "firebase/database";

const SENDER_ID = Date.now() + Math.random().toString().slice(2);

export const RealtimeEvents = {
    EDITOR_ACTION: "EDITOR_ACTION" as const,
};

export default function realtime({
    exhibit,
    user,
    world,
}: {
    exhibit: Experience;
    user: any;
    world: Api;
}): (a: any, b?: string) => any {
    // const doc = database.ref("/exhibits/" + exhibit.id).limitToLast(1);

    // doc.on("child_added", (snapshot) => {

    const doc = onChildAdded(
        query(
            ref(database, "/exhibits/" + exhibit.id),
            orderByKey(),
            limitToLast(1)
        ),
        (snapshot) => {
            if (!snapshot) return;

            const event = { id: snapshot.key, ...snapshot.val() };

            if (!event) return;

            // Check if event expired
            const now = new Date().getTime();
            const isExpired = now > event.timestamp;
            if (isExpired) {
                console.error(
                    "[fireabse/realtime] event expired and will be ignored!",
                    "event time",
                    new Date(event.timestamp),
                    "current time",
                    new Date(now),
                    event
                );
                return;
            } else {
                console.log("passed", event);
            }

            // Only add if the current sender isn't the issuer of the event
            const isCurrentSender = event.SENDER_ID === SENDER_ID;

            if (world == null) return;

            if (!isCurrentSender || event.isServerEvent) {
                //
                if (event.type === RealtimeEvents.EDITOR_ACTION) {
                    world.edit(event.action);
                }

                // Server side
                if (event.type === "COMPRESSION_FINISHED") {
                    world.edit({
                        type: EDITION_ACTIONS.EDITOR_UPDATE_ARTWORK_MEDIA,
                        artworkId: event.meshId,
                        urlField: event.payload.urlField,
                        mediaInfo: event.payload.mediaInfo,
                        coverMediaInfo: event.payload.coverMediaInfo,
                        isCurrentUser: isCurrentSender,
                    });
                }

                // Server side
                if (event.type === "REPLACE_ASSET") {
                    world.edit({
                        type: EDITION_ACTIONS.REPLACE_HTML_PREVIEW_TEXTURE,
                        artworkId: event.meshId,
                        asset: event.payload.asset,
                    });
                }
            }

            //
            if (
                event.type === "USER_KICKED" &&
                event.walletId.toLowerCase() !== user.id.toLowerCase()
            ) {
                location.reload();
            }
        }
    );

    return () => {
        // doc.off("child_added");
        doc();
    };
}

export function sendEvent(exhibitId: string, event) {
    // database.ref("/exhibits/" + exhibitId).push({
    //     ...event,
    //     SENDER_ID,
    // });

    push(ref(database, "/exhibits/" + exhibitId), {
        ...event,
        SENDER_ID,
    });
}

export function sendEditorAction(exhibitId, walletId, action) {
    const event = {
        type: RealtimeEvents.EDITOR_ACTION,
        action,
        walletId,
        timestamp: Date.now() + 1000 * 10,
    };

    sendEvent(exhibitId, event);
}
