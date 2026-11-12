import { z } from "zod";
import { proc } from "@utils/rpc/server";
import { db } from "@utils/firebaseAdmin";
import { nodeEnv } from "@env";
import { uploadToPinata, MAX_IMAGE_SIZE, MAX_MODEL_SIZE } from "@utils/pinataUpload";

/**
 * Upload overwrite — uploads replacement media to Pinata (previously Cloudinary via server).
 * Returns IPFS gateway URL.
 */
/** Owner or editor of the exhibit; everything that writes for a space needs one. */
async function assertExhibitEditor(exhibitId: string, userId: string) {
    const doc = await db.collection("exhibits").doc(exhibitId).get();
    const exhibit: any = doc.exists ? doc.data() : null;
    const id = userId?.toLowerCase();
    if (!exhibit || !id) throw new Error("Not allowed");
    const owner = exhibit.owner?.toLowerCase() === id;
    const editor = (exhibit.editors || []).some((e: string) => e?.toLowerCase() === id);
    if (!owner && !editor) throw new Error("Not allowed");
    return exhibit;
}

export const uploadOverwriteAsset = proc({
    cors: true,
    auth: true,
    schema: z.object({
        exhibitId: z.string().min(1),
        assetId: z.string().min(1),
        file: z.string().min(1),
        fileMetadata: z.object({
            type: z.string(),
            size: z.number().optional(),
        }),
    }),
    async handler({ exhibitId, assetId, file, fileMetadata }) {
        await assertExhibitEditor(exhibitId, this.userId);

        let mediaType;
        if (fileMetadata.type.startsWith("image/")) {
            mediaType = "image";
        }
        if (fileMetadata.type.startsWith("video/")) {
            mediaType = "video";
        }

        const url = await uploadToPinata(
            file,
            `overwrite_${assetId}`,
            MAX_MODEL_SIZE
        );

        return {
            success: true,
            media: {
                mediaType,
                url,
            },
        };
    },
});

/**
 * Get shared/delegated assets for a wallet within an exhibit.
 * Reads from Firestore `delegations/{exhibitId}/assets` collection.
 * Also migrates legacy format from `users/{walletId}/exhibits/{exhibitId}/shared`.
 */
export const getSharedAssets = proc({
    cors: true,
    auth: false,
    schema: z.object({
        walletId: z.string().min(1),
        exhibitId: z.string().min(1),
    }),
    async handler({ walletId, exhibitId }) {
        // Migrate legacy shared assets if any exist
        const deprecatedDocs = await db
            .collection("users")
            .doc(walletId)
            .collection("exhibits")
            .doc(exhibitId)
            .collection("shared")
            .get();

        if (!deprecatedDocs.empty) {
            await Promise.all(
                deprecatedDocs.docs.map(async (doc) => {
                    await db
                        .collection("delegations")
                        .doc(exhibitId)
                        .collection("assets")
                        .add({
                            ...doc.data(),
                            delegatedTo: walletId,
                        });

                    await doc.ref.delete();
                })
            );
        }

        // Read current delegated assets
        const docs = await db
            .collection("delegations")
            .doc(exhibitId)
            .collection("assets")
            .get();

        const assets = docs.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));

        return { success: true, assets };
    },
});

/**
 * Save shared/delegated assets between users within an exhibit.
 * Writes to Firestore `delegations/{exhibitId}/assets` collection.
 */
export const saveSharedAssets = proc({
    cors: true,
    auth: true,
    schema: z.object({
        sharedAssets: z.record(z.string(), z.any()),
        walletId: z.string().min(1),
        invitedWalletId: z.string().min(1),
        exhibitId: z.string().min(1),
        inviteId: z.string().optional(),
    }),
    async handler({
        sharedAssets,
        walletId,
        invitedWalletId,
        exhibitId,
        inviteId,
    }) {
        if (walletId.toLowerCase() !== this.userId?.toLowerCase())
            throw new Error("Not allowed");
        await assertExhibitEditor(exhibitId, this.userId);

        await Promise.all(
            Object.keys(sharedAssets).map(async (asset) => {
                await db
                    .collection("delegations")
                    .doc(exhibitId)
                    .collection("assets")
                    .add({
                        ...sharedAssets[asset],
                        sharedBy: walletId,
                        delegatedTo: invitedWalletId,
                    });
            })
        );

        if (inviteId) {
            await db.collection("invites").doc(inviteId).delete();
        }

        return { success: true, sharedAssets };
    },
});

/**
 * Get user's owned NFT assets from OpenSea or Tezos APIs.
 * Proxies the external blockchain API calls that were previously in the Express server.
 */
