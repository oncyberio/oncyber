import { ensureLocalUploads } from "@utils/anon/ensureLocalUploads";
import { getMimeType, mimetoExt } from "@utils/mimeUtils";
import { checkUploadLimit, getFileHash } from "./utils";
import {
    checkAnonUploadExists,
    deleteAnonUploads,
    getAnonUploads,
    saveAnonUpload,
    updateAnonUpload,
} from "@utils/anon";
import { FileUploadCache } from "@utils/anon/FileUploadCache";

export class LocalUploader {
    //
    private static instance: LocalUploader;

    static get() {
        //
        if (LocalUploader.instance == null) {
            //
            LocalUploader.instance = new LocalUploader();
        }

        return LocalUploader.instance;
    }

    private fileCache: FileUploadCache;

    constructor() {
        //
        this.fileCache = FileUploadCache.getInstance();
    }

    async fetchUploads() {
        //
        await ensureLocalUploads();

        const data = await getAnonUploads();

        data.sort((a, b) => {
            return b.createdAt - a.createdAt;
        });

        return data;
    }

    deleteUpload({ hash }) {
        //
        return deleteAnonUploads({ hashes: [hash] });
    }

    updateUpload(hash, data) {
        //
        return updateAnonUpload(hash, data);
    }

    async saveUpload(opts: {
        file: File;
        mime: string;
        token: string;
        onProgress: (n: number) => unknown;
    }) {
        //
        let { file, mime, onProgress } = opts;

        checkUploadLimit(opts);

        await ensureLocalUploads();

        onProgress(0);

        const hash = await getFileHash(file);

        const existingUpload = await checkAnonUploadExists(hash);

        if (existingUpload?.exists) {
            //
            return {
                exists: true,
                url: existingUpload.url,
                d_optimized_files: existingUpload.d_optimized_files ?? null,
                name: file.name,
                hash,
                mimeType: mime,
            };
        }

        let url = existingUpload?.url;

        let d_optimized_files = existingUpload?.d_optimized_files ?? null;

        if (existingUpload == null) {
            //
            let name = file.name;

            let ext = mimetoExt[mime];

            const extIndex = name.lastIndexOf(".");

            if (extIndex >= 0) {
                name = name.slice(0, extIndex);
            }

            let resp = await this.fileCache.saveLocalFile({
                file,
                name,
                mimeType: mime,
                hash,
                id: "uploaded-assets/" + hash + "." + ext,
            });

            url = resp.url;

            mime = resp.mime;
            //
        } else {
            //
            mime = getMimeType(url);
        }

        await saveAnonUpload({
            hash,
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
            hash,
            mimeType: mime,
        };
    }
}
