import { blobToDataUrl, dataUrlToBlob, fileToBlob } from "@utils/fileReader";
import { isObject } from "@utils/js";

//
const UPLOAD_CACHE = "local-uploads";

const ANON_URL_PREFIX = `https://oncyber.io/${UPLOAD_CACHE}/`;

export interface FileInfo {
    id: string;
    name: string;
    mimeType: string;
    url: string;
    hash: string;
    file: Blob | string;
}

export class FileUploadCache {
    // map from cache key to blob url
    urlMap: Record<string, string>;

    _cache: Cache;

    async getCache() {
        if (this._cache == null) {
            this._cache = await caches.open(UPLOAD_CACHE);
        }

        return this._cache;
    }

    private static instance: FileUploadCache;

    static getInstance() {
        //
        if (this.instance == null) {
            //
            this.instance = new FileUploadCache();
        }

        return this.instance;
    }

    // private async preload(entries: string[]) {
    //     // prelaod blobs and store in cache

    //     const cache = await this.getCache();

    //     entries.forEach((url) => {
    //         //
    //         cache.match(url).then((response) => {
    //             //
    //             if (response) {
    //                 //
    //                 response.blob().then((blob) => {
    //                     //
    //                     const blobUrl = URL.createObjectURL(blob);

    //                     this.urlMap[url] = blobUrl;
    //                 });
    //             }
    //         });
    //     });
    // }

    async saveLocalFile(opts: {
        file: Blob | string;
        hash?: string;
        mimeType: string;
        id?: string;
        name?: string;
    }): Promise<{ url: string; mime: string }> {
        //
        const id = opts.id ?? `u${Date.now() / 1000}`;

        const url = ANON_URL_PREFIX + id;

        const request = new Request(url, {
            headers: {
                "Content-Type": opts.mimeType,
            },
        });

        const isDataUrl =
            typeof opts.file === "string" && opts.file.startsWith("data:");

        let body: Blob;

        if (isDataUrl) {
            //
            body = await dataUrlToBlob(opts.file as string);
            //
        } else if (opts.file instanceof File) {
            //
            body = await fileToBlob(opts.file);
            //
        } else if (opts.file instanceof Blob) {
            //
            body = opts.file;
            //
        } else {
            //
            throw new Error("Invalid file type");
        }

        const response = new Response(body, {
            headers: {
                "Content-Type": opts.mimeType,
                "x-name": opts.name || opts.file["name"] || id,
                "x-hash": opts.hash || opts.id,
                "x-type": isDataUrl ? "url" : "blob",
            },
        });

        const cache = await caches.open(UPLOAD_CACHE);

        await cache.put(request, response);

        return { url, mime: opts.mimeType };
    }

    async delete(key: string) {
        //
        const cache = await this.getCache();

        return cache.delete(key);
    }

    clear() {
        //
        return caches.delete(UPLOAD_CACHE);
    }

    traverseUrls(
        obj: any,
        cb: (url: string, slot: any, key: string, path: string[]) => unknown,
        path: string[] = []
    ) {
        //
        // deeply update all fields in obj that starts with ANON_URL_PREFIX using urlMap
        Object.keys(obj).forEach((key) => {
            //
            const val = obj[key];

            path = path.concat(key);

            if (typeof val === "string" && val.startsWith(ANON_URL_PREFIX)) {
                //
                const id = val.slice(ANON_URL_PREFIX.length);

                cb(val, obj, key, path);
            }

            if (isObject(val)) {
                //
                this.traverseUrls(val, cb, path);
            }
        });
    }

    getUploadUrls(obj: any) {
        //
        const urls: string[] = [];

        this.traverseUrls(obj, (url) => {
            //
            if (!urls.includes(url)) {
                //
                urls.push(url);
            }
        });

        return urls;
    }

    async getBlobs(urls: string[]): Promise<Record<string, FileInfo>> {
        //
        let map: Record<string, FileInfo> = {};

        await Promise.all(
            //
            urls.map(async (url) => {
                //
                const cache = await this.getCache();

                let response = await cache.match(url);

                if (response) {
                    //
                    response = response.clone();

                    const type = response.headers.get("x-type");

                    let file: Blob | string = await response.blob();

                    if (type === "url") {
                        //
                        file = await blobToDataUrl(file);
                    }

                    map[url] = {
                        url,
                        id: url.slice(ANON_URL_PREFIX.length),
                        name: response.headers.get("x-name"),
                        mimeType: response.headers.get("Content-Type"),
                        hash: response.headers.get("x-hash"),
                        file,
                    };
                    //
                } else {
                    //
                    throw new Error(`Could not find blob for url: ${url}`);
                }
            })
        );

        return map;
    }
}
