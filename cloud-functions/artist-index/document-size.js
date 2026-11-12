// Conservative preflight based on https://firebase.google.com/docs/firestore/storage-size.
// Reserve space below 1 MiB; server validation remains authoritative.
const MAX_DOCUMENT_BYTES = 1024 * 1024;
const SAFE_DOCUMENT_BYTES = MAX_DOCUMENT_BYTES - 16 * 1024;
const stringBytes = (value) => Buffer.byteLength(value, "utf8") + 1;
const nameBytes = (path) => path.split("/").reduce((n, part) => n + stringBytes(part), 16);
function valueBytes(value) {
    if (value === null || typeof value === "boolean") return 1;
    if (typeof value === "number" || typeof value === "bigint") return 8;
    if (typeof value === "string") return stringBytes(value);
    if (Buffer.isBuffer(value) || value instanceof Uint8Array) return value.byteLength;
    if (value instanceof Date || typeof value?.toMillis === "function") return 8;
    if (typeof value?.path === "string" && typeof value?.get === "function") return nameBytes(value.path);
    if (typeof value?.latitude === "number" && typeof value?.longitude === "number") return 16;
    if (Array.isArray(value)) return value.reduce((n, item) => n + valueBytes(item), 0);
    if (value && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
        return Object.entries(value).reduce((n, [key, item]) => n + stringBytes(key) + valueBytes(item), 32);
    }
    // Unsupported SDK values cannot be sized safely: skip rather than undercount.
    return Infinity;
}
function documentBytes(data, path = "exhibits/unknown") {
    return nameBytes(path) + valueBytes(data);
}
class DocumentSizeError extends Error {
    constructor(bytes) {
        super(`Gallery document needs size review (${bytes} estimated bytes)`);
        this.code = "DOCUMENT_SIZE_LIMIT";
        this.estimatedBytes = bytes;
    }
}
function assertDocumentFits(data, path) {
    const bytes = documentBytes(data, path);
    if (bytes > SAFE_DOCUMENT_BYTES) throw new DocumentSizeError(bytes);
    return bytes;
}
function isDocumentSizeError(error) {
    return error?.code === "DOCUMENT_SIZE_LIMIT" ||
        ([3, "3", "INVALID_ARGUMENT"].includes(error?.code) &&
         /(?:size.*exceeds.*maximum|maximum.*document.*size)/i.test(error.message || ""));
}
module.exports = { documentBytes, assertDocumentFits, isDocumentSizeError, DocumentSizeError, SAFE_DOCUMENT_BYTES };
