//

interface Opts {
    type?: "buffer" | "dataUrl";
}

type ResultType<T extends Opts> = T extends { type: "buffer" }
    ? ArrayBuffer
    : string;

export const fileReaderPromisify = async <T extends Opts>(
    file,
    opts?: T
): Promise<ResultType<T>> => {
    return new Promise((resolve, reject) => {
        //
        const reader = new FileReader();

        reader.onload = async () => {
            try {
                resolve(reader.result as any);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = (error) => {
            reject(error);
        };

        if (opts?.type === "buffer") {
            //
            reader.readAsArrayBuffer(file);
        } else {
            //
            reader.readAsDataURL(file);
        }
    });
};

export const getResult = async (reader: FileReader) => {
    return new Promise((resolve, reject) => {
        if (reader.result) {
            resolve(reader.result);
        }

        reader.onload = async () => {
            try {
                resolve(reader.result);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = (error) => {
            reject(error);
        };
    });
};

export function blobToDataUrl(blob: Blob) {
    //
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async () => {
            try {
                // @ts-ignore
                resolve(reader.result);
                //
            } catch (err) {
                //
                reject(err);
            }
        };

        reader.onerror = (error) => {
            //
            reject(error);
        };

        reader.readAsDataURL(blob);
    });
}

export function dataUrlToBlob(url: string) {
    //
    return fetch(url).then((r) => r.blob());
}

export function fileToBlob(file: File) {
    //
    return fileReaderPromisify(file, {
        type: "buffer",
    }).then((buffer) => {
        //
        return new Blob([buffer], {
            type: file.type,
        });
    });
}
