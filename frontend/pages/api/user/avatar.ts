import { NextApiRequest, NextApiResponse } from "next";
import { auth } from "@utils/middlewares/authMiddleware";
import { db } from "@utils/firebaseAdmin";
import { MAX_IMAGE_SIZE, uploadUrlToPinata } from "@utils/pinataUpload";
import { gatewayCanResize, type ImageType } from "@utils/imageType";
import { invalidateUserProfile } from "@utils/firestore/userProfiles";

export function avatarGatewayUrl(
    ipfsHash: string,
    publicId: string,
    imageType: ImageType | null
) {
    const base = `https://cyber.mypinata.cloud/ipfs/${ipfsHash}`;
    return gatewayCanResize(imageType)
        ? `${base}?img-width=256&filename=${publicId}.jpg`
        : `${base}?filename=${publicId}.${imageType || "img"}`;
}

export async function uploadAsset(
    userId: string,
    fileUrl: string,
    avatarContractAddress: string,
    avatarTokenId: string
) {
    try {
        const publicId = `${avatarContractAddress}/${avatarTokenId}/${new Date().getTime()}`;

        const pinata = await uploadUrlToPinata(
            fileUrl,
            publicId,
            "image/jpeg",
            MAX_IMAGE_SIZE,
            // NFT media hosts pick a format per request. Ask for ones the
            // gateway can resize; some answer with AVIF regardless.
            { accept: "image/jpeg,image/png,image/webp,image/gif" }
        );

        const ipfsHash = pinata?.public_id;

        if (!ipfsHash) throw new Error("Failed to upload file");

        // The gateway's resizer answers 415 for a format it can't read
        // (AVIF, SVG...), which left the picture broken everywhere. Those
        // are served as they are: browsers show them.
        const url = avatarGatewayUrl(ipfsHash, publicId, pinata.imageType);

        return url;
    } catch (error) {
        console.error(
            "[UPLOAD_MEDIA:UPLOAD_EXHIBIT_HERO_IMG.v2.uploader.upload/error] 3",
            error
        );
        throw error;
    }
}

export default async (req: NextApiRequest, res: NextApiResponse) => {
    try {
        let userId = await auth(req);

        const { avatarContractAddress, avatarTokenId } = req.query;

        // if (Number(req.headers["content-length"]) / 1024 / 1024 > 1.2) {
        //     return res.json({
        //         success: false,
        //         message: "Failed to upload avatar. Size too big.",
        //     });
        // }

        const { avatarUrl } = req.body;

        try {
            const url = await uploadAsset(
                userId,
                avatarUrl as string,
                avatarContractAddress as string,
                avatarTokenId as string
            );

            const snap = await db
                .collection("users")
                .where("walletId", "==", userId.toLowerCase())
                .get();

            if (snap.empty) {
                return res.json({
                    success: false,
                    message: "user not found.",
                });
            }

            // Save to db the new avatar link
            await db.collection("users").doc(snap.docs[0].id).update({
                avatar: url,
            });

            // Keep the cached walletId->profile snapshot from serving the old
            // avatar for a full TTL.
            invalidateUserProfile(userId);

            res.json({
                success: true,
                url,
            });
        } catch (error) {
            console.error("[UPLOAD_MEDIA/catch]", error);

            return res.json({ success: false, error });
        }
    } catch (err) {
        res.json({
            success: false,
            message: "Failed to upload avatar",
        });
    }
};
