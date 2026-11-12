import { Asset, FetchedAsset } from "@uitypes/Asset";
import { Failure, Result } from "@utils/js";
import cookie from "cookie";

// Cloud Functions base URL. Defaults to the configured Firebase project; set
// NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL to use the emulator or another region,
// e.g. http://127.0.0.1:5001/<project>/us-central1.
export const BASE_URL =
    process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL ||
    `https://us-central1-${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.cloudfunctions.net`;

export const fns = {
    optimiseAsset: "optimize_v2_ipfs/asset",
    uploadExhibitPreview: "upload_v2_ipfs/exhibitPreview",
};

type OptimiseAssetResult = Pick<
    Asset,
    | "dcompressed_image_url"
    | "dcompressed_animation_url"
    | "mime_type"
    | "cover_mime_type"
    | "d_optimized_files"
>;

export async function gcloud_optimizeAsset(
    exhibitId: string,
    assetId: string,
    token?: string
): Promise<Result<OptimiseAssetResult>> {
    //
    try {
        if (token == null && typeof window !== "undefined") {
            //
            const cookies = cookie.parse(document.cookie);

            token = cookies[cookies["_CCA"]];
        }

        const params = new URLSearchParams();
        params.set("exhibitId", exhibitId);
        params.set("assetId", assetId);
        params.set("sendEvent", "true");

        const url = `${BASE_URL}/${fns.optimiseAsset}?${params}`;

        const response = await fetch(url, {
            headers: {
                "x-token": token,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
        });

        const result = (await response.json()) as any;

        return result;
    } catch (err) {
        console.error(err);
        return Failure(err);
    }
}

export interface UploadExhibitPreviewOpts {
    exhibitId: string;
    portalId: string;
    heroImg: string;
    heroImg360: string;
    fHeroImg?: string;
}

export type UploadExhibitPreviewResult = {
    payload: any;
    url: string;
    url360: string;
    furl: string;
};

export async function gcloud_uploadExhibitPreview(
    opts: UploadExhibitPreviewOpts,
    token?: string
): Promise<Result<UploadExhibitPreviewResult>> {
    //
    try {
        if (token == null && typeof window !== "undefined") {
            //
            const cookies = cookie.parse(document.cookie);

            token = cookies[cookies["_CCA"]];
        }

        if (!token) {
            //
            return Failure("Not logged in");
        }

        const body = JSON.stringify(opts);

        const url = `${BASE_URL}/${fns.uploadExhibitPreview}`;

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "x-token": token,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body,
        });

        const result = (await response.json()) as any;

        return result;
    } catch (err) {
        console.error(err);
        return Failure(err.message);
    }
}
