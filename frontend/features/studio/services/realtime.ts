import { Experience } from "@uitypes/experience";
import { database } from "@utils/firebase";
import type Api from "@3gl/api";
import { EDITION_ACTIONS } from "@3constants";
import { limitToLast, onChildAdded, push, query, ref } from "firebase/database";

const SENDER_ID = Date.now() + Math.random().toString().slice(2);

interface RealtimeContext {
    exhibitId: string;
    onEvent: (event: any, isCurrentSender: boolean) => unknown;
}

export function startRealtime({ exhibitId, onEvent }: RealtimeContext) {
    //

    const doc = onChildAdded(
        query(ref(database, "/exhibits/" + exhibitId), limitToLast(1)),
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

            if (!isCurrentSender || event.isServerEvent) {
                //
                onEvent(event, isCurrentSender);
            }
        }
    );

    // const doc = database.ref("/exhibits/" + exhibitId).limitToLast(1);

    // doc.on("child_added", );

    return () => {
        // doc.off("child_added");
        doc();
    };
}

export function sendRealtimeEvent(exhibitId: string, event) {
    // database.ref("/exhibits/" + exhibitId).push({
    //     ...event,
    //     SENDER_ID,
    // });

    push(ref(database, "/exhibits/" + exhibitId), {
        ...event,
        SENDER_ID,
    });
}
