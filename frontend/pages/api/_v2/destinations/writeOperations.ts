import { z } from "zod";
import { proc } from "@utils/rpc/server";
import {
    createDestination as firestoreCreate,
    updateDestination as firestoreUpdate,
    deleteDestination as firestoreDelete,
    getDestinationById as firestoreGetById,
} from "@utils/firestore/destinations";

async function assertOwnership(destinationId: string, userId: string) {
    const destination = await firestoreGetById(destinationId);
    if (!destination) {
        throw new Error("Destination not found");
    }
    if (destination.userId !== userId) {
        throw new Error("Unauthorized");
    }
    return destination;
}

// Status writes are checked where they are stored (firestoreCreate and
// firestoreUpdate, against utils/firestore/destinationStatus). Every write
// below is made as the owner, who may submit and cancel but not verify,
// reject or publish; only the three finalize procedures write as "mint",
// which publishes a destination that review has verified.
const AS_MINT = { actor: "mint" as const };

export const createDestination = proc({
    cors: true,
    auth: true,
    schema: z.object({
        payload: z.record(z.string(), z.any()),
    }),
    async handler({ payload }) {
        const data = {
            ...payload,
            userId: this.userId,
            status: payload.status || "tested",
            tag: payload.tag || [],
        };

        const id = await firestoreCreate(data as any);
        const doc = await firestoreGetById(id);

        return doc;
    },
});

export const updateDestinationById = proc({
    cors: true,
    auth: true,
    schema: z.object({
        id: z.string().min(1),
        payload: z.record(z.string(), z.any()),
    }),
    async handler({ id, payload }) {
        await assertOwnership(id, this.userId);
        await firestoreUpdate(id, payload);
        const doc = await firestoreGetById(id);
        return doc;
    },
});

export const submitReview = proc({
    cors: true,
    auth: true,
    schema: z.object({
        id: z.string().min(1),
        payload: z.record(z.string(), z.any()),
    }),
    async handler({ id, payload }) {
        await assertOwnership(id, this.userId);
        await firestoreUpdate(id, {
            ...payload,
            status: "submitted",
        } as any);
        return { success: true };
    },
});

export const cancelSubmit = proc({
    cors: true,
    auth: true,
    schema: z.object({
        id: z.string().min(1),
    }),
    async handler({ id }) {
        await assertOwnership(id, this.userId);
        await firestoreUpdate(id, { status: "tested" } as any);
        return { success: true };
    },
});

export const finalizeCreateDrop = proc({
    cors: true,
    auth: true,
    schema: z.object({
        id: z.string().min(1),
        payload: z.object({
            token_id: z.string(),
            contract_address: z.string(),
        }),
    }),
    async handler({ id, payload }) {
        await assertOwnership(id, this.userId);
        await firestoreUpdate(
            id,
            {
                token_id: payload.token_id,
                contract_address: payload.contract_address,
                status: "active",
            } as any,
            AS_MINT
        );
        return { success: true };
    },
});

export const finalizeMint = proc({
    cors: true,
    auth: true,
    schema: z.object({
        id: z.string().min(1),
    }),
    async handler({ id }) {
        await assertOwnership(id, this.userId);
        await firestoreUpdate(id, { status: "active" } as any, AS_MINT);
        return { success: true };
    },
});

export const finalizeDestination = proc({
    cors: true,
    auth: true,
    schema: z.object({
        id: z.string().min(1),
        payload: z.object({
            token_id: z.union([z.string(), z.number()]).optional(),
            status: z.string().optional(),
            contract_address: z.string().optional(),
        }),
    }),
    async handler({ id, payload }) {
        await assertOwnership(id, this.userId);
        // The only status this may carry is "active", after a mint.
        await firestoreUpdate(id, payload as any, AS_MINT);
        return { success: true };
    },
});

export const updateRoomParameters = proc({
    cors: true,
    auth: true,
    schema: z.object({
        id: z.string().min(1),
        params: z.record(z.string(), z.any()),
    }),
    async handler({ id, params }) {
        await assertOwnership(id, this.userId);
        await firestoreUpdate(id, { params } as any);
        return { success: true };
    },
});
