import { z } from "zod";
import { proc, NoApi } from "@utils/rpc/server";
import { db } from "@utils/firebaseAdmin";

//? Used to check if the seleted file has already been uploaded if yes we give it's url
export const checkUploadedVrms = proc({
    cors: true,
    auth: true,

    schema: z.object({
        fileHash: z.string().min(1),
    }),

    async handler(opts): Promise<boolean> {
        //
        let hashDBDoc = await db
            .collection("vrm")
            .where("fileHash", "==", opts.fileHash)
            .where("userId", "==", this.userId)
            .get();

        return !hashDBDoc.empty;
    },
});

/**
 * Not found, All apis are accessible from index file
 */
export default NoApi;
