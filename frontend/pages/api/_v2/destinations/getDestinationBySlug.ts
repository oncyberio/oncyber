import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { Destination } from "@uitypes/destinations";
import { preprocessDestination } from "@dapp/cyberRooms";
import { getDestinationBySlug as getFirestoreDestination } from "@utils/firestore/destinations";

async function fetchDestinationBySlug(slug: string) {
    const destination = await getFirestoreDestination(slug);

    if (!destination) {
        throw new Error("Failed to get destination");
    }

    return destination as unknown as Destination;
}

export const getDestinationBySlug = proc({
    //
    cors: true,
    auth: false,

    // schema
    schema: z.object({
        slug: z.string().min(1),
        userId: z.string().min(1).optional(),
    }),

    // handler
    async handler({ slug, userId }) {
        //
        const destination = await fetchDestinationBySlug(slug);

        return preprocessDestination(destination, userId || this.userId);
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
