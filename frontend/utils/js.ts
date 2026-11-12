import { RoomParameters } from "@uitypes/roomParameters";
import { Duration, Moment } from "moment";

export const TWO_PI = Math.PI * 2;

export function noop(...x: any[]) {}

export function findByValue<O extends Record<string, any>>(
    value: O[string],
    obj: O
): string {
    if (obj == null) return null;
    for (let key in obj) {
        if (obj[key] === value) return key;
    }

    return null;
}

export const hasOwn =
    Object.hasOwn ??
    function (obj: object, key: PropertyKey) {
        return Object.prototype.hasOwnProperty.call(obj, key);
    };

export function classes(cls: Record<string, any>) {
    //
    return Object.keys(cls)
        .map((className) => {
            //
            return cls[className] ? className : "";
        })
        .join(" ");
}

export function isInIFrame() {
    if (typeof window === "undefined") return false;

    return window.location !== window.parent.location;
}

export function eachKey<T1, T2, O extends Record<string, T1>>(
    obj: O,
    fn: (v: T1, key: string) => T2
): Record<string, T2> {
    //
    if (obj == null) return obj as any;

    let result: Record<string, T2> = {};

    for (let key in obj) {
        result[key] = fn(obj[key], key);
    }

    return result;
}

export function sameRef<T>(t1: T, t2: T) {
    return t1 === t2;
}

export function isPrimitive(obj) {
    return obj !== Object(obj);
}

