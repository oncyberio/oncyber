import { db } from "@utils/firebaseAdmin";

export const getEventSchedulerById = async (id: string) => {
    //
    const doc = await db.collection("event-scheduler").doc(id).get();

    if (!doc.exists) return null;

    const event = {
        ...doc.data(),
        id: doc.id,
    } as any;

    return event;
};
