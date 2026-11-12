import { db, fire } from "@utils/firebaseAdmin";

export async function subscribe({ eventId, notificationId, userId }) {
    const docRef = db.collection("event-scheduler").doc(eventId);

    const doc = await docRef.get();

    if (!doc.exists) throw new Error("Document not found");

    await docRef.update({
        subscribedUsers: fire.FieldValue.arrayUnion({
            userId,
            notificationId,
        }),
    });
}

export async function unsubscribe({ eventId, notificationId, userId }) {
    const docRef = db.collection("event-scheduler").doc(eventId);

    const doc = await docRef.get();

    if (!doc.exists) throw new Error("Document not found");

    await docRef.update({
        subscribedUsers: fire.FieldValue.arrayRemove({
            userId,
            notificationId,
        }),
    });
}
