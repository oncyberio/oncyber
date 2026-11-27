import { z } from "zod";
import { proc } from "@utils/rpc/server";
import {
    createDestination as firestoreCreate,
    updateDestination as firestoreUpdate,
    deleteDestination as firestoreDelete,
    getDestinationById as firestoreGetById,
} from "@utils/firestore/destinations";
import { fire } from "@utils/firebaseAdmin";
import { isSiteAdmin } from "@utils/siteAdmins";
import {
    MAXIMUM_VRM_BOX,
    MINIMUM_VRM_BOX,
    avatarHeightToSize,
    avatarSizeToHeight,
} from "@components/_3DExhibit-v2/three/utils/avatarHeight";

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

/**
 * How tall avatars stand in a destination, in its own units (`avatarSize`
 * in its settings, see `@3utils/avatarHeight`). `null` takes the setting
 * away, and avatars go back to standing with their eyes at the
 * destination's `user_height`.
 *
 * The destination's owner may set it, and so may Oncyber's site admins: a
 * world whose doors stand twice a person's height is wrong for everyone
 * who visits, and its builder is not always there to ask. This writes that
 * one number and nothing else of the settings (`updateRoomParameters`
 * replaces them all, and is the owner's alone).
 */
export const setAvatarHeight = proc({
    cors: true,
    auth: true,
    schema: z.object({
        id: z.string().min(1).max(200),
        height: z.number().min(MINIMUM_VRM_BOX).max(MAXIMUM_VRM_BOX).nullable(),
    }),
    async handler({ id, height }) {
        const destination = await firestoreGetById(id);
        if (!destination) throw new Error("Destination not found");
        const userId = String(this.userId || "").toLowerCase();
        const owns =
            String((destination as any).userId || "").toLowerCase() === userId;
        if (!owns && !isSiteAdmin(userId)) throw new Error("Unauthorized");

        const was = (destination as any).params?.avatarSize;
        const avatarSize = height === null ? null : avatarHeightToSize(height);
        await firestoreUpdate(id, {
            "params.avatarSize":
                avatarSize === null ? fire.FieldValue.delete() : avatarSize,
        } as any);
        return {
            success: true,
            avatarSize,
            height: avatarSize === null ? null : avatarSizeToHeight(avatarSize),
            was:
                typeof was === "number" && was > 0
                    ? avatarSizeToHeight(was)
                    : null,
        };
    },
});
