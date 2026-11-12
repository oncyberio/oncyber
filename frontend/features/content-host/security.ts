/**
 * All externally supplied engines run with an opaque origin. Do not add
 * allow-same-origin: a redirected frame could otherwise reach the host origin.
 * Neither sandboxing nor Permissions Policy controls installed extensions; the
 * host also never exposes a provider, signing function, or authentication token.
 */
export const CONTENT_SANDBOX = "allow-scripts allow-pointer-lock";

/** Fullscreen stays host-owned so a game cannot cover the trusted controls. */
export const CONTENT_PERMISSIONS = [
    "autoplay *",
    "camera 'none'",
    "microphone 'none'",
    "geolocation 'none'",
    "payment 'none'",
    "fullscreen 'none'",
    "display-capture 'none'",
    "clipboard-read 'none'",
    "clipboard-write 'none'",
    "usb 'none'",
    "serial 'none'",
    "hid 'none'",
    "publickey-credentials-get 'none'",
    "publickey-credentials-create 'none'",
    "xr-spatial-tracking 'none'",
].join("; ");

/**
 * Wallet consent must not be shown inside an attacker-controlled page. Walk
 * every ancestor: checking only the immediate parent misses a trusted frame
 * nested by a hostile top-level page. Same-origin lobby frames remain valid.
 */
export function isTrustedContentHostWindow(
    hostWindow: Pick<Window, "location" | "parent"> | null = typeof window ===
    "undefined"
        ? null
        : window
): boolean {
    if (!hostWindow) return false;
    try {
        const origin = hostWindow.location.origin;
        if (!origin || origin === "null") return false;
        let current = hostWindow;
        // Browsers do not permit ancestor cycles. The bound also fails safely
        // for pathological nesting without monopolizing the UI thread.
        for (let depth = 0; depth < 128; depth++) {
            const parent = current.parent;
            if (parent === current) return true;
            if (!parent || parent.location.origin !== origin) return false;
            current = parent;
        }
    } catch {
        // Reading a cross-origin WindowProxy's location raises SecurityError.
    }
    return false;
}

function isLoopback(hostname: string) {
    return (
        ["localhost", "127.0.0.1", "[::1]"].includes(hostname) ||
        hostname.endsWith(".localhost")
    );
}

/** Unregistered previews may test address consent only on a local dev host. */
export function allowsLocalContentPreviewWallet(
    hostOrigin: string,
    development = process.env.NODE_ENV === "development"
): boolean {
    if (!development) return false;
    try {
        const host = new URL(hostOrigin);
        return (
            ["http:", "https:"].includes(host.protocol) &&
            isLoopback(host.hostname) &&
            !host.username &&
            !host.password
        );
    } catch {
        return false;
    }
}

/** Validate without fetching. Same-origin documents never qualify as engines. */
export function validateExternalContentUrl(
    raw: string,
    hostOrigin: string,
    options: { allowLocalhost?: boolean } = {}
): URL {
    if (typeof raw !== "string" || !raw || raw.length > 4096) {
        throw new Error("Content requires a valid external HTTPS URL.");
    }
    let url: URL;
    let host: URL;
    try {
        url = new URL(raw);
        host = new URL(hostOrigin);
    } catch {
        throw new Error("Content requires a valid external HTTPS URL.");
    }
    const localDevelopment =
        options.allowLocalhost === true &&
        isLoopback(host.hostname) &&
        isLoopback(url.hostname) &&
        url.protocol === "http:";
    if (
        (url.protocol !== "https:" && !localDevelopment) ||
        !["http:", "https:"].includes(host.protocol) ||
        !url.hostname ||
        url.username ||
        url.password ||
        url.origin === host.origin
    ) {
        throw new Error("Content must use a separate HTTPS origin.");
    }
    return url;
}

export interface ConnectPermissionIdentity {
    experienceId: string;
    /** Exact canonical URL, including query, fragment and release identifier. */
    url: string;
    accountId: string;
    releaseId?: string;
}

type PreferenceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const PREFERENCE_PREFIX = "oncyber:content:connect-explanation:v1:";
const PREFERENCE_TTL = 8 * 60 * 60 * 1000;

/**
 * Remembers only the explanatory text preference, NEVER wallet authorization.
 * The host must still require an explicit Share address click on EVERY request.
 * Opaque origins cannot attest the final URL following an iframe redirect.
 * Use sessionStorage, clear pending approvals on load/account changes, and never
 * send an address merely because has() returns true.
 */
export class ConnectPermissionStore {
    constructor(
        private storage?: PreferenceStorage,
        private now: () => number = Date.now
    ) {}

    private key(identity: ConnectPermissionIdentity): string | null {
        if (
            !identity.experienceId ||
            !identity.url ||
            !identity.accountId ||
            identity.experienceId.length > 256 ||
            identity.url.length > 4096 ||
            identity.accountId.length > 256 ||
            (identity.releaseId?.length ?? 0) > 256
        ) {
            return null;
        }
        return (
            PREFERENCE_PREFIX +
            JSON.stringify([
                identity.experienceId,
                identity.url,
                identity.releaseId || "",
                identity.accountId,
                "wallet.connect",
            ])
        );
    }

    has(identity: ConnectPermissionIdentity): boolean {
        const key = this.key(identity);
        if (!key || !this.storage) return false;
        try {
            const value = JSON.parse(this.storage.getItem(key) || "null");
            const now = this.now();
            if (
                value?.dismissed === true &&
                Number.isFinite(value.expiresAt) &&
                value.expiresAt > now &&
                value.expiresAt <= now + PREFERENCE_TTL
            ) {
                return true;
            }
            this.storage.removeItem(key);
        } catch {
            // Storage can be unavailable in privacy modes. Always show details.
        }
        return false;
    }

    grant(identity: ConnectPermissionIdentity): void {
        const key = this.key(identity);
        if (!key || !this.storage) return;
        try {
            this.storage.setItem(
                key,
                JSON.stringify({
                    dismissed: true,
                    expiresAt: this.now() + PREFERENCE_TTL,
                })
            );
        } catch {
            // A failed preference write must not change authorization behavior.
        }
    }

    revoke(identity: ConnectPermissionIdentity): void {
        const key = this.key(identity);
        if (!key || !this.storage) return;
        try {
            this.storage.removeItem(key);
        } catch {}
    }
}
