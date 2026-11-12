import UploadService from "@api/anyUpload/_api";
import AnyUploadService from "@api/anyUpload/_api";
import { getMimeType, mimetoExt } from "@utils/mimeUtils";
import { checkUploadLimit, getFileHash } from "./utils";
import { uploadFile } from "@utils/media/mediaUploader";

export class RemoteUploader {
    //
    //
    private static instance: RemoteUploader;

    static get() {
        //
        if (this.instance == null) {
            //
            this.instance = new RemoteUploader();
        }

        return this.instance;
    }

    constructor() {}

    async fetchUploads() {
        //
        const data = await UploadService.getUploadedAssets({});

        data.sort((a, b) => {
            return b.createdAt - a.createdAt;
        });

        return data;
    }

    deleteUpload({ hash }) {
        //
        return UploadService.deleteUploads({ hashes: [hash] });
    }

    updateUpload(hash, data) {
        //
        return UploadService.updateUpload({ hash, data });
    }

    async saveUpload(opts: {
        file: File;
        mime: string;
        token: string;
        onProgress: (n: number) => unknown;
    }) {
        //


        let { file, mime, token, onProgress } = opts;

        checkUploadLimit(opts);

        onProgress(0);

        const hashHex = await getFileHash(file);

        const existingUpload = await AnyUploadService.checkUploadedAssets({
            fileHash: hashHex,
        });

        if (existingUpload?.exists) {
            //
            const url = existingUpload.url;

            return {
                exists: true,
                url,
                d_optimized_files: existingUpload.d_optimized_files,
                name: file.name,
                hash: hashHex,
                mimeType: mime,
            };
        }

        let url = existingUpload?.url;

        let d_optimized_files = existingUpload?.d_optimized_files;

        if (
            existingUpload == null ||
            (mime === "image/gif" && url && !url.endsWith(".mp4"))
        ) {
            //
            let ext = mimetoExt[mime];

            const options = {
                file,
                token,
                mimeType: mime,
                id: hashHex,
                onProgress: (loaded, total) => {
                    onProgress(Math.round((loaded * 100) / total));
                },
            };

            const cResp = await uploadFile(options);

            url = cResp.secure_url;
        } else {
            //
            mime = existingUpload.mimeType ?? getMimeType(url) ?? mime;
        }

        await AnyUploadService.setUploadedAssets({
            hash: hashHex,
            url,
            d_optimized_files,
            name: file.name,
            mimeType: mime,
        });

        return {
            exists: false,
            url,
            d_optimized_files,
            name: file.name,
            hash: hashHex,
            mimeType: mime,
        };
    }
}
