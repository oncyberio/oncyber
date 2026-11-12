import { bufferToHex, hexToBuffer } from "@utils/js";

export function isPrimitive(obj: any) {
    return obj !== Object(obj);
}

export function serialize(obj: any): string {
    if (Array.isArray(obj)) {
        return `[${obj.map((el) => serialize(el)).join(",")}]`;
    } else if (typeof obj === "object" && obj !== null) {
        let acc = "";
        const keys = Object.keys(obj).sort();
        acc += `{${JSON.stringify(keys)}`;
        for (let i = 0; i < keys.length; i++) {
            acc += `${serialize(obj[keys[i]])},`;
        }
        return `${acc}}`;
    }

    return `${JSON.stringify(obj)}`;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const EID = "$$";

let search = typeof window != "undefined" ? window.location.search : "?";
const params = new URLSearchParams(search);
const noEncode = process.env.NODE_ENV === "development";

export function encodePayload(obj) {
    if (noEncode) return obj;
    const str = JSON.stringify(obj);
    let array = textEncoder.encode(str).map((n) => ~n);
    return { [EID]: bufferToHex(array) };
}

export function decodePayload(obj) {
    if (noEncode) return obj;
    const array = hexToBuffer(obj[EID]).map((n) => ~n);
    const str = textDecoder.decode(array);
    return JSON.parse(str);
}

function getCrypto() {
    if (typeof window != "undefined") {
        return window.crypto;
    } else {
        // we use eval because this throws an error when using webpack 5
        return eval("require('node:crypto').webcrypto");
    }
}

async function hashNative(obj: any, ts: string) {
    const crypto = getCrypto();

    const str = serialize({ ...obj, __kh__: ts });
    let data = textEncoder.encode(str).map((n) => ~n);
    const buffer = await crypto.subtle.digest("SHA-256", data);
    const array = Array.from(new Uint8Array(buffer));
    return array.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hash(obj: any, ts: string) {
    const buf = await hashNative(obj, ts);
    return "0x" + buf + ts;
}

const TS_LEN = 10;
export const CHECKSUM_ID = "@@PID";

export async function encodeChecksum(obj: any) {
    const ts = String(Date.now()).slice(0, 10);
    const buf = await hash(obj, ts);
    return {
        [CHECKSUM_ID]: buf,
        ...obj,
    };
}

export async function decodeChecksum(obj: any, requireChecksum: boolean) {
    //

    if (obj == null || obj[CHECKSUM_ID] == null) {
        if (requireChecksum) {
            throw new Error("Invalid payload");
        }
        return obj;
    }

    const { [CHECKSUM_ID]: s, ...rest } = obj || {};

    const ts = s.slice(s.length - TS_LEN);

    if (!s) throw new Error("Invalid payload");

    const h = await hash(rest, ts);

    if (h !== s) {
        //
        throw new Error("Invalid payload");
    }

    return rest;
}
