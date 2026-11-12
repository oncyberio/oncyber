import { z } from "zod";
import { proc } from "@utils/rpc/server";
import {
    getDestinationById as firestoreGetById,
    getDestinationByTokenId as firestoreGetByToken,
    getDestinationsByTag as firestoreGetByTag,
    getDestinationsByUserId as firestoreGetByUserId,
    getUserDestinationBySlug as firestoreGetUserBySlug,
    getDestinationsBySlugs as firestoreGetBySlugs,
    getAllDestinations as firestoreGetAll,
    getUpcomingDestinations as firestoreGetUpcoming,
    getCreatedSpaces as firestoreGetCreatedSpaces,
    destinationExistsBySlug as firestoreCheckSlug,
} from "@utils/firestore/destinations";

export const getDestinationById = proc({
    cors: true,
    auth: false,
    schema: z.object({
        id: z.string().min(1),
    }),
    async handler({ id }) {
        const destination = await firestoreGetById(id);
        if (!destination) {
            throw new Error("Destination not found");
        }
        return destination;
    },
});

export const getDestinationByTokenId = proc({
    cors: true,
    auth: false,
    schema: z.object({
        tokenId: z.string().min(1),
    }),
    async handler({ tokenId }) {
        const destination = await firestoreGetByToken(tokenId);
        if (!destination) {
            throw new Error("Destination not found");
        }
        return destination;
    },
});

export const getDestinationsByTag = proc({
    cors: true,
    auth: false,
    schema: z.object({
        tag: z.string().min(1),
    }),
    async handler({ tag }) {
        return firestoreGetByTag(tag);
    },
});

export const getUserDestinations = proc({
    cors: true,
    auth: true,
    schema: z.object({}),
    async handler() {
        return firestoreGetByUserId(this.userId);
    },
});

export const getUserDestinationBySlug = proc({
    cors: true,
    auth: true,
    schema: z.object({
        slug: z.string().min(1),
    }),
    async handler({ slug }) {
        const destination = await firestoreGetUserBySlug(
            this.userId,
            slug
        );
        if (!destination) {
            throw new Error("Destination not found");
        }
        return destination;
    },
});

export const getDestinationsBySlugs = proc({
    cors: true,
    auth: false,
    schema: z.object({
        slugs: z.array(z.string().min(1)),
    }),
    async handler({ slugs }) {
        return firestoreGetBySlugs(slugs);
    },
});

export const getAllDestinations = proc({
    cors: true,
    auth: false,
    schema: z.object({
        limit: z.number().optional(),
    }),
    async handler({ limit }) {
        return firestoreGetAll(limit);
    },
});

export const getUpcomingDestinations = proc({
    cors: true,
    auth: false,
    schema: z.object({}),
    async handler() {
        return firestoreGetUpcoming();
    },
});

export const getCreatedSpaces = proc({
    cors: true,
    auth: true,
    schema: z.object({
        isFuture: z
            .union([z.string(), z.boolean()])
            .transform((v) => (v != null ? String(v) : undefined))
            .optional(),
    }),
    async handler({ isFuture }) {
        return firestoreGetCreatedSpaces(this.userId, isFuture);
    },
});

export const checkSlugExists = proc({
    cors: true,
    auth: false,
    schema: z.object({
        slug: z.string().min(1),
    }),
    async handler({ slug }) {
        const exists = await firestoreCheckSlug(slug);
        return { exists };
    },
});