export function serialize(obj: any) {
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

export function deepEqual(x, y) {
    //
    if (x === y || (x == null && y == null)) {
        return true;
    }

    if (isPrimitive(x) && isPrimitive(y)) {
        return x === y;
    }

    if (Array.isArray(x) && Array.isArray(y)) {
        return x.length === y.length && x.every((it, i) => deepEqual(it, y[i]));
    }

    if (x == null || y == null) return false;

    if (Object.keys(x).length !== Object.keys(y).length) return false;

    // compare objects with same number of keys
    for (let key in x) {
        if (!(key in y)) return false; //other object doesn't have this prop
        if (!deepEqual(x[key], y[key])) return false;
    }

    return true;
}

export function shallowEqual(x, y) {
    //
    if (Object.is(x, y)) {
        return true;
    }

    if ((x == null && y != null) || (x != null && y == null)) return false;

    if (Array.isArray(x) && Array.isArray(y)) {
        return x.length === y.length && x.every((it, i) => Object.is(it, y[i]));
    }

    let keysX = Object.keys(x);
    let keysY = Object.keys(y);

    if (keysX.length !== keysY.length) return false;

    for (let i = 0; i < keysX.length; i++) {
        //
        const key = keysX[i];

        if (!Object.hasOwn(y, key) || !Object.is(x[key], y[key])) {
            //
            return false;
        }
    }
    return true;
}

export function icaseEq(s1: string, s2: string) {
    //
    return s1.toLowerCase() === s2.toLowerCase();
}

export function deepClone(obj) {
    return structuredClone(obj);
}

export function delay(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

export function toNum(n: any, fallback = 0) {
    return isNaN(+n) ? fallback : +n;
}

export function radianToDegree(n: number) {
    return (n * 180) / Math.PI;
}

export function degreeToRadian(n: number) {
    return (n * Math.PI) / 180;
}

export function round(num: number, digits: number) {
    digits = Math.floor(digits);
    const factor = 10 ** digits;
    return Math.round(num * factor) / factor;
}

export function removeKey<
    K extends string | number | symbol,
    V,
    O extends Record<K, V>
>(key: K, object: O): O {
    //
    const newObj = { ...object };

    delete newObj[key];

    return newObj;
}

export function removeItem<T>(arr: Array<T>, el: T): number {
    //
    const index = arr.indexOf(el);

    if (index >= 0) {
        arr.splice(index, 1);
    }

    return index;
}

export function removeDuplicates<T>(arr: Array<T>, field?: keyof T): Array<T> {
    //
    let ids = new Set();
    let result: Array<T> = [];

    arr.forEach((it) => {
        //
        const key = field != null ? it[field] : it;

        if (!ids.has(key)) {
            ids.add(key);
            result.push(it);
        }
    });

    return result;
}

export function partition<T>(
    xs: T[],
    predicate: (x: T) => boolean
): [yes: T[], no: T[]] {
    const yes: T[] = [];
    const no: T[] = [];

    for (let i = 0; i < xs.length; i++) {
        const el = xs[i];
        if (predicate(el)) {
            yes.push(el);
        } else {
            no.push(el);
        }
    }

    return [yes, no];
}

export async function sha1(message: string) {
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-1", msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    return hashHex;
}

export interface Deferred<T> {
    promise: Promise<T>;
    resolve: (t: T) => void;
    reject: (reason: any) => void;
}

export function deferred<T>(): Deferred<T> {
    let resolveFn: (t: T) => void;
    let rejectFn: (reason: any) => void;
    let result = null;

    let promise = new Promise<T>((resolve, reject) => {
        if (result) {
            if (result.success) {
                resolve(result.value);
            } else {
                reject(result.value);
            }
        } else {
            resolveFn = resolve;
            rejectFn = reject;
        }
    });

    return {
        promise,

        resolve(value: T) {
            if (resolveFn != null) {
                resolveFn(value);
            } else {
                result = { success: true, value };
            }
        },

        reject(value: any) {
            if (rejectFn != null) {
                rejectFn(value);
            } else {
                result = { success: false, value };
            }
        },
    };
}

export function toFixed(x: number) {
    let base100 = Math.floor(x * 100);

    if (base100 / 100 === x) return String(x);

    return x.toFixed(2);
}

export interface XYZ {
    x: number;
    y: number;
    z: number;
}

export function formatLocation({ x, y, z }: XYZ, _y: number) {
    return `${toFixed(x)}x${toFixed(y)}x${toFixed(z)}x${toFixed(_y)}`;
}

const RE_XYZ =
    /^(\-?\d+(?:\.\d*)?)x(\-?\d+(?:\.\d*)?)x(\-?\d+(?:\.\d*)?)x(\-?\d+(?:\.\d*)?)$/;

export function parseLocation(s: string): { position: XYZ; _y: number } {
    const match = RE_XYZ.exec(s);

    if (match != null) {
        return {
            position: {
                x: +match[1],
                y: +match[2],
                z: +match[3],
            },
            _y: +match[4],
        };
    }
    return null;
}

export function param(p: string | string[]) {
    return Array.isArray(p) ? p[p.length - 1] : p;
}

export class DelayedState<S> {
    state: S;
    tmpState: S;
    sameStateFrames = 0;
    minFrames;

    constructor(state: S, minFrames: number) {
        this.state = this.tmpState = state;
        this.minFrames = minFrames;
    }

    set(newState: S) {
        if (newState === this.tmpState) {
            this.sameStateFrames++;

            if (this.sameStateFrames >= this.minFrames) {
                this.state = this.tmpState;
            }
        } else {
            this.tmpState = newState;
            this.sameStateFrames = 0;
        }
        return this.state;
    }
}

export class LoaderState {
    static LOADING = "LOADING";
    static SUCCESS = "SUCCESS";
    static ERROR = "ERROR";
    static RETRYING = "RETRYING";
    static CANCEL = "CANCEL";

    state = null;

    tentatives = 0;

    errors = [];

    maxTentatives;

    constructor(maxTentatives: number) {
        this.maxTentatives = maxTentatives;
    }

    start() {
        this.state =
            this.tentatives > 0 ? LoaderState.RETRYING : LoaderState.LOADING;
        this.tentatives++;
    }

    success() {
        this.state = LoaderState.SUCCESS;
        this.tentatives = 0;
        this.errors = [];
    }

    error(err) {
        this.state = LoaderState.ERROR;
        this.errors.push(err);
    }

    cancel() {
        this.state = LoaderState.CANCEL;
        this.tentatives = 0;
        this.errors = [];
    }

    canRetry() {
        return this.tentatives < this.maxTentatives;
    }
}

export function clamp(val: number, min: number, max: number) {
    if (val < min) return min;
    if (val > max) return max;
    return val;
}

export function capitalize(val: string): string {
    return val.charAt(0).toUpperCase() + val.slice(1);
}

export const progressWidth = (value, min, max) => {
    return clamp(((value - min) * 100) / (max - min), 0, 100);
};

export type Result<T> =
    | { success: true; value: T }
    | { success: false; error: string };

export function Success<T>(value: T): Result<T> {
    return { success: true as const, value };
}

export function Failure(error: string): Result<any> {
    return { success: false as const, error };
}

export function leftPad(s: string | number, p: string, len: number) {
    s = String(s);
    return s.padStart(len, p);
}

const MILLIS_PER_DAY = 1000 * 60 * 60 * 24;

export function daysBetween(d1: Date, d2: Date): number {
    const dt = d2.getTime() - d1.getTime();
    return Math.floor(dt / MILLIS_PER_DAY);
}

const dateFormatter = new Intl.DateTimeFormat([], {
    dateStyle: "full",
    timeStyle: "short",
});

type DatePartType =
    | "weekday"
    | "month"
    | "day"
    | "year"
    | "hour"
    | "minute"
    | "dayPeriod";

function getPart(arr: Intl.DateTimeFormatPart[], part: DatePartType) {
    return arr.find((it) => it.type === part)?.value || "";
}

/**
 * return 1 .. 7, with 1 corresponding to Moday
 */
export function getWeekDay(date: Date) {
    // Date api returns 0 for Sunday
    const day = date.getDay();
    if (day === 0) return 7;
    return day;
}

// return next sunday
export function getWeekend(d: Date) {
    return new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate() + 7 - getWeekDay(d),
        23,
        59,
        59
    );
}

export function getNexWeekend(d: Date) {
    return new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate() + 14 - getWeekDay(d),
        23,
        59,
        59
    );
}

