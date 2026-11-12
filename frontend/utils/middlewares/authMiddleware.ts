import jwt from "jsonwebtoken";

// Opaque content and cross-origin subresources cannot borrow browser account
// cookies. CORS alone does not stop simple requests from executing on the
// server. Explicit credentials remain usable by callers that already hold them.
function isPageUrl(rawUrl) {
    if (typeof rawUrl !== "string" || !rawUrl.startsWith("/")) return false;
    try {
        const base = "https://oncyber.invalid";
        const parsed = new URL(rawUrl, base);
        if (parsed.origin !== base) return false;
        const decoded = decodeURIComponent(parsed.pathname);
        // Reject ambiguous repeated encodings, separators and control bytes.
        if (decoded.startsWith("//") || /[%?#\\\x00-\x20]/.test(decoded)) {
            return false;
        }
        const path = new URL(decoded, base).pathname.toLowerCase();
        return path !== "/api" && !path.startsWith("/api/");
    } catch {
        return false;
    }
}

function allowsCookieAuth(req) {
    const headers = req?.headers || {};
    if (headers.origin === "null") return false;

    const site = headers["sec-fetch-site"];
    if (site === "same-site" || site === "cross-site") {
        // Keep incoming links to pages signed in. API GETs may mutate legacy
        // state, so even top-level navigations must not lend them cookies.
        return (
            req.method === "GET" &&
            headers["sec-fetch-mode"] === "navigate" &&
            headers["sec-fetch-dest"] === "document" &&
            isPageUrl(req.url)
        );
    }

    // same-origin, none, and clients without Fetch Metadata retain compatibility.
    // Missing metadata in old browsers is not a complete CSRF defense.
    return true;
}

export function getToken(req) {
    return (
        (typeof req?.headers?.authorization === "string" &&
        req.headers.authorization.startsWith("Bearer ")
            ? req.headers.authorization.slice(7)
            : undefined) ||
        req?.body?.token ||
        req?.query?.token ||
        (allowsCookieAuth(req)
            ? req?.cookies?.[req?.cookies?.["_CCA"]]
            : undefined)
    );
}

export function auth(req): Promise<string> {
    //
    let token = getToken(req);

    // used to validate the switching accounts in artworkMenu
    if (req.query?.userId && req.query.validate && allowsCookieAuth(req)) {
        token = req?.cookies?.[req.query?.userId];
    }

    return verify(token);
}

export function verify(token): Promise<string> {
    return new Promise((resolve, reject) => {
        jwt.verify(token, process.env.SECRET_JWT_KEY, function (err, decoded) {
            if (err) {
                reject("Failed to authenticate token.");
            } else {
                return resolve(decoded.user);
            }
        });
    });
}
