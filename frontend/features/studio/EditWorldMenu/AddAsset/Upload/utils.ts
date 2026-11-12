import { FetchedAsset } from "@uitypes/Asset";
import { cloudinary } from "@utils/urlUtils";
import AssetService from "@api/anyUpload/_api";
import { LocalUploader } from "./LocalUploader";
import { RemoteUploader } from "./RemoteUploader";
import { getDefaultMimePreview } from "@features/studio/utils";
import { isUploadable, isAnimationUrl } from "@utils/mimeUtils";
//
const IMAGE_SIZE_LIMIT = 10 * 1024 * 1024;

const ANIM_SIZE_LIMIT = 30 * 1024 * 1024;

export function getSWRUploadKey(userId: string) {
    //
    return `uploads/${userId}`;
}

export function checkUploadSizeLimit(mimeType: string, fileSize: number) {
    //
    if (mimeType.startsWith("image/")) {
        return fileSize <= IMAGE_SIZE_LIMIT;
    }
    return fileSize < ANIM_SIZE_LIMIT;
}

export function getPreviewUrl(url: string, mimeType: string) {
    //
    if (mimeType.startsWith("image/")) {
        //
        return url;
    }

    let previewUrl = null;

    if (mimeType.startsWith("video/") && cloudinary.isCloudinaryUrl(url)) {
        //
        previewUrl = cloudinary.toExt(url, "jpg");
        //
    }

    if (mimeType.startsWith("audio/")) {
        previewUrl = getDefaultMimePreview(mimeType);
    }

    return previewUrl;
}

export async function formatUploadedAsset(
    { url, name, hash, mimeType, d_optimized_files = null },
    creatorId,
    profile
) {
    //
    const user = {} as any;

    if (profile?.avatar) {
        user.profile_img_url = profile.avatar;
    }

    if (profile?.username) {
        user.username = profile?.username;
    }

    let previewUrl = getPreviewUrl(url, mimeType);

    if (mimeType == "video/avi") {
        //
        mimeType = "video/mp4";

        url = cloudinary.toExt(url, "mp4");
        //
    } else if (mimeType === "image/gif" && cloudinary.isCloudinaryUrl(url)) {
        //
        mimeType = "video/mp4";

        url = cloudinary.toExt(url, "mp4");
    }

    let asset: FetchedAsset = {
        mime_type: mimeType,
        owner: {
            user: {
                username: "NullAddress",
            },
            profile_img_url:
                "https://storage.googleapis.com/opensea-static/opensea-profile/1.png",
            address: "0x0000000000000000000000000000000000000000",
            // @ts-ignore
            // ?? why this
            config: "",
        },
        // @ts-ignore
        blockchain: "no-chain",
        source: {
            blockchain: "none",
            api: "oncyber",
        },
        isCreatorButNotOwned: true,
        image_preview_url: previewUrl,
        image_url: previewUrl,
        name,
        description: "No description provided",
        isOwned: false,
        token_id: hash,
        creator: {
            address: creatorId,
            user,
        },
    };

    if (isAnimationUrl(mimeType)) {
        // Set animation URLs
        asset.animation_url = asset.dcompressed_animation_url = url;

        if (mimeType.startsWith("model/gltf")) {

            let needsOptimizedFilesRefresh = false;
            let needsAnimationUrlRefresh = false;

            if (d_optimized_files) {
                //
                const hasCloudinaryURLs = cloudinary.isBrokenCloudinaryUrl(d_optimized_files?.high)
                    || cloudinary.isBrokenCloudinaryUrl(d_optimized_files?.low)
                    || cloudinary.isBrokenCloudinaryUrl(d_optimized_files?.low_compressed);

                if (hasCloudinaryURLs) {
                    needsOptimizedFilesRefresh = true;
                }
            }

            if (asset.animation_url && cloudinary.isBrokenCloudinaryUrl(asset.animation_url)) {
                needsAnimationUrlRefresh = true;
            }

            if (needsOptimizedFilesRefresh || needsAnimationUrlRefresh) {
                const refreshedAsset = await AssetService.getAssetsByHash({ hash });

                if (refreshedAsset) {
                    // Only update d_optimized_files if needed
                    if (needsOptimizedFilesRefresh && refreshedAsset?.d_optimized_files) {
                        asset.d_optimized_files = refreshedAsset.d_optimized_files;
                    }

                    // Only update animation URLs if needed
                    if (needsAnimationUrlRefresh && refreshedAsset?.d_url) {
                        const asset_url = refreshedAsset.d_url;
                        asset.animation_url = asset_url;
                        asset.original_animation_url = asset_url;
                        asset.dcompressed_animation_url = asset_url;
                    }
                }
            }

        }
    } else {
        // 
        asset.image_url = asset.dcompressed_image_url = url;
    }

    return asset;
}

export type UserAsseUpload = Awaited<
    ReturnType<RemoteUploader["fetchUploads"]>
>[number];

export function getUploadErrorMsg(err: Error) {
    let title = "Upload error";
    let message = "Failed to upload file";

    if (err.message === "exists") {
        //
        title = "Upload error";
        message = "File already exists";
    }
    if (err.message === "mime") {
        title = "Unsupported mime type";
        message = "File must be either an image, video, audio or GLB model";
    } else if (err.message === "size-limit") {
        title = "File size too big";
        message =
            "Maximum file size is curently 10Mb for images and 30Mb for 3D models, videos ...";
    }

    return { title, message };
}

export function checkUploadLimit(opts) {
    //
    let { file, mime } = opts;

    if (mime == null || !isUploadable(mime)) {
        //
        throw new Error("mime");
    }

    if (!checkUploadSizeLimit(mime, file.size)) {
        //
        throw new Error("size-limit");
    }
}

export async function getFileHash(file: File) {
    //
    const fileDataUrl = await new Promise<string>((resolve, reject) => {
        //
        const reader = new FileReader();

        reader.readAsDataURL(file);

        reader.addEventListener(
            "load",
            () => {
                resolve(reader.result as string);
            },
            false
        );
    });

    const buffer = new TextEncoder().encode(fileDataUrl);

    const hash = await crypto.subtle.digest("SHA-256", buffer);

    const hashHex = Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    return hashHex;
}

export function getUploader(isAnon: boolean) {
    //
    if (isAnon) {
        //
        return LocalUploader.get();
    } else {
        return RemoteUploader.get();
    }
}
