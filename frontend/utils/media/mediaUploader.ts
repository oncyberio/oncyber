import { MediaInfo, UploadableMediaInfo } from "@uitypes/mediaInfo";
import { Asset } from "@uitypes/Asset";
import {
    gcloud_optimizeAsset,
    UploadExhibitPreviewOpts,
} from "../gcloud/uploader";

import UploaderApi from "@api/uploader/_api";
import { Result, Success } from "@utils/js";
import { cloudinary } from "@utils/urlUtils";
import { FileUploadCache } from "@utils/anon/FileUploadCache";
import { uploadFile as UploadPinata } from "@utils/factory/httpPinata";
import { mimetoExt } from "@utils/mimeUtils";

export interface AssetMediaInfo {
    mediaInfo: MediaInfo;
    coverMediaInfo?: MediaInfo;
}

export interface GetUploadOpts {
    exhibitId: string;
    assetId: string;
    token?: string;
}

export async function uploadAssetMedia({
    exhibitId,
    assetId,
    token,
}: GetUploadOpts) {
    //

    return gcloud_optimizeAsset(exhibitId, assetId, token);
}

export interface GetUploadOptsFile {
    exhibitId: string;
    asset: Asset;
    mediaInfo: UploadableMediaInfo;
    file: Blob;
    token: string;
    onProgress?: (loaded: number, total?: number) => unknown;
}

export async function uploadAssetMediaFile({
    exhibitId,
    asset,
    mediaInfo,
    file,
    token,
    onProgress,
}: GetUploadOptsFile) {
    //
    //
    const { id, contract_address, token_id, mime_type } = asset;

    const publicId = `${contract_address}/${cloudinary.sanitizePublicID(
        token_id
    )}`;

    const result = await uploadFile({
        file,
        id: publicId,
        mimeType: mediaInfo.mime_type,
        isUnique: true,
        token,
        onProgress,
    });

    return UploaderApi.opts({ encode: true }).updateAssetMedia({
        exhibitId,
        assetId: id,
        contract_address,
        token_id,
        mediaInfo: { ...mediaInfo, url: result.secure_url },
    });
}

export async function uploadPortalPreviews(
    opts: UploadExhibitPreviewOpts,
    token?: string,
    isAnonymous?: boolean
): Promise<Result<{ url: string; url360: string }>> {
    //
    if (isAnonymous) {
        //
        const cache = FileUploadCache.getInstance();

        let res: any = {};

        let ps = [];

        if (opts.heroImg) {
            //
            ps.push(
                cache
                    .saveLocalFile({
                        file: opts.heroImg,
                        mimeType: "image/jpeg",
                    })
                    .then((r) => {
                        //
                        res["heroImg"] = r.url;
                    })
            );
        }

        if (opts.heroImg360) {
            //
            ps.push(
                cache
                    .saveLocalFile({
                        file: opts.heroImg360,
                        mimeType: "image/jpeg",
                    })
                    .then((r) => {
                        //
                        res["heroImg360"] = r.url;
                    })
            );
        }

        await Promise.all(ps);

        return Success({
            url: res.heroImg,
            url360: res.heroImg360,
        });
    } else {
        // @ts-ignore
        return uploadExhibitHeroImg(opts, token);
    }
}

export async function uploadExhibitHeroImg(
    opts: UploadExhibitPreviewOpts,
    token?: string
) {
    //

    const { heroImg, heroImg360, portalId, fHeroImg } = opts;

    const uploadExhibitMedia = (file) => {
        return uploadFile({
            file,
            id: `exhibit-preview-${opts.exhibitId}`,
            mimeType: "image/jpeg",
            token: token || "",
        });
    };

    const [result, result360, fresult] = await Promise.all([
        heroImg ? uploadExhibitMedia(heroImg) : null,
        heroImg360 ? uploadExhibitMedia(heroImg360) : null,
        fHeroImg ? uploadExhibitMedia(fHeroImg) : null,
    ]);

    return Success({
        url: result?.secure_url,
        url360: result360?.secure_url,
        furl: fresult?.secure_url,
    });
}

export interface UploadOpts {
    file: Blob | string;
    id?: string;
    mimeType: string;
    token: string;
    isUnique?: boolean;
    onProgress?: (loaded: number, total?: number) => unknown;
}

export async function uploadOrCacheFile(
    opts: UploadOpts,
    isAnonymous: boolean
): Promise<{ url: string; secure_url: string }> {
    //

    if (isAnonymous) {
        //
        const res = await FileUploadCache.getInstance().saveLocalFile(opts);

        return {
            url: res.url,
            secure_url: res.url,
        };
        //
    } else {
        //
        return uploadFile(opts);
    }
}

export interface UploadFileResult {
    url: string;
    secure_url: string;
    public_id: string;
}

export const uploadFile = async ({
    file,
    id,
    mimeType,
    token,
    isUnique = false,
    onProgress,
}: UploadOpts): Promise<UploadFileResult> => {
    //
    let upload: Blob;

    if (typeof file === "string") {
        // convert base64 to blob
        const res = await fetch(file);

        file = await res.blob();
    }

    upload = file;

    const pinata = await UploadPinata(upload);

    const ipfsHash = pinata?.IpfsHash;

    if (!ipfsHash) throw new Error("Failed to upload file");

    const ext = mimetoExt[mimeType];

    const url = `https://cyber.mypinata.cloud/ipfs/${ipfsHash}?filename=${id}.${ext}`;

    if (!url) {
        throw "err";
    }

    return {
        url,
        secure_url: url,
        public_id: ipfsHash,
    };
};

export interface UploadFileBatchOpts {
    uploads: Array<{ id: string; file: Blob | string; mimeType: string }>;
    token: string;
}

export async function uploadFileBatch({
    uploads,
    token,
}: UploadFileBatchOpts): Promise<UploadFileResult[]> {
    let result: Array<UploadFileResult> = [];

    for (let i = 0; i < uploads.length; i++) {
        const upload = uploads[i];

        const res = await uploadFile({
            file: upload.file,
            id: upload.id,
            mimeType: upload.mimeType,
            token,
            isUnique: true,
        });

        result.push(res);
    }

    return result;
}

export async function uploadKitbashImages(
    room: string,
    images: Array<{ type: string; image: string }>,
    token: string
) {
    const kbImgUploads: UploadFileBatchOpts["uploads"] = images.map((it) => {
        return {
            id: `kitb-preview-${room}-${it.type}`,
            mimeType: "image/jpeg",
            file: it.image,
        };
    });

    let imgUploads = await uploadFileBatch({
        uploads: kbImgUploads,
        token,
    });

    return imgUploads.map((it, i) => {
        //
        const img = images[i];

        return {
            ...img,
            url: it.secure_url,
        };
    });
}