export function getHumanDateString(date: Date) {
    const now = new Date();

    if (now.getFullYear() !== date.getFullYear()) {
        return `on ${dateFormatter.format(date)}`;
    }

    const parts = dateFormatter.formatToParts(date);

    const weekday = getPart(parts, "weekday");
    const month = getPart(parts, "month");
    const day = getPart(parts, "day");
    const hour = getPart(parts, "hour");
    const minute = getPart(parts, "minute");
    const dayPeriod = getPart(parts, "dayPeriod");

    const time = `${hour}:${minute} ${dayPeriod}`;

    if (now.getMonth() === date.getMonth()) {
        const nowDayOfMonth = now.getDate();
        const dateDayOfMonth = date.getDate();

        const diffDays = dateDayOfMonth - nowDayOfMonth;

        if (diffDays === 0) {
            return `today at ${time}`;
        }

        if (diffDays === 1) {
            return `tomorrow at ${time}`;
        }

        const thisWeekend = getWeekend(now);
        const nextWeekend = getNexWeekend(now);

        if (date.getTime() > now.getTime()) {
            //
            if (date.getTime() < thisWeekend.getTime()) {
                return `this ${weekday} at ${time}`;
            } else if (date.getTime() < nextWeekend.getTime()) {
                return `next ${weekday} at ${time}`;
            }
        }
    }

    return `on ${weekday}, ${month} ${day} at ${time}`;
}

export function trimZeros(n: string) {
    while (n.endsWith("0")) {
        n = n.slice(0, n.length - 1);
    }

    if (n.endsWith(".")) {
        n = n.slice(0, n.length - 1);
    }

    return n;
}

export function isEmail(value: string) {
    return value?.match(
        /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    );
}

const Base58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58Decode(str: string) {
    //
    let temp = [];
    let result = [];

    for (let i = 0; i < str.length; i++) {
        //
        let c = Base58.indexOf(str[i]);

        // Illegal b58 character
        if (c < 0) return null;

        // prepend the result array with a zero if the base58 digit is zero
        // and non-zero characters haven't been seen yet (to ensure correct decode length)
        if (c === 0 && !(result.length ^ i)) {
            result.push(0);
        }

        let j = 0;
        while (j < temp.length || c) {
            //
            let n = temp[j];

            //shift the current byte 58 units and add the carry amount (or just add the carry amount if this is a new byte)
            n = n ? n * 58 + c : c;

            // carry
            c = n >> 8;

            //reset the current byte to the remainder (the carry amount will pass on the overflow)
            temp[j] = n % 256;

            j++;
        }
    }

    for (let j = temp.length - 1; j >= 0; j--) {
        result.push(temp[j]);
    }

    return result;
}

