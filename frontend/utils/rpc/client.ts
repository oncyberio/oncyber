import { combineAbortSignals, param } from "@utils/js";
import type { NextApiRequest, NextApiResponse } from "next";
import {
    decodeChecksum,
    decodePayload,
    encodeChecksum,
    encodePayload,
} from "./shared";

export interface RpcClientCtx {
    headers?: object;
    token?: string;
    timeout?: number;
    checksum?: boolean;
    encode?: true;
    signal?: AbortSignal;
}

export function api<T extends object>(route: string) {
    //

    type Handler = Exclude<keyof T, "cors" | "auth">;
    type ProxyType = {
        [K in Handler]: T[K] extends (...args: infer A) => Promise<infer R>
            ? (...args: A) => Promise<R>
            : never;
    } & { opts: (ctx: RpcClientCtx) => ProxyType };

    if (route.startsWith("file://")) {
        const idx = route.lastIndexOf("/pages/api");

        let suffix = route.lastIndexOf("/");

        if (idx < 0 || suffix < 0) {
            throw new Error("Invalid api path");
        }
        route = route.slice(idx + 6 /* or "/pages".length */, suffix);
    }

    const proxy = (ctx: RpcClientCtx): ProxyType =>
        new Proxy(target as any, {
            get(target, prop, receiver) {
                if (prop === "opts") {
                    return (opts) => {
                        return proxy({ ...ctx, ...opts });
                    };
                }
                return (...args: any[]) => {
                    return invokeRemoteRpcMethod(route, prop as any, args, ctx);
                };
            },
        }) as ProxyType;

    return proxy({});
}

function target(req: NextApiRequest, res: NextApiResponse) {
    res.status(404).send("Not found");
}

export async function invokeRemoteRpcMethod(
    route: string,
    method: string,
    params: any[],
    ctx: RpcClientCtx = {}
) {
    const rpcError = (err) => {
        throw new Error(`RPC Error at '${route}/${method}' : \n\n${err}`, {
            cause: err,
        });
    };
    //
    console.log("rpc", route, method, params[0], ctx);

    let payload: any = {
        type: "method",
        method,
        params,
    };

    let signals: AbortSignal[] = [];

    if (ctx.signal) {
        signals.push(ctx.signal);
    }

    let timeoutId;
    let wasTimeouted = false;
    if (ctx.timeout) {
        let timeoutAbort = new AbortController();
        timeoutId = setTimeout(() => {
            wasTimeouted = true;
            timeoutAbort.abort("timeout");
        }, ctx.timeout);
        signals.push(timeoutAbort.signal);
    }

    let signal = combineAbortSignals(signals);

    let data;

    if (ctx.checksum) {
        payload = await encodeChecksum(payload);
    }

    if (ctx.encode) {
        payload = encodePayload(payload);
    }

    try {
        const response = await fetch(route, {
            method: "POST",
            headers: {
                // ...ctx.headers,
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            credentials: "include",
            signal,
        });
        clearTimeout(timeoutId);

        if (response.status === 404) {
            rpcError("Not found " + route);
        }
        if (response.status === 401) {
            rpcError("Unauthorized");
        }

        data = await response.json();

        if (ctx.encode) {
            data = decodePayload(data);
        }

        if (ctx.checksum) {
            data = await decodeChecksum(data, true);
        }

        //
    } catch (err) {
        //
        clearTimeout(timeoutId);

        if (wasTimeouted) {
            rpcError("Request timeout");
        }
        rpcError(err.message);
    }

    if (data.type === "Error") {
        rpcError(data.error);
    }

    return data.value;
}
