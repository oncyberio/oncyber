/** @jest-environment node */
import { createHash, createVerify, generateKeyPairSync } from "crypto";
import * as admin from "firebase-admin";
import { gcsReleaseBucket } from "./releaseBucket";

/**
 * The real signer of the storage library the site ships with, and a key
 * made here for the test: no request leaves this machine. What is checked
 * is that each address signs the object's name and every header the
 * command is told to send. That Cloud Storage then enforces them is its
 * documented behaviour, and is not run here.
 */
const BUCKET = "release-bucket-test";
const EMAIL = "signer@release-bucket-test.iam.gserviceaccount.com";
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
});
const app = admin.initializeApp(
    {
        credential: admin.credential.cert({
            projectId: "release-bucket-test",
            clientEmail: EMAIL,
            privateKey: privateKey
                .export({ type: "pkcs8", format: "pem" })
                .toString(),
        }),
    },
    "release-bucket-test"
);
afterAll(() => app.delete());

const bucket = gcsReleaseBucket(app.storage().bucket(BUCKET));
const object = `games-staging/${"A".repeat(24)}/assets/a b+c.js`;
const expiresAt = Date.now() + 30 * 60 * 1000;

/** True when `url` carries a V4 signature over exactly these headers. */
function signatureCovers(url: URL, headers: Record<string, string>) {
    const sent: Record<string, string> = { host: url.host };
    for (const [name, value] of Object.entries(headers))
        sent[name.toLowerCase()] = value;
    const names = Object.keys(sent).sort();
    const query = [...url.searchParams]
        .filter(([name]) => name !== "X-Goog-Signature")
        .map(
            ([name, value]) =>
                `${encodeURIComponent(name)}=${encodeURIComponent(value)}`
        )
        .sort()
        .join("&");
    const request = [
        "PUT",
        url.pathname,
        query,
        names.map((name) => `${name}:${sent[name]}\n`).join(""),
        names.join(";"),
        "UNSIGNED-PAYLOAD",
    ].join("\n");
    const date = url.searchParams.get("X-Goog-Date");
    const signed = [
        "GOOG4-RSA-SHA256",
        date,
        `${date.slice(0, 8)}/auto/storage/goog4_request`,
        createHash("sha256").update(request).digest("hex"),
    ].join("\n");
    return createVerify("RSA-SHA256")
        .update(signed)
        .verify(publicKey, url.searchParams.get("X-Goog-Signature"), "hex");
}

test("an upload address is a V4 signed PUT for one object, the listed size and bytes, create only", async () => {
    const md5 = createHash("md5").update("hello").digest("base64");
    const { url, headers } = await bucket.signUpload({
        object,
        bytes: 5,
        exact: true,
        md5,
        expiresAt,
    });
    const address = new URL(url);
    expect(address.origin).toBe("https://storage.googleapis.com");
    expect(decodeURIComponent(address.pathname)).toBe(`/${BUCKET}/${object}`);
    expect(headers).toEqual({
        "Content-Type": "application/octet-stream",
        "Content-MD5": md5,
        "x-goog-content-length-range": "5,5",
        "x-goog-if-generation-match": "0",
    });
    expect(address.searchParams.get("X-Goog-Algorithm")).toBe(
        "GOOG4-RSA-SHA256"
    );
    expect(address.searchParams.get("X-Goog-SignedHeaders")).toBe(
        "content-md5;content-type;host;x-goog-content-length-range;x-goog-if-generation-match"
    );
    const lasts = Number(address.searchParams.get("X-Goog-Expires"));
    expect(lasts).toBeGreaterThan(29 * 60);
    expect(lasts).toBeLessThanOrEqual(30 * 60);
    expect(address.searchParams.get("X-Goog-Credential")).toContain(EMAIL);
    // The signature is over these headers and this object, and no others.
    expect(signatureCovers(address, headers)).toBe(true);
    expect(
        signatureCovers(address, {
            ...headers,
            "x-goog-content-length-range": "0,99999999",
        })
    ).toBe(false);
    expect(
        signatureCovers(address, { ...headers, "Content-MD5": "AAAA" })
    ).toBe(false);
    const { "x-goog-if-generation-match": _create, ...replacing } = headers;
    expect(signatureCovers(address, replacing)).toBe(false);
    const elsewhere = new URL(url);
    elsewhere.pathname = `/${BUCKET}/games/my-game/0123456789abcdef/index.html`;
    expect(signatureCovers(elsewhere, headers)).toBe(false);
});

test("without an MD5, and for the picture: still a size, still create only", async () => {
    const exact = await bucket.signUpload({
        object,
        bytes: 7,
        exact: true,
        expiresAt,
    });
    expect(exact.headers).toEqual({
        "Content-Type": "application/octet-stream",
        "x-goog-content-length-range": "7,7",
        "x-goog-if-generation-match": "0",
    });
    expect(signatureCovers(new URL(exact.url), exact.headers)).toBe(true);
    const upTo = await bucket.signUpload({
        object,
        bytes: 524288,
        exact: false,
        expiresAt,
    });
    expect(upTo.headers["x-goog-content-length-range"]).toBe("0,524288");
    expect(signatureCovers(new URL(upTo.url), upTo.headers)).toBe(true);
});