export async function postJSON(url: string, body: any) {
    //
    const response = await fetch(url, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    return response.json();
}

export async function getJSON(url: string) {
    //
    const response = await fetch(url, {
        headers: {
            Accept: "application/json",
        },
    });

    return response.json();
}

export function getFormData(data: object) {
    //
    let formData = new FormData();
    //
    Object.entries(data).forEach(([key, value]) => {
        formData.append(key, value);
    });

    return formData;
}

export const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

export const formatTimeLeft = (value: Duration) => {
    const time = `${value.hours() < 9 ? `0${value.hours()}` : value.hours()}h ${
        value.minutes() < 9 ? `0${value.minutes()}` : value.minutes()
    }m ${value.seconds() < 9 ? `0${value.seconds()}` : value.seconds()}s`;
    return value.days() < 0 ? `${value.days()}d ${time}` : time;
};

export const formatTimeLeftWithDays = (value: Duration, m: Moment = null) => {
    const days = Math.abs(value.days());
    const hours = Math.abs(value.hours());
    const minutes = Math.abs(value.minutes());
    const seconds = Math.abs(value.seconds());

    const _hours = `${hours <= 9 ? `0${hours}` : hours}h`;
    const _minutes = `${minutes <= 9 ? `0${minutes}` : minutes}m`;
    const _seconds = `${seconds <= 9 ? `0${seconds}` : seconds}s`;

    const time = `${_hours} ${_minutes} ${_seconds}`;

    return {
        left: Math.abs(days) <= 9 ? `0${days}d ${time}` : `${days}d ${time}`,
        type: value.milliseconds() < 0 ? "past" : "future",
        formatted: m ? m.format("lll") : null,
    };
};

export async function blobToBase64(blob): Promise<string | ArrayBuffer> {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    return new Promise((resolve) => {
        reader.onloadend = () => {
            resolve(reader.result);
        };
    });
}

export function firstMatch<T>(
    promises: Array<Promise<T>>,
    match: (t: T) => boolean
): Promise<T> {
    //
    if (promises.length === 0) return Promise.resolve(null);

    return new Promise((resolve, reject) => {
        //
        let wasSettled = false;
        let nbSettled = 0;

        function onResult(index: number, result: T) {
            //
            if (wasSettled) return;

            if (match(result)) {
                wasSettled = true;
                resolve(result);
                return;
            }

            nbSettled++;

            if (nbSettled === promises.length) {
                resolve(null);
            }
        }

        function onError(index: number, err: any) {
            //
            if (wasSettled) return;

            nbSettled++;

            if (nbSettled === promises.length) {
                resolve(null);
            }
        }

        promises.forEach((p, index) => {
            p.then(
                (result) => onResult(index, result),
                (err) => onError(index, err)
            );
        });
    });
}

export function rgbToHex(color: Array<number>) {
    if (!Array.isArray(color)) return "#ffffff";
    const [r, g, b] = color;
    const rgb = ((r * 255) << 16) | ((g * 255) << 8) | ((b * 255) << 0);
    return "#" + (0x1000000 + rgb).toString(16).slice(1);
}

export function asConst<S extends string>(s: S) {
    return s;
}

export function asAny(s) {
    return s as any;
}

export async function saveFile(content: string, opts) {
    //
    if ("showSaveFilePicker" in window) {
        //
        var taBlob = new Blob([content], { type: "text/plain" });

        try {
            //@ts-ignore
            const fileHandle = await window.showSaveFilePicker(opts);

            const writableFileStream = await fileHandle.createWritable();

            await writableFileStream.write(taBlob);

            await writableFileStream.close();
        } catch (err) {
            console.error(err);
        }
        //
    } else {
        //
        var data = "text/json;charset=utf-8," + encodeURIComponent(content);

        var a = document.createElement("a");

        a.href = "data:" + data;

        a.download = opts.suggestedName;

        var container = document.createElement("div");

        container.appendChild(a);

        a.click();

        container.removeChild(a);

        a = null;
    }
}

export const eclipseText = (text, maxLength) => {
    if (text.length <= maxLength) {
        return text;
    } else {
        return text.slice(0, maxLength - 3) + "...";
    }
};

export function combineAbortSignals(signals: AbortSignal[]): AbortSignal {
    //
    if (signals.length === 0) return undefined;
    if (signals.length === 1) return signals[0];

    const controller = new AbortController();

    function onAbort() {
        controller.abort();

        // Cleanup
        for (const signal of signals) {
            signal?.removeEventListener("abort", onAbort);
        }
    }

    for (const signal of signals) {
        if (signal?.aborted) {
            onAbort();

            break;
        }
        signal?.addEventListener("abort", onAbort);
    }

    return controller.signal;
}

// Hex to Buffer conversion

// precomputed conversion valus
let to_hex_array = [];
let to_byte_map = {};

for (let ord = 0; ord <= 0xff; ord++) {
    var s = ord.toString(16);
    if (s.length < 2) {
        s = "0" + s;
    }
    to_hex_array.push(s);
    to_byte_map[s] = ord;
}

// converter using lookups
export function bufferToHex(buffer: Uint8Array) {
    //
    var hex_array = [];

    for (let i = 0; i < buffer.length; i++) {
        //
        hex_array.push(to_hex_array[buffer[i]]);
    }

    return hex_array.join("");
}
// reverse conversion using lookups
export function hexToBuffer(s: string) {
    //
    var length2 = s.length;

    if (length2 % 2 != 0) {
        throw new Error("hex string must have length a multiple of 2");
    }

    let length = length2 / 2;

    let result = new Uint8Array(length);

    for (let i = 0; i < length; i++) {
        //
        var i2 = i * 2;

        var b = s.substring(i2, i2 + 2);

        result[i] = to_byte_map[b];
    }

    return result;
}

export async function selectFile(opts: {
    description: string;
    mime: string;
    extensions: string[];
}): Promise<File> {
    //
    if ("showOpenFilePicker" in window) {
        //

        const pickerOpts = {
            types: [
                {
                    description: opts.description,
                    accept: {
                        [opts.mime]: opts.extensions,
                    },
                },
            ],
            excludeAcceptAllOption: true,
            multiple: false,
        };

        try {
            //@ts-ignore
            const [fileHandle] = await window.showOpenFilePicker(pickerOpts);

            return fileHandle?.getFile();
            //
        } catch (err) {
            //
            if (err.code === DOMException.ABORT_ERR) return null;

            throw err;
        }

        //
    } else {
        //
        let lock = false;

        return new Promise((resolve) => {
            //
            let input = document.createElement("input");

            input.type = "file";

            input.style.display = "none";

            input.multiple = false;

            input.accept = opts.extensions.join(",");

            document.body.appendChild(input);

            input.addEventListener(
                "change",
                (event) => {
                    //
                    lock = true;

                    const file = input.files?.[0];

                    resolve(file);

                    document.body.removeChild(input);

                    input = null;
                    //
                },
                { once: true }
            );

            window.addEventListener(
                "focus",
                () => {
                    //
                    setTimeout(() => {
                        //
                        if (!lock && input) {
                            //
                            resolve(null);
                            // remove dom
                            document.body.removeChild(input);
                        }
                    }, 300);
                },
                { once: true }
            );

            input.click();
        });
    }
}

export function isObject(item) {
    return item && typeof item === "object" && !Array.isArray(item);
}

export const merge = (target, source) => {
    for (const key of Object.keys(source)) {
        if (source[key] instanceof Object)
            Object.assign(source[key], merge(target?.[key], source?.[key]));
    }
    Object.assign(target || {}, source);
    return target;
};

export const flattenObject = (obj, prefix = "") =>
    Object.keys(obj).reduce((acc, k) => {
        const pre = prefix.length ? prefix + "." : "";
        if (typeof obj[k] === "object")
            Object.assign(acc, flattenObject(obj[k], pre + k));
        else acc[pre + k] = obj[k];
        return acc;
    }, {});

export const isBlobUrl = (url) => {
    if (!url) return false;
    const urlObj = new URL(url);
    return urlObj.protocol === "blob:";
};

export const bytesToMegaBytes = (bytes) => bytes / (1024 * 1024);

export const isObjEmpty = (obj) => {
    return Object.keys(obj).length === 0;
};

export function removeLastDuplicate(arr) {
    for (let i = arr.length - 1; i >= 0; i--) {
        const current = arr[i];
        const lastIndex = arr.lastIndexOf(current);
        if (lastIndex !== i) {
            arr.splice(lastIndex, 1);
            break;
        }
    }
    return arr;
}

export async function isBrave() {
    // @ts-ignore
    const brave = window.navigator.brave;
    return brave != undefined && brave?.isBrave?.name == "isBrave";
}

export function isURL(str: string) {
    try {
        if (!str) return false;

        const url = new URL(str);

        if (url.protocol !== "http:" && url.protocol !== "https:") return false;

        return url;
    } catch (e) {
        return false;
    }
}
