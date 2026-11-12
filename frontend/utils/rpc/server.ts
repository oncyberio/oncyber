import { auth, getToken } from "@utils/middlewares/authMiddleware";
import { corsMiddleware } from "@utils/middlewares/corsMiddleware";
import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import {
    CHECKSUM_ID,
    decodeChecksum,
    decodePayload,
    EID,
    encodeChecksum,
    encodePayload,
} from "./shared";

export interface RpcServerContext {
    req: NextApiRequest;
    res: NextApiResponse;
    userId?: string;
    token?: string;
}

type Input<T extends z.ZodTypeAny> = z.infer<T>;

interface RpcOpts<T extends z.ZodTypeAny, R> {
    cors?: boolean;
    auth?: boolean | ((x: Input<T>) => boolean);
    schema: T;
    handler: (this: RpcServerContext, x: Input<T>) => Promise<R>;
}

type RpcServerMethod<T extends z.ZodTypeAny, R> = (
    this: RpcServerContext,
    x: Input<T>
) => Promise<R>;

export function proc<T extends z.ZodTypeAny, R>(
    opts: RpcOpts<T, R>
): RpcServerMethod<T, R> {
    //
    let handler: any = opts.handler;
    handler._RPC_OPTS = opts;
    return handler;
}

const idDev = process.env.NODE_ENV === "development";

export function api<T extends object>(server: T) {
    //
    async function target(req: NextApiRequest, res: NextApiResponse) {
        //
        let hasChecksum = false;
        let isEncoded = req.body?.[EID];


        try {
            //

            if (req.method !== "POST") {
                throw new Error("Invalid method");
            }

            /**
             * In the server we don't force checksums, since the request can be
             * from other apps. But if the checksum is present then we verify it
             */
            let payload = req.body;

            if (isEncoded) {
                payload = decodePayload(payload);
            }

            hasChecksum = payload?.[CHECKSUM_ID];

            if (hasChecksum) {
                payload = await decodeChecksum(payload, true);
            }

            const method = payload?.method as string;
            const params = payload?.params as any;

            if (!Array.isArray(params)) {
                throw new Error("Invalid params");
            }

            const rpcHandler = (server as any)[method];

            if (
                typeof rpcHandler !== "function" ||
                rpcHandler._RPC_OPTS == null
            ) {
                throw new Error("Invalid Method " + method);
            }

            const opts = rpcHandler._RPC_OPTS;

            const ctx: RpcServerContext = {
                req,
                res,
            };

            let arg = params[0];

            if (opts.schema) {
                try {
                    arg = opts.schema.parse(params[0]);
                } catch (err) {
                    const msg = getSchemaErrMsg(err.message);

                    return sendPayload(
                        res,
                        400,
                        { type: "Error", error: msg },
                        hasChecksum,
                        isEncoded
                    );
                }
            }

            const isCors = opts.cors ?? (server as any).cors;
            const isAuthOpt = opts.auth ?? (server as any).auth;
            try {
                if (isCors) {
                    await corsMiddleware(req, res);
                }

                const isAuth =
                    typeof isAuthOpt === "function"
                        ? isAuthOpt(params.concat(ctx))
                        : isAuthOpt;

                try {
                    ctx.userId = await auth(req);
                    ctx.token = getToken(req);
                } catch (err) {
                    if (isAuth) {
                        throw new Error("Unauthorized");
                    }
                }
            } catch (err) {
                console.error(err);

                return sendPayload(
                    res,
                    401,
                    { type: "Error", error: "Unauthorized" },
                    hasChecksum,
                    isEncoded
                );
            }

            const result = await rpcHandler.call(ctx, arg);

            const json = {
                type: "Success",
                value: result,
            };
            //
            sendPayload(res, 200, json, hasChecksum, isEncoded);
        } catch (err) {
            console.error(err);

            const json = {
                type: "Error",
                error: err.message || "Unkown server error",
            };

            try {
                sendPayload(res, 500, json, hasChecksum, isEncoded);
            } catch (err) {
                sendPayload(res, 500, json, false, false);
            }
        }
    }

    return new Proxy(target, {
        get(target, prop) {
            return (server as any)[prop];
        },
    }) as T;
}

async function sendPayload(
    res: NextApiResponse,
    status: number,
    payload: any,
    hasChecksum: boolean,
    isEncoded: boolean
) {
    if (hasChecksum) {
        payload = await encodeChecksum(payload);
    }

    if (isEncoded) {
        payload = encodePayload(payload);
    }

    res.status(status).json(payload);
}

function getSchemaErrMsg(v: string) {
    try {
        const data = JSON.parse(v);
        return data?.map?.(formatSchemaErr) || "Invalid Params";
    } catch (err) {
        return v;
    }
}

function formatSchemaErr(err: any) {
    return [
        `Invalid Param ${err.path.join(".")}`,
        `\terror: ${err.message}`,
    ].join("\n");
}

export function NoApi(req: NextApiRequest, res: NextApiResponse) {
    res.status(404).send("Not found");
}