export const getAssets = proc({
    cors: true,
    auth: false,
    schema: z.object({
        account: z.string().min(1),
        type: z.string().min(1),
        offset: z.number().optional().default(0),
    }),
    async handler({ account, type, offset }) {
        if (type === "tezos") {
            const response = await fetch(
                "https://api.hicdex.com/v1/graphql",
                {
                    method: "POST",
                    body: JSON.stringify({
                        query: `
                        query collectorGallery($address: String) {
                          hic_et_nunc_token_holder(where: {quantity: {_gt: "0"}, holder: {address: {_eq: $address}}}, order_by: {token_id: desc}) {
                            token {
                              id
                              artifact_uri
                              thumbnail_uri
                              timestamp
                              mime
                              title
                              description
                              display_uri
                              supply
                              creator_id
                              token_tags {
                                tag {
                                  tag
                                }
                              }
                            }
                          }
                        }
                        `,
                        variables: { address: account },
                    }),
                }
            );

            const { data } = await response.json();
            const assets = (data?.hic_et_nunc_token_holder || []).map(
                ({ token }) => formatTezosAsset(token, account)
            );
            return { success: true, assets };
        } else if (type === "ethereum") {
            const response = await fetch(
                `${nodeEnv.OPENSEA_API}/assets?owner=${account}&limit=50&offset=${offset}`,
                {
                    headers: {
                        "X-API-KEY": nodeEnv.OPENSEA_X_API_KEY,
                    },
                }
            );

            const data = await response.json();
            return { success: true, assets: data.assets || [] };
        }

        return { success: true, assets: [] };
    },
});

/**
 * Get chain assets from OpenSea v2 API with recursive pagination.
 */
export const getChainAssets = proc({
    cors: true,
    auth: false,
    schema: z.object({
        account: z.string().min(1),
        type: z.string().min(1),
    }),
    async handler({ account, type }) {
        async function fetchPage(
            url: string
        ): Promise<any[]> {
            const response = await fetch(url, {
                headers: {
                    "X-API-KEY": nodeEnv.OPENSEA_X_API_KEY,
                },
            });

            const { results, next } = await response.json();

            if (next) {
                const nextResults = await fetchPage(
                    next.replace("api2", "api")
                );
                return [...nextResults, ...(results || [])];
            }

            return results || [];
        }

        const url = `https://api.opensea.io/api/v2/assets/${type}?owner_address=${account}`;
        const assets = await fetchPage(url);
        return { success: true, assets };
    },
});

/**
 * Upload video preview for an experience.
 * Uploads to Pinata and updates the exhibit document in Firestore.
 */
export const uploadVideoPreview = proc({
    cors: true,
    auth: true,
    schema: z.object({
        exhibitId: z.string().min(1),
        file: z.string().min(1),
        mode: z.string().min(1),
    }),
    async handler({ exhibitId, file, mode }) {
        await assertExhibitEditor(exhibitId, this.userId);

        let path = `info.`;

        if (mode === "SQUARE") {
            path += "fVideoSquare";
        } else if (mode === "LANDSCAPE") {
            path += "fVideoLandscape";
        } else if (mode === "PORTRAIT") {
            path += "fVideoPortrait";
        } else {
            throw new Error("mode doesn't exist");
        }

        const url = await uploadToPinata(
            file,
            `video_preview_${mode}_${exhibitId}`,
            MAX_MODEL_SIZE
        );

        // Update exhibit document with the video URL
        await db
            .collection("exhibits")
            .doc(exhibitId)
            .update({
                [path]: url,
            });

        return {
            success: true,
            video: {
                mediaType: "video",
                url,
            },
        };
    },
});

// ---------------------------------------------------------------------------
// Helper: format Tezos asset (mirrors server/src/utils/formatTezosAsset.ts)
// ---------------------------------------------------------------------------
function formatTezosAsset(token, account) {
    const ipfsToHttp = (uri) => {
        if (!uri) return null;
        if (uri.startsWith("ipfs://")) {
            return `https://ipfs.io/ipfs/${uri.slice(7)}`;
        }
        return uri;
    };

    return {
        image_preview_url:
            ipfsToHttp(token.display_uri) ||
            ipfsToHttp(token.thumbnail_uri) ||
            ipfsToHttp(token.artifact_uri),
        image_url:
            ipfsToHttp(token.display_uri) ||
            ipfsToHttp(token.thumbnail_uri) ||
            ipfsToHttp(token.artifact_uri),
        animation_url: ipfsToHttp(token.artifact_uri),
        name: token.title || token.name || `#${token.id}`,
        description: token.description,
        asset_contract: { address: "objkt" },
        token_id: token.id?.toString(),
        owner: { address: account },
        creator: { address: token.creator_id },
        collection: { name: "hic et nunc" },
        blockchain: "tezos",
        mime_type: token.mime,
        supply: token.supply,
    };
}
